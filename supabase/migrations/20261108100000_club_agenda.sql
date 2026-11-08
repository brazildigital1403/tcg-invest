-- ============================================================================
-- Agenda do Poke Creators Club + organizadores (08/11/2026, wireframe aprovado)
-- ============================================================================
-- POR QUE: terceira frente do Club. Eventos que o Du e os organizadores que ele
-- escolher cadastram; quem tem conta na Bynx ve.
--
-- Organizador: papel ligado a conta da Bynx (decisao do Du, caminho B). Papeis
-- da v1: 'agenda' e 'aniversariantes'. Amigo Secreto fica so com o Du e nao
-- vira papel. Quem adiciona e tira organizador e o /admin, com a chave de
-- servico: o navegador nunca escreve em club_organizadores.
--
-- O /admin (cookie de senha, sem auth.uid()) usa as funcoes *_interno pela
-- chave de servico; o organizador usa as funcoes publicas, que conferem o papel
-- e chamam as mesmas internas. Uma regra so, dois portoes.
--
-- Datas e horas sao de relogio de Brasilia (date + time), nao timestamptz: o
-- evento acontece "as 20h de Brasilia" e a grade agrupa por dia sem virada UTC.
--
-- Tudo nasce trancado: RLS sem policy + revoke nas tabelas, revoke nominal de
-- anon e authenticated nas funcoes e grant so no que o navegador chama.
--
-- ROLLBACK (na ordem):
--   drop policy club_fotos_eventos_ler on storage.objects;
--   drop policy club_fotos_eventos_subir on storage.objects;
--   drop policy club_fotos_eventos_apagar on storage.objects;
--   drop function public.club_aniversario_remover_foto(text);
--   drop function public.club_aniversario_remover_foto_interno(text, uuid);
--   drop function public.club_agenda_estado(uuid, text, text);
--   drop function public.club_agenda_estado_interno(uuid, text, text, uuid);
--   drop function public.club_agenda_salvar(uuid, jsonb, text);
--   drop function public.club_agenda_salvar_interno(uuid, jsonb, text, uuid);
--   drop function public.club_agenda_organizar_lista();
--   drop function public.club_agenda_evento(text);
--   drop function public.club_agenda_lista(date, date);
--   drop function public.club_evento_json(public.club_eventos);
--   drop function public.club_meus_papeis();
--   drop function public.club_tem_papel(text);
--   drop table public.club_organizacao_log;
--   drop table public.club_eventos;
--   drop table public.club_organizadores;
-- ============================================================================

-- ── Organizadores ───────────────────────────────────────────────────────────

create table public.club_organizadores (
  user_id        uuid primary key references public.users(id) on delete cascade,
  papeis         text[] not null check (cardinality(papeis) >= 1 and papeis <@ array['agenda', 'aniversariantes']),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.club_organizadores enable row level security;
revoke all on public.club_organizadores from public, anon, authenticated;

-- Quem fez o que: cada acao de organizador (e do /admin, com user_id nulo).
create table public.club_organizacao_log (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.users(id) on delete set null,
  papel       text not null,
  acao        text not null,
  alvo        text,
  detalhe     jsonb,
  created_at  timestamptz not null default now()
);
create index club_organizacao_log_created_idx on public.club_organizacao_log (created_at desc);
alter table public.club_organizacao_log enable row level security;
revoke all on public.club_organizacao_log from public, anon, authenticated;

-- Usada nas funcoes e nas policies do storage. So responde sobre a propria conta.
create or replace function public.club_tem_papel(p_papel text)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.club_organizadores o
    where o.user_id = auth.uid() and o.papeis @> array[p_papel]
  )
$$;
revoke all on function public.club_tem_papel(text) from public, anon, authenticated;
grant execute on function public.club_tem_papel(text) to authenticated;

create or replace function public.club_meus_papeis()
returns jsonb
language sql security definer stable
set search_path = public, pg_temp
as $$
  select coalesce((select to_jsonb(o.papeis) from public.club_organizadores o where o.user_id = auth.uid()), '[]'::jsonb)
