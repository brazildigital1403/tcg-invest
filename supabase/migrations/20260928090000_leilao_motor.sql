-- ============================================================================
-- Leilao da Bynx, fatia 1: o MOTOR (tabelas, views publicas, dar_lance, tick).
--
-- ★ NAO APLICADA. Escrita e revisada por decisao do Du (27/09/2026). O
--   agendamento do tick fica em arquivo separado (20260928090100_leilao_cron.sql),
--   que tambem so sobe com o Du.
--
-- ★ O PRODUTO (decisao do Du, 27/09): RODADA AO VIVO DA LOJA. A loja cria uma
--   rodada com N lotes; cada lote dura 30-90s; lote a lote em sequencia,
--   enquanto ela transmite no Instagram/YouTube. O MESMO motor serve o leilao
--   com prazo (dias) depois -- so muda o relogio (`modo`, `duracao_seg`,
--   `soft_close_seg`).
--
-- ★ QUEM DECIDE E O BANCO. Lance minimo, lance automatico (teto oculto),
--   desempate e soft close vivem em `dar_lance`, sob `select ... for update` na
--   linha do lote. A rota /api/leiloes/[id]/lance so valida formato e traduz
--   erro. A tela so mostra.
--
--   Regras do dar_lance:
--     - Corte exato: now() >= termina_em -> leilao_fechado. now() e o inicio da
--       transacao (a hora em que o lance CHEGOU), nao a hora em que pegou a trava.
--     - Lance automatico: cada participante tem UM teto em leilao_proxy. Preco =
--       min(teto do 1o, teto do 2o + incremento(teto do 2o)), nunca abaixo do
--       inicial. Sem 2o participante, o preco e o lance inicial.
--     - Desempate: tetos iguais -> vence quem definiu aquele teto PRIMEIRO.
--       `leilao_proxy.created_at` guarda "desde quando vale este teto" e e
--       renovado quando o teto sobe (quem sobe para 100 depois de outro ter
--       posto 100 chegou depois). Relogio = clock_timestamp() apos a trava, entao
--       a ordem do desempate e a ordem real de chegada na linha.
--     - Soft close: lance que muda o preco nos ultimos `soft_close_seg` empurra o
--       fim para clock_timestamp() + soft_close_seg. Ao vivo 10s, prazo 120s.
--     - Idempotencia: `p_idem` (uuid gerado pela tela a cada clique). Replay
--       devolve o MESMO resultado, com server_now atualizado. A checagem roda
--       DEPOIS da trava do lote -- dois replays simultaneos nao passam juntos.
--       O lance que so sobe o teto de quem ja lidera nao gera linha publica em
--       leilao_lances (o preco nao muda e o teto e segredo): a idempotencia dele
--       fica no evento 'teto_ajustado' de leilao_eventos.
--     - Elegibilidade por PK em users: suspended_at -> suspenso; CPF sem 11
--       digitos ou CEP sem 8 -> cadastro_incompleto (o arremate vira pedido com
--       entrega; sem isso nao ha como cobrar nem enviar).
--     - Teto maximo por lance: R$ 1.000.000,00 (100000000 cents), espelho de
--       MAXIMO_CENTS_TETO na rota. Acima -> pedido_invalido. Com esse teto (e o
--       CHECK nas colunas) nenhuma soma de centavos chega perto do limite do
--       integer (2,1 bi).
--     - Lider repetindo o mesmo teto (ou um menor): nada muda, nada e gravado.
--       'teto_ajustado' so nasce quando o teto de fato sobe.
--
-- ★ FECHAMENTO COM FOLGA DE 1s. leilao_fechar_lote e o tick so fecham lote com
--   termina_em <= now() - 1s. Motivo: dar_lance julga pelo now() do INICIO da
--   transacao dele. Um lance que chegou em termina_em - 0,2s mas ainda espera a
--   trava perderia a vez se o fechamento pegasse a linha primeiro. Na janela de
--   1s o lote segue 'ativo' mas o dar_lance ja recusa (corte exato), entao a
--   folga nao aceita lance atrasado -- so evita recusar lance em voo.
--
-- ★ CALOTE SO COM CERTEZA. O tick marca 'calote' apenas quando TODAS valem:
--     - pagar_ate + 15 min de carencia ja passou;
--     - nao existe pedido pago do lote (leiloes.pedido_id OU pedidos.leilao_id OU
--       pedido_itens.leilao_id com pedidos.pago_em not null);
--     - nao existe checkout em andamento (pedido do lote com stripe_session_id
--       not null, status fora de cancelado/reembolsado e cancelado_em null).
--   Checkout expirado precisa ser cancelado pelo fluxo de pedidos para o
--   calote andar. ★ PENDENCIA DA FATIA 2 (webhook): pagamento que chega para
--   lote ja em 'calote' (Pix compensado tarde, por exemplo) tem de voltar o
--   lote para 'vendido' e ligar pedido_id -- nao pode ser descartado.
--
-- ★ TICK RESILIENTE. Cada lote/rodada roda num bloco begin/exception proprio:
--   um lote com problema grava evento 'erro_tick' (sqlstate + mensagem, ja
--   processado, so para monitoria) e o resto do tick segue.
--
-- ★ RODADA SO ENCERRA DE VERDADE. Nao encerra com lote em 'rascunho' (a loja
--   ainda esta montando) nem se nenhum lote chegou a abrir (encerrado_em null
--   em todos). Lote de rodada 'prazo' precisa de inicia_em para ser agendado
--   (trigger leilao_valida_lote); sem isso ele nunca abriria e a rodada nunca
--   fecharia.
--
-- ★ O TETO NAO VAZA. `lider_maximo_cents`, `lider_user_id`, `segundo_user_id`,
--   `pedido_id`, `pagar_ate` e `cancelado_motivo` NAO tem GRANT de coluna para
--   anon/authenticated. A leitura publica e pelas views security_invoker
--   (`leiloes_publico`, `leilao_lances_publico`); o apelido mascarado ("j***a")
--   sai de funcoes security definer que leem por PK -- a view nao precisa
--   enxergar user_id de ninguem. leilao_proxy: cada um le SO o proprio teto.
--
-- ★ NASCE FECHADA (Supabase da tudo por default privilege): RLS + revoke all
--   de anon/authenticated em TODA tabela e view na criacao, grant minimo depois.
--   Escrita so por RPC security definer ou service_role. Funcoes: revoke de
--   public/anon/authenticated e grant nominal.
--
-- ★ CUSTO DE IO: praticamente zero. Tabelas novas vazias. Tudo por PK ou indice
--   parcial pequeno. NADA toca pokemon_cards / pokemon_cards_all. Os dois
--   `add column` em pedidos/pedido_itens sao nullable sem default (so catalogo,
--   nao reescreve) e o FK valida tabelas pequenas (todas as linhas nulas).
--
-- ★ TIMEOUTS: dar_lance roda como `authenticated` via PostgREST (8s no papel
--   authenticator). lock_timeout=3s e o que protege de fila em lote quente.
--   O `statement_timeout=5s` na funcao e declarativo: o Postgres arma o timer
--   no inicio do statement de fora, entao o teto real continua o do papel.
--
-- ROLLBACK (uma linha por objeto, nesta ordem):
--   drop view if exists public.leilao_lances_publico;
--   drop view if exists public.leiloes_publico;
--   drop function if exists public.leilao_tick();
--   drop function if exists public.leilao_erro_tick(uuid, uuid, text, text, text);
--   drop function if exists public.leilao_fechar_lote(uuid);
--   drop function if exists public.leilao_avancar_rodada(uuid);
--   drop function if exists public.dar_lance(uuid, integer, uuid);
--   drop function if exists public.leilao_lance_apelido(bigint);
--   drop function if exists public.leilao_lider_apelido(uuid);
--   drop function if exists public.leilao_mascarar(text);
--   alter table public.pedido_itens drop column if exists leilao_id;
--   alter table public.pedidos drop column if exists leilao_id;
--   drop table if exists public.leilao_eventos, public.leilao_seguidores,
--     public.leilao_proxy, public.leilao_lances, public.leiloes, public.leilao_rodadas;
--   (os triggers leiloes_valida / leilao_rodadas_modo caem junto com as tabelas)
--   drop function if exists public.leilao_valida_lote();
--   drop function if exists public.leilao_rodada_modo_fixo();
--   drop function if exists public.leilao_novo_codigo();
--   drop function if exists public.leilao_incremento(integer);
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Funcoes puras
-- ----------------------------------------------------------------------------

