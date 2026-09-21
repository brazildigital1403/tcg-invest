-- Metas de colecao (#368), passo 1: o MOTOR.
--
-- ★ POR QUE (21/09/2026). Decisao do Du: Metas liberadas em TODOS os planos.
-- Elas nao vendem o Plus diretamente -- fazem o colecionador usar, adicionar
-- carta e bater no limite de cartas (Free 100 -> Plus 500), que desde o #374
-- vale no banco. Meta por POKEMON (base_pokemon_names) ou por COLECAO (set_id).
-- NAO ancora no Master Set: e produto pago, cobre ~33 sets e o nome colide.
--
-- ★ CUSTO MEDIDO ANTES (explain analyze buffers, 21/09):
--   - maior meta por Pokemon: Pikachu, 660 cartas (446 ocidentais). Bitmap no
--     GIN idx_pokemon_cards_base_names + ~600 blocos de heap. Com a coleção do
--     maior usuario (500 cartas) junto: 8 ms quente, ~970 blocos. Frio, no
--     pior caso, na casa de 1 s -- longe dos 8 s do authenticator.
--   - maior meta por colecao: set 'mc', 766 cartas, pelo btree de set_id.
--   Nada aqui varre pokemon_cards_all: sempre o conjunto pequeno da meta.
--
-- ★ A LISTA DE METAS NAO RECALCULA. Somar 10 metas ao vivo seriam ~6 mil
-- blocos por abertura de tela. O calculo roda so ao abrir UMA meta
-- (meta_cartas), que grava o retrato (total/tenho/valores) na propria linha.
-- A lista le a tabela, que e minuscula.
--
-- ★ VALOR = bynx_valor_carta(), a fonte unica da regra de divulgacao (menor
-- preco, 25/08). Nao reescrever a cascata aqui.
--
-- ★ IDIOMA. O catalogo ocidental e uma ficha por carta (Pikachu: 431 en + 15
-- exclusivas pt); o idioma de quem TEM mora em user_cards.idioma. Meta com
-- idioma = so conta a copia naquele idioma. Meta sem idioma = qualquer um.
--
-- Rollback: drop function public.meta_cartas(uuid);
-- drop function public.criar_meta(text, text, text, text);
-- drop table public.metas_colecao;

CREATE TABLE public.metas_colecao (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN ('pokemon','set')),
  -- nome-base do Pokemon (como em base_pokemon_names) ou o set_id
  alvo          text NOT NULL CHECK (length(alvo) BETWEEN 1 AND 80),
  -- so para meta por Pokemon: 'ocidental' (padrao), 'jp', 'cn' ou null = todas
  regiao        text CHECK (regiao IN ('ocidental','jp','cn')),
  -- idioma da copia que conta; null = tanto faz
  idioma        text CHECK (idioma IN ('pt','en','jp','cn','kr','es','fr','de','it')),
  -- retrato gravado por meta_cartas()
  total         int,
  tenho         int,
  valor_total   numeric,
  valor_tenho   numeric,
  calculado_em  timestamptz,
  concluida_em  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX metas_colecao_unica
  ON public.metas_colecao (user_id, tipo, alvo, coalesce(regiao,''), coalesce(idioma,''));

-- ★ Tabela nova nasce exposta no Supabase (default privilege da tudo ao
-- authenticated). Fecha tudo e abre so o que a tela precisa: LER e APAGAR as
-- proprias. Criar e recalcular passam pelas funcoes abaixo, que validam.
ALTER TABLE public.metas_colecao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.metas_colecao FROM anon, authenticated;
GRANT SELECT, DELETE ON public.metas_colecao TO authenticated;

CREATE POLICY metas_colecao_ler_proprias ON public.metas_colecao
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY metas_colecao_apagar_proprias ON public.metas_colecao
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- criar_meta: valida o alvo contra o catalogo e cria (ou devolve a existente).
-- ─────────────────────────────────────────────────────────────────────────────
-- Teto de 50 metas por pessoa: anti-abuso, nao parede de plano (tudo liberado).
CREATE OR REPLACE FUNCTION public.criar_meta(
  p_tipo text, p_alvo text, p_regiao text DEFAULT 'ocidental', p_idioma text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_id uuid;
  v_regiao text := CASE WHEN p_tipo = 'pokemon' THEN p_regiao ELSE NULL END;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'META_NAO_AUTENTICADO' USING ERRCODE = 'P0001'; END IF;

  IF p_tipo = 'pokemon' THEN
    IF NOT EXISTS (SELECT 1 FROM public.pokemon_cards WHERE base_pokemon_names @> ARRAY[p_alvo]) THEN
      RAISE EXCEPTION 'META_ALVO_INVALIDO: Pokemon nao encontrado.' USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_tipo = 'set' THEN
    IF NOT EXISTS (SELECT 1 FROM public.pokemon_cards WHERE set_id = p_alvo) THEN
      RAISE EXCEPTION 'META_ALVO_INVALIDO: Colecao nao encontrada.' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    RAISE EXCEPTION 'META_ALVO_INVALIDO: tipo de meta desconhecido.' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_id FROM public.metas_colecao
   WHERE user_id = uid AND tipo = p_tipo AND alvo = p_alvo
     AND coalesce(regiao,'') = coalesce(v_regiao,'') AND coalesce(idioma,'') = coalesce(p_idioma,'');
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  IF (SELECT count(*) FROM public.metas_colecao WHERE user_id = uid) >= 50 THEN
    RAISE EXCEPTION 'META_LIMITE: voce ja tem 50 metas.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.metas_colecao (user_id, tipo, alvo, regiao, idioma)
  VALUES (uid, p_tipo, p_alvo, v_regiao, p_idioma)
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- meta_cartas: as cartas da meta com "tenho" e valor, e grava o retrato.
-- ─────────────────────────────────────────────────────────────────────────────
-- Devolve jsonb { meta: {...}, cartas: [...] } numa ida so. VOLATILE porque
-- atualiza o retrato e marca concluida_em na primeira vez que fecha.
CREATE OR REPLACE FUNCTION public.meta_cartas(p_meta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  m public.metas_colecao;
  v_cartas jsonb;
  v_total int; v_tenho int; v_vt numeric; v_vtenho numeric;
BEGIN
  SELECT * INTO m FROM public.metas_colecao WHERE id = p_meta_id AND user_id = uid;
  IF m.id IS NULL THEN RETURN jsonb_build_object('erro','meta_nao_encontrada'); END IF;

  -- Um ramo por tipo, e nao um OR: com as variaveis da funcao o planner monta
  -- plano generico, e um OR entre o GIN e o btree pode virar Seq Scan na
  -- tabela de 187 MB. Com UNION ALL cada ramo usa o proprio indice e o ramo
  -- do outro tipo morre num One-Time Filter.
  WITH alvo AS (
    SELECT pc.id, pc.name, pc.number, pc.set_id, pc.set_name, pc.set_release_date,
           pc.image_small, pc.rarity, pc.regiao,
           public.bynx_valor_carta(pc, 'normal') AS valor
      FROM public.pokemon_cards pc
     WHERE m.tipo = 'pokemon' AND pc.base_pokemon_names @> ARRAY[m.alvo]
       AND (m.regiao IS NULL OR pc.regiao = m.regiao)
    UNION ALL
    SELECT pc.id, pc.name, pc.number, pc.set_id, pc.set_name, pc.set_release_date,
           pc.image_small, pc.rarity, pc.regiao,
           public.bynx_valor_carta(pc, 'normal') AS valor
      FROM public.pokemon_cards pc
     WHERE m.tipo = 'set' AND pc.set_id = m.alvo
  ),
  minhas AS (
    SELECT uc.pokemon_api_id, array_agg(DISTINCT coalesce(uc.idioma,'pt')) AS idiomas
      FROM public.user_cards uc
     WHERE uc.user_id = uid AND uc.pokemon_api_id IS NOT NULL
       AND (m.idioma IS NULL OR coalesce(uc.idioma,'pt') = m.idioma)
     GROUP BY 1
  ),
  linhas AS (
    SELECT a.*, (mi.pokemon_api_id IS NOT NULL) AS tenho, mi.idiomas
      FROM alvo a LEFT JOIN minhas mi ON mi.pokemon_api_id = a.id
  )
  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'card_id', id, 'nome', name, 'numero', number, 'set_id', set_id,
      'set_name', set_name, 'lancamento', set_release_date, 'image_small', image_small,
      'raridade', rarity, 'regiao', regiao, 'valor', valor, 'tenho', tenho,
      'idiomas_tenho', idiomas
    ) ORDER BY set_release_date NULLS LAST, set_id,
           -- number e texto: sem isto "10" vem antes de "2"
           nullif(substring(number FROM '^[0-9]+'), '')::int NULLS LAST, number), '[]'::jsonb),
    count(*), count(*) FILTER (WHERE tenho),
    coalesce(sum(valor), 0), coalesce(sum(valor) FILTER (WHERE tenho), 0)
  INTO v_cartas, v_total, v_tenho, v_vt, v_vtenho
  FROM linhas;

  UPDATE public.metas_colecao
     SET total = v_total, tenho = v_tenho, valor_total = v_vt, valor_tenho = v_vtenho,
         calculado_em = now(),
         concluida_em = CASE WHEN concluida_em IS NULL AND v_total > 0 AND v_tenho = v_total
                             THEN now() ELSE concluida_em END
   WHERE id = m.id
   RETURNING * INTO m;

  RETURN jsonb_build_object('meta', to_jsonb(m), 'cartas', v_cartas);
END
$function$;

REVOKE ALL ON FUNCTION public.criar_meta(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.meta_cartas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_meta(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.meta_cartas(uuid) TO authenticated;
