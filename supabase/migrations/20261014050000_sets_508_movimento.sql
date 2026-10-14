-- Auditoria de sets (14/10/2026): cartas JP que o fornecedor guardou em set EN foram para o set JP certo.
-- Backup do estado anterior de cada carta movida, para desfazer por set_id_novo se preciso:
--   update pokemon_cards_all p set set_id=m.set_id_antes, set_name=m.set_name_antes, set_total=m.set_total_antes
--   from sets_508_movimento m where p.id=m.card_id and m.set_id_novo='<id>';
-- Aplicada em producao pelo MCP junto com o movimento (2.365 cartas, 23 sets novos em pokemon_sets).
create table if not exists public.sets_508_movimento (
  card_id         text primary key,
  set_id_antes    text,
  set_name_antes  text,
  set_total_antes int,
  set_id_novo     text,
  movido_em       timestamptz default now()
);
alter table public.sets_508_movimento enable row level security;
revoke all on public.sets_508_movimento from anon, authenticated;