$$;
revoke all on function public.club_meus_papeis() from public, anon, authenticated;
grant execute on function public.club_meus_papeis() to authenticated;

-- ── Eventos ─────────────────────────────────────────────────────────────────

create table public.club_eventos (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  tipo           text not null check (tipo in ('live', 'collab', 'abertura', 'torneio', 'presencial', 'lancamento', 'club')),
  titulo         text not null check (char_length(titulo) between 3 and 60),
  descricao      text check (char_length(descricao) <= 600),
  formato        text not null check (formato in ('online', 'presencial')),
  local_nome     text check (char_length(local_nome) <= 80),
  cidade         text check (char_length(cidade) <= 60),
  uf             text check (uf ~ '^[A-Z]{2}$'),
  link_url       text check (link_url ~ '^https://[^[:space:][:cntrl:]]+$' and char_length(link_url) <= 500),
  participantes  text[] not null default '{}' check (cardinality(participantes) <= 20),
  imagem_path    text check (imagem_path ~ '^eventos/[A-Za-z0-9-]+\.(webp|jpg|png)$'),
  inicio_data    date not null,
  fim_data       date not null,
  hora_inicio    time check (hora_inicio < '24:00'),
  hora_fim       time check (hora_fim < '24:00'),
  status         text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'adiado', 'cancelado')),
  nota_status    text check (char_length(nota_status) <= 200),
  remarcado_em   timestamptz,
  publicado_em   timestamptz,
  criado_por     uuid references public.users(id) on delete set null,
  editado_por    uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint club_eventos_periodo check (fim_data >= inicio_data and fim_data - inicio_data <= 30),
  constraint club_eventos_horas check (
    (hora_fim is null or hora_inicio is not null)
    and (fim_data > inicio_data or hora_fim is null or hora_fim > hora_inicio)
  ),
  constraint club_eventos_local check (formato = 'online' or cidade is not null),
  constraint club_eventos_cancelado check (status <> 'cancelado' or nota_status is not null)
);
create index club_eventos_inicio_idx on public.club_eventos (inicio_data) where status <> 'rascunho';
-- Uma imagem por evento: trocar a imagem de um evento apaga o arquivo antigo, e
-- ele nao pode ser de outro evento (revisao de 08/11).
create unique index club_eventos_imagem_uidx on public.club_eventos (imagem_path) where imagem_path is not null;
alter table public.club_eventos enable row level security;
revoke all on public.club_eventos from public, anon, authenticated;

-- Formato unico de evento para todas as funcoes. Interna: ninguem chama direto.
create or replace function public.club_evento_json(e public.club_eventos)
returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', e.id, 'slug', e.slug, 'tipo', e.tipo, 'titulo', e.titulo, 'descricao', e.descricao,
    'formato', e.formato, 'local_nome', e.local_nome, 'cidade', e.cidade, 'uf', e.uf,
    'link_url', e.link_url, 'participantes', to_jsonb(e.participantes), 'imagem_path', e.imagem_path,
    'inicio_data', e.inicio_data, 'fim_data', e.fim_data,
    'hora_inicio', to_char(e.hora_inicio, 'HH24:MI'), 'hora_fim', to_char(e.hora_fim, 'HH24:MI'),
    'status', e.status, 'nota_status', e.nota_status, 'remarcado_em', e.remarcado_em
  )
$$;
revoke all on function public.club_evento_json(public.club_eventos) from public, anon, authenticated;

-- ── Leitura (membro logado) ─────────────────────────────────────────────────

create or replace function public.club_agenda_lista(p_de date, p_ate date)
returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 400 then raise exception 'janela_invalida'; end if;
  return jsonb_build_object(
    'eventos', coalesce((
      select jsonb_agg(public.club_evento_json(e) order by e.inicio_data, e.hora_inicio nulls first, e.titulo)
      from public.club_eventos e
      where e.status <> 'rascunho' and e.fim_data >= p_de and e.inicio_data <= p_ate
    ), '[]'::jsonb),
    'papeis', public.club_meus_papeis()
  );
