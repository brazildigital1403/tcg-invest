-- BASELINE DO SCHEMA public (+ storage buckets/policies)
-- Projeto Supabase hvkcwfcvizrvhkerupfc (producao, PostgreSQL 17)
-- Gerado em 22/08/2026 exclusivamente a partir dos catalogos (pg_catalog /
-- information_schema / pg_policies / storage.buckets), sem pg_dump.
--
-- IDEMPOTENTE: usa create ... if not exists, create or replace, drop policy /
-- drop trigger if exists antes de recriar, e do-blocks para constraints.
-- Pode ser reaplicado num banco vazio ou num banco que ja tenha parte dos objetos.
--
-- NAO contem dados. Tabelas de referencia (set_aliases, busca_glossario,
-- liga_set_edids, master_sets, pokemon_sets, pokemon_species, pokemon_pokedex...)
-- precisam de seed separado. Ver README-baseline.md.
--
-- Ordem: extensoes > tipos > sequences > tabelas > constraints (PK/UK/CHECK) >
-- views > matviews > indices > funcoes (trigger functions primeiro) > triggers >
-- FKs > RLS/policies > grants > storage > comentarios > verificacao.


-- ============================================================
-- 1. EXTENSOES
-- ============================================================
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pg_trgm with schema public;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;
create extension if not exists unaccent with schema public;
create extension if not exists "uuid-ossp" with schema extensions;

-- ============================================================
-- 2. TIPOS
-- ============================================================
-- Nenhum enum, tipo composto ou domain definido em public (pg_type typtype in (e,c,d)).
-- Nao existe schema private.

-- ============================================================
-- 3. SEQUENCES
-- ============================================================
-- Todas as 8 sequences sao owned (serial/identity) e nascem com as tabelas:
-- card_ultima_venda_historico_id_seq, card_validation_review_id_seq, dedup_sets_backup_id_seq,
-- liga_set_mapping_id_seq, ml_afiliado_produtos_id_seq, pedidos_numero_seq, price_history_id_seq,
-- price_snapshots_id_seq. As que sao default nextval() (nao identity) precisam existir ANTES da tabela:
create sequence if not exists public.dedup_sets_backup_id_seq;
create sequence if not exists public.liga_set_mapping_id_seq;
create sequence if not exists public.pedidos_numero_seq;
create sequence if not exists public.price_history_id_seq;


-- ============================================================
-- 4. TABELAS (72)
-- ============================================================
create table if not exists public.avaliacoes (
  id uuid default gen_random_uuid() not null,
  marketplace_id uuid,
  avaliador_id uuid,
  avaliado_id uuid,
  papel text not null,
  estrelas integer not null,
  comentario text,
  created_at timestamp with time zone default now(),
  pedido_id uuid,
  loja_id uuid
);

create table if not exists public.backup_precos_carta_errada (
  id text not null,
  name text,
  set_name text,
  nome_no_link text,
  liga_link text,
  preco_min numeric,
  preco_medio numeric,
  preco_max numeric,
  preco_foil_min numeric,
  preco_foil_medio numeric,
  preco_foil_max numeric,
  preco_reverse_min numeric,
  preco_reverse_medio numeric,
  preco_reverse_max numeric,
  preco_pokeball_min numeric,
  preco_pokeball_medio numeric,
  preco_pokeball_max numeric,
  preco_promo_min numeric,
  preco_promo_medio numeric,
  preco_promo_max numeric,
  salvo_em timestamp with time zone default now() not null
);

create table if not exists public.blog_categories (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  name text not null,
  description text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.blog_posts (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  title text not null,
  excerpt text,
  cover_image_url text,
  content jsonb default '[]'::jsonb not null,
  category_id uuid,
  tags text[] default '{}'::text[] not null,
  status text default 'draft'::text not null,
  published_at timestamp with time zone,
  seo_title text,
  seo_description text,
  reading_minutes integer,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.busca_glossario (
  pt text not null,
  en text not null
);

create table if not exists public.card_precos (
  card_id text not null,
  idioma text not null,
  variante text default 'normal'::text not null,
  preco_min numeric,
  preco_medio numeric,
  preco_max numeric,
  amostras integer,
  fonte text,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.card_requests (
  id uuid default gen_random_uuid() not null,
  tipo text default 'faltando'::text not null,
  numero text,
  nome text,
  colecao text,
  idioma text default 'pt'::text,
  card_id text,
  erro_tipo text,
  descricao text,
  termo_busca text,
  origem text default 'form'::text not null,
  user_id uuid,
  status text default 'pendente'::text not null,
  notas_admin text,
  notificado boolean default false not null,
  created_at timestamp with time zone default now() not null,
  resolved_at timestamp with time zone
);

create table if not exists public.card_sinal_diario (
  dia date not null,
  tipo text not null,
  card_id text not null,
  n integer default 0 not null,
  n_visitantes integer default 0 not null,
  n_pico integer default 0 not null,
  n_interno integer default 0 not null,
  n_suspeito integer default 0 not null,
  atualizado_em timestamp with time zone default now() not null
);

create table if not exists public.card_sinal_evento (
  dia date not null,
  hora smallint not null,
  tipo text not null,
  card_id text not null,
  visitante character(16) not null,
  origem smallint default 0 not null
);

create table if not exists public.card_sinal_quota (
  dia date not null,
  linhas integer default 0 not null
);

create table if not exists public.card_ultima_venda_historico (
  id bigint generated always as identity not null,
  card_id text not null,
  valor_cents integer not null,
  variante text,
  condicao text,
  idioma text,
  capturado_em timestamp with time zone default now() not null
);

create table if not exists public.card_validation_review (
  id bigint generated always as identity not null,
  card_id text not null,
  fonte text not null,
  campo text not null,
  valor_atual text,
  valor_fonte text,
  motivo text,
  criado_em timestamp with time zone default now() not null,
  resolvido boolean default false not null,
  resolvido_como text,
  resolvido_em timestamp with time zone,
  resolvido_por uuid
);

create table if not exists public.collection (
  id uuid default gen_random_uuid() not null,
  card_name text,
  quantidade integer,
  tipo text,
  created_at timestamp without time zone default now()
);

create table if not exists public.conteudo_checklist (
  chave text not null,
  feito boolean default false not null,
  atualizado_em timestamp with time zone default now() not null
);

create table if not exists public.conteudo_config (
  chave text not null,
  valor text not null,
  atualizado_em timestamp with time zone default now() not null
);

create table if not exists public.conteudo_fila (
  id uuid default gen_random_uuid() not null,
  pilar text,
  formato text,
  gancho text,
  observacao text,
  status text default 'rascunho'::text not null,
  ordem integer,
  postado_em timestamp with time zone,
  criado_em timestamp with time zone default now() not null,
  atualizado_em timestamp with time zone default now() not null
);

create table if not exists public.conteudo_posts (
  id uuid default gen_random_uuid() not null,
  data date not null,
  pilar text,
  formato text,
  gancho text,
  observacao text,
  criado_em timestamp with time zone default now() not null
);

create table if not exists public.dedup_liga_map (
  liga_id text not null,
  cat_id text not null,
  set_id text,
  user_cards_movidos integer default 0,
  marketplace_movidos integer default 0,
  preco_copiado boolean default false,
  deletado_em timestamp with time zone,
  criado_em timestamp with time zone default now(),
  pulado_motivo text
);

create table if not exists public.dedup_liga_recuperar (
  liga_id text not null,
  cat_id_errado text,
  set_id text,
  user_cards_para_reverter integer default 0,
  motivo text,
  criado_em timestamp with time zone default now()
);

create table if not exists public.dedup_sets_backup (
  id bigint default nextval('dedup_sets_backup_id_seq'::regclass) not null,
  criado_em timestamp with time zone default now() not null,
  origem text not null,
  chave text not null,
  card_id text,
  payload jsonb not null
);

create table if not exists public.despesas_recorrentes (
  id uuid default gen_random_uuid() not null,
  nome text not null,
  categoria text not null,
  valor_mensal numeric(10,2) not null,
  dia_vencimento smallint not null,
  ativa boolean default true not null,
  observacao text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.lancamentos (
  id uuid default gen_random_uuid() not null,
  tipo text not null,
  valor_bruto numeric(10,2) not null,
  taxa numeric(10,2) default 0 not null,
  valor_liquido numeric(10,2) not null,
  descricao text not null,
  categoria text not null,
  data_competencia date not null,
  data_liquidacao date,
  pago boolean default false not null,
  recebido boolean default false not null,
  fonte text default 'manual'::text not null,
  despesa_recorrente_id uuid,
  stripe_payment_intent_id text,
  user_id uuid,
  observacao text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  detalhes jsonb
);

create table if not exists public.liga_editions_master (
  edid integer not null,
  ed_code text not null,
  name text not null,
  year integer not null,
  symbol_url text,
  cataloged_at timestamp with time zone default now() not null,
  cards_total_at_liga integer,
  cards_in_bynx integer
);

create table if not exists public.liga_scan_estado (
  id integer default 1 not null,
  bloqueado_ate timestamp with time zone,
  motivo text,
  atualizado_em timestamp with time zone default now() not null
);

create table if not exists public.liga_scan_quota (
  dia date not null,
  requisicoes integer default 0 not null
);

create table if not exists public.liga_set_edids (
  set_code text not null,
  edid integer not null,
  catalogued_in_bynx boolean default false not null,
  total_cards_bynx integer,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  set_name_full text,
  bynx_set_id text,
  regiao text
);

create table if not exists public.liga_set_mapping (
  id bigint default nextval('liga_set_mapping_id_seq'::regclass) not null,
  bynx_set_id text not null,
  bynx_set_name text,
  bynx_year integer,
  liga_ed_code text,
  liga_edid integer,
  liga_set_name text,
  confidence text default 'medium'::text not null,
  action text default 'pending'::text not null,
  notes text,
  last_run_at timestamp with time zone,
  last_run_result jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.loja_cliques (
  id uuid default gen_random_uuid() not null,
  loja_id uuid not null,
  tipo text not null,
  user_id uuid,
  user_agent text,
  referrer text,
  ip text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.loja_eventos (
  id uuid default gen_random_uuid() not null,
  loja_id uuid not null,
  titulo text not null,
  tipo text default 'outro'::text not null,
  data_inicio timestamp with time zone not null,
  data_fim timestamp with time zone,
  recorrencia text default 'nenhuma'::text not null,
  recorrencia_fim timestamp with time zone,
  local text,
  descricao text,
  link text,
  banner text,
  status text default 'rascunho'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.loja_produtos (
  id uuid default gen_random_uuid() not null,
  loja_id uuid not null,
  tipo text not null,
  nome text not null,
  descricao text,
  preco_cents integer not null,
  estoque integer default 1 not null,
  vendidos integer default 0 not null,
  fotos text[] default '{}'::text[] not null,
  ativo boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  peso_g integer,
  idioma text default 'pt'::text not null
);

create table if not exists public.lojas (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  nome text not null,
  descricao text,
  whatsapp text,
  email text,
  website text,
  instagram text,
  facebook text,
  cidade text not null,
  estado text not null,
  endereco text,
  tipo text default 'online'::text not null,
  especialidades text[] default ARRAY[]::text[],
  plano text default 'basico'::text not null,
  plano_expira_em timestamp with time zone,
  stripe_subscription_id text,
  stripe_customer_id text,
  status text default 'pendente'::text not null,
  verificada boolean default false not null,
  motivo_suspensao text,
  logo_url text,
  fotos text[] default ARRAY[]::text[],
  meta_title text,
  meta_description text,
  eventos jsonb default '[]'::jsonb not null,
  visualizacoes integer default 0 not null,
  cliques_whatsapp integer default 0 not null,
  owner_user_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  suspensao_motivo text,
  suspensao_data timestamp with time zone,
  suspenso_por uuid,
  aprovada_data timestamp with time zone,
  aprovada_por uuid,
  trial_usado_em timestamp with time zone,
  stripe_connect_account_id text,
  stripe_connect_status text default 'nao_iniciado'::text not null,
  connect_charges_enabled boolean default false not null,
  connect_payouts_enabled boolean default false not null,
  connect_requirements jsonb,
  connect_onboarded_em timestamp with time zone,
  repasse_prazo integer default 30 not null,
  frete_cents integer default 0 not null,
  frete_gratis_acima_cents integer,
  cep text,
  frete_modo text default 'fixo'::text not null,
  verificacao_ticket_id uuid,
  capa_url text
);

create table if not exists public.marketplace (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  card_id text,
  card_name text,
  card_image text,
  price numeric,
  created_at timestamp without time zone default now(),
  status text default 'disponivel'::text,
  variante text default 'normal'::text,
  condicao text default 'NM'::text,
  buyer_id uuid,
  descricao text,
  card_link text,
  removido_em timestamp with time zone,
  removido_motivo text,
  removido_por uuid,
  fotos jsonb,
  graduada boolean default false not null,
  graduadora text,
  nota numeric,
  black_label boolean default false not null,
  cert_graduacao text,
  subnotas jsonb,
  idioma text default 'pt'::text not null
);

create table if not exists public.marketplace_mensagens (
  id uuid default gen_random_uuid() not null,
  anuncio_id uuid not null,
  sender_id uuid not null,
  body text not null,
  created_at timestamp with time zone default now() not null,
  read_at timestamp with time zone,
  oculta boolean default false not null,
  email_nao_lida_enviada boolean default false not null
);

create table if not exists public.master_set_requests (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  texto text not null,
  status text default 'novo'::text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.master_sets (
  set_id text not null,
  nome text not null,
  series text,
  release_date text,
  preco_centavos integer default 999 not null,
  ativo boolean default true not null,
  ordem integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  card_source text default 'official'::text not null
);

create table if not exists public.mensagens_moderacao (
  id uuid default gen_random_uuid() not null,
  msg_id uuid,
  anuncio_id uuid,
  autor_id uuid,
  body_original text,
  acao text not null,
  moderador text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.ml_afiliado_links (
  chave text not null,
  url text not null,
  titulo text,
  subtitulo text,
  ativo boolean default true not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.ml_afiliado_produtos (
  id bigint generated always as identity not null,
  ml_id text,
  chave text default 'default'::text not null,
  titulo text not null,
  preco text default ''::text not null,
  imagem_url text not null,
  url text not null,
  ordem integer default 0 not null,
  ativo boolean default true not null,
  last_seen_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  link_manual boolean default false not null,
  produto_codigo text
);

create table if not exists public.monthly_ranking_snapshots (
  id uuid default gen_random_uuid() not null,
  period_year integer not null,
  period_month integer not null,
  user_id uuid not null,
  "position" integer not null,
  qualified_referrals_count integer default 0 not null,
  points_earned_in_period integer default 0 not null,
  prize_awarded text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.mypcards_card_map (
  bynx_card_id text not null,
  mypcards_product_id integer not null,
  mypcards_url text not null,
  mypcards_setcode text,
  matched_as text,
  criado_em timestamp with time zone default now() not null,
  atualizado_em timestamp with time zone default now() not null
);

create table if not exists public.notifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  type text not null,
  title text not null,
  message text not null,
  read boolean default false,
  data jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.pasta_cards (
  pasta_id uuid not null,
  user_card_id uuid not null,
  added_at timestamp with time zone default now() not null,
  posicao integer
);

create table if not exists public.pastas (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  nome text not null,
  descricao text,
  imagem_url text,
  publico boolean default false not null,
  destaque boolean default false not null,
  locked boolean default false not null,
  view_mode text default 'grid'::text not null,
  ordem integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.pedido_itens (
  id uuid default gen_random_uuid() not null,
  pedido_id uuid not null,
  marketplace_id uuid,
  produto_id uuid,
  nome text not null,
  imagem text,
  tipo text default 'carta'::text not null,
  preco_cents integer not null,
  quantidade integer default 1 not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.pedidos (
  id uuid default gen_random_uuid() not null,
  numero bigint default nextval('pedidos_numero_seq'::regclass) not null,
  loja_id uuid not null,
  vendedor_user_id uuid not null,
  comprador_user_id uuid not null,
  marketplace_id uuid,
  item_nome text not null,
  item_imagem text,
  item_card_id text,
  valor_item_cents integer not null,
  frete_cents integer default 0 not null,
  acrescimo_cents integer default 0 not null,
  total_comprador_cents integer not null,
  comissao_bynx_cents integer default 0 not null,
  liquido_loja_cents integer default 0 not null,
  metodo text not null,
  repasse_prazo integer not null,
  stripe_session_id text,
  stripe_payment_intent_id text,
  stripe_connect_account_id text,
  status text default 'aguardando_pagamento'::text not null,
  endereco jsonb,
  rastreio text,
  pago_em timestamp with time zone,
  enviado_em timestamp with time zone,
  entregue_em timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  produto_id uuid,
  cancelado_em timestamp with time zone,
  cancelamento_motivo text,
  cancelado_por text,
  stripe_refund_id text
);

create table if not exists public.point_redemptions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  reward_id uuid not null,
  cost_points integer not null,
  status text default 'pending'::text not null,
  fulfilled_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.points_ledger (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  amount integer not null,
  reason text not null,
  related_referral_id uuid,
  related_redemption_id uuid,
  balance_after integer not null,
  notes text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.pokemon_cards_all (
  id text not null,
  name text not null,
  number text,
  rarity text,
  artist text,
  image_small text,
  image_large text,
  set_id text,
  set_name text,
  set_series text,
  set_release_date text,
  set_total integer,
  set_logo text,
  set_symbol text,
  hp integer,
  types text[],
  supertype text,
  subtypes text[],
  attacks jsonb,
  weaknesses jsonb,
  resistances jsonb,
  retreat_cost text[],
  flavor_text text,
  legalities jsonb,
  price_usd_normal numeric(10,2),
  price_usd_holofoil numeric(10,2),
  price_usd_reverse numeric(10,2),
  price_usd_1st_edition numeric(10,2),
  price_eur_normal numeric(10,2),
  price_eur_holofoil numeric(10,2),
  price_eur_reverse numeric(10,2),
  liga_cid integer,
  liga_link text,
  preco_normal numeric(10,2),
  preco_foil numeric(10,2),
  preco_promo numeric(10,2),
  preco_reverse numeric(10,2),
  preco_pokeball numeric(10,2),
  preco_min numeric(10,2),
  preco_medio numeric(10,2),
  preco_max numeric(10,2),
  preco_foil_min numeric(10,2),
  preco_foil_medio numeric(10,2),
  preco_foil_max numeric(10,2),
  preco_promo_min numeric(10,2),
  preco_promo_medio numeric(10,2),
  preco_promo_max numeric(10,2),
  preco_reverse_min numeric(10,2),
  preco_reverse_medio numeric(10,2),
  preco_reverse_max numeric(10,2),
  tcg_updated_at timestamp with time zone,
  liga_updated_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  preco_pokeball_min numeric(10,2),
  preco_pokeball_medio numeric(10,2),
  preco_pokeball_max numeric(10,2),
  base_pokemon_names text[],
  outras_variantes jsonb,
  excluded_from_scan boolean default false not null,
  excluded_reason text,
  excluded_at timestamp with time zone,
  number_norm text generated always as (COALESCE(NULLIF(regexp_replace(lower(number), '0*([0-9]+)'::text, '\1'::text, 'g'::text), ''::text), NULLIF(regexp_replace(lower(COALESCE("substring"(name, '\(([0-9]+)/[0-9]+\)'::text), ''::text)), '0*([0-9]+)'::text, '\1'::text, 'g'::text), ''::text))) stored,
  is_canary boolean default false not null,
  regiao text,
  slug text,
  idioma text default 'en'::text not null,
  liga_last_attempt_at timestamp with time zone,
  liga_fail_streak integer default 0 not null,
  name_pt text,
  set_name_pt text,
  oculto boolean default false not null,
  ultima_venda_cents integer,
  ultima_venda_variante text,
  ultima_venda_condicao text,
  ultima_venda_idioma text,
  ultima_venda_atualizado_em timestamp with time zone,
  liga_range_min numeric,
  liga_range_max numeric
);

create table if not exists public.pokemon_pokedex (
  slug text not null,
  name text not null,
  national_dex integer,
  name_pt text,
  primary_type text,
  cards_count integer default 0 not null,
  sets_count integer default 0 not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.pokemon_sets (
  id text not null,
  name text not null,
  series text,
  total integer,
  printed_total integer,
  logo_url text,
  symbol_url text,
  release_date text,
  name_pt text,
  name_pt2 text,
  regiao text
);

create table if not exists public.pokemon_species (
  dex_id integer not null,
  name_en text not null,
  name_pt text
);

create table if not exists public.portfolio_history (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  valor numeric(10,2) not null,
  recorded_at date default CURRENT_DATE not null
);

create table if not exists public.price_history (
  id bigint default nextval('price_history_id_seq'::regclass) not null,
  card_id text not null,
  preco_normal numeric(10,2),
  preco_min numeric(10,2),
  preco_max numeric(10,2),
  preco_medio numeric(10,2),
  preco_foil numeric(10,2),
  preco_reverse numeric(10,2),
  source text default 'liga_scan'::text not null,
  recorded_at timestamp with time zone default now() not null
);

create table if not exists public.price_snapshots (
  id bigint generated always as identity not null,
  card_id text not null,
  snapshot_date date default CURRENT_DATE not null,
  preco_min numeric,
  preco_medio numeric,
  preco_max numeric,
  source text default 'daily_cron'::text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.price_snapshots_quarentena (
  id bigint not null,
  card_id text not null,
  snapshot_date date not null,
  preco_min numeric,
  preco_medio numeric,
  preco_max numeric,
  source text,
  created_at timestamp with time zone,
  mediana_da_carta numeric,
  fator numeric,
  motivo text,
  quarentenado_em timestamp with time zone default now() not null
);

create table if not exists public.prices (
  id uuid default gen_random_uuid() not null,
  card_name text,
  preco_normal numeric,
  preco_foil numeric,
  created_at timestamp without time zone default now()
);

create table if not exists public.referrals (
  id uuid default gen_random_uuid() not null,
  referrer_user_id uuid not null,
  referred_user_id uuid not null,
  referral_code text not null,
  status text default 'cadastrou'::text not null,
  signup_ip text,
  signup_fingerprint text,
  signup_user_agent text,
  is_suspicious boolean default false not null,
  cadastrou_at timestamp with time zone default now() not null,
  ativou_at timestamp with time zone,
  engajou_at timestamp with time zone
);

create table if not exists public.rewards (
  id uuid default gen_random_uuid() not null,
  sku text not null,
  title text not null,
  description text,
  cost_points integer not null,
  reward_type text not null,
  reward_payload jsonb default '{}'::jsonb not null,
  stock integer,
  active boolean default true not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.set_aliases (
  alias text not null,
  set_id text not null,
  source text default 'ligapokemon'::text
);

create table if not exists public.set_id_colisao (
  set_id text not null,
  cartas_catalogo integer,
  cartas_liga integer,
  set_catalogo text,
  numeracao_liga text,
  acao_sugerida text,
  criado_em timestamp with time zone default now()
);

create table if not exists public.stripe_events_processed (
  event_id text not null,
  event_type text not null,
  livemode boolean not null,
  processed_at timestamp with time zone default now() not null,
  user_id uuid,
  loja_id uuid,
  result text,
  error_message text
);

create table if not exists public.ticket_anexos (
  id uuid default gen_random_uuid() not null,
  ticket_id uuid not null,
  path text not null,
  nome text not null,
  mime text not null,
  tamanho integer not null,
  enviado_por text not null,
  user_id uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.ticket_messages (
  id uuid default gen_random_uuid() not null,
  ticket_id uuid not null,
  sender_type text not null,
  sender_id uuid,
  content text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.tickets (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  subject text not null,
  status text default 'open'::text not null,
  priority text default 'normal'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  last_message_at timestamp with time zone default now() not null
);

create table if not exists public.trade_comparisons (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  mostrar_usuario boolean default false not null,
  lado_a jsonb not null,
  lado_b jsonb not null,
  total_a numeric(10,2) not null,
  total_b numeric(10,2) not null,
  pct numeric(6,2) not null,
  veredito text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.transactions (
  id uuid default gen_random_uuid() not null,
  buyer_id uuid,
  seller_id uuid,
  card_name text,
  price numeric,
  created_at timestamp without time zone default now()
);

create table if not exists public.user_cards (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  card_id text,
  card_name text,
  card_image text,
  created_at timestamp without time zone default now(),
  card_link text,
  rarity text,
  type text,
  quantity integer default 1,
  pokemon_api_id text,
  matched_score numeric,
  variante text default 'normal'::text,
  set_id text,
  set_name text,
  condicoes jsonb,
  graduada boolean default false not null,
  graduadora text,
  nota numeric,
  black_label boolean default false not null,
  cert_graduacao text,
  subnotas jsonb,
  valor_graduada numeric,
  idioma text default 'pt'::text not null
);

create table if not exists public.user_cards_backup_20260801 (
  id uuid,
  user_id uuid,
  card_id text,
  card_name text,
  card_image text,
  created_at timestamp without time zone,
  card_link text,
  rarity text,
  type text,
  quantity integer,
  pokemon_api_id text,
  matched_score numeric,
  variante text,
  set_id text,
  set_name text,
  condicoes jsonb,
  graduada boolean,
  graduadora text,
  nota numeric,
  black_label boolean,
  cert_graduacao text,
  subnotas jsonb,
  valor_graduada numeric,
  idioma text
);

create table if not exists public.user_master_sets (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  set_id text not null,
  unlocked_at timestamp with time zone default now() not null,
  source text default 'stripe'::text not null,
  stripe_payment_intent_id text
);

create table if not exists public.user_paginas_lendarias (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  pagina_id text not null,
  source text default 'stripe'::text not null,
  stripe_payment_intent_id text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.users (
  id uuid not null,
  name text not null,
  email text not null,
  cpf text,
  city text,
  whatsapp text,
  created_at timestamp without time zone default now(),
  is_pro boolean default false,
  plano text default 'free'::text,
  stripe_customer_id text,
  stripe_subscription_id text,
  pro_expira_em timestamp with time zone,
  username text,
  username_changed_at timestamp with time zone,
  trial_expires_at timestamp with time zone,
  separadores_desbloqueado boolean default false,
  scan_creditos integer default 0,
  suspended_at timestamp with time zone,
  suspended_reason text,
  data_nascimento date,
  termos_aceitos_em timestamp with time zone,
  marketing_aceito boolean default false,
  referral_code text,
  referred_by_user_id uuid,
  points_balance integer default 0 not null,
  points_earned_total integer default 0 not null,
  referral_signup_ip text,
  referral_signup_fingerprint text,
  referral_trust_suspended boolean default false not null,
  perfil_publico boolean default true not null,
  perfil_ocultar_valores boolean default false not null,
  last_seen_at timestamp with time zone,
  perfil_mostrar_pastas boolean default true not null,
  scan_mensal_usados integer default 0,
  scan_mensal_reset timestamp with time zone,
  instagram text,
  tiktok text,
  reconfirmar_email boolean default false not null,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  uf text,
  email_optout_nurture boolean default false not null,
  unsubscribe_token uuid default gen_random_uuid(),
  signup_utm_source text,
  signup_utm_medium text,
  signup_utm_campaign text,
  signup_utm_content text,
  signup_utm_term text,
  signup_referrer text,
  signup_landing_page text,
  signup_first_seen_at timestamp with time zone,
  signup_last_utm_source text,
  signup_last_utm_medium text,
  signup_last_utm_campaign text
);

create table if not exists public.watchlist (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  card_id text not null,
  target_price numeric,
  target_type text,
  created_at timestamp with time zone default now() not null
);

-- ownership das sequences nextval() (no-op se ja estiver)
alter sequence public.dedup_sets_backup_id_seq owned by public.dedup_sets_backup.id;
alter sequence public.liga_set_mapping_id_seq owned by public.liga_set_mapping.id;
alter sequence public.pedidos_numero_seq owned by public.pedidos.numero;
alter sequence public.price_history_id_seq owned by public.price_history.id;


-- ============================================================
-- 4b. CONSTRAINTS: PK / UNIQUE / CHECK
-- ============================================================
do $$ begin
  if not exists (select 1 from pg_constraint where conname='avaliacoes_estrelas_check' and conrelid='public.avaliacoes'::regclass) then
    alter table public.avaliacoes add constraint avaliacoes_estrelas_check CHECK (((estrelas >= 1) AND (estrelas <= 5)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='avaliacoes_pkey' and conrelid='public.avaliacoes'::regclass) then
    alter table public.avaliacoes add constraint avaliacoes_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='avaliacoes_marketplace_id_avaliador_id_key' and conrelid='public.avaliacoes'::regclass) then
    alter table public.avaliacoes add constraint avaliacoes_marketplace_id_avaliador_id_key UNIQUE (marketplace_id, avaliador_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='backup_precos_carta_errada_pkey' and conrelid='public.backup_precos_carta_errada'::regclass) then
    alter table public.backup_precos_carta_errada add constraint backup_precos_carta_errada_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='blog_categories_pkey' and conrelid='public.blog_categories'::regclass) then
    alter table public.blog_categories add constraint blog_categories_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='blog_categories_slug_key' and conrelid='public.blog_categories'::regclass) then
    alter table public.blog_categories add constraint blog_categories_slug_key UNIQUE (slug);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='blog_posts_status_check' and conrelid='public.blog_posts'::regclass) then
    alter table public.blog_posts add constraint blog_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='blog_posts_pkey' and conrelid='public.blog_posts'::regclass) then
    alter table public.blog_posts add constraint blog_posts_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='blog_posts_slug_key' and conrelid='public.blog_posts'::regclass) then
    alter table public.blog_posts add constraint blog_posts_slug_key UNIQUE (slug);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='busca_glossario_pkey' and conrelid='public.busca_glossario'::regclass) then
    alter table public.busca_glossario add constraint busca_glossario_pkey PRIMARY KEY (pt);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='chk_cp_idioma' and conrelid='public.card_precos'::regclass) then
    alter table public.card_precos add constraint chk_cp_idioma CHECK ((idioma = ANY (ARRAY['pt'::text, 'en'::text, 'es'::text, 'fr'::text, 'de'::text, 'it'::text, 'jp'::text, 'cn'::text, 'kr'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='chk_cp_variante' and conrelid='public.card_precos'::regclass) then
    alter table public.card_precos add constraint chk_cp_variante CHECK ((variante = ANY (ARRAY['normal'::text, 'foil'::text, 'reverse'::text, 'promo'::text, 'textless'::text, 'shattered'::text, 'pokeball_foil'::text, 'master_ball_foil'::text, 'edition_one'::text, 'pre_release'::text, 'staff'::text, 'shadowless'::text, 'oversize'::text, 'misprint'::text, 'assinada'::text, 'alterada'::text, 'other'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_precos_pkey' and conrelid='public.card_precos'::regclass) then
    alter table public.card_precos add constraint card_precos_pkey PRIMARY KEY (card_id, idioma, variante);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_requests_erro_tipo_check' and conrelid='public.card_requests'::regclass) then
    alter table public.card_requests add constraint card_requests_erro_tipo_check CHECK ((erro_tipo = ANY (ARRAY['nome'::text, 'valor'::text, 'imagem'::text, 'outro'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_requests_origem_check' and conrelid='public.card_requests'::regclass) then
    alter table public.card_requests add constraint card_requests_origem_check CHECK ((origem = ANY (ARRAY['form'::text, 'auto'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_requests_status_check' and conrelid='public.card_requests'::regclass) then
    alter table public.card_requests add constraint card_requests_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'em_analise'::text, 'adicionada'::text, 'rejeitada'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_requests_tipo_check' and conrelid='public.card_requests'::regclass) then
    alter table public.card_requests add constraint card_requests_tipo_check CHECK ((tipo = ANY (ARRAY['faltando'::text, 'erro'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_requests_pkey' and conrelid='public.card_requests'::regclass) then
    alter table public.card_requests add constraint card_requests_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_sinal_diario_pk' and conrelid='public.card_sinal_diario'::regclass) then
    alter table public.card_sinal_diario add constraint card_sinal_diario_pk PRIMARY KEY (dia, tipo, card_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_sinal_evento_hora_ck' and conrelid='public.card_sinal_evento'::regclass) then
    alter table public.card_sinal_evento add constraint card_sinal_evento_hora_ck CHECK (((hora >= 0) AND (hora <= 23)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_sinal_evento_origem_ck' and conrelid='public.card_sinal_evento'::regclass) then
    alter table public.card_sinal_evento add constraint card_sinal_evento_origem_ck CHECK (((origem >= 0) AND (origem <= 3)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_sinal_evento_tipo_ck' and conrelid='public.card_sinal_evento'::regclass) then
    alter table public.card_sinal_evento add constraint card_sinal_evento_tipo_ck CHECK ((tipo = ANY (ARRAY['view_pub'::text, 'view_app'::text, 'busca_troca'::text, 'busca_colecao'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_sinal_evento_vis_ck' and conrelid='public.card_sinal_evento'::regclass) then
    alter table public.card_sinal_evento add constraint card_sinal_evento_vis_ck CHECK ((visitante ~ '^[0-9a-f]{16}$'::text));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_sinal_evento_pk' and conrelid='public.card_sinal_evento'::regclass) then
    alter table public.card_sinal_evento add constraint card_sinal_evento_pk PRIMARY KEY (dia, hora, tipo, card_id, visitante);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_sinal_quota_pkey' and conrelid='public.card_sinal_quota'::regclass) then
    alter table public.card_sinal_quota add constraint card_sinal_quota_pkey PRIMARY KEY (dia);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_ultima_venda_historico_valor_cents_check' and conrelid='public.card_ultima_venda_historico'::regclass) then
    alter table public.card_ultima_venda_historico add constraint card_ultima_venda_historico_valor_cents_check CHECK ((valor_cents >= 0));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_ultima_venda_historico_pkey' and conrelid='public.card_ultima_venda_historico'::regclass) then
    alter table public.card_ultima_venda_historico add constraint card_ultima_venda_historico_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_validation_review_pkey' and conrelid='public.card_validation_review'::regclass) then
    alter table public.card_validation_review add constraint card_validation_review_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='collection_pkey' and conrelid='public.collection'::regclass) then
    alter table public.collection add constraint collection_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='conteudo_checklist_pkey' and conrelid='public.conteudo_checklist'::regclass) then
    alter table public.conteudo_checklist add constraint conteudo_checklist_pkey PRIMARY KEY (chave);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='conteudo_config_pkey' and conrelid='public.conteudo_config'::regclass) then
    alter table public.conteudo_config add constraint conteudo_config_pkey PRIMARY KEY (chave);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='conteudo_fila_status_check' and conrelid='public.conteudo_fila'::regclass) then
    alter table public.conteudo_fila add constraint conteudo_fila_status_check CHECK ((status = ANY (ARRAY['rascunho'::text, 'pronto'::text, 'postado'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='conteudo_fila_pkey' and conrelid='public.conteudo_fila'::regclass) then
    alter table public.conteudo_fila add constraint conteudo_fila_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='conteudo_posts_pkey' and conrelid='public.conteudo_posts'::regclass) then
    alter table public.conteudo_posts add constraint conteudo_posts_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='dedup_liga_map_pkey' and conrelid='public.dedup_liga_map'::regclass) then
    alter table public.dedup_liga_map add constraint dedup_liga_map_pkey PRIMARY KEY (liga_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='dedup_liga_recuperar_pkey' and conrelid='public.dedup_liga_recuperar'::regclass) then
    alter table public.dedup_liga_recuperar add constraint dedup_liga_recuperar_pkey PRIMARY KEY (liga_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='dedup_sets_backup_pkey' and conrelid='public.dedup_sets_backup'::regclass) then
    alter table public.dedup_sets_backup add constraint dedup_sets_backup_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='despesas_recorrentes_categoria_check' and conrelid='public.despesas_recorrentes'::regclass) then
    alter table public.despesas_recorrentes add constraint despesas_recorrentes_categoria_check CHECK ((categoria = ANY (ARRAY['infra'::text, 'marketing'::text, 'dominio'::text, 'pagamentos'::text, 'impostos'::text, 'outros'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='despesas_recorrentes_dia_vencimento_check' and conrelid='public.despesas_recorrentes'::regclass) then
    alter table public.despesas_recorrentes add constraint despesas_recorrentes_dia_vencimento_check CHECK (((dia_vencimento >= 1) AND (dia_vencimento <= 31)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='despesas_recorrentes_valor_mensal_check' and conrelid='public.despesas_recorrentes'::regclass) then
    alter table public.despesas_recorrentes add constraint despesas_recorrentes_valor_mensal_check CHECK ((valor_mensal >= (0)::numeric));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='despesas_recorrentes_pkey' and conrelid='public.despesas_recorrentes'::regclass) then
    alter table public.despesas_recorrentes add constraint despesas_recorrentes_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lancamentos_categoria_check' and conrelid='public.lancamentos'::regclass) then
    alter table public.lancamentos add constraint lancamentos_categoria_check CHECK ((categoria = ANY (ARRAY['infra'::text, 'marketing'::text, 'dominio'::text, 'pagamentos'::text, 'impostos'::text, 'assinatura'::text, 'comissao'::text, 'master_set'::text, 'outros'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lancamentos_fonte_check' and conrelid='public.lancamentos'::regclass) then
    alter table public.lancamentos add constraint lancamentos_fonte_check CHECK ((fonte = ANY (ARRAY['manual'::text, 'stripe'::text, 'outro'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lancamentos_taxa_check' and conrelid='public.lancamentos'::regclass) then
    alter table public.lancamentos add constraint lancamentos_taxa_check CHECK ((taxa >= (0)::numeric));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lancamentos_tipo_check' and conrelid='public.lancamentos'::regclass) then
    alter table public.lancamentos add constraint lancamentos_tipo_check CHECK ((tipo = ANY (ARRAY['despesa'::text, 'receita'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lancamentos_valor_bruto_check' and conrelid='public.lancamentos'::regclass) then
    alter table public.lancamentos add constraint lancamentos_valor_bruto_check CHECK ((valor_bruto >= (0)::numeric));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lancamentos_valor_liquido_check' and conrelid='public.lancamentos'::regclass) then
    alter table public.lancamentos add constraint lancamentos_valor_liquido_check CHECK ((valor_liquido >= (0)::numeric));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lancamentos_pkey' and conrelid='public.lancamentos'::regclass) then
    alter table public.lancamentos add constraint lancamentos_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='liga_editions_master_pkey' and conrelid='public.liga_editions_master'::regclass) then
    alter table public.liga_editions_master add constraint liga_editions_master_pkey PRIMARY KEY (edid);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='liga_editions_master_ed_code_key' and conrelid='public.liga_editions_master'::regclass) then
    alter table public.liga_editions_master add constraint liga_editions_master_ed_code_key UNIQUE (ed_code);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='liga_scan_estado_id_check' and conrelid='public.liga_scan_estado'::regclass) then
    alter table public.liga_scan_estado add constraint liga_scan_estado_id_check CHECK ((id = 1));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='liga_scan_estado_pkey' and conrelid='public.liga_scan_estado'::regclass) then
    alter table public.liga_scan_estado add constraint liga_scan_estado_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='liga_scan_quota_pkey' and conrelid='public.liga_scan_quota'::regclass) then
    alter table public.liga_scan_quota add constraint liga_scan_quota_pkey PRIMARY KEY (dia);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='chk_edids_regiao' and conrelid='public.liga_set_edids'::regclass) then
    alter table public.liga_set_edids add constraint chk_edids_regiao CHECK ((regiao = ANY (ARRAY['ocidental'::text, 'jp'::text, 'cn'::text, 'kr'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='liga_set_edids_pkey' and conrelid='public.liga_set_edids'::regclass) then
    alter table public.liga_set_edids add constraint liga_set_edids_pkey PRIMARY KEY (set_code);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='liga_set_mapping_action_check' and conrelid='public.liga_set_mapping'::regclass) then
    alter table public.liga_set_mapping add constraint liga_set_mapping_action_check CHECK ((action = ANY (ARRAY['pending'::text, 'auto'::text, 'manual'::text, 'skip'::text, 'done'::text, 'failed'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='liga_set_mapping_confidence_check' and conrelid='public.liga_set_mapping'::regclass) then
    alter table public.liga_set_mapping add constraint liga_set_mapping_confidence_check CHECK ((confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text, 'manual_only'::text, 'skip'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='liga_set_mapping_pkey' and conrelid='public.liga_set_mapping'::regclass) then
    alter table public.liga_set_mapping add constraint liga_set_mapping_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='liga_set_mapping_bynx_set_id_key' and conrelid='public.liga_set_mapping'::regclass) then
    alter table public.liga_set_mapping add constraint liga_set_mapping_bynx_set_id_key UNIQUE (bynx_set_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_cliques_tipo_check' and conrelid='public.loja_cliques'::regclass) then
    alter table public.loja_cliques add constraint loja_cliques_tipo_check CHECK ((tipo = ANY (ARRAY['whatsapp'::text, 'instagram'::text, 'facebook'::text, 'website'::text, 'maps'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_cliques_pkey' and conrelid='public.loja_cliques'::regclass) then
    alter table public.loja_cliques add constraint loja_cliques_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_eventos_recorrencia_check' and conrelid='public.loja_eventos'::regclass) then
    alter table public.loja_eventos add constraint loja_eventos_recorrencia_check CHECK ((recorrencia = ANY (ARRAY['nenhuma'::text, 'semanal'::text, 'quinzenal'::text, 'mensal'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_eventos_status_check' and conrelid='public.loja_eventos'::regclass) then
    alter table public.loja_eventos add constraint loja_eventos_status_check CHECK ((status = ANY (ARRAY['rascunho'::text, 'publicado'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_eventos_tipo_check' and conrelid='public.loja_eventos'::regclass) then
    alter table public.loja_eventos add constraint loja_eventos_tipo_check CHECK ((tipo = ANY (ARRAY['torneio'::text, 'liga'::text, 'pre_lancamento'::text, 'encontro'::text, 'outro'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_eventos_pkey' and conrelid='public.loja_eventos'::regclass) then
    alter table public.loja_eventos add constraint loja_eventos_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='chk_lp_idioma' and conrelid='public.loja_produtos'::regclass) then
    alter table public.loja_produtos add constraint chk_lp_idioma CHECK ((idioma = ANY (ARRAY['pt'::text, 'en'::text, 'es'::text, 'fr'::text, 'de'::text, 'it'::text, 'jp'::text, 'cn'::text, 'kr'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_produtos_descricao_check' and conrelid='public.loja_produtos'::regclass) then
    alter table public.loja_produtos add constraint loja_produtos_descricao_check CHECK (((descricao IS NULL) OR (length(descricao) <= 1000)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_produtos_estoque_check' and conrelid='public.loja_produtos'::regclass) then
    alter table public.loja_produtos add constraint loja_produtos_estoque_check CHECK ((estoque >= 0));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_produtos_nome_check' and conrelid='public.loja_produtos'::regclass) then
    alter table public.loja_produtos add constraint loja_produtos_nome_check CHECK (((length(TRIM(BOTH FROM nome)) >= 2) AND (length(TRIM(BOTH FROM nome)) <= 120)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_produtos_preco_cents_check' and conrelid='public.loja_produtos'::regclass) then
    alter table public.loja_produtos add constraint loja_produtos_preco_cents_check CHECK (((preco_cents > 0) AND (preco_cents <= 5000000)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_produtos_tipo_check' and conrelid='public.loja_produtos'::regclass) then
    alter table public.loja_produtos add constraint loja_produtos_tipo_check CHECK ((tipo = ANY (ARRAY['selado'::text, 'pelucia'::text, 'funko'::text, 'fichario'::text, 'acessorio'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_produtos_vendidos_check' and conrelid='public.loja_produtos'::regclass) then
    alter table public.loja_produtos add constraint loja_produtos_vendidos_check CHECK ((vendidos >= 0));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_produtos_pkey' and conrelid='public.loja_produtos'::regclass) then
    alter table public.loja_produtos add constraint loja_produtos_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_connect_status_chk' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_connect_status_chk CHECK ((stripe_connect_status = ANY (ARRAY['nao_iniciado'::text, 'pendente'::text, 'em_analise'::text, 'ativo'::text, 'restrito'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_estado_check' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_estado_check CHECK ((estado ~ '^[A-Z]{2}$'::text));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_frete_chk' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_frete_chk CHECK (((frete_cents >= 0) AND (frete_cents <= 20000)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_frete_modo_chk' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_frete_modo_chk CHECK ((frete_modo = ANY (ARRAY['fixo'::text, 'calculado'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_nome_check' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_nome_check CHECK ((length(TRIM(BOTH FROM nome)) >= 2));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_plano_check' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_plano_check CHECK ((plano = ANY (ARRAY['basico'::text, 'pro'::text, 'premium'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_repasse_prazo_chk' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_repasse_prazo_chk CHECK ((repasse_prazo = ANY (ARRAY[14, 30])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_slug_check' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_slug_check CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((length(slug) >= 3) AND (length(slug) <= 60))));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_status_check' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'ativa'::text, 'suspensa'::text, 'inativa'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_tipo_check' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_tipo_check CHECK ((tipo = ANY (ARRAY['fisica'::text, 'online'::text, 'ambas'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_pkey' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_slug_key' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_slug_key UNIQUE (slug);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='chk_mk_idioma' and conrelid='public.marketplace'::regclass) then
    alter table public.marketplace add constraint chk_mk_idioma CHECK ((idioma = ANY (ARRAY['pt'::text, 'en'::text, 'es'::text, 'fr'::text, 'de'::text, 'it'::text, 'jp'::text, 'cn'::text, 'kr'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='marketplace_fotos_is_array' and conrelid='public.marketplace'::regclass) then
    alter table public.marketplace add constraint marketplace_fotos_is_array CHECK (((fotos IS NULL) OR (jsonb_typeof(fotos) = 'array'::text)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='price_positive' and conrelid='public.marketplace'::regclass) then
    alter table public.marketplace add constraint price_positive CHECK ((price > (0)::numeric));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='marketplace_pkey' and conrelid='public.marketplace'::regclass) then
    alter table public.marketplace add constraint marketplace_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='marketplace_mensagens_pkey' and conrelid='public.marketplace_mensagens'::regclass) then
    alter table public.marketplace_mensagens add constraint marketplace_mensagens_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='master_set_requests_pkey' and conrelid='public.master_set_requests'::regclass) then
    alter table public.master_set_requests add constraint master_set_requests_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='master_sets_pkey' and conrelid='public.master_sets'::regclass) then
    alter table public.master_sets add constraint master_sets_pkey PRIMARY KEY (set_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='mensagens_moderacao_pkey' and conrelid='public.mensagens_moderacao'::regclass) then
    alter table public.mensagens_moderacao add constraint mensagens_moderacao_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ml_afiliado_links_pkey' and conrelid='public.ml_afiliado_links'::regclass) then
    alter table public.ml_afiliado_links add constraint ml_afiliado_links_pkey PRIMARY KEY (chave);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ml_afiliado_produtos_pkey' and conrelid='public.ml_afiliado_produtos'::regclass) then
    alter table public.ml_afiliado_produtos add constraint ml_afiliado_produtos_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ml_afiliado_produtos_ml_id_key' and conrelid='public.ml_afiliado_produtos'::regclass) then
    alter table public.ml_afiliado_produtos add constraint ml_afiliado_produtos_ml_id_key UNIQUE (ml_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='monthly_ranking_snapshots_period_month_check' and conrelid='public.monthly_ranking_snapshots'::regclass) then
    alter table public.monthly_ranking_snapshots add constraint monthly_ranking_snapshots_period_month_check CHECK (((period_month >= 1) AND (period_month <= 12)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='monthly_ranking_snapshots_pkey' and conrelid='public.monthly_ranking_snapshots'::regclass) then
    alter table public.monthly_ranking_snapshots add constraint monthly_ranking_snapshots_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='monthly_ranking_snapshots_period_year_period_month_user_id_key' and conrelid='public.monthly_ranking_snapshots'::regclass) then
    alter table public.monthly_ranking_snapshots add constraint monthly_ranking_snapshots_period_year_period_month_user_id_key UNIQUE (period_year, period_month, user_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='mypcards_card_map_pkey' and conrelid='public.mypcards_card_map'::regclass) then
    alter table public.mypcards_card_map add constraint mypcards_card_map_pkey PRIMARY KEY (bynx_card_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='notifications_pkey' and conrelid='public.notifications'::regclass) then
    alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pasta_cards_pkey' and conrelid='public.pasta_cards'::regclass) then
    alter table public.pasta_cards add constraint pasta_cards_pkey PRIMARY KEY (pasta_id, user_card_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pastas_descricao_check' and conrelid='public.pastas'::regclass) then
    alter table public.pastas add constraint pastas_descricao_check CHECK ((char_length(descricao) <= 140));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pastas_nome_check' and conrelid='public.pastas'::regclass) then
    alter table public.pastas add constraint pastas_nome_check CHECK (((char_length(nome) >= 1) AND (char_length(nome) <= 60)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pastas_view_mode_check' and conrelid='public.pastas'::regclass) then
    alter table public.pastas add constraint pastas_view_mode_check CHECK ((view_mode = ANY (ARRAY['grid'::text, 'lista'::text, 'pasta'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pastas_pkey' and conrelid='public.pastas'::regclass) then
    alter table public.pastas add constraint pastas_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedido_itens_origem_chk' and conrelid='public.pedido_itens'::regclass) then
    alter table public.pedido_itens add constraint pedido_itens_origem_chk CHECK ((num_nonnulls(marketplace_id, produto_id) = 1));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedido_itens_preco_cents_check' and conrelid='public.pedido_itens'::regclass) then
    alter table public.pedido_itens add constraint pedido_itens_preco_cents_check CHECK ((preco_cents > 0));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedido_itens_quantidade_check' and conrelid='public.pedido_itens'::regclass) then
    alter table public.pedido_itens add constraint pedido_itens_quantidade_check CHECK (((quantidade > 0) AND (quantidade <= 99)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedido_itens_pkey' and conrelid='public.pedido_itens'::regclass) then
    alter table public.pedido_itens add constraint pedido_itens_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_acrescimo_cents_check' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_acrescimo_cents_check CHECK ((acrescimo_cents >= 0));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_comissao_bynx_cents_check' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_comissao_bynx_cents_check CHECK ((comissao_bynx_cents >= 0));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_frete_cents_check' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_frete_cents_check CHECK ((frete_cents >= 0));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_item_origem_chk' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_item_origem_chk CHECK ((num_nonnulls(marketplace_id, produto_id) <= 1));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_liquido_loja_cents_check' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_liquido_loja_cents_check CHECK ((liquido_loja_cents >= 0));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_metodo_check' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_metodo_check CHECK ((metodo = ANY (ARRAY['pix'::text, 'cartao'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_repasse_prazo_check' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_repasse_prazo_check CHECK ((repasse_prazo = ANY (ARRAY[14, 30])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_status_check' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_status_check CHECK ((status = ANY (ARRAY['aguardando_pagamento'::text, 'pago'::text, 'enviado'::text, 'entregue'::text, 'cancelado'::text, 'reembolsado'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_total_comprador_cents_check' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_total_comprador_cents_check CHECK ((total_comprador_cents > 0));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_valor_item_cents_check' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_valor_item_cents_check CHECK ((valor_item_cents > 0));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_pkey' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_numero_key' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_numero_key UNIQUE (numero);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_stripe_payment_intent_id_key' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_stripe_session_id_key' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_stripe_session_id_key UNIQUE (stripe_session_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='point_redemptions_status_check' and conrelid='public.point_redemptions'::regclass) then
    alter table public.point_redemptions add constraint point_redemptions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'fulfilled'::text, 'cancelled'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='point_redemptions_pkey' and conrelid='public.point_redemptions'::regclass) then
    alter table public.point_redemptions add constraint point_redemptions_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='points_ledger_pkey' and conrelid='public.points_ledger'::regclass) then
    alter table public.points_ledger add constraint points_ledger_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='chk_cards_regiao' and conrelid='public.pokemon_cards_all'::regclass) then
    alter table public.pokemon_cards_all add constraint chk_cards_regiao CHECK ((regiao = ANY (ARRAY['ocidental'::text, 'jp'::text, 'cn'::text, 'kr'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='chk_pc_idioma' and conrelid='public.pokemon_cards_all'::regclass) then
    alter table public.pokemon_cards_all add constraint chk_pc_idioma CHECK ((idioma = ANY (ARRAY['pt'::text, 'en'::text, 'es'::text, 'fr'::text, 'de'::text, 'it'::text, 'jp'::text, 'cn'::text, 'kr'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pokemon_cards_all_ultima_venda_cents_check' and conrelid='public.pokemon_cards_all'::regclass) then
    alter table public.pokemon_cards_all add constraint pokemon_cards_all_ultima_venda_cents_check CHECK ((ultima_venda_cents >= 0));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pokemon_cards_pkey' and conrelid='public.pokemon_cards_all'::regclass) then
    alter table public.pokemon_cards_all add constraint pokemon_cards_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pokemon_pokedex_pkey' and conrelid='public.pokemon_pokedex'::regclass) then
    alter table public.pokemon_pokedex add constraint pokemon_pokedex_pkey PRIMARY KEY (slug);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pokemon_pokedex_name_key' and conrelid='public.pokemon_pokedex'::regclass) then
    alter table public.pokemon_pokedex add constraint pokemon_pokedex_name_key UNIQUE (name);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='chk_sets_regiao' and conrelid='public.pokemon_sets'::regclass) then
    alter table public.pokemon_sets add constraint chk_sets_regiao CHECK ((regiao = ANY (ARRAY['ocidental'::text, 'jp'::text, 'cn'::text, 'kr'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pokemon_sets_pkey' and conrelid='public.pokemon_sets'::regclass) then
    alter table public.pokemon_sets add constraint pokemon_sets_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pokemon_species_pkey' and conrelid='public.pokemon_species'::regclass) then
    alter table public.pokemon_species add constraint pokemon_species_pkey PRIMARY KEY (dex_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pokemon_species_name_en_key' and conrelid='public.pokemon_species'::regclass) then
    alter table public.pokemon_species add constraint pokemon_species_name_en_key UNIQUE (name_en);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='portfolio_history_pkey' and conrelid='public.portfolio_history'::regclass) then
    alter table public.portfolio_history add constraint portfolio_history_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='portfolio_history_user_id_recorded_at_key' and conrelid='public.portfolio_history'::regclass) then
    alter table public.portfolio_history add constraint portfolio_history_user_id_recorded_at_key UNIQUE (user_id, recorded_at);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='price_history_pkey' and conrelid='public.price_history'::regclass) then
    alter table public.price_history add constraint price_history_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='price_snapshots_pkey' and conrelid='public.price_snapshots'::regclass) then
    alter table public.price_snapshots add constraint price_snapshots_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='price_snapshots_card_id_snapshot_date_key' and conrelid='public.price_snapshots'::regclass) then
    alter table public.price_snapshots add constraint price_snapshots_card_id_snapshot_date_key UNIQUE (card_id, snapshot_date);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='price_snapshots_quarentena_pkey' and conrelid='public.price_snapshots_quarentena'::regclass) then
    alter table public.price_snapshots_quarentena add constraint price_snapshots_quarentena_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='prices_pkey' and conrelid='public.prices'::regclass) then
    alter table public.prices add constraint prices_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='chk_no_self_referral' and conrelid='public.referrals'::regclass) then
    alter table public.referrals add constraint chk_no_self_referral CHECK ((referrer_user_id <> referred_user_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='referrals_status_check' and conrelid='public.referrals'::regclass) then
    alter table public.referrals add constraint referrals_status_check CHECK ((status = ANY (ARRAY['cadastrou'::text, 'ativou'::text, 'engajado'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='referrals_pkey' and conrelid='public.referrals'::regclass) then
    alter table public.referrals add constraint referrals_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='referrals_referred_user_id_key' and conrelid='public.referrals'::regclass) then
    alter table public.referrals add constraint referrals_referred_user_id_key UNIQUE (referred_user_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='rewards_cost_points_check' and conrelid='public.rewards'::regclass) then
    alter table public.rewards add constraint rewards_cost_points_check CHECK ((cost_points > 0));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='rewards_reward_type_check' and conrelid='public.rewards'::regclass) then
    alter table public.rewards add constraint rewards_reward_type_check CHECK ((reward_type = ANY (ARRAY['pro_days'::text, 'scan_credits'::text, 'separadores'::text, 'physical'::text, 'other'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='rewards_pkey' and conrelid='public.rewards'::regclass) then
    alter table public.rewards add constraint rewards_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='rewards_sku_key' and conrelid='public.rewards'::regclass) then
    alter table public.rewards add constraint rewards_sku_key UNIQUE (sku);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='set_aliases_pkey' and conrelid='public.set_aliases'::regclass) then
    alter table public.set_aliases add constraint set_aliases_pkey PRIMARY KEY (alias);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='set_id_colisao_pkey' and conrelid='public.set_id_colisao'::regclass) then
    alter table public.set_id_colisao add constraint set_id_colisao_pkey PRIMARY KEY (set_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='stripe_events_processed_pkey' and conrelid='public.stripe_events_processed'::regclass) then
    alter table public.stripe_events_processed add constraint stripe_events_processed_pkey PRIMARY KEY (event_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ticket_anexos_enviado_por_check' and conrelid='public.ticket_anexos'::regclass) then
    alter table public.ticket_anexos add constraint ticket_anexos_enviado_por_check CHECK ((enviado_por = ANY (ARRAY['user'::text, 'admin'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ticket_anexos_pkey' and conrelid='public.ticket_anexos'::regclass) then
    alter table public.ticket_anexos add constraint ticket_anexos_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ticket_anexos_path_key' and conrelid='public.ticket_anexos'::regclass) then
    alter table public.ticket_anexos add constraint ticket_anexos_path_key UNIQUE (path);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ticket_messages_sender_type_check' and conrelid='public.ticket_messages'::regclass) then
    alter table public.ticket_messages add constraint ticket_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['user'::text, 'admin'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ticket_messages_pkey' and conrelid='public.ticket_messages'::regclass) then
    alter table public.ticket_messages add constraint ticket_messages_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='tickets_priority_check' and conrelid='public.tickets'::regclass) then
    alter table public.tickets add constraint tickets_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='tickets_status_check' and conrelid='public.tickets'::regclass) then
    alter table public.tickets add constraint tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='tickets_pkey' and conrelid='public.tickets'::regclass) then
    alter table public.tickets add constraint tickets_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='trade_comparisons_veredito_check' and conrelid='public.trade_comparisons'::regclass) then
    alter table public.trade_comparisons add constraint trade_comparisons_veredito_check CHECK ((veredito = ANY (ARRAY['equilibrada'::text, 'desequilibrada'::text, 'muito_desequilibrada'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='trade_comparisons_pkey' and conrelid='public.trade_comparisons'::regclass) then
    alter table public.trade_comparisons add constraint trade_comparisons_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='transactions_pkey' and conrelid='public.transactions'::regclass) then
    alter table public.transactions add constraint transactions_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='chk_uc_idioma' and conrelid='public.user_cards'::regclass) then
    alter table public.user_cards add constraint chk_uc_idioma CHECK ((idioma = ANY (ARRAY['pt'::text, 'en'::text, 'es'::text, 'fr'::text, 'de'::text, 'it'::text, 'jp'::text, 'cn'::text, 'kr'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='quantity_positive' and conrelid='public.user_cards'::regclass) then
    alter table public.user_cards add constraint quantity_positive CHECK ((quantity > 0));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='user_cards_condicoes_is_object' and conrelid='public.user_cards'::regclass) then
    alter table public.user_cards add constraint user_cards_condicoes_is_object CHECK (((condicoes IS NULL) OR (jsonb_typeof(condicoes) = 'object'::text)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='user_cards_pkey' and conrelid='public.user_cards'::regclass) then
    alter table public.user_cards add constraint user_cards_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='user_master_sets_pkey' and conrelid='public.user_master_sets'::regclass) then
    alter table public.user_master_sets add constraint user_master_sets_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='user_master_sets_user_id_set_id_key' and conrelid='public.user_master_sets'::regclass) then
    alter table public.user_master_sets add constraint user_master_sets_user_id_set_id_key UNIQUE (user_id, set_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='user_paginas_lendarias_pkey' and conrelid='public.user_paginas_lendarias'::regclass) then
    alter table public.user_paginas_lendarias add constraint user_paginas_lendarias_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='user_paginas_lendarias_user_id_pagina_id_key' and conrelid='public.user_paginas_lendarias'::regclass) then
    alter table public.user_paginas_lendarias add constraint user_paginas_lendarias_user_id_pagina_id_key UNIQUE (user_id, pagina_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='users_pkey' and conrelid='public.users'::regclass) then
    alter table public.users add constraint users_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='users_email_key' and conrelid='public.users'::regclass) then
    alter table public.users add constraint users_email_key UNIQUE (email);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='users_referral_code_key' and conrelid='public.users'::regclass) then
    alter table public.users add constraint users_referral_code_key UNIQUE (referral_code);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='watchlist_pkey' and conrelid='public.watchlist'::regclass) then
    alter table public.watchlist add constraint watchlist_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='watchlist_user_id_card_id_key' and conrelid='public.watchlist'::regclass) then
    alter table public.watchlist add constraint watchlist_user_id_card_id_key UNIQUE (user_id, card_id);
  end if;
end $$;

-- ============================================================
-- 5. VIEWS (3)
-- ============================================================
-- ATENCAO: pokemon_cards e VIEW sobre pokemon_cards_all com security_invoker=true.
-- Sem isso a view furaria a RLS da base. Preservar.
create or replace view public.pokemon_cards with (security_invoker=true) as
 SELECT id,
    name,
    number,
    rarity,
    artist,
    image_small,
    image_large,
    set_id,
    set_name,
    set_series,
    set_release_date,
    set_total,
    set_logo,
    set_symbol,
    hp,
    types,
    supertype,
    subtypes,
    attacks,
    weaknesses,
    resistances,
    retreat_cost,
    flavor_text,
    legalities,
    price_usd_normal,
    price_usd_holofoil,
    price_usd_reverse,
    price_usd_1st_edition,
    price_eur_normal,
    price_eur_holofoil,
    price_eur_reverse,
    liga_cid,
    liga_link,
    preco_normal,
    preco_foil,
    preco_promo,
    preco_reverse,
    preco_pokeball,
    preco_min,
    preco_medio,
    preco_max,
    preco_foil_min,
    preco_foil_medio,
    preco_foil_max,
    preco_promo_min,
    preco_promo_medio,
    preco_promo_max,
    preco_reverse_min,
    preco_reverse_medio,
    preco_reverse_max,
    tcg_updated_at,
    liga_updated_at,
    created_at,
    preco_pokeball_min,
    preco_pokeball_medio,
    preco_pokeball_max,
    base_pokemon_names,
    outras_variantes,
    excluded_from_scan,
    excluded_reason,
    excluded_at,
    number_norm,
    is_canary,
    regiao,
    slug,
    idioma,
    liga_last_attempt_at,
    liga_fail_streak,
    name_pt,
    set_name_pt,
    oculto,
    ultima_venda_cents,
    ultima_venda_variante,
    ultima_venda_condicao,
    ultima_venda_idioma,
    ultima_venda_atualizado_em,
    liga_range_min,
    liga_range_max
   FROM pokemon_cards_all
  WHERE NOT oculto;
;

create or replace view public.public_users as
 SELECT id,
    name,
    username,
        CASE
            WHEN perfil_publico THEN city
            ELSE NULL::text
        END AS city,
    is_pro,
    created_at,
    perfil_publico,
    perfil_ocultar_valores
   FROM users;
;

-- ============================================================
-- 6. MATERIALIZED VIEWS (6) -- criadas WITH NO DATA
-- ============================================================
-- Depois do seed: refresh materialized view public.<nome>; (a primeira vez NAO pode ser concurrently).
-- Indice unico e obrigatorio para refresh concurrently (pg_cron usa).
-- As *_v1_old sao versoes anteriores (leem pokemon_cards_all direto); mantidas por fidelidade, candidatas a drop.
create materialized view if not exists public.mv_base_pokemon_tipos as
 WITH expandido AS (
         SELECT unnest(pc.base_pokemon_names) AS nome,
            pc.types
           FROM pokemon_cards pc
          WHERE pc.supertype = 'Pokémon'::text AND pc.image_small IS NOT NULL AND pc.base_pokemon_names IS NOT NULL
        ), contagem AS (
         SELECT expandido.nome,
            count(*) AS card_count
           FROM expandido
          GROUP BY expandido.nome
        ), tipo_freq AS (
         SELECT expandido.nome,
            expandido.types,
            count(*) AS n
           FROM expandido
          WHERE expandido.types IS NOT NULL AND array_length(expandido.types, 1) > 0
          GROUP BY expandido.nome, expandido.types
        ), tipo_moda AS (
         SELECT tipo_freq.nome,
            tipo_freq.types,
            row_number() OVER (PARTITION BY tipo_freq.nome ORDER BY tipo_freq.n DESC, (tipo_freq.types[1])) AS rn
           FROM tipo_freq
        )
 SELECT c.nome,
    c.card_count,
    COALESCE(m.types, ARRAY[]::text[]) AS types
   FROM contagem c
     LEFT JOIN tipo_moda m ON m.nome = c.nome AND m.rn = 1
with no data;
CREATE UNIQUE INDEX IF NOT EXISTS mv_base_pokemon_tipos_nome_idx ON public.mv_base_pokemon_tipos USING btree (nome);

create materialized view if not exists public.mv_base_pokemon_tipos_v1_old as
 WITH expandido AS (
         SELECT unnest(pokemon_cards_all.base_pokemon_names) AS nome,
            pokemon_cards_all.types
           FROM pokemon_cards_all
          WHERE pokemon_cards_all.supertype = 'Pokémon'::text AND pokemon_cards_all.image_small IS NOT NULL AND pokemon_cards_all.base_pokemon_names IS NOT NULL
        ), contagem AS (
         SELECT expandido.nome,
            count(*) AS card_count
           FROM expandido
          GROUP BY expandido.nome
        ), tipo_freq AS (
         SELECT expandido.nome,
            expandido.types,
            count(*) AS n
           FROM expandido
          WHERE expandido.types IS NOT NULL AND array_length(expandido.types, 1) > 0
          GROUP BY expandido.nome, expandido.types
        ), tipo_moda AS (
         SELECT tipo_freq.nome,
            tipo_freq.types,
            row_number() OVER (PARTITION BY tipo_freq.nome ORDER BY tipo_freq.n DESC, (tipo_freq.types[1])) AS rn
           FROM tipo_freq
        )
 SELECT c.nome,
    c.card_count,
    COALESCE(m.types, ARRAY[]::text[]) AS types
   FROM contagem c
     LEFT JOIN tipo_moda m ON m.nome = c.nome AND m.rn = 1
with no data;
CREATE UNIQUE INDEX IF NOT EXISTS mv_base_pokemon_tipos_v1_old_nome_idx ON public.mv_base_pokemon_tipos_v1_old USING btree (nome);

create materialized view if not exists public.mv_price_movers as
 WITH cur AS (
         SELECT pc.id AS card_id,
            pc.slug,
            regexp_replace(replace(replace(replace(pc.name, '&amp;'::text, '&'::text), '&gt;'::text, '>'::text), '&lt;'::text, '<'::text), '\s*\([0-9A-Za-z]+\s*/\s*[0-9A-Za-z]+\)\s*$'::text, ''::text) AS name,
            pc.set_name,
            pc.image_small,
            pc.preco_medio AS preco_atual
           FROM pokemon_cards pc
          WHERE pc.preco_medio >= 30::numeric AND pc.preco_medio <= 10000::numeric AND pc.image_small IS NOT NULL
        ), base7 AS (
         SELECT DISTINCT ON (price_snapshots.card_id) price_snapshots.card_id,
            price_snapshots.preco_medio AS preco_base
           FROM price_snapshots
          WHERE price_snapshots.snapshot_date <= (CURRENT_DATE - 7) AND price_snapshots.preco_medio IS NOT NULL
          ORDER BY price_snapshots.card_id, price_snapshots.snapshot_date DESC
        ), base30 AS (
         SELECT DISTINCT ON (price_snapshots.card_id) price_snapshots.card_id,
            price_snapshots.preco_medio AS preco_base
           FROM price_snapshots
          WHERE price_snapshots.snapshot_date <= (CURRENT_DATE - 30) AND price_snapshots.preco_medio IS NOT NULL
          ORDER BY price_snapshots.card_id, price_snapshots.snapshot_date DESC
        ), m AS (
         SELECT 7 AS window_days,
            c.card_id,
            c.slug,
            c.name,
            c.set_name,
            c.image_small,
            c.preco_atual,
            b.preco_base,
            round((c.preco_atual - b.preco_base) / b.preco_base * 100::numeric, 1) AS pct
           FROM cur c
             JOIN base7 b ON b.card_id = c.card_id
          WHERE b.preco_base >= 30::numeric
        UNION ALL
         SELECT 30,
            c.card_id,
            c.slug,
            c.name,
            c.set_name,
            c.image_small,
            c.preco_atual,
            b.preco_base,
            round((c.preco_atual - b.preco_base) / b.preco_base * 100::numeric, 1) AS round
           FROM cur c
             JOIN base30 b ON b.card_id = c.card_id
          WHERE b.preco_base >= 30::numeric
        ), f AS (
         SELECT m.window_days,
            m.card_id,
            m.slug,
            m.name,
            m.set_name,
            m.image_small,
            m.preco_atual,
            m.preco_base,
            m.pct
           FROM m
          WHERE abs(m.pct) >= 5::numeric AND abs(m.pct) <= 80::numeric
        ), dedup AS (
         SELECT DISTINCT ON (f.window_days, (lower(f.name)), (lower(COALESCE(f.set_name, ''::text)))) f.window_days,
            f.card_id,
            f.slug,
            f.name,
            f.set_name,
            f.image_small,
            f.preco_atual,
            f.preco_base,
            f.pct
           FROM f
          ORDER BY f.window_days, (lower(f.name)), (lower(COALESCE(f.set_name, ''::text))), f.preco_atual DESC
        ), ranked AS (
         SELECT dedup.window_days,
                CASE
                    WHEN dedup.pct > 0::numeric THEN 'up'::text
                    ELSE 'down'::text
                END AS direction,
            dedup.card_id,
            dedup.slug,
            dedup.name,
            dedup.set_name,
            dedup.image_small,
            dedup.preco_atual,
            dedup.preco_base,
            dedup.pct,
            row_number() OVER (PARTITION BY dedup.window_days, (
                CASE
                    WHEN dedup.pct > 0::numeric THEN 'up'::text
                    ELSE 'down'::text
                END) ORDER BY (abs(dedup.pct)) DESC, dedup.preco_atual DESC) AS rnk
           FROM dedup
        )
 SELECT window_days,
    direction,
    rnk,
    card_id,
    slug,
    name,
    set_name,
    image_small,
    preco_atual,
    preco_base,
    pct
   FROM ranked
  WHERE rnk <= 20
with no data;
CREATE UNIQUE INDEX IF NOT EXISTS mv_price_movers_uk ON public.mv_price_movers USING btree (window_days, direction, rnk);

create materialized view if not exists public.mv_price_movers_v1_old as
 WITH cur AS (
         SELECT pokemon_cards_all.id AS card_id,
            regexp_replace(replace(replace(replace(pokemon_cards_all.name, '&amp;'::text, '&'::text), '&gt;'::text, '>'::text), '&lt;'::text, '<'::text), '\s*\([0-9A-Za-z]+\s*/\s*[0-9A-Za-z]+\)\s*$'::text, ''::text) AS name,
            pokemon_cards_all.set_name,
            pokemon_cards_all.image_small,
            pokemon_cards_all.preco_medio AS preco_atual
           FROM pokemon_cards_all
          WHERE pokemon_cards_all.preco_medio >= 30::numeric AND pokemon_cards_all.preco_medio <= 10000::numeric AND pokemon_cards_all.image_small IS NOT NULL
        ), base7 AS (
         SELECT DISTINCT ON (price_snapshots.card_id) price_snapshots.card_id,
            price_snapshots.preco_medio AS preco_base
           FROM price_snapshots
          WHERE price_snapshots.snapshot_date <= (CURRENT_DATE - 7) AND price_snapshots.preco_medio IS NOT NULL
          ORDER BY price_snapshots.card_id, price_snapshots.snapshot_date DESC
        ), base30 AS (
         SELECT DISTINCT ON (price_snapshots.card_id) price_snapshots.card_id,
            price_snapshots.preco_medio AS preco_base
           FROM price_snapshots
          WHERE price_snapshots.snapshot_date <= (CURRENT_DATE - 30) AND price_snapshots.preco_medio IS NOT NULL
          ORDER BY price_snapshots.card_id, price_snapshots.snapshot_date DESC
        ), m AS (
         SELECT 7 AS window_days,
            c.card_id,
            c.name,
            c.set_name,
            c.image_small,
            c.preco_atual,
            b.preco_base,
            round((c.preco_atual - b.preco_base) / b.preco_base * 100::numeric, 1) AS pct
           FROM cur c
             JOIN base7 b ON b.card_id = c.card_id
          WHERE b.preco_base >= 30::numeric
        UNION ALL
         SELECT 30,
            c.card_id,
            c.name,
            c.set_name,
            c.image_small,
            c.preco_atual,
            b.preco_base,
            round((c.preco_atual - b.preco_base) / b.preco_base * 100::numeric, 1) AS round
           FROM cur c
             JOIN base30 b ON b.card_id = c.card_id
          WHERE b.preco_base >= 30::numeric
        ), f AS (
         SELECT m.window_days,
            m.card_id,
            m.name,
            m.set_name,
            m.image_small,
            m.preco_atual,
            m.preco_base,
            m.pct
           FROM m
          WHERE abs(m.pct) >= 5::numeric AND abs(m.pct) <= 80::numeric
        ), dedup AS (
         SELECT DISTINCT ON (f.window_days, (lower(f.name)), (lower(COALESCE(f.set_name, ''::text)))) f.window_days,
            f.card_id,
            f.name,
            f.set_name,
            f.image_small,
            f.preco_atual,
            f.preco_base,
            f.pct
           FROM f
          ORDER BY f.window_days, (lower(f.name)), (lower(COALESCE(f.set_name, ''::text))), f.preco_atual DESC
        ), ranked AS (
         SELECT dedup.window_days,
                CASE
                    WHEN dedup.pct > 0::numeric THEN 'up'::text
                    ELSE 'down'::text
                END AS direction,
            dedup.card_id,
            dedup.name,
            dedup.set_name,
            dedup.image_small,
            dedup.preco_atual,
            dedup.preco_base,
            dedup.pct,
            row_number() OVER (PARTITION BY dedup.window_days, (
                CASE
                    WHEN dedup.pct > 0::numeric THEN 'up'::text
                    ELSE 'down'::text
                END) ORDER BY (abs(dedup.pct)) DESC, dedup.preco_atual DESC) AS rnk
           FROM dedup
        )
 SELECT window_days,
    direction,
    rnk,
    card_id,
    name,
    set_name,
    image_small,
    preco_atual,
    preco_base,
    pct
   FROM ranked
  WHERE rnk <= 20
with no data;
CREATE UNIQUE INDEX IF NOT EXISTS mv_price_movers_v1_old_uk ON public.mv_price_movers_v1_old USING btree (window_days, direction, rnk);

create materialized view if not exists public.mv_set_index_stats as
 SELECT set_id,
    count(*) AS cards_count,
    COALESCE(sum(preco_medio), 0::numeric) AS total_value_brl,
    min(set_name) AS sample_set_name
   FROM pokemon_cards
  WHERE set_id IS NOT NULL
  GROUP BY set_id
with no data;
CREATE UNIQUE INDEX IF NOT EXISTS mv_set_index_stats_pk ON public.mv_set_index_stats USING btree (set_id);

create materialized view if not exists public.mv_set_index_stats_v1_old as
 SELECT set_id,
    count(*) AS cards_count,
    COALESCE(sum(preco_medio), 0::numeric) AS total_value_brl,
    min(set_name) AS sample_set_name
   FROM pokemon_cards_all
  WHERE set_id IS NOT NULL
  GROUP BY set_id
with no data;
CREATE UNIQUE INDEX IF NOT EXISTS mv_set_index_stats_v1_old_pk ON public.mv_set_index_stats_v1_old USING btree (set_id);

-- ============================================================
-- 7. INDICES NAO-CONSTRAINT (138, incluindo os 6 das matviews acima)
-- ============================================================
-- Dependem de f_unaccent() (secao 8) para os indices gin de unaccent. Por isso a secao 8 vem ANTES na execucao:
-- os indices abaixo sao repetidos apos as funcoes. Ver "7b".


-- ============================================================
-- 8. FUNCOES (101 de usuario; 35 de extensao pg_trgm/unaccent omitidas, nascem com a extensao)
-- ============================================================
-- Funcoes SQL puras (_nn, _palavras, _selo_identidade...) chamam f_unaccent/_nn antes de
-- elas existirem no arquivo. Com check_function_bodies ligado o CREATE valida o corpo e falha
-- em banco vazio (22/08/2026, branch prova-multijogo). Mesmo padrao do pg_dump.
set check_function_bodies = off;
-- Trigger functions primeiro

CREATE OR REPLACE FUNCTION public.enforce_pasta_cards_limit_free()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_owner uuid; v_count int;
begin
  select user_id into v_owner from pastas where id = NEW.pasta_id;
  if public.user_pastas_ilimitadas(v_owner) then return NEW; end if;
  select count(*) into v_count from pasta_cards where pasta_id = NEW.pasta_id;
  if v_count >= 100 then
    raise exception 'PRO_REQUIRED_CARTAS: limite de 100 cartas por pasta no plano Free' using errcode = 'P0001';
  end if;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.enforce_pasta_limit_free()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_count int;
begin
  if public.user_pastas_ilimitadas(NEW.user_id) then return NEW; end if;
  select count(*) into v_count from pastas where user_id = NEW.user_id;
  if v_count >= 1 then
    raise exception 'PRO_REQUIRED_PASTAS: usuarios Free podem ter apenas 1 pasta' using errcode = 'P0001';
  end if;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.enforce_unique_cpf()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_digits text;
  v_old text;
  v_conflito uuid;
begin
  v_digits := regexp_replace(coalesce(NEW.cpf, ''), '[^0-9]', '', 'g');

  -- nada a validar se nao for um CPF de 11 digitos
  if length(v_digits) <> 11 then
    return NEW;
  end if;

  -- em UPDATE: se o CPF nao mudou, libera (grandfather dos duplicados atuais)
  if TG_OP = 'UPDATE' then
    v_old := regexp_replace(coalesce(OLD.cpf, ''), '[^0-9]', '', 'g');
    if v_old = v_digits then
      return NEW;
    end if;
  end if;

  select u.id into v_conflito
  from public.users u
  where u.id <> NEW.id
    and regexp_replace(coalesce(u.cpf, ''), '[^0-9]', '', 'g') = v_digits
  limit 1;

  if v_conflito is not null then
    raise exception 'CPF_DUPLICADO'
      using errcode = '23505',
            detail  = 'Ja existe uma conta cadastrada com este CPF.';
  end if;

  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_log_price_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF (
    OLD.preco_normal IS DISTINCT FROM NEW.preco_normal OR
    OLD.preco_min IS DISTINCT FROM NEW.preco_min OR
    OLD.preco_max IS DISTINCT FROM NEW.preco_max OR
    OLD.preco_medio IS DISTINCT FROM NEW.preco_medio OR
    OLD.preco_foil IS DISTINCT FROM NEW.preco_foil OR
    OLD.preco_reverse IS DISTINCT FROM NEW.preco_reverse
  ) AND (
    NEW.preco_normal IS NOT NULL OR
    NEW.preco_min IS NOT NULL OR
    NEW.preco_max IS NOT NULL OR
    NEW.preco_foil IS NOT NULL
  ) THEN
    INSERT INTO price_history (
      card_id, preco_normal, preco_min, preco_max, preco_medio,
      preco_foil, preco_reverse, source, recorded_at
    ) VALUES (
      NEW.id, NEW.preco_normal, NEW.preco_min, NEW.preco_max, NEW.preco_medio,
      NEW.preco_foil, NEW.preco_reverse, 'liga_scan', NOW()
    );
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_ticket_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  update public.tickets
  set last_message_at = new.created_at,
      updated_at = new.created_at,
      status = case
        when status in ('resolved','closed') and new.sender_type = 'user' then 'open'
        else status
      end
  where id = new.ticket_id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.preencher_card_slug()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_printed int;
  v_base    text;
  v_tent    text;
begin
  if new.slug is not null then
    return new;
  end if;

  select s.printed_total into v_printed from public.pokemon_sets s where s.id = new.set_id;

  v_base := public.montar_card_slug(new.name, new.number, v_printed, new.set_name);
  if v_base is null then
    return new;  -- sem nome utilizavel: deixa null, o sitemap ignora
  end if;

  -- livre? usa. senao, sufixo estavel derivado do id.
  v_tent := v_base;
  if exists (select 1 from public.pokemon_cards c where c.slug = v_tent and c.id <> new.id) then
    v_tent := v_base || '-' || substr(md5(new.id), 1, 4);
    -- colisao dupla e praticamente impossivel, mas nao deixo passar em silencio
    if exists (select 1 from public.pokemon_cards c where c.slug = v_tent and c.id <> new.id) then
      v_tent := v_base || '-' || substr(md5(new.id), 1, 8);
    end if;
  end if;

  new.slug := v_tent;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_loja_eventos_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.set_lojas_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ begin new.updated_at = now(); return new; end; $function$
;

CREATE OR REPLACE FUNCTION public.users_generate_referral_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_unique_referral_code();
  END IF;
  RETURN NEW;
END;
$function$
;

-- Demais funcoes

CREATE OR REPLACE FUNCTION public._decode_liga(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select regexp_replace(
    replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
    replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
      coalesce(t,''),
      '%26amp%3B','&'), '&nbsp%3B',' '), '&nbsp;',' '), '%26','&'), '%20',' '),
      '%28','('), '%29',')'), '%2F','/'), '%3A',':'), '%5B','['), '%5D',']'),
      '%C3%A9','e'), '%C3%A1','a'), '%C3%A3','a'), '%C3%B3','o'), '%C3%AA','e'),
      '%C3%AD','i'), '%C3%BA','u'), '%C3%A7','c'), '&amp;','&'),
    '\s*\([^)]*\)\s*$', '')
$function$
;

CREATE OR REPLACE FUNCTION public._nn(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select regexp_replace(lower(public.f_unaccent(regexp_replace(coalesce(t,''), '\s*\([^)]*\)\s*', ' ', 'g'))), '[^a-z0-9]', '', 'g')
$function$
;

CREATE OR REPLACE FUNCTION public._palavras(t text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select coalesce(array_agg(w), '{}'::text[])
  from unnest(string_to_array(
    regexp_replace(lower(public.f_unaccent(coalesce(t,''))), '[^a-z0-9 ]', ' ', 'g'), ' ')) w
  where length(w) >= 4
$function$
;

CREATE OR REPLACE FUNCTION public._selo_identidade(t text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select coalesce(array_agg(s order by s), '{}'::text[])
  from unnest(array['prime','star','lvx','vmax','vstar','vunion','gx','break','staff','delta']) s
  where _nn(lower(coalesce(t,''))) like '%' || s || '%'
$function$
;

CREATE OR REPLACE FUNCTION public.admin_catalog_total_value()
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ SELECT COALESCE(SUM(preco_medio), 0) FROM pokemon_cards $function$
;

CREATE OR REPLACE FUNCTION public.admin_get_users_last_sign_in(user_ids uuid[])
 RETURNS TABLE(id uuid, last_sign_in_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT u.id, u.last_sign_in_at
  FROM auth.users u
  WHERE u.id = ANY(user_ids)
$function$
;

CREATE OR REPLACE FUNCTION public.admin_listar_conversas(p_q text DEFAULT NULL::text)
 RETURNS TABLE(anuncio_id uuid, card_name text, card_image text, price numeric, status text, seller_id uuid, seller_nome text, seller_email text, buyer_id uuid, buyer_nome text, buyer_email text, total_msgs integer, ultima_at timestamp with time zone, tem_oculta boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with conv as (
    select mm.anuncio_id, count(*)::int as total_msgs, max(mm.created_at) as ultima_at,
           bool_or(mm.oculta) as tem_oculta
    from marketplace_mensagens mm group by mm.anuncio_id
  )
  select m.id, m.card_name, m.card_image, m.price, m.status,
         m.user_id, coalesce(nullif(su.name,''), su.email, 'Usuario'), su.email,
         m.buyer_id, coalesce(nullif(bu.name,''), bu.email, 'Usuario'), bu.email,
         c.total_msgs, c.ultima_at, c.tem_oculta
  from conv c
  join marketplace m on m.id = c.anuncio_id
  left join users su on su.id = m.user_id
  left join users bu on bu.id = m.buyer_id
  where p_q is null or p_q = ''
     or m.card_name ilike '%'||p_q||'%'
     or su.name ilike '%'||p_q||'%' or su.email ilike '%'||p_q||'%'
     or bu.name ilike '%'||p_q||'%' or bu.email ilike '%'||p_q||'%'
  order by c.ultima_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_moderar_mensagem(p_msg_id uuid, p_acao text, p_moderador text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_anuncio uuid; v_autor uuid; v_body text;
begin
  if p_acao not in ('ocultar','excluir') then
    return jsonb_build_object('ok', false, 'erro', 'acao invalida');
  end if;
  select anuncio_id, sender_id, body into v_anuncio, v_autor, v_body
  from marketplace_mensagens where id = p_msg_id;
  if v_anuncio is null then
    return jsonb_build_object('ok', false, 'erro', 'mensagem inexistente');
  end if;

  insert into mensagens_moderacao (msg_id, anuncio_id, autor_id, body_original, acao, moderador)
  values (p_msg_id, v_anuncio, v_autor, v_body, p_acao, p_moderador);

  if p_acao = 'ocultar' then
    update marketplace_mensagens set body = 'Mensagem removida pela moderacao', oculta = true where id = p_msg_id;
  else
    delete from marketplace_mensagens where id = p_msg_id;
  end if;

  return jsonb_build_object('ok', true, 'acao', p_acao, 'autor_id', v_autor);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_pokedex_counts(user_ids uuid[])
 RETURNS TABLE(user_id uuid, capturados integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select uc.user_id, count(distinct bp)::int as capturados
  from user_cards uc
  join pokemon_cards pc on pc.id = uc.pokemon_api_id
  cross join lateral unnest(pc.base_pokemon_names) as bp
  where uc.user_id = any(user_ids)
    and pc.base_pokemon_names is not null
  group by uc.user_id;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_registered_cards_value()
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(pc.preco_medio * COALESCE(uc.quantity, 1)), 0)
  FROM user_cards uc
  JOIN pokemon_cards pc ON pc.id = uc.pokemon_api_id
  WHERE pc.preco_medio IS NOT NULL
$function$
;

CREATE OR REPLACE FUNCTION public.admin_top_collectors(lim integer DEFAULT 10)
 RETURNS TABLE(name text, username text, total_cartas bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT u.name, u.username, SUM(uc.quantity)::bigint
  FROM user_cards uc
  JOIN users u ON u.id = uc.user_id
  GROUP BY u.id, u.name, u.username
  ORDER BY SUM(uc.quantity) DESC
  LIMIT lim
$function$
;

CREATE OR REPLACE FUNCTION public.admin_top_owned_cards(lim integer DEFAULT 10)
 RETURNS TABLE(card_name text, variante text, preco_medio numeric, owner_name text, owner_username text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT uc.card_name, uc.variante, pc.preco_medio, u.name, u.username
  FROM user_cards uc
  JOIN pokemon_cards pc ON pc.id = uc.pokemon_api_id
  JOIN users u ON u.id = uc.user_id
  WHERE pc.preco_medio IS NOT NULL
  ORDER BY pc.preco_medio DESC
  LIMIT lim
$function$
;

CREATE OR REPLACE FUNCTION public.admin_user_pastas(p_user_id uuid)
 RETURNS TABLE(id uuid, nome text, descricao text, imagem_url text, publico boolean, destaque boolean, locked boolean, view_mode text, ordem integer, created_at timestamp with time zone, updated_at timestamp with time zone, qtd_cartas bigint, patrimonio numeric, carta_mais_cara_nome text, carta_mais_cara_valor numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with val as (
    select
      pcj.pasta_id,
      uc.card_name,
      (case uc.variante
        when 'foil'    then coalesce(pk.preco_foil_medio, 0)
        when 'reverse' then coalesce(pk.preco_reverse_medio, 0)
        when 'promo'   then coalesce(pk.preco_promo_medio, 0)
        else coalesce(pk.preco_medio, 0)
       end) as unit,
      uc.quantity
    from pasta_cards pcj
    join pastas p2     on p2.id = pcj.pasta_id and p2.user_id = p_user_id
    join user_cards uc on uc.id = pcj.user_card_id
    left join pokemon_cards pk on pk.id = uc.pokemon_api_id
  ),
  agg as (
    select pasta_id, count(*) as qtd_cartas,
           coalesce(sum(unit * quantity), 0) as patrimonio,
           max(unit) as max_unit
    from val group by pasta_id
  )
  select
    p.id, p.nome, p.descricao, p.imagem_url,
    p.publico, p.destaque, p.locked, p.view_mode, p.ordem,
    p.created_at, p.updated_at,
    coalesce(a.qtd_cartas, 0) as qtd_cartas,
    coalesce(a.patrimonio, 0) as patrimonio,
    (select v.card_name from val v where v.pasta_id = p.id order by v.unit desc nulls last limit 1) as carta_mais_cara_nome,
    coalesce(a.max_unit, 0) as carta_mais_cara_valor
  from pastas p
  left join agg a on a.pasta_id = p.id
  where p.user_id = p_user_id
  order by p.destaque desc, p.ordem asc, p.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_ver_conversa(p_anuncio_id uuid)
 RETURNS TABLE(id uuid, sender_id uuid, sender_nome text, body text, oculta boolean, body_original text, created_at timestamp with time zone, read_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select mm.id, mm.sender_id, coalesce(nullif(u.name,''), u.email, 'Usuario'),
         mm.body, mm.oculta,
         (select md.body_original from mensagens_moderacao md
          where md.msg_id = mm.id order by md.created_at desc limit 1),
         mm.created_at, mm.read_at
  from marketplace_mensagens mm
  left join users u on u.id = mm.sender_id
  where mm.anuncio_id = p_anuncio_id
  order by mm.created_at asc;
$function$
;

CREATE OR REPLACE FUNCTION public.analisar_import_lote(linhas text[])
 RETURNS TABLE(ordem integer, linha text, quantidade integer, card_id text, card_name text, card_set text, card_number text, card_image text, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ln text; i int := 0; raw text; rest text; toks text[]; numtok text;
  namep text; snum text; stotal text; name_patterns text[]; k int; m record;
begin
  foreach ln in array coalesce(linhas, array[]::text[]) loop
    i := i + 1;
    raw := btrim(coalesce(ln,''));
    if raw = '' then continue; end if;

    ordem := i; linha := raw; quantidade := 1;
    card_id := null; card_name := null; card_set := null; card_number := null; card_image := null; status := null;

    -- quantidade: "Nx " ou "N " no inicio, seguido de nao-digito (nome)
    if raw ~ '^\d{1,3}\s*[xX]?\s+\D' then
      quantidade := least(greatest((regexp_replace(raw, '^(\d{1,3}).*$', '\1'))::int, 1), 99);
      rest := regexp_replace(raw, '^\d{1,3}\s*[xX]?\s+', '');
    else
      rest := raw;
    end if;

    -- traduz PT->EN (energia/tipos/ignicao/treinador...)
    rest := public.traduzir_busca_pt(rest);

    -- ultimo token com digito = numero da carta
    toks := regexp_split_to_array(btrim(rest), '\s+');
    numtok := null;
    for k in reverse coalesce(array_length(toks,1),0)..1 loop
      if toks[k] ~ '\d' then numtok := toks[k]; exit; end if;
    end loop;

    if numtok is null then
      status := 'sem_numero'; return next; continue;
    end if;

    -- nome = rest sem o token de numero
    namep := btrim(regexp_replace(replace(rest, numtok, ' '), '\s+', ' ', 'g'));
    snum   := nullif(regexp_replace(regexp_replace(split_part(numtok,'/',1), '[^0-9]','','g'), '^0+',''), '');
    stotal := nullif(regexp_replace(regexp_replace(split_part(numtok,'/',2), '[^0-9]','','g'), '^0+',''), '');

    if snum is null or namep = '' then
      status := 'sem_numero'; return next; continue;
    end if;

    name_patterns := array(select '%'||t||'%' from unnest(string_to_array(namep,' ')) t where btrim(t) <> '');

    select pc.id, pc.name, pc.set_name, pc.number, pc.image_small into m
    from pokemon_cards pc
    where pc.name ilike all(name_patterns)
      and ( pc.number_norm = snum or pc.name ~* ('\(0*'||snum||'/') )
      and ( stotal is null or pc.set_total::text = stotal or pc.name ~* ('\(0*'||snum||'/0*'||stotal||'\)') )
    order by (pc.image_small is null), pc.set_release_date desc nulls last, pc.id
    limit 1;

    if m.id is null then
      status := 'nao_encontrada'; return next; continue;
    end if;

    card_id := m.id; card_name := m.name; card_set := m.set_name; card_number := m.number; card_image := m.image_small; status := 'ok';
    return next;
  end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.award_referral_signup(p_referred_user_id uuid, p_ref_code text, p_ip text, p_fingerprint text, p_user_agent text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_referrer_id uuid;
  v_existing_id uuid;
  v_referral_id uuid;
  v_is_suspicious boolean := false;
  v_referrer_ip text;
  v_referrer_fp text;
BEGIN
  IF p_referred_user_id IS NULL OR p_ref_code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_params');
  END IF;

  SELECT id INTO v_existing_id FROM public.referrals WHERE referred_user_id = p_referred_user_id;
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'referral_id', v_existing_id, 'noop', true);
  END IF;

  SELECT id, referral_signup_ip, referral_signup_fingerprint
  INTO v_referrer_id, v_referrer_ip, v_referrer_fp
  FROM public.users
  WHERE referral_code = upper(p_ref_code)
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  IF v_referrer_id = p_referred_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
  END IF;

  IF (p_ip IS NOT NULL AND v_referrer_ip = p_ip)
     OR (p_fingerprint IS NOT NULL AND v_referrer_fp = p_fingerprint) THEN
    v_is_suspicious := true;
  END IF;

  INSERT INTO public.referrals (
    referrer_user_id, referred_user_id, referral_code,
    status, signup_ip, signup_fingerprint, signup_user_agent,
    is_suspicious
  ) VALUES (
    v_referrer_id, p_referred_user_id, upper(p_ref_code),
    'cadastrou', p_ip, p_fingerprint, p_user_agent,
    v_is_suspicious
  )
  RETURNING id INTO v_referral_id;

  UPDATE public.users
  SET referred_by_user_id = v_referrer_id,
      referral_signup_ip = COALESCE(referral_signup_ip, p_ip),
      referral_signup_fingerprint = COALESCE(referral_signup_fingerprint, p_fingerprint)
  WHERE id = p_referred_user_id;

  RETURN jsonb_build_object('ok', true, 'referral_id', v_referral_id, 'is_suspicious', v_is_suspicious);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.backfill_liga_base_pokemon()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  n integer;
BEGIN
  WITH base AS (
    SELECT id, name, regexp_replace(name, '\s*\([^()]*\)\s*$', '') AS nm0
    FROM pokemon_cards
    WHERE id LIKE 'liga-%' AND supertype IS NULL
      AND name !~* 'spirit\s*link'      -- exclui itens "Spirit Link"
      AND name !~* 'elo espiritual'     -- idem (PT)
  ),
  parts AS (
    SELECT id, name, trim(p) AS part
    FROM base, LATERAL regexp_split_to_table(nm0, '\s*/\s*') AS p
  ),
  pclean AS (
    SELECT id, name,
      trim(regexp_replace(
        regexp_replace(part, '^(Mega|M|Dark|Light|Shining|Radiant|Alolan|Galarian|Hisuian|Paldean|Origin|Primal|Ultra|Shadow)\s+','','i'),
        '[\s-]+(VMAX|VSTAR|V-UNION|VUNION|GX|EX|BREAK|Prime|Star|LEGEND|Delta|LV\.?X|V|ex)\s*$','','i'
      )) AS pc
    FROM parts
  ),
  cands AS (
    -- prioridade: 1 = nome completo, 2 = primeiro token, 3 = ultimo token
    SELECT id, name, 1 AS pri,
      CASE
        WHEN lower(regexp_replace(pc,'[^[:alnum:] ]','','g')) IN ('nidoran male','nidoran m') THEN '##nm_m'
        WHEN lower(regexp_replace(pc,'[^[:alnum:] ]','','g')) IN ('nidoran female','nidoran f') THEN '##nm_f'
        ELSE lower(unaccent(regexp_replace(pc,'[^[:alnum:]]','','g')))
      END AS k
    FROM pclean
    UNION ALL
    SELECT id, name, 2,
      lower(unaccent(regexp_replace((regexp_split_to_array(pc,'\s+'))[1],'[^[:alnum:]]','','g')))
    FROM pclean
    UNION ALL
    SELECT id, name, 3,
      lower(unaccent(regexp_replace((regexp_split_to_array(pc,'\s+'))[cardinality(regexp_split_to_array(pc,'\s+'))],'[^[:alnum:]]','','g')))
    FROM pclean
  ),
  sp AS (
    SELECT name_en, lower(unaccent(regexp_replace(name_en,'[^[:alnum:]]','','g'))) AS k
    FROM pokemon_species
  ),
  resolved AS (
    SELECT DISTINCT ON (c.id) c.id,
      CASE WHEN c.k='##nm_m' THEN 'Nidoran♂'
           WHEN c.k='##nm_f' THEN 'Nidoran♀'
           ELSE sp.name_en END AS species
    FROM cands c
    LEFT JOIN sp ON sp.k = c.k AND c.k NOT LIKE '##nm%'
    WHERE (c.k LIKE '##nm%' OR sp.name_en IS NOT NULL)
    ORDER BY c.id, c.pri
  ),
  upd AS (
    UPDATE pokemon_cards p
    SET base_pokemon_names = ARRAY[r.species], supertype = 'Pokémon'
    FROM resolved r
    WHERE p.id = r.id AND r.species IS NOT NULL
      AND p.id LIKE 'liga-%' AND p.supertype IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO n FROM upd;
  RETURN n;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.broadcast_notification(p_type text, p_title text, p_message text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  insert into notifications (user_id, type, title, message, read, data)
  select id, p_type, p_title, p_message, false, coalesce(p_data, '{}'::jsonb)
  from users;
  get diagnostics n = row_count;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.busca_cartas(q text, lim integer DEFAULT 20, set_filter text DEFAULT NULL::text)
 RETURNS SETOF pokemon_cards_all
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with p as (
    select
      trim($1) as raw,
      trim(regexp_replace(lower(unaccent($1)), '[0-9/]+', ' ', 'g')) as qname,
      nullif((regexp_match($1, '([0-9]{1,4}[a-z]?)'))[1], '') as qnum
  )
  select c.*
  from public.pokemon_cards c, p
  where (set_filter is null or c.set_id = set_filter)
    and c.excluded_from_scan is not true
    and coalesce(c.is_canary, false) = false
    and (
      c.name ilike '%' || p.raw || '%'
      or (length(p.qname) >= 3 and c.name % p.qname)
      or (
        p.qnum is not null
        and lower(coalesce(c.number, '')) = lower(p.qnum)
        and (length(p.qname) < 2 or c.name % p.qname)
      )
    )
  order by
    (p.qnum is not null and lower(coalesce(c.number, '')) = lower(p.qnum)) desc,
    similarity(c.name, coalesce(nullif(p.qname, ''), p.raw)) desc,
    (c.image_small is not null) desc,
    c.set_release_date desc nulls last
  limit lim;
$function$
;

CREATE OR REPLACE FUNCTION public.busca_global(q text, lim integer DEFAULT 6)
 RETURNS TABLE(kind text, ref text, label text, sublabel text, image text, price numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  (
    select 'pokemon'::text as kind, p.slug as ref, p.name as label,
           (p.cards_count || ' cartas')::text as sublabel,
           null::text as image, null::numeric as price
    from pokemon_pokedex p
    where p.name ilike '%' || q || '%'
    order by (p.name ilike q || '%') desc, p.cards_count desc nulls last
    limit lim
  )
  union all
  (
    select 'card'::text as kind, coalesce(c.slug, c.id) as ref, c.name as label,
           coalesce(c.set_name, '')::text as sublabel,
           c.image_small as image, c.preco_medio as price
    from pokemon_cards c
    where c.name ilike '%' || q || '%'
      and c.id ~ '^[a-zA-Z0-9_-]+$'
      and c.image_small is not null
    order by (c.name ilike q || '%') desc, c.preco_medio desc nulls last
    limit lim
  );
$function$
;

CREATE OR REPLACE FUNCTION public.capture_price_snapshots()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  with latest as (
    select distinct on (card_id) card_id, preco_medio as last_medio
    from price_snapshots
    order by card_id, snapshot_date desc
  )
  insert into price_snapshots (card_id, snapshot_date, preco_min, preco_medio, preco_max, source)
  select c.id, current_date, c.preco_min, c.preco_medio, c.preco_max, 'daily_cron'
  from pokemon_cards c
  left join latest l on l.card_id = c.id
  where c.preco_medio is not null
    and (l.card_id is null or l.last_medio is distinct from c.preco_medio)
  on conflict (card_id, snapshot_date) do update
    set preco_min = excluded.preco_min,
        preco_medio = excluded.preco_medio,
        preco_max = excluded.preco_max;
  get diagnostics n = row_count;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.card_sinal_purge()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
 SET lock_timeout TO '5s'
AS $function$
declare
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_bruto bigint;
  v_agg   bigint;
begin
  delete from public.card_sinal_evento where dia < v_hoje - 30;
  get diagnostics v_bruto = row_count;

  delete from public.card_sinal_diario where dia < v_hoje - 400;
  get diagnostics v_agg = row_count;

  delete from public.card_sinal_quota where dia < v_hoje - 60;

  return jsonb_build_object('ok', true, 'bruto', v_bruto, 'agregado', v_agg);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.card_sinal_rollup(p_dias integer DEFAULT 2)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
AS $function$
declare
  v_desde  date;
  v_linhas bigint;
begin
  v_desde := (now() at time zone 'America/Sao_Paulo')::date
             - least(greatest(coalesce(p_dias, 2), 1), 30);

  insert into public.card_sinal_diario
    (dia, tipo, card_id, n, n_visitantes, n_pico, n_interno, n_suspeito, atualizado_em)
  select
    e.dia,
    e.tipo,
    e.card_id,
    count(*) filter (where e.origem in (0, 1))::int,
    count(distinct e.visitante) filter (where e.origem in (0, 1))::int,
    coalesce(max(h.por_hora) filter (where e.origem in (0, 1)), 0)::int,
    count(*) filter (where e.origem = 1)::int,
    count(*) filter (where e.origem = 2)::int,
    now()
  from public.card_sinal_evento e
  join lateral (
    select count(*) as por_hora
    from public.card_sinal_evento e2
    where e2.dia = e.dia and e2.hora = e.hora
      and e2.tipo = e.tipo and e2.card_id = e.card_id
      and e2.origem in (0, 1)
  ) h on true
  where e.dia >= v_desde
  group by e.dia, e.tipo, e.card_id
  on conflict (dia, tipo, card_id) do update
    set n             = excluded.n,
        n_visitantes  = excluded.n_visitantes,
        n_pico        = excluded.n_pico,
        n_interno     = excluded.n_interno,
        n_suspeito    = excluded.n_suspeito,
        atualizado_em = excluded.atualizado_em;

  get diagnostics v_linhas = row_count;
  return jsonb_build_object('ok', true, 'linhas', v_linhas, 'desde', v_desde);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.contar_conversas_nao_lidas()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(distinct mm.anuncio_id)::int
  from marketplace_mensagens mm
  join marketplace m on m.id = mm.anuncio_id
  where (m.user_id = auth.uid() or m.buyer_id = auth.uid())
    and mm.sender_id <> auth.uid()
    and mm.read_at is null;
$function$
;

CREATE OR REPLACE FUNCTION public.cpf_em_uso(p_cpf text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with d as (select regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g') as dig)
  select case
    when (select length(dig) from d) <> 11 then false
    else exists (
      select 1 from public.users u
      where regexp_replace(coalesce(u.cpf, ''), '[^0-9]', '', 'g') = (select dig from d)
    )
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.decrement_scan_credits(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_avulso int; v_usados int; v_reset timestamptz;
  v_is_pro bool; v_plano text; v_pro_exp timestamptz; v_trial timestamptz;
  v_scansmes int; v_mensal_disp int;
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(scan_creditos,0), coalesce(scan_mensal_usados,0), scan_mensal_reset,
         coalesce(is_pro,false), plano, pro_expira_em, trial_expires_at
    INTO v_avulso, v_usados, v_reset, v_is_pro, v_plano, v_pro_exp, v_trial
    FROM public.users WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sem_creditos' USING ERRCODE = 'P0001';
  END IF;

  v_scansmes := CASE
    WHEN v_plano IN ('pro_anual','anual','pro','mensal') AND (v_pro_exp IS NULL OR v_pro_exp > now()) THEN -1
    WHEN v_is_pro                                        AND (v_pro_exp IS NULL OR v_pro_exp > now()) THEN -1
    WHEN v_trial IS NOT NULL AND v_trial > now() THEN 10
    ELSE 0
  END;

  IF v_reset IS NULL OR now() >= v_reset THEN
    v_usados := 0;
    v_reset := now() + interval '1 month';
  END IF;

  IF v_scansmes = -1 THEN
    v_usados := v_usados + 1;
    UPDATE public.users SET scan_mensal_usados = v_usados, scan_mensal_reset = v_reset WHERE id = p_user_id;
    RETURN -1;
  END IF;

  v_mensal_disp := greatest(0, v_scansmes - v_usados);

  IF v_mensal_disp > 0 THEN
    v_usados := v_usados + 1;
    UPDATE public.users SET scan_mensal_usados = v_usados, scan_mensal_reset = v_reset WHERE id = p_user_id;
  ELSIF v_avulso > 0 THEN
    v_avulso := v_avulso - 1;
    UPDATE public.users SET scan_creditos = v_avulso, scan_mensal_usados = v_usados, scan_mensal_reset = v_reset WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'sem_creditos' USING ERRCODE = 'P0001';
  END IF;

  RETURN greatest(0, v_scansmes - v_usados) + v_avulso;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enviar_mensagem(p_anuncio_id uuid, p_body text)
 RETURNS marketplace_mensagens
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_seller uuid; v_buyer uuid; v_card text; v_status text;
  v_recipient uuid; v_msg public.marketplace_mensagens;
begin
  if v_uid is null then raise exception 'nao autenticado'; end if;
  if coalesce(btrim(p_body), '') = '' then raise exception 'mensagem vazia'; end if;
  if length(p_body) > 2000 then raise exception 'mensagem muito longa'; end if;

  select user_id, buyer_id, card_name, status
    into v_seller, v_buyer, v_card, v_status
  from marketplace where id = p_anuncio_id;

  if v_seller is null then raise exception 'anuncio inexistente'; end if;
  if v_uid <> v_seller and (v_buyer is null or v_uid <> v_buyer) then
    raise exception 'sem acesso a esta negociacao';
  end if;

  insert into marketplace_mensagens (anuncio_id, sender_id, body)
  values (p_anuncio_id, v_uid, btrim(p_body))
  returning * into v_msg;

  if v_status = 'reservado' then
    update marketplace set status = 'em_negociacao' where id = p_anuncio_id;
  end if;

  v_recipient := case when v_uid = v_seller then v_buyer else v_seller end;
  if v_recipient is not null then
    insert into notifications (user_id, type, title, message, read, data)
    values (
      v_recipient, 'mensagem', 'Nova mensagem',
      'Voce tem uma nova mensagem sobre "' || coalesce(v_card, 'uma carta') || '".',
      false,
      jsonb_build_object('link', '/marketplace?conversa=' || p_anuncio_id::text,
                         'anuncio_id', p_anuncio_id)
    );
  end if;

  return v_msg;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.extract_base_pokemon_names(card_name text)
 RETURNS text[]
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  n text;
  parts text[];
  result text[];
  part text;
BEGIN
  n := trim(card_name);
  
  -- Remove número no final: "(037/∞)", "(123/456)"
  n := regexp_replace(n, '\s*\([^)]*\)\s*$', '', 'g');
  n := trim(n);

  -- TAG TEAM com &: "Garchomp & Giratina-GX" → ["Garchomp", "Giratina"]
  IF n LIKE '%&%' THEN
    parts := string_to_array(n, ' & ');
    result := '{}';
    FOREACH part IN ARRAY parts LOOP
      part := trim(part);
      -- Limpa sufixos de cada parte
      part := regexp_replace(part, '\s*-?(ex|EX|GX|V|VMAX|VSTAR|VUNION|e|G|GL|C|FB|SP|Prime|LEGEND|LV\.X|BREAK)\s*$', '', 'gi');
      part := trim(part);
      IF length(part) > 0 THEN
        result := array_append(result, part);
      END IF;
    END LOOP;
    RETURN result;
  END IF;

  -- Possessivo: "Cynthia's Feebas", "Ash's Pikachu", "_____'s Pikachu"
  -- Padrão: qualquer coisa + 's/\'s + espaço + nome do pokemon
  IF n ~ '^.+''s\s+\S' OR n ~ '^_+''s\s+\S' THEN
    n := regexp_replace(n, '^.+''s\s+', '', 'i');
  END IF;

  -- Remove prefixos comuns que não são nome do Pokémon
  -- "Dark ", "M ", "Rocket's ", "Team Rocket's ", "Shadow "
  n := regexp_replace(n, '^(Dark|Rocket''s|Team Rocket''s|Shadow)\s+', '', 'i');

  -- Remove formas: "Speed Forme", "Attack Forme", "Defense Forme", "Origin Forme", etc.
  n := regexp_replace(n, '\s+(Speed|Attack|Defense|Defence|Origin|Altered|Sky|Land|Therian|Incarnate|Heat|Wash|Mow|Frost|Fan|Sandy|Trash|Rainy|Sunny|Snowy|Dusk|Dawn|Midnight|Midday|Zen|Prism|Ultra)\s+Forme?\s*$', '', 'gi');
  n := regexp_replace(n, '\s+Forme?\s*$', '', 'gi');

  -- Remove sufixos TCG no final: -EX, ex, GX, V, VMAX, VSTAR, G, GL, C, FB, SP, δ, etc.
  n := regexp_replace(n, '\s*-?(ex|EX|GX|V\b|VMAX|VSTAR|VUNION|e\b|G\b|GL\b|C\b|FB\b|SP\b|δ|Prime|LEGEND|LV\.X|BREAK|TAG TEAM)\s*$', '', 'gi');
  
  -- Remove letras soltas no final: "Absol G" → "Absol", "Pikachu δ" → "Pikachu"
  n := regexp_replace(n, '\s+[A-Zδα☆★]\s*$', '', 'g');

  n := trim(n);

  IF length(n) > 0 THEN
    RETURN ARRAY[n];
  END IF;
  
  RETURN ARRAY[trim(card_name)];
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_unaccent(text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
 SET search_path TO 'public'
AS $function$
  select public.unaccent('public.unaccent'::regdictionary, $1)
$function$
;

CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_code text;
  v_exists boolean;
  v_attempts int := 0;
BEGIN
  -- Gera A-Z + 2-9 (sem 0/O/1/I/L pra evitar confusão visual)
  LOOP
    v_code := 'BYN' || (
      SELECT string_agg(c, '')
      FROM (
        SELECT substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 31)::int + 1, 1) AS c
        FROM generate_series(1, 5)
      ) s
    );
    SELECT EXISTS(SELECT 1 FROM public.users WHERE referral_code = v_code) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
    v_attempts := v_attempts + 1;
    IF v_attempts > 50 THEN
      RAISE EXCEPTION 'Não foi possível gerar referral_code único após 50 tentativas';
    END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_avaliacoes_usuario(p_user_id uuid)
 RETURNS TABLE(id uuid, estrelas integer, comentario text, papel text, created_at timestamp with time zone, avaliador_id uuid, avaliador_nome text, card_name text, verificada boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.estrelas, a.comentario, a.papel, a.created_at,
         a.avaliador_id,
         coalesce(pu.name, 'Usuário') as avaliador_nome,
         coalesce(m.card_name, p.item_nome) as card_name,
         (a.pedido_id is not null) as verificada
  from avaliacoes a
  left join public_users pu on pu.id = a.avaliador_id
  left join marketplace m on m.id = a.marketplace_id
  left join pedidos p on p.id = a.pedido_id
  where a.avaliado_id = p_user_id
  order by a.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.get_base_pokemon_com_tipos()
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
  select json_agg(row_to_json(t)) from (
    select nome as name,
           card_count,
           types
    from mv_base_pokemon_tipos
    order by nome
  ) t;
$function$
;

CREATE OR REPLACE FUNCTION public.get_card_price_history(p_id text, p_days integer DEFAULT 120)
 RETURNS TABLE(snapshot_date date, preco_min numeric, preco_medio numeric, preco_max numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with janela as (
    select ps.snapshot_date, ps.preco_min, ps.preco_medio, ps.preco_max
    from price_snapshots ps
    where ps.card_id = p_id
      and ps.snapshot_date >= current_date - p_days
  ),
  ref as (
    select percentile_cont(0.5) within group (order by preco_medio) as mediana,
           count(*) filter (where preco_medio is not null) as n
    from janela
  )
  select j.snapshot_date, j.preco_min, j.preco_medio, j.preco_max
  from janela j cross join ref r
  where j.preco_medio is null
     or r.n < 4
     or r.mediana is null
     or r.mediana <= 0
     or (j.preco_medio <= r.mediana * 8 and j.preco_medio >= r.mediana / 8)
  order by j.snapshot_date asc;
$function$
;

CREATE OR REPLACE FUNCTION public.get_existing_set_ids()
 RETURNS TABLE(set_id text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT DISTINCT pc.set_id FROM pokemon_cards pc WHERE pc.set_id IS NOT NULL;
$function$
;

CREATE OR REPLACE FUNCTION public.get_generation_heroes()
 RETURNS TABLE(gen integer, gen_name text, slug text, name text, cards_count integer, top_card_id text, top_card_image text, top_card_price numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with pools(gen, gen_name, slugs) as (
    values
      (1,'Kanto',  array['charizard','mewtwo','pikachu']),
      (2,'Johto',  array['umbreon','lugia','ho-oh']),
      (3,'Hoenn',  array['rayquaza','gardevoir','groudon']),
      (4,'Sinnoh', array['lucario','dialga','garchomp']),
      (5,'Unova',  array['reshiram','zekrom','kyurem']),
      (6,'Kalos',  array['sylveon','greninja','xerneas']),
      (7,'Alola',  array['lycanroc','rowlet','lunala']),
      (8,'Galar',  array['zacian','dragapult','cinderace']),
      (9,'Paldea', array['ogerpon','miraidon','koraidon'])
  ),
  picked as (
    select p.gen, p.gen_name,
           p.slugs[ (extract(doy from current_date)::int % array_length(p.slugs,1)) + 1 ] as slug
    from pools p
  ),
  resolved as (
    select pk.gen, pk.gen_name, pp.slug, pp.name, pp.cards_count
    from picked pk
    join pokemon_pokedex pp on pp.slug = pk.slug
  )
  select r.gen, r.gen_name, r.slug, r.name, r.cards_count,
         tc.id, tc.image_small, tc.preco_medio
  from resolved r
  left join lateral (
    select c.id, c.image_small, c.preco_medio
    from pokemon_cards c
    where c.base_pokemon_names @> array[r.name]
      and c.image_small is not null
      and c.id ~ '^[a-zA-Z0-9_-]+$'
    order by c.preco_medio desc nulls last
    limit 1
  ) tc on true
  order by r.gen;
$function$
;

CREATE OR REPLACE FUNCTION public.get_master_set_detail(p_set_id text, p_user_id uuid)
 RETURNS TABLE(set_id text, nome text, series text, release_date text, preco_centavos integer, total_cartas integer, total_paginas integer, owned_cartas integer, unlocked boolean, via_anual boolean, printed_total integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with u as (select coalesce((select is_pro and plano='anual' and (pro_expira_em is null or pro_expira_em>now()) from users where id=p_user_id), false) as anual),
  rws as (select * from public.master_set_card_rows(p_set_id))
  select m.set_id, m.nome, m.series, m.release_date, m.preco_centavos,
    (select count(*)::int from rws),
    ceil((select count(*) from rws)::numeric / 9)::int,
    (select count(*)::int from rws r where exists(select 1 from public.user_cards uc where uc.user_id=p_user_id and (uc.pokemon_api_id=r.id or uc.card_id=r.id))),
    ((select anual from u) or exists(select 1 from public.user_master_sets ums where ums.user_id=p_user_id and ums.set_id=m.set_id)),
    (select anual from u),
    ps.printed_total
  from public.master_sets m
  left join public.pokemon_sets ps on ps.id = m.set_id
  where m.set_id = p_set_id and m.ativo;
$function$
;

CREATE OR REPLACE FUNCTION public.get_master_set_sheet(p_set_id text, p_user_id uuid)
 RETURNS TABLE(card_id text, numero text, nome text, image_small text, owned boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.numero, r.nome, r.image_small,
    exists(select 1 from public.user_cards uc where uc.user_id = p_user_id and (uc.pokemon_api_id = r.id or uc.card_id = r.id)) as owned
  from public.master_set_card_rows(p_set_id) r
  order by r.sort_key nulls last, r.numero;
$function$
;

CREATE OR REPLACE FUNCTION public.get_master_set_sheet_v2(p_set_id text, p_user_id uuid)
 RETURNS TABLE(card_id text, numero text, nome text, image_small text, owned boolean, preco numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.numero, r.nome, r.image_small,
    exists(
      select 1 from public.user_cards uc
      where uc.user_id = p_user_id and (uc.pokemon_api_id = r.id or uc.card_id = r.id)
    ) as owned,
    coalesce(
      nullif(c.preco_medio, 0), nullif(c.preco_normal, 0),
      nullif(c.preco_foil_medio, 0), nullif(c.preco_reverse_medio, 0),
      nullif(c.preco_promo_medio, 0)
    ) as preco
  from public.master_set_card_rows(p_set_id) r
  left join public.pokemon_cards c on c.id = r.id
  order by r.sort_key nulls last, r.numero;
$function$
;

CREATE OR REPLACE FUNCTION public.get_master_sets_catalog(p_user_id uuid)
 RETURNS TABLE(set_id text, nome text, name_pt text, series text, release_date text, preco_centavos integer, total_cartas integer, owned_cartas integer, unlocked boolean, via_anual boolean, logo_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with u as (select coalesce((select is_pro and plano='anual' and (pro_expira_em is null or pro_expira_em>now()) from users where id=p_user_id), false) as anual)
  select m.set_id, m.nome, ps.name_pt, m.series, m.release_date, m.preco_centavos,
    (select count(*)::int from public.master_set_card_rows(m.set_id)),
    (select count(*)::int from public.master_set_card_rows(m.set_id) r where exists(select 1 from public.user_cards uc where uc.user_id=p_user_id and (uc.pokemon_api_id=r.id or uc.card_id=r.id))),
    ((select anual from u) or exists(select 1 from public.user_master_sets ums where ums.user_id=p_user_id and ums.set_id=m.set_id)),
    (select anual from u),
    ps.logo_url
  from public.master_sets m
  left join public.pokemon_sets ps on ps.id = m.set_id
  where m.ativo
  order by m.ordem;
$function$
;

CREATE OR REPLACE FUNCTION public.get_owned_pokemon_names()
 RETURNS TABLE(pokemon_api_id text, base_pokemon_names text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select uc.pokemon_api_id, pc.base_pokemon_names
  from user_cards uc
  join pokemon_cards pc on pc.id = uc.pokemon_api_id
  where uc.user_id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.get_pokemon_hub(p_slug text)
 RETURNS TABLE(slug text, name text, national_dex integer, name_pt text, primary_type text, cards_count integer, sets_count integer, preco_min numeric, preco_max numeric, preco_avg numeric, first_year text, last_year text, top_card_id text, top_card_name text, top_card_set text, top_card_image text, top_card_number text, top_card_price numeric, top_card_slug text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with pk as (
    select * from pokemon_pokedex where slug = p_slug limit 1
  ),
  cards as (
    select c.* from pokemon_cards c
    where c.base_pokemon_names @> array[(select name from pk)]
  ),
  agg as (
    select
      min(preco_medio) filter (where preco_medio > 0) as pmin,
      max(preco_medio) as pmax,
      round(avg(preco_medio) filter (where preco_medio > 0), 2) as pavg,
      min(nullif(left(set_release_date,4),'')) as fy,
      max(nullif(left(set_release_date,4),'')) as ly
    from cards
  ),
  top as (
    select id, name, set_name, image_small, number, preco_medio, slug
    from cards order by preco_medio desc nulls last limit 1
  )
  select pk.slug, pk.name, pk.national_dex, pk.name_pt, pk.primary_type,
         pk.cards_count, pk.sets_count,
         agg.pmin, agg.pmax, agg.pavg, agg.fy, agg.ly,
         top.id, top.name, top.set_name, top.image_small, top.number, top.preco_medio, top.slug
  from pk, agg, top;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pokemon_hub_cards(p_slug text)
 RETURNS TABLE(id text, name text, number text, image_small text, set_id text, set_name text, set_series text, set_release_date text, preco_min numeric, preco_medio numeric, preco_max numeric, rarity text, slug text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with pk as (select name from pokemon_pokedex where slug = p_slug limit 1)
  select c.id, c.name, c.number, c.image_small,
         c.set_id, c.set_name, c.set_series, c.set_release_date,
         c.preco_min, c.preco_medio, c.preco_max, c.rarity, c.slug
  from pokemon_cards c
  where c.base_pokemon_names @> array[(select name from pk)]
  order by c.set_release_date desc nulls last, c.preco_medio desc nulls last;
$function$
;

CREATE OR REPLACE FUNCTION public.get_price_movers(p_limit integer DEFAULT 12)
 RETURNS TABLE(window_days integer, direction text, card_id text, name text, set_name text, image_small text, preco_atual numeric, pct numeric, slug text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select window_days, direction, card_id, name, set_name, image_small, preco_atual, pct, slug
  from public.mv_price_movers
  where rnk <= p_limit
  order by window_days, direction, rnk;
$function$
;

CREATE OR REPLACE FUNCTION public.get_ranking(p_year integer DEFAULT NULL::integer, p_month integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year integer;
  v_month integer;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_top jsonb;
  v_my_position int;
  v_my_qualified int;
  v_user_id uuid := auth.uid();
BEGIN
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM now())::int);
  v_month := COALESCE(p_month, EXTRACT(MONTH FROM now())::int);

  v_period_start := make_timestamptz(v_year, v_month, 1, 0, 0, 0, 'UTC');
  v_period_end := v_period_start + interval '1 month';

  -- Se o período já passou, busca do snapshot (histórico imutável)
  IF v_period_end < now() THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'position', s.position,
        'user_id', s.user_id,
        'username', COALESCE(u.username, 'colecionador'),
        'qualified_count', s.qualified_referrals_count,
        'prize_awarded', s.prize_awarded
      ) ORDER BY s.position
    ) INTO v_top
    FROM monthly_ranking_snapshots s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.period_year = v_year AND s.period_month = v_month
    LIMIT 20;

    -- Posição do user logado neste snapshot
    SELECT position, qualified_referrals_count
    INTO v_my_position, v_my_qualified
    FROM monthly_ranking_snapshots
    WHERE period_year = v_year AND period_month = v_month AND user_id = v_user_id;

  ELSE
    -- Período corrente: calcula em tempo real
    WITH ranked AS (
      SELECT
        r.referrer_user_id AS user_id,
        COUNT(*) FILTER (
          WHERE r.status IN ('ativou', 'engajado')
          AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
          AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
        ) AS qualified_count,
        MIN(COALESCE(r.engajou_at, r.ativou_at)) FILTER (
          WHERE r.status IN ('ativou', 'engajado')
          AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
          AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
        ) AS first_qualified_at
      FROM referrals r
      GROUP BY r.referrer_user_id
      HAVING COUNT(*) FILTER (
        WHERE r.status IN ('ativou', 'engajado')
        AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
        AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
      ) > 0
    ),
    positioned AS (
      SELECT
        user_id,
        qualified_count,
        first_qualified_at,
        ROW_NUMBER() OVER (ORDER BY qualified_count DESC, first_qualified_at ASC) AS position
      FROM ranked
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'position', p.position,
        'user_id', p.user_id,
        'username', COALESCE(u.username, 'colecionador'),
        'qualified_count', p.qualified_count
      ) ORDER BY p.position
    ) INTO v_top
    FROM positioned p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.position <= 20;

    -- Posição do user logado mesmo fora do top 20
    SELECT position, qualified_count INTO v_my_position, v_my_qualified
    FROM (
      SELECT
        user_id,
        qualified_count,
        ROW_NUMBER() OVER (ORDER BY qualified_count DESC, first_qualified_at ASC) AS position
      FROM (
        SELECT
          r.referrer_user_id AS user_id,
          COUNT(*) FILTER (
            WHERE r.status IN ('ativou', 'engajado')
            AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
            AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
          ) AS qualified_count,
          MIN(COALESCE(r.engajou_at, r.ativou_at)) FILTER (
            WHERE r.status IN ('ativou', 'engajado')
            AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
            AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
          ) AS first_qualified_at
        FROM referrals r
        GROUP BY r.referrer_user_id
        HAVING COUNT(*) FILTER (
          WHERE r.status IN ('ativou', 'engajado')
          AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
          AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
        ) > 0
      ) inner_ranked
    ) ranked_all
    WHERE user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'year', v_year,
    'month', v_month,
    'is_historical', v_period_end < now(),
    'top', COALESCE(v_top, '[]'::jsonb),
    'my_position', v_my_position,
    'my_qualified_count', COALESCE(v_my_qualified, 0)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_referral_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_user record;
  v_count_cadastrou int;
  v_count_ativou int;
  v_count_engajado int;
  v_position int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT id, referral_code, points_balance, points_earned_total, referral_trust_suspended
  INTO v_user FROM public.users WHERE id = v_user_id;

  SELECT
    COUNT(*) FILTER (WHERE status = 'cadastrou'),
    COUNT(*) FILTER (WHERE status = 'ativou'),
    COUNT(*) FILTER (WHERE status = 'engajado')
  INTO v_count_cadastrou, v_count_ativou, v_count_engajado
  FROM public.referrals
  WHERE referrer_user_id = v_user_id;

  SELECT pos INTO v_position FROM (
    SELECT u.id, ROW_NUMBER() OVER (ORDER BY count_qualified DESC) AS pos
    FROM (
      SELECT referrer_user_id AS id,
             COUNT(*) FILTER (WHERE status IN ('ativou', 'engajado')
                              AND COALESCE(ativou_at, engajou_at) >= date_trunc('month', now())) AS count_qualified
      FROM public.referrals
      GROUP BY referrer_user_id
      HAVING COUNT(*) FILTER (WHERE status IN ('ativou', 'engajado')
                              AND COALESCE(ativou_at, engajou_at) >= date_trunc('month', now())) > 0
    ) u
  ) ranked
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'referral_code', v_user.referral_code,
    'points_balance', v_user.points_balance,
    'points_earned_total', v_user.points_earned_total,
    'trust_suspended', v_user.referral_trust_suspended,
    'counts', jsonb_build_object(
      'cadastrou', v_count_cadastrou,
      'ativou', v_count_ativou,
      'engajado', v_count_engajado,
      'total', v_count_cadastrou + v_count_ativou + v_count_engajado
    ),
    'monthly_position', v_position
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_related_cards(p_id text, p_limit integer DEFAULT 8)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
WITH cur AS (
  SELECT
    set_id,
    base_pokemon_names,
    CASE WHEN number_norm ~ '^[0-9]+$' THEN number_norm::int ELSE NULL END AS num_int
  FROM pokemon_cards
  WHERE id = p_id
),
same_set AS (
  SELECT
    c.id, c.name, c.number, c.number_norm, c.image_small, c.set_name, c.slug
  FROM pokemon_cards c
  CROSS JOIN cur
  WHERE c.set_id = cur.set_id
    AND c.id <> p_id
    AND cur.num_int IS NOT NULL
    AND c.number_norm ~ '^[0-9]+$'
    AND c.image_small IS NOT NULL
  ORDER BY abs(c.number_norm::int - cur.num_int) ASC, c.number_norm::int ASC
  LIMIT p_limit
),
same_poke AS (
  SELECT
    c.id, c.name, c.number, c.image_small, c.set_name, c.set_release_date, c.slug
  FROM pokemon_cards c
  CROSS JOIN cur
  WHERE cur.base_pokemon_names IS NOT NULL
    AND c.base_pokemon_names && cur.base_pokemon_names
    AND c.id <> p_id
    AND c.image_small IS NOT NULL
  ORDER BY c.set_release_date DESC NULLS LAST
  LIMIT p_limit
)
SELECT jsonb_build_object(
  'pokemon_name', (SELECT base_pokemon_names[1] FROM cur),
  'same_set', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('id',s.id,'name',s.name,'number',s.number,'image_small',s.image_small,'set_name',s.set_name,'slug',s.slug)
      ORDER BY s.number_norm::int
    ) FROM same_set s
  ), '[]'::jsonb),
  'same_pokemon', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('id',p.id,'name',p.name,'number',p.number,'image_small',p.image_small,'set_name',p.set_name,'slug',p.slug)
      ORDER BY p.set_release_date DESC NULLS LAST
    ) FROM same_poke p
  ), '[]'::jsonb)
);
$function$
;

CREATE OR REPLACE FUNCTION public.get_scan_status(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_avulso int; v_usados int; v_reset timestamptz;
  v_is_pro bool; v_plano text; v_pro_exp timestamptz; v_trial timestamptz;
  v_scansmes int; v_disp int;
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(scan_creditos,0), coalesce(scan_mensal_usados,0), scan_mensal_reset,
         coalesce(is_pro,false), plano, pro_expira_em, trial_expires_at
    INTO v_avulso, v_usados, v_reset, v_is_pro, v_plano, v_pro_exp, v_trial
    FROM public.users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('scans_mes',0,'mensal_usados',0,'mensal_disp',0,'avulso',0,'total',0,'reset',null);
  END IF;

  v_scansmes := CASE
    WHEN v_plano IN ('pro_anual','anual','pro','mensal') AND (v_pro_exp IS NULL OR v_pro_exp > now()) THEN -1
    WHEN v_is_pro                                        AND (v_pro_exp IS NULL OR v_pro_exp > now()) THEN -1
    WHEN v_trial IS NOT NULL AND v_trial > now() THEN 10
    ELSE 0
  END;

  IF v_reset IS NULL OR now() >= v_reset THEN
    v_usados := 0;
  END IF;

  IF v_scansmes = -1 THEN
    RETURN json_build_object(
      'scans_mes', -1,
      'mensal_usados', v_usados,
      'mensal_disp', -1,
      'avulso', v_avulso,
      'total', -1,
      'reset', v_reset
    );
  END IF;

  v_disp := greatest(0, v_scansmes - v_usados);

  RETURN json_build_object(
    'scans_mes', v_scansmes,
    'mensal_usados', v_usados,
    'mensal_disp', v_disp,
    'avulso', v_avulso,
    'total', v_disp + v_avulso,
    'reset', v_reset
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_sinais_carta(p_dias integer DEFAULT 14, p_limit integer DEFAULT 2, p_min_vis integer DEFAULT 12, p_min_pico integer DEFAULT 2)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with param as (
    select
      (now() at time zone 'America/Sao_Paulo')::date as hoje,
      least(greatest(coalesce(p_dias, 14), 1), 90)   as dias,
      greatest(coalesce(p_limit, 2), 1)              as lim,
      greatest(coalesce(p_min_vis, 12), 1)           as min_vis,
      greatest(coalesce(p_min_pico, 2), 1)           as min_pico
  ),
  resumo as (
    select
      coalesce(sum(d.n), 0)::bigint      as eventos,
      count(distinct d.card_id)::int     as cartas,
      max(d.dia)                         as dado_ate
    from public.card_sinal_diario d, param p
    where d.dia > p.hoje - p.dias
  ),
  bruto as (
    select
      case when d.tipo in ('view_pub', 'view_app') then 'acessada' else 'procurada' end as grupo,
      d.card_id,
      sum(d.n)::int              as tot,
      sum(d.n_visitantes)::int   as vis,
      max(d.n_pico)::int         as pico,
      count(distinct d.dia)::int as dias
    from public.card_sinal_diario d, param p
    where d.dia > p.hoje - p.dias
      and d.tipo in ('view_pub', 'view_app', 'busca_troca')
    group by 1, 2
  ),
  elegivel as (
    select b.*,
           row_number() over (partition by b.grupo order by b.vis desc, b.tot desc, b.card_id) as rn
    from bruto b, param p
    where b.vis  >= p.min_vis
      and b.pico >= p.min_pico
      and b.dias >= 3
  ),
  nomeado as (
    select
      e.grupo,
      sum(e.vis)::int as vis,
      sum(e.tot)::int as tot,
      (array_agg(c.id          order by e.vis desc, c.id))[1] as id,
      (array_agg(c.slug        order by e.vis desc, c.id))[1] as slug,
      (array_agg(regexp_replace(coalesce(nullif(c.name_pt, ''), c.name), '\s*\([^)]*\)\s*$', '')
                               order by e.vis desc, c.id))[1] as nome,
      (array_agg(c.image_small order by e.vis desc, c.id))[1] as image_small,
      (array_agg(coalesce(nullif(c.preco_medio, 0), nullif(c.preco_normal, 0),
                          nullif(c.preco_foil_medio, 0), nullif(c.preco_reverse_medio, 0),
                          nullif(c.preco_promo_medio, 0))
                               order by e.vis desc, c.id))[1] as preco
    from elegivel e
    join public.pokemon_cards c on c.id = e.card_id
    where e.rn <= 40
      and coalesce(c.is_canary, false) = false
      and c.slug is not null
    group by e.grupo,
             lower(regexp_replace(coalesce(nullif(c.name_pt, ''), c.name), '\s*\([^)]*\)\s*$', ''))
  ),
  final as (
    select n.*, row_number() over (partition by n.grupo order by n.vis desc, n.id) as pos
    from nomeado n
  )
  select jsonb_build_object(
    'ok', true,
    'dias', (select dias from param),
    'eventos_janela',   (select eventos  from resumo),
    'cartas_distintas', (select cartas   from resumo),
    'dado_ate',         (select dado_ate from resumo),
    'acessadas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'slug', f.slug, 'nome', f.nome,
               'image_small', f.image_small, 'preco', f.preco, 'vis', f.vis
             ) order by f.pos)
      from final f, param p where f.grupo = 'acessada' and f.pos <= p.lim
    ), '[]'::jsonb),
    'procuradas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'slug', f.slug, 'nome', f.nome,
               'image_small', f.image_small, 'preco', f.preco, 'vis', f.vis
             ) order by f.pos)
      from final f, param p where f.grupo = 'procurada' and f.pos <= p.lim
    ), '[]'::jsonb)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_top_cards(lim integer DEFAULT 12)
 RETURNS TABLE(id text, name text, set_name text, image_small text, preco_medio numeric, slug text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct on (preco_medio) id, name, set_name, image_small, preco_medio, slug
  from pokemon_cards
  where preco_medio is not null
    and image_small is not null
    and id ~ '^[a-zA-Z0-9_-]+$'
  order by preco_medio desc, (id like 'liga-%')
  limit lim;
$function$
;

CREATE OR REPLACE FUNCTION public.get_unique_base_pokemon()
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
  SELECT json_agg(row_to_json(t)) FROM (
    SELECT
      base_name AS name,
      COUNT(*) AS card_count
    FROM (
      SELECT unnest(base_pokemon_names) AS base_name
      FROM pokemon_cards
      WHERE supertype = 'Pokémon'
        AND image_small IS NOT NULL
        AND base_pokemon_names IS NOT NULL
    ) expanded
    GROUP BY base_name
    ORDER BY base_name
  ) t;
$function$
;

CREATE OR REPLACE FUNCTION public.get_unique_pokemon()
 RETURNS TABLE(name text, types text[])
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT DISTINCT ON (name)
    name,
    types
  FROM pokemon_cards
  WHERE supertype = 'Pokémon'
    AND image_small IS NOT NULL
    AND id NOT LIKE 'liga-%'
    AND name IS NOT NULL
  ORDER BY name, set_release_date DESC NULLS LAST;
$function$
;

CREATE OR REPLACE FUNCTION public.get_watchlist()
 RETURNS TABLE(card_id text, name text, set_name text, image_small text, preco_medio numeric, pct numeric, slug text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with wl as (
    select card_id, created_at
    from watchlist
    where user_id = auth.uid()
  ),
  base as (
    select s.card_id,
           (array_agg(s.preco_medio order by s.snapshot_date asc))[1] as base_8d
    from price_snapshots s
    where s.card_id in (select card_id from wl)
      and s.snapshot_date >= current_date - 8
    group by s.card_id
  )
  select w.card_id, pc.name, pc.set_name, pc.image_small, pc.preco_medio,
         case
           when b.base_8d is not null and b.base_8d > 0
             and abs((pc.preco_medio - b.base_8d) / b.base_8d * 100) >= 0.5
           then round((pc.preco_medio - b.base_8d) / b.base_8d * 100, 1)
           else null
         end as pct,
         pc.slug
  from wl w
  join pokemon_cards pc on pc.id = w.card_id
  left join base b on b.card_id = w.card_id
  order by w.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.users (
    id, email, name, cpf, city, whatsapp, instagram, tiktok,
    data_nascimento, marketing_aceito, trial_expires_at, termos_aceitos_em,
    cep, logradouro, numero, complemento, bairro, uf,
    signup_utm_source, signup_utm_medium, signup_utm_campaign,
    signup_utm_content, signup_utm_term, signup_referrer,
    signup_landing_page, signup_first_seen_at,
    signup_last_utm_source, signup_last_utm_medium, signup_last_utm_campaign
  ) values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'cpf', ''),
    nullif(new.raw_user_meta_data->>'city', ''),
    nullif(new.raw_user_meta_data->>'whatsapp', ''),
    nullif(new.raw_user_meta_data->>'instagram', ''),
    nullif(new.raw_user_meta_data->>'tiktok', ''),
    case when new.raw_user_meta_data->>'data_nascimento' ~ '^\d{4}-\d{2}-\d{2}$'
         then (new.raw_user_meta_data->>'data_nascimento')::date else null end,
    coalesce((new.raw_user_meta_data->>'marketing_aceito')::boolean, false),
    now() + interval '7 days',
    now(),
    nullif(new.raw_user_meta_data->>'cep', ''),
    nullif(new.raw_user_meta_data->>'logradouro', ''),
    nullif(new.raw_user_meta_data->>'numero', ''),
    nullif(new.raw_user_meta_data->>'complemento', ''),
    nullif(new.raw_user_meta_data->>'bairro', ''),
    nullif(new.raw_user_meta_data->>'uf', ''),
    nullif(new.raw_user_meta_data->>'signup_utm_source', ''),
    nullif(new.raw_user_meta_data->>'signup_utm_medium', ''),
    nullif(new.raw_user_meta_data->>'signup_utm_campaign', ''),
    nullif(new.raw_user_meta_data->>'signup_utm_content', ''),
    nullif(new.raw_user_meta_data->>'signup_utm_term', ''),
    nullif(new.raw_user_meta_data->>'signup_referrer', ''),
    nullif(new.raw_user_meta_data->>'signup_landing_page', ''),
    -- Vem como ISO do cliente. Timestamp torto nao pode derrubar o cadastro.
    case when new.raw_user_meta_data->>'signup_first_seen_at' ~ '^\d{4}-\d{2}-\d{2}T'
         then (new.raw_user_meta_data->>'signup_first_seen_at')::timestamptz else null end,
    nullif(new.raw_user_meta_data->>'signup_last_utm_source', ''),
    nullif(new.raw_user_meta_data->>'signup_last_utm_medium', ''),
    nullif(new.raw_user_meta_data->>'signup_last_utm_campaign', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.importar_cartas_lote(items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  it jsonb; cid text; qty int;
  adicionadas int := 0; incrementadas int := 0; processadas int := 0;
  cap int := 32; c record; v_existed boolean;
begin
  if uid is null then return jsonb_build_object('erro','nao_autenticado'); end if;
  if items is null or jsonb_typeof(items) <> 'array' then return jsonb_build_object('erro','payload_invalido'); end if;

  for it in select value from jsonb_array_elements(items) loop
    exit when processadas >= cap;
    cid := it->>'card_id';
    qty := least(greatest(coalesce((it->>'quantidade')::int, 1), 1), 99);
    if cid is null or btrim(cid) = '' then continue; end if;

    select id, name, number, set_name, image_small, rarity
      into c from public.pokemon_cards where id = cid limit 1;
    if c.id is null then continue; end if;

    processadas := processadas + 1;

    -- so considera a PILHA nao-graduada (graduadas sao itens a parte)
    select exists(
      select 1 from public.user_cards
      where user_id = uid and pokemon_api_id = cid and graduada = false
    ) into v_existed;

    insert into public.user_cards
      (user_id, pokemon_api_id, card_id, card_name, card_image, set_name, rarity, variante, graduada, quantity)
    values
      (uid, cid, cid, c.name, c.image_small, c.set_name, c.rarity, 'normal', false, qty)
    on conflict (user_id, pokemon_api_id) where pokemon_api_id is not null and graduada = false
    do update set quantity = public.user_cards.quantity + excluded.quantity;

    if v_existed then incrementadas := incrementadas + 1; else adicionadas := adicionadas + 1; end if;
  end loop;

  return jsonb_build_object('adicionadas', adicionadas, 'incrementadas', incrementadas, 'processadas', processadas, 'teto', cap);
end $function$
;

CREATE OR REPLACE FUNCTION public.is_profile_public(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT perfil_publico FROM public.users WHERE id = uid), false)
$function$
;

CREATE OR REPLACE FUNCTION public.landing_stats()
 RETURNS TABLE(total_cards bigint, total_sets bigint, total_sets_official bigint, total_value_brl numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH s AS (SELECT cards_count, total_value_brl FROM set_index_stats())
  SELECT
    (SELECT count(*) FROM pokemon_cards)::bigint                  AS total_cards,
    (SELECT count(*) FROM s)::bigint                              AS total_sets,
    (SELECT count(*) FROM pokemon_sets)::bigint                   AS total_sets_official,
    (SELECT coalesce(sum(total_value_brl), 0) FROM s)             AS total_value_brl;
$function$
;

CREATE OR REPLACE FUNCTION public.limpar_entidades_html(txt text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select btrim(regexp_replace(
    replace(replace(replace(replace(replace(replace(replace(replace(
      coalesce(txt,''),
      '&9792;', '♀'), '&#9792;', '♀'),
      '&9794;', '♂'), '&#9794;', '♂'),
      '&nbsp;', ' '), '&amp;', '&'),
      '&quot;', '"'), '&#39;', ''''),
    '\s+', ' ', 'g'))
$function$
;

CREATE OR REPLACE FUNCTION public.listar_conversas()
 RETURNS TABLE(anuncio_id uuid, card_name text, card_image text, price numeric, status text, meu_papel text, outro_id uuid, outro_nome text, ultima_msg text, ultima_msg_at timestamp with time zone, ultima_msg_minha boolean, nao_lidas integer, ativa boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with convs as (
    select m.id as anuncio_id, m.card_name, m.card_image, m.price, m.status,
           case when m.user_id = auth.uid() then 'vendedor' else 'comprador' end as meu_papel,
           case when m.user_id = auth.uid() then m.buyer_id else m.user_id end as outro_id
    from marketplace m
    where (m.user_id = auth.uid() or m.buyer_id = auth.uid())
      and exists (select 1 from marketplace_mensagens mm where mm.anuncio_id = m.id)
  ),
  last_msg as (
    select distinct on (mm.anuncio_id) mm.anuncio_id, mm.body, mm.created_at, mm.sender_id
    from marketplace_mensagens mm
    where mm.anuncio_id in (select anuncio_id from convs)
    order by mm.anuncio_id, mm.created_at desc
  ),
  unread as (
    select mm.anuncio_id, count(*) as n
    from marketplace_mensagens mm
    where mm.anuncio_id in (select anuncio_id from convs)
      and mm.sender_id <> auth.uid() and mm.read_at is null
    group by mm.anuncio_id
  )
  select c.anuncio_id, c.card_name, c.card_image, c.price, c.status, c.meu_papel,
         c.outro_id, coalesce(pu.name, pu.username, 'Usuario') as outro_nome,
         lm.body, lm.created_at,
         (lm.sender_id = auth.uid()) as ultima_msg_minha,
         coalesce(u.n, 0)::int as nao_lidas,
         (c.status is distinct from 'concluido' and c.status is distinct from 'cancelado') as ativa
  from convs c
  left join last_msg lm on lm.anuncio_id = c.anuncio_id
  left join unread u on u.anuncio_id = c.anuncio_id
  left join public_users pu on pu.id = c.outro_id
  order by lm.created_at desc nulls last;
$function$
;

CREATE OR REPLACE FUNCTION public.lojas_append_foto(p_loja_id uuid, p_owner_id uuid, p_url text, p_max_fotos integer)
 RETURNS TABLE(out_fotos text[], out_length integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_fotos text[];
  v_current_length int;
  v_updated_fotos text[];
BEGIN
  -- Lock da linha pra prevenir race condition entre paralelos
  SELECT l.fotos INTO v_current_fotos
  FROM lojas l
  WHERE l.id = p_loja_id AND l.owner_user_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loja nao encontrada ou sem permissao';
  END IF;

  v_current_length := COALESCE(array_length(v_current_fotos, 1), 0);

  IF v_current_length >= p_max_fotos THEN
    RAISE EXCEPTION 'Limite de % fotos atingido', p_max_fotos;
  END IF;

  -- Append atomico (qualificando coluna pra evitar ambiguidade)
  v_updated_fotos := COALESCE(v_current_fotos, ARRAY[]::text[]) || ARRAY[p_url]::text[];

  UPDATE lojas
  SET fotos = v_updated_fotos
  WHERE lojas.id = p_loja_id AND lojas.owner_user_id = p_owner_id;

  -- Retorna resultado
  out_fotos := v_updated_fotos;
  out_length := COALESCE(array_length(v_updated_fotos, 1), 0);
  RETURN NEXT;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marcar_conversa_lida(p_anuncio_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_n int;
begin
  if v_uid is null then return 0; end if;
  if not exists (select 1 from marketplace where id = p_anuncio_id
                 and (user_id = v_uid or buyer_id = v_uid)) then
    return 0;
  end if;

  update marketplace_mensagens
    set read_at = now()
    where anuncio_id = p_anuncio_id and sender_id <> v_uid and read_at is null;
  get diagnostics v_n = row_count;

  update notifications
    set read = true
    where user_id = v_uid and type = 'mensagem' and read = false
      and (data->>'anuncio_id') = p_anuncio_id::text;

  return v_n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_referral_engaged(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_referral record;
  v_referrer_id uuid;
  v_current_balance int;
  v_bonus int := 200;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_params');
  END IF;

  SELECT * INTO v_referral FROM public.referrals
  WHERE referred_user_id = p_user_id AND status IN ('cadastrou', 'ativou')
  LIMIT 1;

  IF v_referral.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'reason', 'no_pending_or_active_referral');
  END IF;

  IF v_referral.is_suspicious THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'reason', 'suspicious');
  END IF;

  v_referrer_id := v_referral.referrer_user_id;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_referrer_id AND referral_trust_suspended = true) THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'reason', 'referrer_suspended');
  END IF;

  UPDATE public.referrals
  SET status = 'engajado',
      engajou_at = now(),
      ativou_at = COALESCE(ativou_at, now())
  WHERE id = v_referral.id;

  SELECT points_balance INTO v_current_balance FROM public.users WHERE id = v_referrer_id;

  INSERT INTO public.points_ledger (
    user_id, amount, reason, related_referral_id, balance_after, notes
  ) VALUES (
    v_referrer_id, v_bonus, 'referral_engajado', v_referral.id,
    v_current_balance + v_bonus,
    format('Indicação engajada (Pro): user_id=%s', p_user_id)
  );

  UPDATE public.users
  SET points_balance = points_balance + v_bonus,
      points_earned_total = points_earned_total + v_bonus
  WHERE id = v_referrer_id;

  RETURN jsonb_build_object(
    'ok', true,
    'engaged', true,
    'points_awarded', v_bonus,
    'referrer_user_id', v_referrer_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.master_set_card_rows(p_set_id text)
 RETURNS TABLE(id text, numero text, nome text, image_small text, sort_key integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with src as (select coalesce(card_source,'official') as cs from public.master_sets where set_id = p_set_id limit 1)
  select c.id,
    case when (select cs from src) = 'liga'
      then coalesce(substring(c.name from '\(([0-9]+/[0-9]+)\)'), '')
      else coalesce(c.number, '') end,
    case when (select cs from src) = 'liga'
      then btrim(regexp_replace(c.name, '\s*\([0-9]+/[0-9]+\)\s*$', ''))
      else c.name end,
    c.image_small,
    case when (select cs from src) = 'liga'
      then nullif(substring(c.name from '\(([0-9]+)/'), '')::int
      else nullif(regexp_replace(coalesce(c.number,''),'\D','','g'),'')::int end
  from public.pokemon_cards c
  where c.set_id = p_set_id
    and case when (select cs from src) = 'liga' then c.id like 'liga-%' else c.id not like 'liga-%' end;
$function$
;

CREATE OR REPLACE FUNCTION public.minhas_pastas()
 RETURNS TABLE(id uuid, nome text, descricao text, imagem_url text, publico boolean, destaque boolean, locked boolean, view_mode text, ordem integer, created_at timestamp with time zone, updated_at timestamp with time zone, qtd_cartas bigint, patrimonio numeric, carta_mais_cara_nome text, carta_mais_cara_valor numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with val as (
    select
      pcj.pasta_id,
      uc.card_name,
      (case uc.variante
        when 'foil'    then coalesce(pk.preco_foil_medio, 0)
        when 'reverse' then coalesce(pk.preco_reverse_medio, 0)
        when 'promo'   then coalesce(pk.preco_promo_medio, 0)
        else coalesce(pk.preco_medio, 0)
       end) as unit,
      uc.quantity
    from pasta_cards pcj
    join pastas p2     on p2.id = pcj.pasta_id and p2.user_id = auth.uid()
    join user_cards uc on uc.id = pcj.user_card_id
    left join pokemon_cards pk on pk.id = uc.pokemon_api_id
  ),
  agg as (
    select pasta_id, count(*) as qtd_cartas,
           coalesce(sum(unit * quantity), 0) as patrimonio,
           max(unit) as max_unit
    from val group by pasta_id
  )
  select
    p.id, p.nome, p.descricao, p.imagem_url,
    p.publico, p.destaque, p.locked, p.view_mode, p.ordem,
    p.created_at, p.updated_at,
    coalesce(a.qtd_cartas, 0) as qtd_cartas,
    coalesce(a.patrimonio, 0) as patrimonio,
    (select v.card_name from val v where v.pasta_id = p.id order by v.unit desc nulls last limit 1) as carta_mais_cara_nome,
    coalesce(a.max_unit, 0) as carta_mais_cara_valor
  from pastas p
  left join agg a on a.pasta_id = p.id
  where p.user_id = auth.uid()
  order by p.destaque desc, p.ordem asc, p.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.montar_card_slug(p_name text, p_number text, p_printed integer, p_set_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select nullif(btrim(regexp_replace(
    concat_ws('-',
      nullif(pkmn_slugify(coalesce(p_name,'')), ''),
      lower(nullif(regexp_replace(coalesce(p_number,''), '[^A-Za-z0-9]+', '', 'g'), '')),
      p_printed::text,
      nullif(case when p_set_name ilike 'Liga BR%' then '' else pkmn_slugify(coalesce(p_set_name,'')) end, '')
    ), '-+', '-', 'g'), '-'), '')
$function$
;

CREATE OR REPLACE FUNCTION public.pasta_detalhe(p_pasta_id uuid)
 RETURNS TABLE(user_card_id uuid, card_name text, card_image text, set_name text, set_id text, rarity text, variante text, quantity integer, pokemon_api_id text, unit numeric, posicao integer, added_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    uc.id, uc.card_name, uc.card_image, uc.set_name, uc.set_id,
    uc.rarity, uc.variante, uc.quantity, uc.pokemon_api_id,
    (case uc.variante
      when 'foil'    then coalesce(pk.preco_foil_medio, 0)
      when 'reverse' then coalesce(pk.preco_reverse_medio, 0)
      when 'promo'   then coalesce(pk.preco_promo_medio, 0)
      else coalesce(pk.preco_medio, 0)
     end) as unit,
    pcj.posicao,
    pcj.added_at
  from pasta_cards pcj
  join pastas p      on p.id = pcj.pasta_id and p.user_id = auth.uid()
  join user_cards uc on uc.id = pcj.user_card_id
  left join pokemon_cards pk on pk.id = uc.pokemon_api_id
  where pcj.pasta_id = p_pasta_id
  order by pcj.posicao asc nulls last, pcj.added_at asc;
$function$
;

CREATE OR REPLACE FUNCTION public.pasta_publica(p_pasta_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with alvo as (
    select p.id, p.nome, p.descricao, p.imagem_url, p.view_mode, p.user_id,
           u.username, u.name, u.perfil_ocultar_valores as ocultar
    from pastas p
    join users u on u.id = p.user_id
    where p.id = p_pasta_id
      and not coalesce(p.locked,false)
      and u.perfil_publico = true
      and u.perfil_mostrar_pastas = true
      and (u.data_nascimento is null or u.data_nascimento <= (current_date - interval '18 years'))
    limit 1
  ),
  cards as (
    select
      uc.id as user_card_id, uc.card_name, uc.card_image, uc.set_name, uc.set_id,
      uc.rarity, uc.variante, uc.quantity, uc.pokemon_api_id, pcj.posicao,
      (case uc.variante
        when 'foil' then coalesce(pk.preco_foil_medio,0)
        when 'reverse' then coalesce(pk.preco_reverse_medio,0)
        when 'promo' then coalesce(pk.preco_promo_medio,0)
        else coalesce(pk.preco_medio,0) end) as unit
    from alvo a
    join pasta_cards pcj on pcj.pasta_id = a.id
    join user_cards uc on uc.id = pcj.user_card_id
    left join pokemon_cards pk on pk.id = uc.pokemon_api_id
    order by pcj.posicao asc nulls last, pcj.added_at asc
  )
  select case when not exists (select 1 from alvo) then null
    else jsonb_build_object(
      'pasta', (select jsonb_build_object('id',a.id,'nome',a.nome,'descricao',a.descricao,'imagem_url',a.imagem_url,'view_mode',a.view_mode) from alvo a),
      'owner', (select jsonb_build_object('username',a.username,'name',a.name,'ocultar_valores',a.ocultar) from alvo a),
      'stats', jsonb_build_object(
        'qtd', (select count(*) from cards),
        'patrimonio', case when (select ocultar from alvo) then null else (select coalesce(sum(unit*quantity),0) from cards) end
      ),
      'cards', coalesce((select jsonb_agg(jsonb_build_object(
        'user_card_id', user_card_id, 'card_name', card_name, 'card_image', card_image,
        'set_name', set_name, 'rarity', rarity, 'variante', variante, 'quantity', quantity,
        'posicao', posicao,
        'unit', case when (select ocultar from alvo) then null else unit end
      )) from cards), '[]'::jsonb)
    ) end;
$function$
;

CREATE OR REPLACE FUNCTION public.pastas_colecao_topo()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_hero uuid;
  v_result jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('hero', null, 'outras', '[]'::jsonb, 'total', 0);
  end if;

  -- hero = pasta fixada (destaque) senao a mais recente, sempre entre as nao-travadas
  select id into v_hero
  from pastas
  where user_id = v_uid and not coalesce(locked,false)
  order by destaque desc, created_at desc
  limit 1;

  with base as (
    select p.id, p.nome, p.descricao, p.imagem_url, p.created_at, p.destaque,
           coalesce(p.locked,false) as locked
    from pastas p where p.user_id = v_uid
  ),
  val as (
    select pcj.pasta_id, uc.card_name, uc.card_image,
      (case uc.variante
        when 'foil' then coalesce(pk.preco_foil_medio,0)
        when 'reverse' then coalesce(pk.preco_reverse_medio,0)
        when 'promo' then coalesce(pk.preco_promo_medio,0)
        else coalesce(pk.preco_medio,0) end) as unit,
      uc.quantity
    from base b
    join pasta_cards pcj on pcj.pasta_id = b.id
    join user_cards uc on uc.id = pcj.user_card_id
    left join pokemon_cards pk on pk.id = uc.pokemon_api_id
  ),
  agg as (
    select pasta_id, count(*) qtd, coalesce(sum(unit*quantity),0) patrimonio
    from val group by pasta_id
  )
  select jsonb_build_object(
    'hero', (
      select jsonb_build_object(
        'id', b.id, 'nome', b.nome, 'descricao', b.descricao, 'imagem_url', b.imagem_url,
        'qtd', coalesce(a.qtd,0), 'patrimonio', coalesce(a.patrimonio,0),
        'top_cards', coalesce((
          select jsonb_agg(jsonb_build_object('nome', t.card_name, 'img', t.card_image))
          from (
            select card_name, card_image from val v
            where v.pasta_id = b.id and v.card_image is not null
            order by v.unit desc nulls last limit 3
          ) t
        ), '[]'::jsonb)
      )
      from base b left join agg a on a.pasta_id = b.id
      where b.id = v_hero
    ),
    'outras', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'nome', b.nome, 'imagem_url', b.imagem_url,
        'qtd', coalesce(a.qtd,0), 'patrimonio', coalesce(a.patrimonio,0),
        'locked', b.locked
      ) order by b.locked asc, b.destaque desc, b.created_at desc)
      from base b left join agg a on a.pasta_id = b.id
      where b.id is distinct from v_hero
    ), '[]'::jsonb),
    'total', (select count(*) from base)
  ) into v_result;

  return v_result;
end $function$
;

CREATE OR REPLACE FUNCTION public.perfil_pastas_publicas(p_id text)
 RETURNS TABLE(id uuid, nome text, descricao text, imagem_url text, qtd_cartas bigint, patrimonio numeric, carta_mais_cara_nome text, carta_mais_cara_valor numeric, ocultar_valores boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with alvo as (
    select u.*
    from users u
    where (
      u.username = p_id
      or u.id = (case
                   when lower(p_id) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                   then lower(p_id)::uuid else null end)
    )
    and u.perfil_publico = true
    and u.perfil_mostrar_pastas = true
    and (u.data_nascimento is null or u.data_nascimento <= (current_date - interval '18 years'))
    limit 1
  ),
  val as (
    select pcj.pasta_id, uc.card_name,
      (case uc.variante
        when 'foil' then coalesce(pk.preco_foil_medio,0)
        when 'reverse' then coalesce(pk.preco_reverse_medio,0)
        when 'promo' then coalesce(pk.preco_promo_medio,0)
        else coalesce(pk.preco_medio,0) end) as unit,
      uc.quantity
    from pastas p
    join alvo a on a.id = p.user_id and not coalesce(p.locked,false)
    join pasta_cards pcj on pcj.pasta_id = p.id
    join user_cards uc on uc.id = pcj.user_card_id
    left join pokemon_cards pk on pk.id = uc.pokemon_api_id
  ),
  agg as (
    select pasta_id, count(*) qtd, coalesce(sum(unit*quantity),0) patrimonio, max(unit) max_unit
    from val group by pasta_id
  )
  select
    p.id, p.nome, p.descricao, p.imagem_url,
    coalesce(ag.qtd,0) as qtd_cartas,
    case when a.perfil_ocultar_valores then null else coalesce(ag.patrimonio,0) end as patrimonio,
    case when a.perfil_ocultar_valores then null
         else (select v.card_name from val v where v.pasta_id = p.id order by v.unit desc nulls last limit 1) end as carta_mais_cara_nome,
    case when a.perfil_ocultar_valores then null else coalesce(ag.max_unit,0) end as carta_mais_cara_valor,
    a.perfil_ocultar_valores as ocultar_valores
  from alvo a
  join pastas p on p.user_id = a.id and not coalesce(p.locked,false)
  left join agg ag on ag.pasta_id = p.id
  order by p.destaque desc, p.ordem asc, p.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.pkmn_slugify(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(
            translate(
              replace(replace(p, '♀', '-f'), '♂', '-m'),
              'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
              'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
            )
          ),
          '[^a-z0-9 -]', '', 'g'
        ),
        '[ ]+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.pokedex_landing_data()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'stats', jsonb_build_object(
      'total_cards',    (SELECT count(*) FROM pokemon_cards),
      'total_sets',     (SELECT count(DISTINCT set_id) FROM pokemon_cards WHERE set_id IS NOT NULL),
      'total_rarities', (SELECT count(DISTINCT rarity) FROM pokemon_cards WHERE rarity IS NOT NULL AND rarity <> ''),
      'total_series',   (SELECT count(DISTINCT set_series) FROM pokemon_cards WHERE set_series IS NOT NULL AND set_series <> '' AND set_name NOT LIKE 'Liga BR%')
    ),
    'raridades', (
      SELECT jsonb_object_agg(rarity, n) FROM (
        SELECT rarity, count(*) AS n FROM pokemon_cards
        WHERE rarity IN ('Common','Uncommon','Rare','Rare Holo','Promo','Rare Ultra','Illustration Rare','Special Illustration Rare','Hyper Rare')
        GROUP BY rarity
      ) r
    ),
    'sets_recentes', (
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.rel DESC) FROM (
        SELECT set_name AS name, max(set_release_date) AS rel, count(*)::int AS cards, max(set_logo) AS logo
        FROM pokemon_cards
        WHERE set_release_date IS NOT NULL AND set_release_date <> '' AND set_name NOT LIKE 'Liga BR%'
        GROUP BY set_name
        ORDER BY max(set_release_date) DESC
        LIMIT 9
      ) x
    ),
    'top_valiosas', (
      SELECT jsonb_object_agg(id, preco) FROM (
        SELECT id,
          GREATEST(COALESCE(preco_medio,0),COALESCE(preco_foil_medio,0),COALESCE(preco_promo_medio,0),COALESCE(preco_reverse_medio,0),COALESCE(preco_pokeball_medio,0)) AS preco
        FROM pokemon_cards
        WHERE id IN ('sv8pt5-161','sv4pt5-232','sv8-238','sv8pt5-146','sv8pt5-149','sv9-187')
      ) t
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.qualify_referral(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_referral record;
  v_referrer_id uuid;
  v_email_confirmed boolean;
  v_card_count int;
  v_days_since_signup numeric;
  v_qualified_count int;
  v_points int;
  v_monthly_count int;
  v_trust_pct numeric;
  v_total_count int;
  v_current_balance int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_params');
  END IF;

  SELECT * INTO v_referral FROM public.referrals
  WHERE referred_user_id = p_user_id AND status = 'cadastrou'
  LIMIT 1;

  IF v_referral.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'reason', 'no_pending_referral');
  END IF;

  IF v_referral.is_suspicious THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'reason', 'suspicious');
  END IF;

  v_referrer_id := v_referral.referrer_user_id;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_referrer_id AND referral_trust_suspended = true) THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'reason', 'referrer_suspended');
  END IF;

  SELECT (email_confirmed_at IS NOT NULL) INTO v_email_confirmed
  FROM auth.users WHERE id = p_user_id;
  IF NOT COALESCE(v_email_confirmed, false) THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'reason', 'email_not_confirmed');
  END IF;

  -- ⚠️ FIX: tabela correta é user_cards, não cards
  SELECT COUNT(*) INTO v_card_count FROM public.user_cards WHERE user_id = p_user_id;
  IF v_card_count < 5 THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'reason', 'not_enough_cards', 'cards', v_card_count);
  END IF;

  v_days_since_signup := EXTRACT(EPOCH FROM (now() - v_referral.cadastrou_at)) / 86400;
  IF v_days_since_signup < 7 THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'reason', 'cooldown', 'days', v_days_since_signup);
  END IF;

  SELECT COUNT(*) INTO v_monthly_count
  FROM public.points_ledger
  WHERE user_id = v_referrer_id
    AND reason = 'referral_ativou'
    AND created_at >= date_trunc('month', now());
  IF v_monthly_count >= 50 THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'reason', 'monthly_cap_reached');
  END IF;

  SELECT COUNT(*) INTO v_total_count FROM public.referrals WHERE referrer_user_id = v_referrer_id;
  SELECT COUNT(*) INTO v_qualified_count FROM public.referrals
    WHERE referrer_user_id = v_referrer_id AND status IN ('ativou', 'engajado');
  IF v_total_count >= 5 THEN
    v_trust_pct := v_qualified_count::numeric / v_total_count;
    IF v_trust_pct < 0.5 THEN
      UPDATE public.users SET referral_trust_suspended = true WHERE id = v_referrer_id;
      RETURN jsonb_build_object('ok', true, 'noop', true, 'reason', 'trust_suspended');
    END IF;
  END IF;

  v_points := CASE
    WHEN v_qualified_count = 0 THEN 30
    WHEN v_qualified_count = 1 THEN 50
    WHEN v_qualified_count = 2 THEN 70
    ELSE 100
  END;

  UPDATE public.referrals
  SET status = 'ativou', ativou_at = now()
  WHERE id = v_referral.id;

  SELECT points_balance INTO v_current_balance FROM public.users WHERE id = v_referrer_id;

  INSERT INTO public.points_ledger (
    user_id, amount, reason, related_referral_id, balance_after, notes
  ) VALUES (
    v_referrer_id, v_points, 'referral_ativou', v_referral.id,
    v_current_balance + v_points,
    format('Indicação ativada: user_id=%s', p_user_id)
  );

  UPDATE public.users
  SET points_balance = points_balance + v_points,
      points_earned_total = points_earned_total + v_points
  WHERE id = v_referrer_id;

  RETURN jsonb_build_object(
    'ok', true,
    'qualified', true,
    'points_awarded', v_points,
    'referrer_user_id', v_referrer_id,
    'tier_index', v_qualified_count
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rebuild_base_pokemon_names()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  updated integer := 0;
BEGIN
  -- Atualiza base_pokemon_names para cada carta Pokémon
  -- Faz match de qualquer espécie cujo nome aparece como palavra inteira no nome da carta
  UPDATE pokemon_cards pc
  SET base_pokemon_names = (
    SELECT ARRAY_AGG(DISTINCT s.name_en ORDER BY s.name_en)
    FROM pokemon_species s
    WHERE 
      -- Match simples: nome da espécie aparece no nome da carta
      pc.name ILIKE ('%' || s.name_en || '%')
      OR
      -- Match com hífen substituído por espaço: "Ho-Oh" match em "Ho Oh"
      pc.name ILIKE ('%' || replace(s.name_en, '-', ' ') || '%')
      OR
      -- Match reverso: "M Blastoise" → "Blastoise"
      -- "Alolan Ninetales" → "Ninetales"
      -- "Mega Manectric" → "Manectric"
      -- Verifica se o nome da espécie está no final ou após um espaço
      pc.name ~* ('(^|\s|-)' || regexp_replace(s.name_en, '[-.]', '.', 'g') || '(\s|$|\[|-|GX|EX|V|ex)')
  )
  WHERE pc.supertype = 'Pokémon';

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN 'Updated ' || updated || ' cards';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.redeem_points(p_reward_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_reward record;
  v_user record;
  v_redemption_id uuid;
  v_new_balance int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_reward FROM public.rewards
  WHERE id = p_reward_id AND active = true
  LIMIT 1
  FOR UPDATE;

  IF v_reward.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reward_not_found');
  END IF;

  IF v_reward.stock IS NOT NULL AND v_reward.stock <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'out_of_stock');
  END IF;

  SELECT id, points_balance INTO v_user FROM public.users
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_user.points_balance < v_reward.cost_points THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_points',
      'balance', v_user.points_balance, 'cost', v_reward.cost_points);
  END IF;

  INSERT INTO public.point_redemptions (user_id, reward_id, cost_points, status)
  VALUES (v_user_id, p_reward_id, v_reward.cost_points, 'pending')
  RETURNING id INTO v_redemption_id;

  IF v_reward.stock IS NOT NULL THEN
    UPDATE public.rewards SET stock = stock - 1 WHERE id = p_reward_id;
  END IF;

  v_new_balance := v_user.points_balance - v_reward.cost_points;

  INSERT INTO public.points_ledger (
    user_id, amount, reason, related_redemption_id, balance_after, notes
  ) VALUES (
    v_user_id, -v_reward.cost_points,
    format('redemption_%s', v_reward.sku),
    v_redemption_id, v_new_balance,
    format('Resgate: %s', v_reward.title)
  );

  UPDATE public.users SET points_balance = v_new_balance WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'redemption_id', v_redemption_id,
    'new_balance', v_new_balance,
    'reward_sku', v_reward.sku
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_sinal_carta(p_tipo text, p_card_id text, p_visitante text, p_origem smallint DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '2s'
 SET lock_timeout TO '300ms'
AS $function$
declare
  v_dia    date;
  v_hora   smallint;
  v_quota  integer;
  v_ins    integer;
  c_teto   constant integer := 25000;
begin
  if p_tipo is null
     or p_tipo not in ('view_pub', 'view_app', 'busca_troca', 'busca_colecao') then
    return;
  end if;
  if p_visitante is null or p_visitante !~ '^[0-9a-f]{16}$' then
    return;
  end if;
  if p_card_id is null
     or p_card_id !~ '^[A-Za-z0-9][A-Za-z0-9._!?-]{1,127}$' then
    return;
  end if;

  v_dia  := (now() at time zone 'America/Sao_Paulo')::date;
  v_hora := extract(hour from (now() at time zone 'America/Sao_Paulo'))::smallint;

  select linhas into v_quota from public.card_sinal_quota where dia = v_dia;
  if coalesce(v_quota, 0) >= c_teto then
    return;
  end if;

  if not exists (select 1 from public.pokemon_cards where id = p_card_id) then
    return;
  end if;

  insert into public.card_sinal_evento (dia, hora, tipo, card_id, visitante, origem)
  values (v_dia, v_hora, p_tipo, p_card_id, lower(p_visitante), coalesce(p_origem, 0))
  on conflict do nothing;

  get diagnostics v_ins = row_count;

  if v_ins = 1 then
    insert into public.card_sinal_quota (dia, linhas)
    values (v_dia, 1)
    on conflict (dia) do update
      set linhas = public.card_sinal_quota.linhas + 1;
  end if;

exception
  when others then
    raise warning '[registrar_sinal_carta] % / %', sqlstate, sqlerrm;
    return;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reordenar_pasta(p_pasta_id uuid, p_itens jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from pastas where id = p_pasta_id and user_id = auth.uid()) then
    raise exception 'not_owner';
  end if;

  update pasta_cards pc
     set posicao = (e->>'pos')::int
  from jsonb_array_elements(p_itens) as e
  where pc.pasta_id = p_pasta_id
    and pc.user_card_id = (e->>'id')::uuid;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.restaurar_estoque_produto(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not exists (
    select 1 from pedidos
    where produto_id = p_id
      and status in ('cancelado', 'reembolsado')
  ) then
    raise exception 'restaurar_estoque_produto: sem pedido cancelado para o produto %', p_id
      using errcode = '42501';
  end if;

  update loja_produtos
     set estoque    = estoque + 1,
         vendidos   = greatest(vendidos - 1, 0),
         updated_at = now()
   where id = p_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.restore_scan_credit(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_avulso int; v_usados int; v_reset timestamptz;
  v_is_pro bool; v_plano text; v_pro_exp timestamptz; v_trial timestamptz;
  v_scansmes int;
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(scan_creditos,0), coalesce(scan_mensal_usados,0), scan_mensal_reset,
         coalesce(is_pro,false), plano, pro_expira_em, trial_expires_at
    INTO v_avulso, v_usados, v_reset, v_is_pro, v_plano, v_pro_exp, v_trial
    FROM public.users WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN RETURN 0; END IF;

  v_scansmes := CASE
    WHEN v_plano IN ('pro_anual','anual','pro','mensal') AND (v_pro_exp IS NULL OR v_pro_exp > now()) THEN -1
    WHEN v_is_pro                                        AND (v_pro_exp IS NULL OR v_pro_exp > now()) THEN -1
    WHEN v_trial IS NOT NULL AND v_trial > now() THEN 10
    ELSE 0
  END;

  IF v_usados > 0 THEN
    v_usados := v_usados - 1;
    UPDATE public.users SET scan_mensal_usados = v_usados WHERE id = p_user_id;
  ELSE
    v_avulso := v_avulso + 1;
    UPDATE public.users SET scan_creditos = v_avulso WHERE id = p_user_id;
  END IF;

  IF v_scansmes = -1 THEN RETURN -1; END IF;

  RETURN greatest(0, v_scansmes - v_usados) + v_avulso;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_index_stats()
 RETURNS TABLE(set_id text, cards_count bigint, total_value_brl numeric, sample_set_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select set_id, cards_count, total_value_brl, sample_set_name
  from mv_set_index_stats
$function$
;

CREATE OR REPLACE FUNCTION public.set_pasta_ativa(p_pasta_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_pro boolean; v_owner uuid;
begin
  if v_uid is null then return false; end if;
  select user_id into v_owner from pastas where id = p_pasta_id;
  if v_owner is null or v_owner <> v_uid then return false; end if;
  v_pro := public.user_pastas_ilimitadas(v_uid);
  if coalesce(v_pro, false) then
    update pastas set locked = false where user_id = v_uid and locked = true;
    return true;
  end if;
  update pastas set locked = (id <> p_pasta_id) where user_id = v_uid;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.sitemap_set_ids()
 RETURNS TABLE(set_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT set_id
  FROM pokemon_cards
  WHERE set_id IS NOT NULL
$function$
;

CREATE OR REPLACE FUNCTION public.smart_search_cards(q text, limit_n integer DEFAULT 60, offset_n integer DEFAULT 0)
 RETURNS SETOF pokemon_cards_all
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  query_text text := lower(trim(coalesce(q, '')));
  tokens text[];
  non_year_tokens text[] := ARRAY[]::text[];
  yr text := NULL;
  t text;
  last_idx int;
  first_token text;
  name_part text;
  number_part text;
  total_part text;
  snum text;
  stotal text;
  num_regex text;
  resolved_set_id text;
  number_list text[];
  number_regex text := '^([a-z]+)?[0-9]+[a-z]?$';
  year_regex text := '^(199[6-9]|20[0-3][0-9])$';
  sql text;
  where_extra text := '';
  rel_order text := '';
BEGIN
  IF query_text = '' THEN RETURN; END IF;

  -- Frente 2: traduz termos PT->EN (energia/tipos/ignicao/treinador...) antes de buscar.
  -- Numeros e nomes de Pokemon (nao mapeados) passam intactos.
  query_text := public.traduzir_busca_pt(query_text);
  IF query_text = '' THEN RETURN; END IF;

  -- multi-termo por virgula
  IF query_text LIKE '%,%' THEN
    SELECT ARRAY(
      SELECT trim(s) FROM unnest(string_to_array(query_text, ',')) AS s
      WHERE trim(s) <> ''
    ) INTO number_list;
    IF array_length(number_list, 1) IS NULL THEN RETURN; END IF;
    RETURN QUERY
    SELECT DISTINCT pc.* FROM unnest(number_list) AS tk
    CROSS JOIN LATERAL smart_search_cards(tk, limit_n, 0) AS pc
    LIMIT limit_n OFFSET offset_n;
    RETURN;
  END IF;

  -- busca com barra: "nome 022/071" ou "022/071"
  IF query_text LIKE '%/%' THEN
    number_part := trim(split_part(query_text, '/', 1));
    total_part  := trim(split_part(query_text, '/', 2));
    IF number_part LIKE '% %' THEN
      tokens := string_to_array(number_part, ' ');
      last_idx := array_length(tokens, 1);
      name_part := trim(array_to_string(tokens[1:last_idx-1], ' '));
      number_part := tokens[last_idx];
    ELSE
      name_part := NULL;
    END IF;

    snum   := nullif(regexp_replace(regexp_replace(coalesce(number_part,''), '[^0-9]', '', 'g'), '^0+', ''), '');
    stotal := nullif(regexp_replace(regexp_replace(coalesce(total_part,''),  '[^0-9]', '', 'g'), '^0+', ''), '');

    IF snum IS NOT NULL THEN
      num_regex := '\(0*' || snum || '/';
      IF stotal IS NOT NULL THEN
        num_regex := num_regex || '0*' || stotal || '\)';
      END IF;

      IF name_part IS NOT NULL AND name_part <> '' THEN
        RETURN QUERY
        SELECT pc.* FROM pokemon_cards pc
        WHERE pc.name ILIKE '%' || name_part || '%'
          AND ( pc.number_norm = snum OR pc.name ~* num_regex )
        ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
        LIMIT limit_n OFFSET offset_n;
      ELSE
        RETURN QUERY
        SELECT pc.* FROM pokemon_cards pc
        WHERE ( pc.number_norm = snum OR pc.name ~* num_regex )
          AND ( stotal IS NULL OR pc.set_total::text = stotal OR pc.name ~* num_regex )
        ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
        LIMIT limit_n OFFSET offset_n;
      END IF;
      RETURN;
    ELSIF name_part IS NOT NULL AND name_part <> '' THEN
      RETURN QUERY
      SELECT pc.* FROM pokemon_cards pc
      WHERE pc.name ILIKE '%' || name_part || '%'
      ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;
  END IF;

  -- tokenizacao + ano
  tokens := string_to_array(query_text, ' ');
  FOREACH t IN ARRAY tokens LOOP
    IF t <> '' THEN
      IF yr IS NULL AND t ~ year_regex THEN
        yr := t;
      ELSE
        non_year_tokens := non_year_tokens || t;
      END IF;
    END IF;
  END LOOP;

  IF yr IS NULL THEN
    last_idx := array_length(tokens, 1);

    IF last_idx >= 2 AND tokens[last_idx] ~ number_regex THEN
      first_token := tokens[1];
      number_part := tokens[last_idx];

      IF last_idx = 2 THEN
        SELECT sa.set_id INTO resolved_set_id FROM set_aliases sa WHERE sa.alias = first_token LIMIT 1;
        IF resolved_set_id IS NULL THEN
          IF EXISTS (SELECT 1 FROM pokemon_cards WHERE set_id = first_token LIMIT 1) THEN
            resolved_set_id := first_token;
          END IF;
        END IF;
        IF resolved_set_id IS NOT NULL THEN
          snum := regexp_replace(number_part, '0*([0-9]+)', '\1', 'g');
          RETURN QUERY
          SELECT pc.* FROM pokemon_cards pc
          WHERE pc.set_id = resolved_set_id AND pc.number_norm = snum
          ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
          LIMIT limit_n OFFSET offset_n;
          RETURN;
        END IF;
      END IF;

      name_part := array_to_string(tokens[1:last_idx-1], ' ');
      snum := regexp_replace(number_part, '0*([0-9]+)', '\1', 'g');
      RETURN QUERY
      SELECT pc.* FROM pokemon_cards pc
      WHERE pc.name ILIKE '%' || name_part || '%'
        AND ( pc.number_norm = snum OR pc.name ~* ('\(0*' || snum || '/') )
      ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;

    IF last_idx = 1 AND tokens[1] ~ number_regex THEN
      snum := regexp_replace(tokens[1], '0*([0-9]+)', '\1', 'g');
      RETURN QUERY
      SELECT pc.* FROM pokemon_cards pc
      WHERE pc.number_norm = snum
      ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;
  END IF;

  -- 1 token: fuzzy (pg_trgm)
  IF array_length(non_year_tokens, 1) = 1 AND yr IS NULL THEN
    first_token := non_year_tokens[1];
    RETURN QUERY
    SELECT pc.* FROM pokemon_cards pc
    WHERE pc.name ILIKE '%' || first_token || '%'
       OR ( length(first_token) >= 4 AND pc.name % first_token )
    ORDER BY
      CASE WHEN lower(pc.name) = first_token THEN 0
           WHEN lower(pc.name) LIKE first_token || '%' THEN 1
           WHEN pc.name ILIKE '%' || first_token || '%' THEN 2
           ELSE 3 END,
      similarity(pc.name, first_token) DESC,
      (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
    LIMIT limit_n OFFSET offset_n;
    RETURN;
  END IF;

  -- fluxo geral (dinamico, parametrizado via %L) - AND por token (ordem nao importa)
  IF yr IS NOT NULL THEN
    where_extra := where_extra || format(' AND left(pc.set_release_date,4) = %L', yr);
  END IF;
  IF array_length(non_year_tokens, 1) IS NOT NULL THEN
    FOREACH t IN ARRAY non_year_tokens LOOP
      where_extra := where_extra || format(' AND (pc.name ILIKE %L OR pc.set_name ILIKE %L)', '%'||t||'%', '%'||t||'%');
    END LOOP;
    first_token := non_year_tokens[1];
    rel_order := format('CASE WHEN lower(pc.name)=%L THEN 0 WHEN lower(pc.name) LIKE %L THEN 1 ELSE 2 END, ',
                        first_token, first_token||'%');
  END IF;

  sql := 'SELECT pc.* FROM pokemon_cards pc WHERE TRUE' || where_extra ||
         ' ORDER BY ' || rel_order || '(pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id' ||
         ' LIMIT $1 OFFSET $2';
  RETURN QUERY EXECUTE sql USING limit_n, offset_n;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.smart_search_cards_v2(q text, limit_n integer DEFAULT 60, offset_n integer DEFAULT 0)
 RETURNS SETOF pokemon_cards_all
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  query_text text := lower(trim(coalesce(q, '')));
  tokens text[];
  non_year_tokens text[] := ARRAY[]::text[];
  yr text := NULL;
  t text;
  last_idx int;
  first_token text;
  name_part text;
  number_part text;
  total_part text;
  snum text;
  stotal text;
  num_regex text;
  resolved_set_id text;
  number_list text[];
  number_regex text := '^([a-z]+)?[0-9]+[a-z]?$';
  year_regex text := '^(199[6-9]|20[0-3][0-9])$';
  sql text;
  where_extra text := '';
  rel_order text := '';
BEGIN
  IF query_text = '' THEN RETURN; END IF;

  query_text := public.traduzir_busca_pt(query_text);
  IF query_text = '' THEN RETURN; END IF;

  -- MUDANCA 1: normaliza a query UMA vez. Daqui pra baixo todo termo ja esta
  -- sem acento, e cada comparacao usa f_unaccent do lado da coluna.
  query_text := public.f_unaccent(query_text);

  -- multi-termo por virgula
  IF query_text LIKE '%,%' THEN
    SELECT ARRAY(
      SELECT trim(s) FROM unnest(string_to_array(query_text, ',')) AS s
      WHERE trim(s) <> ''
    ) INTO number_list;
    IF array_length(number_list, 1) IS NULL THEN RETURN; END IF;
    RETURN QUERY
    SELECT DISTINCT pc.* FROM unnest(number_list) AS tk
    CROSS JOIN LATERAL smart_search_cards_v2(tk, limit_n, 0) AS pc
    LIMIT limit_n OFFSET offset_n;
    RETURN;
  END IF;

  -- busca com barra: "nome 022/071" ou "022/071"
  IF query_text LIKE '%/%' THEN
    number_part := trim(split_part(query_text, '/', 1));
    total_part  := trim(split_part(query_text, '/', 2));
    IF number_part LIKE '% %' THEN
      tokens := string_to_array(number_part, ' ');
      last_idx := array_length(tokens, 1);
      name_part := trim(array_to_string(tokens[1:last_idx-1], ' '));
      number_part := tokens[last_idx];
    ELSE
      name_part := NULL;
    END IF;

    snum   := nullif(regexp_replace(regexp_replace(coalesce(number_part,''), '[^0-9]', '', 'g'), '^0+', ''), '');
    stotal := nullif(regexp_replace(regexp_replace(coalesce(total_part,''),  '[^0-9]', '', 'g'), '^0+', ''), '');

    IF snum IS NOT NULL THEN
      num_regex := '\(0*' || snum || '/';
      IF stotal IS NOT NULL THEN
        num_regex := num_regex || '0*' || stotal || '\)';
      END IF;

      IF name_part IS NOT NULL AND name_part <> '' THEN
        -- MUDANCA 2: aceita typo no nome ("skarmony 060/084" -> Skarmory)
        RETURN QUERY
        SELECT pc.* FROM pokemon_cards pc
        WHERE ( public.f_unaccent(pc.name) ILIKE '%' || name_part || '%'
                OR ( length(name_part) >= 4 AND public.f_unaccent(pc.name) % name_part ) )
          AND ( pc.number_norm = snum OR pc.name ~* num_regex )
        ORDER BY similarity(public.f_unaccent(pc.name), name_part) DESC,
                 (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
        LIMIT limit_n OFFSET offset_n;
      ELSE
        RETURN QUERY
        SELECT pc.* FROM pokemon_cards pc
        WHERE ( pc.number_norm = snum OR pc.name ~* num_regex )
          AND ( stotal IS NULL OR pc.set_total::text = stotal OR pc.name ~* num_regex )
        ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
        LIMIT limit_n OFFSET offset_n;
      END IF;
      RETURN;
    ELSIF name_part IS NOT NULL AND name_part <> '' THEN
      RETURN QUERY
      SELECT pc.* FROM pokemon_cards pc
      WHERE public.f_unaccent(pc.name) ILIKE '%' || name_part || '%'
      ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;
  END IF;

  -- tokenizacao + ano
  tokens := string_to_array(query_text, ' ');
  FOREACH t IN ARRAY tokens LOOP
    IF t <> '' THEN
      IF yr IS NULL AND t ~ year_regex THEN
        yr := t;
      ELSE
        non_year_tokens := non_year_tokens || t;
      END IF;
    END IF;
  END LOOP;

  IF yr IS NULL THEN
    last_idx := array_length(tokens, 1);

    IF last_idx >= 2 AND tokens[last_idx] ~ number_regex THEN
      first_token := tokens[1];
      number_part := tokens[last_idx];

      IF last_idx = 2 THEN
        SELECT sa.set_id INTO resolved_set_id FROM set_aliases sa WHERE sa.alias = first_token LIMIT 1;
        IF resolved_set_id IS NULL THEN
          IF EXISTS (SELECT 1 FROM pokemon_cards WHERE set_id = first_token LIMIT 1) THEN
            resolved_set_id := first_token;
          END IF;
        END IF;
        IF resolved_set_id IS NOT NULL THEN
          snum := regexp_replace(number_part, '0*([0-9]+)', '\1', 'g');
          RETURN QUERY
          SELECT pc.* FROM pokemon_cards pc
          WHERE pc.set_id = resolved_set_id AND pc.number_norm = snum
          ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
          LIMIT limit_n OFFSET offset_n;
          RETURN;
        END IF;
      END IF;

      name_part := array_to_string(tokens[1:last_idx-1], ' ');
      snum := regexp_replace(number_part, '0*([0-9]+)', '\1', 'g');
      -- MUDANCA 2: mesmo tratamento aqui ("lilipup 154" -> Lillipup)
      RETURN QUERY
      SELECT pc.* FROM pokemon_cards pc
      WHERE ( public.f_unaccent(pc.name) ILIKE '%' || name_part || '%'
              OR ( length(name_part) >= 4 AND public.f_unaccent(pc.name) % name_part ) )
        AND ( pc.number_norm = snum OR pc.name ~* ('\(0*' || snum || '/') )
      ORDER BY similarity(public.f_unaccent(pc.name), name_part) DESC,
               (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;

    IF last_idx = 1 AND tokens[1] ~ number_regex THEN
      snum := regexp_replace(tokens[1], '0*([0-9]+)', '\1', 'g');
      RETURN QUERY
      SELECT pc.* FROM pokemon_cards pc
      WHERE pc.number_norm = snum
      ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;
  END IF;

  -- 1 token: fuzzy (pg_trgm)
  IF array_length(non_year_tokens, 1) = 1 AND yr IS NULL THEN
    first_token := non_year_tokens[1];
    RETURN QUERY
    SELECT pc.* FROM pokemon_cards pc
    WHERE public.f_unaccent(pc.name) ILIKE '%' || first_token || '%'
       OR ( length(first_token) >= 4 AND public.f_unaccent(pc.name) % first_token )
    ORDER BY
      CASE WHEN lower(public.f_unaccent(pc.name)) = first_token THEN 0
           WHEN lower(public.f_unaccent(pc.name)) LIKE first_token || '%' THEN 1
           WHEN public.f_unaccent(pc.name) ILIKE '%' || first_token || '%' THEN 2
           ELSE 3 END,
      similarity(public.f_unaccent(pc.name), first_token) DESC,
      (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
    LIMIT limit_n OFFSET offset_n;
    RETURN;
  END IF;

  -- fluxo geral (dinamico, parametrizado via %L) - AND por token
  IF yr IS NOT NULL THEN
    where_extra := where_extra || format(' AND left(pc.set_release_date,4) = %L', yr);
  END IF;
  IF array_length(non_year_tokens, 1) IS NOT NULL THEN
    FOREACH t IN ARRAY non_year_tokens LOOP
      where_extra := where_extra || format(
        ' AND (public.f_unaccent(pc.name) ILIKE %L OR public.f_unaccent(pc.set_name) ILIKE %L)',
        '%'||t||'%', '%'||t||'%');
    END LOOP;
    first_token := non_year_tokens[1];
    rel_order := format('CASE WHEN lower(public.f_unaccent(pc.name))=%L THEN 0 WHEN lower(public.f_unaccent(pc.name)) LIKE %L THEN 1 ELSE 2 END, ',
                        first_token, first_token||'%');
  END IF;

  sql := 'SELECT pc.* FROM pokemon_cards pc WHERE TRUE' || where_extra ||
         ' ORDER BY ' || rel_order || '(pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id' ||
         ' LIMIT $1 OFFSET $2';
  RETURN QUERY EXECUTE sql USING limit_n, offset_n;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.smart_search_cards_v3(q text, limit_n integer DEFAULT 60, offset_n integer DEFAULT 0)
 RETURNS SETOF pokemon_cards_all
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  query_text text := lower(trim(coalesce(q, '')));
  tokens text[];
  non_year_tokens text[] := ARRAY[]::text[];
  yr text := NULL;
  t text;
  last_idx int;
  first_token text;
  name_part text;
  number_part text;
  total_part text;
  snum text;
  stotal text;
  num_regex text;
  resolved_set_id text;
  number_list text[];
  number_regex text := '^([a-z]+)?[0-9]+[a-z]?$';
  year_regex text := '^(199[6-9]|20[0-3][0-9])$';
  sql text;
  where_extra text := '';
  rel_order text := '';
BEGIN
  IF query_text = '' THEN RETURN; END IF;
  query_text := public.traduzir_busca_pt(query_text);
  IF query_text = '' THEN RETURN; END IF;
  query_text := public.f_unaccent(query_text);

  IF query_text LIKE '%,%' THEN
    SELECT ARRAY(SELECT trim(s) FROM unnest(string_to_array(query_text, ',')) AS s WHERE trim(s) <> '')
      INTO number_list;
    IF array_length(number_list, 1) IS NULL THEN RETURN; END IF;
    RETURN QUERY
    SELECT DISTINCT pc.* FROM unnest(number_list) AS tk
    CROSS JOIN LATERAL smart_search_cards_v3(tk, limit_n, 0) AS pc
    LIMIT limit_n OFFSET offset_n;
    RETURN;
  END IF;

  IF query_text LIKE '%/%' THEN
    number_part := trim(split_part(query_text, '/', 1));
    total_part  := trim(split_part(query_text, '/', 2));
    IF number_part LIKE '% %' THEN
      tokens := string_to_array(number_part, ' ');
      last_idx := array_length(tokens, 1);
      name_part := trim(array_to_string(tokens[1:last_idx-1], ' '));
      number_part := tokens[last_idx];
    ELSE
      name_part := NULL;
    END IF;
    snum   := nullif(regexp_replace(regexp_replace(coalesce(number_part,''), '[^0-9]', '', 'g'), '^0+', ''), '');
    stotal := nullif(regexp_replace(regexp_replace(coalesce(total_part,''),  '[^0-9]', '', 'g'), '^0+', ''), '');
    IF snum IS NOT NULL THEN
      num_regex := '\(0*' || snum || '/';
      IF stotal IS NOT NULL THEN num_regex := num_regex || '0*' || stotal || '\)'; END IF;
      IF name_part IS NOT NULL AND name_part <> '' THEN
        RETURN QUERY
        SELECT pc.* FROM pokemon_cards pc
        WHERE ( public.f_unaccent(pc.name) ILIKE '%' || name_part || '%'
                OR public.f_unaccent(pc.name_pt) ILIKE '%' || name_part || '%'
                OR ( length(name_part) >= 4 AND public.f_unaccent(pc.name) % name_part ) )
          AND ( pc.number_norm = snum OR pc.name ~* num_regex )
        ORDER BY similarity(public.f_unaccent(pc.name), name_part) DESC,
                 (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
        LIMIT limit_n OFFSET offset_n;
      ELSE
        RETURN QUERY
        SELECT pc.* FROM pokemon_cards pc
        WHERE ( pc.number_norm = snum OR pc.name ~* num_regex )
          AND ( stotal IS NULL OR pc.set_total::text = stotal OR pc.name ~* num_regex )
        ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
        LIMIT limit_n OFFSET offset_n;
      END IF;
      RETURN;
    ELSIF name_part IS NOT NULL AND name_part <> '' THEN
      RETURN QUERY
      SELECT pc.* FROM pokemon_cards pc
      WHERE public.f_unaccent(pc.name) ILIKE '%' || name_part || '%'
         OR public.f_unaccent(pc.name_pt) ILIKE '%' || name_part || '%'
      ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;
  END IF;

  tokens := string_to_array(query_text, ' ');
  FOREACH t IN ARRAY tokens LOOP
    IF t <> '' THEN
      IF yr IS NULL AND t ~ year_regex THEN yr := t; ELSE non_year_tokens := non_year_tokens || t; END IF;
    END IF;
  END LOOP;

  IF yr IS NULL THEN
    last_idx := array_length(tokens, 1);
    IF last_idx >= 2 AND tokens[last_idx] ~ number_regex THEN
      first_token := tokens[1];
      number_part := tokens[last_idx];
      IF last_idx = 2 THEN
        SELECT sa.set_id INTO resolved_set_id FROM set_aliases sa WHERE sa.alias = first_token LIMIT 1;
        IF resolved_set_id IS NULL THEN
          IF EXISTS (SELECT 1 FROM pokemon_cards WHERE set_id = first_token LIMIT 1) THEN
            resolved_set_id := first_token;
          END IF;
        END IF;
        IF resolved_set_id IS NOT NULL THEN
          snum := regexp_replace(number_part, '0*([0-9]+)', '\1', 'g');
          RETURN QUERY
          SELECT pc.* FROM pokemon_cards pc
          WHERE pc.set_id = resolved_set_id AND pc.number_norm = snum
          ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
          LIMIT limit_n OFFSET offset_n;
          RETURN;
        END IF;
      END IF;
      name_part := array_to_string(tokens[1:last_idx-1], ' ');
      snum := regexp_replace(number_part, '0*([0-9]+)', '\1', 'g');
      RETURN QUERY
      SELECT pc.* FROM pokemon_cards pc
      WHERE ( public.f_unaccent(pc.name) ILIKE '%' || name_part || '%'
              OR public.f_unaccent(pc.name_pt) ILIKE '%' || name_part || '%'
              OR ( length(name_part) >= 4 AND public.f_unaccent(pc.name) % name_part ) )
        AND ( pc.number_norm = snum OR pc.name ~* ('\(0*' || snum || '/') )
      ORDER BY similarity(public.f_unaccent(pc.name), name_part) DESC,
               (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;

    IF last_idx = 1 AND tokens[1] ~ number_regex THEN
      snum := regexp_replace(tokens[1], '0*([0-9]+)', '\1', 'g');
      RETURN QUERY
      SELECT pc.* FROM pokemon_cards pc
      WHERE pc.number_norm = snum
      ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;
  END IF;

  -- 1 token: fuzzy. Aqui o name_pt importa de verdade — e o caminho de quem
  -- digita "poção", "maçarico", "bola rápida".
  IF array_length(non_year_tokens, 1) = 1 AND yr IS NULL THEN
    first_token := non_year_tokens[1];
    RETURN QUERY
    SELECT pc.* FROM pokemon_cards pc
    WHERE public.f_unaccent(pc.name) ILIKE '%' || first_token || '%'
       OR public.f_unaccent(pc.name_pt) ILIKE '%' || first_token || '%'
       OR ( length(first_token) >= 4 AND public.f_unaccent(pc.name) % first_token )
    ORDER BY
      CASE WHEN lower(public.f_unaccent(pc.name)) = first_token THEN 0
           WHEN lower(public.f_unaccent(coalesce(pc.name_pt, pc.name))) = first_token THEN 0
           WHEN lower(public.f_unaccent(pc.name)) LIKE first_token || '%' THEN 1
           WHEN lower(public.f_unaccent(coalesce(pc.name_pt, ''))) LIKE first_token || '%' THEN 1
           WHEN public.f_unaccent(pc.name) ILIKE '%' || first_token || '%' THEN 2
           ELSE 3 END,
      similarity(public.f_unaccent(pc.name), first_token) DESC,
      (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
    LIMIT limit_n OFFSET offset_n;
    RETURN;
  END IF;

  IF yr IS NOT NULL THEN
    where_extra := where_extra || format(' AND left(pc.set_release_date,4) = %L', yr);
  END IF;
  IF array_length(non_year_tokens, 1) IS NOT NULL THEN
    FOREACH t IN ARRAY non_year_tokens LOOP
      where_extra := where_extra || format(
        ' AND (public.f_unaccent(pc.name) ILIKE %L OR public.f_unaccent(pc.name_pt) ILIKE %L OR public.f_unaccent(pc.set_name) ILIKE %L)',
        '%'||t||'%', '%'||t||'%', '%'||t||'%');
    END LOOP;
    first_token := non_year_tokens[1];
    rel_order := format('CASE WHEN lower(public.f_unaccent(pc.name))=%L THEN 0 WHEN lower(public.f_unaccent(pc.name)) LIKE %L THEN 1 ELSE 2 END, ',
                        first_token, first_token||'%');
  END IF;

  sql := 'SELECT pc.* FROM pokemon_cards pc WHERE TRUE' || where_extra ||
         ' ORDER BY ' || rel_order || '(pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id' ||
         ' LIMIT $1 OFFSET $2';
  RETURN QUERY EXECUTE sql USING limit_n, offset_n;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.smart_search_cards_v4(q text, limit_n integer DEFAULT 60, offset_n integer DEFAULT 0)
 RETURNS SETOF pokemon_cards_all
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  query_text text := lower(trim(coalesce(q, '')));
  tokens text[]; non_year_tokens text[] := ARRAY[]::text[];
  yr text := NULL; t text; primeiro boolean; last_idx int; first_token text;
  name_part text; number_part text; total_part text; snum text; stotal text;
  num_regex text; resolved_set_id text; number_list text[];
  number_regex text := '^([a-z]+)?[0-9]+[a-z]?$';
  year_regex text := '^(199[6-9]|20[0-3][0-9])$';
  sql text; where_extra text := ''; rel_order text := '';
BEGIN
  IF query_text = '' THEN RETURN; END IF;
  query_text := public.traduzir_busca_pt(query_text);
  IF query_text = '' THEN RETURN; END IF;
  query_text := public.f_unaccent(query_text);

  IF query_text LIKE '%,%' THEN
    SELECT ARRAY(SELECT trim(s) FROM unnest(string_to_array(query_text, ',')) AS s WHERE trim(s) <> '') INTO number_list;
    IF array_length(number_list, 1) IS NULL THEN RETURN; END IF;
    RETURN QUERY SELECT DISTINCT pc.* FROM unnest(number_list) AS tk
      CROSS JOIN LATERAL smart_search_cards_v4(tk, limit_n, 0) AS pc LIMIT limit_n OFFSET offset_n;
    RETURN;
  END IF;

  IF query_text LIKE '%/%' THEN
    number_part := trim(split_part(query_text, '/', 1));
    total_part  := trim(split_part(query_text, '/', 2));
    IF number_part LIKE '% %' THEN
      tokens := string_to_array(number_part, ' ');
      last_idx := array_length(tokens, 1);
      name_part := trim(array_to_string(tokens[1:last_idx-1], ' '));
      number_part := tokens[last_idx];
    ELSE name_part := NULL; END IF;
    snum   := nullif(regexp_replace(regexp_replace(coalesce(number_part,''), '[^0-9]', '', 'g'), '^0+', ''), '');
    stotal := nullif(regexp_replace(regexp_replace(coalesce(total_part,''),  '[^0-9]', '', 'g'), '^0+', ''), '');
    IF snum IS NOT NULL THEN
      num_regex := '\(0*' || snum || '/';
      IF stotal IS NOT NULL THEN num_regex := num_regex || '0*' || stotal || '\)'; END IF;
      IF name_part IS NOT NULL AND name_part <> '' THEN
        RETURN QUERY SELECT pc.* FROM pokemon_cards pc
        WHERE ( public.f_unaccent(pc.name) ILIKE '%'||name_part||'%'
                OR public.f_unaccent(pc.name_pt) ILIKE '%'||name_part||'%'
                OR ( length(name_part) >= 4 AND public.f_unaccent(pc.name) % name_part ) )
          AND ( pc.number_norm = snum OR pc.name ~* num_regex )
        ORDER BY similarity(public.f_unaccent(pc.name), name_part) DESC,
                 (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
        LIMIT limit_n OFFSET offset_n;
      ELSE
        RETURN QUERY SELECT pc.* FROM pokemon_cards pc
        WHERE ( pc.number_norm = snum OR pc.name ~* num_regex )
          AND ( stotal IS NULL OR pc.set_total::text = stotal OR pc.name ~* num_regex )
        ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
        LIMIT limit_n OFFSET offset_n;
      END IF;
      RETURN;
    ELSIF name_part IS NOT NULL AND name_part <> '' THEN
      RETURN QUERY SELECT pc.* FROM pokemon_cards pc
      WHERE public.f_unaccent(pc.name) ILIKE '%'||name_part||'%'
         OR public.f_unaccent(pc.name_pt) ILIKE '%'||name_part||'%'
      ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;
  END IF;

  tokens := string_to_array(query_text, ' ');
  FOREACH t IN ARRAY tokens LOOP
    IF t <> '' THEN
      IF yr IS NULL AND t ~ year_regex THEN yr := t; ELSE non_year_tokens := non_year_tokens || t; END IF;
    END IF;
  END LOOP;

  IF yr IS NULL THEN
    last_idx := array_length(tokens, 1);
    IF last_idx >= 2 AND tokens[last_idx] ~ number_regex THEN
      first_token := tokens[1]; number_part := tokens[last_idx];
      IF last_idx = 2 THEN
        SELECT sa.set_id INTO resolved_set_id FROM set_aliases sa WHERE sa.alias = first_token LIMIT 1;
        IF resolved_set_id IS NULL THEN
          IF EXISTS (SELECT 1 FROM pokemon_cards WHERE set_id = first_token LIMIT 1) THEN resolved_set_id := first_token; END IF;
        END IF;
        IF resolved_set_id IS NOT NULL THEN
          snum := regexp_replace(number_part, '0*([0-9]+)', '\1', 'g');
          RETURN QUERY SELECT pc.* FROM pokemon_cards pc
          WHERE pc.set_id = resolved_set_id AND pc.number_norm = snum
          ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
          LIMIT limit_n OFFSET offset_n;
          RETURN;
        END IF;
      END IF;
      name_part := array_to_string(tokens[1:last_idx-1], ' ');
      snum := regexp_replace(number_part, '0*([0-9]+)', '\1', 'g');
      RETURN QUERY SELECT pc.* FROM pokemon_cards pc
      WHERE ( public.f_unaccent(pc.name) ILIKE '%'||name_part||'%'
              OR public.f_unaccent(pc.name_pt) ILIKE '%'||name_part||'%'
              OR ( length(name_part) >= 4 AND public.f_unaccent(pc.name) % name_part ) )
        AND ( pc.number_norm = snum OR pc.name ~* ('\(0*'||snum||'/') )
      ORDER BY similarity(public.f_unaccent(pc.name), name_part) DESC,
               (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;
    IF last_idx = 1 AND tokens[1] ~ number_regex THEN
      snum := regexp_replace(tokens[1], '0*([0-9]+)', '\1', 'g');
      RETURN QUERY SELECT pc.* FROM pokemon_cards pc WHERE pc.number_norm = snum
      ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;
  END IF;

  IF array_length(non_year_tokens, 1) = 1 AND yr IS NULL THEN
    first_token := non_year_tokens[1];
    RETURN QUERY SELECT pc.* FROM pokemon_cards pc
    WHERE public.f_unaccent(pc.name) ILIKE '%'||first_token||'%'
       OR public.f_unaccent(pc.name_pt) ILIKE '%'||first_token||'%'
       OR public.f_unaccent(pc.set_name_pt) ILIKE '%'||first_token||'%'
       OR ( length(first_token) >= 4 AND public.f_unaccent(pc.name) % first_token )
    ORDER BY
      CASE WHEN lower(public.f_unaccent(pc.name)) = first_token THEN 0
           WHEN lower(public.f_unaccent(coalesce(pc.name_pt, pc.name))) = first_token THEN 0
           WHEN lower(public.f_unaccent(pc.name)) LIKE first_token||'%' THEN 1
           WHEN lower(public.f_unaccent(coalesce(pc.name_pt, ''))) LIKE first_token||'%' THEN 1
           WHEN public.f_unaccent(pc.name) ILIKE '%'||first_token||'%' THEN 2
           WHEN public.f_unaccent(pc.name_pt) ILIKE '%'||first_token||'%' THEN 2
           WHEN public.f_unaccent(pc.set_name_pt) ILIKE '%'||first_token||'%' THEN 4
           ELSE 3 END,
      similarity(public.f_unaccent(pc.name), first_token) DESC,
      (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
    LIMIT limit_n OFFSET offset_n;
    RETURN;
  END IF;

  -- ─── multi-token ────────────────────────────────────────────────────────
  -- Limiar do word_similarity em 0,5 SO nesta transacao. O padrao e 0,6, e
  -- word_similarity('clyrex','ice rider calyrex vmax') da 0,57 — o caso real
  -- que motivou a mudanca ficaria de fora por 0,03.
  PERFORM set_config('pg_trgm.word_similarity_threshold', '0.5', true);

  IF yr IS NOT NULL THEN where_extra := where_extra || format(' AND left(pc.set_release_date,4) = %L', yr); END IF;
  IF array_length(non_year_tokens, 1) IS NOT NULL THEN
    primeiro := true;
    FOREACH t IN ARRAY non_year_tokens LOOP
      IF primeiro AND length(t) >= 4 THEN
        where_extra := where_extra || format(
          ' AND (public.f_unaccent(pc.name) ILIKE %L OR public.f_unaccent(pc.name_pt) ILIKE %L'
          || ' OR public.f_unaccent(pc.set_name) ILIKE %L OR public.f_unaccent(pc.set_name_pt) ILIKE %L'
          || ' OR %L <%% public.f_unaccent(pc.name) OR %L <%% public.f_unaccent(pc.name_pt))',
          '%'||t||'%', '%'||t||'%', '%'||t||'%', '%'||t||'%', t, t);
      ELSE
        where_extra := where_extra || format(
          ' AND (public.f_unaccent(pc.name) ILIKE %L OR public.f_unaccent(pc.name_pt) ILIKE %L'
          || ' OR public.f_unaccent(pc.set_name) ILIKE %L OR public.f_unaccent(pc.set_name_pt) ILIKE %L)',
          '%'||t||'%', '%'||t||'%', '%'||t||'%', '%'||t||'%');
      END IF;
      primeiro := false;
    END LOOP;
    first_token := non_year_tokens[1];
    rel_order := format('CASE WHEN lower(public.f_unaccent(pc.name))=%L THEN 0 WHEN lower(public.f_unaccent(pc.name)) LIKE %L THEN 1 ELSE 2 END, ',
                        first_token, first_token||'%');
  END IF;

  sql := 'SELECT pc.* FROM pokemon_cards pc WHERE TRUE' || where_extra ||
         ' ORDER BY ' || rel_order || '(pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id' ||
         ' LIMIT $1 OFFSET $2';
  RETURN QUERY EXECUTE sql USING limit_n, offset_n;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.smart_search_cards_v5(q text, limit_n integer DEFAULT 60, offset_n integer DEFAULT 0)
 RETURNS SETOF pokemon_cards_all
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  query_text text := lower(trim(coalesce(q, '')));
  tokens text[]; non_year_tokens text[] := ARRAY[]::text[];
  yr text := NULL; t text; primeiro boolean; last_idx int; first_token text;
  name_part text; number_part text; total_part text; snum text; stotal text;
  num_regex text; resolved_set_id text; number_list text[];
  number_regex text := '^([a-z]+)?[0-9]+[a-z]?$';
  year_regex text := '^(199[6-9]|20[0-3][0-9])$';
  sql text; where_extra text := ''; rel_order text := '';
BEGIN
  IF query_text = '' THEN RETURN; END IF;
  query_text := public.traduzir_busca_pt(query_text);
  IF query_text = '' THEN RETURN; END IF;
  query_text := public.f_unaccent(query_text);

  IF query_text LIKE '%,%' THEN
    SELECT ARRAY(SELECT trim(s) FROM unnest(string_to_array(query_text, ',')) AS s WHERE trim(s) <> '') INTO number_list;
    IF array_length(number_list, 1) IS NULL THEN RETURN; END IF;
    RETURN QUERY SELECT DISTINCT pc.* FROM unnest(number_list) AS tk
      CROSS JOIN LATERAL smart_search_cards_v5(tk, limit_n, 0) AS pc LIMIT limit_n OFFSET offset_n;
    RETURN;
  END IF;

  IF query_text LIKE '%/%' THEN
    number_part := trim(split_part(query_text, '/', 1));
    total_part  := trim(split_part(query_text, '/', 2));
    IF number_part LIKE '% %' THEN
      tokens := string_to_array(number_part, ' ');
      last_idx := array_length(tokens, 1);
      name_part := trim(array_to_string(tokens[1:last_idx-1], ' '));
      number_part := tokens[last_idx];
    ELSE name_part := NULL; END IF;
    snum   := nullif(regexp_replace(regexp_replace(coalesce(number_part,''), '[^0-9]', '', 'g'), '^0+', ''), '');
    stotal := nullif(regexp_replace(regexp_replace(coalesce(total_part,''),  '[^0-9]', '', 'g'), '^0+', ''), '');
    IF snum IS NOT NULL THEN
      num_regex := '\(0*' || snum || '/';
      IF stotal IS NOT NULL THEN num_regex := num_regex || '0*' || stotal || '\)'; END IF;
      IF name_part IS NOT NULL AND name_part <> '' THEN
        RETURN QUERY SELECT pc.* FROM pokemon_cards pc
        WHERE ( public.f_unaccent(pc.name) ILIKE '%'||name_part||'%'
                OR public.f_unaccent(pc.name_pt) ILIKE '%'||name_part||'%'
                OR ( length(name_part) >= 4 AND public.f_unaccent(pc.name) % name_part ) )
          AND ( pc.number_norm = snum OR pc.name ~* num_regex )
        ORDER BY coalesce(stotal IS NOT NULL AND (pc.set_total::text = stotal OR pc.name ~* num_regex), false) DESC,
                 similarity(public.f_unaccent(pc.name), name_part) DESC,
                 (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
        LIMIT limit_n OFFSET offset_n;
      ELSE
        RETURN QUERY SELECT pc.* FROM pokemon_cards pc
        WHERE pc.number_norm = snum OR pc.name ~* num_regex
        ORDER BY coalesce(stotal IS NOT NULL AND (pc.set_total::text = stotal OR pc.name ~* num_regex), false) DESC,
                 (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
        LIMIT limit_n OFFSET offset_n;
      END IF;
      RETURN;
    ELSIF name_part IS NOT NULL AND name_part <> '' THEN
      RETURN QUERY SELECT pc.* FROM pokemon_cards pc
      WHERE public.f_unaccent(pc.name) ILIKE '%'||name_part||'%'
         OR public.f_unaccent(pc.name_pt) ILIKE '%'||name_part||'%'
      ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;
  END IF;

  tokens := string_to_array(query_text, ' ');
  FOREACH t IN ARRAY tokens LOOP
    IF t <> '' THEN
      IF yr IS NULL AND t ~ year_regex THEN yr := t; ELSE non_year_tokens := non_year_tokens || t; END IF;
    END IF;
  END LOOP;

  IF yr IS NULL THEN
    last_idx := array_length(tokens, 1);
    IF last_idx >= 2 AND tokens[last_idx] ~ number_regex THEN
      first_token := tokens[1]; number_part := tokens[last_idx];
      IF last_idx = 2 THEN
        SELECT sa.set_id INTO resolved_set_id FROM set_aliases sa WHERE sa.alias = first_token LIMIT 1;
        IF resolved_set_id IS NULL THEN
          IF EXISTS (SELECT 1 FROM pokemon_cards WHERE set_id = first_token LIMIT 1) THEN resolved_set_id := first_token; END IF;
        END IF;
        IF resolved_set_id IS NOT NULL THEN
          snum := regexp_replace(number_part, '0*([0-9]+)', '\1', 'g');
          RETURN QUERY SELECT pc.* FROM pokemon_cards pc
          WHERE pc.set_id = resolved_set_id AND pc.number_norm = snum
          ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
          LIMIT limit_n OFFSET offset_n;
          RETURN;
        END IF;
      END IF;
      name_part := array_to_string(tokens[1:last_idx-1], ' ');
      snum := regexp_replace(number_part, '0*([0-9]+)', '\1', 'g');
      RETURN QUERY SELECT pc.* FROM pokemon_cards pc
      WHERE ( public.f_unaccent(pc.name) ILIKE '%'||name_part||'%'
              OR public.f_unaccent(pc.name_pt) ILIKE '%'||name_part||'%'
              OR ( length(name_part) >= 4 AND public.f_unaccent(pc.name) % name_part ) )
        AND ( pc.number_norm = snum OR pc.name ~* ('\(0*'||snum||'/') )
      ORDER BY similarity(public.f_unaccent(pc.name), name_part) DESC,
               (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;
    IF last_idx = 1 AND tokens[1] ~ number_regex THEN
      snum := regexp_replace(tokens[1], '0*([0-9]+)', '\1', 'g');
      RETURN QUERY SELECT pc.* FROM pokemon_cards pc WHERE pc.number_norm = snum
      ORDER BY (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
      LIMIT limit_n OFFSET offset_n;
      RETURN;
    END IF;
  END IF;

  IF array_length(non_year_tokens, 1) = 1 AND yr IS NULL THEN
    first_token := non_year_tokens[1];
    RETURN QUERY SELECT pc.* FROM pokemon_cards pc
    WHERE public.f_unaccent(pc.name) ILIKE '%'||first_token||'%'
       OR public.f_unaccent(pc.name_pt) ILIKE '%'||first_token||'%'
       OR public.f_unaccent(pc.set_name_pt) ILIKE '%'||first_token||'%'
       OR ( length(first_token) >= 4 AND public.f_unaccent(pc.name) % first_token )
    ORDER BY
      CASE WHEN lower(public.f_unaccent(pc.name)) = first_token THEN 0
           WHEN lower(public.f_unaccent(coalesce(pc.name_pt, pc.name))) = first_token THEN 0
           WHEN lower(public.f_unaccent(pc.name)) LIKE first_token||'%' THEN 1
           WHEN lower(public.f_unaccent(coalesce(pc.name_pt, ''))) LIKE first_token||'%' THEN 1
           WHEN public.f_unaccent(pc.name) ILIKE '%'||first_token||'%' THEN 2
           WHEN public.f_unaccent(pc.name_pt) ILIKE '%'||first_token||'%' THEN 2
           WHEN public.f_unaccent(pc.set_name_pt) ILIKE '%'||first_token||'%' THEN 4
           ELSE 3 END,
      similarity(public.f_unaccent(pc.name), first_token) DESC,
      (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id
    LIMIT limit_n OFFSET offset_n;
    RETURN;
  END IF;

  PERFORM set_config('pg_trgm.word_similarity_threshold', '0.5', true);

  IF yr IS NOT NULL THEN where_extra := where_extra || format(' AND left(pc.set_release_date,4) = %L', yr); END IF;
  IF array_length(non_year_tokens, 1) IS NOT NULL THEN
    primeiro := true;
    FOREACH t IN ARRAY non_year_tokens LOOP
      IF primeiro AND length(t) >= 4 THEN
        where_extra := where_extra || format(
          ' AND (public.f_unaccent(pc.name) ILIKE %L OR public.f_unaccent(pc.name_pt) ILIKE %L'
          || ' OR public.f_unaccent(pc.set_name) ILIKE %L OR public.f_unaccent(pc.set_name_pt) ILIKE %L'
          || ' OR %L <%% public.f_unaccent(pc.name) OR %L <%% public.f_unaccent(pc.name_pt))',
          '%'||t||'%', '%'||t||'%', '%'||t||'%', '%'||t||'%', t, t);
      ELSE
        where_extra := where_extra || format(
          ' AND (public.f_unaccent(pc.name) ILIKE %L OR public.f_unaccent(pc.name_pt) ILIKE %L'
          || ' OR public.f_unaccent(pc.set_name) ILIKE %L OR public.f_unaccent(pc.set_name_pt) ILIKE %L)',
          '%'||t||'%', '%'||t||'%', '%'||t||'%', '%'||t||'%');
      END IF;
      primeiro := false;
    END LOOP;
    first_token := non_year_tokens[1];
    rel_order := format('CASE WHEN lower(public.f_unaccent(pc.name))=%L THEN 0 WHEN lower(public.f_unaccent(pc.name)) LIKE %L THEN 1 ELSE 2 END, ',
                        first_token, first_token||'%');
  END IF;

  sql := 'SELECT pc.* FROM pokemon_cards pc WHERE TRUE' || where_extra ||
         ' ORDER BY ' || rel_order || '(pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id' ||
         ' LIMIT $1 OFFSET $2';
  RETURN QUERY EXECUTE sql USING limit_n, offset_n;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.snapshot_monthly_ranking(p_year integer, p_month integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_inserted_count int := 0;
  v_existing_count int;
  v_top3 jsonb;
BEGIN
  IF p_year IS NULL OR p_month IS NULL OR p_month < 1 OR p_month > 12 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_params');
  END IF;

  v_period_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_period_end := v_period_start + interval '1 month';

  -- Já existe snapshot pra este período?
  SELECT count(*) INTO v_existing_count
  FROM monthly_ranking_snapshots
  WHERE period_year = p_year AND period_month = p_month;

  IF v_existing_count > 0 THEN
    SELECT jsonb_agg(jsonb_build_object(
      'user_id', user_id,
      'position', position,
      'qualified_count', qualified_referrals_count,
      'prize_awarded', prize_awarded
    ) ORDER BY position)
    INTO v_top3
    FROM monthly_ranking_snapshots
    WHERE period_year = p_year AND period_month = p_month AND position <= 3;

    RETURN jsonb_build_object(
      'ok', true,
      'noop', true,
      'reason', 'snapshot_exists',
      'existing_count', v_existing_count,
      'top3', COALESCE(v_top3, '[]'::jsonb)
    );
  END IF;

  -- Insere snapshot do top do mês
  WITH ranked AS (
    SELECT
      r.referrer_user_id AS user_id,
      COUNT(*) FILTER (
        WHERE r.status IN ('ativou', 'engajado')
        AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
        AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
      ) AS qualified_count,
      MIN(COALESCE(r.engajou_at, r.ativou_at)) FILTER (
        WHERE r.status IN ('ativou', 'engajado')
        AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
        AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
      ) AS first_qualified_at
    FROM referrals r
    GROUP BY r.referrer_user_id
    HAVING COUNT(*) FILTER (
      WHERE r.status IN ('ativou', 'engajado')
      AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
      AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
    ) > 0
  ),
  positioned AS (
    SELECT
      user_id,
      qualified_count,
      ROW_NUMBER() OVER (ORDER BY qualified_count DESC, first_qualified_at ASC) AS pos
    FROM ranked
  ),
  inserted AS (
    INSERT INTO monthly_ranking_snapshots (
      period_year, period_month, user_id, position,
      qualified_referrals_count, points_earned_in_period, prize_awarded
    )
    SELECT
      p_year, p_month, user_id, pos, qualified_count,
      (SELECT COALESCE(SUM(amount), 0) FROM points_ledger
       WHERE user_id = positioned.user_id
       AND reason IN ('referral_ativou', 'referral_engajado')
       AND created_at >= v_period_start AND created_at < v_period_end),
      CASE
        WHEN pos = 1 THEN 'R$ 200,00 (Top 1)'
        WHEN pos = 2 THEN 'R$ 100,00 (Top 2)'
        WHEN pos = 3 THEN 'R$ 50,00 (Top 3)'
        ELSE NULL
      END
    FROM positioned
    RETURNING user_id, position, qualified_referrals_count, prize_awarded
  )
  SELECT count(*) INTO v_inserted_count FROM inserted;

  SELECT jsonb_agg(jsonb_build_object(
    'user_id', user_id,
    'position', position,
    'qualified_count', qualified_referrals_count,
    'prize_awarded', prize_awarded
  ) ORDER BY position)
  INTO v_top3
  FROM monthly_ranking_snapshots
  WHERE period_year = p_year AND period_month = p_month AND position <= 3;

  RETURN jsonb_build_object(
    'ok', true,
    'inserted_count', v_inserted_count,
    'top3', COALESCE(v_top3, '[]'::jsonb),
    'period_year', p_year,
    'period_month', p_month
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_pastas_lock()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_pro boolean;
  v_unlocked int;
  v_oldest uuid;
  v_active uuid;
begin
  if v_uid is null then return null; end if;
  v_pro := public.user_pastas_ilimitadas(v_uid);
  if coalesce(v_pro, false) then
    update pastas set locked = false where user_id = v_uid and locked = true;
    return null;
  end if;
  select count(*) filter (where not locked) into v_unlocked from pastas where user_id = v_uid;
  if v_unlocked = 1 then
    select id into v_active from pastas where user_id = v_uid and not locked limit 1;
    return v_active;
  end if;
  select id into v_oldest from pastas where user_id = v_uid order by created_at asc limit 1;
  if v_oldest is null then return null; end if;
  update pastas set locked = (id <> v_oldest) where user_id = v_uid;
  return v_oldest;
end $function$
;

CREATE OR REPLACE FUNCTION public.touch_last_seen()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.users SET last_seen_at = now() WHERE id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.traduzir_busca_pt(q text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  toks text[];
  n int;
  i int := 1;
  out_terms text[] := '{}';
  bigram text;
  uni text;
  hit text;
begin
  if q is null or btrim(q) = '' then
    return q;
  end if;

  toks := string_to_array(lower(q), ' ');
  n := coalesce(array_length(toks, 1), 0);

  while i <= n loop
    hit := null;

    -- 1) tenta bigrama (2 palavras): ex. "lua sangrenta" -> "bloodmoon"
    if i < n then
      bigram := unaccent(toks[i]) || ' ' || unaccent(toks[i+1]);
      select en into hit from busca_glossario where pt = bigram limit 1;
      if hit is not null then
        out_terms := out_terms || hit;
        i := i + 2;
        continue;
      end if;
    end if;

    -- 2) unigrama (1 palavra)
    uni := unaccent(toks[i]);
    select en into hit from busca_glossario where pt = uni limit 1;
    if hit is not null then
      out_terms := out_terms || hit;
    elsif uni = any (array['de','da','do','das','dos']) then
      null;  -- stopword, descarta
    else
      out_terms := out_terms || toks[i];
    end if;

    i := i + 1;
  end loop;

  if array_length(out_terms, 1) is null then
    return q;
  end if;
  return array_to_string(out_terms, ' ');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.user_pastas_ilimitadas(p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(u.is_pro, false)
      or (u.trial_expires_at is not null and u.trial_expires_at > now())
      or (u.plano in ('plus','pro','pro_anual','mensal','anual')
          and (u.pro_expira_em is null or u.pro_expira_em > now()))
  from users u
  where u.id = p_uid
$function$
;

CREATE OR REPLACE FUNCTION public.vendas_concluidas_count(uid uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.is_profile_public(uid) OR auth.uid() = uid
    THEN (SELECT count(*)::int FROM public.transactions WHERE seller_id = uid)
    ELSE 0
  END
$function$
;

reset check_function_bodies;

-- ============================================================
-- 5b. VIEW que depende de funcoes da secao 8 (_decode_liga, _nn, _selo_identidade)
-- (movida para depois das funcoes em 22/08/2026: na ordem original falhava em banco vazio)
-- ============================================================
create or replace view public.v_auditoria_liga_link as
 WITH base AS (
         SELECT c.id,
            c.name,
            c.set_id,
            c.set_name,
            c.supertype,
            c.base_pokemon_names,
            c.preco_medio,
            c.oculto,
            c.slug,
            c.liga_link,
            _decode_liga("substring"(c.liga_link, 'card=([^&]+)'::text)) AS nome_link
           FROM pokemon_cards_all c
          WHERE c.liga_link IS NOT NULL
        ), norm AS (
         SELECT base.id,
            base.name,
            base.set_id,
            base.set_name,
            base.supertype,
            base.base_pokemon_names,
            base.preco_medio,
            base.oculto,
            base.slug,
            base.liga_link,
            base.nome_link,
            _nn(replace(replace(lower(base.name), '★'::text, ' star '::text), 'δ'::text, ' delta '::text)) AS k_carta,
            _nn(replace(replace(lower(base.nome_link), '★'::text, ' star '::text), 'δ'::text, ' delta '::text)) AS k_link,
            _selo_identidade(replace(replace(lower(base.name), '★'::text, ' star '::text), 'δ'::text, ' delta '::text)) AS selo_carta,
            _selo_identidade(replace(replace(lower(base.nome_link), '★'::text, ' star '::text), 'δ'::text, ' delta '::text)) AS selo_link
           FROM base
        )
 SELECT id,
    name,
    set_id,
    set_name,
    supertype,
    base_pokemon_names,
    preco_medio,
    oculto,
    slug,
    liga_link,
    nome_link,
    k_carta,
    k_link,
    selo_carta,
    selo_link,
        CASE
            WHEN k_link = ''::text THEN 'sem_link'::text
            WHEN k_carta = k_link THEN 'igual'::text
            WHEN selo_carta <> selo_link THEN 'SELO_DIFERENTE'::text
            WHEN POSITION((k_link) IN (k_carta)) > 0 OR POSITION((k_carta) IN (k_link)) > 0 THEN 'mesma_carta_outro_nome'::text
            WHEN supertype = 'Pokémon'::text AND base_pokemon_names IS NOT NULL AND (EXISTS ( SELECT 1
               FROM unnest(norm.base_pokemon_names) bp(bp)
              WHERE POSITION((_nn(lower(bp.bp))) IN (norm.k_link)) > 0)) THEN 'mesmo_pokemon_variante'::text
            ELSE 'CARTA_DIFERENTE'::text
        END AS veredito
   FROM norm;
;

-- ============================================================
-- 7b. INDICES NAO-CONSTRAINT EM TABELAS (132)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_avaliacoes_pedido ON public.avaliacoes USING btree (pedido_id) WHERE (pedido_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts USING btree (category_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published ON public.blog_posts USING btree (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags ON public.blog_posts USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_card_precos_card ON public.card_precos USING btree (card_id);
CREATE INDEX IF NOT EXISTS card_requests_card_id_idx ON public.card_requests USING btree (card_id);
CREATE INDEX IF NOT EXISTS card_requests_dedup_idx ON public.card_requests USING btree (lower(COALESCE(nome, ''::text)), COALESCE(numero, ''::text));
CREATE INDEX IF NOT EXISTS card_requests_status_idx ON public.card_requests USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS card_requests_tipo_idx ON public.card_requests USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_card_ultima_venda_historico_card_data ON public.card_ultima_venda_historico USING btree (card_id, capturado_em DESC);
CREATE INDEX IF NOT EXISTS card_validation_review_card_id_idx ON public.card_validation_review USING btree (card_id) WHERE (NOT resolvido);
CREATE INDEX IF NOT EXISTS card_validation_review_fonte_campo_idx ON public.card_validation_review USING btree (fonte, campo) WHERE (NOT resolvido);
CREATE INDEX IF NOT EXISTS idx_conteudo_fila_postado_em ON public.conteudo_fila USING btree (postado_em DESC);
CREATE INDEX IF NOT EXISTS idx_conteudo_fila_status_ordem ON public.conteudo_fila USING btree (status, ordem);
CREATE INDEX IF NOT EXISTS idx_conteudo_posts_data ON public.conteudo_posts USING btree (data DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_conteudo_posts_data ON public.conteudo_posts USING btree (data);
CREATE INDEX IF NOT EXISTS idx_dedup_backup_origem ON public.dedup_sets_backup USING btree (origem, card_id);
CREATE INDEX IF NOT EXISTS despesas_recorrentes_ativa_idx ON public.despesas_recorrentes USING btree (ativa) WHERE (ativa = true);
CREATE INDEX IF NOT EXISTS lancamentos_competencia_idx ON public.lancamentos USING btree (data_competencia DESC);
CREATE UNIQUE INDEX IF NOT EXISTS lancamentos_stripe_pi_unique ON public.lancamentos USING btree (stripe_payment_intent_id) WHERE (stripe_payment_intent_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS lancamentos_tipo_idx ON public.lancamentos USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_liga_editions_master_ed_code ON public.liga_editions_master USING btree (ed_code);
CREATE INDEX IF NOT EXISTS idx_liga_editions_master_year ON public.liga_editions_master USING btree (year DESC);
CREATE INDEX IF NOT EXISTS idx_liga_set_edids_bynx_set ON public.liga_set_edids USING btree (bynx_set_id) WHERE (bynx_set_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_liga_set_edids_catalogued ON public.liga_set_edids USING btree (catalogued_in_bynx);
CREATE INDEX IF NOT EXISTS idx_liga_set_edids_edid ON public.liga_set_edids USING btree (edid);
CREATE INDEX IF NOT EXISTS idx_liga_set_mapping_action ON public.liga_set_mapping USING btree (action) WHERE (action = ANY (ARRAY['pending'::text, 'auto'::text]));
CREATE INDEX IF NOT EXISTS idx_liga_set_mapping_confidence ON public.liga_set_mapping USING btree (confidence);
CREATE INDEX IF NOT EXISTS idx_loja_cliques_loja_date ON public.loja_cliques USING btree (loja_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loja_cliques_loja_id ON public.loja_cliques USING btree (loja_id);
CREATE INDEX IF NOT EXISTS idx_loja_cliques_loja_tipo ON public.loja_cliques USING btree (loja_id, tipo);
CREATE INDEX IF NOT EXISTS idx_loja_eventos_loja ON public.loja_eventos USING btree (loja_id);
CREATE INDEX IF NOT EXISTS idx_loja_eventos_pub ON public.loja_eventos USING btree (loja_id, status, data_inicio);
CREATE INDEX IF NOT EXISTS loja_produtos_loja_idx ON public.loja_produtos USING btree (loja_id, created_at DESC);
CREATE INDEX IF NOT EXISTS loja_produtos_vitrine_idx ON public.loja_produtos USING btree (loja_id, tipo) WHERE ((ativo = true) AND (estoque > 0));
CREATE INDEX IF NOT EXISTS idx_lojas_cidade ON public.lojas USING btree (cidade);
CREATE INDEX IF NOT EXISTS idx_lojas_especialidades ON public.lojas USING gin (especialidades);
CREATE INDEX IF NOT EXISTS idx_lojas_estado ON public.lojas USING btree (estado);
CREATE INDEX IF NOT EXISTS idx_lojas_guia_publico ON public.lojas USING btree (status, plano, created_at DESC) WHERE (status = 'ativa'::text);
CREATE INDEX IF NOT EXISTS idx_lojas_owner ON public.lojas USING btree (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_lojas_plano ON public.lojas USING btree (plano);
CREATE INDEX IF NOT EXISTS idx_lojas_slug ON public.lojas USING btree (slug);
CREATE INDEX IF NOT EXISTS lojas_status_idx ON public.lojas USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS lojas_stripe_connect_account_id_uk ON public.lojas USING btree (stripe_connect_account_id) WHERE (stripe_connect_account_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS lojas_suspensao_data_idx ON public.lojas USING btree (suspensao_data) WHERE (suspensao_data IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_marketplace_ativos ON public.marketplace USING btree (created_at DESC) WHERE (removido_em IS NULL);
CREATE INDEX IF NOT EXISTS idx_marketplace_idioma ON public.marketplace USING btree (idioma);
CREATE INDEX IF NOT EXISTS idx_marketplace_user ON public.marketplace USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_mkt_msg_anuncio ON public.marketplace_mensagens USING btree (anuncio_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mkt_msg_nao_lida_cron ON public.marketplace_mensagens USING btree (created_at) WHERE ((read_at IS NULL) AND (email_nao_lida_enviada = false));
CREATE INDEX IF NOT EXISTS idx_master_set_requests_status ON public.master_set_requests USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_anuncio ON public.mensagens_moderacao USING btree (anuncio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ml_produtos_chave_ordem_idx ON public.ml_afiliado_produtos USING btree (chave, ordem) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_ranking_period ON public.monthly_ranking_snapshots USING btree (period_year, period_month, "position");
CREATE INDEX IF NOT EXISTS idx_mypcards_card_map_product ON public.mypcards_card_map USING btree (mypcards_product_id);
CREATE INDEX IF NOT EXISTS pasta_cards_pasta_id_idx ON public.pasta_cards USING btree (pasta_id);
CREATE INDEX IF NOT EXISTS pasta_cards_pasta_pos_idx ON public.pasta_cards USING btree (pasta_id, posicao);
CREATE INDEX IF NOT EXISTS pasta_cards_user_card_idx ON public.pasta_cards USING btree (user_card_id);
CREATE INDEX IF NOT EXISTS pastas_user_id_idx ON public.pastas USING btree (user_id);
CREATE INDEX IF NOT EXISTS pedido_itens_marketplace_idx ON public.pedido_itens USING btree (marketplace_id) WHERE (marketplace_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS pedido_itens_pedido_idx ON public.pedido_itens USING btree (pedido_id);
CREATE INDEX IF NOT EXISTS pedido_itens_produto_idx ON public.pedido_itens USING btree (produto_id) WHERE (produto_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS pedidos_comprador_idx ON public.pedidos USING btree (comprador_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pedidos_loja_idx ON public.pedidos USING btree (loja_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pedidos_produto_idx ON public.pedidos USING btree (produto_id);
CREATE INDEX IF NOT EXISTS pedidos_status_idx ON public.pedidos USING btree (status);
CREATE INDEX IF NOT EXISTS pedidos_vendedor_idx ON public.pedidos USING btree (vendedor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_redemptions_status ON public.point_redemptions USING btree (status, created_at);
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON public.point_redemptions USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_ledger_period ON public.points_ledger USING btree (user_id, reason, created_at);
CREATE INDEX IF NOT EXISTS idx_points_ledger_reason ON public.points_ledger USING btree (reason);
CREATE INDEX IF NOT EXISTS idx_points_ledger_user ON public.points_ledger USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cards_home_destaque ON public.pokemon_cards_all USING btree (preco_medio DESC) INCLUDE (image_small) WHERE ((NOT oculto) AND (preco_medio > (0)::numeric) AND (image_small ~~ 'https://images.pokemontcg.io/%'::text));
CREATE INDEX IF NOT EXISTS idx_cards_sitemap_elegiveis ON public.pokemon_cards_all USING btree (id) WHERE ((NOT oculto) AND (excluded_from_scan <> true) AND (is_canary <> true));
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_base_names ON public.pokemon_cards_all USING gin (base_pokemon_names);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_base_pokemon_covering ON public.pokemon_cards_all USING btree (id) INCLUDE (base_pokemon_names) WHERE ((supertype = 'Pokémon'::text) AND (image_small IS NOT NULL) AND (base_pokemon_names IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_excluded_from_scan ON public.pokemon_cards_all USING btree (excluded_from_scan) WHERE (excluded_from_scan = false);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_fail_streak ON public.pokemon_cards_all USING btree (liga_fail_streak, liga_last_attempt_at) WHERE (liga_fail_streak > 0);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_liga_cid ON public.pokemon_cards_all USING btree (liga_cid);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_liga_link ON public.pokemon_cards_all USING btree (liga_link);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_name_pt_unaccent_trgm ON public.pokemon_cards_all USING gin (f_unaccent(name_pt) gin_trgm_ops) WHERE (name_pt IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_name_trgm ON public.pokemon_cards_all USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_name_unaccent_trgm ON public.pokemon_cards_all USING gin (f_unaccent(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_number_lower ON public.pokemon_cards_all USING btree (lower(number));
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_number_norm ON public.pokemon_cards_all USING btree (number_norm) WHERE (number_norm IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_oculto ON public.pokemon_cards_all USING btree (set_id) WHERE oculto;
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_outras_variantes ON public.pokemon_cards_all USING gin (outras_variantes) WHERE (outras_variantes IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_regiao ON public.pokemon_cards_all USING btree (regiao) WHERE (regiao IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_release_year ON public.pokemon_cards_all USING btree ("left"(set_release_date, 4)) WHERE (set_release_date IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_set_id ON public.pokemon_cards_all USING btree (set_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_set_name ON public.pokemon_cards_all USING btree (set_name);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_set_name_pt_trgm ON public.pokemon_cards_all USING gin (f_unaccent(set_name_pt) gin_trgm_ops) WHERE (set_name_pt IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_set_name_trgm ON public.pokemon_cards_all USING gin (set_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_set_name_unaccent_trgm ON public.pokemon_cards_all USING gin (f_unaccent(set_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_set_stats ON public.pokemon_cards_all USING btree (set_id, preco_medio, set_name) WHERE (set_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_set_total ON public.pokemon_cards_all USING btree (set_total);
CREATE INDEX IF NOT EXISTS pokemon_cards_artist_idx ON public.pokemon_cards_all USING btree (artist);
CREATE INDEX IF NOT EXISTS pokemon_cards_name_idx ON public.pokemon_cards_all USING btree (name);
CREATE INDEX IF NOT EXISTS pokemon_cards_rarity_idx ON public.pokemon_cards_all USING btree (rarity);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pokemon_cards_slug ON public.pokemon_cards_all USING btree (slug) WHERE (slug IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_portfolio_history_user ON public.portfolio_history USING btree (user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_card_date ON public.price_history USING btree (card_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON public.price_history USING btree (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_source ON public.price_history USING btree (source);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals USING btree (referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_fingerprint ON public.referrals USING btree (signup_fingerprint) WHERE (signup_fingerprint IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_referrals_ip ON public.referrals USING btree (signup_ip) WHERE (signup_ip IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals USING btree (referrer_user_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals USING btree (status, cadastrou_at);
CREATE INDEX IF NOT EXISTS idx_rewards_active ON public.rewards USING btree (active, sort_order) WHERE (active = true);
CREATE INDEX IF NOT EXISTS idx_set_aliases_set_id ON public.set_aliases USING btree (set_id);
CREATE INDEX IF NOT EXISTS stripe_events_processed_at_idx ON public.stripe_events_processed USING btree (processed_at DESC);
CREATE INDEX IF NOT EXISTS stripe_events_processed_loja_idx ON public.stripe_events_processed USING btree (loja_id) WHERE (loja_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS stripe_events_processed_user_idx ON public.stripe_events_processed USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_ticket_anexos_ticket ON public.ticket_anexos USING btree (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS ticket_messages_ticket_id_idx ON public.ticket_messages USING btree (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS tickets_last_message_idx ON public.tickets USING btree (last_message_at DESC);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON public.tickets USING btree (status);
CREATE INDEX IF NOT EXISTS tickets_user_id_idx ON public.tickets USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_trade_comparisons_created_at ON public.trade_comparisons USING btree (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_pokemon_api ON public.user_cards USING btree (user_id, pokemon_api_id) WHERE ((pokemon_api_id IS NOT NULL) AND (graduada = false));
CREATE INDEX IF NOT EXISTS idx_user_cards_user ON public.user_cards USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_master_sets_user ON public.user_master_sets USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_users_atribuicao ON public.users USING btree (signup_utm_source, signup_utm_medium, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users USING btree (referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users USING btree (referred_by_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unsubscribe_token ON public.users USING btree (unsubscribe_token) WHERE (unsubscribe_token IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON public.users USING btree (username);
CREATE UNIQUE INDEX IF NOT EXISTS users_cpf_digits_unique ON public.users USING btree (regexp_replace(COALESCE(cpf, ''::text), '[^0-9]'::text, ''::text, 'g'::text)) WHERE (length(regexp_replace(COALESCE(cpf, ''::text), '[^0-9]'::text, ''::text, 'g'::text)) = 11);
CREATE INDEX IF NOT EXISTS users_suspended_at_idx ON public.users USING btree (suspended_at) WHERE (suspended_at IS NOT NULL);
CREATE INDEX IF NOT EXISTS watchlist_card_idx ON public.watchlist USING btree (card_id);
CREATE INDEX IF NOT EXISTS watchlist_user_idx ON public.watchlist USING btree (user_id);

-- ============================================================
-- 9. TRIGGERS (10)
-- ============================================================
drop trigger if exists trg_loja_eventos_updated_at on public.loja_eventos;
CREATE TRIGGER trg_loja_eventos_updated_at BEFORE UPDATE ON public.loja_eventos FOR EACH ROW EXECUTE FUNCTION set_loja_eventos_updated_at();
drop trigger if exists trg_lojas_updated_at on public.lojas;
CREATE TRIGGER trg_lojas_updated_at BEFORE UPDATE ON public.lojas FOR EACH ROW EXECUTE FUNCTION set_lojas_updated_at();
drop trigger if exists trg_enforce_pasta_cards_limit_free on public.pasta_cards;
CREATE TRIGGER trg_enforce_pasta_cards_limit_free BEFORE INSERT ON public.pasta_cards FOR EACH ROW EXECUTE FUNCTION enforce_pasta_cards_limit_free();
drop trigger if exists pastas_touch on public.pastas;
CREATE TRIGGER pastas_touch BEFORE UPDATE ON public.pastas FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
drop trigger if exists trg_enforce_pasta_limit_free on public.pastas;
CREATE TRIGGER trg_enforce_pasta_limit_free BEFORE INSERT ON public.pastas FOR EACH ROW EXECUTE FUNCTION enforce_pasta_limit_free();
drop trigger if exists trg_card_slug on public.pokemon_cards_all;
CREATE TRIGGER trg_card_slug BEFORE INSERT OR UPDATE OF name, number, set_id, set_name, slug ON public.pokemon_cards_all FOR EACH ROW EXECUTE FUNCTION preencher_card_slug();
drop trigger if exists trg_log_price_history on public.pokemon_cards_all;
CREATE TRIGGER trg_log_price_history AFTER UPDATE OF preco_normal, preco_min, preco_max, preco_medio, preco_foil, preco_reverse ON public.pokemon_cards_all FOR EACH ROW EXECUTE FUNCTION fn_log_price_history();
drop trigger if exists trg_ticket_touch on public.ticket_messages;
CREATE TRIGGER trg_ticket_touch AFTER INSERT ON public.ticket_messages FOR EACH ROW EXECUTE FUNCTION fn_ticket_touch();
drop trigger if exists trg_enforce_unique_cpf on public.users;
CREATE TRIGGER trg_enforce_unique_cpf BEFORE INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION enforce_unique_cpf();
drop trigger if exists trg_users_generate_referral_code on public.users;
CREATE TRIGGER trg_users_generate_referral_code BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION users_generate_referral_code();

-- ============================================================
-- 10. FOREIGN KEYS
-- ============================================================
do $$ begin
  if not exists (select 1 from pg_constraint where conname='avaliacoes_avaliado_id_fkey' and conrelid='public.avaliacoes'::regclass) then
    alter table public.avaliacoes add constraint avaliacoes_avaliado_id_fkey FOREIGN KEY (avaliado_id) REFERENCES auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='avaliacoes_avaliador_id_fkey' and conrelid='public.avaliacoes'::regclass) then
    alter table public.avaliacoes add constraint avaliacoes_avaliador_id_fkey FOREIGN KEY (avaliador_id) REFERENCES auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='avaliacoes_loja_id_fkey' and conrelid='public.avaliacoes'::regclass) then
    alter table public.avaliacoes add constraint avaliacoes_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='avaliacoes_marketplace_id_fkey' and conrelid='public.avaliacoes'::regclass) then
    alter table public.avaliacoes add constraint avaliacoes_marketplace_id_fkey FOREIGN KEY (marketplace_id) REFERENCES marketplace(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='avaliacoes_pedido_id_fkey' and conrelid='public.avaliacoes'::regclass) then
    alter table public.avaliacoes add constraint avaliacoes_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='blog_posts_category_id_fkey' and conrelid='public.blog_posts'::regclass) then
    alter table public.blog_posts add constraint blog_posts_category_id_fkey FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_precos_card_id_fkey' and conrelid='public.card_precos'::regclass) then
    alter table public.card_precos add constraint card_precos_card_id_fkey FOREIGN KEY (card_id) REFERENCES pokemon_cards_all(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_requests_card_id_fkey' and conrelid='public.card_requests'::regclass) then
    alter table public.card_requests add constraint card_requests_card_id_fkey FOREIGN KEY (card_id) REFERENCES pokemon_cards_all(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_requests_user_id_fkey' and conrelid='public.card_requests'::regclass) then
    alter table public.card_requests add constraint card_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_ultima_venda_historico_card_id_fkey' and conrelid='public.card_ultima_venda_historico'::regclass) then
    alter table public.card_ultima_venda_historico add constraint card_ultima_venda_historico_card_id_fkey FOREIGN KEY (card_id) REFERENCES pokemon_cards_all(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='card_validation_review_card_id_fkey' and conrelid='public.card_validation_review'::regclass) then
    alter table public.card_validation_review add constraint card_validation_review_card_id_fkey FOREIGN KEY (card_id) REFERENCES pokemon_cards_all(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lancamentos_despesa_recorrente_id_fkey' and conrelid='public.lancamentos'::regclass) then
    alter table public.lancamentos add constraint lancamentos_despesa_recorrente_id_fkey FOREIGN KEY (despesa_recorrente_id) REFERENCES despesas_recorrentes(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lancamentos_user_id_fkey' and conrelid='public.lancamentos'::regclass) then
    alter table public.lancamentos add constraint lancamentos_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='liga_set_edids_bynx_set_id_fkey' and conrelid='public.liga_set_edids'::regclass) then
    alter table public.liga_set_edids add constraint liga_set_edids_bynx_set_id_fkey FOREIGN KEY (bynx_set_id) REFERENCES pokemon_sets(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_cliques_loja_id_fkey' and conrelid='public.loja_cliques'::regclass) then
    alter table public.loja_cliques add constraint loja_cliques_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_cliques_user_id_fkey' and conrelid='public.loja_cliques'::regclass) then
    alter table public.loja_cliques add constraint loja_cliques_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_eventos_loja_id_fkey' and conrelid='public.loja_eventos'::regclass) then
    alter table public.loja_eventos add constraint loja_eventos_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='loja_produtos_loja_id_fkey' and conrelid='public.loja_produtos'::regclass) then
    alter table public.loja_produtos add constraint loja_produtos_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_aprovada_por_fkey' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_aprovada_por_fkey FOREIGN KEY (aprovada_por) REFERENCES users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_owner_user_id_fkey' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_suspenso_por_fkey' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_suspenso_por_fkey FOREIGN KEY (suspenso_por) REFERENCES users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='lojas_verificacao_ticket_id_fkey' and conrelid='public.lojas'::regclass) then
    alter table public.lojas add constraint lojas_verificacao_ticket_id_fkey FOREIGN KEY (verificacao_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_marketplace_user' and conrelid='public.marketplace'::regclass) then
    alter table public.marketplace add constraint fk_marketplace_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_user' and conrelid='public.marketplace'::regclass) then
    alter table public.marketplace add constraint fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='marketplace_removido_por_fkey' and conrelid='public.marketplace'::regclass) then
    alter table public.marketplace add constraint marketplace_removido_por_fkey FOREIGN KEY (removido_por) REFERENCES users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='marketplace_mensagens_anuncio_id_fkey' and conrelid='public.marketplace_mensagens'::regclass) then
    alter table public.marketplace_mensagens add constraint marketplace_mensagens_anuncio_id_fkey FOREIGN KEY (anuncio_id) REFERENCES marketplace(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='master_set_requests_user_id_fkey' and conrelid='public.master_set_requests'::regclass) then
    alter table public.master_set_requests add constraint master_set_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='monthly_ranking_snapshots_user_id_fkey' and conrelid='public.monthly_ranking_snapshots'::regclass) then
    alter table public.monthly_ranking_snapshots add constraint monthly_ranking_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='mypcards_card_map_bynx_card_id_fkey' and conrelid='public.mypcards_card_map'::regclass) then
    alter table public.mypcards_card_map add constraint mypcards_card_map_bynx_card_id_fkey FOREIGN KEY (bynx_card_id) REFERENCES pokemon_cards_all(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='notifications_user_id_fkey' and conrelid='public.notifications'::regclass) then
    alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pasta_cards_pasta_id_fkey' and conrelid='public.pasta_cards'::regclass) then
    alter table public.pasta_cards add constraint pasta_cards_pasta_id_fkey FOREIGN KEY (pasta_id) REFERENCES pastas(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pasta_cards_user_card_id_fkey' and conrelid='public.pasta_cards'::regclass) then
    alter table public.pasta_cards add constraint pasta_cards_user_card_id_fkey FOREIGN KEY (user_card_id) REFERENCES user_cards(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pastas_user_id_fkey' and conrelid='public.pastas'::regclass) then
    alter table public.pastas add constraint pastas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedido_itens_marketplace_id_fkey' and conrelid='public.pedido_itens'::regclass) then
    alter table public.pedido_itens add constraint pedido_itens_marketplace_id_fkey FOREIGN KEY (marketplace_id) REFERENCES marketplace(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedido_itens_pedido_id_fkey' and conrelid='public.pedido_itens'::regclass) then
    alter table public.pedido_itens add constraint pedido_itens_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedido_itens_produto_id_fkey' and conrelid='public.pedido_itens'::regclass) then
    alter table public.pedido_itens add constraint pedido_itens_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES loja_produtos(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_loja_id_fkey' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE RESTRICT;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_marketplace_id_fkey' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_marketplace_id_fkey FOREIGN KEY (marketplace_id) REFERENCES marketplace(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='pedidos_produto_id_fkey' and conrelid='public.pedidos'::regclass) then
    alter table public.pedidos add constraint pedidos_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES loja_produtos(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='point_redemptions_reward_id_fkey' and conrelid='public.point_redemptions'::regclass) then
    alter table public.point_redemptions add constraint point_redemptions_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE RESTRICT;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='point_redemptions_user_id_fkey' and conrelid='public.point_redemptions'::regclass) then
    alter table public.point_redemptions add constraint point_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='points_ledger_related_referral_id_fkey' and conrelid='public.points_ledger'::regclass) then
    alter table public.points_ledger add constraint points_ledger_related_referral_id_fkey FOREIGN KEY (related_referral_id) REFERENCES referrals(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='points_ledger_user_id_fkey' and conrelid='public.points_ledger'::regclass) then
    alter table public.points_ledger add constraint points_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='portfolio_history_user_id_fkey' and conrelid='public.portfolio_history'::regclass) then
    alter table public.portfolio_history add constraint portfolio_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_card_id' and conrelid='public.price_history'::regclass) then
    alter table public.price_history add constraint fk_card_id FOREIGN KEY (card_id) REFERENCES pokemon_cards_all(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='referrals_referred_user_id_fkey' and conrelid='public.referrals'::regclass) then
    alter table public.referrals add constraint referrals_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='referrals_referrer_user_id_fkey' and conrelid='public.referrals'::regclass) then
    alter table public.referrals add constraint referrals_referrer_user_id_fkey FOREIGN KEY (referrer_user_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='stripe_events_processed_loja_id_fkey' and conrelid='public.stripe_events_processed'::regclass) then
    alter table public.stripe_events_processed add constraint stripe_events_processed_loja_id_fkey FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='stripe_events_processed_user_id_fkey' and conrelid='public.stripe_events_processed'::regclass) then
    alter table public.stripe_events_processed add constraint stripe_events_processed_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ticket_anexos_ticket_id_fkey' and conrelid='public.ticket_anexos'::regclass) then
    alter table public.ticket_anexos add constraint ticket_anexos_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ticket_anexos_user_id_fkey' and conrelid='public.ticket_anexos'::regclass) then
    alter table public.ticket_anexos add constraint ticket_anexos_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ticket_messages_sender_id_fkey' and conrelid='public.ticket_messages'::regclass) then
    alter table public.ticket_messages add constraint ticket_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ticket_messages_ticket_id_fkey' and conrelid='public.ticket_messages'::regclass) then
    alter table public.ticket_messages add constraint ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='tickets_user_id_fkey' and conrelid='public.tickets'::regclass) then
    alter table public.tickets add constraint tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='trade_comparisons_user_id_fkey' and conrelid='public.trade_comparisons'::regclass) then
    alter table public.trade_comparisons add constraint trade_comparisons_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_transactions_buyer' and conrelid='public.transactions'::regclass) then
    alter table public.transactions add constraint fk_transactions_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_transactions_seller' and conrelid='public.transactions'::regclass) then
    alter table public.transactions add constraint fk_transactions_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_user_cards_user' and conrelid='public.user_cards'::regclass) then
    alter table public.user_cards add constraint fk_user_cards_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='user_cards_pokemon_api_id_fkey' and conrelid='public.user_cards'::regclass) then
    alter table public.user_cards add constraint user_cards_pokemon_api_id_fkey FOREIGN KEY (pokemon_api_id) REFERENCES pokemon_cards_all(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='user_cards_set_id_fkey' and conrelid='public.user_cards'::regclass) then
    alter table public.user_cards add constraint user_cards_set_id_fkey FOREIGN KEY (set_id) REFERENCES pokemon_sets(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='user_master_sets_user_id_fkey' and conrelid='public.user_master_sets'::regclass) then
    alter table public.user_master_sets add constraint user_master_sets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='user_paginas_lendarias_user_id_fkey' and conrelid='public.user_paginas_lendarias'::regclass) then
    alter table public.user_paginas_lendarias add constraint user_paginas_lendarias_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='users_referred_by_user_id_fkey' and conrelid='public.users'::regclass) then
    alter table public.users add constraint users_referred_by_user_id_fkey FOREIGN KEY (referred_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='watchlist_user_id_fkey' and conrelid='public.watchlist'::regclass) then
    alter table public.watchlist add constraint watchlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;

-- ============================================================
-- 11. ROW LEVEL SECURITY + POLICIES (71)
-- ============================================================
-- Unica tabela SEM RLS: price_snapshots_quarentena (fiel ao estado atual).
alter table public.avaliacoes enable row level security;
alter table public.backup_precos_carta_errada enable row level security;
alter table public.blog_categories enable row level security;
alter table public.blog_posts enable row level security;
alter table public.busca_glossario enable row level security;
alter table public.card_precos enable row level security;
alter table public.card_requests enable row level security;
alter table public.card_sinal_diario enable row level security;
alter table public.card_sinal_evento enable row level security;
alter table public.card_sinal_quota enable row level security;
alter table public.card_ultima_venda_historico enable row level security;
alter table public.card_validation_review enable row level security;
alter table public.collection enable row level security;
alter table public.conteudo_checklist enable row level security;
alter table public.conteudo_config enable row level security;
alter table public.conteudo_fila enable row level security;
alter table public.conteudo_posts enable row level security;
alter table public.dedup_liga_map enable row level security;
alter table public.dedup_liga_recuperar enable row level security;
alter table public.dedup_sets_backup enable row level security;
alter table public.despesas_recorrentes enable row level security;
alter table public.lancamentos enable row level security;
alter table public.liga_editions_master enable row level security;
alter table public.liga_scan_estado enable row level security;
alter table public.liga_scan_quota enable row level security;
alter table public.liga_set_edids enable row level security;
alter table public.liga_set_mapping enable row level security;
alter table public.loja_cliques enable row level security;
alter table public.loja_eventos enable row level security;
alter table public.loja_produtos enable row level security;
alter table public.lojas enable row level security;
alter table public.marketplace enable row level security;
alter table public.marketplace_mensagens enable row level security;
alter table public.master_set_requests enable row level security;
alter table public.master_sets enable row level security;
alter table public.mensagens_moderacao enable row level security;
alter table public.ml_afiliado_links enable row level security;
alter table public.ml_afiliado_produtos enable row level security;
alter table public.monthly_ranking_snapshots enable row level security;
alter table public.mypcards_card_map enable row level security;
alter table public.notifications enable row level security;
alter table public.pasta_cards enable row level security;
alter table public.pastas enable row level security;
alter table public.pedido_itens enable row level security;
alter table public.pedidos enable row level security;
alter table public.point_redemptions enable row level security;
alter table public.points_ledger enable row level security;
alter table public.pokemon_cards_all enable row level security;
alter table public.pokemon_pokedex enable row level security;
alter table public.pokemon_sets enable row level security;
alter table public.pokemon_species enable row level security;
alter table public.portfolio_history enable row level security;
alter table public.price_history enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.prices enable row level security;
alter table public.referrals enable row level security;
alter table public.rewards enable row level security;
alter table public.set_aliases enable row level security;
alter table public.set_id_colisao enable row level security;
alter table public.stripe_events_processed enable row level security;
alter table public.ticket_anexos enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.tickets enable row level security;
alter table public.trade_comparisons enable row level security;
alter table public.transactions enable row level security;
alter table public.user_cards enable row level security;
alter table public.user_cards_backup_20260801 enable row level security;
alter table public.user_master_sets enable row level security;
alter table public.user_paginas_lendarias enable row level security;
alter table public.users enable row level security;
alter table public.watchlist enable row level security;

drop policy if exists "Anyone can read avaliacoes" on public.avaliacoes;
create policy "Anyone can read avaliacoes" on public.avaliacoes as permissive for SELECT to public
  using (true);
drop policy if exists "Users can insert own avaliacoes" on public.avaliacoes;
create policy "Users can insert own avaliacoes" on public.avaliacoes as permissive for INSERT to public
  with check ((( SELECT auth.uid() AS uid) = avaliador_id));
drop policy if exists blog_categories_select_publico on public.blog_categories;
create policy blog_categories_select_publico on public.blog_categories as permissive for SELECT to public
  using (true);
drop policy if exists blog_posts_select_publico on public.blog_posts;
create policy blog_posts_select_publico on public.blog_posts as permissive for SELECT to public
  using (((status = 'published'::text) AND (published_at IS NOT NULL) AND (published_at <= now())));
drop policy if exists "busca_glossario public read" on public.busca_glossario;
create policy "busca_glossario public read" on public.busca_glossario as permissive for SELECT to anon, authenticated
  using (true);
drop policy if exists card_precos_leitura_publica on public.card_precos;
create policy card_precos_leitura_publica on public.card_precos as permissive for SELECT to public
  using (true);
drop policy if exists card_requests_insert_own on public.card_requests;
create policy card_requests_insert_own on public.card_requests as permissive for INSERT to authenticated
  with check ((user_id = ( SELECT auth.uid() AS uid)));
drop policy if exists card_requests_select_own on public.card_requests;
create policy card_requests_select_own on public.card_requests as permissive for SELECT to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));
drop policy if exists collection_public_read on public.collection;
create policy collection_public_read on public.collection as permissive for SELECT to public
  using (true);
drop policy if exists liga_editions_master_public_read on public.liga_editions_master;
create policy liga_editions_master_public_read on public.liga_editions_master as permissive for SELECT to public
  using (true);
drop policy if exists liga_set_edids_public_read on public.liga_set_edids;
create policy liga_set_edids_public_read on public.liga_set_edids as permissive for SELECT to anon, authenticated
  using (true);
drop policy if exists liga_set_mapping_public_read on public.liga_set_mapping;
create policy liga_set_mapping_public_read on public.liga_set_mapping as permissive for SELECT to public
  using (true);
drop policy if exists "owner can read own loja cliques" on public.loja_cliques;
create policy "owner can read own loja cliques" on public.loja_cliques as permissive for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM lojas
  WHERE ((lojas.id = loja_cliques.loja_id) AND (lojas.owner_user_id = ( SELECT auth.uid() AS uid))))));
drop policy if exists loja_eventos_owner_delete on public.loja_eventos;
create policy loja_eventos_owner_delete on public.loja_eventos as permissive for DELETE to public
  using ((EXISTS ( SELECT 1
   FROM lojas l
  WHERE ((l.id = loja_eventos.loja_id) AND (l.owner_user_id = ( SELECT auth.uid() AS uid))))));
drop policy if exists loja_eventos_owner_insert on public.loja_eventos;
create policy loja_eventos_owner_insert on public.loja_eventos as permissive for INSERT to public
  with check ((EXISTS ( SELECT 1
   FROM lojas l
  WHERE ((l.id = loja_eventos.loja_id) AND (l.owner_user_id = ( SELECT auth.uid() AS uid))))));
drop policy if exists loja_eventos_owner_read on public.loja_eventos;
create policy loja_eventos_owner_read on public.loja_eventos as permissive for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM lojas l
  WHERE ((l.id = loja_eventos.loja_id) AND (l.owner_user_id = ( SELECT auth.uid() AS uid))))));
drop policy if exists loja_eventos_owner_update on public.loja_eventos;
create policy loja_eventos_owner_update on public.loja_eventos as permissive for UPDATE to public
  using ((EXISTS ( SELECT 1
   FROM lojas l
  WHERE ((l.id = loja_eventos.loja_id) AND (l.owner_user_id = ( SELECT auth.uid() AS uid))))))
  with check ((EXISTS ( SELECT 1
   FROM lojas l
  WHERE ((l.id = loja_eventos.loja_id) AND (l.owner_user_id = ( SELECT auth.uid() AS uid))))));
drop policy if exists loja_eventos_public_read on public.loja_eventos;
create policy loja_eventos_public_read on public.loja_eventos as permissive for SELECT to public
  using ((status = 'publicado'::text));
drop policy if exists loja_produtos_select_publico on public.loja_produtos;
create policy loja_produtos_select_publico on public.loja_produtos as permissive for SELECT to anon, authenticated
  using (((ativo = true) AND (estoque > 0)));
drop policy if exists lojas_insert_owner on public.lojas;
create policy lojas_insert_owner on public.lojas as permissive for INSERT to authenticated
  with check ((owner_user_id = ( SELECT auth.uid() AS uid)));
drop policy if exists lojas_select_owner on public.lojas;
create policy lojas_select_owner on public.lojas as permissive for SELECT to authenticated
  using ((owner_user_id = ( SELECT auth.uid() AS uid)));
drop policy if exists lojas_select_publico on public.lojas;
create policy lojas_select_publico on public.lojas as permissive for SELECT to public
  using ((status = 'ativa'::text));
drop policy if exists lojas_update_owner on public.lojas;
create policy lojas_update_owner on public.lojas as permissive for UPDATE to authenticated
  using ((owner_user_id = ( SELECT auth.uid() AS uid)))
  with check (((owner_user_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['inativa'::text, 'pendente'::text]))));
drop policy if exists "Anyone can read marketplace" on public.marketplace;
create policy "Anyone can read marketplace" on public.marketplace as permissive for SELECT to public
  using (true);
drop policy if exists "Marketplace is public" on public.marketplace;
create policy "Marketplace is public" on public.marketplace as permissive for SELECT to public
  using (true);
drop policy if exists "Users can delete own listings" on public.marketplace;
create policy "Users can delete own listings" on public.marketplace as permissive for DELETE to public
  using ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists "Users can insert own listings" on public.marketplace;
create policy "Users can insert own listings" on public.marketplace as permissive for INSERT to public
  with check ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists "Users can update marketplace" on public.marketplace;
create policy "Users can update marketplace" on public.marketplace as permissive for UPDATE to public
  using (((( SELECT auth.uid() AS uid) = user_id) OR (( SELECT auth.uid() AS uid) = buyer_id) OR ((( SELECT auth.role() AS role) = 'authenticated'::text) AND (status = 'disponivel'::text) AND (( SELECT auth.uid() AS uid) <> user_id))))
  with check (((( SELECT auth.uid() AS uid) = user_id) OR (buyer_id = ( SELECT auth.uid() AS uid))));
drop policy if exists mkt_msg_participantes_leem on public.marketplace_mensagens;
create policy mkt_msg_participantes_leem on public.marketplace_mensagens as permissive for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM marketplace m
  WHERE ((m.id = marketplace_mensagens.anuncio_id) AND ((m.user_id = ( SELECT auth.uid() AS uid)) OR (m.buyer_id = ( SELECT auth.uid() AS uid)))))));
drop policy if exists "master_sets public read" on public.master_sets;
create policy "master_sets public read" on public.master_sets as permissive for SELECT to anon, authenticated
  using (true);
drop policy if exists "ml_afiliado_links public read" on public.ml_afiliado_links;
create policy "ml_afiliado_links public read" on public.ml_afiliado_links as permissive for SELECT to public
  using ((ativo = true));
drop policy if exists "ml_produtos public read" on public.ml_afiliado_produtos;
create policy "ml_produtos public read" on public.ml_afiliado_produtos as permissive for SELECT to anon, authenticated
  using ((ativo = true));
drop policy if exists ranking_select_all on public.monthly_ranking_snapshots;
create policy ranking_select_all on public.monthly_ranking_snapshots as permissive for SELECT to public
  using (true);
drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications" on public.notifications as permissive for UPDATE to public
  using ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists "Users see own notifications" on public.notifications;
create policy "Users see own notifications" on public.notifications as permissive for SELECT to public
  using ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists pasta_cards_owner_all on public.pasta_cards;
create policy pasta_cards_owner_all on public.pasta_cards as permissive for ALL to public
  using ((EXISTS ( SELECT 1
   FROM pastas p
  WHERE ((p.id = pasta_cards.pasta_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
  with check ((EXISTS ( SELECT 1
   FROM pastas p
  WHERE ((p.id = pasta_cards.pasta_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));
drop policy if exists pastas_owner_all on public.pastas;
create policy pastas_owner_all on public.pastas as permissive for ALL to public
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists pedido_itens_select_participante on public.pedido_itens;
create policy pedido_itens_select_participante on public.pedido_itens as permissive for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM pedidos p
  WHERE ((p.id = pedido_itens.pedido_id) AND ((auth.uid() = p.comprador_user_id) OR (auth.uid() = p.vendedor_user_id))))));
drop policy if exists pedidos_select_participante on public.pedidos;
create policy pedidos_select_participante on public.pedidos as permissive for SELECT to authenticated
  using (((auth.uid() = comprador_user_id) OR (auth.uid() = vendedor_user_id)));
drop policy if exists redemptions_select_own on public.point_redemptions;
create policy redemptions_select_own on public.point_redemptions as permissive for SELECT to public
  using ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists points_ledger_select_own on public.points_ledger;
create policy points_ledger_select_own on public.points_ledger as permissive for SELECT to public
  using ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists pokemon_cards_public_read on public.pokemon_cards_all;
create policy pokemon_cards_public_read on public.pokemon_cards_all as permissive for SELECT to public
  using (true);
drop policy if exists "pokemon_pokedex public read" on public.pokemon_pokedex;
create policy "pokemon_pokedex public read" on public.pokemon_pokedex as permissive for SELECT to anon, authenticated
  using (true);
drop policy if exists "Todos podem ler sets" on public.pokemon_sets;
create policy "Todos podem ler sets" on public.pokemon_sets as permissive for SELECT to public
  using (true);
drop policy if exists pokemon_species_public_read on public.pokemon_species;
create policy pokemon_species_public_read on public.pokemon_species as permissive for SELECT to public
  using (true);
drop policy if exists "Usuário vê próprio histórico" on public.portfolio_history;
create policy "Usuário vê próprio histórico" on public.portfolio_history as permissive for SELECT to public
  using (true);
drop policy if exists price_history_public_read on public.price_history;
create policy price_history_public_read on public.price_history as permissive for SELECT to public
  using (true);
drop policy if exists "price_snapshots public read" on public.price_snapshots;
create policy "price_snapshots public read" on public.price_snapshots as permissive for SELECT to anon, authenticated
  using (true);
drop policy if exists prices_public_read on public.prices;
create policy prices_public_read on public.prices as permissive for SELECT to public
  using (true);
drop policy if exists referrals_select_own on public.referrals;
create policy referrals_select_own on public.referrals as permissive for SELECT to public
  using (((( SELECT auth.uid() AS uid) = referrer_user_id) OR (( SELECT auth.uid() AS uid) = referred_user_id)));
drop policy if exists rewards_select_all on public.rewards;
create policy rewards_select_all on public.rewards as permissive for SELECT to public
  using ((active = true));
drop policy if exists set_aliases_public_read on public.set_aliases;
create policy set_aliases_public_read on public.set_aliases as permissive for SELECT to public
  using (true);
drop policy if exists stripe_events_processed_admin_read on public.stripe_events_processed;
create policy stripe_events_processed_admin_read on public.stripe_events_processed as permissive for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.email = 'eduardo@brazildigital.ag'::text)))));
drop policy if exists "users insert own ticket messages" on public.ticket_messages;
create policy "users insert own ticket messages" on public.ticket_messages as permissive for INSERT to public
  with check (((sender_type = 'user'::text) AND (sender_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = ticket_messages.ticket_id) AND (t.user_id = ( SELECT auth.uid() AS uid)))))));
drop policy if exists "users read own ticket messages" on public.ticket_messages;
create policy "users read own ticket messages" on public.ticket_messages as permissive for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = ticket_messages.ticket_id) AND (t.user_id = ( SELECT auth.uid() AS uid))))));
drop policy if exists "users insert own tickets" on public.tickets;
create policy "users insert own tickets" on public.tickets as permissive for INSERT to public
  with check ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists "users read own tickets" on public.tickets;
create policy "users read own tickets" on public.tickets as permissive for SELECT to public
  using ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists tx_select_own_party on public.transactions;
create policy tx_select_own_party on public.transactions as permissive for SELECT to authenticated
  using (((( SELECT auth.uid() AS uid) = buyer_id) OR (( SELECT auth.uid() AS uid) = seller_id)));
drop policy if exists "Public read cards of public profiles" on public.user_cards;
create policy "Public read cards of public profiles" on public.user_cards as permissive for SELECT to public
  using (is_profile_public(user_id));
drop policy if exists "Users can delete own cards" on public.user_cards;
create policy "Users can delete own cards" on public.user_cards as permissive for DELETE to public
  using ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists "Users can insert their cards" on public.user_cards;
create policy "Users can insert their cards" on public.user_cards as permissive for INSERT to public
  with check ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists "Users can see their cards" on public.user_cards;
create policy "Users can see their cards" on public.user_cards as permissive for SELECT to public
  using ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists "Users can update own cards" on public.user_cards;
create policy "Users can update own cards" on public.user_cards as permissive for UPDATE to public
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists "user_master_sets owner read" on public.user_master_sets;
create policy "user_master_sets owner read" on public.user_master_sets as permissive for SELECT to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));
drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users as permissive for INSERT to authenticated
  with check ((( SELECT auth.uid() AS uid) = id));
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users as permissive for SELECT to authenticated
  using ((( SELECT auth.uid() AS uid) = id));
drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users as permissive for UPDATE to authenticated
  using ((( SELECT auth.uid() AS uid) = id))
  with check ((( SELECT auth.uid() AS uid) = id));
drop policy if exists watchlist_delete_own on public.watchlist;
create policy watchlist_delete_own on public.watchlist as permissive for DELETE to public
  using ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists watchlist_insert_own on public.watchlist;
create policy watchlist_insert_own on public.watchlist as permissive for INSERT to public
  with check ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists watchlist_select_own on public.watchlist;
create policy watchlist_select_own on public.watchlist as permissive for SELECT to public
  using ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists watchlist_update_own on public.watchlist;
create policy watchlist_update_own on public.watchlist as permissive for UPDATE to public
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

-- ============================================================
-- 12. GRANTS
-- ============================================================
-- GRANT VENCE POLICY: sem o privilegio, a RLS nem e consultada; com o privilegio, a RLS decide a linha.
-- A view pokemon_cards (security_invoker) depende de anon/authenticated NAO terem SELECT em
-- pokemon_cards_all (ACL real: apenas "m" = maintain) e de pokemon_cards so ter grant pra service_role.
-- O papel mia_readonly (r em tudo) e de leitura do Du e NAO e recriado aqui.
-- Estado real reproduzido: revoke all + grant exato por role, para tabelas, views, matviews e sequences.
revoke all on table public.avaliacoes from anon;
grant insert, select, update, references, trigger, maintain on table public.avaliacoes to anon;
revoke all on table public.avaliacoes from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.avaliacoes to authenticated;
revoke all on table public.avaliacoes from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.avaliacoes to service_role;
revoke all on table public.backup_precos_carta_errada from anon;
revoke all on table public.backup_precos_carta_errada from authenticated;
revoke all on table public.backup_precos_carta_errada from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.backup_precos_carta_errada to service_role;
revoke all on table public.blog_categories from anon;
revoke all on table public.blog_categories from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.blog_categories to authenticated;
revoke all on table public.blog_categories from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.blog_categories to service_role;
revoke all on table public.blog_posts from anon;
revoke all on table public.blog_posts from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.blog_posts to authenticated;
revoke all on table public.blog_posts from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.blog_posts to service_role;
revoke all on table public.busca_glossario from anon;
grant insert, select, update, references, trigger, maintain on table public.busca_glossario to anon;
revoke all on table public.busca_glossario from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.busca_glossario to authenticated;
revoke all on table public.busca_glossario from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.busca_glossario to service_role;
revoke all on table public.card_precos from anon;
grant insert, select, update, references, trigger, maintain on table public.card_precos to anon;
revoke all on table public.card_precos from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.card_precos to authenticated;
revoke all on table public.card_precos from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.card_precos to service_role;
revoke all on table public.card_requests from anon;
grant insert, select, update, references, trigger, maintain on table public.card_requests to anon;
revoke all on table public.card_requests from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.card_requests to authenticated;
revoke all on table public.card_requests from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.card_requests to service_role;
revoke all on table public.card_sinal_diario from anon;
revoke all on table public.card_sinal_diario from authenticated;
revoke all on table public.card_sinal_diario from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.card_sinal_diario to service_role;
revoke all on table public.card_sinal_evento from anon;
revoke all on table public.card_sinal_evento from authenticated;
revoke all on table public.card_sinal_evento from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.card_sinal_evento to service_role;
revoke all on table public.card_sinal_quota from anon;
revoke all on table public.card_sinal_quota from authenticated;
revoke all on table public.card_sinal_quota from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.card_sinal_quota to service_role;
revoke all on table public.card_ultima_venda_historico from anon;
revoke all on table public.card_ultima_venda_historico from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.card_ultima_venda_historico to authenticated;
revoke all on table public.card_ultima_venda_historico from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.card_ultima_venda_historico to service_role;
revoke all on sequence public.card_ultima_venda_historico_id_seq from anon;
grant select, update, usage on sequence public.card_ultima_venda_historico_id_seq to anon;
revoke all on sequence public.card_ultima_venda_historico_id_seq from authenticated;
grant select, update, usage on sequence public.card_ultima_venda_historico_id_seq to authenticated;
revoke all on sequence public.card_ultima_venda_historico_id_seq from service_role;
grant select, update, usage on sequence public.card_ultima_venda_historico_id_seq to service_role;
revoke all on table public.card_validation_review from anon;
revoke all on table public.card_validation_review from authenticated;
revoke all on table public.card_validation_review from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.card_validation_review to service_role;
revoke all on sequence public.card_validation_review_id_seq from anon;
grant select, update, usage on sequence public.card_validation_review_id_seq to anon;
revoke all on sequence public.card_validation_review_id_seq from authenticated;
grant select, update, usage on sequence public.card_validation_review_id_seq to authenticated;
revoke all on sequence public.card_validation_review_id_seq from service_role;
grant select, update, usage on sequence public.card_validation_review_id_seq to service_role;
revoke all on table public.collection from anon;
grant insert, select, update, references, trigger, maintain on table public.collection to anon;
revoke all on table public.collection from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.collection to authenticated;
revoke all on table public.collection from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.collection to service_role;
revoke all on table public.conteudo_checklist from anon;
revoke all on table public.conteudo_checklist from authenticated;
revoke all on table public.conteudo_checklist from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.conteudo_checklist to service_role;
revoke all on table public.conteudo_config from anon;
revoke all on table public.conteudo_config from authenticated;
revoke all on table public.conteudo_config from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.conteudo_config to service_role;
revoke all on table public.conteudo_fila from anon;
revoke all on table public.conteudo_fila from authenticated;
revoke all on table public.conteudo_fila from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.conteudo_fila to service_role;
revoke all on table public.conteudo_posts from anon;
revoke all on table public.conteudo_posts from authenticated;
revoke all on table public.conteudo_posts from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.conteudo_posts to service_role;
revoke all on table public.dedup_liga_map from anon;
revoke all on table public.dedup_liga_map from authenticated;
revoke all on table public.dedup_liga_map from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.dedup_liga_map to service_role;
revoke all on table public.dedup_liga_recuperar from anon;
revoke all on table public.dedup_liga_recuperar from authenticated;
revoke all on table public.dedup_liga_recuperar from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.dedup_liga_recuperar to service_role;
revoke all on table public.dedup_sets_backup from anon;
revoke all on table public.dedup_sets_backup from authenticated;
revoke all on table public.dedup_sets_backup from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.dedup_sets_backup to service_role;
revoke all on sequence public.dedup_sets_backup_id_seq from anon;
grant select, update, usage on sequence public.dedup_sets_backup_id_seq to anon;
revoke all on sequence public.dedup_sets_backup_id_seq from authenticated;
grant select, update, usage on sequence public.dedup_sets_backup_id_seq to authenticated;
revoke all on sequence public.dedup_sets_backup_id_seq from service_role;
grant select, update, usage on sequence public.dedup_sets_backup_id_seq to service_role;
revoke all on table public.despesas_recorrentes from anon;
grant insert, select, update, references, trigger, maintain on table public.despesas_recorrentes to anon;
revoke all on table public.despesas_recorrentes from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.despesas_recorrentes to authenticated;
revoke all on table public.despesas_recorrentes from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.despesas_recorrentes to service_role;
revoke all on table public.lancamentos from anon;
grant insert, select, update, references, trigger, maintain on table public.lancamentos to anon;
revoke all on table public.lancamentos from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.lancamentos to authenticated;
revoke all on table public.lancamentos from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.lancamentos to service_role;
revoke all on table public.liga_editions_master from anon;
grant insert, select, update, references, trigger, maintain on table public.liga_editions_master to anon;
revoke all on table public.liga_editions_master from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.liga_editions_master to authenticated;
revoke all on table public.liga_editions_master from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.liga_editions_master to service_role;
revoke all on table public.liga_scan_estado from anon;
revoke all on table public.liga_scan_estado from authenticated;
revoke all on table public.liga_scan_estado from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.liga_scan_estado to service_role;
revoke all on table public.liga_scan_quota from anon;
revoke all on table public.liga_scan_quota from authenticated;
revoke all on table public.liga_scan_quota from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.liga_scan_quota to service_role;
revoke all on table public.liga_set_edids from anon;
grant insert, select, update, references, trigger, maintain on table public.liga_set_edids to anon;
revoke all on table public.liga_set_edids from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.liga_set_edids to authenticated;
revoke all on table public.liga_set_edids from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.liga_set_edids to service_role;
revoke all on table public.liga_set_mapping from anon;
grant insert, select, update, references, trigger, maintain on table public.liga_set_mapping to anon;
revoke all on table public.liga_set_mapping from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.liga_set_mapping to authenticated;
revoke all on table public.liga_set_mapping from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.liga_set_mapping to service_role;
revoke all on sequence public.liga_set_mapping_id_seq from anon;
grant select, update, usage on sequence public.liga_set_mapping_id_seq to anon;
revoke all on sequence public.liga_set_mapping_id_seq from authenticated;
grant select, update, usage on sequence public.liga_set_mapping_id_seq to authenticated;
revoke all on sequence public.liga_set_mapping_id_seq from service_role;
grant select, update, usage on sequence public.liga_set_mapping_id_seq to service_role;
revoke all on table public.loja_cliques from anon;
grant insert, select, update, references, trigger, maintain on table public.loja_cliques to anon;
revoke all on table public.loja_cliques from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.loja_cliques to authenticated;
revoke all on table public.loja_cliques from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.loja_cliques to service_role;
revoke all on table public.loja_eventos from anon;
grant insert, select, update, references, trigger, maintain on table public.loja_eventos to anon;
revoke all on table public.loja_eventos from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.loja_eventos to authenticated;
revoke all on table public.loja_eventos from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.loja_eventos to service_role;
revoke all on table public.loja_produtos from anon;
grant select on table public.loja_produtos to anon;
revoke all on table public.loja_produtos from authenticated;
grant select on table public.loja_produtos to authenticated;
revoke all on table public.loja_produtos from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.loja_produtos to service_role;
revoke all on table public.lojas from anon;
grant insert, select, references, trigger, maintain on table public.lojas to anon;
revoke all on table public.lojas from authenticated;
grant insert, select, delete, truncate, references, trigger, maintain on table public.lojas to authenticated;
revoke all on table public.lojas from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.lojas to service_role;
revoke all on table public.marketplace from anon;
grant insert, select, references, trigger, maintain on table public.marketplace to anon;
revoke all on table public.marketplace from authenticated;
grant insert, select, delete, truncate, references, trigger, maintain on table public.marketplace to authenticated;
revoke all on table public.marketplace from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.marketplace to service_role;
revoke all on table public.marketplace_mensagens from anon;
grant insert, select, update, references, trigger, maintain on table public.marketplace_mensagens to anon;
revoke all on table public.marketplace_mensagens from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.marketplace_mensagens to authenticated;
revoke all on table public.marketplace_mensagens from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.marketplace_mensagens to service_role;
revoke all on table public.master_set_requests from anon;
grant insert, select, update, references, trigger, maintain on table public.master_set_requests to anon;
revoke all on table public.master_set_requests from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.master_set_requests to authenticated;
revoke all on table public.master_set_requests from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.master_set_requests to service_role;
revoke all on table public.master_sets from anon;
grant insert, select, update, references, trigger, maintain on table public.master_sets to anon;
revoke all on table public.master_sets from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.master_sets to authenticated;
revoke all on table public.master_sets from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.master_sets to service_role;
revoke all on table public.mensagens_moderacao from anon;
grant insert, select, update, references, trigger, maintain on table public.mensagens_moderacao to anon;
revoke all on table public.mensagens_moderacao from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.mensagens_moderacao to authenticated;
revoke all on table public.mensagens_moderacao from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.mensagens_moderacao to service_role;
revoke all on table public.ml_afiliado_links from anon;
grant insert, select, update, references, trigger, maintain on table public.ml_afiliado_links to anon;
revoke all on table public.ml_afiliado_links from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.ml_afiliado_links to authenticated;
revoke all on table public.ml_afiliado_links from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.ml_afiliado_links to service_role;
revoke all on table public.ml_afiliado_produtos from anon;
grant insert, select, update, references, trigger, maintain on table public.ml_afiliado_produtos to anon;
revoke all on table public.ml_afiliado_produtos from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.ml_afiliado_produtos to authenticated;
revoke all on table public.ml_afiliado_produtos from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.ml_afiliado_produtos to service_role;
revoke all on sequence public.ml_afiliado_produtos_id_seq from anon;
grant select, update, usage on sequence public.ml_afiliado_produtos_id_seq to anon;
revoke all on sequence public.ml_afiliado_produtos_id_seq from authenticated;
grant select, update, usage on sequence public.ml_afiliado_produtos_id_seq to authenticated;
revoke all on sequence public.ml_afiliado_produtos_id_seq from service_role;
grant select, update, usage on sequence public.ml_afiliado_produtos_id_seq to service_role;
revoke all on table public.monthly_ranking_snapshots from anon;
grant insert, select, update, references, trigger, maintain on table public.monthly_ranking_snapshots to anon;
revoke all on table public.monthly_ranking_snapshots from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.monthly_ranking_snapshots to authenticated;
revoke all on table public.monthly_ranking_snapshots from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.monthly_ranking_snapshots to service_role;
revoke all on table public.mv_base_pokemon_tipos from anon;
revoke all on table public.mv_base_pokemon_tipos from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.mv_base_pokemon_tipos to authenticated;
revoke all on table public.mv_base_pokemon_tipos from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.mv_base_pokemon_tipos to service_role;
revoke all on table public.mv_base_pokemon_tipos_v1_old from anon;
revoke all on table public.mv_base_pokemon_tipos_v1_old from authenticated;
revoke all on table public.mv_base_pokemon_tipos_v1_old from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.mv_base_pokemon_tipos_v1_old to service_role;
revoke all on table public.mv_price_movers from anon;
revoke all on table public.mv_price_movers from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.mv_price_movers to authenticated;
revoke all on table public.mv_price_movers from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.mv_price_movers to service_role;
revoke all on table public.mv_price_movers_v1_old from anon;
revoke all on table public.mv_price_movers_v1_old from authenticated;
revoke all on table public.mv_price_movers_v1_old from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.mv_price_movers_v1_old to service_role;
revoke all on table public.mv_set_index_stats from anon;
revoke all on table public.mv_set_index_stats from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.mv_set_index_stats to authenticated;
revoke all on table public.mv_set_index_stats from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.mv_set_index_stats to service_role;
revoke all on table public.mv_set_index_stats_v1_old from anon;
revoke all on table public.mv_set_index_stats_v1_old from authenticated;
revoke all on table public.mv_set_index_stats_v1_old from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.mv_set_index_stats_v1_old to service_role;
revoke all on table public.mypcards_card_map from anon;
revoke all on table public.mypcards_card_map from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.mypcards_card_map to authenticated;
revoke all on table public.mypcards_card_map from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.mypcards_card_map to service_role;
revoke all on table public.notifications from anon;
grant insert, select, update, references, trigger, maintain on table public.notifications to anon;
revoke all on table public.notifications from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.notifications to authenticated;
revoke all on table public.notifications from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.notifications to service_role;
revoke all on table public.pasta_cards from anon;
grant insert, select, update, references, trigger, maintain on table public.pasta_cards to anon;
revoke all on table public.pasta_cards from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.pasta_cards to authenticated;
revoke all on table public.pasta_cards from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.pasta_cards to service_role;
revoke all on table public.pastas from anon;
grant insert, select, references, trigger, maintain on table public.pastas to anon;
revoke all on table public.pastas from authenticated;
grant insert, select, delete, truncate, references, trigger, maintain on table public.pastas to authenticated;
revoke all on table public.pastas from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.pastas to service_role;
revoke all on table public.pedido_itens from anon;
revoke all on table public.pedido_itens from authenticated;
grant select on table public.pedido_itens to authenticated;
revoke all on table public.pedido_itens from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.pedido_itens to service_role;
revoke all on table public.pedidos from anon;
revoke all on table public.pedidos from authenticated;
grant select on table public.pedidos to authenticated;
revoke all on table public.pedidos from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.pedidos to service_role;
revoke all on sequence public.pedidos_numero_seq from anon;
grant select, update, usage on sequence public.pedidos_numero_seq to anon;
revoke all on sequence public.pedidos_numero_seq from authenticated;
grant select, update, usage on sequence public.pedidos_numero_seq to authenticated;
revoke all on sequence public.pedidos_numero_seq from service_role;
grant select, update, usage on sequence public.pedidos_numero_seq to service_role;
revoke all on table public.point_redemptions from anon;
grant insert, select, update, references, trigger, maintain on table public.point_redemptions to anon;
revoke all on table public.point_redemptions from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.point_redemptions to authenticated;
revoke all on table public.point_redemptions from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.point_redemptions to service_role;
revoke all on table public.points_ledger from anon;
grant insert, select, update, references, trigger, maintain on table public.points_ledger to anon;
revoke all on table public.points_ledger from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.points_ledger to authenticated;
revoke all on table public.points_ledger from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.points_ledger to service_role;
revoke all on table public.pokemon_cards from anon;
revoke all on table public.pokemon_cards from authenticated;
revoke all on table public.pokemon_cards from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.pokemon_cards to service_role;
revoke all on table public.pokemon_cards_all from anon;
grant maintain on table public.pokemon_cards_all to anon;
revoke all on table public.pokemon_cards_all from authenticated;
grant maintain on table public.pokemon_cards_all to authenticated;
revoke all on table public.pokemon_cards_all from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.pokemon_cards_all to service_role;
revoke all on table public.pokemon_pokedex from anon;
grant select, maintain on table public.pokemon_pokedex to anon;
revoke all on table public.pokemon_pokedex from authenticated;
grant select, maintain on table public.pokemon_pokedex to authenticated;
revoke all on table public.pokemon_pokedex from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.pokemon_pokedex to service_role;
revoke all on table public.pokemon_sets from anon;
grant select, maintain on table public.pokemon_sets to anon;
revoke all on table public.pokemon_sets from authenticated;
grant select, maintain on table public.pokemon_sets to authenticated;
revoke all on table public.pokemon_sets from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.pokemon_sets to service_role;
revoke all on table public.pokemon_species from anon;
grant insert, select, update, references, trigger, maintain on table public.pokemon_species to anon;
revoke all on table public.pokemon_species from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.pokemon_species to authenticated;
revoke all on table public.pokemon_species from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.pokemon_species to service_role;
revoke all on table public.portfolio_history from anon;
grant insert, select, update, references, trigger, maintain on table public.portfolio_history to anon;
revoke all on table public.portfolio_history from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.portfolio_history to authenticated;
revoke all on table public.portfolio_history from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.portfolio_history to service_role;
revoke all on table public.price_history from anon;
grant insert, select, update, references, trigger, maintain on table public.price_history to anon;
revoke all on table public.price_history from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.price_history to authenticated;
revoke all on table public.price_history from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.price_history to service_role;
revoke all on sequence public.price_history_id_seq from anon;
grant select, update, usage on sequence public.price_history_id_seq to anon;
revoke all on sequence public.price_history_id_seq from authenticated;
grant select, update, usage on sequence public.price_history_id_seq to authenticated;
revoke all on sequence public.price_history_id_seq from service_role;
grant select, update, usage on sequence public.price_history_id_seq to service_role;
revoke all on table public.price_snapshots from anon;
grant insert, select, update, references, trigger, maintain on table public.price_snapshots to anon;
revoke all on table public.price_snapshots from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.price_snapshots to authenticated;
revoke all on table public.price_snapshots from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.price_snapshots to service_role;
revoke all on sequence public.price_snapshots_id_seq from anon;
grant select, update, usage on sequence public.price_snapshots_id_seq to anon;
revoke all on sequence public.price_snapshots_id_seq from authenticated;
grant select, update, usage on sequence public.price_snapshots_id_seq to authenticated;
revoke all on sequence public.price_snapshots_id_seq from service_role;
grant select, update, usage on sequence public.price_snapshots_id_seq to service_role;
revoke all on table public.price_snapshots_quarentena from anon;
revoke all on table public.price_snapshots_quarentena from authenticated;
revoke all on table public.price_snapshots_quarentena from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.price_snapshots_quarentena to service_role;
revoke all on table public.prices from anon;
grant insert, select, update, references, trigger, maintain on table public.prices to anon;
revoke all on table public.prices from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.prices to authenticated;
revoke all on table public.prices from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.prices to service_role;
revoke all on table public.public_users from anon;
grant select on table public.public_users to anon;
revoke all on table public.public_users from authenticated;
grant select on table public.public_users to authenticated;
revoke all on table public.public_users from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.public_users to service_role;
revoke all on table public.referrals from anon;
grant insert, select, update, references, trigger, maintain on table public.referrals to anon;
revoke all on table public.referrals from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.referrals to authenticated;
revoke all on table public.referrals from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.referrals to service_role;
revoke all on table public.rewards from anon;
grant insert, select, update, references, trigger, maintain on table public.rewards to anon;
revoke all on table public.rewards from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.rewards to authenticated;
revoke all on table public.rewards from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.rewards to service_role;
revoke all on table public.set_aliases from anon;
grant insert, select, update, references, trigger, maintain on table public.set_aliases to anon;
revoke all on table public.set_aliases from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.set_aliases to authenticated;
revoke all on table public.set_aliases from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.set_aliases to service_role;
revoke all on table public.set_id_colisao from anon;
revoke all on table public.set_id_colisao from authenticated;
revoke all on table public.set_id_colisao from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.set_id_colisao to service_role;
revoke all on table public.stripe_events_processed from anon;
grant insert, select, update, references, trigger, maintain on table public.stripe_events_processed to anon;
revoke all on table public.stripe_events_processed from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.stripe_events_processed to authenticated;
revoke all on table public.stripe_events_processed from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.stripe_events_processed to service_role;
revoke all on table public.ticket_anexos from anon;
revoke all on table public.ticket_anexos from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.ticket_anexos to authenticated;
revoke all on table public.ticket_anexos from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.ticket_anexos to service_role;
revoke all on table public.ticket_messages from anon;
grant insert, select, update, references, trigger, maintain on table public.ticket_messages to anon;
revoke all on table public.ticket_messages from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.ticket_messages to authenticated;
revoke all on table public.ticket_messages from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.ticket_messages to service_role;
revoke all on table public.tickets from anon;
grant insert, select, update, references, trigger, maintain on table public.tickets to anon;
revoke all on table public.tickets from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.tickets to authenticated;
revoke all on table public.tickets from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.tickets to service_role;
revoke all on table public.trade_comparisons from anon;
revoke all on table public.trade_comparisons from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.trade_comparisons to authenticated;
revoke all on table public.trade_comparisons from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.trade_comparisons to service_role;
revoke all on table public.transactions from anon;
grant insert, select, update, references, trigger, maintain on table public.transactions to anon;
revoke all on table public.transactions from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.transactions to authenticated;
revoke all on table public.transactions from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.transactions to service_role;
revoke all on table public.user_cards from anon;
grant insert, select, update, references, trigger, maintain on table public.user_cards to anon;
revoke all on table public.user_cards from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.user_cards to authenticated;
revoke all on table public.user_cards from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.user_cards to service_role;
revoke all on table public.user_cards_backup_20260801 from anon;
revoke all on table public.user_cards_backup_20260801 from authenticated;
revoke all on table public.user_cards_backup_20260801 from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.user_cards_backup_20260801 to service_role;
revoke all on table public.user_master_sets from anon;
grant insert, select, update, references, trigger, maintain on table public.user_master_sets to anon;
revoke all on table public.user_master_sets from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.user_master_sets to authenticated;
revoke all on table public.user_master_sets from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.user_master_sets to service_role;
revoke all on table public.user_paginas_lendarias from anon;
revoke all on table public.user_paginas_lendarias from authenticated;
revoke all on table public.user_paginas_lendarias from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.user_paginas_lendarias to service_role;
revoke all on table public.users from anon;
grant insert, references, trigger, maintain on table public.users to anon;
revoke all on table public.users from authenticated;
grant insert, select, delete, truncate, references, trigger, maintain on table public.users to authenticated;
revoke all on table public.users from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.users to service_role;
revoke all on table public.v_auditoria_liga_link from anon;
revoke all on table public.v_auditoria_liga_link from authenticated;
revoke all on table public.v_auditoria_liga_link from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.v_auditoria_liga_link to service_role;
revoke all on table public.watchlist from anon;
grant insert, select, update, references, trigger, maintain on table public.watchlist to anon;
revoke all on table public.watchlist from authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.watchlist to authenticated;
revoke all on table public.watchlist from service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.watchlist to service_role;

-- Funcoes: estado real de pg_proc.proacl (owner postgres). "public" = PUBLIC.
-- Funcoes sem ACL explicita herdam o default privilege (EXECUTE para anon/authenticated/service_role).
revoke execute on function public._decode_liga(text) from public, anon, authenticated, service_role;
grant execute on function public._decode_liga(text) to public, anon, authenticated, service_role;
revoke execute on function public._nn(text) from public, anon, authenticated, service_role;
grant execute on function public._nn(text) to public, anon, authenticated, service_role;
revoke execute on function public._palavras(text) from public, anon, authenticated, service_role;
grant execute on function public._palavras(text) to public, anon, authenticated, service_role;
revoke execute on function public._selo_identidade(text) from public, anon, authenticated, service_role;
grant execute on function public._selo_identidade(text) to public, anon, authenticated, service_role;
revoke execute on function public.admin_catalog_total_value() from public, anon, authenticated, service_role;
grant execute on function public.admin_catalog_total_value() to anon, authenticated, service_role;
revoke execute on function public.admin_get_users_last_sign_in(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.admin_get_users_last_sign_in(uuid[]) to service_role;
revoke execute on function public.admin_listar_conversas(text) from public, anon, authenticated, service_role;
grant execute on function public.admin_listar_conversas(text) to service_role;
revoke execute on function public.admin_moderar_mensagem(uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.admin_moderar_mensagem(uuid,text,text) to service_role;
revoke execute on function public.admin_pokedex_counts(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.admin_pokedex_counts(uuid[]) to service_role;
revoke execute on function public.admin_registered_cards_value() from public, anon, authenticated, service_role;
grant execute on function public.admin_registered_cards_value() to anon, authenticated, service_role;
revoke execute on function public.admin_top_collectors(integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_top_collectors(integer) to anon, authenticated, service_role;
revoke execute on function public.admin_top_owned_cards(integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_top_owned_cards(integer) to anon, authenticated, service_role;
revoke execute on function public.admin_user_pastas(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_user_pastas(uuid) to service_role;
revoke execute on function public.admin_ver_conversa(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_ver_conversa(uuid) to service_role;
revoke execute on function public.analisar_import_lote(text[]) from public, anon, authenticated, service_role;
grant execute on function public.analisar_import_lote(text[]) to anon, authenticated, service_role;
revoke execute on function public.award_referral_signup(uuid,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.award_referral_signup(uuid,text,text,text,text) to service_role;
revoke execute on function public.backfill_liga_base_pokemon() from public, anon, authenticated, service_role;
grant execute on function public.backfill_liga_base_pokemon() to service_role;
revoke execute on function public.broadcast_notification(text,text,text,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.broadcast_notification(text,text,text,jsonb) to service_role;
revoke execute on function public.busca_cartas(text,integer,text) from public, anon, authenticated, service_role;
grant execute on function public.busca_cartas(text,integer,text) to public, anon, authenticated, service_role;
revoke execute on function public.busca_global(text,integer) from public, anon, authenticated, service_role;
grant execute on function public.busca_global(text,integer) to public, anon, authenticated, service_role;
revoke execute on function public.capture_price_snapshots() from public, anon, authenticated, service_role;
grant execute on function public.capture_price_snapshots() to service_role;
revoke execute on function public.card_sinal_purge() from public, anon, authenticated, service_role;
grant execute on function public.card_sinal_purge() to service_role;
revoke execute on function public.card_sinal_rollup(integer) from public, anon, authenticated, service_role;
grant execute on function public.card_sinal_rollup(integer) to service_role;
revoke execute on function public.contar_conversas_nao_lidas() from public, anon, authenticated, service_role;
grant execute on function public.contar_conversas_nao_lidas() to public, anon, authenticated, service_role;
revoke execute on function public.cpf_em_uso(text) from public, anon, authenticated, service_role;
grant execute on function public.cpf_em_uso(text) to service_role;
revoke execute on function public.decrement_scan_credits(uuid) from public, anon, authenticated, service_role;
grant execute on function public.decrement_scan_credits(uuid) to service_role;
revoke execute on function public.enforce_pasta_cards_limit_free() from public, anon, authenticated, service_role;
grant execute on function public.enforce_pasta_cards_limit_free() to service_role;
revoke execute on function public.enforce_pasta_limit_free() from public, anon, authenticated, service_role;
grant execute on function public.enforce_pasta_limit_free() to service_role;
revoke execute on function public.enforce_unique_cpf() from public, anon, authenticated, service_role;
grant execute on function public.enforce_unique_cpf() to service_role;
revoke execute on function public.enviar_mensagem(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.enviar_mensagem(uuid,text) to public, anon, authenticated, service_role;
revoke execute on function public.extract_base_pokemon_names(text) from public, anon, authenticated, service_role;
grant execute on function public.extract_base_pokemon_names(text) to public, anon, authenticated, service_role;
revoke execute on function public.f_unaccent(text) from public, anon, authenticated, service_role;
grant execute on function public.f_unaccent(text) to public, anon, authenticated, service_role;
revoke execute on function public.fn_log_price_history() from public, anon, authenticated, service_role;
grant execute on function public.fn_log_price_history() to service_role;
revoke execute on function public.fn_ticket_touch() from public, anon, authenticated, service_role;
grant execute on function public.fn_ticket_touch() to service_role;
revoke execute on function public.generate_unique_referral_code() from public, anon, authenticated, service_role;
grant execute on function public.generate_unique_referral_code() to service_role;
revoke execute on function public.get_avaliacoes_usuario(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_avaliacoes_usuario(uuid) to public, anon, authenticated, service_role;
revoke execute on function public.get_base_pokemon_com_tipos() from public, anon, authenticated, service_role;
grant execute on function public.get_base_pokemon_com_tipos() to public, anon, authenticated, service_role;
revoke execute on function public.get_card_price_history(text,integer) from public, anon, authenticated, service_role;
grant execute on function public.get_card_price_history(text,integer) to anon, authenticated, service_role;
revoke execute on function public.get_existing_set_ids() from public, anon, authenticated, service_role;
grant execute on function public.get_existing_set_ids() to public, anon, authenticated, service_role;
revoke execute on function public.get_generation_heroes() from public, anon, authenticated, service_role;
grant execute on function public.get_generation_heroes() to public, anon, authenticated, service_role;
revoke execute on function public.get_master_set_detail(text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_master_set_detail(text,uuid) to service_role;
revoke execute on function public.get_master_set_sheet(text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_master_set_sheet(text,uuid) to service_role;
revoke execute on function public.get_master_set_sheet_v2(text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_master_set_sheet_v2(text,uuid) to service_role;
revoke execute on function public.get_master_sets_catalog(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_master_sets_catalog(uuid) to service_role;
revoke execute on function public.get_owned_pokemon_names() from public, anon, authenticated, service_role;
grant execute on function public.get_owned_pokemon_names() to public, anon, authenticated, service_role;
revoke execute on function public.get_pokemon_hub(text) from public, anon, authenticated, service_role;
grant execute on function public.get_pokemon_hub(text) to public, anon, authenticated, service_role;
revoke execute on function public.get_pokemon_hub_cards(text) from public, anon, authenticated, service_role;
grant execute on function public.get_pokemon_hub_cards(text) to public, anon, authenticated, service_role;
revoke execute on function public.get_price_movers(integer) from public, anon, authenticated, service_role;
grant execute on function public.get_price_movers(integer) to public, anon, authenticated, service_role;
revoke execute on function public.get_ranking(integer,integer) from public, anon, authenticated, service_role;
grant execute on function public.get_ranking(integer,integer) to public, anon, authenticated, service_role;
revoke execute on function public.get_referral_stats() from public, anon, authenticated, service_role;
grant execute on function public.get_referral_stats() to public, anon, authenticated, service_role;
revoke execute on function public.get_related_cards(text,integer) from public, anon, authenticated, service_role;
grant execute on function public.get_related_cards(text,integer) to public, anon, authenticated, service_role;
revoke execute on function public.get_scan_status(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_scan_status(uuid) to authenticated, service_role;
revoke execute on function public.get_sinais_carta(integer,integer,integer,integer) from public, anon, authenticated, service_role;
grant execute on function public.get_sinais_carta(integer,integer,integer,integer) to service_role;
revoke execute on function public.get_top_cards(integer) from public, anon, authenticated, service_role;
grant execute on function public.get_top_cards(integer) to public, anon, authenticated, service_role;
revoke execute on function public.get_unique_base_pokemon() from public, anon, authenticated, service_role;
grant execute on function public.get_unique_base_pokemon() to public, anon, authenticated, service_role;
revoke execute on function public.get_unique_pokemon() from public, anon, authenticated, service_role;
grant execute on function public.get_unique_pokemon() to public, anon, authenticated, service_role;
revoke execute on function public.get_watchlist() from public, anon, authenticated, service_role;
grant execute on function public.get_watchlist() to public, anon, authenticated, service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated, service_role;
grant execute on function public.handle_new_user() to service_role;
revoke execute on function public.importar_cartas_lote(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.importar_cartas_lote(jsonb) to anon, authenticated, service_role;
revoke execute on function public.is_profile_public(uuid) from public, anon, authenticated, service_role;
grant execute on function public.is_profile_public(uuid) to anon, authenticated, service_role;
revoke execute on function public.landing_stats() from public, anon, authenticated, service_role;
grant execute on function public.landing_stats() to anon, authenticated, service_role;
revoke execute on function public.limpar_entidades_html(text) from public, anon, authenticated, service_role;
grant execute on function public.limpar_entidades_html(text) to public, anon, authenticated, service_role;
revoke execute on function public.listar_conversas() from public, anon, authenticated, service_role;
grant execute on function public.listar_conversas() to public, anon, authenticated, service_role;
revoke execute on function public.lojas_append_foto(uuid,uuid,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.lojas_append_foto(uuid,uuid,text,integer) to service_role;
revoke execute on function public.marcar_conversa_lida(uuid) from public, anon, authenticated, service_role;
grant execute on function public.marcar_conversa_lida(uuid) to public, anon, authenticated, service_role;
revoke execute on function public.mark_referral_engaged(uuid) from public, anon, authenticated, service_role;
grant execute on function public.mark_referral_engaged(uuid) to service_role;
revoke execute on function public.master_set_card_rows(text) from public, anon, authenticated, service_role;
grant execute on function public.master_set_card_rows(text) to service_role;
revoke execute on function public.minhas_pastas() from public, anon, authenticated, service_role;
grant execute on function public.minhas_pastas() to anon, authenticated, service_role;
revoke execute on function public.montar_card_slug(text,text,integer,text) from public, anon, authenticated, service_role;
grant execute on function public.montar_card_slug(text,text,integer,text) to public, anon, authenticated, service_role;
revoke execute on function public.pasta_detalhe(uuid) from public, anon, authenticated, service_role;
grant execute on function public.pasta_detalhe(uuid) to anon, authenticated, service_role;
revoke execute on function public.pasta_publica(uuid) from public, anon, authenticated, service_role;
grant execute on function public.pasta_publica(uuid) to anon, authenticated, service_role;
revoke execute on function public.pastas_colecao_topo() from public, anon, authenticated, service_role;
grant execute on function public.pastas_colecao_topo() to anon, authenticated, service_role;
revoke execute on function public.perfil_pastas_publicas(text) from public, anon, authenticated, service_role;
grant execute on function public.perfil_pastas_publicas(text) to anon, authenticated, service_role;
revoke execute on function public.pkmn_slugify(text) from public, anon, authenticated, service_role;
grant execute on function public.pkmn_slugify(text) to public, anon, authenticated, service_role;
revoke execute on function public.pokedex_landing_data() from public, anon, authenticated, service_role;
grant execute on function public.pokedex_landing_data() to anon, authenticated, service_role;
revoke execute on function public.preencher_card_slug() from public, anon, authenticated, service_role;
grant execute on function public.preencher_card_slug() to public, anon, authenticated, service_role;
revoke execute on function public.qualify_referral(uuid) from public, anon, authenticated, service_role;
grant execute on function public.qualify_referral(uuid) to service_role;
revoke execute on function public.rebuild_base_pokemon_names() from public, anon, authenticated, service_role;
grant execute on function public.rebuild_base_pokemon_names() to public, anon, authenticated, service_role;
revoke execute on function public.redeem_points(uuid) from public, anon, authenticated, service_role;
grant execute on function public.redeem_points(uuid) to public, anon, authenticated, service_role;
revoke execute on function public.registrar_sinal_carta(text,text,text,smallint) from public, anon, authenticated, service_role;
grant execute on function public.registrar_sinal_carta(text,text,text,smallint) to service_role;
revoke execute on function public.reordenar_pasta(uuid,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.reordenar_pasta(uuid,jsonb) to anon, authenticated, service_role;
revoke execute on function public.restaurar_estoque_produto(uuid) from public, anon, authenticated, service_role;
grant execute on function public.restaurar_estoque_produto(uuid) to service_role;
revoke execute on function public.restore_scan_credit(uuid) from public, anon, authenticated, service_role;
grant execute on function public.restore_scan_credit(uuid) to service_role;
revoke execute on function public.set_index_stats() from public, anon, authenticated, service_role;
grant execute on function public.set_index_stats() to public, anon, authenticated, service_role;
revoke execute on function public.set_loja_eventos_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.set_loja_eventos_updated_at() to service_role;
revoke execute on function public.set_lojas_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.set_lojas_updated_at() to service_role;
revoke execute on function public.set_pasta_ativa(uuid) from public, anon, authenticated, service_role;
grant execute on function public.set_pasta_ativa(uuid) to anon, authenticated, service_role;
revoke execute on function public.sitemap_set_ids() from public, anon, authenticated, service_role;
grant execute on function public.sitemap_set_ids() to public, anon, authenticated, service_role;
revoke execute on function public.smart_search_cards(text,integer,integer) from public, anon, authenticated, service_role;
grant execute on function public.smart_search_cards(text,integer,integer) to public, anon, authenticated, service_role;
revoke execute on function public.smart_search_cards_v2(text,integer,integer) from public, anon, authenticated, service_role;
grant execute on function public.smart_search_cards_v2(text,integer,integer) to public, anon, authenticated, service_role;
revoke execute on function public.smart_search_cards_v3(text,integer,integer) from public, anon, authenticated, service_role;
grant execute on function public.smart_search_cards_v3(text,integer,integer) to public, anon, authenticated, service_role;
revoke execute on function public.smart_search_cards_v4(text,integer,integer) from public, anon, authenticated, service_role;
grant execute on function public.smart_search_cards_v4(text,integer,integer) to public, anon, authenticated, service_role;
revoke execute on function public.smart_search_cards_v5(text,integer,integer) from public, anon, authenticated, service_role;
grant execute on function public.smart_search_cards_v5(text,integer,integer) to public, anon, authenticated, service_role;
revoke execute on function public.snapshot_monthly_ranking(integer,integer) from public, anon, authenticated, service_role;
grant execute on function public.snapshot_monthly_ranking(integer,integer) to service_role;
revoke execute on function public.sync_pastas_lock() from public, anon, authenticated, service_role;
grant execute on function public.sync_pastas_lock() to service_role;
revoke execute on function public.touch_last_seen() from public, anon, authenticated, service_role;
grant execute on function public.touch_last_seen() to authenticated, service_role;
revoke execute on function public.touch_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.touch_updated_at() to public, anon, authenticated, service_role;
revoke execute on function public.traduzir_busca_pt(text) from public, anon, authenticated, service_role;
grant execute on function public.traduzir_busca_pt(text) to public, anon, authenticated, service_role;
revoke execute on function public.user_pastas_ilimitadas(uuid) from public, anon, authenticated, service_role;
grant execute on function public.user_pastas_ilimitadas(uuid) to public, anon, authenticated, service_role;
revoke execute on function public.users_generate_referral_code() from public, anon, authenticated, service_role;
grant execute on function public.users_generate_referral_code() to public, anon, authenticated, service_role;
revoke execute on function public.vendas_concluidas_count(uuid) from public, anon, authenticated, service_role;
grant execute on function public.vendas_concluidas_count(uuid) to anon, authenticated, service_role;

-- ============================================================
-- 13. STORAGE
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('blog-fotos', 'blog-fotos', 't', null, null) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('card-images', 'card-images', 't', 2097152, '{image/jpeg,image/jpg,image/png,image/webp}') on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('loja-fotos', 'loja-fotos', 't', 5242880, '{image/jpeg,image/png,image/webp}') on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('marketplace-fotos', 'marketplace-fotos', 't', 5242880, '{image/jpeg,image/png,image/webp}') on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('paginas-lendarias', 'paginas-lendarias', 't', null, null) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('pastas', 'pastas', 't', 5242880, '{image/jpeg,image/png,image/webp}') on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('ticket-anexos', 'ticket-anexos', 'f', 10485760, '{image/jpeg,image/png,image/webp,image/heic,application/pdf}') on conflict (id) do nothing;

drop policy if exists "loja-fotos service role write" on storage.objects;
create policy "loja-fotos service role write" on storage.objects as permissive for ALL to service_role
  using ((bucket_id = 'loja-fotos'::text))
  with check ((bucket_id = 'loja-fotos'::text));
drop policy if exists "marketplace-fotos owner delete" on storage.objects;
create policy "marketplace-fotos owner delete" on storage.objects as permissive for DELETE to authenticated
  using (((bucket_id = 'marketplace-fotos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "marketplace-fotos owner insert" on storage.objects;
create policy "marketplace-fotos owner insert" on storage.objects as permissive for INSERT to authenticated
  with check (((bucket_id = 'marketplace-fotos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "marketplace-fotos owner update" on storage.objects;
create policy "marketplace-fotos owner update" on storage.objects as permissive for UPDATE to authenticated
  using (((bucket_id = 'marketplace-fotos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)))
  with check (((bucket_id = 'marketplace-fotos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "marketplace-fotos service role all" on storage.objects;
create policy "marketplace-fotos service role all" on storage.objects as permissive for ALL to service_role
  using ((bucket_id = 'marketplace-fotos'::text))
  with check ((bucket_id = 'marketplace-fotos'::text));
drop policy if exists "pastas owner delete" on storage.objects;
create policy "pastas owner delete" on storage.objects as permissive for DELETE to authenticated
  using (((bucket_id = 'pastas'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "pastas owner insert" on storage.objects;
create policy "pastas owner insert" on storage.objects as permissive for INSERT to authenticated
  with check (((bucket_id = 'pastas'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "pastas owner update" on storage.objects;
create policy "pastas owner update" on storage.objects as permissive for UPDATE to authenticated
  using (((bucket_id = 'pastas'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)))
  with check (((bucket_id = 'pastas'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "pastas service role all" on storage.objects;
create policy "pastas service role all" on storage.objects as permissive for ALL to service_role
  using ((bucket_id = 'pastas'::text))
  with check ((bucket_id = 'pastas'::text));

-- ============================================================
-- 14. COMENTARIOS
-- ============================================================
comment on table public.card_precos is 'Preco por (carta, idioma, variante). VAZIA ate o estagio B do scan saber separar idioma - ver S43. Enquanto isso a fonte de verdade continua sendo pokemon_cards.preco_* / preco_foil_*.';
comment on table public.card_requests is 'Pedidos de carta faltando ou reporte de erro em carta existente. origem=form (usuario preencheu) ou auto (log passivo de busca-zero). Apenas usuarios logados inserem.';
comment on table public.card_sinal_diario is 'Rollup diario dos sinais de carta. Retencao 400 dias. A PK atende o upsert do rollup E o range scan da leitura -- nao criar indice adicional.';
comment on table public.card_sinal_evento is 'Bruto de sinais de carta. Sem user_id/ip/user_agent/referrer. Retencao 30 dias. Nenhuma leitura de request toca esta tabela -- so o rollup e o purge.';
comment on column public.card_sinal_evento.visitante is 'sha256(uuid de 1a parte + dia) truncado em 16 hex. Irreversivel, rotativo em 24h, nunca sai em API.';
comment on column public.card_sinal_evento.origem is '0 normal, 1 navegacao interna, 2 UA suspeito (fora do ranking), 3 sem referer. Forense agregada, nao identidade.';
comment on table public.card_sinal_quota is 'Contador de linhas gravadas por dia em card_sinal_evento. Teto duro anti-varredura. Uma linha por dia.';
comment on table public.conteudo_checklist is 'Estado dos checkboxes da gestao de conteudo. Chave e o id do item no front (ex: p1-bio, c-gancho).';
comment on table public.conteudo_config is 'Chave/valor da tela /admin/conteudo. Ex: metas_seguidores, metas_semanas.';
comment on table public.conteudo_posts is 'Historico de publicacoes marcadas no admin. Uma linha por dia.';
comment on table public.dedup_liga_map is 'Auditoria da deduplicacao Liga x catalogo (S43). liga_id = carta duplicada removida; cat_id = carta real do catalogo que recebeu os vinculos. Serve de rastro e de rollback reference.';
comment on table public.dedup_sets_backup is 'Retrato de tudo que apontava pra carta de set duplicado ANTES da mesclagem. Serve pra desfazer: cada linha traz a tabela, a chave e o payload completo.';
comment on index public.lancamentos_stripe_pi_unique is 'Garante idempotência financeira do webhook Stripe. Erro 23505 dispara o caminho already_processed.';
comment on table public.liga_editions_master is 'Mestre dos sets do Liga Pokemon. Origem: https://ligapokemon.com.br/?view=cards/edicoes';
comment on column public.liga_editions_master.edid is 'ID numerico interno do Liga (usado na URL ?card=edid=XXX)';
comment on column public.liga_editions_master.ed_code is 'Codigo de letras do set (ex: MEP, SVP, BS)';
comment on column public.liga_editions_master.symbol_url is 'URL do simbolo do set no CDN do Liga';
comment on table public.liga_scan_estado is 'Circuit breaker global da varredura. Qualquer worker que detectar challenge/429/403-cf grava bloqueado_ate=now()+24h e TODOS param. Segunda ocorrencia em 7 dias = infinity (so o Du libera).';
comment on table public.liga_scan_quota is 'Contador diario de requisicoes a fonte BR (todas as camadas somadas). Teto duro: 700/dia. Workers incrementam e checam antes de cada requisicao.';
comment on table public.liga_set_edids is 'Mapeamento ED→EDID do Liga Pokemon BR. Usado pelo pipeline de scan (discover-liga-set.mjs, scan-liga-prices.mjs, import-liga-only-set.mjs). Populado da exportação edicoes.html.';
comment on column public.liga_set_edids.bynx_set_id is 'Set do catalogo (pokemon_sets.id) equivalente a este set_code do fornecedor. Quando preenchido, o import DEVE gravar os precos nas cartas existentes desse set (casando por numero) em vez de criar cartas liga-* novas. Sem isso o scan duplica o set inteiro (incidente S43: 1.865 cartas duplicadas).';
comment on column public.liga_set_edids.regiao is 'Regiao do set no fornecedor. O import grava isso em pokemon_cards.regiao. NULL = nao classificado (o import avisa).';
comment on table public.liga_set_mapping is 'Mapeamento Bynx set_id ↔ Liga ed_code/edid. Usado pelo orquestrador attack-all-sets.mjs (S36).';
comment on table public.loja_cliques is 'Registra cliques nos CTAs das páginas de loja (analytics do Premium)';
comment on column public.loja_cliques.tipo is 'whatsapp | instagram | facebook | website | maps';
comment on column public.loja_cliques.user_id is 'Preenchido se o clique veio de user logado (opcional)';
comment on table public.loja_produtos is 'Produtos gerais da loja (nao-carta), com estoque. Escrita so via service_role.';
comment on column public.loja_produtos.estoque is 'Decrementa no webhook a cada venda. 0 = some da vitrine, sem mexer em `ativo`.';
comment on column public.loja_produtos.idioma is 'Idioma do produto (booster PT x EN tem preco diferente).';
comment on table public.lojas is 'Diretório de lojas físicas e online de TCG — Guia de Lojistas Bynx';
comment on column public.lojas.slug is 'URL amigável única: bynx.gg/lojas/{slug}';
comment on column public.lojas.especialidades is 'Ex: {pokemon,yugioh,magic,lorcana,digimon,outros}';
comment on column public.lojas.plano is 'basico (grátis) | pro (R$49) | premium (R$99)';
comment on column public.lojas.status is 'pendente → ativa (admin aprova) | suspensa | inativa';
comment on column public.lojas.eventos is 'JSON: [{titulo,data,descricao,link}] — apenas Premium';
comment on column public.lojas.trial_usado_em is 'Marca quando a loja consumiu o trial de 14 dias do plano pago. Checkout valida pra evitar burlagem.';
comment on column public.lojas.stripe_connect_status is 'nao_iniciado | pendente (onboarding incompleto) | em_analise (Stripe verificando; nada a fazer) | ativo | restrito (falta info ou conta bloqueada). Sincronizado pelo webhook account.updated.';
comment on column public.lojas.repasse_prazo is 'Dias ate o repasse: 14 (comissao 4,99%) ou 30 (3,99%). Espelha a tabela da LigaSegura.';
comment on column public.lojas.frete_cents is 'Frete fixo em centavos que a loja cobra por pedido. 0 = frete gratis.';
comment on column public.lojas.frete_gratis_acima_cents is 'Se preenchido, pedidos acima desse valor tem frete gratis. NULL = sem regra.';
comment on column public.lojas.verificacao_ticket_id is 'Ticket onde a loja envia os documentos do Selo de Loja Validada. Os anexos dele sao apagados quando a loja e marcada como verificada.';
comment on column public.lojas.capa_url is 'Foto de capa exibida no topo da pagina publica da loja (/lojas/[slug]). Mesmo bucket loja-fotos, path {lojaId}/capa/{uuid}.{ext}. Disponivel para todos os planos, mesma regra do logo_url.';
comment on column public.marketplace.removido_em is 'Quando admin removeu o anuncio. NULL = anuncio ativo. Soft-delete: ortogonal ao status de venda.';
comment on column public.marketplace.removido_motivo is 'Motivo da remocao informado pelo admin (livre).';
comment on column public.marketplace.removido_por is 'FK users.id do admin que removeu. ON DELETE SET NULL para preservar historico se admin for excluido.';
comment on column public.marketplace.fotos is 'Fotos reais do vendedor (array de URLs publicas no bucket marketplace-fotos). Recurso PRO.';
comment on column public.marketplace.graduada is 'Anuncio de carta graduada/encapsulada';
comment on column public.marketplace.graduadora is 'Slug da graduadora (psa,bgs,cgc,ace,ags,mgs,capy,gba,tbn)';
comment on column public.marketplace.nota is 'Nota 1-10 (suporta .5)';
comment on column public.marketplace.black_label is 'BGS Black Label';
comment on column public.marketplace.cert_graduacao is 'Codigo de certificacao';
comment on column public.marketplace.subnotas is 'jsonb {centro,cantos,bordas,superficie}';
comment on column public.marketplace.idioma is 'Idioma da carta anunciada. Comprador precisa saber: PT e EN tem precos diferentes.';
comment on table public.monthly_ranking_snapshots is 'Indique e Ganhe — histórico de rankings mensais (gerado por cron)';
comment on materialized view public.mv_set_index_stats is 'Le a VIEW pokemon_cards (so visiveis). A v1 lia a tabela base e contava set duplicado oculto.';
comment on table public.pedido_itens is 'Itens de um pedido (carrinho por loja). O snapshot fica aqui; `pedidos` guarda os totais e o resumo.';
comment on table public.pedidos is 'Vendas on-site (Stripe Connect). 1 item por pedido na v1; carrinho por loja vem depois. Escrita so via service_role.';
comment on column public.pedidos.marketplace_id is 'Legado/atalho do pedido de 1 item. A fonte da verdade dos itens e `pedido_itens`.';
comment on column public.pedidos.item_nome is 'Resumo do pedido: nome do 1o item + "+ N itens" quando houver mais. Detalhe em `pedido_itens`.';
comment on column public.pedidos.produto_id is 'Legado/atalho do pedido de 1 item. A fonte da verdade dos itens e `pedido_itens`.';
comment on table public.point_redemptions is 'Indique e Ganhe — resgates feitos pelos users';
comment on table public.points_ledger is 'Indique e Ganhe — auditoria imutável de movimentos de pontos';
comment on view public.pokemon_cards is 'Catalogo VISIVEL. Espelha pokemon_cards_all filtrando oculto=true (sets duplicados).
   security_invoker=true: NAO fura RLS, a policy da tabela base continua valendo.
   Escrita passa direto (view auto-atualizavel) e os triggers da base disparam normal.
   ATENCAO: coluna nova na tabela base NAO aparece aqui sozinha - recriar a view.
   Trabalho de admin/dedup deve mirar pokemon_cards_all.';
comment on column public.pokemon_cards_all.outras_variantes is 'JSONB com variantes raras da LigaPokemon (Staff, Shattered Holo, Misprint, etc). Cada chave aponta pra {sigla, min, med, max}.';
comment on column public.pokemon_cards_all.excluded_from_scan is 'true = sync HOT/WARM/COLD ignora essa carta (problemática crônica). Definido pela ETAPA 2 do S34.';
comment on column public.pokemon_cards_all.excluded_reason is 'Motivo da exclusão (wattrel-slug-bugado, caracteres-especiais, nome-pt-en-misto, outras-suspeitas).';
comment on column public.pokemon_cards_all.regiao is 'Herdado do set. Faz parte da chave logica de identidade da carta: (set, numero, regiao).';
comment on column public.pokemon_cards_all.slug is 'URL publica da carta: {nome}-{numero}-{printed_total}-{set}. Ex: litleo-23-132-mega-evolution. Nunca contem o nome do fornecedor de preco.';
comment on column public.pokemon_cards_all.liga_last_attempt_at is 'Ultima vez que o scan TENTOU esta carta (deu certo ou nao). A fila ordena por aqui; liga_updated_at continua sendo so o sucesso.';
comment on column public.pokemon_cards_all.liga_fail_streak is 'Falhas consecutivas no scan. Zera no sucesso. Alimenta o backoff: >=3 so tenta de novo depois de 7 dias, >=6 depois de 30.';
comment on column public.pokemon_cards_all.name_pt is 'Nome da carta em portugues (TCGdex). NULL = nao ha traducao distinta do ingles. Preenchido por scripts/sync-nomes-pt.mjs no bynx-scan.';
comment on column public.pokemon_cards_all.set_name_pt is 'Nome do set em portugues, copiado de pokemon_sets.name_pt. Desnormalizado de proposito, pra busca poder usar indice. Repopular depois de mexer em pokemon_sets.name_pt.';
comment on column public.pokemon_cards_all.oculto is 'Carta de set duplicado que perdeu a mesclagem. Fora da busca e do /set, mas viva no banco pra nao quebrar vinculo que tenha escapado.';
comment on column public.pokemon_cards_all.liga_range_min is 'Menor preco anunciado da carta na LISTAGEM do set (div.card-prices > avgp-minprc). ATENCAO: e range CRUZANDO VARIANTES -- pode vir do normal, do foil ou do reverse, o que for mais barato. NAO E equivalente a preco_min (que e a variante normal) e NUNCA deve ser copiado pra la. Serve so como sinal de mudanca pra fila de detalhe.';
comment on column public.pokemon_cards_all.liga_range_max is 'Maior preco anunciado da carta na LISTAGEM do set (div.card-prices > avgp-maxprc). Mesmo aviso do liga_range_min: cruza variantes (medido em 21/08/2026 -- na me2pt5 num=182 o min vem do normal e o max vem do reverse). Sinal, nao preco de variante.';
comment on column public.pokemon_sets.regiao is 'Mercado do set: ocidental (EN/PT/ES/...) | jp | cn | kr. NULL = ainda nao classificado - NAO assumir.';
comment on table public.price_history is 'Histórico de preços (snapshots quando há mudança real)';
comment on column public.price_history.source is 'liga_scan | baseline | manual | crowdsourced';
comment on table public.price_snapshots is 'Historico diario de precos por carta (delta-based). Alimenta graficos de /carta e /pokemon.';
comment on table public.price_snapshots_quarentena is 'Snapshots de preco removidos por ruido do scanner (26/07/2026). Nao apagar: e a trilha de auditoria pra reverter se algum caso se provar legitimo.';
comment on table public.referrals is 'Indique e Ganhe — uma row por relação indicador→indicado';
comment on table public.rewards is 'Indique e Ganhe — catálogo de recompensas resgatáveis';
comment on table public.stripe_events_processed is 'Registro de eventos Stripe já processados. Garante idempotência no provisionamento (Pro/Scan/Separadores/Lojista). Webhook consulta antes de qualquer side-effect.';
comment on table public.ticket_anexos is 'Anexos de ticket em bucket PRIVADO. Contem documento de identidade na verificacao de loja — nunca expor URL direta, so link assinado emitido pela rota. Apagados quando a loja e verificada.';
comment on column public.user_cards.condicoes is 'Condicao das copias. Mapa condicao->quantidade. FREE: 1 chave (ex {"NM":3}). PRO: N chaves (ex {"NM":1,"LP":1,"MP":1}), soma = quantity. NULL = nao informado. Valores validos: NM, LP, MP, HP.';
comment on column public.user_cards.graduada is 'Carta encapsulada/graduada por uma graduadora';
comment on column public.user_cards.graduadora is 'Slug da graduadora: psa,bgs,cgc,ace,ags,mgs,capy,gba,tbn';
comment on column public.user_cards.nota is 'Nota numerica 1-10 (suporta .5)';
comment on column public.user_cards.black_label is 'BGS Black Label (10 perfeito em todas as subnotas)';
comment on column public.user_cards.cert_graduacao is 'Codigo/numero de certificacao (QR)';
comment on column public.user_cards.subnotas is 'jsonb {centro,cantos,bordas,superficie}';
comment on column public.user_cards.valor_graduada is 'Valor informado pelo usuario para a carta graduada (substitui preco de mercado)';
comment on column public.user_cards.idioma is 'Idioma da tiragem que o usuario possui. Default pt (publico BR).';
comment on column public.users.last_seen_at is 'Ultima atividade real no app (heartbeat via middleware, throttle 10min). Distinto de auth.users.last_sign_in_at (ultimo login).';
comment on column public.users.instagram is 'Handle do Instagram do usuario (sem @). Opcional.';
comment on column public.users.tiktok is 'Handle do TikTok do usuario (sem @). Opcional.';
comment on column public.users.reconfirmar_email is 'true = usuario legado (auto-confirmado) que deve ser gentilmente convidado a reconfirmar o email no proximo login. Novos usuarios (pos Confirm email ON) nascem false.';
comment on column public.users.email_optout_nurture is 'true = nao recebe e-mail de relacionamento. NAO afeta transacional (recibo, pedido, ticket).';
comment on column public.users.unsubscribe_token is 'Token do link de descadastro. Aleatorio por usuario — nao adivinhavel, sem segredo novo pra guardar.';
comment on column public.users.signup_utm_source is 'First touch. Preenchido no cadastro a partir do cookie bx_attr (ver src/lib/atribuicao.ts).';
comment on column public.users.signup_last_utm_source is 'Last touch. Mesma origem, chave separada no cookie.';

comment on function public.admin_get_users_last_sign_in(uuid[]) is 'Admin-only: lookup last_sign_in_at em auth.users por lista de IDs. Usado em /api/admin/users e /api/admin/users/[id].';
comment on function public.get_ranking(integer,integer) is 'Indique e Ganhe — top 20 do período + posição do user logado';
comment on function public.smart_search_cards_v3(text,integer,integer) is 'Busca v3: v2 + nome em portugues (name_pt). Nao trocar o chamador antes de medir contra a v2.';
comment on function public.snapshot_monthly_ranking(integer,integer) is 'Indique e Ganhe — cria snapshot imutável do ranking mensal (cron)';
comment on function public.smart_search_cards_v4(text,integer,integer) is 'Busca v4: v3 + nome do set em portugues + fuzzy no primeiro token do caminho multi-token. Medir contra a v3 antes de trocar o chamador.';
comment on function public.limpar_entidades_html(text) is 'Normaliza entidades HTML que vazam do scrape para o nome da carta. Inclui as malformadas sem # (&9792; = simbolo femea do Nidoran).';
comment on function public.preencher_card_slug() is 'Preenche pokemon_cards.slug quando vazio. Nao sobrescreve slug existente (URL publica nao muda sozinha).';
comment on function public.f_unaccent(text) is 'unaccent IMMUTABLE, para uso em indice de expressao. Ver idx_pokemon_cards_name_unaccent_trgm.';
comment on function public.montar_card_slug(text,text,integer,text) is 'Monta o slug publico. Omite o set quando o nome ainda e "Liga BR — XX" (nao expor fornecedor na URL).';
comment on function public.smart_search_cards_v2(text,integer,integer) is 'Busca de cartas v2: unaccent nos dois lados + fuzzy no caminho nome+numero. Ver migration smart_search_cards_v2_unaccent_fuzzy.';
comment on function public.registrar_sinal_carta(text,text,text,smallint) is 'Unico caminho de escrita de sinal de carta. Valida existencia do card_id por PK, respeita cota diaria, dedup pela PK do bruto. Nunca levanta excecao.';
comment on function public.card_sinal_rollup(integer) is 'Recomputa o agregado diario a partir do bruto. IDEMPOTENTE. Le so os ultimos p_dias (teto 30). Roda 2x/dia por pg_cron.';
comment on function public.card_sinal_purge() is 'Retencao: bruto 30 dias, agregado 400 dias, cota 60 dias. IDEMPOTENTE. Roda 1x/dia por pg_cron.';
comment on function public.get_sinais_carta(integer,integer,integer,integer) is 'Top N por sinal (acessada / procurada) na janela. Devolve so agregado por carta -- nunca nada sobre quem gerou o sinal. eventos_janela e dado_ate servem de gate de ativacao e de deteccao de pipeline morto.';
comment on function public.get_master_set_sheet_v2(text,uuid) is 'Folha do master set + preco BRL por carta, pro fichario virtual. v1 continua servindo a folha de impressao.';

-- ============================================================
-- 15. VERIFICACAO (contagens obtidas dos catalogos em 22/08/2026)
-- ============================================================
-- tabelas public ........ 72
-- views ................. 3  (pokemon_cards, public_users, v_auditoria_liga_link)
-- matviews .............. 6
-- indices (total) ....... 232  (138 nao-constraint; o restante nasce das constraints PK/UNIQUE)
-- funcoes em public ..... 136  (101 de usuario neste arquivo + 35 de extensao)
-- triggers .............. 10
-- policies public ....... 71
-- policies storage ...... 9
-- buckets ............... 7
-- Conferir com:
-- select relkind, count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where nspname='public' group by 1;
-- select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where nspname='public';
-- select count(*) from pg_policies where schemaname='public';
