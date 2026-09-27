-- ============================================================================
-- Pagamentos do servico de bancada em etapas (fatia 2 do plano de pagamento).
--
-- Aprovada pelo Du e aplicada em producao em 27/09/2026.
--
-- Decisao do Du (27/09/2026), seguindo o painel de pagamento:
--   sinal    no aceite do orcamento: seguro + frete de volta (custo que a Bynx
--            tem com ou sem servico). O endereco de envio so aparece depois dele.
--   servico  na aprovacao da proposta de tratamento, antes da bancada:
--            servico + expresso.
--   integral pre-grading sozinho (nao tem proposta): tudo no aceite.
--
-- Uma linha por etapa por pedido. `servico_solicitacoes.pago_em` continua
-- existindo e passa a significar "tudo pago" (a trava do envio de volta segue
-- lendo ele) -- quem grava e o servidor, quando a ultima etapa fecha.
--
-- ★ IDEMPOTENCIA: pago_em so e gravado na transicao (where pago_em is null),
--   pelo Pix manual ou pelo webhook da Stripe -- quem chegar primeiro vence.
--   stripe_checkout_session_id e stripe_payment_intent_id sao UNIQUE: o mesmo
--   pagamento da Stripe nunca vira duas linhas.
--
-- ★ NASCE FECHADA: RLS + revoke antes do grant; o dono so le. Escrita so pelo
--   servidor (service_role). Mesmo desenho das outras servico_*.
--
-- ★ CUSTO DE IO: zero. Tabela nova vazia; nada toca a pokemon_cards_all.
--
-- ROLLBACK: drop table public.servico_pagamentos;
-- ============================================================================

create table if not exists public.servico_pagamentos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.servico_solicitacoes(id) on delete cascade,
  etapa text not null check (etapa in ('sinal', 'servico', 'integral')),
  valor_cents integer not null check (valor_cents > 0),
  -- null ate pagar; 'pix_manual' (admin confirma) ou 'stripe' (webhook).
  metodo text check (metodo is null or metodo in ('pix_manual', 'stripe')),
  pago_em timestamptz,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  reembolsado_cents integer not null default 0 check (reembolsado_cents >= 0),
  reembolsado_em timestamptz,
  stripe_refund_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (solicitacao_id, etapa),
  check (reembolsado_cents <= valor_cents),
  check ((pago_em is null) = (metodo is null))
);

comment on table public.servico_pagamentos is
  'Pagamento do servico de bancada por etapa (sinal no aceite, servico na proposta, integral no pre-grading). Escrita so pelo servidor; pago_em gravado so na transicao.';

create index if not exists idx_servico_pag_solic on public.servico_pagamentos (solicitacao_id);

drop trigger if exists servico_pagamentos_touch on public.servico_pagamentos;
create trigger servico_pagamentos_touch before update on public.servico_pagamentos
  for each row execute function public.touch_updated_at();

alter table public.servico_pagamentos enable row level security;
revoke all on table public.servico_pagamentos from anon, authenticated;
grant select on table public.servico_pagamentos to authenticated;
grant all on table public.servico_pagamentos to service_role;

drop policy if exists "servico_pag_select_dono" on public.servico_pagamentos;
create policy "servico_pag_select_dono" on public.servico_pagamentos
  for select to authenticated using (exists (
    select 1 from public.servico_solicitacoes s where s.id = solicitacao_id and s.user_id = auth.uid()));
