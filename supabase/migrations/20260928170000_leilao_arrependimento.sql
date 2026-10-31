-- ============================================================================
-- Leilao da Bynx, fatia 8: DIREITO DE ARREPENDIMENTO (art. 49 do CDC).
--
-- ★ SO NA BRANCH DE PROVA. Producao recebe com o resto do leilao (#422).
--   Depende de 20260928140000_pedido_reclamacoes.sql.
--
-- POR QUE (decisao do Du, 09-10/10, Quadro #469, validado por 3 agentes:
-- logistica, e-commerce e defesa do consumidor): compra a distancia da 7 dias
-- de arrependimento sem justificativa. O leilao da Bynx e venda online da loja
-- (nao leilao oficial), entao o direito vale. Desenho aprovado:
--   - ANTES DO ENVIO (pedido 'pago'): desistencia com estorno integral na hora.
--     Rota, sem schema novo (mesmo CAS pago -> cancelando do cancelamento por
--     atraso).
--   - DEPOIS DO ENVIO (enviado, ou entregue ha ate 7 dias): o comprador desiste,
--     tem 7 dias para postar a carta de volta e informa o rastreio. Quando a
--     devolucao chega, a loja tem 2 dias uteis para contestar (carta trocada ou
--     danificada, com prova). Sem contestacao, o estorno integral sai sozinho.
--     Contestou -> a Bynx decide pelo caminho da reclamacao.
--   - Nao postou em 7 dias -> a desistencia expira, sem estorno.
--   - Etiqueta reversa paga pela Bynx (Melhor Envio) e a ETAPA 2: ate la o
--     rastreio e informado pelo comprador.
--   - Uma janela so de 7 dias depois da entrega, para reclamacao E
--     arrependimento (antes eram 5 dias so para reclamacao): o comprador nao
--     precisa entender dois prazos.
--
-- O QUE MUDA:
--   1. pedido_reclamacoes ganha o motivo 'arrependimento' (sem fotos: o CDC
--      nao pede justificativa) e 9 colunas da devolucao e da contestacao.
--      Arrependimento nasce direto em 'aguardando_devolucao'.
--   2. pedidos ganha envio_fotos (fotos da carta tiradas pela loja ao enviar,
--      obrigatorias em lote de leilao a partir de R$ 150 -- e a prova da loja
--      numa contestacao), envio_uploads (teto de URLs assinadas) e em_disputa
--      (chargeback aberto: trava todo estorno pela Bynx, a Stripe ja segurou
--      o valor).
--   3. Prazo de reclamacao 5 -> 7 dias (trigger e pedido_reclamacao_abrir).
--   4. pedido_arrependimento_abrir: abre sob lock, com as mesmas travas da
--      reclamacao. Postagem, entrega, contestacao e estorno sao updates de UMA
--      tabela pelas rotas (compare-and-set) e pedido_reclamacao_resolver, que
--      ja existe.
--   5. pedido_envio_reservar_upload: teto de fotos de envio por pedido.
--
-- ★ CUSTO DE IO: zero. pedidos tem centenas de linhas e as colunas novas tem
--   default constante (catalogo). Nada toca pokemon_cards_all.
-- ★ lock_timeout de 3s: com fila em pedidos, falha em vez de enfileirar.
--
-- ROLLBACK (nesta ordem; so com nenhuma linha de 'arrependimento'):
--   drop function if exists public.pedido_envio_reservar_upload(uuid, integer);
--   drop function if exists public.pedido_arrependimento_abrir(uuid, uuid, text, timestamptz);
--   -- reaplicar pedidos_prazo_reclamacao e pedido_reclamacao_abrir de 20260928140000 (5 dias)
--   alter table public.pedido_reclamacoes drop constraint pedido_reclamacoes_motivo_check;
--   alter table public.pedido_reclamacoes add constraint pedido_reclamacoes_motivo_check
--     check (motivo in ('nao_chegou','diferente_do_anuncio','suspeita_falsificacao','danificado'));
--   alter table public.pedido_reclamacoes drop constraint pedido_reclamacoes_fotos_chk;
--   alter table public.pedido_reclamacoes add constraint pedido_reclamacoes_fotos_chk
--     check (motivo = 'nao_chegou' or cardinality(fotos) >= 3);
--   alter table public.pedido_reclamacoes
--     drop column if exists postar_ate, drop column if exists devolucao_rastreio,
--     drop column if exists devolucao_postada_em, drop column if exists devolucao_entregue_em,
--     drop column if exists contestar_ate, drop column if exists contestacao,
--     drop column if exists contestacao_video_url, drop column if exists contestada_em;
--   alter table public.pedidos
--     drop column if exists envio_fotos, drop column if exists envio_uploads,
--     drop column if exists em_disputa;
-- ============================================================================

set local lock_timeout = '3s';


-- ----------------------------------------------------------------------------
-- 1. pedido_reclamacoes: motivo, fotos e colunas da devolucao
-- ----------------------------------------------------------------------------

alter table public.pedido_reclamacoes drop constraint if exists pedido_reclamacoes_motivo_check;
alter table public.pedido_reclamacoes add constraint pedido_reclamacoes_motivo_check
  check (motivo in ('nao_chegou', 'diferente_do_anuncio', 'suspeita_falsificacao', 'danificado', 'arrependimento'));

-- Arrependimento nao exige foto: o comprador nao precisa justificar nada.
alter table public.pedido_reclamacoes drop constraint if exists pedido_reclamacoes_fotos_chk;
alter table public.pedido_reclamacoes add constraint pedido_reclamacoes_fotos_chk
  check (motivo in ('nao_chegou', 'arrependimento') or cardinality(fotos) >= 3);

alter table public.pedido_reclamacoes
  add column if not exists postar_ate timestamptz,
  add column if not exists devolucao_rastreio text
    check (devolucao_rastreio is null or devolucao_rastreio ~ '^[A-Z]{2}[0-9]{9}[A-Z]{2}$'),
  add column if not exists devolucao_postada_em timestamptz,
  add column if not exists devolucao_entregue_em timestamptz,
  add column if not exists contestar_ate timestamptz,
  add column if not exists contestacao text
    check (contestacao is null or char_length(contestacao) between 10 and 2000),
  add column if not exists contestacao_video_url text
    check (contestacao_video_url is null or (char_length(contestacao_video_url) <= 500 and contestacao_video_url ~ '^https://')),
  add column if not exists contestada_em timestamptz;

comment on column public.pedido_reclamacoes.postar_ate is
  'Arrependimento: ate quando o comprador posta a carta de volta (abertura + 7 dias). Passou sem postagem -> expira sem estorno.';
comment on column public.pedido_reclamacoes.devolucao_rastreio is
  'Arrependimento: rastreio da devolucao (padrao S10 dos Correios, digito conferido pela rota).';
comment on column public.pedido_reclamacoes.devolucao_entregue_em is
  'Arrependimento: quando a devolucao chegou na loja (marcado pela Bynx; na etapa 2, pelo rastreio).';
comment on column public.pedido_reclamacoes.contestar_ate is
  'Arrependimento: fim da janela da loja para contestar (entrega + 2 dias uteis). Sem contestacao, estorno automatico.';

-- O cron procura "postagem vencida" e "janela de contestacao vencida".
create index if not exists pedido_reclamacoes_devolucao_idx
  on public.pedido_reclamacoes (status, motivo)
  where status = 'aguardando_devolucao';


-- ----------------------------------------------------------------------------
-- 2. pedidos: fotos de envio e trava de chargeback
-- ----------------------------------------------------------------------------

alter table public.pedidos
  add column if not exists envio_fotos text[] not null default '{}',
  add column if not exists envio_uploads integer not null default 0,
  add column if not exists em_disputa boolean not null default false;

comment on column public.pedidos.envio_fotos is
  'Leilao: caminhos no bucket privado reclamacoes (<pedido>/envio/...) das fotos da carta tiradas pela loja ao enviar. Obrigatorias a partir de R$ 150.';
comment on column public.pedidos.envio_uploads is
  'Leilao: URLs assinadas de foto de envio ja emitidas. Teto em pedido_envio_reservar_upload.';
comment on column public.pedidos.em_disputa is
  'Chargeback aberto (webhook charge.dispute.created). Trava todo estorno pela Bynx: a Stripe ja segurou o valor.';


-- ----------------------------------------------------------------------------
-- 3. Prazo de reclamacao: 5 -> 7 dias
-- ----------------------------------------------------------------------------

create or replace function public.pedidos_prazo_reclamacao()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'entregue'
     and old.status is distinct from 'entregue'
     and new.prazo_reclamacao_ate is null
     and (new.leilao_id is not null
          or exists (select 1 from public.pedido_itens i
                      where i.pedido_id = new.id and i.leilao_id is not null)) then
    -- espelho de DIAS_RECLAMAR em src/lib/leilao-reclamacao.ts
    new.prazo_reclamacao_ate := coalesce(new.entregue_em, now()) + interval '7 days';
  end if;
  return new;
end;
$$;

create or replace function public.pedido_reclamacao_abrir(
  p_pedido uuid,
  p_comprador uuid,
  p_motivo text,
  p_descricao text,
  p_fotos text[],
  p_video_url text,
  p_prazo_loja_ate timestamptz,
  p_prazo_decisao_ate timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '3s'
as $$
declare
  v_ped public.pedidos%rowtype;
  v_id  uuid;
begin
  -- Arrependimento tem funcao propria (nasce em aguardando_devolucao).
  if p_motivo = 'arrependimento' then
    raise exception 'motivo_invalido';
  end if;
  select * into v_ped from public.pedidos where id = p_pedido for update;
  if not found then
    raise exception 'pedido_nao_encontrado';
  end if;
  if v_ped.comprador_user_id is distinct from p_comprador then
    raise exception 'nao_e_comprador';
  end if;
  if v_ped.leilao_id is null
     and not exists (select 1 from public.pedido_itens i
                      where i.pedido_id = v_ped.id and i.leilao_id is not null) then
    raise exception 'nao_e_leilao';
  end if;
  if v_ped.status not in ('enviado', 'entregue') then
    raise exception 'status_invalido';
  end if;
  -- espelho de DIAS_RECLAMAR em src/lib/leilao-reclamacao.ts
  if v_ped.status = 'entregue'
     and coalesce(v_ped.prazo_reclamacao_ate, coalesce(v_ped.entregue_em, v_ped.updated_at) + interval '7 days') < now() then
    raise exception 'prazo_encerrado';
  end if;
  if v_ped.reclamacao_aberta then
    raise exception 'ja_existe';
  end if;

  begin
    insert into public.pedido_reclamacoes (
      pedido_id, comprador_user_id, loja_id, vendedor_user_id, motivo, descricao,
      fotos, video_url, prazo_loja_ate, prazo_decisao_ate)
    values (
      v_ped.id, p_comprador, v_ped.loja_id, v_ped.vendedor_user_id, p_motivo, p_descricao,
      coalesce(p_fotos, '{}'), p_video_url, p_prazo_loja_ate, p_prazo_decisao_ate)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ja_existe';
  end;

  update public.pedidos
     set reclamacao_aberta = true, updated_at = now()
   where id = v_ped.id;

  return v_id;
end;
$$;


-- ----------------------------------------------------------------------------
-- 4. Abrir o arrependimento (comprador, pela rota)
-- ----------------------------------------------------------------------------
-- Mesmas travas da reclamacao, mais o chargeback. p_postar_ate chega
-- calculado pela rota (DIAS_POSTAR_DEVOLUCAO). prazo_loja_ate e NOT NULL na
-- tabela e nao se aplica aqui: recebe o mesmo postar_ate.

create or replace function public.pedido_arrependimento_abrir(
  p_pedido uuid,
  p_comprador uuid,
  p_descricao text,
  p_postar_ate timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '3s'
as $$
declare
  v_ped public.pedidos%rowtype;
  v_id  uuid;
begin
  select * into v_ped from public.pedidos where id = p_pedido for update;
  if not found then
    raise exception 'pedido_nao_encontrado';
  end if;
  if v_ped.comprador_user_id is distinct from p_comprador then
    raise exception 'nao_e_comprador';
  end if;
  if v_ped.leilao_id is null
     and not exists (select 1 from public.pedido_itens i
                      where i.pedido_id = v_ped.id and i.leilao_id is not null) then
    raise exception 'nao_e_leilao';
  end if;
  if v_ped.em_disputa then
    raise exception 'em_disputa';
  end if;
  if v_ped.status not in ('enviado', 'entregue') then
    raise exception 'status_invalido';
  end if;
  -- espelho de DIAS_RECLAMAR em src/lib/leilao-reclamacao.ts
  if v_ped.status = 'entregue'
     and coalesce(v_ped.prazo_reclamacao_ate, coalesce(v_ped.entregue_em, v_ped.updated_at) + interval '7 days') < now() then
    raise exception 'prazo_encerrado';
  end if;
  if v_ped.reclamacao_aberta then
    raise exception 'ja_existe';
  end if;
  if p_postar_ate is null or p_postar_ate <= now() then
    raise exception 'prazo_invalido';
  end if;

  begin
    insert into public.pedido_reclamacoes (
      pedido_id, comprador_user_id, loja_id, vendedor_user_id, motivo, descricao,
      status, prazo_loja_ate, postar_ate)
    values (
      v_ped.id, p_comprador, v_ped.loja_id, v_ped.vendedor_user_id, 'arrependimento', p_descricao,
      'aguardando_devolucao', p_postar_ate, p_postar_ate)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ja_existe';
  end;

  update public.pedidos
     set reclamacao_aberta = true, updated_at = now()
   where id = v_ped.id;

  return v_id;
end;
$$;

comment on function public.pedido_arrependimento_abrir(uuid, uuid, text, timestamptz) is
  'Comprador desiste da compra de leilao enviada/entregue (7 dias, art. 49 do CDC). Nasce em aguardando_devolucao e liga pedidos.reclamacao_aberta. So service_role.';


-- ----------------------------------------------------------------------------
-- 5. Reservar upload de foto de envio (loja, pela rota)
-- ----------------------------------------------------------------------------
-- Mesmo desenho de pedido_reclamacao_reservar_upload. A rota ja conferiu que
-- quem pede e o dono da loja do pedido; aqui so o teto, e so de pedido pago.

create or replace function public.pedido_envio_reservar_upload(
  p_pedido uuid,
  p_teto integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '3s'
as $$
begin
  update public.pedidos
     set envio_uploads = envio_uploads + 1
   where id = p_pedido
     and status = 'pago'
     and envio_uploads < greatest(coalesce(p_teto, 0), 0);
  return found;
end;
$$;

comment on function public.pedido_envio_reservar_upload(uuid, integer) is
  'Conta uma URL assinada de foto de envio; false = teto atingido ou pedido fora de pago. So service_role.';

revoke all on function public.pedido_arrependimento_abrir(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.pedido_arrependimento_abrir(uuid, uuid, text, timestamptz) to service_role;
revoke all on function public.pedido_envio_reservar_upload(uuid, integer) from public, anon, authenticated;
grant execute on function public.pedido_envio_reservar_upload(uuid, integer) to service_role;