-- ★ MESMA tabela de src/lib/leilao.ts (FAIXAS_INCREMENTO). Mudou uma, muda a
--   outra no mesmo commit.
create or replace function public.leilao_incremento(cents integer)
returns integer
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select case
    when coalesce(cents, 0) < 2000    then 100
    when cents < 5000    then 200
    when cents < 10000   then 500
    when cents < 25000   then 1000
    when cents < 50000   then 2000
    when cents < 100000  then 5000
    when cents < 250000  then 10000
    when cents < 500000  then 20000
    when cents < 1000000 then 50000
    else 100000
  end
$$;

comment on function public.leilao_incremento(integer) is
  'Incremento minimo (centavos) a partir do lance atual. Espelho de incrementoCents() em src/lib/leilao.ts.';

-- Codigo de 6 chars base36 que fecha o slug do lote (codigoDoSlug no TS).
-- Nao e segredo (o lote e publico); random() basta. 36^6 = 2,1 bi: colisao
-- estoura no unique e o insert repete.
create or replace function public.leilao_novo_codigo()
returns text
language sql
volatile
set search_path = public, pg_temp
as $$
  select string_agg(substr('0123456789abcdefghijklmnopqrstuvwxyz', 1 + floor(random() * 36)::int, 1), '')
  from generate_series(1, 6)
$$;

-- "joana" -> "j***a"; menos de 3 caracteres -> "***" (com 2, "j***o" entregaria
-- o nome inteiro). Espelho de mascararApelido() em src/lib/leilao.ts.
create or replace function public.leilao_mascarar(p_nome text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select case
    when char_length(btrim(coalesce(p_nome, ''))) < 3 then '***'
    else lower(left(btrim(p_nome), 1) || '***' || right(btrim(p_nome), 1))
  end
$$;


-- ----------------------------------------------------------------------------
-- 2. Tabelas
-- ----------------------------------------------------------------------------
-- FKs para users com `on delete restrict` (vendedor_user_id, lider_user_id,
-- leilao_lances.user_id, leilao_proxy.user_id):
-- DECISAO DO DU: restrict (auditoria) x set null; a rota admin de excluir usuario falha para quem deu lance.

create table if not exists public.leilao_rodadas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  loja_id uuid references public.lojas(id) on delete set null,
  vendedor_user_id uuid not null references public.users(id) on delete restrict,
  titulo text,
  descricao text,
  modo text not null default 'ao_vivo' check (modo in ('ao_vivo', 'prazo')),
  status text not null default 'rascunho'
    check (status in ('rascunho', 'agendada', 'ao_vivo', 'encerrada', 'cancelada')),
  inicia_em timestamptz,
  link_transmissao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  game text not null default 'pokemon',
  check (status <> 'agendada' or inicia_em is not null)
);

comment on table public.leilao_rodadas is
  'Rodada de leilao da loja (ao vivo: lotes em sequencia; prazo: cada lote no proprio relogio). Escrita so pelo servidor.';

create table if not exists public.leiloes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default public.leilao_novo_codigo()
    check (codigo ~ '^[a-z0-9]{6}$'),
  rodada_id uuid references public.leilao_rodadas(id) on delete restrict,
  ordem integer,
  vendedor_user_id uuid not null references public.users(id) on delete restrict,
  loja_id uuid references public.lojas(id) on delete set null,
  card_id text,
  card_slug text,
  card_name text not null,
  card_numero text,
  set_nome text,
  card_image text,
  fotos jsonb not null default '[]'::jsonb check (jsonb_typeof(fotos) = 'array'),
  condicao text,
  idioma text,
  graduadora text,
  nota text,
  descricao text,
  slug text not null,
  lance_inicial_cents integer not null check (lance_inicial_cents between 100 and 100000000),
  preco_atual_cents integer check (preco_atual_cents is null or preco_atual_cents >= lance_inicial_cents),
  lider_user_id uuid references public.users(id) on delete restrict,
  -- ★ PRIVADO: teto oculto do lider. Sem grant de coluna, fora das views.
  lider_maximo_cents integer check (lider_maximo_cents is null or lider_maximo_cents <= 100000000),
  n_lances integer not null default 0 check (n_lances >= 0),
  n_participantes integer not null default 0 check (n_participantes >= 0),
  duracao_seg integer not null check (duracao_seg between 10 and 2592000),
  soft_close_seg integer not null default 10 check (soft_close_seg between 0 and 3600),
  inicia_em timestamptz,
  termina_em timestamptz,
  prorrogacoes integer not null default 0 check (prorrogacoes >= 0),
  status text not null default 'rascunho'
    check (status in ('rascunho', 'agendado', 'ativo', 'sem_lances',
                      'aguardando_pagamento', 'vendido', 'calote', 'cancelado')),
  encerrado_em timestamptz,
  pagar_ate timestamptz,
  pedido_id uuid references public.pedidos(id) on delete set null,
  segundo_user_id uuid references public.users(id) on delete set null,
  versao integer not null default 0,
  cancelado_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  game text not null default 'pokemon',
  -- Invariantes do motor.
  check (lider_maximo_cents is null or lider_maximo_cents >= preco_atual_cents),
  check ((lider_user_id is null) = (lider_maximo_cents is null)),
  check (status <> 'ativo' or termina_em is not null),
  -- Lote avulso/prazo precisa de hora propria; lote de rodada ao vivo ganha a
  -- hora quando o anterior fecha.
  check (status <> 'agendado' or rodada_id is not null or inicia_em is not null),
  check (rodada_id is null or ordem is not null)
);

