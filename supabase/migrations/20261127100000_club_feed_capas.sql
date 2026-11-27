-- Capas do Feed do Club (27/11/2026, decisao do Du: caminho B, automatico em todas as redes).
-- Um script do bynx-scan roda de hora em hora na Mia Servidor, abre cada post sem capa, copia a
-- imagem para o bucket club-fotos (feed/<id>.webp) e grava aqui. O feed nunca carrega imagem da
-- rede: so do nosso bucket. Sem capa (ainda nao rodou, falhou 3 vezes), fica a capa de texto.
--
-- Freios do contrato da Mia Servidor (bynx-scan/docs/MIA-SERVIDOR.md), no banco e nao na memoria
-- do script: teto por dia por rede e no total, cobrado ANTES da requisicao sair; sinal de bloqueio
-- (429, 403, desafio) para a rede inteira por 24 h, e por 30 dias se repetir em 7 dias.
--
-- Tudo aqui e so para o service_role (o script). O navegador le a capa pela club_feed_lista.
--
-- ROLLBACK:
--   drop function public.club_feed_capa_bloquear(text, text);
--   drop function public.club_feed_capa_gravar(uuid, boolean, text, text);
--   drop function public.club_feed_capa_reservar(text, integer, integer);
--   drop function public.club_feed_capas_pendentes(integer);
--   drop table public.club_feed_capa_freio, public.club_feed_capa_cota;
--   alter table public.club_conteudos drop column capa_path, drop column capa_status,
--     drop column capa_tentativas, drop column capa_tentou_em, drop column capa_erro;
--   e reaplicar club_feed_lista e club_feed_meus de 20261126200000_club_feed.sql

alter table public.club_conteudos
  add column capa_path       text check (capa_path ~ '^feed/[0-9a-f-]{36}\.webp$'),
  add column capa_status     text not null default 'pendente' check (capa_status in ('pendente', 'ok', 'falhou')),
  add column capa_tentativas smallint not null default 0 check (capa_tentativas between 0 and 10),
  add column capa_tentou_em  timestamptz,
  add column capa_erro       text check (char_length(capa_erro) <= 200);

create index club_conteudos_capa_pendente_idx on public.club_conteudos (feed_em desc)
  where feed_em is not null and capa_status = 'pendente';

-- Cota do dia (Brasilia) por rede. A linha 'total' soma as quatro.
create table public.club_feed_capa_cota (
  dia     date not null,
  rede    text not null check (rede in ('instagram', 'tiktok', 'youtube', 'twitch', 'total')),
  usadas  integer not null default 0 check (usadas >= 0),
  primary key (dia, rede)
);

-- Freio por rede: bloqueada ate quando, e quantas vezes nos ultimos 7 dias.
create table public.club_feed_capa_freio (
  rede           text primary key check (rede in ('instagram', 'tiktok', 'youtube', 'twitch')),
  bloqueado_ate  timestamptz,
  ocorrencias    timestamptz[] not null default '{}',
  motivo         text check (char_length(motivo) <= 200),
  updated_at     timestamptz not null default now()
);

alter table public.club_feed_capa_cota  enable row level security;
alter table public.club_feed_capa_freio enable row level security;
revoke all on table public.club_feed_capa_cota  from public, anon, authenticated;
revoke all on table public.club_feed_capa_freio from public, anon, authenticated;

-- Posts que precisam de capa: no feed, pendentes, menos de 3 tentativas, nenhuma tentativa na
-- ultima hora (a rodada anterior), rede sem freio ligado. Mais novos primeiro.
create or replace function public.club_feed_capas_pendentes(p_limite integer default 60)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'rede', c.rede, 'url', c.url, 'tentativas', c.capa_tentativas)
                            order by c.feed_em desc), '[]'::jsonb)
  from (
    select c.* from public.club_conteudos c
    where c.feed_em is not null and c.status = 'ativo' and c.capa_status = 'pendente' and c.capa_tentativas < 3
      and (c.capa_tentou_em is null or c.capa_tentou_em < now() - interval '50 minutes')
      and not exists (select 1 from public.club_feed_capa_freio f where f.rede = c.rede and f.bloqueado_ate > now())
    order by c.feed_em desc
    limit least(greatest(coalesce(p_limite, 60), 1), 60)
  ) c
$$;
revoke all on function public.club_feed_capas_pendentes(integer) from public, anon, authenticated;
grant execute on function public.club_feed_capas_pendentes(integer) to service_role;

-- Reserva UMA requisicao antes de ela sair (regra R5: cobra antes, inclusive as que falham).
-- Recusa se a rede esta com freio, se a rede passou do teto dela ou se o total passou do teto do dia.
create or replace function public.club_feed_capa_reservar(p_rede text, p_teto_rede integer default 150, p_teto_total integer default 300)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
  v_rede integer;
  v_total integer;
