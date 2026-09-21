-- Limite de cartas da colecao passa a valer no SERVIDOR.
--
-- ★ POR QUE (21/09/2026, card #374, migration aprovada pelo Du). A estrategia
-- decidida no mesmo dia (#360, #368) libera tudo em todos os planos -- Pokedex
-- e Metas -- e faz do LIMITE DE CARTAS a parede principal: quem usa mais bate
-- no limite e ai assina o Plus. So que esse limite existia so no navegador:
-- checkCardLimit roda com a chave publica e user_cards nao tinha trigger. A
-- REST direta passava por cima, e o Scan (ScanModal) e a importacao em lote
-- nunca checaram -- um Plus conseguia passar de 500 cartas escaneando.
--
-- ★ REGRA DOS TERMOS (clausula 4.4): o limite BLOQUEIA ADICIONAR carta nova e
-- NUNCA apaga. Quem ja passou de 100 (14 usuarios em 21/09, tres com 300 a
-- 500) nao perde nada -- o trigger e so de INSERT.
--
-- Mesmo padrao do trg_enforce_limite_cartas do marketplace: chave de servico
-- passa (processos de servidor e admin nao quebram), advisory lock por usuario
-- contra corrida, e erro P0001 com prefixo legivel para o cliente reconhecer.
--
-- Rollback: drop trigger trg_enforce_limite_cartas_colecao on public.user_cards;
-- drop function public.enforce_limite_cartas_colecao();
-- drop function public.cartas_limite_colecao(text, boolean, timestamptz, timestamptz);
-- e reaplicar importar_cartas_lote como estava (baseline_schema.sql).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. O limite por plano, espelhando resolvePlan() de src/lib/plan.ts.
-- ─────────────────────────────────────────────────────────────────────────────
-- -1 = ilimitado. A ORDEM importa e e a mesma do resolvePlan: plano pago vale
-- antes do trial (quem assinou o Plus dentro do trial fica com 500, nao com o
-- ilimitado do trial).
CREATE OR REPLACE FUNCTION public.cartas_limite_colecao(
  p_plano   text,
  p_is_pro  boolean,
  p_pro_exp timestamptz,
  p_trial   timestamptz
)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- 1) plano pago ativo (normalizado como o normalizeTier do plan.ts)
    WHEN lower(btrim(coalesce(p_plano,''))) = 'plus'
         AND (p_pro_exp IS NULL OR p_pro_exp > now())                       THEN 500
    WHEN lower(btrim(coalesce(p_plano,''))) IN ('pro','mensal','pro_anual','anual')
         AND (p_pro_exp IS NULL OR p_pro_exp > now())                       THEN -1
    -- 2) concessao manual antiga: is_pro sem plano canonico
    WHEN p_is_pro AND (p_pro_exp IS NULL OR p_pro_exp > now())              THEN -1
    -- 3) trial reverso ativo = Pro completo
    WHEN p_trial IS NOT NULL AND p_trial > now()                            THEN -1
    -- 4) Gratis
    ELSE 100
  END
$function$;

