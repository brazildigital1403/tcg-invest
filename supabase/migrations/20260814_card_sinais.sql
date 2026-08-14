-- =========================================================================
-- Bynx -- sinais de "carta procurada" e "carta acessada"
-- supabase/migrations/20260814_card_sinais.sql
--
-- IDEMPOTENTE: pode rodar varias vezes.
--
-- ORDEM DE APLICACAO (nao concentrar com outra operacao pesada de IO no
-- mesmo dia -- o credito de rajada da instancia e finito):
--   passo 1 -> secoes 1 a 4  (tabelas vazias, custo ~zero)
--   passo 2 -> secoes 5 a 8  (funcoes + revokes)
--   passo 3 -> secao 9       (notify pgrst)
--   passo 4 -> secao 10      (pg_cron)  -- so depois do resto conferido
--
-- -----------------------------------------------------------------------
-- POR QUE DUAS TABELAS
--   card_sinal_evento  bruto enxuto, retencao 30 dias. Existe pra dar
--                      AUDITORIA: sem linha bruta nao ha como separar gente
--                      de script depois do fato, e um ranking infalseavel
--                      num HERO de marketplace tem incentivo real de fraude.
--   card_sinal_diario  agregado por dia, retencao 400 dias. E o unico que a
--                      leitura do HERO toca.
--
-- O QUE NAO E GRAVADO, DE PROPOSITO
--   Sem user_id, sem ip, sem user_agent, sem referrer, sem timestamp fino.
--   A unica coisa proxima de identidade e `visitante`: sha256 truncado de um
--   uuid aleatorio de primeira parte + o dia. Irreversivel, rotativo a cada
--   24h, nunca devolvido por nenhuma API, apagado em 30 dias. Ele existe
--   porque e o que permite deduplicar SEM guardar IP -- e menos dado retido
--   do que loja_cliques ja guarda hoje (la e ip + user_agent + referrer,
--   permanentes).
--
-- SEM FOREIGN KEY PRA pokemon_cards
--   (a) pokemon_cards e VIEW desde 28/07/2026 -- Postgres nao aceita FK pra
--       view, e mirar em pokemon_cards_all forcaria leitura da tabela de
--       187 MB a cada evento, no caminho quente de escrita.
--   (b) No lugar da FK, a RPC de escrita faz `exists` por PK (Index Scan,
--       18 buffers ja medidos no comparador-hero). Isso valida EXISTENCIA,
--       nao so formato -- e o que impede um script com ids aleatorios de
--       encher a tabela de linhas que o join da leitura esconde mas que a
--       agregacao tem que varrer.
--
-- FUSO
--   Tudo em America/Sao_Paulo: escrita, rollup e leitura. NUNCA calcular
--   data em JS. Tres relogios diferentes (grava em BRT, le em UTC) desloca
--   a janela entre 21h e 00h, que e o pico de uso mobile.
--
-- ESTE SQL DEPENDE DO ROBOTS.TXT
--   A rota que chama registrar_sinal_carta vive sob /api/, que esta no
--   Disallow do robots.ts. E isso que impede o renderizador do Googlebot de
--   disparar o beacon nas ~66,9k paginas de carta. Ver o comentario no topo
--   de src/app/api/sinais/carta/route.ts.
-- =========================================================================


