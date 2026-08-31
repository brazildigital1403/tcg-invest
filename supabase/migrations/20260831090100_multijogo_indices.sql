-- F1 multi-jogo: indices da dimensao game no catalogo.
-- F8/producao: rodar cada um com CONCURRENTLY, um por dia (pokemon_cards_all tem 187 MB;
-- create index normal segura lock e come o credito de IO — nao concentrar no mesmo dia).

create index if not exists idx_cards_game_set  on public.pokemon_cards_all (game, set_id);
create index if not exists idx_cards_game_slug on public.pokemon_cards_all (game, slug);