end;
$$;
revoke all on function public.club_agenda_lista(date, date) from public, anon, authenticated;
grant execute on function public.club_agenda_lista(date, date) to authenticated;

-- Rascunho so aparece para quem organiza a agenda.
create or replace function public.club_agenda_evento(p_slug text)
returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_e   public.club_eventos;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  select * into v_e from public.club_eventos e where e.slug = p_slug;
  if not found or (v_e.status = 'rascunho' and not public.club_tem_papel('agenda')) then
    raise exception 'evento_nao_encontrado';
  end if;
  return jsonb_build_object('evento', public.club_evento_json(v_e), 'papeis', public.club_meus_papeis());
end;
$$;
revoke all on function public.club_agenda_evento(text) from public, anon, authenticated;
grant execute on function public.club_agenda_evento(text) to authenticated;

-- ── Organizacao ─────────────────────────────────────────────────────────────

create or replace function public.club_agenda_organizar_lista()
returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('agenda') then raise exception 'sem_papel'; end if;
  return coalesce((
    select jsonb_agg(public.club_evento_json(e) || jsonb_build_object(
      'criado_por', coalesce(uc.instagram, uc.username), 'editado_por', coalesce(ue.instagram, ue.username),
      'updated_at', e.updated_at
    ) order by e.inicio_data desc, e.hora_inicio)
    from public.club_eventos e
    left join public.users uc on uc.id = e.criado_por
    left join public.users ue on ue.id = e.editado_por
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.club_agenda_organizar_lista() from public, anon, authenticated;
grant execute on function public.club_agenda_organizar_lista() to authenticated;

-- Cria ou edita. p_acao: 'rascunho' (so evento novo ou ainda rascunho),
-- 'publicar' (rascunho ou adiado passa a publicado) ou 'salvar' (mantem o estado).
-- p_autor nulo = /admin. O slug nasce no primeiro salvamento e nao muda mais,
-- para nao quebrar link ja mandado no grupo.
create or replace function public.club_agenda_salvar_interno(p_id uuid, p jsonb, p_acao text, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_old     public.club_eventos;
  v_novo    boolean := p_id is null;
  v_tipo    text := nullif(trim(coalesce(p->>'tipo', '')), '');
  v_titulo  text := nullif(trim(coalesce(p->>'titulo', '')), '');
  v_desc    text := nullif(trim(coalesce(p->>'descricao', '')), '');
  v_formato text := coalesce(nullif(p->>'formato', ''), 'online');
  v_local   text := nullif(trim(coalesce(p->>'local_nome', '')), '');
  v_cidade  text := nullif(trim(coalesce(p->>'cidade', '')), '');
  v_uf      text := nullif(upper(trim(coalesce(p->>'uf', ''))), '');
  v_link    text := nullif(trim(coalesce(p->>'link_url', '')), '');
  v_img     text := nullif(p->>'imagem_path', '');
  v_ini     date;
  v_fim     date;
  v_hi      time;
  v_hf      time;
  v_parts   text[] := '{}';
  v_hoje    date := (now() at time zone 'America/Sao_Paulo')::date;
  v_status  text;
  v_slug    text;
  v_base    text;
  v_n       int := 1;
  v_e       public.club_eventos;
  v_x       text;
begin
  if p_acao is null or p_acao not in ('rascunho', 'publicar', 'salvar') then raise exception 'acao_invalida'; end if;
  if not v_novo then
    select * into v_old from public.club_eventos e where e.id = p_id for update;
    if not found then raise exception 'evento_nao_encontrado'; end if;
    if v_old.status = 'cancelado' then raise exception 'evento_cancelado'; end if;
  end if;

  if v_tipo is null or v_tipo not in ('live', 'collab', 'abertura', 'torneio', 'presencial', 'lancamento', 'club') then raise exception 'tipo_invalido'; end if;
  if v_titulo is null or char_length(v_titulo) < 3 or char_length(v_titulo) > 60 or v_titulo ~ '[[:cntrl:]]' then raise exception 'titulo_invalido'; end if;
  -- Caractere de controle quebraria o .ics; na descricao so a quebra de linha fica.
  if v_local ~ '[[:cntrl:]]' or v_cidade ~ '[[:cntrl:]]' then raise exception 'local_invalido'; end if;
  v_desc := nullif(regexp_replace(coalesce(v_desc, ''), '[\x01-\x09\x0b-\x1f\x7f]', '', 'g'), '');
  if v_desc is not null and char_length(v_desc) > 600 then raise exception 'descricao_longa'; end if;
  if v_formato not in ('online', 'presencial') then raise exception 'formato_invalido'; end if;
  if v_link is not null and (v_link !~ '^https://[^[:space:][:cntrl:]]+$' or char_length(v_link) > 500) then raise exception 'link_invalido'; end if;
  if v_img is not null and v_img !~ '^eventos/[A-Za-z0-9-]+\.(webp|jpg|png)$' then raise exception 'imagem_invalida'; end if;
  if v_img is not null and exists (select 1 from public.club_eventos e where e.imagem_path = v_img and e.id is distinct from p_id) then
    raise exception 'imagem_invalida';
  end if;
  if v_uf is not null and v_uf !~ '^[A-Z]{2}$' then raise exception 'uf_invalida'; end if;

  begin
    v_ini := nullif(p->>'inicio_data', '')::date;
    v_fim := coalesce(nullif(p->>'fim_data', '')::date, v_ini);
    v_hi  := nullif(p->>'hora_inicio', '')::time;
    v_hf  := nullif(p->>'hora_fim', '')::time;
  exception when others then
    raise exception 'data_invalida';
  end;
  if v_ini is null then raise exception 'data_obrigatoria'; end if;
  if v_hi >= '24:00' or v_hf >= '24:00' then raise exception 'hora_invalida'; end if;
  if v_fim < v_ini then raise exception 'fim_antes_do_inicio'; end if;
  if v_fim - v_ini > 30 then raise exception 'evento_longo'; end if;
  if v_hf is not null and v_hi is null then raise exception 'hora_invalida'; end if;
  if v_fim = v_ini and v_hf is not null and v_hf <= v_hi then raise exception 'fim_antes_do_inicio'; end if;
  -- Data no passado so trava quando a data muda (editar evento antigo continua possivel).
  if v_ini < v_hoje and (v_novo or v_ini is distinct from v_old.inicio_data) then raise exception 'data_passada'; end if;
  -- Publicar (rascunho antigo, adiado sem data nova) exige evento que ainda nao acabou.
  if p_acao = 'publicar' and v_fim < v_hoje then raise exception 'data_passada'; end if;

  if v_formato = 'presencial' then
    if v_cidade is null then raise exception 'cidade_obrigatoria'; end if;
  else
    v_local := null; v_cidade := null; v_uf := null;
  end if;

  if jsonb_typeof(p->'participantes') = 'array' then
    for v_x in select lower(trim(both '@ ' from x)) from jsonb_array_elements_text(p->'participantes') x loop
      continue when v_x = '';
      if v_x !~ '^[a-z0-9._]{1,30}$' then raise exception 'participante_invalido'; end if;
      if not v_x = any(v_parts) then v_parts := v_parts || v_x; end if;
    end loop;
  end if;
  if cardinality(v_parts) > 20 then raise exception 'participantes_demais'; end if;

  v_status := case
    when p_acao = 'publicar' then 'publicado'
    when p_acao = 'rascunho' then 'rascunho'
    else coalesce(v_old.status, 'rascunho')
  end;
  if p_acao = 'rascunho' and not v_novo and v_old.status <> 'rascunho' then raise exception 'ja_publicado'; end if;

  if v_novo then
    v_base := left(trim(both '-' from regexp_replace(lower(public.unaccent(v_titulo)), '[^a-z0-9]+', '-', 'g')), 60);
    if v_base = '' then v_base := 'evento'; end if;
    v_base := v_base || '-' || to_char(v_ini, 'YYYY');
    v_slug := v_base;
    while exists (select 1 from public.club_eventos e where e.slug = v_slug) loop
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    end loop;

    insert into public.club_eventos (slug, tipo, titulo, descricao, formato, local_nome, cidade, uf, link_url, participantes,
      imagem_path, inicio_data, fim_data, hora_inicio, hora_fim, status, publicado_em, criado_por, editado_por)
    values (v_slug, v_tipo, v_titulo, v_desc, v_formato, v_local, v_cidade, v_uf, v_link, v_parts,
      v_img, v_ini, v_fim, v_hi, v_hf, v_status, case when v_status = 'publicado' then now() end, p_autor, p_autor)
    returning * into v_e;
  else
    update public.club_eventos e set
      tipo = v_tipo, titulo = v_titulo, descricao = v_desc, formato = v_formato, local_nome = v_local,
      cidade = v_cidade, uf = v_uf, link_url = v_link, participantes = v_parts, imagem_path = v_img,
      inicio_data = v_ini, fim_data = v_fim, hora_inicio = v_hi, hora_fim = v_hf,
      status = v_status,
      -- Nova data num evento ja divulgado: a tela mostra "Nova data" por 7 dias.
      remarcado_em = case when v_old.status in ('publicado', 'adiado')
                           and (v_ini, v_fim, v_hi) is distinct from (v_old.inicio_data, v_old.fim_data, v_old.hora_inicio)
                          then now() else e.remarcado_em end,
      nota_status = case when v_status = 'publicado' then null else e.nota_status end,
      publicado_em = coalesce(e.publicado_em, case when v_status = 'publicado' then now() end),
      editado_por = p_autor, updated_at = now()
    where e.id = p_id
    returning * into v_e;
  end if;

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (p_autor, 'agenda', case when v_novo then 'criar' else 'editar' end || ':' || p_acao, v_e.slug, jsonb_build_object('status', v_e.status));

  return public.club_evento_json(v_e);
end;
$$;
revoke all on function public.club_agenda_salvar_interno(uuid, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.club_agenda_salvar_interno(uuid, jsonb, text, uuid) to service_role;

create or replace function public.club_agenda_salvar(p_id uuid, p jsonb, p_acao text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('agenda') then raise exception 'sem_papel'; end if;
  return public.club_agenda_salvar_interno(p_id, p, p_acao, auth.uid());
end;
$$;
revoke all on function public.club_agenda_salvar(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.club_agenda_salvar(uuid, jsonb, text) to authenticated;

-- p_acao: 'adiar' (publicado -> adiado, nota opcional), 'cancelar' (publicado ou
-- adiado -> cancelado, motivo obrigatorio) ou 'excluir' (so rascunho; devolve a
-- imagem para quem chamou apagar do storage).
create or replace function public.club_agenda_estado_interno(p_id uuid, p_acao text, p_nota text, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_e    public.club_eventos;
  v_nota text := nullif(trim(coalesce(p_nota, '')), '');
begin
  select * into v_e from public.club_eventos e where e.id = p_id for update;
  if not found then raise exception 'evento_nao_encontrado'; end if;
  if v_nota is not null and char_length(v_nota) > 200 then raise exception 'nota_longa'; end if;

  if p_acao = 'excluir' then
    if v_e.status <> 'rascunho' then raise exception 'so_rascunho'; end if;
    delete from public.club_eventos where id = p_id;
    insert into public.club_organizacao_log (user_id, papel, acao, alvo) values (p_autor, 'agenda', 'excluir', v_e.slug);
    return jsonb_build_object('excluido', true, 'imagem_path', v_e.imagem_path);
  elsif p_acao = 'adiar' then
    if v_e.status <> 'publicado' then raise exception 'estado_invalido'; end if;
    update public.club_eventos set status = 'adiado', nota_status = v_nota, editado_por = p_autor, updated_at = now()
    where id = p_id returning * into v_e;
  elsif p_acao = 'cancelar' then
    if v_e.status not in ('publicado', 'adiado') then raise exception 'estado_invalido'; end if;
    if v_nota is null or char_length(v_nota) < 3 then raise exception 'motivo_obrigatorio'; end if;
    update public.club_eventos set status = 'cancelado', nota_status = v_nota, editado_por = p_autor, updated_at = now()
    where id = p_id returning * into v_e;
  else
    raise exception 'acao_invalida';
  end if;

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (p_autor, 'agenda', p_acao, v_e.slug, jsonb_build_object('nota', v_nota));
  return public.club_evento_json(v_e);
end;
$$;
revoke all on function public.club_agenda_estado_interno(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.club_agenda_estado_interno(uuid, text, text, uuid) to service_role;

create or replace function public.club_agenda_estado(p_id uuid, p_acao text, p_nota text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('agenda') then raise exception 'sem_papel'; end if;
  return public.club_agenda_estado_interno(p_id, p_acao, p_nota, auth.uid());
end;
$$;
revoke all on function public.club_agenda_estado(uuid, text, text) from public, anon, authenticated;
grant execute on function public.club_agenda_estado(uuid, text, text) to authenticated;

-- ── Aniversariantes: remover foto impropria ─────────────────────────────────
-- Limpa a foto da lista e devolve o caminho. O arquivo sai do storage pela rota
-- do servidor, com a chave de servico, depois de a funcao confirmar o papel: a
-- policy do bucket so deixa cada pessoa apagar a propria pasta.

create or replace function public.club_aniversario_remover_foto_interno(p_instagram text, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ig   text := lower(trim(both '@ ' from coalesce(p_instagram, '')));
  v_path text;
begin
  select a.foto_path into v_path from public.club_aniversarios a where a.instagram = v_ig for update;
  if not found then raise exception 'pessoa_nao_encontrada'; end if;
  if v_path is null then raise exception 'sem_foto'; end if;
  update public.club_aniversarios set foto_path = null, updated_at = now() where instagram = v_ig;
  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (p_autor, 'aniversariantes', 'remover_foto', v_ig, jsonb_build_object('foto_path', v_path));
  -- O arquivo sai com a chave de servico: so devolve caminho no formato {uuid}/{arquivo},
  -- sem "..". Outro formato sai da lista, mas o arquivo fica (revisao de 08/11).
  if v_path !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$' or v_path like '%..%' then
    return jsonb_build_object('foto_path', null);
  end if;
  return jsonb_build_object('foto_path', v_path);
end;
$$;
revoke all on function public.club_aniversario_remover_foto_interno(text, uuid) from public, anon, authenticated;
grant execute on function public.club_aniversario_remover_foto_interno(text, uuid) to service_role;

create or replace function public.club_aniversario_remover_foto(p_instagram text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('aniversariantes') then raise exception 'sem_papel'; end if;
  return public.club_aniversario_remover_foto_interno(p_instagram, auth.uid());
end;
$$;
revoke all on function public.club_aniversario_remover_foto(text) from public, anon, authenticated;
grant execute on function public.club_aniversario_remover_foto(text) to authenticated;

-- ── Imagens dos eventos ─────────────────────────────────────────────────────
-- Mesmo bucket publico das fotos, na pasta eventos/. So quem organiza a agenda
-- sobe e apaga ali. Apagar exige poder ler a linha do objeto, dai a policy de leitura.

create policy club_fotos_eventos_ler on storage.objects
  for select to authenticated
  using (bucket_id = 'club-fotos' and (storage.foldername(name))[1] = 'eventos' and (select public.club_tem_papel('agenda')));

create policy club_fotos_eventos_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'club-fotos' and (storage.foldername(name))[1] = 'eventos' and (select public.club_tem_papel('agenda')));

create policy club_fotos_eventos_apagar on storage.objects
  for delete to authenticated
  using (bucket_id = 'club-fotos' and (storage.foldername(name))[1] = 'eventos' and (select public.club_tem_papel('agenda')));
