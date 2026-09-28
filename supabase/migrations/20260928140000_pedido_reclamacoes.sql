-- ============================================================================
-- Leilao da Bynx, fatia 7: POLITICA DE RECLAMACAO ("Protecao Bynx").
--
-- ★ NAO APLICADA. Depende de 20260928090000_leilao_motor.sql (pedidos.leilao_id
--   e pedido_itens.leilao_id). Sobe com o Du, depois das fatias do leilao.
--
-- POR QUE (decisao do Du, 28/09): o dinheiro NAO fica retido -- segue destination
-- charge, a loja recebe no prazo do plano de repasse (30 dias, travado no
-- agendar da rodada). A protecao do comprador de LEILAO vira politica com prazo:
--   - loja envia em ate 3 dias uteis; sem envio, o comprador pede o cancelamento
--     e recebe estorno integral (rota, sem schema novo);
--   - comprador reclama em ate 5 dias depois da entrega (confirmacao dele ou
--     fechamento automatico em enviado + 10 dias, aviso no dia 6);
--   - loja responde em 2 dias uteis; silencio = decisao a favor do comprador;
--   - a Bynx (admin) decide em ate 2 dias uteis e estorna pela Stripe.
--   Prazos encurtados em 28/09 para caber no repasse de 30 dias. A fonte e
--   src/lib/leilao-reclamacao.ts (DIAS_*); aqui so o '5 days' e executavel,
--   espelho de DIAS_RECLAMAR. Os prazos uteis chegam calculados pela rota.
-- Marketplace e produto de loja NAO mudam: tudo aqui so vale para pedido de
-- leilao, e as rotas conferem LEILAO_ATIVO.
--
-- O QUE NASCE:
--   1. pedidos: 5 colunas (reclamacao_aberta, recebido_automatico,
--      prazo_reclamacao_ate, valor_reembolsado_cents, aviso_recebimento_em).
--      Todas nullable ou com default CONSTANTE: no PG11+ isso e so catalogo,
--      a tabela NAO e reescrita.
--   2. trigger pedidos_prazo_reclamacao_trg: quando um pedido de leilao vira
--      'entregue' (confirmacao do comprador, cron, admin), grava
--      prazo_reclamacao_ate = entregue_em + 5 dias. Um lugar so, qualquer
--      caminho. Pedido que nao e de leilao passa intacto.
--   3. tabela pedido_reclamacoes + indice unico parcial (uma reclamacao aberta
--      por pedido).
--   4. pedido_reclamacao_abrir(...) e pedido_reclamacao_resolver(...): as duas
--      transicoes que mexem em DUAS tabelas (reclamacao + pedidos) numa
--      transacao, com `for update` na linha do pedido/reclamacao.
--   5. bucket privado 'reclamacoes' (fotos frente/verso/embalagem).
--   6. pedidos.status ganha 'cancelando': trava do cancelamento por atraso
--      ANTES da Stripe (compare-and-set pago -> cancelando pela rota). O
--      "enviar" da loja so vale de 'pago', entao nao corre com o estorno.
--   7. pedidos.reclamacao_uploads + pedido_reclamacao_reservar_upload: teto
--      de URLs assinadas de foto emitidas por pedido (contador no banco,
--      incremento atomico -- a contagem de arquivos na pasta nao via URL
--      emitida e nunca usada).
--
-- ★ NASCE FECHADA. Default privilege do Supabase da tudo pro authenticated em
--   tabela nova: `revoke all` antes do grant, RLS ligada antes de qualquer linha.
--   authenticated so tem SELECT: o comprador le a propria reclamacao e o dono
--   da loja le as dos pedidos da loja. ESCRITA E SO DO SERVIDOR (service_role),
--   pelas rotas: abrir exige conferir prazo, pedido de leilao, fotos que
--   existem no bucket e ligar a trava em `pedidos` na mesma transacao -- um
--   INSERT direto pela REST pularia tudo isso. Mesmo desenho de
--   servico_solicitacoes e de `pedidos`.
-- ★ BUCKET SEM POLICY em storage.objects = nem anon nem authenticated leem ou
--   gravam direto. Upload pelo createSignedUploadUrl emitido pela rota (caminho
--   escolhido pelo servidor: <pedido>/<comprador>/<slot>-<uuid>.<ext>); leitura
--   por signed URL curta (admin e loja). Padrao do servico-midias.
--
-- ★ CUSTO DE IO: praticamente zero. `pedidos` tem centenas de linhas; add column
--   com default constante e catalogo; o trigger e por linha e so roda no update
--   de `status`. Tabela nova nasce vazia. Nada toca pokemon_cards /
--   pokemon_cards_all.
--   ★ `alter table pedidos add column` e `create trigger` pegam trava forte em
--   pedidos por um instante: lock_timeout de 3s no topo -- com fila, falha em
--   vez de enfileirar o checkout atras. Rodar como transacao unica (`set local`
--   so vale dentro de transacao).
--
-- ROLLBACK (nesta ordem):
--   drop function if exists public.pedido_reclamacao_reservar_upload(uuid, uuid, integer);
--   drop function if exists public.pedido_reclamacao_resolver(uuid, text, text, integer, text, text, text);
--   drop function if exists public.pedido_reclamacao_abrir(uuid, uuid, text, text, text[], text, timestamptz, timestamptz);
--   drop table if exists public.pedido_reclamacoes;
--   drop trigger if exists pedidos_prazo_reclamacao_trg on public.pedidos;
--   drop function if exists public.pedidos_prazo_reclamacao();
--   alter table public.pedidos
--     drop column if exists aviso_recebimento_em,
--     drop column if exists valor_reembolsado_cents,
--     drop column if exists prazo_reclamacao_ate,
--     drop column if exists recebido_automatico,
--     drop column if exists reclamacao_aberta,
--     drop column if exists reclamacao_uploads;
--   -- so depois de conferir que nenhum pedido esta em 'cancelando':
--   alter table public.pedidos drop constraint if exists pedidos_status_check;
--   alter table public.pedidos add constraint pedidos_status_check check (status in
--     ('aguardando_pagamento','pago','enviado','entregue','cancelado','reembolsado'));
--   delete from storage.buckets where id = 'reclamacoes';  -- so se vazio
-- ============================================================================

