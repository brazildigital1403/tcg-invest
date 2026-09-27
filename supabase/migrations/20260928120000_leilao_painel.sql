-- ============================================================================
-- Leilao da Bynx, fatia 5: o PAINEL DA LOJA monta a rodada ao vivo.
--
-- ★ NAO APLICADA. Depende de 20260928090000_leilao_motor.sql (leilao_rodadas,
--   leiloes, uq_leiloes_rodada_ordem, trigger leilao_valida_lote). Sobe com o
--   Du, depois do motor.
--
-- Tres RPCs chamadas SO pelas rotas /api/lojas/[id]/leiloes/[rodadaId] com
-- service_role, depois de a rota conferir o dono da loja. Todas recebem
-- `p_loja` e so acham a rodada se ela for DAQUELA loja: o id da rodada vindo
-- da URL nunca alcanca rodada de outra loja, mesmo com bug na rota.
--
--   1. leilao_agendar_rodada(p_rodada, p_loja, p_antecedencia_min = 10) -> jsonb
--      Rascunho -> agendada, e TODOS os lotes rascunho -> agendado, numa
--      transacao so, sob `for update` na rodada e nos lotes. Confere de novo
--      (a tela so avisa): rodada em rascunho, inicia_em definido e
--      >= now() + p_antecedencia_min, pelo menos 1 lote, todo lote com 2 fotos
--      nao vazias. Lote de rodada ao vivo fica com inicia_em null: quem da a
--      hora e leilao_avancar_rodada quando o anterior fecha.
--      ★ "A loja pode receber" (Connect) NAO e conferido aqui: o dado vem da
--        Stripe e a rota confere com podeReceber() antes de chamar. Se o
--        Connect cair entre a conferencia e o agendamento, a rodada agenda e o
--        checkout do arremate recusa -- mesmo comportamento do marketplace.
--      Erros (raise): rodada_nao_encontrada, rodada_nao_rascunho, sem_inicio,
--      inicio_cedo, sem_lotes, lote_sem_fotos:<id>.
--
--   2. leilao_reordenar_lotes(p_rodada, p_loja, p_ids uuid[]) -> integer
--      Nova ordem 1..n na ordem de p_ids. Precisa ser RPC por causa do indice
--      UNICO uq_leiloes_rodada_ordem (nao e constraint, nao da para
--      "deferrable"): trocar 1 e 2 em dois updates soltos bate 23505 no meio.
--      Aqui: primeiro passa todos para negativo, depois para 1..n, sob trava.
--      So com rodada em rascunho ou agendada e TODOS os lotes ainda em
--      rascunho/agendado (lote que abriu nao muda de lugar). p_ids tem de ser
--      exatamente o conjunto de lotes da rodada, sem repetir.
--      Erros: rodada_nao_encontrada, rodada_fechada, lote_fechado, ordem_invalida.
--
--   3. leilao_cancelar_rodada(p_rodada, p_loja, p_motivo) -> jsonb
--      Rodada -> cancelada, lotes -> cancelado (cancelado_motivo, versao + 1).
--      So se NENHUM lote abriu: todos em rascunho/agendado/cancelado e
--      encerrado_em null em todos. Vale para rascunho, agendada e para o
--      instante em que o tick ja virou a rodada para ao_vivo mas ainda nao
--      abriu o primeiro lote.
--      Erros: rodada_nao_encontrada, rodada_fechada, lote_ja_abriu.
--      ★ Nao gera evento em leilao_eventos: o consumidor de avisos (fatia 3)
--        nao conhece "rodada cancelada". Quem seguia lote agendado nao e
--        avisado -- PENDENCIA para o Du decidir se vira aviso.
--
-- ★ ORDEM DE TRAVA: rodada, depois lotes -- a mesma de leilao_avancar_rodada.
--   leilao_fechar_lote trava lote e depois rodada, mas so em lote ATIVO, e
--   agendar/reordenar recusam rodada que tenha lote aberto. No cancelar em
--   rodada ao_vivo a disputa com o tick e possivel em tese; o deadlock
--   detector derruba um dos dois e lock_timeout 3s limita a espera.
--
-- ★ NASCE FECHADA: security definer, search_path fixo, revoke de
--   public/anon/authenticated, execute so para service_role.
--
-- ★ CUSTO DE IO: zero. Nenhuma tabela nova, nenhum indice novo, so funcoes.
--   Tudo por PK (leilao_rodadas.id) e pelo indice uq_leiloes_rodada_ordem
--   (rodada_id, ordem) -- dezenas de linhas por rodada. Nada toca
--   pokemon_cards / pokemon_cards_all.
--
-- ROLLBACK (uma linha por objeto):
--   drop function if exists public.leilao_cancelar_rodada(uuid, uuid, text);
--   drop function if exists public.leilao_reordenar_lotes(uuid, uuid, uuid[]);
--   drop function if exists public.leilao_agendar_rodada(uuid, uuid, integer);
-- ============================================================================

set lock_timeout = '3s';


-- ----------------------------------------------------------------------------
-- 1. Agendar
-- ----------------------------------------------------------------------------

