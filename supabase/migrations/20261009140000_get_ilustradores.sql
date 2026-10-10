-- get_ilustradores -- hub de ilustrador (Fase 3 do epico #490, 09/10/2026).
--
-- Lista os nomes distintos de ilustrador para resolver o slug de
-- /ilustrador/[slug]. Medido em 09/10 (explain analyze, buffers):
--   group by artist via view ............. 8.455 blocos (varredura da tabela)
--   index only scan + heap fetches ....... 11.054 blocos
--   loose index scan recursivo (este) .... ~100 paginas de indice + 312 heap
-- Pula de ilustrador em ilustrador pelo indice btree de artist: 396 sondas,
-- nenhuma varredura. Sem contagem de proposito -- contar por ilustrador e o
-- que custa a tabela inteira; a pagina conta so o ilustrador dela.
-- Le pokemon_cards_all direto (inclui ilustrador que so existe em carta
-- oculta; o hub devolve 404 por conta propria quando nao ha carta com preco).
-- Chamada uma vez por dia, em cache global no app. Execute so service_role.
-- Rollback: drop function public.get_ilustradores().

create or replace function public.get_ilustradores()
returns table(artist text)
language sql
stable
set search_path to 'public'
as $$
  with recursive t as (
    select min(c.artist) as a from pokemon_cards_all c where c.artist > ''
    union all
    select (select min(c.artist) from pokemon_cards_all c where c.artist > t.a)
    from t where t.a is not null
  )
  select a from t where a is not null;
$$;

revoke execute on function public.get_ilustradores() from public, anon, authenticated;
grant execute on function public.get_ilustradores() to service_role;
