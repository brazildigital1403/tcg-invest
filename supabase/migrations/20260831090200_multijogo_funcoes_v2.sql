-- F1 multi-jogo: versoes novas das funcoes de leitura do catalogo, com p_game (default 'pokemon').
-- Objeto novo = nome novo. NENHUMA funcao velha e alterada; o app segue nas versoes velhas ate a F8.
-- check_function_bodies off: landing_stats_v2 referencia set_index_stats_v2, criada na migration seguinte.

set check_function_bodies = off;

-- ============================================================
-- smart_search_cards_v6 (base: smart_search_cards_v5 + p_game)
-- ============================================================
CREATE OR REPLACE FUNCTION public.smart_search_cards_v6(q text, limit_n integer DEFAULT 60, offset_n integer DEFAULT 0, p_game text DEFAULT 'pokemon')
 RETURNS SETOF pokemon_cards_all
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  query_text text := lower(trim(coalesce(q, '')));
  tokens text[]; non_year_tokens text[] := ARRAY[]::text[];
  yr text := NULL; t text; primeiro boolean; last_idx int; first_token text;
  name_part text; number_part text; total_part text; snum text; stotal text;
  num_regex text; resolved_set_id text; number_list text[];
  number_regex text := '^([a-z]+)?[0-9]+[a-z]?$';
  year_regex text := '^(199[6-9]|20[0-3][0-9])$';
  sql text; where_extra text := ''; rel_order text := '';
