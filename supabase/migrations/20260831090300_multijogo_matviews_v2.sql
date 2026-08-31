-- F1 multi-jogo: matviews novas com a dimensao game, convivendo com as velhas.
-- Drop/rename das velhas fica pra F8. Indice unico obrigatorio (refresh concurrently).
-- Na branch o create with data e barato; em producao, popular fora de horario de pico
-- (varre pokemon_cards_all inteira) e nunca drop+create quente.

-- ============================================================
-- mv_set_index_stats_v2 (base: mv_set_index_stats + game no select/group by)
-- ============================================================
create materialized view public.mv_set_index_stats_v2 as
 SELECT game,
    set_id,
    count(*) AS cards_count,
    COALESCE(sum(preco_medio), 0::numeric) AS total_value_brl,
    min(set_name) AS sample_set_name
   FROM public.pokemon_cards
  WHERE set_id IS NOT NULL
  GROUP BY game, set_id;

create unique index mv_set_index_stats_v2_pk on public.mv_set_index_stats_v2 (game, set_id);

revoke all on public.mv_set_index_stats_v2 from anon;

-- ============================================================
-- mv_price_movers_v2 (base: mv_price_movers + game carregado por todos os CTEs;
-- dedup e row_number tambem particionados por game)
-- ============================================================
create materialized view public.mv_price_movers_v2 as
 WITH cur AS (
         SELECT pc.game,
            pc.id AS card_id,
            pc.slug,
            regexp_replace(replace(replace(replace(pc.name, '&amp;'::text, '&'::text), '&gt;'::text, '>'::text), '&lt;'::text, '<'::text), '\s*\([0-9A-Za-z]+\s*/\s*[0-9A-Za-z]+\)\s*$'::text, ''::text) AS name,
            pc.set_name,
            pc.image_small,
            pc.preco_medio AS preco_atual
           FROM public.pokemon_cards pc
          WHERE pc.preco_medio >= 30::numeric AND pc.preco_medio <= 10000::numeric AND pc.image_small IS NOT NULL
        ), base7 AS (
         SELECT DISTINCT ON (price_snapshots.card_id) price_snapshots.card_id,
            price_snapshots.preco_medio AS preco_base
           FROM public.price_snapshots
          WHERE price_snapshots.snapshot_date <= (CURRENT_DATE - 7) AND price_snapshots.preco_medio IS NOT NULL
          ORDER BY price_snapshots.card_id, price_snapshots.snapshot_date DESC
        ), base30 AS (
         SELECT DISTINCT ON (price_snapshots.card_id) price_snapshots.card_id,
            price_snapshots.preco_medio AS preco_base
           FROM public.price_snapshots
          WHERE price_snapshots.snapshot_date <= (CURRENT_DATE - 30) AND price_snapshots.preco_medio IS NOT NULL
          ORDER BY price_snapshots.card_id, price_snapshots.snapshot_date DESC
        ), m AS (
         SELECT 7 AS window_days,
            c.game,
            c.card_id,
            c.slug,
            c.name,
            c.set_name,
            c.image_small,
            c.preco_atual,
            b.preco_base,
            round((c.preco_atual - b.preco_base) / b.preco_base * 100::numeric, 1) AS pct
           FROM cur c
             JOIN base7 b ON b.card_id = c.card_id
          WHERE b.preco_base >= 30::numeric
        UNION ALL
         SELECT 30,
            c.game,
            c.card_id,
            c.slug,
            c.name,
            c.set_name,
            c.image_small,
            c.preco_atual,
            b.preco_base,
            round((c.preco_atual - b.preco_base) / b.preco_base * 100::numeric, 1)
           FROM cur c
             JOIN base30 b ON b.card_id = c.card_id
          WHERE b.preco_base >= 30::numeric
        ), f AS (
         SELECT m.window_days,
            m.game,
            m.card_id,
            m.slug,
            m.name,
            m.set_name,
            m.image_small,
            m.preco_atual,
            m.preco_base,
            m.pct
           FROM m
          WHERE abs(m.pct) >= 5::numeric AND abs(m.pct) <= 80::numeric
        ), dedup AS (
         SELECT DISTINCT ON (f.game, f.window_days, (lower(f.name)), (lower(COALESCE(f.set_name, ''::text)))) f.window_days,
            f.game,
            f.card_id,
            f.slug,
            f.name,
            f.set_name,
            f.image_small,
            f.preco_atual,
            f.preco_base,
            f.pct
           FROM f
          ORDER BY f.game, f.window_days, (lower(f.name)), (lower(COALESCE(f.set_name, ''::text))), f.preco_atual DESC
        ), ranked AS (
         SELECT dedup.game,
            dedup.window_days,
                CASE
                    WHEN dedup.pct > 0::numeric THEN 'up'::text
                    ELSE 'down'::text
                END AS direction,
            dedup.card_id,
            dedup.slug,
            dedup.name,
            dedup.set_name,
            dedup.image_small,
            dedup.preco_atual,
            dedup.preco_base,
            dedup.pct,
            row_number() OVER (PARTITION BY dedup.game, dedup.window_days, (
                CASE
                    WHEN dedup.pct > 0::numeric THEN 'up'::text
                    ELSE 'down'::text
                END) ORDER BY (abs(dedup.pct)) DESC, dedup.preco_atual DESC) AS rnk
           FROM dedup
        )
 SELECT game,
    window_days,
    direction,
    rnk,
    card_id,
    slug,
    name,
    set_name,
    image_small,
    preco_atual,
    preco_base,
    pct
   FROM ranked
  WHERE rnk <= 20;

create unique index mv_price_movers_v2_uk on public.mv_price_movers_v2 (game, window_days, direction, rnk);

revoke all on public.mv_price_movers_v2 from anon;

-- ============================================================
-- set_index_stats_v2 (base: set_index_stats, lendo a matview nova com p_game)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_index_stats_v2(p_game text DEFAULT 'pokemon')
 RETURNS TABLE(set_id text, cards_count bigint, total_value_brl numeric, sample_set_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select set_id, cards_count, total_value_brl, sample_set_name
  from mv_set_index_stats_v2
  where game = p_game
$function$;

-- ============================================================
-- get_price_movers_v2 (base: get_price_movers, lendo a matview nova com p_game)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_price_movers_v2(p_limit integer DEFAULT 12, p_game text DEFAULT 'pokemon')
 RETURNS TABLE(window_days integer, direction text, card_id text, name text, set_name text, image_small text, preco_atual numeric, pct numeric, slug text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select window_days, direction, card_id, name, set_name, image_small, preco_atual, pct, slug
  from public.mv_price_movers_v2
  where game = p_game
    and rnk <= p_limit
  order by window_days, direction, rnk;
$function$;
