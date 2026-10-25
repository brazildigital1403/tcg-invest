-- #508: uma carta pode cair em mais de uma regra (japonesa filada no set EN: regiao E total).
drop index if exists public.auditoria_ia_cartas_regra_idx;
alter table public.auditoria_ia_cartas drop column regra;
alter table public.auditoria_ia_cartas add column regras text[] not null default '{}';
create index auditoria_ia_cartas_pendente_idx on public.auditoria_ia_cartas using gin (regras) where aplicado_em is null;