set local lock_timeout = '3s';


-- ----------------------------------------------------------------------------
-- 1. Colunas em pedidos
-- ----------------------------------------------------------------------------

alter table public.pedidos
  add column if not exists reclamacao_aberta boolean not null default false,
  add column if not exists recebido_automatico boolean not null default false,
  add column if not exists prazo_reclamacao_ate timestamptz,
  add column if not exists valor_reembolsado_cents integer not null default 0,
  add column if not exists aviso_recebimento_em timestamptz,
  add column if not exists reclamacao_uploads integer not null default 0;

comment on column public.pedidos.reclamacao_aberta is
  'Leilao: ha reclamacao nao resolvida. Trava o fechamento automatico (enviado + 10 dias).';
comment on column public.pedidos.recebido_automatico is
  'Leilao: virou entregue pelo cron (enviado + 10 dias sem confirmacao nem reclamacao).';
comment on column public.pedidos.prazo_reclamacao_ate is
  'Leilao: ate quando o comprador pode reclamar (entregue_em + 5 dias). Gravado pelo trigger pedidos_prazo_reclamacao_trg.';
comment on column public.pedidos.valor_reembolsado_cents is
  'Soma estornada por decisao de reclamacao (parcial ou total). Estorno de cancelamento continua em stripe_refund_id.';
comment on column public.pedidos.aviso_recebimento_em is
  'Leilao: quando o aviso do dia 6 ("confirme ou conte o problema") saiu. Marca de idempotencia do cron.';
comment on column public.pedidos.reclamacao_uploads is
  'Leilao: URLs assinadas de foto de reclamacao ja emitidas para este pedido. Teto em pedido_reclamacao_reservar_upload.';

