-- #507 (14/10/2026): proposta das 442 linhas de pokemon_sets que faltavam e da serie "Liga BR".
-- Staging interno (service_role so). Aplicado em producao pelo MCP: 417 sets inseridos
-- (regras A familia, B asiatico, C ocidental; D so-ocultas ficou fora) e 55 series trocadas.
create table if not exists public.sets_507_proposta (
  id text primary key, regra text, name text, name_pt text, series text, printed_total int, total int,
  regiao text, release_date text, logo_url text, symbol_url text, cartas int, visiveis int,
  nome_cartas text, familia text, criado_em timestamptz default now()
);
alter table public.sets_507_proposta enable row level security;
revoke all on public.sets_507_proposta from anon, authenticated;
create table if not exists public.sets_507_serie_liga (id text primary key, name text, serie_antes text, serie_nova text, fonte text);
alter table public.sets_507_serie_liga enable row level security;
revoke all on public.sets_507_serie_liga from anon, authenticated;
