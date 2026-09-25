-- ============================================================================
-- F1 do epico "receber sem ter loja" (Quadro #389).
--
-- ★ O PROBLEMA MEDIDO (24/09/2026): 96 dos 100 anuncios ativos NAO tem botao
--   de comprar, e 70 deles sao de PESSOA FISICA SEM LOJA -- 18 vendedores,
--   R$ 27.877 em estoque. Para essas pessoas nao existe caminho nenhum hoje:
--   o checkout parte da tabela `lojas` e exige o Connect DELA.
--
-- ★ O DESENHO (decisao do Du, depois de ele apontar o furo do plano
--   anterior). A conta de recebimento passa a poder viver no USUARIO, e a
--   loja CONTINUA podendo ter a dela. O resolvedor usa a da loja quando
--   existir, senao a do dono.
--
--   Por que assim, e nao movendo as contas para o usuario:
--     - As 3 lojas que ja recebem (Bynx, Mais Que Geek, Castle Games) ficam
--       intocadas. Zero backfill em conta que movimenta dinheiro real.
--     - Quem tem anuncio e depois cria loja nao refaz cadastro nenhum.
--     - Segunda loja do mesmo dono herda a mesma conta.
--     - E o dia em que alguem precisar de CNPJ proprio por loja, basta criar
--       a conta daquela loja: o ponteiro ja e o campo que existe hoje.
--
-- ★ NAO VAZA NO PERFIL PUBLICO: `public_users` e uma view que ENUMERA as
--   colunas (id, name, username, city, is_pro, created_at, perfil_*), entao
--   coluna nova em `users` nao entra nela. Conferido antes de escrever.
--
-- ★ QUEM ESCREVE E O SERVIDOR: a RLS de `users` libera SELECT so da propria
--   linha, e `authenticated` NAO tem GRANT UPDATE -- a policy users_update_own
--   e inalcancavel pelo navegador. Estas colunas sao gravadas pelas rotas de
--   API com chave de servico, como as da loja.
--
-- Tabela de 440 linhas: `add column` com default constante nao reescreve nada.
-- ============================================================================

alter table public.users
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_status text not null default 'nao_iniciado',
  add column if not exists connect_charges_enabled boolean not null default false,
  add column if not exists connect_payouts_enabled boolean not null default false,
  add column if not exists connect_requirements jsonb,
  add column if not exists connect_onboarded_em timestamptz,
  -- Espelha `lojas.repasse_prazo`: 30 dias e o piso do Brasil, e 14 so libera
  -- com historico de vendas.
  add column if not exists repasse_prazo integer not null default 30;

comment on column public.users.stripe_connect_account_id is
  'Conta Connect da PESSOA. A loja usa a dela quando tem; senao, herda esta -- ver src/lib/vendedorRecebimento.ts.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_users_connect_status') then
    alter table public.users add constraint chk_users_connect_status
      check (stripe_connect_status in ('nao_iniciado', 'pendente', 'em_analise', 'ativo', 'restrito'));
  end if;
end $$;

-- ★ VENDA DE PESSOA FISICA NAO TEM LOJA PARA APONTAR. A coluna nasceu
--   obrigatoria porque todo pedido vinha de loja; `vendedor_user_id`, que ja e
--   NOT NULL, continua sendo quem responde "quem vendeu". Hoje nao ha nenhum
--   pedido com loja nula -- nada muda para o que ja existe.
alter table public.pedidos alter column loja_id drop not null;
