-- ############################################################################
-- ##   NAO APLICAR EM PRODUCAO SEM O DU. Provada antes na branch de prova.  ##
-- ############################################################################
--
-- admin_leilao_saude(): a central do leilao no Admin precisa saber se o relogio
-- (job leilao_tick) esta rodando, e o schema `cron` nao e exposto pela API.
-- Sem esta funcao, relogio parado com nenhum lote aberto nao aparece em lugar
-- nenhum.
--
-- Somente leitura. Sem tabela, indice nem cron novos. So o papel de servico
-- executa: a rota /api/admin/leiloes chama com requireAdmin antes.
--
-- Custo: a ultima volta vem pela PK de job_run_details, de tras para a frente.
-- As falhas contam so as ultimas 6 h, e o job leilao_tick_purge_log apaga o
-- historico do tick com mais de 6 h, entao a varredura nao cresce com o tempo.
--
-- ROLLBACK: drop function public.admin_leilao_saude();

create or replace function public.admin_leilao_saude()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'agora', now(),
    'agendado', j.jobid is not null,
    'ativo', coalesce(j.active, false),
    'agenda', j.schedule,
    'ultima_volta_em', u.end_time,
    'ultima_volta_status', u.status,
    'falhas_6h', coalesce(f.n, 0)
  )
  from (select 1) as base
  left join cron.job as j on j.jobname = 'leilao_tick'
  left join lateral (
    select d.end_time, d.status
      from cron.job_run_details as d
     where d.jobid = j.jobid
     order by d.runid desc
     limit 1
  ) as u on true
  left join lateral (
    select count(*) as n
      from cron.job_run_details as d
     where d.jobid = j.jobid
       and d.status = 'failed'
       and d.end_time > now() - interval '6 hours'
  ) as f on true;
$$;

comment on function public.admin_leilao_saude() is
  'Saude do relogio do leilao para a central do Admin. Somente leitura; so service_role.';

revoke all on function public.admin_leilao_saude() from public;
revoke all on function public.admin_leilao_saude() from anon;
revoke all on function public.admin_leilao_saude() from authenticated;
grant execute on function public.admin_leilao_saude() to service_role;
