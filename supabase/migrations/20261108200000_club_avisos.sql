-- ============================================================================
-- Avisos do Poke Creators Club (08/11/2026, wireframe aprovado)
-- ============================================================================
-- POR QUE: quarta frente do Club. Os avisos saiam so no canal "Avisos" do
-- WhatsApp; aqui ganham lista, prazo, fixado, atualizacoes e enquete. Publica
-- quem tem o papel 'avisos' (mesmo modelo da Agenda) e o /admin; ve quem tem
-- conta na Bynx.
--
-- Decisoes do Du (08/11): enquete na v1, o membro ve so os numeros e a
-- organizacao ve quem votou; link de pagamento de terceiro permitido (a tela
-- mostra que e fora da Bynx); assinatura "por @"; nada e apagado depois de
-- publicado, so arquivado.
--
-- Texto na sintaxe do WhatsApp (*negrito*, - lista, link): a tela monta nos do
-- React, nunca HTML. Emoji sai ao salvar (a interface da Bynx nao usa emoji).
--
-- Mesmo desenho da Agenda: tabelas com RLS sem policy + revoke; funcoes
-- publicas conferem o papel e chamam as *_interno, que o /admin usa pela chave
-- de servico; tudo registrado em club_organizacao_log.
--
-- ROLLBACK (na ordem):
--   drop policy club_fotos_avisos_ler on storage.objects;
--   drop policy club_fotos_avisos_subir on storage.objects;
--   drop policy club_fotos_avisos_apagar on storage.objects;
--   drop function public.club_aviso_votos(uuid);
--   drop function public.club_aviso_votos_interno(uuid);
--   drop function public.club_aviso_atualizar(uuid, text);
--   drop function public.club_aviso_atualizar_interno(uuid, text, uuid);
--   drop function public.club_aviso_estado(uuid, text);
--   drop function public.club_aviso_estado_interno(uuid, text, uuid);
--   drop function public.club_aviso_salvar(uuid, jsonb, text);
--   drop function public.club_aviso_salvar_interno(uuid, jsonb, text, uuid);
--   drop function public.club_avisos_admin_lista();
--   drop function public.club_avisos_organizar_lista();
--   drop function public.club_aviso_votar(uuid, integer[]);
--   drop function public.club_aviso(text);
--   drop function public.club_avisos_lista();
--   drop function public.club_aviso_json(public.club_avisos, uuid, boolean);
--   drop function public.club_sem_emoji(text);
--   drop table public.club_avisos_votos;
--   drop table public.club_avisos;
--   (so se ninguem tiver o papel 'avisos':)
--   alter table public.club_organizadores drop constraint club_organizadores_papeis_check;
--   alter table public.club_organizadores add constraint club_organizadores_papeis_check
--     check (cardinality(papeis) >= 1 and papeis <@ array['agenda', 'aniversariantes']);
-- ============================================================================

-- ── Papel novo ──────────────────────────────────────────────────────────────

alter table public.club_organizadores drop constraint club_organizadores_papeis_check;
alter table public.club_organizadores add constraint club_organizadores_papeis_check
  check (cardinality(papeis) >= 1 and papeis <@ array['agenda', 'aniversariantes', 'avisos']);

-- ── Tabelas ─────────────────────────────────────────────────────────────────

create table public.club_avisos (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 90),
  titulo            text not null check (char_length(titulo) between 3 and 80),
  corpo             text not null check (char_length(corpo) between 1 and 3000),
  importante        text check (char_length(importante) <= 300),
  imagens           text[] not null default '{}' check (cardinality(imagens) <= 3),
  -- [{rotulo, url}], ate 3, url sempre https.
  links             jsonb not null default '[]' check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 3),
  prazo_em          timestamptz,
  fixado            boolean not null default false,
  evento_id         uuid references public.club_eventos(id) on delete set null,
  enquete_pergunta  text check (char_length(enquete_pergunta) <= 120),
  enquete_regra     text check (char_length(enquete_regra) <= 160),
  enquete_multipla  boolean not null default false,
  enquete_opcoes    text[] not null default '{}' check (cardinality(enquete_opcoes) <= 8),
  -- [{em, texto}] acrescentadas depois de publicar (aviso que evolui).
  atualizacoes      jsonb not null default '[]' check (jsonb_typeof(atualizacoes) = 'array' and jsonb_array_length(atualizacoes) <= 20),
  status            text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  publicado_em      timestamptz,
  editado_em        timestamptz,
  criado_por        uuid references public.users(id) on delete set null,
  editado_por       uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint club_avisos_enquete check (
    (enquete_pergunta is null and cardinality(enquete_opcoes) = 0)
    or (enquete_pergunta is not null and cardinality(enquete_opcoes) between 2 and 8)
  )
);
create index club_avisos_lista_idx on public.club_avisos (fixado desc, publicado_em desc) where status = 'publicado';
alter table public.club_avisos enable row level security;
revoke all on public.club_avisos from public, anon, authenticated;