BEGIN
  IF query_text = '' THEN RETURN; END IF;
  query_text := public.traduzir_busca_pt(query_text);
  IF query_text = '' THEN RETURN; END IF;
  query_text := public.f_unaccent(query_text);

  IF query_text LIKE '%,%' THEN
    SELECT ARRAY(SELECT trim(s) FROM unnest(string_to_array(query_text, ',')) AS s WHERE trim(s) <> '') INTO number_list;
    IF array_length(number_list, 1) IS NULL THEN RETURN; END IF;
    RETURN QUERY SELECT DISTINCT pc.* FROM unnest(number_list) AS tk
      CROSS JOIN LATERAL smart_search_cards_v6(tk, limit_n, 0, p_game) AS pc LIMIT limit_n OFFSET offset_n;
    RETURN;
  END IF;

  IF query_text LIKE '%/%' THEN
    number_part := trim(split_part(query_text, '/', 1));
    total_part  := trim(split_part(query_text, '/', 2));
    IF number_part LIKE '% %' THEN
      tokens := string_to_array(number_part, ' ');
      last_idx := array_length(tokens, 1);
      name_part := trim(array_to_string(tokens[1:last_idx-1], ' '));
      number_part := tokens[last_idx];
    ELSE name_part := NULL; END IF;
    snum   := nullif(regexp_replace(regexp_replace(coalesce(number_part,''), '[^0-9]', '', 'g'), '^0+', ''), '');
    stotal := nullif(regexp_replace(regexp_replace(coalesce(total_part,''),  '[^0-9]', '', 'g'), '^0+', ''), '');
    IF snum IS NOT NULL THEN
      num_regex := '\(0*' || snum || '/';
      IF stotal IS NOT NULL THEN num_regex := num_regex || '0*' || stotal || '\)'; END IF;
      IF name_part IS NOT NULL AND name_part <> '' THEN
        RETURN QUERY SELECT pc.* FROM pokemon_cards pc
        WHERE pc.game = p_game
          AND ( public.f_unaccent(pc.name) ILIKE '%'||name_part||'%'
                OR public.f_unaccent(pc.name_pt) ILIKE '%'||name_part||'%'
                OR ( length(name_part) >= 4 AND public.f_unaccent(pc.name) % name_part ) )
          AND ( pc.number_norm = snum OR pc.name ~* num_regex )
        ORDER BY coalesce(stotal IS NOT NULL AND (pc.set_total::text = stotal OR pc.name ~* num_regex), false) DESC,
                 similarity(public.f_unaccent(pc.name), name_part) DESC,
                 (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
        LIMIT limit_n OFFSET offset_n;
      ELSE
        RETURN QUERY SELECT pc.* FROM pokemon_cards pc
        WHERE pc.game = p_game
          AND ( pc.number_norm = snum OR pc.name ~* num_regex )
        ORDER BY coalesce(stotal IS NOT NULL AND (pc.set_total::text = stotal OR pc.name ~* num_regex), false) DESC,
                 (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
        LIMIT limit_n OFFSET offset_n;
      END IF;
      RETURN;
    ELSIF name_part IS NOT NULL AND name_part <> '' THEN
      RETURN QUERY SELECT pc.* FROM pokemon_cards pc
      WHERE pc.game = p_game
        AND ( public.f_unaccent(pc.name) ILIKE '%'||name_part||'%'
              OR public.f_unaccent(pc.name_pt) ILIKE '%'||name_part||'%' )
      ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;
  END IF;

  tokens := string_to_array(query_text, ' ');
  FOREACH t IN ARRAY tokens LOOP
    IF t <> '' THEN
      IF yr IS NULL AND t ~ year_regex THEN yr := t; ELSE non_year_tokens := non_year_tokens || t; END IF;
    END IF;
  END LOOP;

  IF yr IS NULL THEN
    last_idx := array_length(tokens, 1);
    IF last_idx >= 2 AND tokens[last_idx] ~ number_regex THEN
      first_token := tokens[1]; number_part := tokens[last_idx];
      IF last_idx = 2 THEN
        SELECT sa.set_id INTO resolved_set_id FROM set_aliases sa WHERE sa.alias = first_token LIMIT 1;
        IF resolved_set_id IS NULL THEN
          IF EXISTS (SELECT 1 FROM pokemon_cards WHERE set_id = first_token AND game = p_game LIMIT 1) THEN resolved_set_id := first_token; END IF;
        END IF;
        IF resolved_set_id IS NOT NULL THEN
          snum := regexp_replace(number_part, '0*([0-9]+)', '\1', 'g');
          RETURN QUERY SELECT pc.* FROM pokemon_cards pc
          WHERE pc.game = p_game AND pc.set_id = resolved_set_id AND pc.number_norm = snum
          ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
          LIMIT limit_n OFFSET offset_n;
          RETURN;
        END IF;
      END IF;
      name_part := array_to_string(tokens[1:last_idx-1], ' ');
      snum := regexp_replace(number_part, '0*([0-9]+)', '\1', 'g');
      RETURN QUERY SELECT pc.* FROM pokemon_cards pc
      WHERE pc.game = p_game
        AND ( public.f_unaccent(pc.name) ILIKE '%'||name_part||'%'
              OR public.f_unaccent(pc.name_pt) ILIKE '%'||name_part||'%'
              OR ( length(name_part) >= 4 AND public.f_unaccent(pc.name) % name_part ) )
        AND ( pc.number_norm = snum OR pc.name ~* ('\(0*'||snum||'/') )
      ORDER BY similarity(public.f_unaccent(pc.name), name_part) DESC,
               (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;
    IF last_idx = 1 AND tokens[1] ~ number_regex THEN
      snum := regexp_replace(tokens[1], '0*([0-9]+)', '\1', 'g');
      RETURN QUERY SELECT pc.* FROM pokemon_cards pc
      WHERE pc.game = p_game AND pc.number_norm = snum
      ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;
  END IF;

  IF array_length(non_year_tokens, 1) = 1 AND yr IS NULL THEN
    first_token := non_year_tokens[1];
    RETURN QUERY SELECT pc.* FROM pokemon_cards pc
    WHERE pc.game = p_game
      AND ( public.f_unaccent(pc.name) ILIKE '%'||first_token||'%'
            OR public.f_unaccent(pc.name_pt) ILIKE '%'||first_token||'%'
            OR public.f_unaccent(pc.set_name_pt) ILIKE '%'||first_token||'%'
            OR ( length(first_token) >= 4 AND public.f_unaccent(pc.name) % first_token ) )
    ORDER BY
      CASE WHEN lower(public.f_unaccent(pc.name)) = first_token THEN 0
           WHEN lower(public.f_unaccent(coalesce(pc.name_pt, pc.name))) = first_token THEN 0
           WHEN lower(public.f_unaccent(pc.name)) LIKE first_token||'%' THEN 1
           WHEN lower(public.f_unaccent(coalesce(pc.name_pt, ''))) LIKE first_token||'%' THEN 1
           WHEN public.f_unaccent(pc.name) ILIKE '%'||first_token||'%' THEN 2
           WHEN public.f_unaccent(pc.name_pt) ILIKE '%'||first_token||'%' THEN 2
           WHEN public.f_unaccent(pc.set_name_pt) ILIKE '%'||first_token||'%' THEN 4
           ELSE 3 END,
      similarity(public.f_unaccent(pc.name), first_token) DESC,
      (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
    LIMIT limit_n OFFSET offset_n;
    RETURN;
  END IF;

  PERFORM set_config('pg_trgm.word_similarity_threshold', '0.5', true);

  IF yr IS NOT NULL THEN where_extra := where_extra || format(' AND left(pc.set_release_date,4) = %L', yr); END IF;
  IF array_length(non_year_tokens, 1) IS NOT NULL THEN
    primeiro := true;
    FOREACH t IN ARRAY non_year_tokens LOOP
      IF primeiro AND length(t) >= 4 THEN
        where_extra := where_extra || format(
          ' AND (public.f_unaccent(pc.name) ILIKE %L OR public.f_unaccent(pc.name_pt) ILIKE %L'
          || ' OR public.f_unaccent(pc.set_name) ILIKE %L OR public.f_unaccent(pc.set_name_pt) ILIKE %L'
          || ' OR %L <%% public.f_unaccent(pc.name) OR %L <%% public.f_unaccent(pc.name_pt))',
          '%'||t||'%', '%'||t||'%', '%'||t||'%', '%'||t||'%', t, t);
      ELSE
        where_extra := where_extra || format(
          ' AND (public.f_unaccent(pc.name) ILIKE %L OR public.f_unaccent(pc.name_pt) ILIKE %L'
          || ' OR public.f_unaccent(pc.set_name) ILIKE %L OR public.f_unaccent(pc.set_name_pt) ILIKE %L)',
          '%'||t||'%', '%'||t||'%', '%'||t||'%', '%'||t||'%');
      END IF;
      primeiro := false;
    END LOOP;
    first_token := non_year_tokens[1];
    rel_order := format('CASE WHEN lower(public.f_unaccent(pc.name))=%L THEN 0 WHEN lower(public.f_unaccent(pc.name)) LIKE %L THEN 1 ELSE 2 END, ',
                        first_token, first_token||'%');
  END IF;

  sql := 'SELECT pc.* FROM pokemon_cards pc WHERE pc.game = $3' || where_extra ||
         ' ORDER BY ' || rel_order || '(pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id' ||
         ' LIMIT $1 OFFSET $2';
  RETURN QUERY EXECUTE sql USING limit_n, offset_n, p_game;
END;
$function$;

-- ============================================================
-- busca_cartas_v2 (base: busca_cartas + p_game)
-- ============================================================
CREATE OR REPLACE FUNCTION public.busca_cartas_v2(q text, lim integer DEFAULT 20, set_filter text DEFAULT NULL::text, p_game text DEFAULT 'pokemon')
 RETURNS SETOF pokemon_cards_all
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with p as (
    select
      trim($1) as raw,
      trim(regexp_replace(lower(unaccent($1)), '[0-9/]+', ' ', 'g')) as qname,
      nullif((regexp_match($1, '([0-9]{1,4}[a-z]?)'))[1], '') as qnum
  )
  select c.*
  from public.pokemon_cards c, p
  where c.game = p_game
    and (set_filter is null or c.set_id = set_filter)
    and c.excluded_from_scan is not true
    and coalesce(c.is_canary, false) = false
    and (
      c.name ilike '%' || p.raw || '%'
      or (length(p.qname) >= 3 and c.name % p.qname)
      or (
        p.qnum is not null
        and lower(coalesce(c.number, '')) = lower(p.qnum)
        and (length(p.qname) < 2 or c.name % p.qname)
      )
    )
  order by
    (p.qnum is not null and lower(coalesce(c.number, '')) = lower(p.qnum)) desc,
    similarity(c.name, coalesce(nullif(p.qname, ''), p.raw)) desc,
    (c.image_small is not null) desc,
    c.set_release_date desc nulls last
  limit lim;
$function$;

-- ============================================================
-- busca_global_v2 (base: busca_global + p_game so na parte de cards; pokedex fica)
-- ============================================================
CREATE OR REPLACE FUNCTION public.busca_global_v2(q text, lim integer DEFAULT 6, p_game text DEFAULT 'pokemon')
 RETURNS TABLE(kind text, ref text, label text, sublabel text, image text, price numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  (
    select 'pokemon'::text as kind, p.slug as ref, p.name as label,
           (p.cards_count || ' cartas')::text as sublabel,
           null::text as image, null::numeric as price
    from pokemon_pokedex p
    where p.name ilike '%' || q || '%'
    order by (p.name ilike q || '%') desc, p.cards_count desc nulls last
    limit lim
  )
  union all
  (
    select 'card'::text as kind, coalesce(c.slug, c.id) as ref, c.name as label,
           coalesce(c.set_name, '')::text as sublabel,
           c.image_small as image, c.preco_medio as price
    from pokemon_cards c
    where c.game = p_game
      and c.name ilike '%' || q || '%'
      and c.id ~ '^[a-zA-Z0-9_-]+$'
      and c.image_small is not null
    order by (c.name ilike q || '%') desc, c.preco_medio desc nulls last
    limit lim
  );
$function$;

-- ============================================================
-- get_top_cards_v2 (base: get_top_cards + p_game)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_top_cards_v2(lim integer DEFAULT 12, p_game text DEFAULT 'pokemon')
 RETURNS TABLE(id text, name text, set_name text, image_small text, preco_medio numeric, slug text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct on (preco_medio) id, name, set_name, image_small, preco_medio, slug
  from pokemon_cards
  where game = p_game
    and preco_medio is not null
    and image_small is not null
    and id ~ '^[a-zA-Z0-9_-]+$'
  order by preco_medio desc, (id like 'liga-%')
  limit lim;
$function$;

-- ============================================================
-- landing_stats_v2 (base: landing_stats + p_game; numeros por jogo do contexto)
-- Depende de set_index_stats_v2 (migration seguinte) — check_function_bodies off cobre.
-- ============================================================
CREATE OR REPLACE FUNCTION public.landing_stats_v2(p_game text DEFAULT 'pokemon')
 RETURNS TABLE(total_cards bigint, total_sets bigint, total_sets_official bigint, total_value_brl numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH s AS (SELECT cards_count, total_value_brl FROM set_index_stats_v2(p_game))
  SELECT
    (SELECT count(*) FROM pokemon_cards WHERE game = p_game)::bigint  AS total_cards,
    (SELECT count(*) FROM s)::bigint                                  AS total_sets,
    (SELECT count(*) FROM pokemon_sets WHERE game = p_game)::bigint   AS total_sets_official,
    (SELECT coalesce(sum(total_value_brl), 0) FROM s)                 AS total_value_brl;
$function$;

-- ============================================================
-- pokedex_landing_data_v2 (base: pokedex_landing_data; game='pokemon' cravado, sem parametro)
-- ============================================================
CREATE OR REPLACE FUNCTION public.pokedex_landing_data_v2()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'stats', jsonb_build_object(
      'total_cards',    (SELECT count(*) FROM pokemon_cards WHERE game = 'pokemon'),
      'total_sets',     (SELECT count(DISTINCT set_id) FROM pokemon_cards WHERE game = 'pokemon' AND set_id IS NOT NULL),
      'total_rarities', (SELECT count(DISTINCT rarity) FROM pokemon_cards WHERE game = 'pokemon' AND rarity IS NOT NULL AND rarity <> ''),
      'total_series',   (SELECT count(DISTINCT set_series) FROM pokemon_cards WHERE game = 'pokemon' AND set_series IS NOT NULL AND set_series <> '' AND set_name NOT LIKE 'Liga BR%')
    ),
    'raridades', (
      SELECT jsonb_object_agg(rarity, n) FROM (
        SELECT rarity, count(*) AS n FROM pokemon_cards
        WHERE game = 'pokemon'
          AND rarity IN ('Common','Uncommon','Rare','Rare Holo','Promo','Rare Ultra','Illustration Rare','Special Illustration Rare','Hyper Rare')
        GROUP BY rarity
      ) r
    ),
    'sets_recentes', (
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.rel DESC) FROM (
        SELECT set_name AS name, max(set_release_date) AS rel, count(*)::int AS cards, max(set_logo) AS logo
        FROM pokemon_cards
        WHERE game = 'pokemon' AND set_release_date IS NOT NULL AND set_release_date <> '' AND set_name NOT LIKE 'Liga BR%'
        GROUP BY set_name
        ORDER BY max(set_release_date) DESC
        LIMIT 9
      ) x
    ),
    'top_valiosas', (
      SELECT jsonb_object_agg(id, preco) FROM (
        SELECT id,
          GREATEST(COALESCE(preco_medio,0),COALESCE(preco_foil_medio,0),COALESCE(preco_promo_medio,0),COALESCE(preco_reverse_medio,0),COALESCE(preco_pokeball_medio,0)) AS preco
        FROM pokemon_cards
        WHERE game = 'pokemon'
          AND id IN ('sv8pt5-161','sv4pt5-232','sv8-238','sv8pt5-146','sv8pt5-149','sv9-187')
      ) t
    )
  );
$function$;

-- ============================================================
-- get_sinais_carta_v2 (base: get_sinais_carta + p_game; filtro via join com o catalogo —
-- card_sinal_diario nao tem coluna game, o jogo vem da carta)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_sinais_carta_v2(p_dias integer DEFAULT 14, p_limit integer DEFAULT 2, p_min_vis integer DEFAULT 12, p_min_pico integer DEFAULT 2, p_game text DEFAULT 'pokemon')
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with param as (
    select
      (now() at time zone 'America/Sao_Paulo')::date as hoje,
      least(greatest(coalesce(p_dias, 14), 1), 90)   as dias,
      greatest(coalesce(p_limit, 2), 1)              as lim,
      greatest(coalesce(p_min_vis, 12), 1)           as min_vis,
      greatest(coalesce(p_min_pico, 2), 1)           as min_pico
  ),
  resumo as (
    select
      coalesce(sum(d.n), 0)::bigint      as eventos,
      count(distinct d.card_id)::int     as cartas,
      max(d.dia)                         as dado_ate
    from public.card_sinal_diario d, param p
    where d.dia > p.hoje - p.dias
      and exists (select 1 from public.pokemon_cards cg where cg.id = d.card_id and cg.game = p_game)
  ),
  bruto as (
    select
      case when d.tipo in ('view_pub', 'view_app') then 'acessada' else 'procurada' end as grupo,
      d.card_id,
      sum(d.n)::int              as tot,
      sum(d.n_visitantes)::int   as vis,
      max(d.n_pico)::int         as pico,
      count(distinct d.dia)::int as dias
    from public.card_sinal_diario d, param p
    where d.dia > p.hoje - p.dias
      and d.tipo in ('view_pub', 'view_app', 'busca_troca')
      and exists (select 1 from public.pokemon_cards cg where cg.id = d.card_id and cg.game = p_game)
    group by 1, 2
  ),
  elegivel as (
    select b.*,
           row_number() over (partition by b.grupo order by b.vis desc, b.tot desc, b.card_id) as rn
    from bruto b, param p
    where b.vis  >= p.min_vis
      and b.pico >= p.min_pico
      and b.dias >= 3
  ),
  nomeado as (
    select
      e.grupo,
      sum(e.vis)::int as vis,
      sum(e.tot)::int as tot,
      (array_agg(c.id          order by e.vis desc, c.id))[1] as id,
      (array_agg(c.slug        order by e.vis desc, c.id))[1] as slug,
      (array_agg(regexp_replace(coalesce(nullif(c.name_pt, ''), c.name), '\s*\([^)]*\)\s*$', '')
                               order by e.vis desc, c.id))[1] as nome,
      (array_agg(c.image_small order by e.vis desc, c.id))[1] as image_small,
      (array_agg(coalesce(nullif(c.preco_medio, 0), nullif(c.preco_normal, 0),
                          nullif(c.preco_foil_medio, 0), nullif(c.preco_reverse_medio, 0),
                          nullif(c.preco_promo_medio, 0))
                               order by e.vis desc, c.id))[1] as preco
    from elegivel e
    join public.pokemon_cards c on c.id = e.card_id and c.game = p_game
    where e.rn <= 40
      and coalesce(c.is_canary, false) = false
      and c.slug is not null
    group by e.grupo,
             lower(regexp_replace(coalesce(nullif(c.name_pt, ''), c.name), '\s*\([^)]*\)\s*$', ''))
  ),
  final as (
    select n.*, row_number() over (partition by n.grupo order by n.vis desc, n.id) as pos
    from nomeado n
  )
  select jsonb_build_object(
    'ok', true,
    'dias', (select dias from param),
    'eventos_janela',   (select eventos  from resumo),
    'cartas_distintas', (select cartas   from resumo),
    'dado_ate',         (select dado_ate from resumo),
    'acessadas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'slug', f.slug, 'nome', f.nome,
               'image_small', f.image_small, 'preco', f.preco, 'vis', f.vis
             ) order by f.pos)
      from final f, param p where f.grupo = 'acessada' and f.pos <= p.lim
    ), '[]'::jsonb),
    'procuradas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'slug', f.slug, 'nome', f.nome,
               'image_small', f.image_small, 'preco', f.preco, 'vis', f.vis
             ) order by f.pos)
      from final f, param p where f.grupo = 'procurada' and f.pos <= p.lim
    ), '[]'::jsonb)
  );
