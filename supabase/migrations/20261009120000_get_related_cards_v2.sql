-- get_related_cards_v2 -- Fase 3 do epico #490 (09/10/2026).
--
-- A v1 devolvia, por carta, as 8 vizinhas do set e as 8 cartas MAIS RECENTES do
-- mesmo Pokemon, sem preco. Medido em 09/10 (explain analyze, buffers): o ramo
-- do Pokemon custa 630 blocos no Pikachu e o do ilustrador custaria 1.479 no
-- 5ban Graphics -- e o cache da pagina e POR CARTA, entao as 660 paginas de
-- Pikachu repetiriam a mesma varredura, uma por dia cada.
--
-- A v2 fica so com o que e barato por carta (88 blocos no pior caso medido):
-- o nome do Pokemon, o ilustrador e as vizinhas do set, ja com preco. As duas
-- listas pesadas ("mais valiosas do Pokemon" e "do mesmo ilustrador") saem do
-- app em cache pela chave natural (nome do Pokemon / nome do ilustrador), uma
-- varredura por dia para todas as cartas que compartilham a chave.
--
-- Objeto novo com nome novo: a v1 continua intacta ate o chamador trocar.
-- Rollback: drop function public.get_related_cards_v2(text, integer).

create or replace function public.get_related_cards_v2(p_id text, p_limit integer default 8)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
with cur as (
  select set_id, base_pokemon_names, artist,
         case when number_norm ~ '^[0-9]+$' then number_norm::int end as num_int
  from pokemon_cards
  where id = p_id
),
same_set as (
  select c.id, c.slug, c.name, c.number, c.number_norm, c.image_small, c.set_name,
         c.rarity, c.idioma, c.preco_min, c.preco_medio, c.preco_max
  from pokemon_cards c
  cross join cur
  where c.set_id = cur.set_id
    and c.id <> p_id
    and cur.num_int is not null
    and c.number_norm ~ '^[0-9]+$'
    and c.image_small is not null
  order by abs(c.number_norm::int - cur.num_int) asc, c.number_norm::int asc
  limit p_limit
)
select jsonb_build_object(
  'pokemon_name', (select base_pokemon_names[1] from cur),
  'artist', (select nullif(artist, '') from cur),
  'same_set', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', s.id, 'slug', s.slug, 'name', s.name, 'number', s.number,
        'image_small', s.image_small, 'set_name', s.set_name,
        'rarity', s.rarity, 'idioma', s.idioma,
        'preco_min', s.preco_min, 'preco_medio', s.preco_medio, 'preco_max', s.preco_max
      ) order by s.number_norm::int
    ) from same_set s
  ), '[]'::jsonb)
);
$$;

-- So o servidor chama (chave de servico). A v1 era publica porque nasceu
-- client-side; esta nao precisa.
revoke execute on function public.get_related_cards_v2(text, integer) from public, anon, authenticated;
grant execute on function public.get_related_cards_v2(text, integer) to service_role;
