-- ============================================================================
-- Leilao da Bynx, fatia 3: AVISOS (consumo da fila leilao_eventos).
--
-- ★ NAO APLICADA. Depende de 20260928090000_leilao_motor.sql. Sobe com o Du,
--   depois do motor e do pedido. O consumidor e a rota
--   /api/cron-leilao-avisos (o agendamento dela tambem e decisao do Du).
--
-- O problema: a fila tem `processado_em null = pendente`. Se o consumidor
-- marca processado ANTES de avisar e cai no meio, o aviso se perde. Se marca
-- DEPOIS e duas execucoes rodam juntas, o mesmo aviso sai duas vezes. Nenhuma
-- das duas serve para "voce venceu, pague ate...".
--
-- A solucao: RESERVA COM PRAZO (lease) + conclusao por evento.
--
--   1. leilao_eventos_reservar(p_limite, p_reserva_seg) -> linhas
--      `for update skip locked` nos pendentes livres (processado_em null e
--      reserva vencida ou inexistente), por ordem de id. Grava um token de
--      reserva (uuid), `reservado_ate = now() + p_reserva_seg` e soma 1 em
--      `tentativas`. Duas execucoes concorrentes nunca pegam o mesmo evento:
--      o skip locked separa quem chega junto, e o prazo separa quem chega
--      depois. Se a rota morrer (timeout, deploy), a reserva vence e o evento
--      volta sozinho para a fila -- nao se perde.
--      Devolve tambem `ultimo_email_superado_em`: o ultimo e-mail de
--      'superado' ja enviado para o mesmo usuario + lote (debounce de 10 min).
--
--   2. leilao_eventos_concluir(p_reserva, p_itens jsonb) -> jsonb
--      Um item por evento: { id, sinos: [...], email_ok, finalizar, liberar, erro }.
--      So age em evento que AINDA esta reservado por este token (reserva vencida
--      e pega por outra execucao = item ignorado e contado em `perdidos`).
--        - sinos: inserts em notifications NA MESMA TRANSACAO que grava
--          `sino_em`. Sino e exatamente-uma-vez: se `sino_em` ja esta
--          preenchido (tentativa anterior), nao insere de novo.
--        - email_ok: grava `email_em` (retry nao reenvia e-mail ja enviado).
--        - finalizar: processado_em = now(). Fim do evento.
--        - liberar: devolve para a fila sem contar tentativa (rota sem tempo).
--        - nenhum dos dois: FALHA. Volta para a fila com espera crescente
--          (tentativas^2 minutos) e `ultimo_erro`. Na 5a tentativa desiste:
--          processado_em = now() com `ultimo_erro = 'desistiu: ...'`.
--          Monitoria: `where ultimo_erro like 'desistiu:%'`.
--
-- ★ A JANELA QUE SOBRA: e-mail aceito pelo Resend e a chamada de concluir
--   falhar (rede) antes de gravar `email_em`. A reserva vence e o e-mail sai de
--   novo. E a unica duplicata possivel, e exige duas falhas seguidas em
--   segundos. O contrario (perder o aviso) nao acontece.
--
-- ★ Por que o sino e gravado AQUI e nao pelo notify() da rota: e o que deixa
--   sino + marca na mesma transacao. notify() seguido de update seria duas
--   escritas, e a queda entre elas duplicaria o sino no retry.
--   So insere para usuario que existe em auth.users (FK de notifications):
--   usuario apagado nao pode travar a fila com erro de FK.
--
-- ★ NASCE FECHADA: as duas funcoes sao security definer, search_path fixo,
--   EXECUTE so para service_role (a rota do cron). Colunas novas em
--   leilao_eventos herdam o fechamento da tabela (RLS ligada, sem grant para
--   anon/authenticated).
--
-- ★ CUSTO DE IO: praticamente zero. leilao_eventos e tabela nova e pequena.
--   Os `add column` sao nullable ou com default constante (so catalogo, nao
--   reescreve a tabela). Os dois indices sao parciais em tabela pequena.
--   Nada toca pokemon_cards / pokemon_cards_all. notifications recebe insert
--   por linha (sem varredura).
--   lock_timeout de 3s no topo: `alter table` pega ACCESS EXCLUSIVE em
--   leilao_eventos por um instante; com fila (tick/dar_lance gravando evento),
--   falha em vez de enfileirar o lance atras dela. Rodar a migration como uma
--   transacao so (`set local`).
--
-- ROLLBACK (nesta ordem):
--   drop function if exists public.leilao_eventos_concluir(uuid, jsonb);
--   drop function if exists public.leilao_eventos_reservar(integer, integer);
--   drop index if exists public.idx_leilao_eventos_fila;
--   drop index if exists public.idx_leilao_eventos_superado_email;
--   alter table public.leilao_eventos
--     drop column if exists tentativas, drop column if exists reserva,
--     drop column if exists reservado_ate, drop column if exists sino_em,
--     drop column if exists email_em, drop column if exists ultimo_erro;
--   (notificacoes ja gravadas com type = 'leilao' ficam; sao do usuario)
-- ============================================================================

