-- ============================================================================
-- Loja encerra uma rodada que ja esta ao vivo (#416, opcao a do Du, 28/10)
-- ============================================================================
-- POR QUE: leilao_cancelar_rodada recusa depois que um lote abriu
-- ('lote_ja_abriu'). Se a live cair, os lotes seguintes continuavam abrindo
-- sem ninguem assistindo.
--
-- REGRA: o lote ATIVO termina no tempo dele, com o vencedor que tiver (lance
-- valido nao e anulado). Os lotes AGENDADOS da rodada sao cancelados, com o
-- mesmo aviso aos seguidores do cancelamento comum. Quando o lote ativo fecha,
-- leilao_fechar_lote nao acha proximo e encerra a rodada sozinho. Sem lote
-- ativo (entre um lote e outro), a rodada ja fica 'encerrada' aqui.
--
-- Rollback: drop function if exists public.leilao_encerrar_rodada(uuid, uuid, text);
-- ============================================================================

create or replace function public.leilao_encerrar_rodada(
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
  v_ids     uuid[];
  v_n       integer;
  v_motivo  text;
  v_avisos  integer := 0;
  v_ativo   boolean;
begin
  select status into v_status
  from public.leilao_rodadas
  where id = p_rodada and loja_id = p_loja
  for update;
  if not found then
    raise exception 'rodada_nao_encontrada';
  end if;
  if v_status <> 'ao_vivo' then
    raise exception 'rodada_nao_esta_ao_vivo';
  end if;

  perform 1 from public.leiloes where rodada_id = p_rodada for update;

  v_motivo := coalesce(nullif(left(btrim(coalesce(p_motivo, '')), 300), ''), 'rodada_encerrada_pela_loja');

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

  if v_n > 0 then
    insert into public.leilao_eventos (leilao_id, rodada_id, tipo, user_id, payload)
    select s.leilao_id, p_rodada, 'cancelado', s.user_id, jsonb_build_object('motivo', v_motivo)
      from public.leilao_seguidores s
     where s.leilao_id = any(v_ids);
    get diagnostics v_avisos = row_count;
  end if;

  select exists (select 1 from public.leiloes where rodada_id = p_rodada and status = 'ativo') into v_ativo;
  if not v_ativo then
    update public.leilao_rodadas set status = 'encerrada' where id = p_rodada;
  end if;

  return jsonb_build_object('cancelados', v_n, 'avisos', v_avisos, 'lote_ativo_termina', v_ativo);
end
$$;

revoke all on function public.leilao_encerrar_rodada(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.leilao_encerrar_rodada(uuid, uuid, text) to service_role;