-- -------------------------------------------------------------------------
-- 1. BRUTO
-- -------------------------------------------------------------------------
-- A PK e o unico indice, e ela faz TRES trabalhos:
--   (a) dedup estrutural -- um visitante grava no maximo 1 linha por carta
--       por hora, aconteca o que acontecer no cliente. Nao da pra desligar
--       pelo DevTools e e atomico entre lambdas concorrentes;
--   (b) range scan por `dia` pro rollup;
--   (c) range scan por `dia` pro purge.
-- NAO criar indice em card_id, tipo ou visitante: nada consulta o bruto por
-- essas colunas (toda leitura por carta vai no agregado), e indice em
-- visitante so serviria pra rastrear individuo -- superficie de privacidade
-- que nao queremos ter.
--
-- `origem` e forense, nao identidade:
--   0 = normal
--   1 = navegacao a partir de superficie propria (colecao, watchlist, hero)
--   2 = user-agent suspeito (aceito pra poder MEDIR quanto bot bate, mas
--       excluido do ranking pelo rollup)
--   3 = sem referer
-- Sem essas 2 bytes, a pergunta "quanto disso e bot?" nao tem resposta
-- possivel e a defesa contra crawler vira fe em vez de engenharia.
create table if not exists public.card_sinal_evento (
  dia       date     not null,
  hora      smallint not null,
  tipo      text     not null,
  card_id   text     not null,
  visitante char(16) not null,
  origem    smallint not null default 0,
  constraint card_sinal_evento_pk
    primary key (dia, hora, tipo, card_id, visitante),
  constraint card_sinal_evento_hora_ck
    check (hora between 0 and 23),
  constraint card_sinal_evento_tipo_ck
    check (tipo in ('view_pub', 'view_app', 'busca_troca', 'busca_colecao')),
  constraint card_sinal_evento_vis_ck
    check (visitante ~ '^[0-9a-f]{16}$'),
  constraint card_sinal_evento_origem_ck
    check (origem between 0 and 3)
)
with (
  fillfactor = 90,
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 500
);

comment on table public.card_sinal_evento is
  'Bruto de sinais de carta. Sem user_id/ip/user_agent/referrer. Retencao 30 dias. Nenhuma leitura de request toca esta tabela -- so o rollup e o purge.';
comment on column public.card_sinal_evento.visitante is
  'sha256(uuid de 1a parte + dia) truncado em 16 hex. Irreversivel, rotativo em 24h, nunca sai em API.';
comment on column public.card_sinal_evento.origem is
  '0 normal, 1 navegacao interna, 2 UA suspeito (fora do ranking), 3 sem referer. Forense agregada, nao identidade.';


-- -------------------------------------------------------------------------
-- 2. COTA DIARIA -- o freio que funciona sem saber quem e o cliente
-- -------------------------------------------------------------------------
-- Varredura de crawler toca DEZENAS DE MILHARES de cartas distintas num dia
-- (o sitemap anuncia ~66,9k URLs em 7 blocos); trafego humano toca centenas.
-- Passando o teto, a escrita para pro dia inteiro -- o sinal daquele dia
-- fica incompleto, o que e infinitamente melhor que empilhar conexao no
-- pool de 60 na cadencia do recrawl (a forma exata do apagao de 29/07).
--
-- Uma linha por dia = a linha e quente e serializa escritores concorrentes.
-- E DE PROPOSITO: sob rajada isso throttla. O lock_timeout da funcao de
-- escrita garante que ninguem SEGURE conexao esperando por ela.
create table if not exists public.card_sinal_quota (
  dia    date primary key,
  linhas integer not null default 0
)
with (fillfactor = 70, autovacuum_vacuum_scale_factor = 0.05);

comment on table public.card_sinal_quota is
  'Contador de linhas gravadas por dia em card_sinal_evento. Teto duro anti-varredura. Uma linha por dia.';