comment on table public.leiloes is
  'Lote de leilao. lider_maximo_cents e PRIVADO (teto oculto). Leitura publica so por leiloes_publico. Escrita so por dar_lance / leilao_tick / servidor.';
comment on column public.leiloes.lider_maximo_cents is
  'Teto oculto do lider. NUNCA expor: sem grant de coluna, fora de leiloes_publico.';

create table if not exists public.leilao_lances (
  id bigint generated always as identity primary key,
  leilao_id uuid not null references public.leiloes(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  valor_cents integer not null check (valor_cents > 0),
  automatico boolean not null default false,
  idem_key uuid unique,
  resultado jsonb,
  anulado_em timestamptz,
  created_at timestamptz not null default clock_timestamp()
);

comment on table public.leilao_lances is
  'Historico publico de lances (append-only). automatico=true: lance do teto oculto. idem_key: idempotencia do dar_lance; resultado: o jsonb devolvido na primeira vez.';

create table if not exists public.leilao_proxy (
  leilao_id uuid not null references public.leiloes(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  maximo_cents integer not null check (maximo_cents between 1 and 100000000),
  -- ★ Desempate: "desde quando vale ESTE teto". Renovado quando o teto sobe.
  created_at timestamptz not null default clock_timestamp(),
  atualizado_em timestamptz not null default clock_timestamp(),
  primary key (leilao_id, user_id)
);

comment on table public.leilao_proxy is
  'Teto oculto de cada participante (1 por lote). created_at = quando o teto atual foi definido; em empate vence o mais antigo.';

create table if not exists public.leilao_seguidores (
  leilao_id uuid not null references public.leiloes(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (leilao_id, user_id)
);

create table if not exists public.leilao_eventos (
  id bigint generated always as identity primary key,
  -- null so em erro_tick de rodada (rodada_id preenchido).
  leilao_id uuid references public.leiloes(id) on delete cascade,
  rodada_id uuid references public.leilao_rodadas(id) on delete cascade,
  -- superado | encerrado | venceu | calote | iniciado | teto_ajustado | erro_tick
  tipo text not null,
  user_id uuid references public.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processado_em timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check (leilao_id is not null or rodada_id is not null)
);

comment on table public.leilao_eventos is
  'Fila de eventos do leilao para notificacao (processado_em null = pendente). teto_ajustado e erro_tick ja nascem processados: auditoria/idempotencia e monitoria (where tipo = ''erro_tick'').';


-- ----------------------------------------------------------------------------
-- 3. Indices (parciais onde o motor procura)
-- ----------------------------------------------------------------------------

-- tick: fecha vencidos
create index if not exists idx_leiloes_ativo_termina
  on public.leiloes (termina_em) where status = 'ativo';
-- tick: ativa agendados com hora propria
create index if not exists idx_leiloes_agendado_inicia
  on public.leiloes (inicia_em) where status = 'agendado';
-- tick: calote
create index if not exists idx_leiloes_aguardando_pagar_ate
  on public.leiloes (pagar_ate) where status = 'aguardando_pagamento';
-- rodada: proximo lote por ordem
create unique index if not exists uq_leiloes_rodada_ordem
  on public.leiloes (rodada_id, ordem) where rodada_id is not null;
create index if not exists idx_leiloes_vendedor
  on public.leiloes (vendedor_user_id);
create index if not exists idx_leiloes_loja
  on public.leiloes (loja_id) where loja_id is not null;

create index if not exists idx_leilao_rodadas_agendada
  on public.leilao_rodadas (inicia_em) where status = 'agendada';
create index if not exists idx_leilao_rodadas_ao_vivo
  on public.leilao_rodadas (id) where status = 'ao_vivo';
create index if not exists idx_leilao_rodadas_loja
  on public.leilao_rodadas (loja_id) where loja_id is not null;

-- historico do lote (mais novo primeiro)
create index if not exists idx_leilao_lances_leilao
  on public.leilao_lances (leilao_id, id desc);
create index if not exists idx_leilao_lances_user
  on public.leilao_lances (user_id);

-- top 2 do proxy
create index if not exists idx_leilao_proxy_ranking
  on public.leilao_proxy (leilao_id, maximo_cents desc, created_at);

create index if not exists idx_leilao_seguidores_user
  on public.leilao_seguidores (user_id);

create index if not exists idx_leilao_eventos_pendentes
  on public.leilao_eventos (created_at) where processado_em is null;
create index if not exists idx_leilao_eventos_leilao
  on public.leilao_eventos (leilao_id);
create index if not exists idx_leilao_eventos_rodada
  on public.leilao_eventos (rodada_id) where rodada_id is not null;
-- idempotencia do lance que so sobe o teto do lider (backstop do replay)
create unique index if not exists uq_leilao_eventos_teto_idem
  on public.leilao_eventos ((payload->>'idem')) where tipo = 'teto_ajustado';


-- ----------------------------------------------------------------------------
-- 4. Triggers (updated_at e validacao)
-- ----------------------------------------------------------------------------

drop trigger if exists leilao_rodadas_touch on public.leilao_rodadas;
create trigger leilao_rodadas_touch before update on public.leilao_rodadas
  for each row execute function public.touch_updated_at();

drop trigger if exists leiloes_touch on public.leiloes;
create trigger leiloes_touch before update on public.leiloes
  for each row execute function public.touch_updated_at();

-- Lote de rodada 'prazo' so pode ser agendado com inicia_em: o tick so ativa
-- lote de prazo pela hora propria; sem ela o lote ficaria agendado para sempre
-- e a rodada nunca encerraria. CHECK nao enxerga a outra tabela, por isso e
-- trigger (e leilao_rodada_modo_fixo impede trocar o modo depois).
create or replace function public.leilao_valida_lote()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'agendado' and new.rodada_id is not null and new.inicia_em is null
     and exists (select 1 from public.leilao_rodadas r
                 where r.id = new.rodada_id and r.modo = 'prazo') then
    raise exception 'lote_prazo_sem_inicio'
      using detail = format('leilao %s: lote de rodada prazo precisa de inicia_em', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists leiloes_valida on public.leiloes;
create trigger leiloes_valida before insert or update of status, inicia_em, rodada_id
  on public.leiloes
  for each row execute function public.leilao_valida_lote();

create or replace function public.leilao_rodada_modo_fixo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.modo is distinct from old.modo
     and exists (select 1 from public.leiloes l where l.rodada_id = old.id) then
    raise exception 'rodada_modo_fixo'
      using detail = format('rodada %s ja tem lotes; o modo nao muda', old.id);
  end if;
  return new;
end;
$$;

drop trigger if exists leilao_rodadas_modo on public.leilao_rodadas;
create trigger leilao_rodadas_modo before update of modo on public.leilao_rodadas
  for each row execute function public.leilao_rodada_modo_fixo();


-- ----------------------------------------------------------------------------
-- 5. Pedido do arremate
-- ----------------------------------------------------------------------------
-- Nullable, sem default: so catalogo. Nao unique: apos calote o lote pode
-- virar pedido do segundo colocado (dois pedidos, um cancelado).

alter table public.pedidos add column if not exists leilao_id uuid;
alter table public.pedido_itens add column if not exists leilao_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pedidos_leilao_id_fkey') then
    alter table public.pedidos add constraint pedidos_leilao_id_fkey
      foreign key (leilao_id) references public.leiloes(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pedido_itens_leilao_id_fkey') then
    alter table public.pedido_itens add constraint pedido_itens_leilao_id_fkey
      foreign key (leilao_id) references public.leiloes(id) on delete restrict;
  end if;
end $$;

create index if not exists idx_pedidos_leilao
  on public.pedidos (leilao_id) where leilao_id is not null;
create index if not exists idx_pedido_itens_leilao
  on public.pedido_itens (leilao_id) where leilao_id is not null;


-- ----------------------------------------------------------------------------
-- 6. RLS + grants (nasce fechada, abre o minimo)
-- ----------------------------------------------------------------------------

alter table public.leilao_rodadas    enable row level security;
alter table public.leiloes           enable row level security;
alter table public.leilao_lances     enable row level security;
alter table public.leilao_proxy      enable row level security;
alter table public.leilao_seguidores enable row level security;
alter table public.leilao_eventos    enable row level security;

revoke all on table public.leilao_rodadas    from anon, authenticated;
revoke all on table public.leiloes           from anon, authenticated;
revoke all on table public.leilao_lances     from anon, authenticated;
revoke all on table public.leilao_proxy      from anon, authenticated;
revoke all on table public.leilao_seguidores from anon, authenticated;
revoke all on table public.leilao_eventos    from anon, authenticated;

grant all on table public.leilao_rodadas, public.leiloes, public.leilao_lances,
  public.leilao_proxy, public.leilao_seguidores, public.leilao_eventos to service_role;

-- Rodadas: publicas fora do rascunho. Sem coluna sensivel.
grant select on table public.leilao_rodadas to anon, authenticated;
drop policy if exists leilao_rodadas_select_publico on public.leilao_rodadas;
create policy leilao_rodadas_select_publico on public.leilao_rodadas
  for select to anon, authenticated using (status <> 'rascunho');

-- Lotes: GRANT POR COLUNA. Fora: lider_user_id, lider_maximo_cents,
-- segundo_user_id, pedido_id, pagar_ate, cancelado_motivo.
grant select (
  id, codigo, slug, rodada_id, ordem, vendedor_user_id, loja_id,
  card_id, card_slug, card_name, card_numero, set_nome, card_image, fotos,
  condicao, idioma, graduadora, nota, descricao,
  lance_inicial_cents, preco_atual_cents, n_lances, n_participantes,
  duracao_seg, soft_close_seg, inicia_em, termina_em, prorrogacoes,
  status, encerrado_em, versao, created_at, updated_at, game
) on table public.leiloes to anon, authenticated;
drop policy if exists leiloes_select_publico on public.leiloes;
create policy leiloes_select_publico on public.leiloes
  for select to anon, authenticated using (status <> 'rascunho');

-- Lances: GRANT POR COLUNA. Fora: user_id, idem_key, resultado.
grant select (id, leilao_id, valor_cents, automatico, anulado_em, created_at)
  on table public.leilao_lances to anon, authenticated;
drop policy if exists leilao_lances_select_publico on public.leilao_lances;
create policy leilao_lances_select_publico on public.leilao_lances
  for select to anon, authenticated using (anulado_em is null);

-- Proxy: cada um le SO o proprio teto ("seu lance automatico vai ate R$ X").
grant select on table public.leilao_proxy to authenticated;
drop policy if exists leilao_proxy_select_dono on public.leilao_proxy;
create policy leilao_proxy_select_dono on public.leilao_proxy
  for select to authenticated using (user_id = (select auth.uid()));

-- Seguidores: o dono le, segue e deixa de seguir.
grant select, insert, delete on table public.leilao_seguidores to authenticated;
drop policy if exists leilao_seguidores_select_dono on public.leilao_seguidores;
create policy leilao_seguidores_select_dono on public.leilao_seguidores
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists leilao_seguidores_insert_dono on public.leilao_seguidores;
create policy leilao_seguidores_insert_dono on public.leilao_seguidores
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.leiloes l where l.id = leilao_id and l.status <> 'rascunho'));
drop policy if exists leilao_seguidores_delete_dono on public.leilao_seguidores;
create policy leilao_seguidores_delete_dono on public.leilao_seguidores
  for delete to authenticated using (user_id = (select auth.uid()));

-- Eventos: so servidor. RLS ligada e nenhum grant = fechado para anon/authenticated.


-- ----------------------------------------------------------------------------
-- 7. Apelido mascarado (security definer, leitura por PK)
-- ----------------------------------------------------------------------------
-- A view e security_invoker e o invocador NAO enxerga user_id de ninguem. Estas
-- funcoes leem so o necessario por PK e devolvem o apelido ja mascarado.

create or replace function public.leilao_lider_apelido(p_leilao uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.leilao_mascarar(coalesce(nullif(btrim(u.username), ''), u.name))
  from public.leiloes l
  join public.users u on u.id = l.lider_user_id
  where l.id = p_leilao and l.status <> 'rascunho'
$$;

create or replace function public.leilao_lance_apelido(p_lance bigint)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.leilao_mascarar(coalesce(nullif(btrim(u.username), ''), u.name))
  from public.leilao_lances x
  join public.leiloes l on l.id = x.leilao_id
  join public.users u on u.id = x.user_id
  where x.id = p_lance and x.anulado_em is null and l.status <> 'rascunho'
$$;


-- ----------------------------------------------------------------------------
-- 8. Views publicas (security_invoker: a RLS e o grant de coluna valem)
-- ----------------------------------------------------------------------------

create or replace view public.leiloes_publico
with (security_invoker = true)
as
select
  l.id, l.codigo, l.slug, l.rodada_id, l.ordem, l.vendedor_user_id, l.loja_id,
  l.card_id, l.card_slug, l.card_name, l.card_numero, l.set_nome, l.card_image, l.fotos,
  l.condicao, l.idioma, l.graduadora, l.nota, l.descricao,
  l.lance_inicial_cents, l.preco_atual_cents,
  public.leilao_lider_apelido(l.id) as lider_apelido,
  l.n_lances, l.n_participantes, l.duracao_seg, l.soft_close_seg,
  l.inicia_em, l.termina_em, l.prorrogacoes, l.status, l.encerrado_em,
  l.versao, l.game
from public.leiloes l
where l.status <> 'rascunho';

comment on view public.leiloes_publico is
  'Lote publico: SEM lider_maximo_cents e sem user_id do lider (so apelido mascarado). security_invoker.';

create or replace view public.leilao_lances_publico
with (security_invoker = true)
as
select
  x.id, x.leilao_id,
  public.leilao_lance_apelido(x.id) as apelido,
  x.valor_cents, x.automatico, x.created_at
from public.leilao_lances x
where x.anulado_em is null;

comment on view public.leilao_lances_publico is
  'Historico publico de lances com apelido mascarado ("j***a"). security_invoker.';

revoke all on table public.leiloes_publico, public.leilao_lances_publico from anon, authenticated;
grant select on table public.leiloes_publico, public.leilao_lances_publico to anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 9. dar_lance
-- ----------------------------------------------------------------------------

create or replace function public.dar_lance(p_leilao uuid, p_maximo_cents integer, p_idem uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '3s'
set statement_timeout = '5s'
as $$
declare
  v_uid          uuid := auth.uid();
  v_agora        timestamptz := now();   -- hora em que o lance chegou (corte exato)
  v_relogio      timestamptz;            -- hora real apos a trava (desempate, soft close)
  v_l            public.leiloes%rowtype;
  v_suspenso     timestamptz;
  v_cpf          text;
  v_cep          text;
  v_achou        boolean;
  v_res          jsonb;
  v_idem_user    uuid;
  v_idem_leilao  uuid;
  v_min          integer;
  v_meu_max      integer;
  v_top1_user    uuid;
  v_top1_max     integer;
  v_top2_user    uuid;
  v_top2_max     integer;
  v_preco        integer;
  v_preco_antigo integer;
  v_lider_antigo uuid;
  v_novos        integer := 0;
  v_termina      timestamptz;
  v_prorrogou    boolean := false;
  v_lance_id     bigint;
  v_n_lances     integer;
  v_versao       integer;
  v_n_part       integer;
begin
  if v_uid is null then
    raise exception 'nao_autenticado';
  end if;
  -- Teto de R$ 1 milhao (espelho de MAXIMO_CENTS_TETO na rota). Tambem e o que
  -- mantem teto + incremento longe do limite do integer.
  if p_leilao is null or p_idem is null or p_maximo_cents is null
     or p_maximo_cents < 1 or p_maximo_cents > 100000000 then
    raise exception 'pedido_invalido';
  end if;

  -- Elegibilidade (PK em users), ANTES da trava: nao segura o lote a toa.
  select u.suspended_at, u.cpf, u.cep, true
    into v_suspenso, v_cpf, v_cep, v_achou
  from public.users u where u.id = v_uid;
  if not coalesce(v_achou, false) then
    raise exception 'cadastro_incompleto';
  end if;
  if v_suspenso is not null then
    raise exception 'suspenso';
  end if;
  if length(regexp_replace(coalesce(v_cpf, ''), '[^0-9]', '', 'g')) <> 11
     or length(regexp_replace(coalesce(v_cep, ''), '[^0-9]', '', 'g')) <> 8 then
    raise exception 'cadastro_incompleto';
  end if;

  -- ★ A trava. Tudo daqui para baixo e serial por lote.
  select * into v_l from public.leiloes where id = p_leilao for update;
  if not found then
    raise exception 'leilao_fechado';
  end if;
  v_relogio := clock_timestamp();

  -- Idempotencia (depois da trava: replay simultaneo nao passa em dobro).
  select x.resultado, x.user_id, x.leilao_id into v_res, v_idem_user, v_idem_leilao
  from public.leilao_lances x where x.idem_key = p_idem;
  if not found then
    select e.payload->'resultado', e.user_id, e.leilao_id into v_res, v_idem_user, v_idem_leilao
    from public.leilao_eventos e
    where e.tipo = 'teto_ajustado' and (e.payload->>'idem') = p_idem::text;
  end if;
  if v_idem_user is not null then
    if v_idem_user <> v_uid or v_idem_leilao <> p_leilao or v_res is null then
      raise exception 'idem_invalido';
    end if;
    return v_res || jsonb_build_object('server_now', clock_timestamp(), 'repetido', true);
  end if;

  if v_l.vendedor_user_id = v_uid
     or (v_l.loja_id is not null and exists (
           select 1 from public.lojas lj where lj.id = v_l.loja_id and lj.owner_user_id = v_uid)) then
    raise exception 'proprio_leilao';
  end if;

  -- Corte exato.
  if v_l.status <> 'ativo'
     or v_l.termina_em is null
     or v_agora >= v_l.termina_em
     or (v_l.inicia_em is not null and v_agora < v_l.inicia_em) then
    raise exception 'leilao_fechado';
  end if;

  v_preco_antigo := v_l.preco_atual_cents;
  v_lider_antigo := v_l.lider_user_id;
  v_min := case
    when v_l.n_lances = 0 or v_l.preco_atual_cents is null then v_l.lance_inicial_cents
    else v_l.preco_atual_cents + public.leilao_incremento(v_l.preco_atual_cents)
  end;

  -- ── Quem ja lidera: so ajusta o proprio teto. Preco nao muda, nada publico. ──
  if v_lider_antigo = v_uid then
    select p.maximo_cents into v_meu_max
    from public.leilao_proxy p where p.leilao_id = p_leilao and p.user_id = v_uid;

    v_res := jsonb_build_object(
      'ok', true,
      'preco_cents', coalesce(v_l.preco_atual_cents, v_l.lance_inicial_cents),
      'lider', true,
      'termina_em', v_l.termina_em,
      'server_now', clock_timestamp(),
      'minimo_proximo_cents', v_min,
      'n_lances', v_l.n_lances,
      'versao', v_l.versao,
      'seu_maximo_cents', greatest(p_maximo_cents, coalesce(v_meu_max, 0))
    );

    -- Mesmo teto (ou menor): nada muda, nada e gravado. Um replay deste idem
    -- cai aqui de novo e devolve o mesmo retrato.
    if p_maximo_cents <= coalesce(v_meu_max, 0) then
      return v_res;
    end if;

    update public.leilao_proxy
       set maximo_cents = p_maximo_cents, created_at = v_relogio, atualizado_em = v_relogio
     where leilao_id = p_leilao and user_id = v_uid;
    update public.leiloes
       set lider_maximo_cents = p_maximo_cents
     where id = p_leilao;
    insert into public.leilao_eventos (leilao_id, tipo, user_id, payload, processado_em)
    values (p_leilao, 'teto_ajustado', v_uid,
            jsonb_build_object('idem', p_idem::text, 'resultado', v_res,
                               'de_cents', v_meu_max, 'para_cents', p_maximo_cents), now());
    return v_res;
  end if;

  -- ── Lance novo (ou teto maior de quem nao lidera) ──
  if p_maximo_cents < v_min then
    raise exception 'abaixo_minimo:%', v_min;
  end if;

  insert into public.leilao_proxy (leilao_id, user_id, maximo_cents, created_at, atualizado_em)
  values (p_leilao, v_uid, p_maximo_cents, v_relogio, v_relogio)
  on conflict (leilao_id, user_id) do update
    set maximo_cents  = excluded.maximo_cents,
        created_at    = excluded.created_at,     -- teto novo, fila nova no desempate
        atualizado_em = excluded.atualizado_em
    where public.leilao_proxy.maximo_cents < excluded.maximo_cents;

  -- Top 2 (indice idx_leilao_proxy_ranking). Empate: created_at mais antigo.
  select p.user_id, p.maximo_cents into v_top1_user, v_top1_max
  from public.leilao_proxy p
  where p.leilao_id = p_leilao
  order by p.maximo_cents desc, p.created_at asc, p.user_id
  limit 1;

  select p.user_id, p.maximo_cents into v_top2_user, v_top2_max
  from public.leilao_proxy p
  where p.leilao_id = p_leilao and p.user_id <> v_top1_user
  order by p.maximo_cents desc, p.created_at asc, p.user_id
  limit 1;

  if v_top2_user is null then
    v_preco := v_l.lance_inicial_cents;
  else
    v_preco := least(v_top1_max, v_top2_max + public.leilao_incremento(v_top2_max));
  end if;
  v_preco := greatest(v_preco, v_l.lance_inicial_cents, coalesce(v_preco_antigo, 0));

  if v_top1_user = v_uid then
    -- Quem chamou passou a liderar. O antigo lider "subiu ate o teto" antes.
    if v_lider_antigo is not null and v_top2_user is not null
       and v_top2_max > coalesce(v_preco_antigo, 0) then
      insert into public.leilao_lances (leilao_id, user_id, valor_cents, automatico)
      values (p_leilao, v_top2_user, v_top2_max, true);
      v_novos := v_novos + 1;
    end if;
    insert into public.leilao_lances (leilao_id, user_id, valor_cents, automatico, idem_key)
    values (p_leilao, v_uid, v_preco, false, p_idem)
    returning id into v_lance_id;
    v_novos := v_novos + 1;

    if v_lider_antigo is not null and v_lider_antigo <> v_uid then
      insert into public.leilao_eventos (leilao_id, tipo, user_id, payload)
      values (p_leilao, 'superado', v_lider_antigo,
              jsonb_build_object('preco_cents', v_preco,
                                 'minimo_proximo_cents', v_preco + public.leilao_incremento(v_preco)));
    end if;
  else
    -- Quem chamou foi coberto na hora pelo teto do lider.
    insert into public.leilao_lances (leilao_id, user_id, valor_cents, automatico, idem_key)
    values (p_leilao, v_uid, p_maximo_cents, false, p_idem)
    returning id into v_lance_id;
    insert into public.leilao_lances (leilao_id, user_id, valor_cents, automatico)
    values (p_leilao, v_top1_user, v_preco, true);
    v_novos := v_novos + 2;
  end if;

  -- Soft close: lance nos ultimos soft_close_seg empurra o fim.
  v_termina := v_l.termina_em;
  if v_l.soft_close_seg > 0
     and v_l.termina_em - v_relogio < make_interval(secs => v_l.soft_close_seg) then
    v_termina := greatest(v_l.termina_em, v_relogio + make_interval(secs => v_l.soft_close_seg));
    v_prorrogou := v_termina > v_l.termina_em;
  end if;

  select count(*)::int into v_n_part from public.leilao_proxy where leilao_id = p_leilao;

  update public.leiloes
     set preco_atual_cents  = v_preco,
         lider_user_id      = v_top1_user,
         lider_maximo_cents = v_top1_max,
         n_lances           = n_lances + v_novos,
         n_participantes    = v_n_part,
         termina_em         = v_termina,
         prorrogacoes       = prorrogacoes + (case when v_prorrogou then 1 else 0 end),
         versao             = versao + 1
   where id = p_leilao
  returning n_lances, versao into v_n_lances, v_versao;

  v_res := jsonb_build_object(
    'ok', true,
    'preco_cents', v_preco,
    'lider', v_top1_user = v_uid,
    'termina_em', v_termina,
    'server_now', clock_timestamp(),
    'minimo_proximo_cents', v_preco + public.leilao_incremento(v_preco),
    'n_lances', v_n_lances,
    'versao', v_versao
  );

  update public.leilao_lances set resultado = v_res where id = v_lance_id;

  return v_res;
end;
$$;

comment on function public.dar_lance(uuid, integer, uuid) is
  'Lance com teto oculto, desempate pelo mais antigo, soft close e idempotencia por p_idem. Erros (raise): nao_autenticado, cadastro_incompleto, suspenso, leilao_fechado, proprio_leilao, abaixo_minimo:<cents>, idem_invalido, pedido_invalido.';


-- ----------------------------------------------------------------------------
-- 10. Relogio: avancar rodada, fechar lote, tick
-- ----------------------------------------------------------------------------

-- Rodada ao vivo sem lote ativo -> ativa o proximo agendado por ordem, com
-- inicia_em=now() e termina_em=now()+duracao_seg. Rodada 'prazo' nao ativa
-- nada aqui (o tick ativa cada lote pela hora propria).
-- Encerra a rodada SO quando: nenhum lote em rascunho/agendado/ativo E pelo
-- menos um lote chegou a abrir e fechar (encerrado_em not null). Rodada com
-- lote em rascunho esta sendo montada; rodada em que nada abriu (tudo
-- cancelado, por exemplo) fica para a loja/admin decidir.
-- Trava a RODADA: fechamento preguicoso e tick nao ativam dois lotes juntos.
create or replace function public.leilao_avancar_rodada(p_rodada uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '2s'
as $$
declare
  v_modo text;
  v_prox uuid;
begin
  select r.modo into v_modo
  from public.leilao_rodadas r
  where r.id = p_rodada and r.status = 'ao_vivo'
  for update;
  if not found then
    return null;
  end if;

  if exists (select 1 from public.leiloes where rodada_id = p_rodada and status = 'ativo') then
    return null;
  end if;

  if v_modo = 'ao_vivo' then
    select l.id into v_prox
    from public.leiloes l
    where l.rodada_id = p_rodada and l.status = 'agendado'
    order by l.ordem, l.created_at
    limit 1
    for update skip locked;

    if v_prox is not null then
      -- now() + duracao: mesmo com tick atrasado o lote abre com a duracao cheia.
      update public.leiloes
         set status = 'ativo',
             inicia_em = now(),
             termina_em = now() + make_interval(secs => duracao_seg),
             versao = versao + 1
       where id = v_prox;
      insert into public.leilao_eventos (leilao_id, tipo, payload, processado_em)
      values (v_prox, 'iniciado', jsonb_build_object('rodada_id', p_rodada), now());
      return v_prox;
    end if;
  end if;

  if not exists (select 1 from public.leiloes
                 where rodada_id = p_rodada
                   and status in ('rascunho', 'agendado', 'ativo'))
     and exists (select 1 from public.leiloes
                 where rodada_id = p_rodada and encerrado_em is not null) then
    update public.leilao_rodadas set status = 'encerrada' where id = p_rodada;
  end if;
  return null;
end;
$$;

-- Fecha UM lote vencido. Usado pelo tick e pelo fechamento preguicoso (rota de
-- estado com service_role). skip locked: se um lance segura a linha, o proximo
-- tick fecha. A clausula where e reavaliada na versao travada (termina_em pode
-- ter sido empurrado pelo soft close).
-- ★ Folga de 1s (termina_em <= now() - 1s): lance que chegou antes do fim e
--   ainda espera a trava nao perde a vez para o fechamento. Ver cabecalho.
create or replace function public.leilao_fechar_lote(p_leilao uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '2s'
as $$
declare
  v_l       public.leiloes%rowtype;
  v_segundo uuid;
  v_status  text;
begin
  select * into v_l
  from public.leiloes
  where id = p_leilao and status = 'ativo' and termina_em <= now() - interval '1 second'
  for update skip locked;
  if not found then
    return null;
  end if;

  if v_l.lider_user_id is null then
    v_status := 'sem_lances';
    update public.leiloes
       set status = v_status, encerrado_em = now(), versao = versao + 1
     where id = p_leilao;
    insert into public.leilao_eventos (leilao_id, tipo, payload)
    values (p_leilao, 'encerrado', jsonb_build_object('resultado', v_status));
  else
    v_status := 'aguardando_pagamento';
    select p.user_id into v_segundo
    from public.leilao_proxy p
    where p.leilao_id = p_leilao and p.user_id <> v_l.lider_user_id
    order by p.maximo_cents desc, p.created_at asc, p.user_id
    limit 1;

    update public.leiloes
       set status = v_status,
           encerrado_em = now(),
           pagar_ate = now() + interval '48 hours',
           segundo_user_id = v_segundo,
           versao = versao + 1
     where id = p_leilao;
    insert into public.leilao_eventos (leilao_id, tipo, payload)
    values (p_leilao, 'encerrado',
            jsonb_build_object('resultado', v_status, 'preco_cents', v_l.preco_atual_cents));
    insert into public.leilao_eventos (leilao_id, tipo, user_id, payload)
    values (p_leilao, 'venceu', v_l.lider_user_id,
            jsonb_build_object('preco_cents', v_l.preco_atual_cents,
                               'pagar_ate', now() + interval '48 hours'));
  end if;

  if v_l.rodada_id is not null then
    perform public.leilao_avancar_rodada(v_l.rodada_id);
  end if;

  return v_status;
end;
$$;

-- Registro de erro do tick (monitoria). Nasce processado: nao e notificacao.
create or replace function public.leilao_erro_tick(p_leilao uuid, p_rodada uuid, p_etapa text,
                                                   p_estado text, p_msg text)
returns void
language sql
set search_path = public, pg_temp
as $$
  insert into public.leilao_eventos (leilao_id, rodada_id, tipo, payload, processado_em)
  values (p_leilao, p_rodada, 'erro_tick',
          jsonb_build_object('etapa', p_etapa, 'sqlstate', p_estado, 'mensagem', left(p_msg, 500)),
          now());
$$;

-- Cada lote/rodada roda no proprio bloco begin/exception (subtransacao): um
-- lote com problema grava 'erro_tick' e o resto do tick segue. O que falhou
-- volta ao estado anterior e o proximo tick tenta de novo.
create or replace function public.leilao_tick()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '2s'
set statement_timeout = '20s'
as $$
declare
  r                 record;
  v_rodadas         integer := 0;
  v_ativados        integer := 0;
  v_fechados        integer := 0;
  v_avancados       integer := 0;
  v_calotes         integer := 0;
  v_calotes_adiados integer := 0;
  v_erros           integer := 0;
begin
  -- 1. Rodadas agendadas que chegaram na hora -> ao_vivo.
  for r in
    select id from public.leilao_rodadas
    where status = 'agendada' and inicia_em <= now()
    for update skip locked
  loop
    begin
      update public.leilao_rodadas set status = 'ao_vivo' where id = r.id;
      v_rodadas := v_rodadas + 1;
    exception when others then
      perform public.leilao_erro_tick(null, r.id, 'abrir_rodada', sqlstate, sqlerrm);
      v_erros := v_erros + 1;
    end;
  end loop;

  -- 2. Lotes com hora propria (avulsos ou de rodada 'prazo') -> ativo.
  --    Lote de rodada ao vivo NAO entra aqui: ele espera o anterior fechar.
  --    Tick atrasado: termina_em = greatest(inicia_em, now()) + duracao. O lote
  --    nunca abre ja vencido (e o passo 3 nao o fecha no mesmo tick).
  for r in
    select l.id from public.leiloes l
    where l.status = 'agendado' and l.inicia_em <= now()
      and (l.rodada_id is null
           or exists (select 1 from public.leilao_rodadas rr
                      where rr.id = l.rodada_id and rr.modo = 'prazo'
                        and rr.status in ('agendada', 'ao_vivo')))
    for update of l skip locked
  loop
    begin
      update public.leiloes
         set status = 'ativo',
             termina_em = greatest(inicia_em, now()) + make_interval(secs => duracao_seg),
             versao = versao + 1
       where id = r.id;
      v_ativados := v_ativados + 1;
    exception when others then
      perform public.leilao_erro_tick(r.id, null, 'ativar', sqlstate, sqlerrm);
      v_erros := v_erros + 1;
    end;
  end loop;

  -- 3. Fecha vencidos, com a folga de 1s (e, em rodada ao vivo, ativa o
  --    proximo no mesmo passo).
  for r in
    select id from public.leiloes
    where status = 'ativo' and termina_em <= now() - interval '1 second'
    order by termina_em
    limit 500
  loop
    begin
      if public.leilao_fechar_lote(r.id) is not null then
        v_fechados := v_fechados + 1;
      end if;
    exception when others then
      perform public.leilao_erro_tick(r.id, null, 'fechar', sqlstate, sqlerrm);
      v_erros := v_erros + 1;
    end;
  end loop;

  -- 4. Rodadas ao vivo sem lote ativo (inicio da rodada ou lote cancelado no
  --    meio): ativa o proximo; sem nada restante, encerra (ver regras acima).
  for r in
    select id from public.leilao_rodadas where status = 'ao_vivo'
  loop
    begin
      if public.leilao_avancar_rodada(r.id) is not null then
        v_avancados := v_avancados + 1;
      end if;
    exception when others then
      perform public.leilao_erro_tick(null, r.id, 'avancar_rodada', sqlstate, sqlerrm);
      v_erros := v_erros + 1;
    end;
  end loop;

  -- 5. Calote SO com certeza: pagar_ate + 15 min de carencia, nenhum pedido
  --    pago do lote e nenhum checkout em andamento. Na duvida, espera: o
  --    proximo tick reavalia.
  for r in
    select l.id, l.lider_user_id, l.pedido_id from public.leiloes l
    where l.status = 'aguardando_pagamento'
      and l.pagar_ate <= now() - interval '15 minutes'
    for update of l skip locked
  loop
    begin
      if exists (
           select 1 from public.pedidos p
           where (p.id = r.pedido_id or p.leilao_id = r.id)
             and (p.pago_em is not null
                  or p.status in ('pago', 'enviado', 'entregue')
                  or (p.stripe_session_id is not null
                      and p.status not in ('cancelado', 'reembolsado')
                      and p.cancelado_em is null)))
         or exists (
           select 1 from public.pedido_itens i
           join public.pedidos p on p.id = i.pedido_id
           where i.leilao_id = r.id
             and (p.pago_em is not null
                  or p.status in ('pago', 'enviado', 'entregue')
                  or (p.stripe_session_id is not null
                      and p.status not in ('cancelado', 'reembolsado')
                      and p.cancelado_em is null))) then
        v_calotes_adiados := v_calotes_adiados + 1;
      else
        update public.leiloes set status = 'calote', versao = versao + 1 where id = r.id;
        insert into public.leilao_eventos (leilao_id, tipo, user_id, payload)
        values (r.id, 'calote', r.lider_user_id, '{}'::jsonb);
        v_calotes := v_calotes + 1;
      end if;
    exception when others then
      perform public.leilao_erro_tick(r.id, null, 'calote', sqlstate, sqlerrm);
      v_erros := v_erros + 1;
    end;
  end loop;

  return jsonb_build_object(
    'rodadas_ao_vivo', v_rodadas,
    'ativados', v_ativados,
    'fechados', v_fechados,
    'avancados', v_avancados,
    'calotes', v_calotes,
    'calotes_adiados', v_calotes_adiados,
    'erros', v_erros,
    'em', now()
  );
end;
$$;

comment on function public.leilao_tick() is
  'Relogio do leilao (pg_cron): ativa agendados, fecha vencidos (folga 1s), avanca rodada ao vivo, marca calote apos pagar_ate + 15 min se nao houver pedido pago nem checkout em andamento. Erro por lote/rodada vira evento erro_tick. So postgres/service_role.';


-- ----------------------------------------------------------------------------
-- 11. Grants de funcao (Supabase da EXECUTE a anon/authenticated por default)
-- ----------------------------------------------------------------------------

revoke all on function public.leilao_incremento(integer)       from public, anon, authenticated;
revoke all on function public.leilao_novo_codigo()             from public, anon, authenticated;
revoke all on function public.leilao_mascarar(text)            from public, anon, authenticated;
revoke all on function public.leilao_lider_apelido(uuid)       from public, anon, authenticated;
revoke all on function public.leilao_lance_apelido(bigint)     from public, anon, authenticated;
revoke all on function public.dar_lance(uuid, integer, uuid)   from public, anon, authenticated;
revoke all on function public.leilao_avancar_rodada(uuid)      from public, anon, authenticated;
revoke all on function public.leilao_fechar_lote(uuid)         from public, anon, authenticated;
revoke all on function public.leilao_tick()                    from public, anon, authenticated;
revoke all on function public.leilao_erro_tick(uuid, uuid, text, text, text) from public, anon, authenticated;
-- funcoes de trigger: o Postgres nao checa EXECUTE ao disparar; revoke so por higiene
revoke all on function public.leilao_valida_lote()            from public, anon, authenticated;
revoke all on function public.leilao_rodada_modo_fixo()       from public, anon, authenticated;

grant execute on function public.leilao_incremento(integer)     to anon, authenticated, service_role;
grant execute on function public.leilao_mascarar(text)          to anon, authenticated, service_role;
-- chamadas de dentro das views security_invoker: o invocador precisa de EXECUTE
grant execute on function public.leilao_lider_apelido(uuid)     to anon, authenticated, service_role;
grant execute on function public.leilao_lance_apelido(bigint)   to anon, authenticated, service_role;
grant execute on function public.dar_lance(uuid, integer, uuid) to authenticated;
grant execute on function public.leilao_novo_codigo()           to service_role;
grant execute on function public.leilao_avancar_rodada(uuid)    to service_role;
grant execute on function public.leilao_fechar_lote(uuid)       to service_role;
grant execute on function public.leilao_tick()                  to service_role;
