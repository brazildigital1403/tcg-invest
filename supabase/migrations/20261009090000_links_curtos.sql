-- ============================================================================
-- Links curtos da Bynx: bynx.gg/<slug> -> destino com UTM, criados no admin.
-- Aplicada em producao em 09/10/2026 (pedido do Du: link da descricao do
-- YouTube curto e com a marca, e poder criar os proximos pelo /admin/links).
--
-- NASCE FECHADA: RLS ligada, sem policy, revoke de anon/authenticated. A rota
-- publica src/app/[slug]/route.ts resolve com a chave de servico e responde
-- 302; o admin escreve pela /api/admin/links. `cliques` e metrica.
--
-- CUSTO DE IO: zero. Tabela nova de dezenas de linhas, leitura por PK.
-- ROLLBACK: drop table public.links_curtos;
-- ============================================================================
create table if not exists public.links_curtos (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
  destino text not null check (destino ~ '^https?://'),
  descricao text,
  ativo boolean not null default true,
  cliques integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.links_curtos enable row level security;
revoke all on public.links_curtos from anon, authenticated;

insert into public.links_curtos (slug, destino, descricao)
values ('yt', 'https://bynx.gg/?utm_source=youtube&utm_medium=video&utm_campaign=o-que-e-a-bynx', 'Descricao dos videos do YouTube (O que e a Bynx)')
on conflict (slug) do nothing;
