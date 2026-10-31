-- ############################################################################
-- ############################################################################
-- ##                                                                        ##
-- ##                   NAO APLICAR SEM O DU                                 ##
-- ##                                                                        ##
-- ##   Este arquivo LIGA o relogio do leilao em producao (pg_cron a cada    ##
-- ##   10 segundos). E infraestrutura: so sobe com o Du olhando, depois     ##
-- ##   da 20260928090000_leilao_motor.sql aplicada e provada na branch.     ##
-- ##                                                                        ##
-- ############################################################################
-- ############################################################################
--
-- ★ POR QUE 10 SEGUNDOS, E NAO 1 MINUTO. Lote ao vivo dura 30-90s. Com tick de
--   1 minuto, o lote de 30s podia ficar ate 60s "zerado" na tela antes de
--   fechar, e a live parava esperando o proximo lote. pg_cron >= 1.5 aceita
--   intervalo em segundos ('10 seconds'); o Supabase roda 1.6.
--
-- ★ POR QUE NAO 1 SEGUNDO. Cada execucao abre uma conexao e grava uma linha em
--   cron.job_run_details (8.640/dia a 10s). 1s seria 86.400/dia e conexao
--   constante numa instancia pequena, para ganhar precisao que o fechamento
--   preguicoso ja entrega (abaixo).
--
-- ★ A PRECISAO VEM DO FECHAMENTO PREGUICOSO, NAO DO CRON. `leilao_fechar_lote(id)`
--   fecha o lote na hora se termina_em ja passou (e, em rodada ao vivo, ativa o
--   proximo). A rota GET /api/leiloes/[id]/estado (service_role) deve chama-la
--   ANTES de ler a view quando o lote esta 'ativo' e termina_em <= agora. Assim o
--   primeiro espectador que consultar depois do fim fecha o lote e abre o
--   proximo; o tick de 10s vira rede de seguranca (ninguem olhando, calote,
--   rodada agendada).
--
-- ★ CUSTO: o tick le so indices parciais (status='ativo'/'agendado'/
--   'aguardando_pagamento', rodadas 'agendada'/'ao_vivo'), que ficam quase
--   vazios. Sem leilao rolando, sao 5 index scans vazios: < 1 ms. Nada toca a
--   pokemon_cards_all.
--
-- ★ LOG: cron.job_run_details cresce 8.640 linhas/dia so deste job. O segundo
--   job apaga o historico do tick com mais de 6h, de hora em hora.
--
-- ROLLBACK:
--   select cron.unschedule('leilao_tick');
--   select cron.unschedule('leilao_tick_purge_log');
-- ============================================================================

do $$
declare
  v_ver text;
begin
  select extversion into v_ver from pg_extension where extname = 'pg_cron';
  if v_ver is null then
    raise exception 'pg_cron nao instalado';
  end if;
  if string_to_array(v_ver, '.')::int[] < array[1, 5] then
    raise exception 'pg_cron % nao aceita intervalo em segundos (precisa >= 1.5)', v_ver;
  end if;
end $$;

-- cron.schedule com nome existente substitui o job: reaplicar e seguro.
select cron.schedule('leilao_tick', '10 seconds', $$select public.leilao_tick()$$);

select cron.schedule(
  'leilao_tick_purge_log',
  '17 * * * *',
  $$delete from cron.job_run_details
     where jobid in (select jobid from cron.job where jobname = 'leilao_tick')
       and end_time < now() - interval '6 hours'$$
);