-- Um voto por conta e aviso; opcoes guarda as posicoes escolhidas (1 = primeira).
create table public.club_avisos_votos (
  aviso_id    uuid not null references public.club_avisos(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  opcoes      smallint[] not null check (cardinality(opcoes) between 1 and 8),
  updated_at  timestamptz not null default now(),
  primary key (aviso_id, user_id)
);
alter table public.club_avisos_votos enable row level security;
revoke all on public.club_avisos_votos from public, anon, authenticated;

-- ── Apoio ───────────────────────────────────────────────────────────────────

-- Tira emoji e caractere de controle (menos a quebra de linha). Interna.
create or replace function public.club_sem_emoji(t text)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  -- Sem o emoji, sobram espacos: junta os repetidos e tira os de comeco e fim de linha.
  select nullif(btrim(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(
      regexp_replace(coalesce(t, ''),
        '[' || chr(126976) || '-' || chr(129791) || chr(9728) || '-' || chr(10175) || chr(65039) || chr(8205) || chr(8419) || chr(11088) || chr(11093) || chr(12336) || chr(12349) || chr(127462) || '-' || chr(127487) || ']',
        '', 'g'),
      '[\x01-\x09\x0b-\x1f\x7f]', '', 'g'),
      '[ ]{2,}', ' ', 'g'),
      '\n[ ]+', E'\n', 'g'),
      '[ ]+\n', E'\n', 'g'),
    E' \n'), '')
$$;
revoke all on function public.club_sem_emoji(text) from public, anon, authenticated;

-- Formato unico do aviso. p_uid = quem pergunta (meu voto). p_completo traz corpo,
-- atualizacoes e a contagem da enquete; sem ele, so o que a lista usa. Interna.
create or replace function public.club_aviso_json(a public.club_avisos, p_uid uuid, p_completo boolean)
returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', a.id, 'slug', a.slug, 'titulo', a.titulo,
    'resumo', left(regexp_replace(replace(a.corpo, '*', ''), '\s+', ' ', 'g'), 180),
    'imagens', to_jsonb(a.imagens), 'links', a.links, 'prazo_em', a.prazo_em, 'fixado', a.fixado,
    'status', a.status, 'publicado_em', a.publicado_em, 'editado_em', a.editado_em,
    'autor', (select coalesce(u.instagram, u.username) from public.users u where u.id = a.criado_por),
    'tem_atualizacoes', jsonb_array_length(a.atualizacoes) > 0,
    'enquete', case when a.enquete_pergunta is null then null else jsonb_build_object(
      'pergunta', a.enquete_pergunta, 'regra', a.enquete_regra, 'multipla', a.enquete_multipla,
      'opcoes', to_jsonb(a.enquete_opcoes),
      'aberta', a.status = 'publicado' and (a.prazo_em is null or a.prazo_em > now()),
      'meu_voto', (select to_jsonb(v.opcoes) from public.club_avisos_votos v where v.aviso_id = a.id and v.user_id = p_uid),
      'total', (select count(*) from public.club_avisos_votos v where v.aviso_id = a.id),
      'contagem', case when p_completo then (
        select coalesce(jsonb_agg(coalesce(c.n, 0) order by i.i), '[]'::jsonb)
        from generate_subscripts(a.enquete_opcoes, 1) i(i)
        left join (select o.o, count(*) n from public.club_avisos_votos v, unnest(v.opcoes) o(o) where v.aviso_id = a.id group by o.o) c on c.o = i.i
      ) end
    ) end
  ) || case when p_completo then jsonb_build_object(
    'corpo', a.corpo, 'importante', a.importante, 'atualizacoes', a.atualizacoes,
    'evento', (select jsonb_build_object('slug', e.slug, 'titulo', e.titulo, 'inicio_data', e.inicio_data, 'hora_inicio', to_char(e.hora_inicio, 'HH24:MI'), 'status', e.status)
               from public.club_eventos e where e.id = a.evento_id and e.status <> 'rascunho')
  ) else '{}'::jsonb end