set local lock_timeout = '3s';


-- ----------------------------------------------------------------------------
-- 1. Colunas de controle da fila
-- ----------------------------------------------------------------------------

alter table public.leilao_eventos
  add column if not exists tentativas    smallint not null default 0,
  add column if not exists reserva       uuid,
  add column if not exists reservado_ate timestamptz,
  add column if not exists sino_em       timestamptz,
  add column if not exists email_em      timestamptz,
  add column if not exists ultimo_erro   text;

comment on column public.leilao_eventos.reserva is
  'Token da execucao do consumidor que reservou o evento. So ela conclui.';
comment on column public.leilao_eventos.reservado_ate is
  'Fim da reserva. Vencida = evento volta para a fila (consumidor caiu).';
comment on column public.leilao_eventos.sino_em is
  'Quando o sino do evento foi gravado. Preenchido = retry nao grava de novo.';
comment on column public.leilao_eventos.email_em is
  'Quando o e-mail do evento foi aceito pelo provedor. Base do debounce de superado.';
comment on column public.leilao_eventos.ultimo_erro is
  'Ultima falha do consumidor. desistiu:... = abandonado apos 5 tentativas.';


-- ----------------------------------------------------------------------------
-- 2. Indices (parciais, tabela pequena)
-- ----------------------------------------------------------------------------

-- Fila por id (a reserva ordena por id; o indice antigo e por created_at).
create index if not exists idx_leilao_eventos_fila
  on public.leilao_eventos (id) where processado_em is null;

-- Debounce: ultimo e-mail de superado por lote + usuario.
create index if not exists idx_leilao_eventos_superado_email
  on public.leilao_eventos (leilao_id, user_id, email_em)
  where tipo = 'superado' and email_em is not null;


-- ----------------------------------------------------------------------------
-- 3. Reserva atomica
-- ----------------------------------------------------------------------------

create or replace function public.leilao_eventos_reservar(p_limite integer default 100,
                                                          p_reserva_seg integer default 120)