-- -------------------------------------------------------------------------
-- 3. AGREGADO DIARIO
-- -------------------------------------------------------------------------
-- n            = eventos deduplicados no dia (origem 0 e 1)
-- n_visitantes = visitantes distintos NO DIA. Somar isso em varios dias da
--                PESSOA-DIA, nao pessoa distinta do periodo -- por isso a
--                copy do badge nao cita pessoas nem numero.
-- n_pico       = maior numero de eventos numa mesma hora. E o discriminante
--                barato: humano concentra, varredura espalha 1 por dia e
--                nunca tem pico.
-- n_interno    = quantos vieram de navegacao interna (mede o vies de link
--                interno: 16 links de CartasRelacionadas por pagina)
-- n_suspeito   = quantos vieram com UA suspeito (mede o bot que passou)
create table if not exists public.card_sinal_diario (
  dia           date        not null,
  tipo          text        not null,
  card_id       text        not null,
  n             integer     not null default 0,
  n_visitantes  integer     not null default 0,
  n_pico        integer     not null default 0,
  n_interno     integer     not null default 0,
  n_suspeito    integer     not null default 0,
  atualizado_em timestamptz not null default now(),
  constraint card_sinal_diario_pk primary key (dia, tipo, card_id)
)
with (
  fillfactor = 80,
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 200
);

comment on table public.card_sinal_diario is
  'Rollup diario dos sinais de carta. Retencao 400 dias. A PK atende o upsert do rollup E o range scan da leitura -- nao criar indice adicional.';


-- -------------------------------------------------------------------------
-- 4. RLS -- tabelas trancadas de proposito (padrao loja_cliques/trade_comparisons)
-- -------------------------------------------------------------------------
-- RLS LIGADA com ZERO POLICY: nem anon nem authenticated leem ou escrevem
-- via PostgREST. Aqui a tranca nao e por PII (nao ha) -- e pra que ninguem
-- consiga inflar o contador escrevendo direto com a anon key, driblando o
-- gate de humanidade, o rate-limit e a cota da rota.
alter table public.card_sinal_evento enable row level security;
alter table public.card_sinal_quota  enable row level security;
alter table public.card_sinal_diario enable row level security;

revoke all on table public.card_sinal_evento from anon, authenticated;
revoke all on table public.card_sinal_quota  from anon, authenticated;
revoke all on table public.card_sinal_diario from anon, authenticated;

-- Grant EXPLICITO. Nao depender do default privilege do schema public: ele
-- ja foi alterado neste banco pelo menos uma vez, e se ele mudar de novo a
-- leitura passa a voltar vazia EM SILENCIO (RLS sem policy nao levanta erro).
grant select, insert, update on table public.card_sinal_evento to service_role;
grant select, insert, update on table public.card_sinal_quota  to service_role;
grant select, insert, update, delete on table public.card_sinal_diario to service_role;


-- -------------------------------------------------------------------------
-- 5. ESCRITA -- unico caminho, e ele nunca segura conexao
-- -------------------------------------------------------------------------
-- statement_timeout de 2s e lock_timeout de 300ms sao OBRIGATORIOS aqui:
-- o papel service_role nao tem timeout proprio configurado (rolconfig null),
-- entao sem isto um lock na linha de cota poderia segurar um slot do pool de
-- 60 conexoes -- compartilhado com TODA a leitura do site -- indefinidamente.
-- Sinal e best-effort: se nao gravou em 2s, nao grava.
create or replace function public.registrar_sinal_carta(
  p_tipo      text,
  p_card_id   text,
  p_visitante text,
  p_origem    smallint default 0
) returns void
language plpgsql
security definer
set search_path = public
set statement_timeout = '2s'
set lock_timeout = '300ms'
as $$
declare
  v_dia    date;
  v_hora   smallint;
  v_quota  integer;
  v_ins    integer;
  c_teto   constant integer := 25000;
