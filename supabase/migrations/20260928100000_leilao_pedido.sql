-- ============================================================================
-- Leilao da Bynx, fatia 2: o ARREMATE vira PEDIDO.
--
-- ★ NAO APLICADA. Depende de 20260928090000_leilao_motor.sql (colunas
--   pedidos.leilao_id / pedido_itens.leilao_id e a tabela leiloes). Sobe com o
--   Du, depois do motor.
--
-- O que muda:
--
--   1. pedido_itens_origem_chk passa a aceitar item de LEILAO.
--      Hoje: num_nonnulls(marketplace_id, produto_id) = 1. Um lote arrematado
--      nao e anuncio nem produto, entao o insert do item de leilao seria
--      recusado. Novo: num_nonnulls(marketplace_id, produto_id, leilao_id) = 1
--      -- continua exigindo EXATAMENTE uma origem por item. Todas as linhas de
--      hoje tem leilao_id null e uma das duas outras, entao validam igual.
--
--   2. UM checkout aberto por lote (indice unico parcial).
--      pedidos(leilao_id) where status = 'aguardando_pagamento'. E a trava de
--      corrida da rota POST /api/leiloes/[id]/checkout: dois cliques/abas ao
--      mesmo tempo nao criam dois pedidos abertos para o mesmo lote -- o
--      segundo insert bate 23505 e a rota devolve a sessao do primeiro.
--      Nao impede o historico (pedido cancelado + pedido novo do mesmo lote,
--      ou o do segundo colocado apos calote, que o motor preve).
--
--   3. leilao_marcar_vendido(p_leilao, p_pedido) -> text
--      Chamada pelo webhook em checkout.session.completed. Atomica, sob
--      `for update` na linha do lote:
--        aguardando_pagamento | calote  -> vendido, pedido_id, versao + 1,
--                                          evento 'pago' (ja processado)
--      ★ 'calote' volta para 'vendido': pagamento que chega depois do calote
--        (pendencia registrada no motor) nao pode ser descartado.
--      Idempotente: lote ja vendido por ESTE pedido devolve 'ja_vendido' e nao
--      mexe em nada (a Stripe re-entrega evento). Confere que o pedido e do
--      lote e esta pago; qualquer outro caso devolve o motivo e nao muda nada
--      (o webhook loga para o Du conferir).
--
--   4. leilao_marcar_reembolsado(p_leilao, p_pedido) -> text
--      Chamada pelo webhook em charge.refunded INTEGRAL (cobre o estorno pelo
--      painel da Stripe e o cancelamento pela loja, que gera o mesmo evento).
--        vendido com pedido_id = p_pedido -> cancelado,
--                                           cancelado_motivo = 'reembolsado',
--                                           versao + 1, evento 'reembolsado'
--      So mexe se o pedido reembolsado e o que VENDEU o lote: estorno de um
--      pedido antigo nao derruba o lote vendido por outro. Idempotente.
--
-- ★ Nenhuma das duas tem EXECUTE para anon/authenticated: so service_role (o
--   webhook). security definer + search_path fixo, padrao do motor.
--
-- ★ CUSTO DE IO: praticamente zero. pedidos/pedido_itens sao tabelas pequenas
--   (centenas de linhas). O `add constraint` valida pedido_itens inteira e o
--   `create unique index` le pedidos inteira -- ambos em milissegundos neste
--   tamanho. Nada toca pokemon_cards / pokemon_cards_all.
--   ★ O `drop constraint` + `add constraint` pegam ACCESS EXCLUSIVE em
--   pedido_itens por um instante (tabela pequena, sem fila esperada).
--
-- ROLLBACK (nesta ordem):
--   drop function if exists public.leilao_marcar_reembolsado(uuid, uuid);
--   drop function if exists public.leilao_marcar_vendido(uuid, uuid);
--   drop index if exists public.pedidos_leilao_aberto_uniq;
--   alter table public.pedido_itens drop constraint if exists pedido_itens_origem_chk;
--   alter table public.pedido_itens add constraint pedido_itens_origem_chk
--     check (num_nonnulls(marketplace_id, produto_id) = 1);
--   (o ultimo passo FALHA se ja existir item de leilao: apagar/ajustar antes)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Item de leilao em pedido_itens
-- ----------------------------------------------------------------------------

alter table public.pedido_itens drop constraint if exists pedido_itens_origem_chk;
alter table public.pedido_itens add constraint pedido_itens_origem_chk
  check (num_nonnulls(marketplace_id, produto_id, leilao_id) = 1);


