-- Relogio de status do anuncio: `status_em`
--
-- ★ APLICADA em 08/09/2026. Resultado medido: 120/120 linhas com carimbo,
--   0 sem. Trigger provado em transacao revertida (canario inserido e
--   desfeito por RAISE EXCEPTION): valor forjado pelo cliente e descartado
--   com E sem transicao, e a transicao real grava now(). ATENCAO ao provar
--   de novo: `now()` e congelado no inicio da transacao, entao um teste que
--   faz insert e update no mesmo bloco ve os tres carimbos IGUAIS e parece
--   falha do trigger -- foi o meu primeiro teste, e o falso negativo era do
--   teste, nao do codigo. Provar mandando valor forjado, nao comparando
--   instantes.
--
-- POR QUE (08/09/2026): nao existe registro de QUANDO o status mudou. A
-- tabela tem 25 colunas e o unico carimbo e `created_at`, que e a data do
-- ANUNCIO, nao da reserva. Medido em producao hoje, 5 anuncios presos:
--
--   mega-abomasnow-ex-157-188            reservado      2.164h  0 msgs
--   mega-heracross-ex-004-130-valdeirg   reservado      1.624h  0 msgs
--   mega-zygarde-ex-104-124              em_negociacao    807h  2 msgs
--   reshiram-charizard-gx-217-214-...    em_negociacao    175h  1 msg
--   suicune-entei-legend-95-96           em_negociacao     31h  2 msgs  R$1.900
--
-- Sem esta coluna a regra de 72h e literalmente indefinivel: os dois casos
-- de 0 mensagem nao tem NENHUM timestamp da reserva no banco.
--
-- ★ POR QUE TRIGGER E NAO CARIMBO NO CLIENTE. Sao 9 pontos de UPDATE de
--   status vindos do browser (marketplace/page.tsx x4, ChatDock x3,
--   NegociacoesTab x3, marketplaceInteresse.ts:43) -- e, principalmente, a
--   transicao `reservado -> em_negociacao` NAO passa por nenhum deles: quem
--   escreve e a RPC `enviar_mensagem` (SECURITY DEFINER), dentro do banco.
--   Um carimbo no cliente perderia justamente o status onde 3 dos 5 estao.
--
-- ★ POR QUE timestamptz. `marketplace.created_at` e `timestamp without time
--   zone` -- a excecao da casa: `marketplace_mensagens.created_at` e as
--   quatro datas de `pedidos` sao todas timestamptz. Comparar naive com
--   now() faz cast implicito pelo TimeZone da SESSAO, e a sessao do MCP nao
--   e a do lambda. Coluna nova nasce timestamptz e encerra o assunto.
--
-- CUSTO: marketplace tem 120 linhas / 200 kB. Backfill e indice aqui sao
-- gratuitos -- cabe em buffer, sem risco de statement_timeout.

-- ── 1. A coluna ───────────────────────────────────────────────────────────
alter table public.marketplace
  add column if not exists status_em timestamptz;

comment on column public.marketplace.status_em is
  'Quando o status ATUAL foi assumido. Escrito exclusivamente pelo trigger '
  'trg_marketplace_status_em -- o cliente nao consegue forjar. Serve de '
  'relogio da expiracao de negociacao e de token de versao no UPDATE '
  'condicional do cron.';

-- ── 2. BACKFILL ANTES DO TRIGGER ──────────────────────────────────────────
--
-- ★ A ORDEM AQUI NAO E ESTILO. O trigger abaixo, num UPDATE que nao muda o
--   status, forca `new.status_em := old.status_em`. Se ele ja existisse,
--   este UPDATE gravaria NULL de volta em cima de si mesmo e sairia daqui
--   sem ter feito nada -- CALADO. Mesma familia da armadilha de snapshot que
--   derrubou a primeira versao da migration de slug (20260907120000).
--
-- O valor e o MELHOR PROXY disponivel, nao a verdade: a verdade nunca foi
-- gravada. Ultima mensagem quando existe, senao created_at. E conservador --
-- para os 2 sem mensagem nenhuma, created_at ja e ha 2 e 3 meses, entao o
-- proxy nao tem como fazer anuncio parecer mais NOVO do que e.
update public.marketplace m
set status_em = coalesce(
      (select max(mm.created_at) from public.marketplace_mensagens mm
        where mm.anuncio_id = m.id),
      m.created_at at time zone 'UTC'
    )
where m.status_em is null;

-- ── 3. O trigger ──────────────────────────────────────────────────────────
create or replace function public.trg_marketplace_status_em_fn()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op = 'INSERT' then
    new.status_em := coalesce(new.created_at at time zone 'UTC', now());
    return new;
  end if;

  if new.status is distinct from old.status then
    new.status_em := now();                       -- transicao de verdade
  elsif old.status_em is null then
    new.status_em := coalesce(new.status_em, now());
  else
    -- ★ Status nao mudou: o relogio NAO anda, e o valor que o cliente mandar
    --   e DESCARTADO. Sem isto, editar preco ou descricao renovaria a
    --   reserva -- e `status`/`buyer_id` sao gravaveis pelo cliente hoje.
    new.status_em := old.status_em;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_marketplace_status_em on public.marketplace;
create trigger trg_marketplace_status_em
  before insert or update on public.marketplace
  for each row execute function public.trg_marketplace_status_em_fn();

-- Ja existe trg_marketplace_slug (BEFORE INSERT OR UPDATE). Triggers BEFORE
-- do mesmo evento disparam em ordem ALFABETICA: ...slug roda antes de
-- ...status_em. Os dois retornam NEW e mexem em colunas disjuntas. O nome
-- foi escolhido pra cair depois, nao por acaso.

-- ── 4. Indice parcial ─────────────────────────────────────────────────────
-- So nos status que a varredura le. Com 120 linhas nao muda nada hoje;
-- existe pro dia em que a tabela tiver 50 mil.
create index if not exists idx_marketplace_negociando
  on public.marketplace (status_em)
  where removido_em is null and status in ('reservado', 'em_negociacao');

-- ── 5. Grants ─────────────────────────────────────────────────────────────
-- NADA a fazer, e e proposital. `authenticated` nao tem UPDATE de TABELA em
-- marketplace (ACL ardDxtm, sem `w`); o UPDATE dele e POR COLUNA, so em
-- `status` e `buyer_id`. Coluna nova ja nasce nao-gravavel pelo cliente.

-- ── ROLLBACK (uma linha neutraliza) ───────────────────────────────────────
--   drop trigger trg_marketplace_status_em on public.marketplace;
-- Limpeza completa:
--   drop function public.trg_marketplace_status_em_fn();
--   drop index public.idx_marketplace_negociando;
--   alter table public.marketplace drop column status_em;