create or replace function public.leilao_agendar_rodada(
  p_rodada uuid,
  p_loja uuid,
  p_antecedencia_min integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '3s'
as $$
declare
  v_r        record;
  v_n        integer;
  v_sem_foto uuid;
begin
  select id, status, inicia_em into v_r
  from public.leilao_rodadas
  where id = p_rodada and loja_id = p_loja
  for update;
  if not found then
    raise exception 'rodada_nao_encontrada';
  end if;
  if v_r.status <> 'rascunho' then
    raise exception 'rodada_nao_rascunho';
  end if;
  if v_r.inicia_em is null then
    raise exception 'sem_inicio';
  end if;
  if v_r.inicia_em < now() + make_interval(mins => greatest(coalesce(p_antecedencia_min, 10), 0)) then
    raise exception 'inicio_cedo';
  end if;

  -- Trava os lotes da rodada (rodada -> lotes, mesma ordem do motor).
  perform 1 from public.leiloes where rodada_id = p_rodada for update;

  select count(*) into v_n
  from public.leiloes
  where rodada_id = p_rodada and status = 'rascunho';
  if v_n = 0 then
    raise exception 'sem_lotes';
  end if;

  -- Duas fotos reais, as duas string nao vazia.
  select l.id into v_sem_foto
  from public.leiloes l
  where l.rodada_id = p_rodada and l.status = 'rascunho'
    and (jsonb_array_length(l.fotos) < 2
         or exists (select 1 from jsonb_array_elements(l.fotos) f
                    where jsonb_typeof(f) <> 'string' or btrim(f #>> '{}') = ''))
  order by l.ordem
  limit 1;
  if v_sem_foto is not null then
    raise exception 'lote_sem_fotos:%', v_sem_foto;
  end if;

  update public.leiloes
     set status = 'agendado', versao = versao + 1
   where rodada_id = p_rodada and status = 'rascunho';

  update public.leilao_rodadas
     set status = 'agendada'
   where id = p_rodada;

  return jsonb_build_object('ok', true, 'lotes', v_n, 'inicia_em', v_r.inicia_em);
end;
$$;

comment on function public.leilao_agendar_rodada(uuid, uuid, integer) is
  'Painel da loja: rascunho -> agendada com todos os lotes -> agendado, atomico. Confere inicio >= now()+antecedencia, >= 1 lote e 2 fotos por lote. Connect e conferido na rota. So service_role.';


-- ----------------------------------------------------------------------------
-- 2. Reordenar
-- ----------------------------------------------------------------------------

create or replace function public.leilao_reordenar_lotes(
  p_rodada uuid,
  p_loja uuid,
  p_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '3s'
as $$
declare
  v_status text;
  v_total  integer;
  v_n      integer;
begin
  select status into v_status
  from public.leilao_rodadas
  where id = p_rodada and loja_id = p_loja
  for update;
  if not found then
    raise exception 'rodada_nao_encontrada';
  end if;
  if v_status not in ('rascunho', 'agendada') then
    raise exception 'rodada_fechada';
  end if;

  perform 1 from public.leiloes where rodada_id = p_rodada for update;

  if exists (select 1 from public.leiloes
             where rodada_id = p_rodada and status not in ('rascunho', 'agendado')) then
    raise exception 'lote_fechado';
  end if;

  select count(*) into v_total from public.leiloes where rodada_id = p_rodada;
  v_n := coalesce(array_length(p_ids, 1), 0);
  if v_n = 0 or v_n <> v_total
     or (select count(distinct x) from unnest(p_ids) x) <> v_n
     or (select count(*) from public.leiloes
         where rodada_id = p_rodada and id = any(p_ids)) <> v_n then
    raise exception 'ordem_invalida';
  end if;

  -- Dois passos por causa do indice unico (rodada_id, ordem).
  update public.leiloes set ordem = -ordem - 1 where rodada_id = p_rodada;
  update public.leiloes l
     set ordem = t.pos::integer
    from unnest(p_ids) with ordinality as t(id, pos)
   where l.id = t.id and l.rodada_id = p_rodada;

  return v_n;
end;
$$;

comment on function public.leilao_reordenar_lotes(uuid, uuid, uuid[]) is
  'Painel da loja: nova ordem 1..n dos lotes na ordem de p_ids (conjunto exato da rodada). Rodada em rascunho/agendada, lotes ainda fechados. So service_role.';


-- ----------------------------------------------------------------------------
-- 3. Cancelar
-- ----------------------------------------------------------------------------

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
  v_status text;
  v_n      integer;
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

  update public.leiloes
     set status = 'cancelado',
         cancelado_motivo = coalesce(nullif(left(btrim(coalesce(p_motivo, '')), 300), ''), 'rodada_cancelada_pela_loja'),
         versao = versao + 1
   where rodada_id = p_rodada and status in ('rascunho', 'agendado');
  get diagnostics v_n = row_count;

  update public.leilao_rodadas set status = 'cancelada' where id = p_rodada;

  return jsonb_build_object('ok', true, 'lotes_cancelados', v_n);
end;
$$;

comment on function public.leilao_cancelar_rodada(uuid, uuid, text) is
  'Painel da loja: cancela a rodada e os lotes, so se nenhum lote abriu. So service_role.';


-- ----------------------------------------------------------------------------
-- 4. Grants (nasce fechada)
-- ----------------------------------------------------------------------------

revoke all on function public.leilao_agendar_rodada(uuid, uuid, integer)  from public, anon, authenticated;
revoke all on function public.leilao_reordenar_lotes(uuid, uuid, uuid[])  from public, anon, authenticated;
revoke all on function public.leilao_cancelar_rodada(uuid, uuid, text)    from public, anon, authenticated;

grant execute on function public.leilao_agendar_rodada(uuid, uuid, integer) to service_role;
grant execute on function public.leilao_reordenar_lotes(uuid, uuid, uuid[]) to service_role;
grant execute on function public.leilao_cancelar_rodada(uuid, uuid, text)   to service_role;
