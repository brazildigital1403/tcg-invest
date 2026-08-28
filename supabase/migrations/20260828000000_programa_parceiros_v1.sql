-- Programa de Parceiros v1: cupom + comissao + fechamento.
-- Tabelas novas e vazias — zero IO em tabelas grandes.
-- RLS + revoke na criacao (default privilege do Supabase da tudo pro
-- authenticated). Escrita SO via service_role (webhook e admin).

create table public.parceiros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id),
  nome text not null,
  cupom_code text not null unique,
  stripe_coupon_id text,
  stripe_promotion_code_id text not null unique,
  desconto_pct numeric(5,2) not null default 15,
  comissao_primeira_pct numeric(5,2) not null default 100,
  comissao_renovacao_pct numeric(5,2) not null default 20,
  recorrente_meses int not null default 12,
  pix_chave text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.parceiro_fechamentos (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id),
  periodo_inicio date not null,
  periodo_fim date not null,
  total_comissao_cents int not null,
  qtd_linhas int not null,
  status text not null default 'fechado' check (status in ('fechado','pago')),
  pago_em timestamptz,
  comprovante text,
  criado_em timestamptz not null default now()
);

-- Ledger append-only: credito (venda/renovacao), debito (estorno, negativo),
-- ajuste manual. Nunca UPDATE em valor — correcao e linha nova.
create table public.parceiro_comissoes (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id),
  tipo text not null check (tipo in ('venda','renovacao','estorno','ajuste')),
  user_id uuid references public.users(id) on delete set null,
  plano text,
  stripe_subscription_id text,
  stripe_payment_intent_id text,
  stripe_event_id text,
  valor_base_cents int not null,
  comissao_cents int not null,
  fechamento_id uuid references public.parceiro_fechamentos(id),
  observacao text,
  criado_em timestamptz not null default now()
);

-- Dedup: a Stripe re-entrega eventos. Venda/renovacao dedup por PI;
-- estorno dedup por event_id (o mesmo PI pode ter varios estornos parciais).
create unique index parceiro_comissoes_pi_unique
  on public.parceiro_comissoes (stripe_payment_intent_id)
  where tipo in ('venda','renovacao');
create unique index parceiro_comissoes_estorno_evt_unique
  on public.parceiro_comissoes (stripe_event_id)
  where tipo = 'estorno';
create index parceiro_comissoes_sub_idx
  on public.parceiro_comissoes (stripe_subscription_id);
create index parceiro_comissoes_pendente_idx
  on public.parceiro_comissoes (parceiro_id)
  where fechamento_id is null;
create index parceiro_fechamentos_parceiro_idx
  on public.parceiro_fechamentos (parceiro_id);

alter table public.parceiros enable row level security;
alter table public.parceiro_comissoes enable row level security;
alter table public.parceiro_fechamentos enable row level security;

revoke all on public.parceiros from anon, authenticated;
revoke all on public.parceiro_comissoes from anon, authenticated;
revoke all on public.parceiro_fechamentos from anon, authenticated;

-- RLS limita LINHA, nao COLUNA — grant coluna a coluna, escondendo o que a
-- Central nao mostra: user_id de assinante (LGPD), IDs Stripe, pix_chave,
-- observacao (nota do admin) e comprovante. parceiros.user_id fica: as
-- policies das filhas fazem sub-select em parceiros com o privilegio do
-- chamador, e a RLS ja limita a propria linha.
grant select (id, user_id, nome, cupom_code, desconto_pct,
  comissao_primeira_pct, comissao_renovacao_pct, recorrente_meses,
  ativo, criado_em)
  on public.parceiros to authenticated;
grant select (id, parceiro_id, tipo, plano, valor_base_cents,
  comissao_cents, fechamento_id, criado_em)
  on public.parceiro_comissoes to authenticated;
grant select (id, parceiro_id, periodo_inicio, periodo_fim,
  total_comissao_cents, qtd_linhas, status, pago_em, criado_em)
  on public.parceiro_fechamentos to authenticated;

-- Leitura: o parceiro so ve o proprio dado. Nenhuma policy de escrita.
create policy parceiros_self_read on public.parceiros
  for select to authenticated
  using (user_id = auth.uid());

create policy parceiro_comissoes_self_read on public.parceiro_comissoes
  for select to authenticated
  using (exists (
    select 1 from public.parceiros p
    where p.id = parceiro_id and p.user_id = auth.uid()
  ));

create policy parceiro_fechamentos_self_read on public.parceiro_fechamentos
  for select to authenticated
  using (exists (
    select 1 from public.parceiros p
    where p.id = parceiro_id and p.user_id = auth.uid()
  ));
