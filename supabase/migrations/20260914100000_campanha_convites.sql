-- Convite pessoal de campanha (lead -> link com token opaco).
--
-- Primeira campanha: "presente-2026-09" (257 leads do formulario Meta, 50% na
-- 1a cobranca, fecha 18/09/2026 23h59 BRT). Molde pros proximos disparos.
--
-- Por que existe:
--   - o link do e-mail leva so o token, nunca nome ou e-mail na URL (o Meta
--     Pixel captura a query string);
--   - cada etapa do funil e carimbada PELO SERVIDOR, sem depender de cookie.
--     Na TCG CON o PostHog registrou zero visita porque so conta quem aceita
--     cookie, e nao deu pra saber onde a pessoa desistia.
--
-- Guarda so nome e e-mail. Telefone fica fora de proposito: o formulario nao
-- pediu consentimento pra WhatsApp.
--
-- Nasce trancada: RLS ligada, sem policy, e revoke do anon/authenticated
-- (default privilege do Supabase daria acesso sozinho). So a service_role le.

create table public.campanha_convites (
  id uuid primary key default gen_random_uuid(),
  campanha text not null default 'presente-2026-09',
  token uuid not null default gen_random_uuid(),
  nome text not null,
  email text not null,
  origem text,
  lead_criado_em timestamptz,
  user_id uuid references auth.users(id) on delete set null,
  landing_aberta_em timestamptz,
  presente_aberto_em timestamptz,
  cadastro_em timestamptz,
  checkout_em timestamptz,
  checkout_plano text,
  pago_em timestamptz,
  pago_plano text,
  created_at timestamptz not null default now(),
  constraint campanha_convites_token_key unique (token),
  constraint campanha_convites_campanha_email_key unique (campanha, email)
);

comment on table public.campanha_convites is
  'Convite pessoal de campanha (lead -> link com token opaco). Guarda so nome e e-mail, sem telefone. Cada etapa do funil e carimbada pelo servidor. Leitura e escrita so pela service_role.';

alter table public.campanha_convites enable row level security;
revoke all on table public.campanha_convites from anon, authenticated;