$$;
revoke all on function public.club_aviso_json(public.club_avisos, uuid, boolean) from public, anon, authenticated;

-- ── Leitura (membro logado) ─────────────────────────────────────────────────

create or replace function public.club_avisos_lista()
returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  return jsonb_build_object(
    'avisos', coalesce((
      select jsonb_agg(public.club_aviso_json(a, v_uid, false) order by a.fixado desc, a.publicado_em desc)
      from (select * from public.club_avisos where status = 'publicado' order by fixado desc, publicado_em desc limit 100) a
    ), '[]'::jsonb),
    'papeis', public.club_meus_papeis()
  );
end;
$$;
revoke all on function public.club_avisos_lista() from public, anon, authenticated;
grant execute on function public.club_avisos_lista() to authenticated;

-- Rascunho so para quem organiza; arquivado devolve so o aviso de arquivado.
create or replace function public.club_aviso(p_slug text)
returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_a   public.club_avisos;
  v_org boolean;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  select * into v_a from public.club_avisos a where a.slug = p_slug;
  if not found then raise exception 'aviso_nao_encontrado'; end if;
  v_org := public.club_tem_papel('avisos');
  if v_a.status = 'rascunho' and not v_org then raise exception 'aviso_nao_encontrado'; end if;
  if v_a.status = 'arquivado' and not v_org then
    return jsonb_build_object('arquivado', true, 'papeis', public.club_meus_papeis());
  end if;
  return jsonb_build_object('aviso', public.club_aviso_json(v_a, v_uid, true), 'papeis', public.club_meus_papeis());
end;
$$;
revoke all on function public.club_aviso(text) from public, anon, authenticated;
grant execute on function public.club_aviso(text) to authenticated;

-- Voto do membro. Muda o voto ate o prazo. p_opcoes: posicoes (1 = primeira).
create or replace function public.club_aviso_votar(p_aviso uuid, p_opcoes integer[])
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_a   public.club_avisos;
  v_ops smallint[];
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  -- for share: o organizador nao troca as opcoes no meio do voto.
  select * into v_a from public.club_avisos a where a.id = p_aviso for share;
  if not found or v_a.status <> 'publicado' then raise exception 'aviso_nao_encontrado'; end if;
  if v_a.enquete_pergunta is null then raise exception 'sem_enquete'; end if;
  if exists (select 1 from unnest(coalesce(p_opcoes, '{}')) o where o is null or o < 1 or o > cardinality(v_a.enquete_opcoes)) then raise exception 'opcao_invalida'; end if;
  if v_a.prazo_em is not null and v_a.prazo_em <= now() then raise exception 'enquete_encerrada'; end if;
  select array_agg(distinct o::smallint order by o::smallint) into v_ops from unnest(coalesce(p_opcoes, '{}')) o;
  if v_ops is null or cardinality(v_ops) = 0 then raise exception 'voto_vazio'; end if;
  if not v_a.enquete_multipla and cardinality(v_ops) > 1 then raise exception 'so_uma_opcao'; end if;
  insert into public.club_avisos_votos (aviso_id, user_id, opcoes) values (v_a.id, v_uid, v_ops)
  on conflict (aviso_id, user_id) do update set opcoes = excluded.opcoes, updated_at = now();
  return public.club_aviso_json(v_a, v_uid, true);
end;
$$;
revoke all on function public.club_aviso_votar(uuid, integer[]) from public, anon, authenticated;
grant execute on function public.club_aviso_votar(uuid, integer[]) to authenticated;

-- ── Organizacao ─────────────────────────────────────────────────────────────