-- 'cancelando': estado de passagem do cancelamento por atraso (Protecao Bynx).
-- A rota faz pago -> cancelando (CAS) ANTES de estornar na Stripe; o "enviar"
-- da loja filtra status = 'pago' e nao pega um pedido que ja esta sendo
-- estornado. Stripe recusou -> volta para 'pago'. Deu certo -> 'reembolsado'.
-- Tabela de centenas de linhas: NOT VALID + VALIDATE e so por higiene de lock.
alter table public.pedidos drop constraint if exists pedidos_status_check;
alter table public.pedidos add constraint pedidos_status_check
  check (status in ('aguardando_pagamento', 'pago', 'cancelando', 'enviado', 'entregue', 'cancelado', 'reembolsado'))
  not valid;
alter table public.pedidos validate constraint pedidos_status_check;


-- ----------------------------------------------------------------------------
-- 2. Prazo de reclamacao gravado na entrega (qualquer caminho)
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
    new.prazo_reclamacao_ate := coalesce(new.entregue_em, now()) + interval '5 days';
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_prazo_reclamacao_trg on public.pedidos;
create trigger pedidos_prazo_reclamacao_trg
  before update of status on public.pedidos
  for each row
  execute function public.pedidos_prazo_reclamacao();


-- ----------------------------------------------------------------------------
-- 3. Tabela
-- ----------------------------------------------------------------------------

create table if not exists public.pedido_reclamacoes (
  id uuid primary key default gen_random_uuid(),
  -- restrict: disputa com dinheiro nao some junto com o pedido.
  pedido_id uuid not null references public.pedidos(id) on delete restrict,
  comprador_user_id uuid not null,
  loja_id uuid not null,
  vendedor_user_id uuid not null,
  motivo text not null check (motivo in ('nao_chegou', 'diferente_do_anuncio', 'suspeita_falsificacao', 'danificado')),
  descricao text not null check (char_length(descricao) between 10 and 2000),
  -- Caminhos no bucket privado 'reclamacoes'. Nunca URL.
  fotos text[] not null default '{}',
  video_url text check (video_url is null or (char_length(video_url) <= 500 and video_url ~ '^https://')),
  -- aguardando_loja     loja tem ate prazo_loja_ate (2 dias uteis) para responder
  -- em_analise          loja respondeu; a Bynx decide ate prazo_decisao_ate
  -- aguardando_devolucao decisao 'devolucao': estorno total quando a carta voltar
  -- resolvida           estorno feito (total ou parcial)
  -- improcedente        a Bynx decidiu a favor da loja
  status text not null default 'aguardando_loja'
    check (status in ('aguardando_loja', 'em_analise', 'aguardando_devolucao', 'resolvida', 'improcedente')),
  resposta_tipo text check (resposta_tipo is null or resposta_tipo in ('aceitar', 'contraproposta', 'provas')),
  resposta_loja text check (resposta_loja is null or char_length(resposta_loja) <= 2000),
  contraproposta_cents integer check (contraproposta_cents is null or contraproposta_cents > 0),
  respondida_em timestamptz,
  prazo_loja_ate timestamptz not null,
  prazo_decisao_ate timestamptz,
  decisao text check (decisao is null or decisao in ('estorno_total', 'estorno_parcial', 'devolucao', 'improcedente')),
  decisao_nota text check (decisao_nota is null or char_length(decisao_nota) <= 2000),
  valor_estornado_cents integer not null default 0 check (valor_estornado_cents >= 0),
  stripe_refund_id text,
  decidido_por text,
  decidido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Nos 3 motivos de "chegou, mas", as 3 fotos (frente, verso, embalagem) sao
  -- obrigatorias. 'nao_chegou' nao tem o que fotografar.
  constraint pedido_reclamacoes_fotos_chk
    check (motivo = 'nao_chegou' or cardinality(fotos) >= 3),
  constraint pedido_reclamacoes_fotos_max_chk
    check (cardinality(fotos) <= 8)
);

comment on table public.pedido_reclamacoes is
  'Reclamacao de pedido de LEILAO (Protecao Bynx). Escrita so pelo servidor. Ver 20260928140000.';

-- Uma reclamacao em aberto por pedido. E a trava de corrida do "abrir".
create unique index if not exists pedido_reclamacoes_aberta_uniq
  on public.pedido_reclamacoes (pedido_id)
  where status in ('aguardando_loja', 'em_analise', 'aguardando_devolucao');