begin
  -- Guards baratos. A rota ja valida; isto e a segunda trava, porque a RPC
  -- e superficie propria.
  if p_tipo is null
     or p_tipo not in ('view_pub', 'view_app', 'busca_troca', 'busca_colecao') then
    return;
  end if;
  if p_visitante is null or p_visitante !~ '^[0-9a-f]{16}$' then
    return;
  end if;
  -- Teto de 128, nao 64: medido, ha ids reais de ate 89 chars no catalogo
  -- (o id da Liga embute o nome PT+EN inteiro). Com 64, 38 cartas ficariam
  -- invisiveis pro sinal pra sempre, caladas.
  if p_card_id is null
     or p_card_id !~ '^[A-Za-z0-9][A-Za-z0-9._!?-]{1,127}$' then
    return;
  end if;

  v_dia  := (now() at time zone 'America/Sao_Paulo')::date;
  v_hora := extract(hour from (now() at time zone 'America/Sao_Paulo'))::smallint;

  -- Freio de varredura, ANTES de qualquer trabalho caro.
  select linhas into v_quota from public.card_sinal_quota where dia = v_dia;
  if coalesce(v_quota, 0) >= c_teto then
    return;
  end if;

  -- EXISTENCIA, nao so formato. Index Scan por PK na view (que ja respeita
  -- oculto = false). Id inventado morre aqui e nunca vira linha.
  if not exists (select 1 from public.pokemon_cards where id = p_card_id) then
    return;
  end if;

  insert into public.card_sinal_evento (dia, hora, tipo, card_id, visitante, origem)
  values (v_dia, v_hora, p_tipo, p_card_id, lower(p_visitante), coalesce(p_origem, 0))
  on conflict do nothing;

  get diagnostics v_ins = row_count;

  if v_ins = 1 then
    insert into public.card_sinal_quota (dia, linhas)
    values (v_dia, 1)
    on conflict (dia) do update
      set linhas = public.card_sinal_quota.linhas + 1;
  end if;

exception
  -- Tracking NUNCA pode derrubar request. `raise warning` aparece no log do
  -- Postgres (Supabase Logs) sem falhar a chamada -- silencio total aqui foi
  -- o que fez a Pokedex servir vazio por uma hora sem ninguem saber.
  when others then
    raise warning '[registrar_sinal_carta] % / %', sqlstate, sqlerrm;
    return;
end;
$$;

comment on function public.registrar_sinal_carta(text, text, text, smallint) is
  'Unico caminho de escrita de sinal de carta. Valida existencia do card_id por PK, respeita cota diaria, dedup pela PK do bruto. Nunca levanta excecao.';

-- CRITICO: funcao nova nasce com EXECUTE pra PUBLIC, e o PostgREST expoe
-- automaticamente como /rest/v1/rpc/<nome>. Sem estas duas linhas, qualquer
-- browser com a anon key (que esta no bundle) chamaria a RPC direto e o gate
-- de humanidade, o filtro de UA, a cota e o rate-limit da rota viravam
-- decoracao.
revoke all on function public.registrar_sinal_carta(text, text, text, smallint)
  from public, anon, authenticated;
grant execute on function public.registrar_sinal_carta(text, text, text, smallint)
  to service_role;


-- -------------------------------------------------------------------------
-- 6. ROLLUP -- recomputo completo dos ultimos dias (idempotente)
-- -------------------------------------------------------------------------
-- Roda 2x/dia, NAO de hora em hora. A janela do HERO e de 14 dias: ninguem
-- precisa de frescor horario pra "mais vista das ultimas duas semanas", e o
-- rollup horario reescreveria o dia inteiro 24 vezes -- uma ordem de
-- grandeza mais churn que o purge que ele evita.
--
-- Recomputo completo (em vez de delta) e auto-corretivo: se o job falhar,
-- a proxima execucao conserta sozinha.
create or replace function public.card_sinal_rollup(p_dias integer default 2)
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '60s'
as $$
declare
  v_desde  date;
  v_linhas bigint;