create or replace function public.club_avisos_organizar_lista()
returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('avisos') then raise exception 'sem_papel'; end if;
  return coalesce((
    select jsonb_agg(public.club_aviso_json(a, auth.uid(), true) || jsonb_build_object(
      'editado_por', (select coalesce(u.instagram, u.username) from public.users u where u.id = a.editado_por),
      'updated_at', a.updated_at, 'evento_id', a.evento_id
    ) order by a.status = 'arquivado', a.fixado desc, coalesce(a.publicado_em, a.created_at) desc)
    from public.club_avisos a
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.club_avisos_organizar_lista() from public, anon, authenticated;
grant execute on function public.club_avisos_organizar_lista() to authenticated;

-- Mesma lista para o /admin (chave de servico, sem auth.uid()).
create or replace function public.club_avisos_admin_lista()
returns jsonb
language sql security definer stable
set search_path = public, pg_temp
as $$
  select coalesce((
    select jsonb_agg(public.club_aviso_json(a, null, true) || jsonb_build_object(
      'editado_por', (select coalesce(u.instagram, u.username) from public.users u where u.id = a.editado_por),
      'updated_at', a.updated_at, 'evento_id', a.evento_id
    ) order by a.status = 'arquivado', a.fixado desc, coalesce(a.publicado_em, a.created_at) desc)
    from public.club_avisos a
  ), '[]'::jsonb)
$$;
revoke all on function public.club_avisos_admin_lista() from public, anon, authenticated;
grant execute on function public.club_avisos_admin_lista() to service_role;

-- Cria ou edita. p_acao: 'rascunho' (novo ou ainda rascunho), 'publicar' ou
-- 'salvar' (mantem o estado). p_autor nulo = /admin. Slug fixo depois de criado.
-- Opcoes da enquete nao mudam depois do primeiro voto (mudaria o que o voto quer dizer).
create or replace function public.club_aviso_salvar_interno(p_id uuid, p jsonb, p_acao text, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_old     public.club_avisos;
  v_novo    boolean := p_id is null;
  v_titulo  text := public.club_sem_emoji(p->>'titulo');
  v_corpo   text := public.club_sem_emoji(p->>'corpo');
  v_imp     text := public.club_sem_emoji(p->>'importante');
  v_imgs    text[] := '{}';
  v_links   jsonb := '[]';
  v_prazo   timestamptz;
  v_fixado  boolean := lower(coalesce(p->>'fixado', '')) = 'true';
  v_evento  uuid;
  v_perg    text := public.club_sem_emoji(p->'enquete'->>'pergunta');
  v_regra   text := public.club_sem_emoji(p->'enquete'->>'regra');
  v_mult    boolean := lower(coalesce(p->'enquete'->>'multipla', '')) = 'true';
  v_ops     text[] := '{}';
  v_status  text;
  v_slug    text;
  v_base    text;
  v_n       int := 1;
  v_a       public.club_avisos;
  v_x       jsonb;
  v_t       text;
begin
  if p_acao is null or p_acao not in ('rascunho', 'publicar', 'salvar') then raise exception 'acao_invalida'; end if;
  if not v_novo then
    select * into v_old from public.club_avisos a where a.id = p_id for update;
    if not found then raise exception 'aviso_nao_encontrado'; end if;
    if v_old.status = 'arquivado' then raise exception 'aviso_arquivado'; end if;
  end if;

  if v_titulo is null or char_length(v_titulo) < 3 or char_length(v_titulo) > 80 then raise exception 'titulo_invalido'; end if;
  if v_corpo is null then raise exception 'corpo_obrigatorio'; end if;
  if char_length(v_corpo) > 3000 then raise exception 'corpo_longo'; end if;
  if v_imp is not null and char_length(v_imp) > 300 then raise exception 'importante_longo'; end if;

  if jsonb_typeof(p->'imagens') = 'array' then
    for v_t in select jsonb_array_elements_text(p->'imagens') loop
      if v_t !~ '^avisos/[A-Za-z0-9-]+\.(webp|jpg|png)$' then raise exception 'imagem_invalida'; end if;
      if exists (select 1 from public.club_avisos a where v_t = any(a.imagens) and a.id is distinct from p_id) then raise exception 'imagem_invalida'; end if;
      if not v_t = any(v_imgs) then v_imgs := v_imgs || v_t; end if;
    end loop;
  end if;
  if cardinality(v_imgs) > 3 then raise exception 'imagens_demais'; end if;

  if jsonb_typeof(p->'links') = 'array' then
    for v_x in select jsonb_array_elements(p->'links') loop
      continue when coalesce(btrim(v_x->>'url'), '') = '';
      if (v_x->>'url') !~ '^https://[^[:space:][:cntrl:]]+$' or char_length(v_x->>'url') > 500 then raise exception 'link_invalido'; end if;
      v_t := public.club_sem_emoji(v_x->>'rotulo');
      if v_t is not null and char_length(v_t) > 40 then raise exception 'rotulo_longo'; end if;
      v_links := v_links || jsonb_build_array(jsonb_build_object('rotulo', v_t, 'url', btrim(v_x->>'url')));
    end loop;
  end if;
  if jsonb_array_length(v_links) > 3 then raise exception 'links_demais'; end if;

  begin
    v_prazo := nullif(p->>'prazo_em', '')::timestamptz;
  exception when others then
    raise exception 'prazo_invalido';
  end;
  begin
    v_evento := nullif(p->>'evento_id', '')::uuid;
  exception when others then
    raise exception 'evento_nao_encontrado';
  end;
  if v_prazo is not null and v_prazo <= now() and (v_novo or v_prazo is distinct from v_old.prazo_em) then raise exception 'prazo_passado'; end if;
  if v_evento is not null and not exists (select 1 from public.club_eventos e where e.id = v_evento) then raise exception 'evento_nao_encontrado'; end if;

  if v_perg is not null then
    if jsonb_typeof(p->'enquete'->'opcoes') = 'array' then
      for v_t in select public.club_sem_emoji(o) from jsonb_array_elements_text(p->'enquete'->'opcoes') o loop
        continue when v_t is null;
        if char_length(v_t) > 60 then raise exception 'opcao_longa'; end if;
        v_ops := v_ops || v_t;
      end loop;
    end if;
    if cardinality(v_ops) < 2 or cardinality(v_ops) > 8 then raise exception 'enquete_opcoes'; end if;
    if char_length(v_perg) > 120 or (v_regra is not null and char_length(v_regra) > 160) then raise exception 'enquete_longa'; end if;
  else
    v_regra := null; v_mult := false;
  end if;
  if not v_novo and exists (select 1 from public.club_avisos_votos v where v.aviso_id = p_id)
     and (v_ops is distinct from v_old.enquete_opcoes or v_mult is distinct from v_old.enquete_multipla) then
    raise exception 'enquete_com_votos';
  end if;

  v_status := case when p_acao = 'publicar' then 'publicado' when p_acao = 'rascunho' then 'rascunho' else coalesce(v_old.status, 'rascunho') end;
  if p_acao = 'rascunho' and not v_novo and v_old.status <> 'rascunho' then raise exception 'ja_publicado'; end if;
  -- Trava global: duas acoes de fixar ao mesmo tempo nao passam as duas.
  -- Rascunho fixado que vira publicado tambem conta (antes furava o limite).
  if v_fixado and v_status = 'publicado' then perform pg_advisory_xact_lock(hashtext('club_avisos_fixados')); end if;
  if v_fixado and v_status = 'publicado' and (v_novo or not v_old.fixado or v_old.status <> 'publicado')
     and (select count(*) from public.club_avisos a where a.fixado and a.status = 'publicado' and a.id is distinct from p_id) >= 3 then
    raise exception 'fixados_demais';
  end if;

  if v_novo then
    v_base := left(trim(both '-' from regexp_replace(lower(public.unaccent(v_titulo)), '[^a-z0-9]+', '-', 'g')), 70);
    if v_base = '' then v_base := 'aviso'; end if;
    v_base := v_base || '-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
    v_slug := v_base;
    while exists (select 1 from public.club_avisos a where a.slug = v_slug) loop
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    end loop;
    insert into public.club_avisos (slug, titulo, corpo, importante, imagens, links, prazo_em, fixado, evento_id,
      enquete_pergunta, enquete_regra, enquete_multipla, enquete_opcoes, status, publicado_em, criado_por, editado_por)
    values (v_slug, v_titulo, v_corpo, v_imp, v_imgs, v_links, v_prazo, v_fixado, v_evento,
      v_perg, v_regra, v_mult, v_ops, v_status, case when v_status = 'publicado' then now() end, p_autor, p_autor)
    returning * into v_a;
  else
    update public.club_avisos a set
      titulo = v_titulo, corpo = v_corpo, importante = v_imp, imagens = v_imgs, links = v_links,
      prazo_em = v_prazo, fixado = v_fixado, evento_id = v_evento,
      enquete_pergunta = v_perg, enquete_regra = v_regra, enquete_multipla = v_mult, enquete_opcoes = v_ops,
      status = v_status,
      publicado_em = coalesce(a.publicado_em, case when v_status = 'publicado' then now() end),
      -- "editado" so aparece quando muda o que o membro le depois de publicado.
      editado_em = case when v_old.status = 'publicado' and (v_titulo, v_corpo, v_imp) is distinct from (v_old.titulo, v_old.corpo, v_old.importante)
                        then now() else a.editado_em end,
      editado_por = p_autor, updated_at = now()
    where a.id = p_id
    returning * into v_a;
  end if;

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (p_autor, 'avisos', case when v_novo then 'criar' else 'editar' end || ':' || p_acao, v_a.slug,
          case when v_novo then jsonb_build_object('status', v_a.status)
               else jsonb_build_object('status', v_a.status, 'titulo_antes', v_old.titulo, 'corpo_antes', v_old.corpo) end);

  return public.club_aviso_json(v_a, p_autor, true);
end;
$$;
revoke all on function public.club_aviso_salvar_interno(uuid, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.club_aviso_salvar_interno(uuid, jsonb, text, uuid) to service_role;

create or replace function public.club_aviso_salvar(p_id uuid, p jsonb, p_acao text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('avisos') then raise exception 'sem_papel'; end if;
  return public.club_aviso_salvar_interno(p_id, p, p_acao, auth.uid());
end;
$$;
revoke all on function public.club_aviso_salvar(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.club_aviso_salvar(uuid, jsonb, text) to authenticated;

-- p_acao: 'fixar', 'desafixar', 'arquivar', 'restaurar' ou 'excluir' (so
-- rascunho; devolve as imagens para quem chamou apagar do storage).
create or replace function public.club_aviso_estado_interno(p_id uuid, p_acao text, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_a public.club_avisos;
begin
  select * into v_a from public.club_avisos a where a.id = p_id for update;
  if not found then raise exception 'aviso_nao_encontrado'; end if;
  if p_acao = 'excluir' then
    if v_a.status <> 'rascunho' then raise exception 'so_rascunho'; end if;
    delete from public.club_avisos where id = p_id;
    insert into public.club_organizacao_log (user_id, papel, acao, alvo) values (p_autor, 'avisos', 'excluir', v_a.slug);
    return jsonb_build_object('excluido', true, 'imagens', to_jsonb(v_a.imagens));
  elsif p_acao = 'fixar' then
    if v_a.status <> 'publicado' then raise exception 'estado_invalido'; end if;
    perform pg_advisory_xact_lock(hashtext('club_avisos_fixados'));
    if not v_a.fixado and (select count(*) from public.club_avisos a where a.fixado and a.status = 'publicado') >= 3 then raise exception 'fixados_demais'; end if;
    update public.club_avisos set fixado = true, editado_por = p_autor, updated_at = now() where id = p_id returning * into v_a;
  elsif p_acao = 'desafixar' then
    update public.club_avisos set fixado = false, editado_por = p_autor, updated_at = now() where id = p_id returning * into v_a;
  elsif p_acao = 'arquivar' then
    if v_a.status <> 'publicado' then raise exception 'estado_invalido'; end if;
    update public.club_avisos set status = 'arquivado', fixado = false, editado_por = p_autor, updated_at = now() where id = p_id returning * into v_a;
  elsif p_acao = 'restaurar' then
    if v_a.status <> 'arquivado' then raise exception 'estado_invalido'; end if;
    update public.club_avisos set status = 'publicado', editado_por = p_autor, updated_at = now() where id = p_id returning * into v_a;
  else
    raise exception 'acao_invalida';
  end if;
  insert into public.club_organizacao_log (user_id, papel, acao, alvo) values (p_autor, 'avisos', p_acao, v_a.slug);
  return public.club_aviso_json(v_a, p_autor, true);
end;
$$;
revoke all on function public.club_aviso_estado_interno(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.club_aviso_estado_interno(uuid, text, uuid) to service_role;

create or replace function public.club_aviso_estado(p_id uuid, p_acao text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('avisos') then raise exception 'sem_papel'; end if;
  return public.club_aviso_estado_interno(p_id, p_acao, auth.uid());
end;
$$;
revoke all on function public.club_aviso_estado(uuid, text) from public, anon, authenticated;
grant execute on function public.club_aviso_estado(uuid, text) to authenticated;

-- Acrescenta uma atualizacao datada ao aviso publicado (o mais novo primeiro).
create or replace function public.club_aviso_atualizar_interno(p_id uuid, p_texto text, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_a public.club_avisos;
  v_t text := public.club_sem_emoji(p_texto);
begin
  select * into v_a from public.club_avisos a where a.id = p_id for update;
  if not found then raise exception 'aviso_nao_encontrado'; end if;
  if v_a.status <> 'publicado' then raise exception 'estado_invalido'; end if;
  if v_t is null then raise exception 'atualizacao_vazia'; end if;
  if char_length(v_t) > 500 then raise exception 'atualizacao_longa'; end if;
  if jsonb_array_length(v_a.atualizacoes) >= 20 then raise exception 'atualizacoes_demais'; end if;
  update public.club_avisos set
    atualizacoes = jsonb_build_array(jsonb_build_object('em', now(), 'texto', v_t)) || atualizacoes,
    editado_por = p_autor, updated_at = now()
  where id = p_id returning * into v_a;
  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe) values (p_autor, 'avisos', 'atualizar', v_a.slug, jsonb_build_object('texto', v_t));
  return public.club_aviso_json(v_a, p_autor, true);
end;
$$;
revoke all on function public.club_aviso_atualizar_interno(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.club_aviso_atualizar_interno(uuid, text, uuid) to service_role;

create or replace function public.club_aviso_atualizar(p_id uuid, p_texto text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('avisos') then raise exception 'sem_papel'; end if;
  return public.club_aviso_atualizar_interno(p_id, p_texto, auth.uid());
end;
$$;
revoke all on function public.club_aviso_atualizar(uuid, text) from public, anon, authenticated;
grant execute on function public.club_aviso_atualizar(uuid, text) to authenticated;

-- Quem votou em que, so para a organizacao (decisao do Du: o membro ve so os numeros).
create or replace function public.club_aviso_votos_interno(p_id uuid)
returns jsonb
language sql security definer stable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('opcao', i.i, 'texto', a.enquete_opcoes[i.i], 'contas', coalesce((
      select jsonb_agg(coalesce(u.instagram, u.username) order by coalesce(u.instagram, u.username))
      from public.club_avisos_votos v join public.users u on u.id = v.user_id
      where v.aviso_id = a.id and i.i = any(v.opcoes)
    ), '[]'::jsonb)) order by i.i), '[]'::jsonb)
  from public.club_avisos a, generate_subscripts(a.enquete_opcoes, 1) i(i)
  where a.id = p_id
$$;
revoke all on function public.club_aviso_votos_interno(uuid) from public, anon, authenticated;
grant execute on function public.club_aviso_votos_interno(uuid) to service_role;

create or replace function public.club_aviso_votos(p_id uuid)
returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('avisos') then raise exception 'sem_papel'; end if;
  return public.club_aviso_votos_interno(p_id);
end;
$$;
revoke all on function public.club_aviso_votos(uuid) from public, anon, authenticated;
grant execute on function public.club_aviso_votos(uuid) to authenticated;

-- ── Imagens dos avisos ──────────────────────────────────────────────────────
-- Mesmo bucket publico, pasta avisos/. So quem tem o papel 'avisos' sobe e apaga.

create policy club_fotos_avisos_ler on storage.objects
  for select to authenticated
  using (bucket_id = 'club-fotos' and (storage.foldername(name))[1] = 'avisos' and (select public.club_tem_papel('avisos')));

create policy club_fotos_avisos_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'club-fotos' and (storage.foldername(name))[1] = 'avisos' and (select public.club_tem_papel('avisos')));

create policy club_fotos_avisos_apagar on storage.objects
  for delete to authenticated
  using (bucket_id = 'club-fotos' and (storage.foldername(name))[1] = 'avisos' and (select public.club_tem_papel('avisos')));