-- ----------------------------------------------------------------------------
-- 2. Um checkout aberto por lote
-- ----------------------------------------------------------------------------

create unique index if not exists pedidos_leilao_aberto_uniq
  on public.pedidos (leilao_id)
  where leilao_id is not null and status = 'aguardando_pagamento';


-- ----------------------------------------------------------------------------
-- 3. Pagamento confirmado -> lote vendido
-- ----------------------------------------------------------------------------

create or replace function public.leilao_marcar_vendido(p_leilao uuid, p_pedido uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status    text;
  v_pedido_at uuid;
  v_comprador uuid;
begin
  if p_leilao is null or p_pedido is null then
    return 'parametro_invalido';
  end if;

  select l.status, l.pedido_id into v_status, v_pedido_at
    from public.leiloes l
   where l.id = p_leilao
   for update;
  if not found then
    return 'nao_encontrado';
  end if;

  if v_status = 'vendido' then
    return case when v_pedido_at = p_pedido then 'ja_vendido' else 'vendido_por_outro_pedido' end;
  end if;
  if v_status not in ('aguardando_pagamento', 'calote') then
    return 'ignorado:' || v_status;
  end if;

  -- O pedido tem de ser deste lote (pelo atalho ou pelo item) e estar pago.
  select p.comprador_user_id into v_comprador
    from public.pedidos p
   where p.id = p_pedido
     and p.status in ('pago', 'enviado', 'entregue')
     and (p.leilao_id = p_leilao
          or exists (select 1 from public.pedido_itens i
                      where i.pedido_id = p.id and i.leilao_id = p_leilao));
  if not found then
    return 'pedido_invalido';
  end if;

  update public.leiloes
     set status = 'vendido', pedido_id = p_pedido, versao = versao + 1
   where id = p_leilao;

  insert into public.leilao_eventos (leilao_id, tipo, user_id, payload, processado_em)
  values (p_leilao, 'pago', v_comprador,
          jsonb_build_object('pedido_id', p_pedido, 'de', v_status), now());

  return 'vendido';
end;
$$;

comment on function public.leilao_marcar_vendido(uuid, uuid) is
  'Webhook (checkout.session.completed): aguardando_pagamento|calote -> vendido + pedido_id. Idempotente (ja_vendido). Confere que o pedido e do lote e esta pago. So service_role.';


-- ----------------------------------------------------------------------------
-- 4. Estorno integral -> lote cancelado ('reembolsado')
-- ----------------------------------------------------------------------------

create or replace function public.leilao_marcar_reembolsado(p_leilao uuid, p_pedido uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status    text;
  v_pedido_at uuid;
begin
  if p_leilao is null or p_pedido is null then
    return 'parametro_invalido';
  end if;

  select l.status, l.pedido_id into v_status, v_pedido_at
    from public.leiloes l
   where l.id = p_leilao
   for update;
  if not found then
    return 'nao_encontrado';
  end if;

  if v_status = 'cancelado' then
    return 'ja_cancelado';
  end if;
  if v_status <> 'vendido' then
    return 'ignorado:' || v_status;
  end if;
  if v_pedido_at is distinct from p_pedido then
    return 'outro_pedido';
  end if;

  update public.leiloes
     set status = 'cancelado', cancelado_motivo = 'reembolsado', versao = versao + 1
   where id = p_leilao;

  insert into public.leilao_eventos (leilao_id, tipo, payload, processado_em)
  values (p_leilao, 'reembolsado', jsonb_build_object('pedido_id', p_pedido), now());

  return 'cancelado';
end;
$$;

comment on function public.leilao_marcar_reembolsado(uuid, uuid) is
  'Webhook (charge.refunded integral): vendido pelo pedido p_pedido -> cancelado, cancelado_motivo=reembolsado. Idempotente. So service_role.';


-- ----------------------------------------------------------------------------
-- 5. Grants de funcao
-- ----------------------------------------------------------------------------

revoke all on function public.leilao_marcar_vendido(uuid, uuid)     from public, anon, authenticated;
revoke all on function public.leilao_marcar_reembolsado(uuid, uuid) from public, anon, authenticated;
grant execute on function public.leilao_marcar_vendido(uuid, uuid)     to service_role;
grant execute on function public.leilao_marcar_reembolsado(uuid, uuid) to service_role;