begin
  v_desde := (now() at time zone 'America/Sao_Paulo')::date
             - least(greatest(coalesce(p_dias, 2), 1), 30);

  insert into public.card_sinal_diario
    (dia, tipo, card_id, n, n_visitantes, n_pico, n_interno, n_suspeito, atualizado_em)
  select
    e.dia,
    e.tipo,
    e.card_id,
    count(*) filter (where e.origem in (0, 1))::int,
    count(distinct e.visitante) filter (where e.origem in (0, 1))::int,
    coalesce(max(h.por_hora) filter (where e.origem in (0, 1)), 0)::int,
    count(*) filter (where e.origem = 1)::int,
    count(*) filter (where e.origem = 2)::int,
    now()
  from public.card_sinal_evento e
  join lateral (
    select count(*) as por_hora
    from public.card_sinal_evento e2
    where e2.dia = e.dia and e2.hora = e.hora
      and e2.tipo = e.tipo and e2.card_id = e.card_id
      and e2.origem in (0, 1)
  ) h on true
  where e.dia >= v_desde
  group by e.dia, e.tipo, e.card_id
  on conflict (dia, tipo, card_id) do update
    set n             = excluded.n,
        n_visitantes  = excluded.n_visitantes,
        n_pico        = excluded.n_pico,
        n_interno     = excluded.n_interno,
        n_suspeito    = excluded.n_suspeito,
        atualizado_em = excluded.atualizado_em;

  get diagnostics v_linhas = row_count;
  return jsonb_build_object('ok', true, 'linhas', v_linhas, 'desde', v_desde);
end;
$$;

comment on function public.card_sinal_rollup(integer) is
  'Recomputa o agregado diario a partir do bruto. IDEMPOTENTE. Le so os ultimos p_dias (teto 30). Roda 2x/dia por pg_cron.';

revoke all on function public.card_sinal_rollup(integer)
  from public, anon, authenticated;


-- -------------------------------------------------------------------------
-- 7. PURGE -- retencao
-- -------------------------------------------------------------------------
-- ~500-800 linhas/dia no bruto: um DELETE por dia apaga poucas centenas de
-- linhas usando a coluna lider da PK. Isto NAO e o cenario que justificaria
-- particionar -- particao traria junto o modo de falha de "particao faltante
-- = escrita morre calada", que e pior que o custo que ela evitaria.
create or replace function public.card_sinal_purge()
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '60s'
set lock_timeout = '5s'
as $$
declare
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_bruto bigint;
  v_agg   bigint;
begin
  delete from public.card_sinal_evento where dia < v_hoje - 30;
  get diagnostics v_bruto = row_count;

  delete from public.card_sinal_diario where dia < v_hoje - 400;
  get diagnostics v_agg = row_count;

  delete from public.card_sinal_quota where dia < v_hoje - 60;

  return jsonb_build_object('ok', true, 'bruto', v_bruto, 'agregado', v_agg);
end;
$$;

comment on function public.card_sinal_purge() is
  'Retencao: bruto 30 dias, agregado 400 dias, cota 60 dias. IDEMPOTENTE. Roda 1x/dia por pg_cron.';

revoke all on function public.card_sinal_purge()
  from public, anon, authenticated;