create index if not exists pedido_reclamacoes_status_idx
  on public.pedido_reclamacoes (status, created_at);
create index if not exists pedido_reclamacoes_loja_idx
  on public.pedido_reclamacoes (loja_id, created_at desc);
create index if not exists pedido_reclamacoes_comprador_idx
  on public.pedido_reclamacoes (comprador_user_id);

alter table public.pedido_reclamacoes enable row level security;

revoke all on table public.pedido_reclamacoes from public, anon, authenticated;
grant select on table public.pedido_reclamacoes to authenticated;
grant all on table public.pedido_reclamacoes to service_role;

drop policy if exists pedido_reclamacoes_select_comprador on public.pedido_reclamacoes;
create policy pedido_reclamacoes_select_comprador on public.pedido_reclamacoes
  as permissive for select to authenticated
  using (comprador_user_id = auth.uid());

drop policy if exists pedido_reclamacoes_select_loja on public.pedido_reclamacoes;
create policy pedido_reclamacoes_select_loja on public.pedido_reclamacoes
  as permissive for select to authenticated
  using (vendedor_user_id = auth.uid()
         or exists (select 1 from public.lojas l
                     where l.id = pedido_reclamacoes.loja_id and l.owner_user_id = auth.uid()));


-- ----------------------------------------------------------------------------
-- 4a. Abrir (comprador, pela rota)
-- ----------------------------------------------------------------------------
-- Os prazos em dias uteis chegam calculados pela rota (src/lib/leilao-reclamacao.ts,
-- coberto pelo autoteste): um lugar so para a regra de dia util.
-- Erros sao `raise exception '<codigo>'`; a rota traduz.

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
     and coalesce(v_ped.prazo_reclamacao_ate, coalesce(v_ped.entregue_em, v_ped.updated_at) + interval '5 days') < now() then
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

comment on function public.pedido_reclamacao_abrir(uuid, uuid, text, text, text[], text, timestamptz, timestamptz) is
  'Comprador abre reclamacao de pedido de leilao (enviado, ou entregue dentro de 5 dias). Liga pedidos.reclamacao_aberta na mesma transacao. So service_role.';


-- ----------------------------------------------------------------------------
-- 4b. Resolver (admin, pela rota, DEPOIS da Stripe)
-- ----------------------------------------------------------------------------
-- p_status: 'resolvida' | 'improcedente' | 'aguardando_devolucao'
-- A rota ja estornou na Stripe (provedor antes do banco) e passa o refund.
-- Idempotente: reclamacao ja fechada com o MESMO refund devolve 'ja_resolvida'.
-- Fechando (resolvida/improcedente): desliga a trava do pedido e soma o valor
-- estornado. O pedido so vira 'reembolsado' quando a SOMA estornada por
-- reclamacao cobre o total pago (valor_reembolsado_cents >= total_comprador_cents),
-- qualquer que seja a decisao -- o rotulo da decisao nao prova que o dinheiro
-- inteiro voltou. Estorno parcial por fora (dashboard) fica com o webhook
-- charge.refunded; o guard de status deixa quem chegar depois sem efeito.

