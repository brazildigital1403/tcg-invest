-- #508: aplicado_em e por carta, mas uma carta pode ter mais de uma regra; registrar quais foram aplicadas.
alter table public.auditoria_ia_cartas add column regras_aplicadas text[] not null default '{}';
