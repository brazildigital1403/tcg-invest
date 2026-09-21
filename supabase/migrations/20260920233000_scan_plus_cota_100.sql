-- Scan IA no plano Plus: cota de 100 por mes.
--
-- ★ POR QUE (20/09/2026, decisao do Du). O Plus e o plano de ENTRADA e nao dava
-- acesso ao Scan, que e a feature que da nome a tela principal do produto. Quem
-- queria escanear so tinha um caminho: R$ 29,90. No mercado inteiro o scan e
-- isca de aquisicao -- MegaDex e Ludex dao ilimitado de graca, TCG Vision da
-- 300/mes -- e a Bynx era a unica plataforma medida que cobrava por ele ja no
-- degrau de entrada.
--
-- ★ POR QUE 100 E NAO ILIMITADO. O ilimitado do Pro foi justificado em 08/08
-- com R$ 29,90 de receita contra ~R$ 0,02-0,04 por scan. O Plus custa metade:
-- descontada a taxa da Stripe sobram ~R$ 13,90 liquidos, e a margem vira
-- NEGATIVA em torno de 460 scans/mes. Com teto de 100 o custo maximo fica em
-- ~R$ 3 (21% do liquido), e "ilimitado" continua sendo o degrau do Pro.
--
-- ★ POR QUE UMA FUNCAO NOVA. A matriz de cota estava COPIADA em tres funcoes
-- (decrement_scan_credits, get_scan_status, restore_scan_credit). Foi
-- exatamente por isso que o Plus nasceu sem scan: quando ele foi criado, so o
-- gate de PASTAS foi atualizado (user_pastas_ilimitadas ja lista 'plus') e as
-- tres copias do gate de scan ficaram para tras. Centralizar impede o proximo
-- plano de repetir o mesmo bug.
--
-- Rollback: reaplicar o corpo das tres funcoes como estava no baseline
-- (00000000000000_baseline_schema.sql, linhas 3336-3341, 4071-4076 e 5316-5321)
-- e dropar public.scan_cota_mensal.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. A matriz, agora em UM lugar so.
-- ─────────────────────────────────────────────────────────────────────────────
-- Retorna a cota mensal de scan: -1 = ilimitado, 0 = sem direito, N = teto.
-- STABLE (nao IMMUTABLE) porque le now().
CREATE OR REPLACE FUNCTION public.scan_cota_mensal(
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
    -- Pro e Pro Anual (e os aliases legados 'mensal'/'anual'): ilimitado.
    WHEN p_plano IN ('pro_anual','anual','pro','mensal')
         AND (p_pro_exp IS NULL OR p_pro_exp > now())                  THEN -1
    -- Concessao manual antiga: is_pro sem plano canonico.
    WHEN p_is_pro AND (p_pro_exp IS NULL OR p_pro_exp > now())         THEN -1
    -- ★ Plus: 100 por mes. Vem ANTES do trial de proposito -- quem assinou o
    --   Plus dentro dos 7 dias de trial nao pode cair para a cota menor.
    WHEN p_plano = 'plus'
         AND (p_pro_exp IS NULL OR p_pro_exp > now())                  THEN 100
    -- Trial reverso: amostra de 10.
    WHEN p_trial IS NOT NULL AND p_trial > now()                       THEN 10
    ELSE 0
  END
$function$;

REVOKE ALL ON FUNCTION public.scan_cota_mensal(text, boolean, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.scan_cota_mensal(text, boolean, timestamptz, timestamptz) FROM anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. decrement_scan_credits — o gate real do scan.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_scan_credits(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_avulso int; v_usados int; v_reset timestamptz;
  v_is_pro bool; v_plano text; v_pro_exp timestamptz; v_trial timestamptz;
  v_scansmes int; v_mensal_disp int;
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(scan_creditos,0), coalesce(scan_mensal_usados,0), scan_mensal_reset,
         coalesce(is_pro,false), plano, pro_expira_em, trial_expires_at
    INTO v_avulso, v_usados, v_reset, v_is_pro, v_plano, v_pro_exp, v_trial
    FROM public.users WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sem_creditos' USING ERRCODE = 'P0001';
  END IF;

  v_scansmes := public.scan_cota_mensal(v_plano, v_is_pro, v_pro_exp, v_trial);

  IF v_reset IS NULL OR now() >= v_reset THEN
    v_usados := 0;
    v_reset := now() + interval '1 month';
  END IF;

  IF v_scansmes = -1 THEN
    v_usados := v_usados + 1;
    UPDATE public.users SET scan_mensal_usados = v_usados, scan_mensal_reset = v_reset WHERE id = p_user_id;
    RETURN -1;
  END IF;

  v_mensal_disp := greatest(0, v_scansmes - v_usados);

  IF v_mensal_disp > 0 THEN
    v_usados := v_usados + 1;
    UPDATE public.users SET scan_mensal_usados = v_usados, scan_mensal_reset = v_reset WHERE id = p_user_id;
  ELSIF v_avulso > 0 THEN
    v_avulso := v_avulso - 1;
    UPDATE public.users SET scan_creditos = v_avulso, scan_mensal_usados = v_usados, scan_mensal_reset = v_reset WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'sem_creditos' USING ERRCODE = 'P0001';
  END IF;

  RETURN greatest(0, v_scansmes - v_usados) + v_avulso;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. get_scan_status — o que a tela mostra.
-- ─────────────────────────────────────────────────────────────────────────────
-- Sem esta, o scan passaria a funcionar para o Plus mas a UI continuaria
-- dizendo "0 creditos", escondendo o saldo e empurrando pacote pago.
CREATE OR REPLACE FUNCTION public.get_scan_status(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_avulso int; v_usados int; v_reset timestamptz;
  v_is_pro bool; v_plano text; v_pro_exp timestamptz; v_trial timestamptz;
  v_scansmes int; v_disp int;
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(scan_creditos,0), coalesce(scan_mensal_usados,0), scan_mensal_reset,
         coalesce(is_pro,false), plano, pro_expira_em, trial_expires_at
    INTO v_avulso, v_usados, v_reset, v_is_pro, v_plano, v_pro_exp, v_trial
    FROM public.users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('scans_mes',0,'mensal_usados',0,'mensal_disp',0,'avulso',0,'total',0,'reset',null);
  END IF;

  v_scansmes := public.scan_cota_mensal(v_plano, v_is_pro, v_pro_exp, v_trial);

  IF v_reset IS NULL OR now() >= v_reset THEN
    v_usados := 0;
  END IF;

  IF v_scansmes = -1 THEN
    RETURN json_build_object(
      'scans_mes', -1,
      'mensal_usados', v_usados,
      'mensal_disp', -1,
      'avulso', v_avulso,
      'total', -1,
      'reset', v_reset
    );
  END IF;

  v_disp := greatest(0, v_scansmes - v_usados);

  RETURN json_build_object(
    'scans_mes', v_scansmes,
    'mensal_usados', v_usados,
    'mensal_disp', v_disp,
    'avulso', v_avulso,
    'total', v_disp + v_avulso,
    'reset', v_reset
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. restore_scan_credit — estorno quando o reconhecimento falha.
-- ─────────────────────────────────────────────────────────────────────────────
-- ★ CORRIGE UM BUG DE DINHEIRO QUE ESTA MUDANCA ACORDARIA. O estorno nao sabia
-- de qual bolso saiu o debito: devolvia na cota sempre que `usados > 0`, senao
-- no avulso. Hoje isso e inofensivo porque Free e Plus nunca incrementam
-- `usados` -- so quem tem cota finita passa por ali, e ninguem tinha.
--
-- Com o Plus em 100, o caso real aparece: assinante esgota a cota, COMPRA
-- credito avulso, o reconhecimento falha -- e o estorno devolvia uma unidade de
-- COTA em vez do credito PAGO. O usuario perderia dinheiro de verdade.
--
-- A regra correta sai da propria mecanica do debito: quando a cota esgota, o
-- decrement gasta avulso e NAO incrementa `usados`. Logo, se `usados` ja chegou
-- ao teto, o ultimo debito so pode ter vindo do avulso.
CREATE OR REPLACE FUNCTION public.restore_scan_credit(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_avulso int; v_usados int; v_reset timestamptz;
  v_is_pro bool; v_plano text; v_pro_exp timestamptz; v_trial timestamptz;
  v_scansmes int;
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(scan_creditos,0), coalesce(scan_mensal_usados,0), scan_mensal_reset,
         coalesce(is_pro,false), plano, pro_expira_em, trial_expires_at
    INTO v_avulso, v_usados, v_reset, v_is_pro, v_plano, v_pro_exp, v_trial
    FROM public.users WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN RETURN 0; END IF;

  v_scansmes := public.scan_cota_mensal(v_plano, v_is_pro, v_pro_exp, v_trial);

  IF v_scansmes = -1 THEN
    -- Ilimitado: o debito sempre saiu da cota.
    IF v_usados > 0 THEN
      v_usados := v_usados - 1;
      UPDATE public.users SET scan_mensal_usados = v_usados WHERE id = p_user_id;
    END IF;
    RETURN -1;
  END IF;

  IF v_usados > 0 AND v_usados <= v_scansmes THEN
    -- Estava dentro da cota: devolve na cota.
    v_usados := v_usados - 1;
    UPDATE public.users SET scan_mensal_usados = v_usados WHERE id = p_user_id;
  ELSE
    -- Cota esgotada (ou inexistente): o debito saiu do bolso pago.
    v_avulso := v_avulso + 1;
    UPDATE public.users SET scan_creditos = v_avulso WHERE id = p_user_id;
  END IF;

  RETURN greatest(0, v_scansmes - v_usados) + v_avulso;
END;
$function$;
