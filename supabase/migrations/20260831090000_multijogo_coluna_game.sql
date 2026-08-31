-- F1 multi-jogo: dimensao "game" (default 'pokemon') em todo o dado de catalogo/colecao.
-- Nenhum comportamento visivel muda: coluna nova com default, backfill implicito, view recriada
-- apenas pra expor a coluna (create or replace preserva ACL; security_invoker re-declarado).

alter table public.pokemon_cards_all add column if not exists game text not null default 'pokemon';
alter table public.pokemon_sets      add column if not exists game text not null default 'pokemon';
alter table public.user_cards        add column if not exists game text not null default 'pokemon';
alter table public.marketplace       add column if not exists game text not null default 'pokemon';
alter table public.watchlist         add column if not exists game text not null default 'pokemon';
alter table public.master_sets       add column if not exists game text not null default 'pokemon';
alter table public.price_snapshots   add column if not exists game text not null default 'pokemon';
alter table public.price_history     add column if not exists game text not null default 'pokemon';
alter table public.pastas            add column if not exists game text not null default 'pokemon';

alter table public.users add column if not exists default_game text not null default 'pokemon';

-- Recria a view pra coluna nova aparecer (coluna nova na base NAO entra sozinha).
-- security_invoker = true e obrigatorio: e o que mantem a RLS da base valendo e o anon fora.
create or replace view public.pokemon_cards
with (security_invoker = true) as
select * from public.pokemon_cards_all
where not oculto;
