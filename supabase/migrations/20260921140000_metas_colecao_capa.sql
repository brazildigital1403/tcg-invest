-- Capa da meta no banco (#368, aprovado pelo Du em 21/09/2026).
--
-- ★ POR QUE. O card da lista de metas mostra um leque com as artes das cartas
-- mais valiosas. Ate aqui essas artes ficavam guardadas NO APARELHO (gravadas
-- quando a pessoa abria a meta), porque a lista le so o retrato numerico --
-- recalcular por meta a cada visita custaria uma varredura por meta. Resultado
-- visto pelo Du: no desktop o leque aparecia, no celular nao.
--
-- Agora meta_cartas grava a capa junto com o retrato: as 5 cartas mais valiosas
-- com arte, cada uma com image/nome/tem. Nao le nada novo -- a funcao ja tem
-- essas linhas em maos. A tabela e minuscula; ADD COLUMN sem default e so
-- catalogo, sem reescrever linha.
--
-- Rollback: alter table public.metas_colecao drop column capa; e reaplicar
-- meta_cartas de 20260921120000_metas_colecao_motor.sql.

ALTER TABLE public.metas_colecao ADD COLUMN IF NOT EXISTS capa jsonb;

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
  v_total int; v_tenho int; v_vt numeric; v_vtenho numeric; v_capa jsonb;
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
    coalesce(sum(valor), 0), coalesce(sum(valor) FILTER (WHERE tenho), 0),
    -- capa do card da lista: as 5 mais valiosas com arte, marcando o que tem
    (SELECT coalesce(jsonb_agg(x.o ORDER BY x.v DESC NULLS LAST), '[]'::jsonb) FROM (
       SELECT jsonb_build_object('image', l2.image_small, 'nome', l2.name, 'tem', l2.tenho) AS o, l2.valor AS v
         FROM linhas l2 WHERE l2.image_small IS NOT NULL
        ORDER BY l2.valor DESC NULLS LAST LIMIT 5) x)
  INTO v_cartas, v_total, v_tenho, v_vt, v_vtenho, v_capa
  FROM linhas;

  UPDATE public.metas_colecao
     SET total = v_total, tenho = v_tenho, valor_total = v_vt, valor_tenho = v_vtenho, capa = v_capa,
         calculado_em = now(),
         concluida_em = CASE WHEN concluida_em IS NULL AND v_total > 0 AND v_tenho = v_total
                             THEN now() ELSE concluida_em END
   WHERE id = m.id
   RETURNING * INTO m;

  RETURN jsonb_build_object('meta', to_jsonb(m), 'cartas', v_cartas);
END
$function$;

