-- ============================================================================
-- Debito do vendedor com a Bynx, descontado na proxima venda (25/10/2026)
-- ============================================================================
-- POR QUE: a regra "a Bynx nunca fica negativa num estorno" (lib/custoEstorno)
-- segura a taxa da Stripe e a etiqueta reversa na comissao que voltaria para
-- a loja. Quando os custos passam da comissao (lote abaixo de ~R$ 200 com
-- etiqueta), a Stripe NAO deixa cobrar a conta conectada no Brasil ("Account
-- debits are not supported from BR to BR", testado no sandbox). Decisao do Du
-- (opcao a): a diferenca vira DEBITO e sai da comissao da proxima venda.
--
-- COMO:
--   - vendedor_debitos: um por estorno que nao fechou a conta, chaveado pela
--     conta Stripe do recebedor (loja ou pessoa fisica: e para la que o
--     dinheiro vai). origem_chave unica = a chave do estorno (idempotente).
--   - checkout: application_fee_amount += min(debito em aberto, liquido do
--     vendedor). pedidos.debito_descontado_cents guarda quanto foi.
--   - webhook (pagamento confirmado): vendedor_debito_quitar baixa FIFO,
--     idempotente por pedido. Se duas vendas cobraram o mesmo debito ao mesmo
--     tempo, a funcao devolve so o que de fato baixou e o webhook devolve o
--     excesso a loja devolvendo parte da comissao (ApplicationFee) desta venda.
-- Nada aqui e lido pelo navegador: so service_role (rotas e webhook).
--
-- Rollback:
--   drop function if exists public.vendedor_debito_quitar(text, uuid, integer);
--   drop table if exists public.vendedor_debito_baixas;
--   drop table if exists public.vendedor_debitos;
--   alter table public.pedidos drop column if exists debito_descontado_cents;
-- ============================================================================

alter table public.pedidos
  add column if not exists debito_descontado_cents integer not null default 0
    check (debito_descontado_cents >= 0);

comment on column public.pedidos.debito_descontado_cents is
  'Parte da comissao desta venda que pagou debito anterior do vendedor (vendedor_debitos). Ja somada em comissao_bynx_cents e tirada de liquido_loja_cents.';

create table if not exists public.vendedor_debitos (
  id uuid primary key default gen_random_uuid(),
  conta_stripe text not null check (conta_stripe ~ '^acct_[A-Za-z0-9]+$'),
  loja_id uuid references public.lojas(id) on delete set null,
  vendedor_user_id uuid references public.users(id) on delete set null,
  origem_pedido_id uuid references public.pedidos(id) on delete set null,
  origem_chave text not null unique,
  motivo text not null check (char_length(motivo) between 3 and 300),
  valor_cents integer not null check (valor_cents > 0),
  quitado_cents integer not null default 0,
  quitado_em timestamptz,
  created_at timestamptz not null default now(),
  check (quitado_cents >= 0 and quitado_cents <= valor_cents)
);

create index if not exists vendedor_debitos_aberto_idx
  on public.vendedor_debitos (conta_stripe, created_at)
  where quitado_cents < valor_cents;

create table if not exists public.vendedor_debito_baixas (
  id bigserial primary key,
  debito_id uuid not null references public.vendedor_debitos(id) on delete cascade,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  valor_cents integer not null check (valor_cents > 0),
  created_at timestamptz not null default now(),
  unique (debito_id, pedido_id)
);

create index if not exists vendedor_debito_baixas_pedido_idx on public.vendedor_debito_baixas (pedido_id);

alter table public.vendedor_debitos enable row level security;
alter table public.vendedor_debito_baixas enable row level security;
revoke all on public.vendedor_debitos from anon, authenticated;
revoke all on public.vendedor_debito_baixas from anon, authenticated;
revoke all on sequence public.vendedor_debito_baixas_id_seq from anon, authenticated;

-- Baixa FIFO do debito em aberto da conta, ate p_valor. Idempotente por
-- pedido: se o pedido ja deu baixa, devolve o que baixou e nao mexe. Devolve
-- o total baixado (pode ser menor que p_valor: o webhook devolve a diferenca).
create or replace function public.vendedor_debito_quitar(p_conta text, p_pedido uuid, p_valor integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ja integer;
  v_resta integer := greatest(coalesce(p_valor, 0), 0);
  v_x integer;
  d record;
begin
  perform pg_advisory_xact_lock(hashtextextended('vendedor_debito:' || coalesce(p_conta, ''), 0));
  select coalesce(sum(valor_cents), 0) into v_ja from public.vendedor_debito_baixas where pedido_id = p_pedido;
  if v_ja > 0 then
    return v_ja;
  end if;
  for d in
    select id, valor_cents, quitado_cents from public.vendedor_debitos
    where conta_stripe = p_conta and quitado_cents < valor_cents
    order by created_at, id
    for update
  loop
    exit when v_resta <= 0;
    v_x := least(v_resta, d.valor_cents - d.quitado_cents);
    update public.vendedor_debitos
      set quitado_cents = quitado_cents + v_x,
          quitado_em = case when quitado_cents + v_x = valor_cents then now() else null end
      where id = d.id;
    insert into public.vendedor_debito_baixas (debito_id, pedido_id, valor_cents) values (d.id, p_pedido, v_x);
    v_resta := v_resta - v_x;
  end loop;
  return greatest(coalesce(p_valor, 0), 0) - v_resta;
end
$$;

revoke all on function public.vendedor_debito_quitar(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.vendedor_debito_quitar(text, uuid, integer) to service_role;
