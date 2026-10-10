-- ============================================================================
-- Regua de e-mail -- Semana 0 (fundacao). Cards #295, #296, #294, #391.
--
-- O que entra:
--   1) `email_envios`: log de todo envio (template, categoria, resend_id) e o
--      que o webhook do Resend devolve depois (entregue, aberto, clique,
--      bounce, reclamacao). Hoje a Bynx manda e-mail e nao tem registro de
--      nada -- nem do que mandou, nem do que voltou.
--   2) Preferencia por categoria em `users`. As tres de marketing (mercado,
--      novidades, radar) so valem com `marketing_aceito = true` -- quem
--      recusou no cadastro continua sem receber, mesmo com o toggle ligado.
--      `colecao` e relacionamento sobre a propria conta. Transacional nao tem
--      toggle: recibo, pedido e suporte sempre chegam.
--
-- ★ TABELA NOVA NASCE EXPOSTA no Supabase (default privilege da tudo para
--   `authenticated`). Por isso: RLS ligada, revoke de anon/authenticated e
--   NENHUMA policy. So o service role (rotas do servidor) le e escreve. O log
--   guarda e-mail de terceiros e historico de abertura -- nao tem leitura de
--   cliente nenhuma.
--
-- ★ CUSTO: `users` tem ~465 linhas. `add column ... boolean not null default
--   true` com default constante e so metadado no PG11+ (sem reescrever a
--   tabela). Nada aqui le `pokemon_cards_all` nem `price_snapshots`.
--
-- ★ GRANT DE COLUNA: `authenticated` tem UPDATE por COLUNA em `users` (11
--   colunas). As 4 novas NAO entram nessa lista de proposito: a preferencia
--   e gravada pela rota /api/email/preferencias com service role, que serve
--   tanto a Minha Conta (Bearer) quanto o link sem login (token do
--   descadastro). Um caminho so, e o cliente nao ganha permissao nova.
--
-- ROLLBACK (uma transacao):
--   begin;
--   drop table if exists public.email_envios;
--   alter table public.users
--     drop column if exists email_pref_colecao,
--     drop column if exists email_pref_mercado,
--     drop column if exists email_pref_novidades,
--     drop column if exists email_pref_radar;
--   commit;
--   O codigo novo e tolerante: sem a tabela, o log falha calado (best
--   effort) e o envio segue; sem as colunas, `enviarNurture` cai no
--   comportamento antigo (so `email_optout_nurture`).
-- ============================================================================

begin;

-- ─── 1. Log de envio ────────────────────────────────────────────────────────

create table if not exists public.email_envios (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid null references public.users(id) on delete set null,
  email          text not null,
  template       text not null,
  trilha         text null,
  categoria      text not null
                 check (categoria in ('transacional','colecao','mercado','novidades','radar')),
  campanha       text null,
  resend_id      text null unique,
  status         text not null default 'enviado',
  enviado_em     timestamptz not null default now(),
  entregue_em    timestamptz null,
  aberto_em      timestamptz null,
  clicado_em     timestamptz null,
  bounce_em      timestamptz null,
  reclamacao_em  timestamptz null,
  meta           jsonb null
);

comment on table public.email_envios is
  'Log de envio de e-mail (regua F0). Escrito por enviar()/enviarNurture() em src/lib/email.ts e atualizado pelo webhook /api/resend/webhook. So service role.';
comment on column public.email_envios.status is
  'enviado | falhou | pulado | entregue | aberto | clicado | bounce | reclamacao. Webhook so avanca, nunca regride.';

create index if not exists email_envios_user_enviado_idx
  on public.email_envios (user_id, enviado_em desc);

-- O `unique` de resend_id ja cria um indice. Este e o pedido explicito do
-- card; `if not exists` com nome proprio nao duplica trabalho relevante
-- numa tabela vazia, mas fica registrado que o webhook depende dele.
create index if not exists email_envios_resend_id_idx
  on public.email_envios (resend_id);

alter table public.email_envios enable row level security;
revoke all on table public.email_envios from anon, authenticated;
grant select, insert, update on table public.email_envios to service_role;
-- sem policy, de proposito: service role bypassa RLS, ninguem mais entra.

-- ─── 2. Preferencias por categoria ──────────────────────────────────────────

alter table public.users
  add column if not exists email_pref_colecao   boolean not null default true,
  add column if not exists email_pref_mercado   boolean not null default true,
  add column if not exists email_pref_novidades boolean not null default true,
  add column if not exists email_pref_radar     boolean not null default true;

comment on column public.users.email_pref_colecao is
  'E-mail de relacionamento sobre a propria conta/colecao. Respeita tambem email_optout_nurture.';
comment on column public.users.email_pref_mercado is
  'Marketing: precos e mercado. So vale com marketing_aceito = true.';
comment on column public.users.email_pref_novidades is
  'Marketing: novidades da Bynx. So vale com marketing_aceito = true.';
comment on column public.users.email_pref_radar is
  'Marketing: radar de lancamentos. So vale com marketing_aceito = true.';

commit;