returns table (
  id bigint,
  leilao_id uuid,
  rodada_id uuid,
  tipo text,
  user_id uuid,
  payload jsonb,
  created_at timestamptz,
  tentativas smallint,
  reserva uuid,
  sino_em timestamptz,
  email_em timestamptz,
  ultimo_email_superado_em timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '2s'
as $$
#variable_conflict use_column
declare
  v_token uuid := gen_random_uuid();
  v_lim   integer := greatest(1, least(coalesce(p_limite, 100), 500));
  v_seg   integer := greatest(30, least(coalesce(p_reserva_seg, 120), 900));
begin
  return query
  with alvo as (
    select e.id
      from public.leilao_eventos e
     where e.processado_em is null
       and (e.reservado_ate is null or e.reservado_ate < now())
     order by e.id
     limit v_lim
     for update skip locked
  ), reservados as (
    update public.leilao_eventos e
       set reserva       = v_token,
           reservado_ate = now() + make_interval(secs => v_seg),
           tentativas    = e.tentativas + 1
      from alvo
     where e.id = alvo.id
    returning e.*
  )
  select r.id, r.leilao_id, r.rodada_id, r.tipo, r.user_id, r.payload, r.created_at,
         r.tentativas, r.reserva, r.sino_em, r.email_em,
         (select max(s.email_em)
            from public.leilao_eventos s
           where r.tipo = 'superado'
             and s.tipo = 'superado'
             and s.leilao_id = r.leilao_id
             and s.user_id = r.user_id
             and s.email_em is not null)
    from reservados r
   order by r.id;
end;
$$;

comment on function public.leilao_eventos_reservar(integer, integer) is
  'Consumidor de avisos: reserva ate p_limite (1-500) eventos pendentes livres por p_reserva_seg (30-900s), skip locked, tentativas + 1. Mesmo token em todas as linhas. So service_role.';


-- ----------------------------------------------------------------------------
-- 4. Conclusao por evento (sino atomico, e-mail marcado, falha com espera)
-- ----------------------------------------------------------------------------

create or replace function public.leilao_eventos_concluir(p_reserva uuid, p_itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '2s'
as $$
declare
  v_item      jsonb;
  v_sino      jsonb;
  v_ev        public.leilao_eventos%rowtype;
  v_id        bigint;
  v_erro      text;
  v_final     int := 0;
  v_falhas    int := 0;
  v_desist    int := 0;
  v_liberados int := 0;
  v_perdidos  int := 0;
  v_sinos     int := 0;
  v_n         int;
begin
  if p_reserva is null or p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception 'parametro_invalido';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    v_id := nullif(v_item->>'id', '')::bigint;

    select * into v_ev
      from public.leilao_eventos e
     where e.id = v_id
       and e.reserva = p_reserva
       and e.processado_em is null
     for update;
    if not found then
      v_perdidos := v_perdidos + 1;
      continue;
    end if;

    -- Sino: exatamente uma vez por evento.
    if v_ev.sino_em is null
       and jsonb_typeof(v_item->'sinos') = 'array'
       and jsonb_array_length(v_item->'sinos') > 0 then
      for v_sino in select value from jsonb_array_elements(v_item->'sinos') loop
        insert into public.notifications (user_id, type, title, message, read, data)
        select u.id, 'leilao', left(v_sino->>'title', 200), left(v_sino->>'message', 1000),
               false, coalesce(v_sino->'data', '{}'::jsonb)
          from auth.users u
         where u.id = nullif(v_sino->>'user_id', '')::uuid
           and coalesce(v_sino->>'title', '') <> '';
        get diagnostics v_n = row_count;
        v_sinos := v_sinos + v_n;
      end loop;
      update public.leilao_eventos set sino_em = now() where id = v_id;
    end if;

    if coalesce((v_item->>'email_ok')::boolean, false) then
      update public.leilao_eventos set email_em = coalesce(email_em, now()) where id = v_id;
    end if;

    v_erro := left(nullif(v_item->>'erro', ''), 500);

    if coalesce((v_item->>'finalizar')::boolean, false) then
      update public.leilao_eventos
         set processado_em = now(), reserva = null, reservado_ate = null,
             ultimo_erro = coalesce(v_erro, ultimo_erro)
       where id = v_id;
      v_final := v_final + 1;
    elsif coalesce((v_item->>'liberar')::boolean, false) then
      -- Rota sem tempo: volta para a fila sem gastar tentativa.
      update public.leilao_eventos
         set reserva = null, reservado_ate = null,
             tentativas = greatest(tentativas - 1, 0)
       where id = v_id;
      v_liberados := v_liberados + 1;
    elsif v_ev.tentativas >= 5 then
      update public.leilao_eventos
         set processado_em = now(), reserva = null, reservado_ate = null,
             ultimo_erro = 'desistiu: ' || coalesce(v_erro, 'sem detalhe')
       where id = v_id;
      v_desist := v_desist + 1;
    else
      update public.leilao_eventos
         set reserva = null,
             reservado_ate = now() + make_interval(mins => v_ev.tentativas * v_ev.tentativas),
             ultimo_erro = coalesce(v_erro, 'falha sem detalhe')
       where id = v_id;
      v_falhas := v_falhas + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'finalizados', v_final,
    'falhas', v_falhas,
    'desistidos', v_desist,
    'liberados', v_liberados,
    'perdidos', v_perdidos,
    'sinos', v_sinos
  );
end;
$$;

comment on function public.leilao_eventos_concluir(uuid, jsonb) is
  'Consumidor de avisos: por evento reservado por p_reserva grava sinos (uma vez, type leilao), marca email_em, finaliza, libera ou registra falha (espera tentativas^2 min; desiste na 5a). So service_role.';


-- ----------------------------------------------------------------------------
-- 5. Grants de funcao
-- ----------------------------------------------------------------------------

revoke all on function public.leilao_eventos_reservar(integer, integer) from public, anon, authenticated;
revoke all on function public.leilao_eventos_concluir(uuid, jsonb)      from public, anon, authenticated;
grant execute on function public.leilao_eventos_reservar(integer, integer) to service_role;
grant execute on function public.leilao_eventos_concluir(uuid, jsonb)      to service_role;
