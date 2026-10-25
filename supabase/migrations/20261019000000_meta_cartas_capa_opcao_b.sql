-- Capa do card em /metas: opcao B (19/10/2026, mockup aprovado pelo Du).
-- Antes: as 5 mais valiosas da meta (capa cinza quando as caras faltam).
-- Agora: 3 mais valiosas que a pessoa tem + 2 mais valiosas que faltam.
-- Unica mudanca: o subselect da capa. Rollback: migration 20261017010000.

CREATE OR REPLACE FUNCTION public.meta_cartas(p_meta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
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
     WHERE m.tipo = 'set'
       AND (pc.set_id = m.alvo
            OR pc.set_id = ANY(coalesce(
                 (SELECT ms.extra_set_ids FROM public.master_sets ms WHERE ms.set_id = m.alvo),
                 '{}'::text[])))
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
           nullif(substring(number FROM '^[0-9]+'), '')::int NULLS LAST, number), '[]'::jsonb),
    count(*), count(*) FILTER (WHERE tenho),
    coalesce(sum(valor), 0), coalesce(sum(valor) FILTER (WHERE tenho), 0),
    -- Capa (opcao B, 19/10/2026): as 3 mais valiosas que a pessoa TEM + as 2 mais
    -- valiosas que FALTAM; se um lado nao tem o bastante, o outro completa ate 5.
    -- Ordem: tenho primeiro, por valor -- o LequeCartas poe a 1a no centro e
    -- alterna as demais, entao as faltantes caem nas pontas, em cinza.
    (SELECT coalesce(jsonb_agg(z.o ORDER BY z.pri, (NOT z.tenho), z.v DESC NULLS LAST), '[]'::jsonb) FROM (
       SELECT p.o, p.v, p.tenho, p.pri FROM (
         SELECT s.o, s.v, s.tenho, s.rn,
                CASE WHEN (s.tenho AND s.rn <= 3) OR (NOT s.tenho AND s.rn <= 2) THEN 0 ELSE 1 END AS pri
           FROM (SELECT jsonb_build_object('image', l2.image_small, 'nome', l2.name, 'tem', l2.tenho) AS o,
                        l2.valor AS v, l2.tenho,
                        row_number() OVER (PARTITION BY l2.tenho ORDER BY l2.valor DESC NULLS LAST) AS rn
                   FROM linhas l2 WHERE l2.image_small IS NOT NULL) s) p
        ORDER BY p.pri, p.rn LIMIT 5) z)
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
