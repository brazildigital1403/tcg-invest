-- Backup do piloto da dedup no mesmo idioma: cec -> sm12 (14/10/2026).
-- Plano e rollback: bynx-scan/docs/PILOTO-DEDUP-CEC-SM12.md
-- tipo: carta_cec | preco_sm12 | user_card | pokemon_set | liga_set_edid
create table if not exists public.dedup_cec_sm12_backup (
  id bigserial primary key,
  tipo text not null,
  chave text not null,
  dados jsonb not null,
  criado_em timestamptz not null default now()
);

alter table public.dedup_cec_sm12_backup enable row level security;
revoke all on public.dedup_cec_sm12_backup from anon, authenticated;