begin
  if p_rede not in ('instagram', 'tiktok', 'youtube', 'twitch') then raise exception 'rede_invalida'; end if;
  if exists (select 1 from public.club_feed_capa_freio f where f.rede = p_rede and f.bloqueado_ate > now()) then return false; end if;

  insert into public.club_feed_capa_cota (dia, rede, usadas) values (v_dia, p_rede, 0), (v_dia, 'total', 0)
  on conflict (dia, rede) do nothing;
  -- Trava as duas linhas na mesma ordem para duas execucoes ao mesmo tempo nao passarem do teto.
  select usadas into v_total from public.club_feed_capa_cota where dia = v_dia and rede = 'total' for update;
  select usadas into v_rede from public.club_feed_capa_cota where dia = v_dia and rede = p_rede for update;
  if v_total >= p_teto_total or v_rede >= p_teto_rede then return false; end if;

  update public.club_feed_capa_cota set usadas = usadas + 1 where dia = v_dia and rede in (p_rede, 'total');
  return true;
end;
$$;
revoke all on function public.club_feed_capa_reservar(text, integer, integer) from public, anon, authenticated;
grant execute on function public.club_feed_capa_reservar(text, integer, integer) to service_role;

-- Sinal de bloqueio (429, 403, pagina de desafio): para a rede por 24 h; se for a segunda vez em
-- 7 dias, para por 30 dias. Devolve ate quando ficou parada.
create or replace function public.club_feed_capa_bloquear(p_rede text, p_motivo text)
returns timestamptz
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_oc timestamptz[];
  v_ate timestamptz;
begin
  if p_rede not in ('instagram', 'tiktok', 'youtube', 'twitch') then raise exception 'rede_invalida'; end if;
  select coalesce(array_agg(o) filter (where o > now() - interval '7 days'), '{}') into v_oc
  from public.club_feed_capa_freio f, unnest(f.ocorrencias) o where f.rede = p_rede;
  v_oc := coalesce(v_oc, '{}') || now();
  v_ate := now() + case when cardinality(v_oc) >= 2 then interval '30 days' else interval '24 hours' end;
  insert into public.club_feed_capa_freio (rede, bloqueado_ate, ocorrencias, motivo, updated_at)
  values (p_rede, v_ate, v_oc, left(p_motivo, 200), now())
  on conflict (rede) do update set bloqueado_ate = excluded.bloqueado_ate, ocorrencias = excluded.ocorrencias,
    motivo = excluded.motivo, updated_at = now();
  return v_ate;
end;
$$;
revoke all on function public.club_feed_capa_bloquear(text, text) from public, anon, authenticated;
grant execute on function public.club_feed_capa_bloquear(text, text) to service_role;

-- Resultado de uma tentativa. Sucesso grava o caminho; falha soma a tentativa e, na terceira,
-- desiste (fica a capa de texto; a organizacao pode pedir outra rodada).
create or replace function public.club_feed_capa_gravar(p_id uuid, p_ok boolean, p_path text default null, p_erro text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c public.club_conteudos;
begin
  select * into v_c from public.club_conteudos c where c.id = p_id for update;
  if not found then raise exception 'post_nao_encontrado'; end if;
  if p_ok then
    if p_path is null or p_path <> 'feed/' || p_id::text || '.webp' then raise exception 'caminho_invalido'; end if;
    update public.club_conteudos c set capa_path = p_path, capa_status = 'ok', capa_tentativas = c.capa_tentativas + 1,
           capa_tentou_em = now(), capa_erro = null
     where c.id = p_id;
  else
    update public.club_conteudos c set capa_tentativas = c.capa_tentativas + 1, capa_tentou_em = now(),
           capa_erro = left(p_erro, 200),
           capa_status = case when c.capa_tentativas + 1 >= 3 then 'falhou' else 'pendente' end
     where c.id = p_id;
  end if;
  return (select jsonb_build_object('id', c.id, 'status', c.capa_status, 'tentativas', c.capa_tentativas)
          from public.club_conteudos c where c.id = p_id);
end;
$$;
revoke all on function public.club_feed_capa_gravar(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.club_feed_capa_gravar(uuid, boolean, text, text) to service_role;

-- A lista e o "Meus posts" passam a devolver a capa (so quando ja foi capturada).
do $$
declare d text;
begin
  d := pg_get_functiondef('public.club_feed_lista(text,timestamptz,text,text,integer)'::regprocedure);
  if position('''url'', p.url, ''arroba''' in d) = 0 then raise exception 'club_feed_lista mudou: conferir antes'; end if;
  d := replace(d, '''url'', p.url, ''arroba''', '''url'', p.url, ''capa'', case when p.capa_status = ''ok'' then p.capa_path end, ''arroba''');
  execute d;
  d := pg_get_functiondef('public.club_feed_meus()'::regprocedure);
  if position('''url'', c.url, ''feed_em''' in d) = 0 then raise exception 'club_feed_meus mudou: conferir antes'; end if;
  d := replace(d, '''url'', c.url, ''feed_em''', '''url'', c.url, ''capa'', case when c.capa_status = ''ok'' then c.capa_path end, ''feed_em''');
  execute d;
end $$;