REVOKE ALL ON FUNCTION public.cartas_limite_colecao(text, boolean, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cartas_limite_colecao(text, boolean, timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.cartas_limite_colecao(text, boolean, timestamptz, timestamptz) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. O trigger.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_limite_cartas_colecao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  -- como o enforce_limite_cartas: le users/user_cards sem depender da RLS
SET search_path TO 'public'
AS $function$
DECLARE
  v_papel   text;
  v_plano   text;
  v_is_pro  boolean;
  v_pro_exp timestamptz;
  v_trial   timestamptz;
  v_limite  int;
  v_count   int;
BEGIN
  -- Chave de servico passa: processos de servidor, admin e restauracao.
  v_papel := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', 'service_role');
  IF v_papel = 'service_role' THEN RETURN NEW; END IF;

  -- ★ INCREMENTO NAO E CARTA NOVA. `INSERT ... ON CONFLICT DO UPDATE` (usado
  -- pela importacao em lote) dispara BEFORE INSERT mesmo quando a linha vira
  -- UPDATE de quantidade. Sem este desvio, quem esta no limite nao conseguiria
  -- somar mais uma copia de carta que ja tem -- o limite conta cartas
  -- DIFERENTES, nao copias.
  IF NEW.graduada IS NOT TRUE AND NEW.pokemon_api_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.user_cards
        WHERE user_id = NEW.user_id
          AND pokemon_api_id = NEW.pokemon_api_id
          AND graduada = false
     ) THEN
    RETURN NEW;
  END IF;

  -- ★ CARTA COMPRADA SEMPRE ENTRA. O limite e sobre catalogar, nao sobre
  -- comprar: sem isto, um Gratis com 100 cartas que confirma o recebimento
  -- ficava preso em "tente de novo" (concluirCompra.ts poe a carta na colecao
  -- ANTES de concluir o anuncio, e sem carta a venda nao fecha). Vale so
  -- enquanto existe o anuncio em `enviado` com este usuario como comprador --
  -- exatamente o estado da maquina de /api/marketplace/[id]/status em que o
  -- `concluir` e aceito. Depois do concluido a isencao some sozinha.
  IF EXISTS (
       SELECT 1 FROM public.marketplace m
        WHERE m.buyer_id = NEW.user_id
          AND m.status = 'enviado'
          AND m.removido_em IS NULL
          AND (m.card_id = NEW.pokemon_api_id
               OR (m.card_id IS NULL AND m.card_name = NEW.card_name))
     ) THEN
    RETURN NEW;
  END IF;

  SELECT plano, coalesce(is_pro,false), pro_expira_em, trial_expires_at
    INTO v_plano, v_is_pro, v_pro_exp, v_trial
    FROM public.users WHERE id = NEW.user_id;

  v_limite := public.cartas_limite_colecao(v_plano, v_is_pro, v_pro_exp, v_trial);
  IF v_limite = -1 THEN RETURN NEW; END IF;

  -- Dois inserts simultaneos do mesmo usuario nao passam os dois pelo limite.
  PERFORM pg_advisory_xact_lock(hashtextextended('limite_colecao:' || NEW.user_id::text, 0));

  -- Conta LINHAS, como checkCardLimit no navegador (graduadas contam: cada slab
  -- e um item distinto).
  SELECT count(*) INTO v_count FROM public.user_cards WHERE user_id = NEW.user_id;

  IF v_count >= v_limite THEN
    RAISE EXCEPTION 'LIMITE_CARTAS: sua colecao chegou ao limite de % cartas do seu plano.', v_limite
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_enforce_limite_cartas_colecao ON public.user_cards;
CREATE TRIGGER trg_enforce_limite_cartas_colecao
  BEFORE INSERT ON public.user_cards
  FOR EACH ROW EXECUTE FUNCTION public.enforce_limite_cartas_colecao();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. importar_cartas_lote: para no limite em vez de falhar o lote inteiro.
-- ─────────────────────────────────────────────────────────────────────────────
-- Sem isto, a excecao do trigger no meio do laco abortaria a transacao: quem
-- estava em 95 cartas e colava 10 novas perdia as 10 e via "nao foi possivel
-- analisar". Agora importa ate o limite, para, e devolve `limite_atingido`.
CREATE OR REPLACE FUNCTION public.importar_cartas_lote(items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  it jsonb; cid text; qty int;
  adicionadas int := 0; incrementadas int := 0; processadas int := 0;
  cap int := 32; c record; v_existed boolean;
  v_limite_atingido boolean := false;
begin
  if uid is null then return jsonb_build_object('erro','nao_autenticado'); end if;
  if items is null or jsonb_typeof(items) <> 'array' then return jsonb_build_object('erro','payload_invalido'); end if;

  for it in select value from jsonb_array_elements(items) loop
    exit when processadas >= cap;
    cid := it->>'card_id';
    qty := least(greatest(coalesce((it->>'quantidade')::int, 1), 1), 99);
    if cid is null or btrim(cid) = '' then continue; end if;

    select id, name, number, set_name, image_small, rarity
      into c from public.pokemon_cards where id = cid limit 1;
    if c.id is null then continue; end if;

    processadas := processadas + 1;

    -- so considera a PILHA nao-graduada (graduadas sao itens a parte)
    select exists(
      select 1 from public.user_cards
      where user_id = uid and pokemon_api_id = cid and graduada = false
    ) into v_existed;

    begin
      insert into public.user_cards
        (user_id, pokemon_api_id, card_id, card_name, card_image, set_name, rarity, variante, graduada, quantity)
      values
        (uid, cid, cid, c.name, c.image_small, c.set_name, c.rarity, 'normal', false, qty)
      on conflict (user_id, pokemon_api_id) where pokemon_api_id is not null and graduada = false
      do update set quantity = public.user_cards.quantity + excluded.quantity;
    exception when sqlstate 'P0001' then
      if sqlerrm like 'LIMITE_CARTAS%' then
        v_limite_atingido := true;
        processadas := processadas - 1;
        exit;
      end if;
      raise;
    end;

    if v_existed then incrementadas := incrementadas + 1; else adicionadas := adicionadas + 1; end if;
  end loop;

  return jsonb_build_object(
    'adicionadas', adicionadas, 'incrementadas', incrementadas,
    'processadas', processadas, 'teto', cap,
    'limite_atingido', v_limite_atingido
  );
end $function$;
