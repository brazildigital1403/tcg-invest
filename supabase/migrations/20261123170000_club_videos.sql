-- Videos do YouTube na home do Poke Creators Club (aprovado pelo Du em 23/11/2026, mockup
-- "Videos do Club", desenho A: destaque e lista). Mesmo molde das Trends: a tabela nasce trancada
-- (RLS sem policy + revoke) e so a funcao de leitura e aberta. A home nunca chama o YouTube:
-- a capa vive no bucket club-fotos e o card abre o video em outra aba.
--
-- Rollback:
--   drop function public.club_videos_lista();
--   drop table public.club_videos;

create table public.club_videos (
  id           uuid primary key default gen_random_uuid(),
  youtube_id   text not null unique check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  titulo       text not null check (char_length(titulo) between 3 and 90),
  tipo         text not null default 'encontro' check (tipo in ('encontro', 'aula')),
  duracao_seg  integer not null check (duracao_seg > 0),
  publicado_em date not null,
  capa_path    text check (capa_path ~ '^videos/[A-Za-z0-9/_-]+\.(webp|jpg|png)$'),
  ordem        integer not null default 0,
  status       text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  created_at   timestamptz not null default now()
);
alter table public.club_videos enable row level security;
revoke all on public.club_videos from public, anon, authenticated;

create or replace function public.club_videos_lista()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', v.youtube_id, 'titulo', v.titulo, 'tipo', v.tipo,
    'duracao', v.duracao_seg, 'data', v.publicado_em, 'capa', v.capa_path
  ) order by v.publicado_em desc, v.ordem, v.created_at desc), '[]'::jsonb)
  from (select * from public.club_videos where status = 'publicado'
        order by publicado_em desc, ordem, created_at desc limit 6) v;
$function$;

revoke all on function public.club_videos_lista() from public, anon, authenticated;
grant execute on function public.club_videos_lista() to anon, authenticated;

insert into public.club_videos (youtube_id, titulo, tipo, duracao_seg, publicado_em, capa_path, ordem, status) values
  ('kpyXPt6hAlg', 'Encontro com CasalTCG',     'encontro', 7143, '2026-11-23', 'videos/kpyXPt6hAlg.jpg', 1, 'publicado'),
  ('fRI_MUcBTTk', 'Aula TCG com Pokevandy',    'aula',     6260, '2026-11-09', 'videos/fRI_MUcBTTk.jpg', 2, 'publicado'),
  ('CmLvCjLKM_4', 'Encontro com o CAST',       'encontro', 6664, '2026-10-23', 'videos/CmLvCjLKM_4.jpg', 3, 'publicado')
on conflict (youtube_id) do nothing;
