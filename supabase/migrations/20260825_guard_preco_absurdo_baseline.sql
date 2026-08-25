-- ============================================================================
-- DESENHO: guard de preco absurdo (quarentena viva)
-- Mia Mac - 25/08/2026 - PARA REVISAO DO DU. NADA APLICADO AINDA.
-- ============================================================================
--
-- POR QUE NAO BLOQUEIA A ESCRITA
-- ------------------------------
-- A primeira ideia era barrar o UPDATE quando o preco destoasse da mediana.
-- Os dados mataram a ideia: dos saltos de 5x+ no historico que tem snapshot
-- seguinte, 389 PERMANECERAM e so 93 voltaram -- 81% dos saltos grandes sao
-- reais. Pior: bloquear cria trava PERMANENTE, porque o valor novo nunca
-- entraria nos snapshots, a mediana nunca subiria, e o guard barraria pra
-- sempre.
--
-- Entao: a escrita SEMPRE acontece (dado fiel a fonte, historico segue
-- evoluindo). O que muda e que a carta ganha uma MARCA de "preco nao
-- confiavel para comparacao", e a UI nao usa preco marcado no badge.
-- A marca se desfaz sozinha: se o preco alto persistir, ele entra nos
-- snapshots, a mediana sobe, o fator cai e a marca sai no recalculo seguinte.
--
-- O CRITERIO (composto - fator sozinho nao serve)
-- -----------------------------------------------
--   1. preco_medio atual >= 5x a mediana historica da PROPRIA carta, E
--   2. hoje esta com oferta unica (preco_min = preco_max), E
--   3. a carta JA TEVE liquidez (>= 2 snapshots com preco_min <> preco_max)
--
-- Ou seja: tinha varias ofertas e colapsou para uma so, cara. E o retrato
-- exato do caso que originou isso (cel25-9: R$ 49-61 de maio a 26/07, saltou
-- pra R$ 1.200 em 28/07, esta em R$ 999 desde 01/08).
--
-- Seletividade medida sobre 14.402 cartas com historico:
--   so criterio 1 .................... 275 cartas (1,9%)  <- barraria demais
--   1 + 2 ............................  68 cartas
--   1 + 2 + 3 (este) .................  45 cartas (0,3%)  <- cirurgico
--
-- Os 45 incluem: Cynthia's Garchomp ex a R$ 20.000 contra mediana de R$ 817
-- (com 42 snapshots de liquidez), Pikachu-EX a R$ 15.000 contra R$ 1.021,
-- Champions Festival a R$ 9.999,95 contra R$ 654, e as duas entradas do
-- Surfing Pikachu.
--
-- CUSTO (medido com explain analyze buffers)
-- ------------------------------------------
--   Backfill completo: 464 ms, 175.156 buffers, ZERO seq scan (index scan em
--   price_snapshots e pokemon_cards_pkey). Roda UMA vez.
--
--   Diario incremental: so recalcula cartas com snapshot novo do dia (~400 a
--   500, o que o capture_price_snapshots insere). Custo residual.
--
--   Nao roda por request em lugar nenhum -- e cron, como manda a regra da casa
--   pra qualquer coisa que varra tabela grande.
--
-- ROLLBACK: drop das 2 funcoes + 1 tabela + 1 cron. Nada e alterado em
-- pokemon_cards_all, nenhuma coluna nova, a view pokemon_cards NAO precisa ser
-- recriada, e nenhum preco existente e sobrescrito.
-- ============================================================================


-- ── 1. Tabela de baseline + marca ───────────────────────────────────────────
-- Tabela NOVA nasce exposta no Supabase (default privilege da tudo pro
-- authenticated) -- por isso o revoke e o RLS vem junto na criacao.

create table if not exists card_preco_baseline (
  card_id        text primary key,
  mediana        numeric not null,
  n_snaps        integer not null,
  n_liquidez     integer not null,          -- snapshots com preco_min <> preco_max
  preco_no_calc  numeric,                   -- preco_medio no momento do calculo
  fator          numeric,                   -- preco_no_calc / mediana
  suspeito       boolean not null default false,
  motivo         text,
  atualizado_em  timestamptz not null default now()
);

revoke all on card_preco_baseline from anon, authenticated;
alter table card_preco_baseline enable row level security;

create index if not exists idx_cpb_suspeito on card_preco_baseline (card_id) where suspeito;


-- ── 2. Funcao de recalculo ──────────────────────────────────────────────────
-- p_somente_ids null  -> recalcula tudo (backfill, 1x)
-- p_somente_ids array -> recalcula so esses (uso diario)

create or replace function atualizar_preco_baseline(p_somente_ids text[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  with hist as (
    select s.card_id,
           percentile_cont(0.5) within group (order by s.preco_medio) as mediana,
           count(*)                                                   as n_snaps,
           count(*) filter (where s.preco_min is distinct from s.preco_max) as n_liq
      from price_snapshots s
     where s.preco_medio > 0
       and (p_somente_ids is null or s.card_id = any(p_somente_ids))
     group by s.card_id
    having count(*) >= 4
  )
  insert into card_preco_baseline
        (card_id, mediana, n_snaps, n_liquidez, preco_no_calc, fator, suspeito, motivo, atualizado_em)
  select h.card_id,
         h.mediana,
         h.n_snaps,
         h.n_liq,
         pc.preco_medio,
         case when h.mediana > 0 then round((pc.preco_medio / h.mediana)::numeric, 2) end,
         -- criterio composto (ver cabecalho)
         (pc.preco_medio >= h.mediana * 5 and pc.preco_min = pc.preco_max and h.n_liq >= 2),
         case when (pc.preco_medio >= h.mediana * 5 and pc.preco_min = pc.preco_max and h.n_liq >= 2)
              then 'oferta unica muito acima da mediana da propria carta'
         end,
         now()
    from hist h
    join pokemon_cards pc on pc.id = h.card_id
   where pc.preco_medio is not null
  on conflict (card_id) do update
     set mediana       = excluded.mediana,
         n_snaps       = excluded.n_snaps,
         n_liquidez    = excluded.n_liquidez,
         preco_no_calc = excluded.preco_no_calc,
         fator         = excluded.fator,
         suspeito      = excluded.suspeito,
         motivo        = excluded.motivo,
         atualizado_em = now();

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function atualizar_preco_baseline(text[]) from anon, authenticated;


-- ── 3. Passo diario (incremental) ───────────────────────────────────────────
-- Recalcula so as cartas que ganharam snapshot hoje.

create or replace function passo_diario_preco_baseline()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare ids text[];
begin
  select array_agg(distinct card_id) into ids
    from price_snapshots
   where snapshot_date = current_date;

  if ids is null then return 0; end if;
  return atualizar_preco_baseline(ids);
end;
$$;

revoke all on function passo_diario_preco_baseline() from anon, authenticated;


-- ── 4. Backfill inicial (1x) ────────────────────────────────────────────────
-- select atualizar_preco_baseline();     -- ~464ms, 14.402 linhas, 45 suspeitas


-- ── 5. Cron ─────────────────────────────────────────────────────────────────
-- O daily-price-snapshots roda 10:00. Este entra as 10:30, depois dele.
--
-- select cron.schedule('preco-baseline-diario', '30 10 * * *',
--                      $$select public.passo_diario_preco_baseline();$$);


-- ── 6. Conferencia ──────────────────────────────────────────────────────────
-- select count(*) filter (where suspeito) as suspeitas, count(*) as total
--   from card_preco_baseline;
