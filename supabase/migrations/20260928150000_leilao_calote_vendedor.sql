-- ============================================================================
-- Leilao da Bynx: CALOTE SO QUANDO A FALHA E DO COMPRADOR.
--
-- ★ NAO APLICADA EM PRODUCAO. Depende de 20260928090000_leilao_motor.sql e de
--   20260924210000_connect_no_usuario.sql (users.stripe_connect_*). Sobe com o
--   Du, junto das outras fatias do leilao.
--
-- O PROBLEMA (05/10): a loja so agenda rodada com recebimento ativo, mas a
-- conta pode ser restrita depois. Ai o comprador abre /pagar, nao consegue
-- pagar, e no fim do prazo o tick marcava 'calote' CONTRA ELE -- e o e-mail da
-- loja dizia "o vencedor nao pagou".
--
-- O QUE NASCE:
--   1. leiloes.bloqueio_vendedor_em: quando o vencedor tentou pagar e o
--      vendedor nao podia receber. Sem GRANT de coluna (a leitura publica de
--      leiloes enumera colunas), entao nao vaza.
--   2. leilao_vendedor_recebe(vendedor): espelho em SQL do podeVender de
--      src/app/api/leiloes/[id]/checkout/route.ts (resolverRecebedor em
--      src/lib/vendedorRecebimento.ts): loja ativa mais antiga do dono, conta
--      da loja se existir, senao a da pessoa, cobranca ligada e CEP de origem
--      quando o frete e calculado. ★ Se a regra do TS mudar, mudar aqui.
--   3. leilao_registrar_bloqueio(lote): chamada pela rota do checkout quando o
--      vencedor ve a tela de espera. Grava a hora UMA vez e enfileira o evento
--      'pagamento_bloqueado' (aviso ao vendedor: sino + e-mail, ainda dentro
--      do prazo, para dar tempo de salvar a venda).
--   4. leilao_tick, passo 5: com bloqueio registrado OU vendedor que ainda nao
--      recebe, o lote vira 'cancelado' (motivo 'vendedor_sem_recebimento',
--      evento 'cancelado_vendedor'). Se a loja resolveu e o comprador nao voltou
--      para pagar, segue sendo calote. O resto do tick e identico ao original.
--
-- ROLLBACK: reaplicar leilao_tick de 20260928090000_leilao_motor.sql e
--   drop function leilao_registrar_bloqueio(uuid), leilao_vendedor_recebe(uuid);
--   alter table leiloes drop column bloqueio_vendedor_em.
-- ============================================================================

set local lock_timeout = '3s';

alter table public.leiloes
  add column if not exists bloqueio_vendedor_em timestamptz;

comment on column public.leiloes.bloqueio_vendedor_em is
  'Quando o vencedor tentou pagar e o vendedor nao podia receber (gravado por leilao_registrar_bloqueio). No fim do prazo, lote com bloqueio vira cancelado, nao calote.';