$function$;

-- ============================================================
-- analisar_import_lote_v2 (base: analisar_import_lote + p_game no casamento)
-- ============================================================
CREATE OR REPLACE FUNCTION public.analisar_import_lote_v2(linhas text[], p_game text DEFAULT 'pokemon')
 RETURNS TABLE(ordem integer, linha text, quantidade integer, card_id text, card_name text, card_set text, card_number text, card_image text, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ln text; i int := 0; raw text; rest text; toks text[]; numtok text;
  namep text; snum text; stotal text; name_patterns text[]; k int; m record;
begin
  foreach ln in array coalesce(linhas, array[]::text[]) loop
    i := i + 1;
    raw := btrim(coalesce(ln,''));
    if raw = '' then continue; end if;

    ordem := i; linha := raw; quantidade := 1;
    card_id := null; card_name := null; card_set := null; card_number := null; card_image := null; status := null;

    -- quantidade: "Nx " ou "N " no inicio, seguido de nao-digito (nome)
    if raw ~ '^\d{1,3}\s*[xX]?\s+\D' then
      quantidade := least(greatest((regexp_replace(raw, '^(\d{1,3}).*$', '\1'))::int, 1), 99);
      rest := regexp_replace(raw, '^\d{1,3}\s*[xX]?\s+', '');
    else
      rest := raw;
    end if;

    -- traduz PT->EN (energia/tipos/ignicao/treinador...)
    rest := public.traduzir_busca_pt(rest);

    -- ultimo token com digito = numero da carta
    toks := regexp_split_to_array(btrim(rest), '\s+');
    numtok := null;
    for k in reverse coalesce(array_length(toks,1),0)..1 loop
      if toks[k] ~ '\d' then numtok := toks[k]; exit; end if;
    end loop;

    if numtok is null then
      status := 'sem_numero'; return next; continue;
    end if;

    -- nome = rest sem o token de numero
    namep := btrim(regexp_replace(replace(rest, numtok, ' '), '\s+', ' ', 'g'));
    snum   := nullif(regexp_replace(regexp_replace(split_part(numtok,'/',1), '[^0-9]','','g'), '^0+',''), '');
    stotal := nullif(regexp_replace(regexp_replace(split_part(numtok,'/',2), '[^0-9]','','g'), '^0+',''), '');

    if snum is null or namep = '' then
      status := 'sem_numero'; return next; continue;
    end if;

    name_patterns := array(select '%'||t||'%' from unnest(string_to_array(namep,' ')) t where btrim(t) <> '');

    select pc.id, pc.name, pc.set_name, pc.number, pc.image_small into m
    from pokemon_cards pc
    where pc.game = p_game
      and pc.name ilike all(name_patterns)
      and ( pc.number_norm = snum or pc.name ~* ('\(0*'||snum||'/') )
      and ( stotal is null or pc.set_total::text = stotal or pc.name ~* ('\(0*'||snum||'/0*'||stotal||'\)') )
    order by (pc.image_small is null), pc.set_release_date desc nulls last, pc.id
    limit 1;

    if m.id is null then
      status := 'nao_encontrada'; return next; continue;
    end if;

    card_id := m.id; card_name := m.name; card_set := m.set_name; card_number := m.number; card_image := m.image_small; status := 'ok';
    return next;
  end loop;
end $function$;

-- ============================================================
-- get_existing_set_ids_v2 (base: get_existing_set_ids + p_game; sem security definer, igual a base)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_existing_set_ids_v2(p_game text DEFAULT 'pokemon')
 RETURNS TABLE(set_id text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT DISTINCT pc.set_id FROM pokemon_cards pc WHERE pc.set_id IS NOT NULL AND pc.game = p_game;
$function$;

-- ============================================================
-- Grants iguais aos das bases (default = PUBLIC + anon + authenticated + service_role;
-- revoga so o que as bases revogam)
-- ============================================================
revoke execute on function public.analisar_import_lote_v2(text[], text) from public;
revoke execute on function public.landing_stats_v2(text) from public;
revoke execute on function public.pokedex_landing_data_v2() from public;
revoke execute on function public.get_sinais_carta_v2(integer, integer, integer, integer, text) from public;
revoke execute on function public.get_sinais_carta_v2(integer, integer, integer, integer, text) from anon, authenticated;