-- -------------------------------------------------------------------------
-- 8. LEITURA -- a UNICA coisa que o HERO chama
-- -------------------------------------------------------------------------
-- Agrega e LIMITA em SQL. Nunca ler card_sinal_diario com .select() do
-- supabase-js: o PostgREST corta em 1000 linhas EM SILENCIO (error null,
-- data truncado) -- ja custou ~20 mil cartas fora do sitemap nesta casa.
--
-- FILTROS DE FORMA, nao so de volume:
--   n_visitantes >= p_min_vis  -> volume minimo
--   n_pico       >= p_min_pico -> concentracao (humano concentra; varredura
--                                 espalha 1/dia e nunca tem pico)
--   dias         >= 3          -> mata o pico de sessao unica e o usuario
--                                 obsessivo que abre a mesma carta 5x num dia
--
-- O join com pokemon_cards acontece DEPOIS do corte de 40, e a numeracao
-- final acontece DEPOIS do join -- assim `pos` e sempre densa e o consumidor
-- nunca recebe 1 carta onde pediu 2 porque as primeiras nao resolveram.
--
-- Agrupa por NOME antes de ranquear: a mesma carta em impressoes diferentes
-- tem card_id diferente, e ranquear por id divide o voto justamente das
-- cartas mais reimpressas, que sao as mais populares.
create or replace function public.get_sinais_carta(
  p_dias     integer default 14,
  p_limit    integer default 2,
  p_min_vis  integer default 12,
  p_min_pico integer default 2
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with param as (
    select
      (now() at time zone 'America/Sao_Paulo')::date as hoje,
      least(greatest(coalesce(p_dias, 14), 1), 90)   as dias,
      greatest(coalesce(p_limit, 2), 1)              as lim,
      greatest(coalesce(p_min_vis, 12), 1)           as min_vis,
      greatest(coalesce(p_min_pico, 2), 1)           as min_pico
  ),
  resumo as (
    select
      coalesce(sum(d.n), 0)::bigint      as eventos,
      count(distinct d.card_id)::int     as cartas,
      max(d.dia)                         as dado_ate
    from public.card_sinal_diario d, param p
    where d.dia > p.hoje - p.dias
  ),
  bruto as (
    select
      case when d.tipo in ('view_pub', 'view_app') then 'acessada' else 'procurada' end as grupo,
      d.card_id,
      sum(d.n)::int              as tot,
      sum(d.n_visitantes)::int   as vis,
      max(d.n_pico)::int         as pico,
      count(distinct d.dia)::int as dias
    from public.card_sinal_diario d, param p
    where d.dia > p.hoje - p.dias
      and d.tipo in ('view_pub', 'view_app', 'busca_troca')
    group by 1, 2
  ),
  elegivel as (
    select b.*,
           row_number() over (partition by b.grupo order by b.vis desc, b.tot desc, b.card_id) as rn
    from bruto b, param p
    where b.vis  >= p.min_vis
      and b.pico >= p.min_pico
      and b.dias >= 3
  ),
  nomeado as (
    select
      e.grupo,
      sum(e.vis)::int as vis,
      sum(e.tot)::int as tot,
      (array_agg(c.id          order by e.vis desc, c.id))[1] as id,
      (array_agg(c.slug        order by e.vis desc, c.id))[1] as slug,
      (array_agg(regexp_replace(coalesce(nullif(c.name_pt, ''), c.name), '\s*\([^)]*\)\s*$', '')
                               order by e.vis desc, c.id))[1] as nome,
      (array_agg(c.image_small order by e.vis desc, c.id))[1] as image_small,
      (array_agg(coalesce(nullif(c.preco_medio, 0), nullif(c.preco_normal, 0),
                          nullif(c.preco_foil_medio, 0), nullif(c.preco_reverse_medio, 0),
                          nullif(c.preco_promo_medio, 0))
                               order by e.vis desc, c.id))[1] as preco
    from elegivel e
    join public.pokemon_cards c on c.id = e.card_id
    where e.rn <= 40
      and coalesce(c.is_canary, false) = false
      and c.slug is not null
    group by e.grupo,
             lower(regexp_replace(coalesce(nullif(c.name_pt, ''), c.name), '\s*\([^)]*\)\s*$', ''))
  ),
  final as (
    select n.*, row_number() over (partition by n.grupo order by n.vis desc, n.id) as pos
    from nomeado n
  )
  select jsonb_build_object(
    'ok', true,
    'dias', (select dias from param),
    'eventos_janela',   (select eventos  from resumo),
    'cartas_distintas', (select cartas   from resumo),
    'dado_ate',         (select dado_ate from resumo),
    'acessadas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'slug', f.slug, 'nome', f.nome,
               'image_small', f.image_small, 'preco', f.preco, 'vis', f.vis
             ) order by f.pos)
      from final f, param p where f.grupo = 'acessada' and f.pos <= p.lim
    ), '[]'::jsonb),
    'procuradas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'slug', f.slug, 'nome', f.nome,
               'image_small', f.image_small, 'preco', f.preco, 'vis', f.vis
             ) order by f.pos)
      from final f, param p where f.grupo = 'procurada' and f.pos <= p.lim
    ), '[]'::jsonb)
  );