create or replace function public.leilao_vendedor_recebe(p_vendedor uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with u as (
    select stripe_connect_account_id, connect_charges_enabled, cep
      from public.users where id = p_vendedor
  ), l as (
    select true as existe, stripe_connect_account_id, connect_charges_enabled, cep, frete_modo
      from public.lojas
     where owner_user_id = p_vendedor and status = 'ativa'
     order by created_at asc
     limit 1
  )
  select coalesce((
    select case
      when l.stripe_connect_account_id is not null then
        coalesce(l.connect_charges_enabled, false)
        and (coalesce(l.frete_modo, 'fixo') <> 'calculado'
             or regexp_replace(coalesce(nullif(l.cep, ''), u.cep, ''), '\D', '', 'g') ~ '^[0-9]{8}$')
      when l.existe then
        u.stripe_connect_account_id is not null
        and coalesce(u.connect_charges_enabled, false)
        and (l.frete_modo <> 'calculado'
             or regexp_replace(coalesce(nullif(l.cep, ''), u.cep, ''), '\D', '', 'g') ~ '^[0-9]{8}$')
      else
        u.stripe_connect_account_id is not null
        and coalesce(u.connect_charges_enabled, false)
        and regexp_replace(coalesce(u.cep, ''), '\D', '', 'g') ~ '^[0-9]{8}$'
    end
    from u left join l on true
  ), false);
$$;

comment on function public.leilao_vendedor_recebe(uuid) is
  'O vendedor pode receber um arremate agora? Espelho do podeVender do checkout (loja ativa mais antiga do dono, conta da loja ou da pessoa, cobranca ligada, CEP quando o frete e calculado). So service_role.';

create or replace function public.leilao_registrar_bloqueio(p_leilao uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '2s'
as $$
declare
  v_lider uuid;
begin
  update public.leiloes
     set bloqueio_vendedor_em = now()
   where id = p_leilao
     and status = 'aguardando_pagamento'
     and bloqueio_vendedor_em is null
  returning lider_user_id into v_lider;
  if not found then
    return false;
  end if;
  insert into public.leilao_eventos (leilao_id, tipo, user_id, payload)
  values (p_leilao, 'pagamento_bloqueado', v_lider, '{}'::jsonb);
  return true;
end;
$$;

comment on function public.leilao_registrar_bloqueio(uuid) is
  'Vencedor viu a tela de espera porque o vendedor nao recebe: grava bloqueio_vendedor_em uma vez e enfileira pagamento_bloqueado (aviso ao vendedor). Devolve true so na primeira vez. So service_role.';

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
  v_cancelados_vendedor integer := 0;
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
  --    proximo tick reavalia. Checkout so conta ate pagar_ate + 30 min (a
  --    sessao expira no maximo em pagar_ate + 14 min); pedido pago, sempre.
  --    ★ 20260928150000: se a falha foi da LOJA (o comprador tentou pagar e o
  --    recebimento estava bloqueado -- bloqueio_vendedor_em -- ou a loja ainda
  --    nao pode receber agora), o lote vira 'cancelado' com motivo
  --    'vendedor_sem_recebimento' e evento 'cancelado_vendedor'. Calote fica
  --    so para quem podia pagar e nao pagou.
  for r in
    select l.id, l.lider_user_id, l.pedido_id, l.pagar_ate,
           l.vendedor_user_id, l.bloqueio_vendedor_em
      from public.leiloes l
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
                      and p.cancelado_em is null
                      and now() < r.pagar_ate + interval '30 minutes')))
         or exists (
           select 1 from public.pedido_itens i
           join public.pedidos p on p.id = i.pedido_id
           where i.leilao_id = r.id
             and (p.pago_em is not null
                  or p.status in ('pago', 'enviado', 'entregue')
                  or (p.stripe_session_id is not null
                      and p.status not in ('cancelado', 'reembolsado')
                      and p.cancelado_em is null
                      and now() < r.pagar_ate + interval '30 minutes'))) then
        v_calotes_adiados := v_calotes_adiados + 1;
      elsif r.bloqueio_vendedor_em is not null
            or not public.leilao_vendedor_recebe(r.vendedor_user_id) then
        update public.leiloes
           set status = 'cancelado',
               cancelado_motivo = 'vendedor_sem_recebimento',
               versao = versao + 1
         where id = r.id;
        insert into public.leilao_eventos (leilao_id, tipo, user_id, payload)
        values (r.id, 'cancelado_vendedor', r.lider_user_id,
                jsonb_build_object('bloqueio_vendedor_em', r.bloqueio_vendedor_em));
        v_cancelados_vendedor := v_cancelados_vendedor + 1;
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
    'cancelados_vendedor', v_cancelados_vendedor,
    'erros', v_erros,
    'em', now()
  );
end;
$$;

comment on function public.leilao_tick() is
  'Relogio do leilao (pg_cron): ativa agendados, fecha vencidos (folga 1s), avanca rodada ao vivo e, apos pagar_ate + 15 min sem pedido pago nem checkout em andamento, marca calote -- ou cancela (vendedor_sem_recebimento) quando o vendedor estava bloqueado. Erro por lote/rodada vira evento erro_tick. So postgres/service_role.';

revoke all on function public.leilao_vendedor_recebe(uuid)    from public, anon, authenticated;
revoke all on function public.leilao_registrar_bloqueio(uuid) from public, anon, authenticated;
revoke all on function public.leilao_tick()                   from public, anon, authenticated;
grant execute on function public.leilao_vendedor_recebe(uuid)    to service_role;
grant execute on function public.leilao_registrar_bloqueio(uuid) to service_role;
grant execute on function public.leilao_tick()                   to service_role;
