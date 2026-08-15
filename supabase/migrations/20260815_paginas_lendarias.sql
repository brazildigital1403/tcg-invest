-- 20260815_paginas_lendarias.sql
-- Desbloqueios das Paginas Lendarias (fichario com fundo continuo).
--
-- *** NAO APLICADA EM PRODUCAO (15/08/2026). ***
-- Decisao do fluxo: schema para pra confirmacao do Du. O codigo ja esta no ar
-- no repo e TOLERA a ausencia desta tabela (rota /api/paginas-lendarias/sheet
-- trata erro de relacao inexistente como "nenhuma compra"). Aplicar quando o
-- Du aprovar, junto com a criacao dos prices na Stripe:
--   STRIPE_PRICE_PAGINA_LENDARIA  (one-time, R$ 12,90)
--   STRIPE_PRICE_COLECAO_LENDARIA (one-time, R$ 79,90)
--
-- Espelha user_master_sets: compra avulsa vitalicia por usuario.
-- pagina_id e o slug do catalogo em src/lib/paginas-lendarias.ts;
-- o valor '*' significa o pacote completo (Colecao Lendaria).

create table if not exists public.user_paginas_lendarias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pagina_id text not null,
  source text not null default 'stripe',
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  unique (user_id, pagina_id)
);

-- Porteira aprendida na auditoria de 26/07: revogar tudo do anon/authenticated
-- e conceder so o que precisa. Leitura e escrita passam pelo service role
-- (rotas de API); o client NUNCA toca esta tabela direto.
revoke all on public.user_paginas_lendarias from public, anon, authenticated;

alter table public.user_paginas_lendarias enable row level security;

-- Sem policy de leitura de proposito: RLS sem policy bloqueia tudo, e o
-- service role bypassa. Se um dia o client precisar ler direto, criar policy
-- select com user_id = auth.uid() e grant select para authenticated.