$$;

comment on function public.get_sinais_carta(integer, integer, integer, integer) is
  'Top N por sinal (acessada / procurada) na janela. Devolve so agregado por carta -- nunca nada sobre quem gerou o sinal. eventos_janela e dado_ate servem de gate de ativacao e de deteccao de pipeline morto.';

revoke all on function public.get_sinais_carta(integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_sinais_carta(integer, integer, integer, integer)
  to service_role;


-- -------------------------------------------------------------------------
-- 9. Recarregar o schema cache do PostgREST
-- -------------------------------------------------------------------------
-- Sem isto a RPC nova pode voltar 404 ate o proximo restart, e o consumidor
-- degradaria calado achando que "ainda nao tem dado".
notify pgrst, 'reload schema';


-- -------------------------------------------------------------------------
-- 10. pg_cron -- minutos quebrados, sem colidir com os jobs existentes
--     (hoje: :17 set_index_stats, :32 base_pokemon_tipos, 10:00 snapshots,
--      10:15 price_movers)
-- -------------------------------------------------------------------------
-- Horarios em UTC (pg_cron roda em UTC). 07:26 e 19:26 UTC = 04:26 e 16:26
-- de Brasilia.
select cron.schedule('card_sinal_rollup_am', '26 7 * * *',  $$select public.card_sinal_rollup(2)$$);
select cron.schedule('card_sinal_rollup_pm', '26 19 * * *', $$select public.card_sinal_rollup(2)$$);
select cron.schedule('card_sinal_purge',     '48 8 * * *',  $$select public.card_sinal_purge()$$);


-- -------------------------------------------------------------------------
-- 11. ROLLBACK (uma linha por objeto, sem migration reversa)
-- -------------------------------------------------------------------------
-- select cron.unschedule('card_sinal_rollup_am');
-- select cron.unschedule('card_sinal_rollup_pm');
-- select cron.unschedule('card_sinal_purge');
-- drop function if exists public.get_sinais_carta(integer, integer, integer, integer);
-- drop function if exists public.card_sinal_purge();
-- drop function if exists public.card_sinal_rollup(integer);
-- drop function if exists public.registrar_sinal_carta(text, text, text, smallint);
-- drop table if exists public.card_sinal_diario;
-- drop table if exists public.card_sinal_quota;
-- drop table if exists public.card_sinal_evento;
-- O consumidor degrada sozinho: sem a RPC, o comparador-hero volta a montar
-- o carrossel com os 3 sinais antigos.


-- -------------------------------------------------------------------------
-- 12. QUERIES DE SANIDADE (rodar na 1a e na 2a semana, ANTES de confiar)
-- -------------------------------------------------------------------------
-- Assinatura de varredura: muitos card_id distintos, quase todos com n = 1.
--   select dia, count(*) as chaves,
--          count(*) filter (where n = 1) as com_um,
--          sum(n_suspeito) as ua_suspeito, sum(n_interno) as interno
--     from public.card_sinal_diario
--    where dia >= current_date - 14 group by dia order by dia;
--
-- Distribuicao, pra calibrar p_min_vis (usar o p95, nao chutar):
--   select tipo, n_visitantes, count(*)
--     from public.card_sinal_diario
--    where dia >= current_date - 14 group by 1, 2 order by 1, 2;
--
-- Custo real da leitura (a regra da casa e LER O PLANO, nao so o tempo):
--   explain (analyze, buffers) select public.get_sinais_carta(14, 2, 12, 2);
--   -> exigir Index Scan / Bitmap em card_sinal_diario e Index Scan por PK
--      em pokemon_cards. Seq Scan em pokemon_cards = PARAR.