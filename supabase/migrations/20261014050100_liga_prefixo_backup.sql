-- Backup da dedup do prefixo "liga-" nos set_id (14/10/2026).
-- A tabela foi criada pelo MCP no dia da operacao; esta migration so a versiona.
-- Guarda, por linha tocada, o JSON de antes (pokemon_cards_all, pokemon_sets,
-- user_cards, liga_set_edids). Plano: bynx-scan/docs/SETS-PREFIXO-LIGA-PLANO.md
create table if not exists public.liga_prefixo_backup (
  tabela text,
  linha_id text,
  antes jsonb,
  feito_em timestamptz default now()
);

alter table public.liga_prefixo_backup enable row level security;
revoke all on public.liga_prefixo_backup from anon, authenticated;
