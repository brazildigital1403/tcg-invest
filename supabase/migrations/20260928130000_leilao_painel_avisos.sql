-- ============================================================================
-- Leilao da Bynx, fatia 6: rodada cancelada AVISA quem seguia os lotes.
--
-- ★ NAO APLICADA. Depende de 20260928090000_leilao_motor.sql (leiloes,
--   leilao_seguidores, leilao_eventos), 20260928110000_leilao_avisos.sql (a
--   fila com reserva) e 20260928120000_leilao_painel.sql (a versao anterior de
--   leilao_cancelar_rodada). Sobe com o Du, depois das tres.
--
-- O que muda: SO a funcao leilao_cancelar_rodada(p_rodada, p_loja, p_motivo).
--   `create or replace` com a MESMA assinatura e o MESMO comportamento da
--   20260928120000 (travas, erros, lotes -> cancelado, rodada -> cancelada,
--   retorno com `ok` e `lotes_cancelados`) e mais um passo: para cada lote que
--   ESTA chamada cancelou, grava um evento 'cancelado' em leilao_eventos por
--   seguidor (leilao_seguidores), com user_id = seguidor, rodada_id e
--   payload { motivo }. O retorno ganha `avisos` (eventos gravados).
--   Lote que ja estava cancelado antes nao gera evento de novo.
--   Tudo na mesma transacao do cancelamento: se o cancelar falhar, nenhum
--   evento fica; se passar, nenhum aviso se perde.
--
-- ★ CONSUMIDOR: /api/cron-leilao-avisos + src/lib/leilao-avisos.ts tratam
--   'cancelado' -> SO SINO para o seguidor (user_id do evento), sem e-mail, e
--   so se o lote ainda esta 'cancelado' (planejarAvisos, testado em
--   scripts/leilao-selftest.mjs). Consumidor antigo (sem o case) so fecharia o
--   evento como 'sem_aviso' -- nao quebra, so nao avisa. Por isso o codigo sobe
--   ANTES ou JUNTO desta migration.
--
-- ★ NASCE FECHADA: security definer, search_path fixo, revoke de
--   public/anon/authenticated, execute so para service_role (o `create or
--   replace` mantem o ACL, e o revoke/grant abaixo repete por garantia).
--
-- ★ CUSTO DE IO: zero de estrutura. Nenhuma tabela, coluna ou indice novo.
--   Por chamada: os lotes da rodada pelo indice uq_leiloes_rodada_ordem e os
--   seguidores pela PK (leilao_id, user_id) de leilao_seguidores; um insert
--   por seguidor em leilao_eventos (tabela pequena). Nada toca pokemon_cards /
--   pokemon_cards_all.
--   lock_timeout de 3s no topo: o `create or replace` pega trava na funcao por
--   um instante; com fila, falha em vez de esperar. Rodar como transacao so.
--
-- ROLLBACK: reaplicar o bloco 3 (leilao_cancelar_rodada) de
--   20260928120000_leilao_painel.sql -- a versao anterior, sem os eventos.
--   Eventos 'cancelado' ja gravados ficam na fila (o consumidor fecha).
--   Para descartar os pendentes:
--     update public.leilao_eventos set processado_em = now()
--      where tipo = 'cancelado' and processado_em is null;
-- ============================================================================

set local lock_timeout = '3s';

create or replace function public.leilao_cancelar_rodada(
  p_rodada uuid,
  p_loja uuid,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '3s'
as $$
declare
  v_status  text;
  v_n       integer;
  v_ids     uuid[];
  v_motivo  text;
  v_avisos  integer := 0;
begin
  select status into v_status
  from public.leilao_rodadas
  where id = p_rodada and loja_id = p_loja
  for update;
  if not found then
    raise exception 'rodada_nao_encontrada';
  end if;
  if v_status in ('encerrada', 'cancelada') then
    raise exception 'rodada_fechada';
  end if;

  perform 1 from public.leiloes where rodada_id = p_rodada for update;

  if exists (select 1 from public.leiloes
             where rodada_id = p_rodada
               and (status not in ('rascunho', 'agendado', 'cancelado')
                    or encerrado_em is not null)) then
    raise exception 'lote_ja_abriu';
  end if;

  v_motivo := coalesce(nullif(left(btrim(coalesce(p_motivo, '')), 300), ''), 'rodada_cancelada_pela_loja');

  with cancelados as (
    update public.leiloes
       set status = 'cancelado',
           cancelado_motivo = v_motivo,
           versao = versao + 1
     where rodada_id = p_rodada and status in ('rascunho', 'agendado')
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from cancelados;
  v_n := coalesce(array_length(v_ids, 1), 0);

  -- Um aviso por seguidor de cada lote que ESTA chamada cancelou.
  if v_n > 0 then
    insert into public.leilao_eventos (leilao_id, rodada_id, tipo, user_id, payload)
    select s.leilao_id, p_rodada, 'cancelado', s.user_id, jsonb_build_object('motivo', v_motivo)
      from public.leilao_seguidores s
     where s.leilao_id = any(v_ids);
    get diagnostics v_avisos = row_count;
  end if;

  update public.leilao_rodadas set status = 'cancelada' where id = p_rodada;

  return jsonb_build_object('ok', true, 'lotes_cancelados', v_n, 'avisos', v_avisos);
end;
$$;

comment on function public.leilao_cancelar_rodada(uuid, uuid, text) is
  'Painel da loja: cancela a rodada e os lotes, so se nenhum lote abriu, e grava um evento cancelado por seguidor de cada lote cancelado (sino, sem e-mail). So service_role.';

revoke all on function public.leilao_cancelar_rodada(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.leilao_cancelar_rodada(uuid, uuid, text) to service_role;
