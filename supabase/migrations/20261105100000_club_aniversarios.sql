-- ============================================================================
-- Aniversariantes do Poke Creators Club (05/11/2026, wireframe aprovado)
-- ============================================================================
-- POR QUE: lista de aniversarios do Club, com foto opcional. Decisao do Du: quem
-- esta logado ve a lista. Visitante sem conta nao ve nada.
--
-- Sem ano de nascimento, de proposito. Nao reaproveita users.data_nascimento,
-- que tem ano e foi coletada para outro fim. Sair da lista apaga a linha.
--
-- Tabela nao lida pelo navegador: RLS ligada sem policy e revoke. Tudo passa
-- pelas funcoes security definer deste arquivo.
--
-- Foto: bucket publico club-fotos, mesmo modelo do PDF de Parceiros (decisao do
-- Du). Quem tem a URL direta abre a foto; a foto sozinha nao traz @ nem data.
-- Cada pessoa so escreve e apaga na propria pasta ({user_id}/...).
--
-- ROLLBACK:
--   drop function public.club_aniversario_sair();
--   drop function public.club_aniversario_salvar(text, smallint, smallint, text, boolean);
--   drop function public.club_aniversarios_lista();
--   drop table public.club_aniversarios;
--   drop policy club_fotos_ler_propria on storage.objects;
--   drop policy club_fotos_subir_propria on storage.objects;
--   drop policy club_fotos_apagar_propria on storage.objects;
--   delete from storage.buckets where id = 'club-fotos';  -- so com o bucket vazio
-- ============================================================================

create table public.club_aniversarios (
  user_id        uuid primary key references public.users(id) on delete cascade,
  instagram      text not null unique check (instagram ~ '^[a-z0-9._]{1,30}$'),
  dia            smallint not null,
  mes            smallint not null check (mes between 1 and 12),
  foto_path      text,
  pokemon        text,
  consentido_em  timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- 29/02 e aceito: em ano nao bissexto a tela mostra em 28/02.
  constraint club_aniversarios_data_valida check (
    dia >= 1 and dia <= case when mes = 2 then 29 when mes in (4, 6, 9, 11) then 30 else 31 end
  )
);

-- Tabela nova nasce exposta no Supabase: RLS + revoke na criacao.
alter table public.club_aniversarios enable row level security;
revoke all on public.club_aniversarios from public, anon, authenticated;

-- ── Leitura ─────────────────────────────────────────────────────────────────

create or replace function public.club_aniversarios_lista()
returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  return jsonb_build_object(
    'lista', coalesce((
      select jsonb_agg(jsonb_build_object(
        'instagram', a.instagram, 'dia', a.dia, 'mes', a.mes,
        'foto_path', a.foto_path, 'pokemon', a.pokemon, 'eu', a.user_id = v_uid
      ) order by a.mes, a.dia, a.instagram)
      from public.club_aniversarios a
    ), '[]'::jsonb),
    -- Preenche a folha de quem ainda nao esta na lista. So os dados da propria pessoa.
    'sugestao', (
      select jsonb_build_object('instagram', p.instagram, 'pokemon', p.pokemon)
      from public.amigo_secreto_participantes p
      where p.user_id = v_uid
      order by p.created_at desc limit 1
    )
  );
end;
$$;
revoke all on function public.club_aniversarios_lista() from public, anon, authenticated;
grant execute on function public.club_aniversarios_lista() to authenticated;

-- ── Escrita ─────────────────────────────────────────────────────────────────

create or replace function public.club_aniversario_salvar(
  p_instagram text, p_dia smallint, p_mes smallint, p_foto_path text, p_aceite boolean
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ig  text := lower(trim(coalesce(p_instagram, '')));
  v_pk  text;
  v_max smallint;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if v_ig !~ '^[a-z0-9._]{1,30}$' then raise exception 'instagram_invalido'; end if;
  if p_aceite is not true then raise exception 'aceite_obrigatorio'; end if;
  -- Variavel de proposito: um "case ... then" dentro do if confunde o plpgsql.
  v_max := case when p_mes = 2 then 29 when p_mes in (4, 6, 9, 11) then 30 else 31 end;
  if p_mes is null or p_dia is null or p_mes not between 1 and 12 or p_dia < 1 or p_dia > v_max then
    raise exception 'data_invalida';
  end if;
  -- A foto so pode apontar para a pasta da propria pessoa.
  if p_foto_path is not null and split_part(p_foto_path, '/', 1) <> v_uid::text then
    raise exception 'foto_invalida';
  end if;
  if exists (select 1 from public.club_aniversarios a where a.instagram = v_ig and a.user_id <> v_uid) then
    raise exception 'instagram_ja_usado';
  end if;

  select p.pokemon into v_pk
  from public.amigo_secreto_participantes p
  where p.user_id = v_uid
  order by p.created_at desc limit 1;

  insert into public.club_aniversarios (user_id, instagram, dia, mes, foto_path, pokemon)
  values (v_uid, v_ig, p_dia, p_mes, p_foto_path, v_pk)
  on conflict (user_id) do update
    set instagram = excluded.instagram, dia = excluded.dia, mes = excluded.mes,
        foto_path = excluded.foto_path, pokemon = coalesce(excluded.pokemon, public.club_aniversarios.pokemon),
        consentido_em = now(), updated_at = now();

  return public.club_aniversarios_lista();
end;
$$;
revoke all on function public.club_aniversario_salvar(text, smallint, smallint, text, boolean) from public, anon, authenticated;
grant execute on function public.club_aniversario_salvar(text, smallint, smallint, text, boolean) to authenticated;

create or replace function public.club_aniversario_sair()
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  delete from public.club_aniversarios where user_id = v_uid;
  return public.club_aniversarios_lista();
end;
$$;
revoke all on function public.club_aniversario_sair() from public, anon, authenticated;
grant execute on function public.club_aniversario_sair() to authenticated;

-- ── Fotos ───────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-fotos', 'club-fotos', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Apagar exige tambem poder ler a linha do objeto: a leitura aberta da URL
-- publica nao passa por policy, entao esta policy so cobre a propria pasta.
create policy club_fotos_ler_propria on storage.objects
  for select to authenticated
  using (bucket_id = 'club-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy club_fotos_subir_propria on storage.objects
  for insert to authenticated
  with check (bucket_id = 'club-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy club_fotos_apagar_propria on storage.objects
  for delete to authenticated
  using (bucket_id = 'club-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
