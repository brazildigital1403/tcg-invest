-- "Quero ser avisado do proximo leilao" (estudo de UX de 03/11/2026).
--
-- POR QUE: a vitrine vazia nao guardava o interesse de quem chegava.
-- REGRA: um aviso por pedido. Quando uma loja agenda, quem pediu recebe sino e
-- e-mail e `avisado_em` e preenchido; para o proximo, pede de novo. Assim o
-- pedido de hoje nao vira e-mail recorrente.
-- ACESSO: so a chave de servico, pelas rotas. Tabela nova nasce exposta no
-- Supabase, por isso RLS sem policy e revoke.
--
-- Rollback: drop table public.leilao_aviso_interesse;
create table if not exists public.leilao_aviso_interesse (
  user_id uuid primary key references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  avisado_em timestamptz
);

create index if not exists leilao_aviso_interesse_pendente_idx
  on public.leilao_aviso_interesse (created_at) where avisado_em is null;

alter table public.leilao_aviso_interesse enable row level security;
revoke all on public.leilao_aviso_interesse from public, anon, authenticated;
