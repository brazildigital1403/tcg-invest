-- 11/11/2026: preco internacional por carta (TCGplayer em USD e Cardmarket em EUR).
--
-- Por que tabela nova e nao as colunas de pokemon_cards_all (price_usd_*, price_eur_*):
--  1. As colunas antigas estao erradas. O sync semanal e o verificador de identidade gravavam o
--     averageSellPrice do Cardmarket, que e EURO, em price_usd_normal (Tornadus-EX: usd_normal =
--     eur_normal = 16,37). Nada mais as atualiza desde 31/08 e o dolar do holofoil, desde antes.
--  2. A data do preco nao pode ser tcg_updated_at: essa coluna e o cursor do verificador de
--     identidade (ORDER BY ... NULLS FIRST, avanca para now() a cada checagem).
--  3. pokemon_cards_all tem 187 MB e pokemon_cards e uma VIEW (coluna nova na base nao aparece
--     na view sozinha). UPDATE em massa ali gasta o orcamento de IO. Tabela nova de ~20 mil linhas nao.
--
-- Decisao do Du (11/11): o valor de fora e INFORMATIVO. Nunca e parametro de preco da Bynx.
-- A tela mostra o do Brasil em destaque e este abaixo.
--
-- Sem FK para pokemon_cards: a base e a tabela renomeada pokemon_cards_all e dedup/backfill dela
-- nao pode ser travado por esta tabela. card_id = id da pokemontcg.io = pokemon_cards.id (ids que
-- NAO comecam com liga-; as cartas liga-* so do Brasil nao tem equivalente la).
--
-- RLS ligada e revoke para anon/authenticated na criacao (o default privilege do Supabase da tudo
-- ao authenticated). Quem escreve e a Servidor, com a chave de servico; quem le e rota de servidor.

create table if not exists public.card_preco_internacional (
  card_id                  text primary key,

  -- TCGplayer, USD, campo "market" de cada variante.
  usd_normal               numeric(12,2),
  usd_holofoil             numeric(12,2),
  usd_reverse_holofoil     numeric(12,2),
  usd_1st_edition_normal   numeric(12,2),
  usd_1st_edition_holofoil numeric(12,2),
  tcgplayer_url            text,
  tcgplayer_em             date,          -- tcgplayer.updatedAt, dado da fonte

  -- Cardmarket, EUR.
  eur_media_venda          numeric(12,2), -- averageSellPrice
  eur_tendencia            numeric(12,2), -- trendPrice
  eur_media_7d             numeric(12,2), -- avg7
  eur_media_30d            numeric(12,2), -- avg30
  eur_reverse_tendencia    numeric(12,2), -- reverseHoloTrend
  cardmarket_url           text,
  cardmarket_em            date,          -- cardmarket.updatedAt, dado da fonte

  coletado_em              timestamptz not null default now()
);

comment on table public.card_preco_internacional is
  'Preco de fora (TCGplayer USD, Cardmarket EUR) por carta. Informativo, nunca parametro de preco da Bynx. Escrita: Ivy Servidor (scan-preco-internacional.mjs).';

create index if not exists idx_card_preco_internacional_coletado
  on public.card_preco_internacional (coletado_em);

alter table public.card_preco_internacional enable row level security;
revoke all on public.card_preco_internacional from public, anon, authenticated;
