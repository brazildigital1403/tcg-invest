-- Trends do Poke Creators Club (aprovado pelo Du em 11/11/2026, mockup "Trends na home").
-- A home do Club mostra o que o grupo esta fazendo agora: cada trend e um carrossel com
-- o post de cada creator, na ordem combinada. A edicao pelo admin entra depois; por ora
-- a trend nasce por migration. Tudo nasce trancado: RLS sem policy + revoke nas tabelas,
-- e so a funcao de leitura e aberta (a home e publica, como o hero).
--
-- Rollback:
--   drop function public.club_trends_lista();
--   drop table public.club_trend_posts;
--   drop table public.club_trends;

create table public.club_trends (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  titulo       text not null check (char_length(titulo) between 3 and 60),
  tema         text not null check (char_length(tema) between 2 and 30),
  status       text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  ordem        integer not null default 0,
  publicado_em timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.club_trends enable row level security;
revoke all on public.club_trends from public, anon, authenticated;

create table public.club_trend_posts (
  id         uuid primary key default gen_random_uuid(),
  trend_id   uuid not null references public.club_trends(id) on delete cascade,
  posicao    integer not null check (posicao > 0),
  nome       text not null check (char_length(nome) between 1 and 40),
  pessoa     text check (char_length(pessoa) <= 40),
  tipo       text not null default 'post' check (tipo in ('post', 'reel')),
  link_url   text check (link_url ~ '^https://(www\.)?instagram\.com/(p|reel|tv)/[A-Za-z0-9_-]+/?(\?[^[:space:]]*)?$'),
  capa_path  text check (capa_path ~ '^trends/[A-Za-z0-9/_-]+\.(webp|jpg|png)$'),
  status     text not null default 'aguardando' check (status in ('aguardando', 'publicado')),
  created_at timestamptz not null default now(),
  constraint club_trend_posts_posicao_unica unique (trend_id, posicao) deferrable initially deferred,
  constraint club_trend_posts_publicado_tem_link check (status <> 'publicado' or link_url is not null)
);
alter table public.club_trend_posts enable row level security;
revoke all on public.club_trend_posts from public, anon, authenticated;

-- Leitura publica da home: so trends publicadas com ao menos um post publicado.
-- Quem ainda nao postou vem so como nome em "aguardando" (card "Vem mais por ai").
create or replace function public.club_trends_lista()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'slug', t.slug, 'titulo', t.titulo, 'tema', t.tema,
    'postaram', (select count(*) from public.club_trend_posts p where p.trend_id = t.id and p.status = 'publicado'),
    'total', (select count(*) from public.club_trend_posts p where p.trend_id = t.id),
    'aguardando', (select coalesce(jsonb_agg(p.nome order by p.posicao), '[]'::jsonb)
                     from public.club_trend_posts p where p.trend_id = t.id and p.status = 'aguardando'),
    'posts', (select coalesce(jsonb_agg(jsonb_build_object(
                       'nome', p.nome, 'pessoa', p.pessoa, 'tipo', p.tipo, 'link', p.link_url, 'capa', p.capa_path
                     ) order by p.posicao), '[]'::jsonb)
                from public.club_trend_posts p where p.trend_id = t.id and p.status = 'publicado')
  ) order by t.ordem, t.created_at desc), '[]'::jsonb)
  from public.club_trends t
  where t.status = 'publicado'
    and exists (select 1 from public.club_trend_posts p where p.trend_id = t.id and p.status = 'publicado');
$function$;

revoke all on function public.club_trends_lista() from public, anon, authenticated;
grant execute on function public.club_trends_lista() to anon, authenticated;