create or replace function public.pedido_reclamacao_resolver(
  p_reclamacao uuid,
  p_status text,
  p_decisao text,
  p_valor_cents integer,
  p_refund text,
  p_por text,
  p_nota text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '3s'
as $$
declare
  v_rec public.pedido_reclamacoes%rowtype;
  v_valor integer := greatest(coalesce(p_valor_cents, 0), 0);
  v_cobre_total boolean;
begin
  if p_status not in ('resolvida', 'improcedente', 'aguardando_devolucao') then
    raise exception 'status_invalido';
  end if;
  if p_decisao not in ('estorno_total', 'estorno_parcial', 'devolucao', 'improcedente') then
    raise exception 'decisao_invalida';
  end if;

  select * into v_rec from public.pedido_reclamacoes where id = p_reclamacao for update;
  if not found then
    raise exception 'reclamacao_nao_encontrada';
  end if;

  if v_rec.status in ('resolvida', 'improcedente') then
    if v_rec.stripe_refund_id is not distinct from p_refund and v_rec.decisao = p_decisao then
      return 'ja_resolvida';
    end if;
    raise exception 'reclamacao_fechada';
  end if;
  if p_status = 'aguardando_devolucao' and v_rec.status = 'aguardando_devolucao' then
    return 'ja_aguardando_devolucao';
  end if;

  update public.pedido_reclamacoes
     set status = p_status,
         decisao = p_decisao,
         decisao_nota = coalesce(p_nota, decisao_nota),
         valor_estornado_cents = valor_estornado_cents + v_valor,
         stripe_refund_id = coalesce(p_refund, stripe_refund_id),
         decidido_por = p_por,
         decidido_em = now(),
         updated_at = now()
   where id = v_rec.id;

  if p_status in ('resolvida', 'improcedente') then
    update public.pedidos
       set reclamacao_aberta = false,
           valor_reembolsado_cents = valor_reembolsado_cents + v_valor,
           updated_at = now()
     where id = v_rec.pedido_id
    returning valor_reembolsado_cents >= total_comprador_cents into v_cobre_total;

    if v_valor > 0 and coalesce(v_cobre_total, false) then
      update public.pedidos
         set status = 'reembolsado',
             cancelado_em = now(),
             cancelado_por = 'bynx',
             cancelamento_motivo = 'Reclamacao resolvida com estorno total',
             stripe_refund_id = coalesce(stripe_refund_id, p_refund),
             updated_at = now()
       where id = v_rec.pedido_id
         and status not in ('reembolsado', 'cancelado');
    end if;
  end if;

  return p_status;
end;
$$;

comment on function public.pedido_reclamacao_resolver(uuid, text, text, integer, text, text, text) is
  'Admin fecha (resolvida/improcedente) ou manda para devolucao. Chamado DEPOIS do estorno na Stripe. Idempotente pelo refund. So service_role.';

-- ----------------------------------------------------------------------------
-- 4c. Reservar upload de foto (comprador, pela rota de upload-url)
-- ----------------------------------------------------------------------------
-- Um incremento atomico por URL emitida: `update ... where uploads < teto`.
-- Duas chamadas juntas nao passam do teto (a segunda espera a linha). A
-- contagem de arquivos no bucket nao servia: URL emitida e nao usada nao vira
-- arquivo, e um loop juntava URLs sem limite para subir tudo de uma vez.
-- Teto por pedido (o pedido tem um comprador so), vale pela vida do pedido.

create or replace function public.pedido_reclamacao_reservar_upload(
  p_pedido uuid,
  p_comprador uuid,
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
     set reclamacao_uploads = reclamacao_uploads + 1
   where id = p_pedido
     and comprador_user_id = p_comprador
     and reclamacao_uploads < greatest(coalesce(p_teto, 0), 0);
  return found;
end;
$$;

comment on function public.pedido_reclamacao_reservar_upload(uuid, uuid, integer) is
  'Conta uma URL assinada de foto de reclamacao; false = teto atingido (ou nao e o comprador). So service_role.';

revoke all on function public.pedidos_prazo_reclamacao() from public, anon, authenticated;
revoke all on function public.pedido_reclamacao_abrir(uuid, uuid, text, text, text[], text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.pedido_reclamacao_resolver(uuid, text, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.pedido_reclamacao_abrir(uuid, uuid, text, text, text[], text, timestamptz, timestamptz) to service_role;
grant execute on function public.pedido_reclamacao_resolver(uuid, text, text, integer, text, text, text) to service_role;
revoke all on function public.pedido_reclamacao_reservar_upload(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.pedido_reclamacao_reservar_upload(uuid, uuid, integer) to service_role;


-- ----------------------------------------------------------------------------
-- 5. Bucket privado
-- ----------------------------------------------------------------------------
-- Sem policy em storage.objects (ver cabecalho). 10 MB por foto; o navegador
-- comprime para webp antes (lib/comprimirImagem.ts).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reclamacoes', 'reclamacoes', false, 10485760, '{image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;
