-- ===========================================================================
-- Freio do scan Lorcana + guarda de papel de maquina
-- Aprovado pelo Du em 02/09/2026 (pacote unico). Aplicado em PRODUCAO:
-- sao tabelas de CONTROLE OPERACIONAL (freio de IP e papel de maquina),
-- nao dado de carta -- o catalogo/preco Lorcana continua 100% na branch.
-- DDL do freio: docs/migration-lorcana-scan-freio.sql do bynx-scan (Mia
-- Windows, 02/09); guarda: ALINHAMENTO-TOPOLOGIA-CAPTURA.md secao 4.
-- ===========================================================================

-- 1. Freio Lorcana (tabelas proprias: dividir a linha com liga_scan_estado
--    faria challenge de um jogo escalar o bloqueio do outro)

create table if not exists public.lorcana_scan_estado (
  id            smallint primary key,   -- singleton, sempre 1
  bloqueado_ate timestamptz,            -- NULL = liberado; 'infinity' = so o Du destrava
  motivo        text,                   -- MEMORIA do ultimo challenge: NUNCA zerar ao desbloquear
  atualizado_em timestamptz not null default now()
);

insert into public.lorcana_scan_estado (id, bloqueado_ate, motivo)
values (1, null, null)
on conflict (id) do nothing;

create table if not exists public.lorcana_scan_quota (
  dia         date primary key,   -- PK obrigatoria: sem ela o upsert vira insert e o teto nunca dispara
  requisicoes integer not null default 0
);

alter table public.lorcana_scan_estado enable row level security;
alter table public.lorcana_scan_quota  enable row level security;
revoke all on public.lorcana_scan_estado from anon, authenticated;
revoke all on public.lorcana_scan_quota  from anon, authenticated;
-- Nenhuma policy de proposito: so a service_role escreve/le.

-- 2. Guarda de papel de maquina (a autorizacao nao viaja em markdown nem no
--    git -- e lida do banco a cada invocacao, antes da primeira requisicao)

create table if not exists public.scan_maquinas (
  maquina_id     text primary key,             -- 'mia-servidor' | 'mia-windows' | 'mia-mac'
  hostname       text not null,                -- confirmacao cruzada: .env copiado nao passa
  papel          text not null check (papel in ('captura','standby','dev')),
  fontes         text[] not null default '{}', -- lista BRANCA de fontes externas
  valido_ate     timestamptz,                  -- NULL = sem expiracao; papel expirado = abort
  motivo         text not null,
  atualizado_em  timestamptz not null default now()
);
alter table public.scan_maquinas enable row level security;
revoke all on public.scan_maquinas from anon, authenticated;

-- Estado inicial (decisoes do Du de 01-02/09):
-- - Servidor captura ligapokemon E ligalorcana (500 + 200 durante a carga,
--   700 GLOBAIS conferidos pela query da secao 5 do draft do freio).
-- - 'mypcards' fica FORA de toda lista ate o incidente das ~1.900 ultimas
--   vendas erradas ser saneado -- celula vazia e o que a prosa nao conseguiu.
-- - hostname 'CONFIRMAR' e fail-closed de proposito: a guarda aborta ate o Du
--   gravar o hostname real da maquina (uma linha de update, na propria maquina).
insert into public.scan_maquinas (maquina_id, hostname, papel, fontes, motivo) values
  ('mia-servidor', 'CONFIRMAR', 'captura',
   array['ligapokemon','ligalorcana','pokemontcgio','imagens'],
   'decisao Du 02/09: executor unico de captura; mypcards suspenso ate sanear incidente'),
  ('mia-windows', 'CONFIRMAR', 'standby', '{}',
   'decisao Du 02/09: escreve codigo, zero requisicao externa; IP com challenge em 31/08'),
  ('mia-mac', 'MackBook-Pro-de-Eduardo.local', 'dev', '{}',
   'decisao Du 02/09: app/schema/docs; nunca captura')
on conflict (maquina_id) do nothing;
