-- Meu link do Club, Fatia 1A (plano de 25/11/2026, PLANO-MEU-LINK.md): contagem de visitas do
-- endereco bynx.gg/@arroba, resolucao do @ para o codigo de indicacao e o painel do membro.
-- NAO e aplicada em producao sem OK explicito do Du. Aplicada so na prova.
--
-- Privacidade: a tabela guarda SO a contagem por membro e por dia. Nenhum IP, user-agent,
-- cookie ou dado do visitante. O filtro de robo fica na pagina, que passa p_contar = false.
--
-- Tabela nova nasce trancada (RLS sem policy + revoke). A rota publica resolve com a chave de
-- servico; o membro le o painel por club_meu_link (so o proprio, so numeros, nunca nome nem id
-- de ninguem). Cadastro marcado como suspeito nao entra na contagem do membro.
--
-- Custo de IO: tabela nova de dezenas de linhas, upsert por chave primaria. A busca do @ le
-- users (cerca de 600 linhas) e club_membros (cerca de 50).
--
-- Rollback:
--   drop function public.club_meu_link();
--   drop function public.club_link_resolver_interno(text, boolean);
--   drop table public.club_link_visitas;

create table public.club_link_visitas (
  user_id  uuid not null references public.users(id) on delete cascade,
  dia      date not null,
  visitas  integer not null default 0 check (visitas >= 0),
  primary key (user_id, dia)
);
alter table public.club_link_visitas enable row level security;
revoke all on public.club_link_visitas from public, anon, authenticated;

-- Acha o membro pelo @ e devolve o codigo de indicacao dele (nulo = nao existe, nao e membro,
-- conta suspensa ou sem codigo). Com p_contar, soma 1 visita no dia de hoje em Brasilia.
-- Uma ida ao banco por clique. So service_role.
create or replace function public.club_link_resolver_interno(p_arroba text, p_contar boolean default true)
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ig    text := public.club_instagram_limpo(p_arroba);
  v_user  uuid;
  v_code  text;
begin
  if v_ig is null or v_ig !~ '^[a-z0-9._]{1,30}$' then return null; end if;

  select u.id, u.referral_code into v_user, v_code
  from public.club_membros m
  join public.users u on u.id = m.user_id
  where public.club_instagram_limpo(u.instagram) = v_ig and u.suspended_at is null
  order by m.created_at
  limit 1;
  if v_user is null or v_code is null then return null; end if;

  if coalesce(p_contar, true) then
    insert into public.club_link_visitas (user_id, dia, visitas)
    values (v_user, (now() at time zone 'America/Sao_Paulo')::date, 1)
    on conflict (user_id, dia) do update set visitas = public.club_link_visitas.visitas + 1;
  end if;

  return v_code;
end;
$$;
revoke all on function public.club_link_resolver_interno(text, boolean) from public, anon, authenticated;
grant execute on function public.club_link_resolver_interno(text, boolean) to service_role;

-- O painel do proprio membro: o endereco, os numeros e os 14 ultimos dias (hoje por ultimo).
create or replace function public.club_meu_link()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_hoje    date := (now() at time zone 'America/Sao_Paulo')::date;
  v_code    text;
  v_ig      text;
  v_vis     bigint;
  v_serie   jsonb;
  v_cad     integer;
  v_ati     integer;
  v_melhor  integer;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not exists (select 1 from public.club_membros m where m.user_id = v_uid) then raise exception 'nao_membro'; end if;

  select u.referral_code, public.club_instagram_limpo(u.instagram) into v_code, v_ig
  from public.users u where u.id = v_uid;
  if v_ig is null or v_ig !~ '^[a-z0-9._]{1,30}$' then v_ig := null; end if;

  select coalesce(sum(v.visitas), 0) into v_vis from public.club_link_visitas v where v.user_id = v_uid;

  select coalesce(jsonb_agg(coalesce(v.visitas, 0) order by d.dia), '[]'::jsonb) into v_serie
  from generate_series(v_hoje - 13, v_hoje, interval '1 day') as d(dia)
  left join public.club_link_visitas v on v.user_id = v_uid and v.dia = d.dia::date;

  select count(*), count(*) filter (where r.ativou_at is not null) into v_cad, v_ati
  from public.referrals r
  where r.referrer_user_id = v_uid and not coalesce(r.is_suspicious, false);

  select coalesce(max(t.c), 0) into v_melhor from (
    select (select count(*) from public.user_cards uc where uc.user_id = r.referred_user_id) as c
    from public.referrals r
    where r.referrer_user_id = v_uid and r.ativou_at is not null and not coalesce(r.is_suspicious, false)) t;

  return jsonb_build_object(
    'arroba', v_ig,
    'codigo', v_code,
    'visitas_total', v_vis,
    'visitas_14d', v_serie,
    'cadastros', v_cad,
    'ativados', v_ati,
    'melhor_convidado_cartas', v_melhor
  );
end;
$$;
revoke all on function public.club_meu_link() from public, anon, authenticated;
grant execute on function public.club_meu_link() to authenticated;
