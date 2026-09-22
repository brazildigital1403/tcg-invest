-- ============================================================================
-- Carta declarada x carta verificada -- origem de cada linha de `user_cards`.
--
-- ★ O QUE MUDA. Toda linha passa a dizer DE ONDE veio: `declarada` (o dono
--   digitou), `scan` (passou pela camera e foi reconhecida) ou `compra`
--   (pedido pago dentro da Bynx). As duas ultimas sao o que a UI chama de
--   carta verificada.
--
-- ★ POR QUE E BARATO. `user_cards` tem 6.865 linhas / 3,5 MB (medido em
--   22/09/2026). `add column ... default 'declarada'` com default CONSTANTE
--   nao reescreve a tabela no PG11+, e a check roda uma varredura de 3,5 MB.
--   Nao e uma operacao do porte das que mexem em `pokemon_cards_all`.
--
-- ★ SEM INDICE. O unico filtro por origem e dentro de uma colecao que ja
--   esta filtrada por `user_id` (indice existente) -- sao dezenas de linhas
--   por usuario. Indice novo aqui seria peso sem leitor.
-- ============================================================================

alter table public.user_cards
  add column if not exists origem text not null default 'declarada',
  add column if not exists origem_em timestamptz;

comment on column public.user_cards.origem is
  'De onde a carta veio: declarada (o dono informou), scan (reconhecida pela camera) ou compra (pedido pago na Bynx). Escala que so sobe -- ver src/lib/origemCarta.ts.';
comment on column public.user_cards.origem_em is
  'Quando a linha deixou de ser declarada. Null enquanto origem = declarada.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_user_cards_origem'
  ) then
    alter table public.user_cards
      add constraint chk_user_cards_origem
      check (origem in ('declarada', 'scan', 'compra'));
  end if;
end $$;

-- ── Backfill ────────────────────────────────────────────────────────────────
--
-- ★ UMA LINHA, NAO QUATRO. O banco tem 4 anuncios concluidos/vendidos e 1
--   pedido entregue, mas isso NAO e o mesmo que 5 cartas na colecao de
--   alguem. Cruzando comprador + carta:
--
--   - Haunter (039/086), comprado por 6b48e0bf em 29/06: a linha existe e
--     nasceu 2 minutos depois da conclusao. Casamento forte -> entra.
--   - Clefairy (94/124), comprada por f0220e18 em 16/06: a unica linha com
--     esse nome na colecao dele e GRADUADA e foi criada em 22/05, um mes
--     ANTES da compra. Nome igual, carta diferente -> fica fora. (Casar
--     carta por nome e justamente a armadilha conhecida da casa.)
--   - Os outros 2 anuncios e o pedido #1 sao a venda de teste `swsh9-53`:
--     nenhuma linha correspondente na colecao do comprador. Nao ha o que
--     marcar.
--
-- Por isso o backfill e por ID, explicito e auditavel -- nao um UPDATE ... FROM
-- que casa por nome e marca o que nao deve.
update public.user_cards
   set origem = 'compra',
       origem_em = timestamptz '2026-06-29 14:20:00.260139+00'
 where id = '539b4fcf-b3b8-4363-b022-204a92aff36e'
   and origem = 'declarada';
