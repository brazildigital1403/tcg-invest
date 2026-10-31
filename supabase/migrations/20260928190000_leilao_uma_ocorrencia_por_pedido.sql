-- ============================================================================
-- Uma ocorrencia por pedido (decisao do Du, 20/10/2026)
-- ============================================================================
-- POR QUE: o indice unico pedido_reclamacoes_aberta_uniq so impedia DUAS
-- ocorrencias ABERTAS. Encerrada a primeira, o comprador abria outra dentro
-- dos 7 dias: desistia de novo depois de um estorno parcial (e o cron
-- estornava o resto sozinho se a loja calasse) ou reabria um improcedente.
-- Agora cada pedido aceita UMA reclamacao ou desistencia, aberta ou encerrada.
--
-- COMO: gatilho BEFORE INSERT, e nao indice unico em pedido_id, porque a
-- branch de prova tem um pedido de teste (#21) com duas linhas antigas e o
-- indice nao criaria. O erro sai como unique_violation, que as duas funcoes
-- de abrir (pedido_reclamacao_abrir e pedido_arrependimento_abrir) ja
-- traduzem para 'ja_existe' -- nenhuma delas precisa mudar. Advisory lock
-- por pedido fecha a corrida de dois inserts simultaneos.
-- Espelho no TS: podeReclamar/podeDesistir (teve_ocorrencia) e
-- teveOcorrencia em reclamacaoServer.
--
-- Rollback:
--   drop trigger if exists pedido_reclamacoes_uma_por_pedido on public.pedido_reclamacoes;
--   drop function if exists public.pedido_reclamacoes_uma_por_pedido();
-- ============================================================================

create or replace function public.pedido_reclamacoes_uma_por_pedido()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('pedido_reclamacao:' || new.pedido_id::text, 0));
  if exists (select 1 from public.pedido_reclamacoes where pedido_id = new.pedido_id) then
    raise exception using errcode = 'unique_violation', message = 'uma_ocorrencia_por_pedido';
  end if;
  return new;
end
$$;

revoke all on function public.pedido_reclamacoes_uma_por_pedido() from public, anon, authenticated;

drop trigger if exists pedido_reclamacoes_uma_por_pedido on public.pedido_reclamacoes;
create trigger pedido_reclamacoes_uma_por_pedido
  before insert on public.pedido_reclamacoes
  for each row execute function public.pedido_reclamacoes_uma_por_pedido();
