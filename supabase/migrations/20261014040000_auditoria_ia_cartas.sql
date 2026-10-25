-- #508: trilha da auditoria por IA (leitura da imagem de cada carta fora da API).
-- Uma linha por carta: o que o modelo leu, o que o catalogo dizia na hora, a regra de
-- correcao proposta e quando foi aplicada. Nada aqui e lido pelo app; service_role so.
create table public.auditoria_ia_cartas (
  card_id            text primary key,
  set_id             text,
  modelo             text,
  confianca          numeric(3,2),
  legivel            boolean not null default true,
  nome_lido          text,
  idioma_lido        text,
  numero_lido        text,
  total_lido         text,
  codigo_set_lido    text,
  raridade_lida      text,
  hp_lido            text,
  observacao         text,
  campos_divergentes text[] not null default '{}',
  regiao_cat         text,
  idioma_cat         text,
  number_cat         text,
  set_total_cat      integer,
  regra              text,      -- regiao-idioma | total-nulo | total-jp-em-set-en | numero-vazio
  novo_regiao        text,
  novo_idioma        text,
  novo_set_total     integer,
  novo_number        text,
  lido_em            timestamptz not null default now(),
  aplicado_em        timestamptz
);
comment on table public.auditoria_ia_cartas is '#508 auditoria por IA: leitura, catalogo na hora, regra proposta e aplicacao';
create index auditoria_ia_cartas_regra_idx on public.auditoria_ia_cartas (regra) where aplicado_em is null;
alter table public.auditoria_ia_cartas enable row level security;
revoke all on public.auditoria_ia_cartas from anon, authenticated;
