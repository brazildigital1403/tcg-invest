-- Album do Club, Fase 2, Fatia 2: portfolio do criador.
--
-- O membro registra o proprio conteudo (um link por linha, sem texto livre) e
-- isso prova as cartas de creator. Junto vem a ficha de criador e o aceite do
-- compromisso (Jogo Limpo), que duas cartas do capitulo Estreia usam.
--
-- Decisoes do Du (21/11/2026): o portfolio e PUBLICO (todo membro com conteudo
-- ativo tem pagina, sem opt-in) e nao ha diferenca por idade. A pagina publica
-- mostra so o @, a bio, o que a pessoa produz e os links: nunca nome, e-mail,
-- WhatsApp nem data de nascimento.
--
-- O servidor nao chama rede nenhuma: o link e validado pelo formato e gravado
-- na forma canonica, montada a partir do id do post (nada do que o membro
-- digitou vai para a tabela alem do id e do @ do TikTok).
--
-- Fica para depois (Fatia 2b): a fila de amostra da organizacao e o "nao
-- confere". Ate la, conteudo errado sai por remocao direta no banco.
--
-- ROLLBACK:
--   drop function public.club_portfolio_publico(text);
--   drop function public.club_portfolio_meu();
--   drop function public.club_aceite_registrar(text);
--   drop function public.club_criador_salvar(jsonb);
--   drop function public.club_conteudo_remover(uuid);
--   drop function public.club_conteudo_salvar(jsonb);
--   drop function public.club_album_conferir_abertas_interno(uuid);
--   drop function public.club_conteudos_semanas(uuid, timestamptz);
--   drop function public.club_conteudo_ler_url(text);
--   -- e reaplicar o corpo de club_missao_cumprida_v2 de 20261122100000_club_album_missao_dado.sql
--   drop table public.club_aceites;
--   drop table public.club_criadores;
--   drop table public.club_conteudos;

-- ── Tabelas ──────────────────────────────────────────────────────────────────

create table public.club_conteudos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  rede          text not null check (rede in ('instagram', 'tiktok', 'youtube', 'twitch')),
  formato       text not null check (formato in ('video_curto', 'video_longo', 'carrossel', 'foto', 'live')),
  tema          text check (tema in ('abertura', 'tour_fichario', 'historia_carta', 'resposta_publico', 'colecao', 'outro')),
  -- Forma canonica, montada pela funcao a partir do id do post.
  url           text not null check (url ~ '^https://[a-z0-9.]+/[A-Za-z0-9@._/?=&-]+$' and char_length(url) <= 200),
  -- rede + ':' + id do post. E o que identifica o link: um link e de um membro so.
  chave         text not null check (chave ~ '^[a-z]+:[A-Za-z0-9_-]{5,40}$'),
  -- A data que o membro declara. O que vale para sequencia e created_at.
  publicado_em  date not null check (publicado_em >= date '2015-01-01'),
  created_at    timestamptz not null default now(),
  status        text not null default 'ativo' check (status in ('ativo', 'reprovado'))
);
create unique index club_conteudos_chave_uq on public.club_conteudos (chave);
create index club_conteudos_user_idx on public.club_conteudos (user_id, created_at);

create table public.club_criadores (
  user_id     uuid primary key references public.users(id) on delete cascade,
  produz      text[] not null default '{}' check (produz <@ array['abertura', 'colecao', 'noticias', 'tutorial', 'competitivo', 'humor', 'review', 'live', 'vlog'] and cardinality(produz) <= 5),
  ensina      text[] not null default '{}' check (ensina <@ array['edicao', 'roteiro', 'captacao', 'luz_audio', 'capas', 'lives', 'parcerias', 'graduacao', 'colecao', 'competitivo'] and cardinality(ensina) <= 5),
  aprende     text[] not null default '{}' check (aprende <@ array['edicao', 'roteiro', 'captacao', 'luz_audio', 'capas', 'lives', 'parcerias', 'graduacao', 'colecao', 'competitivo'] and cardinality(aprende) <= 5),
  bio         text check (char_length(bio) between 10 and 120 and bio !~ '[\n\r]'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.club_aceites (
  user_id    uuid not null references public.users(id) on delete cascade,
  termo      text not null check (termo ~ '^[a-z0-9-]{2,40}$'),
  aceito_em  timestamptz not null default now(),
  primary key (user_id, termo)
);

-- Tabela nova nasce exposta no Supabase: fecha tudo. So as funcoes abaixo leem e escrevem.
alter table public.club_conteudos enable row level security;
alter table public.club_criadores enable row level security;
alter table public.club_aceites enable row level security;
revoke all on public.club_conteudos from public, anon, authenticated;
revoke all on public.club_criadores from public, anon, authenticated;
revoke all on public.club_aceites from public, anon, authenticated;

-- ── Link: validar e por na forma canonica ────────────────────────────────────

-- Devolve {rede, chave, url} ou nulo. So aceita endereco de POST das quatro
-- redes, em https. Link curto do TikTok (vm.tiktok.com) e perfil nao passam.
-- Parametro de rastreio nao entra: a url gravada e remontada a partir do id.
create or replace function public.club_conteudo_ler_url(p_url text)
returns jsonb
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  v  text := btrim(coalesce(p_url, ''));
  m  text[];
begin
  if char_length(v) > 300 then return null; end if;
  m := regexp_match(v, '^https://(?:www\.)?instagram\.com/(p|reel|tv)/([A-Za-z0-9_-]{5,40})(?:[/?#].*)?$');
  if m is not null then
    return jsonb_build_object('rede', 'instagram', 'chave', 'instagram:' || m[2], 'url', 'https://www.instagram.com/' || m[1] || '/' || m[2] || '/');
  end if;
  m := regexp_match(v, '^https://(?:www\.|m\.)?tiktok\.com/@([A-Za-z0-9._]{1,30})/video/([0-9]{8,25})(?:[/?#].*)?$');
  if m is not null then
    return jsonb_build_object('rede', 'tiktok', 'chave', 'tiktok:' || m[2], 'url', 'https://www.tiktok.com/@' || m[1] || '/video/' || m[2]);
  end if;
  m := regexp_match(v, '^https://(?:www\.|m\.)?youtube\.com/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})(?:[&#].*)?$');
  if m is null then m := regexp_match(v, '^https://youtu\.be/([A-Za-z0-9_-]{11})(?:[/?#].*)?$'); end if;
  if m is not null then
    return jsonb_build_object('rede', 'youtube', 'chave', 'youtube:' || m[1], 'url', 'https://www.youtube.com/watch?v=' || m[1]);
  end if;
  m := regexp_match(v, '^https://(?:www\.|m\.)?youtube\.com/(shorts|live)/([A-Za-z0-9_-]{11})(?:[/?#].*)?$');
  if m is not null then
    return jsonb_build_object('rede', 'youtube', 'chave', 'youtube:' || m[2], 'url', 'https://www.youtube.com/' || m[1] || '/' || m[2]);
  end if;
  m := regexp_match(v, '^https://(?:www\.|m\.)?twitch\.tv/videos/([0-9]{6,15})(?:[/?#].*)?$');
  if m is not null then
    return jsonb_build_object('rede', 'twitch', 'chave', 'twitch:' || m[1], 'url', 'https://www.twitch.tv/videos/' || m[1]);
  end if;
  return null;
end;
$$;
revoke all on function public.club_conteudo_ler_url(text) from public, anon, authenticated;

-- A maior sequencia de semanas seguidas (segunda a domingo, relogio de
-- Brasilia) com pelo menos um conteudo ativo registrado. Vale a semana em que
-- a pessoa REGISTROU. Sem acesso para ninguem.
create or replace function public.club_conteudos_semanas(p_user uuid, p_desde timestamptz)
returns integer
language sql stable security definer
set search_path = public, pg_temp
as $$
  with semanas as (
    select distinct date_trunc('week', c.created_at at time zone 'America/Sao_Paulo')::date as s
    from public.club_conteudos c
    where c.user_id = p_user and c.status = 'ativo' and (p_desde is null or c.created_at >= p_desde)
  ), grupos as (
    select s, s - (row_number() over (order by s))::integer * 7 as g from semanas
  )
  select coalesce(max(n), 0)::integer from (select count(*) as n from grupos group by g) t;
$$;
revoke all on function public.club_conteudos_semanas(uuid, timestamptz) from public, anon, authenticated;

-- ── Conferencia: os tipos e as fontes que dependem do portfolio ──────────────

-- Troca o corpo da funcao da Fatia 1: 'conteudos', 'conteudos_sequencia' e as
-- fontes 'ficha_criador', 'bio_criador' e 'aceite' passam a conferir. O resto
-- e igual.
create or replace function public.club_missao_cumprida_v2(p_user uuid, p_carta uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_k      public.club_cartas;
  v_abre   timestamptz;
  v_desde  timestamptz;
  v_min    integer;
  v_tem    integer;
  v_fonte  text;
begin
  select * into v_k from public.club_cartas k where k.id = p_carta;
  if not found or v_k.regra_tipo is null then return false; end if;
  v_min := greatest(1, coalesce(nullif(v_k.regra_param->>'minimo', '')::integer, 1));
  if v_k.regra_desde_abertura then
    select c.abre_em into v_abre from public.club_colecoes c where c.id = v_k.colecao_id;
    v_desde := coalesce(v_abre, now());
  end if;

  if v_k.regra_tipo = 'sinal' then
    v_fonte := v_k.regra_param->>'fonte';
    if v_fonte = 'ficha_criador' then
      return exists (select 1 from public.club_criadores f
        where f.user_id = p_user and cardinality(f.produz) > 0 and cardinality(f.ensina) > 0 and cardinality(f.aprende) > 0
          and (v_desde is null or f.updated_at >= v_desde));
    elsif v_fonte = 'bio_criador' then
      return exists (select 1 from public.club_criadores f
        where f.user_id = p_user and f.bio is not null and (v_desde is null or f.updated_at >= v_desde));
    elsif v_fonte = 'aceite' then
      return exists (select 1 from public.club_aceites a
        where a.user_id = p_user and a.termo = v_k.regra_param->>'ref' and (v_desde is null or a.aceito_em >= v_desde));
    end if;
    return public.club_sinal_conta(
      p_user, v_fonte, nullif(v_k.regra_param->>'n', '')::integer, v_k.regra_param->>'ref', v_desde, v_min
    ) >= v_min;

  elsif v_k.regra_tipo = 'cartas_da_edicao' then
    select count(*) into v_tem
    from public.club_desbloqueios d
    join public.club_cartas c on c.id = d.carta_id
    where d.user_id = p_user and d.revogado_em is null and c.colecao_id = v_k.colecao_id and c.id <> v_k.id
      and (coalesce((v_k.regra_param->>'todas')::boolean, false)
        or c.missao in (select jsonb_array_elements_text(coalesce(v_k.regra_param->'chaves', '[]'::jsonb))));
    return v_tem >= v_min;

  elsif v_k.regra_tipo = 'conteudos' then
    -- Conteudos ativos da pessoa, com os filtros da regra. 'distintos_por' conta
    -- formatos ou redes diferentes em vez de linhas.
    select case v_k.regra_param->>'distintos_por'
        when 'formato' then count(distinct c.formato)
        when 'rede' then count(distinct c.rede)
        else count(*) end
    into v_tem
    from public.club_conteudos c
    where c.user_id = p_user and c.status = 'ativo'
      and (v_desde is null or c.created_at >= v_desde)
      and (v_k.regra_param->>'formato' is null or c.formato = v_k.regra_param->>'formato')
      and (v_k.regra_param->>'tema' is null or c.tema = v_k.regra_param->>'tema')
      and (v_k.regra_param->>'rede' is null or c.rede = v_k.regra_param->>'rede');
    return v_tem >= v_min;

  elsif v_k.regra_tipo = 'conteudos_sequencia' then
    return public.club_conteudos_semanas(p_user, v_desde) >= greatest(2, coalesce(nullif(v_k.regra_param->>'semanas', '')::integer, 4));
  end if;

  return false;
end;
$$;
revoke all on function public.club_missao_cumprida_v2(uuid, uuid) from public, anon, authenticated;

-- Confere as edicoes abertas para a pessoa e devolve as cartas que chegaram
-- nesta chamada (compara o que ela tinha antes com o que tem depois). Quem
-- registra conteudo, ficha ou aceite ve a carta na propria resposta. Sem
-- acesso para ninguem.
create or replace function public.club_album_conferir_abertas_interno(p_user uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agora  timestamptz := now();
  v_antes  uuid[];
  v_c      public.club_colecoes;
  v_out    jsonb;
begin
  select coalesce(array_agg(d.carta_id), '{}') into v_antes from public.club_desbloqueios d where d.user_id = p_user;
  for v_c in
    select c.* from public.club_colecoes c
    where c.status = 'publicada' and c.abre_em <= v_agora and v_agora < c.fecha_em
    order by c.edicao
  loop
    perform public.club_album_conferir_interno(p_user, v_c.id);
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'titulo', c.titulo, 'papel', c.papel, 'numero', k.numero) order by c.edicao, k.numero), '[]'::jsonb)
  into v_out
  from public.club_desbloqueios d
  join public.club_cartas k on k.id = d.carta_id
  join public.club_colecoes c on c.id = k.colecao_id
  where d.user_id = p_user and d.revogado_em is null and not (d.carta_id = any (v_antes));
  return v_out;
end;
$$;
revoke all on function public.club_album_conferir_abertas_interno(uuid) from public, anon, authenticated;

-- ── Membro: registrar, remover, ficha e aceite ───────────────────────────────

-- Registra um conteudo do proprio membro. Recusa link fora do formato, link
-- que ja e de alguem, mais de 5 no dia (Brasilia) e mais de 300 no total.
-- Depois confere as edicoes abertas: as cartas que chegaram vem na resposta.
create or replace function public.club_conteudo_salvar(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_agora   timestamptz := now();
  v_hoje    date := (now() at time zone 'America/Sao_Paulo')::date;
  v_lido    jsonb;
  v_formato text := nullif(btrim(coalesce(p->>'formato', '')), '');
  v_tema    text := nullif(btrim(coalesce(p->>'tema', '')), '');
  v_data    date;
  v_novo    public.club_conteudos;
  v_cartas  jsonb;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not exists (select 1 from public.club_membros m where m.user_id = v_uid) then raise exception 'nao_membro'; end if;

  v_lido := public.club_conteudo_ler_url(p->>'url');
  if v_lido is null then raise exception 'link_invalido'; end if;
  if v_formato is null or v_formato not in ('video_curto', 'video_longo', 'carrossel', 'foto', 'live') then raise exception 'formato_invalido'; end if;
  if v_tema is not null and v_tema not in ('abertura', 'tour_fichario', 'historia_carta', 'resposta_publico', 'colecao', 'outro') then raise exception 'tema_invalido'; end if;
  if coalesce(p->>'publicado_em', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'data_invalida'; end if;
  begin
    v_data := (p->>'publicado_em')::date;
  exception when others then
    raise exception 'data_invalida';
  end;
  if v_data > v_hoje or v_data < date '2015-01-01' then raise exception 'data_invalida'; end if;

  if (select count(*) from public.club_conteudos c
      where c.user_id = v_uid and (c.created_at at time zone 'America/Sao_Paulo')::date = v_hoje) >= 5 then
    raise exception 'limite_do_dia';
  end if;
  if (select count(*) from public.club_conteudos c where c.user_id = v_uid and c.status = 'ativo') >= 300 then
    raise exception 'limite_total';
  end if;

  begin
    insert into public.club_conteudos (user_id, rede, formato, tema, url, chave, publicado_em)
    values (v_uid, v_lido->>'rede', v_formato, v_tema, v_lido->>'url', v_lido->>'chave', v_data)
    returning * into v_novo;
  exception when unique_violation then
    raise exception 'link_ja_cadastrado';
  end;

  v_cartas := public.club_album_conferir_abertas_interno(v_uid);

  return jsonb_build_object(
    'conteudo', jsonb_build_object('id', v_novo.id, 'rede', v_novo.rede, 'formato', v_novo.formato, 'tema', v_novo.tema,
      'url', v_novo.url, 'publicado_em', v_novo.publicado_em, 'created_at', v_novo.created_at),
    'cartas', v_cartas
  );
end;
$$;
revoke all on function public.club_conteudo_salvar(jsonb) from public, anon, authenticated;
grant execute on function public.club_conteudo_salvar(jsonb) to authenticated;

-- Remove um conteudo do proprio membro (o link fica livre). Carta ja ganha nao
-- e desfeita: ela tem linha propria e nao e conferida de novo.
create or replace function public.club_conteudo_remover(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  delete from public.club_conteudos c where c.id = p_id and c.user_id = v_uid and c.status = 'ativo';
  if not found then raise exception 'conteudo_nao_encontrado'; end if;
  return jsonb_build_object('removido', p_id);
end;
$$;
revoke all on function public.club_conteudo_remover(uuid) from public, anon, authenticated;
grant execute on function public.club_conteudo_remover(uuid) to authenticated;

-- A ficha do criador: o que produz, o que sabe ensinar, o que quer aprender
-- (listas fechadas, validadas pelo CHECK da tabela) e a bio de uma linha.
-- So mexe no que veio em p. Depois confere as edicoes abertas.
create or replace function public.club_criador_salvar(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_agora  timestamptz := now();
  v_f      public.club_criadores;
  v_bio    text;
  v_cartas jsonb;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not exists (select 1 from public.club_membros m where m.user_id = v_uid) then raise exception 'nao_membro'; end if;

  insert into public.club_criadores (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into v_f from public.club_criadores f where f.user_id = v_uid for update;

  if p ? 'produz' then
    if jsonb_typeof(p->'produz') <> 'array' then raise exception 'ficha_invalida'; end if;
    v_f.produz := array(select distinct jsonb_array_elements_text(p->'produz'));
  end if;
  if p ? 'ensina' then
    if jsonb_typeof(p->'ensina') <> 'array' then raise exception 'ficha_invalida'; end if;
    v_f.ensina := array(select distinct jsonb_array_elements_text(p->'ensina'));
  end if;
  if p ? 'aprende' then
    if jsonb_typeof(p->'aprende') <> 'array' then raise exception 'ficha_invalida'; end if;
    v_f.aprende := array(select distinct jsonb_array_elements_text(p->'aprende'));
  end if;
  if p ? 'bio' then
    v_bio := public.club_sem_emoji(regexp_replace(coalesce(p->>'bio', ''), '[\n\r]+', ' ', 'g'));
    if v_bio is not null and char_length(v_bio) not between 10 and 120 then raise exception 'bio_invalida'; end if;
    v_f.bio := v_bio;
  end if;

  begin
    update public.club_criadores f
    set produz = v_f.produz, ensina = v_f.ensina, aprende = v_f.aprende, bio = v_f.bio, updated_at = v_agora
    where f.user_id = v_uid;
  exception when check_violation then
    raise exception 'ficha_invalida';
  end;

  v_cartas := public.club_album_conferir_abertas_interno(v_uid);

  return jsonb_build_object(
    'ficha', jsonb_build_object('produz', to_jsonb(v_f.produz), 'ensina', to_jsonb(v_f.ensina), 'aprende', to_jsonb(v_f.aprende), 'bio', v_f.bio),
    'cartas', v_cartas
  );
end;
$$;
revoke all on function public.club_criador_salvar(jsonb) from public, anon, authenticated;
grant execute on function public.club_criador_salvar(jsonb) to authenticated;

-- Registra o aceite de um termo. So os termos da lista abaixo: o texto de cada
-- um fica na pagina, versionado no id.
create or replace function public.club_aceite_registrar(p_termo text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_agora  timestamptz := now();
  v_cartas jsonb;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not exists (select 1 from public.club_membros m where m.user_id = v_uid) then raise exception 'nao_membro'; end if;
  if p_termo is null or p_termo not in ('jogo-limpo-v1') then raise exception 'termo_invalido'; end if;

  insert into public.club_aceites (user_id, termo, aceito_em) values (v_uid, p_termo, v_agora)
  on conflict (user_id, termo) do nothing;

  v_cartas := public.club_album_conferir_abertas_interno(v_uid);

  return jsonb_build_object('termo', p_termo, 'cartas', v_cartas);
end;
$$;
revoke all on function public.club_aceite_registrar(text) from public, anon, authenticated;
grant execute on function public.club_aceite_registrar(text) to authenticated;

-- O portfolio da pessoa logada: os conteudos (os mais novos primeiro), quantos
-- ainda cabem hoje, a maior sequencia de semanas, a ficha, os aceites e o @
-- que forma o endereco da pagina publica.
create or replace function public.club_portfolio_meu()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ig    text;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not exists (select 1 from public.club_membros m where m.user_id = v_uid) then raise exception 'nao_membro'; end if;
  select public.club_instagram_limpo(u.instagram) into v_ig from public.users u where u.id = v_uid;

  return jsonb_build_object(
    'instagram', case when v_ig ~ '^[a-z0-9._]{1,30}$' then v_ig else null end,
    'conteudos', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'rede', c.rede, 'formato', c.formato, 'tema', c.tema, 'url', c.url,
          'publicado_em', c.publicado_em, 'created_at', c.created_at, 'status', c.status) order by c.created_at desc), '[]'::jsonb)
      from public.club_conteudos c where c.user_id = v_uid
    ),
    'hoje_restam', greatest(0, 5 - (select count(*) from public.club_conteudos c
      where c.user_id = v_uid and (c.created_at at time zone 'America/Sao_Paulo')::date = v_hoje))::integer,
    'semanas_seguidas', public.club_conteudos_semanas(v_uid, null),
    'ficha', (select jsonb_build_object('produz', to_jsonb(f.produz), 'ensina', to_jsonb(f.ensina), 'aprende', to_jsonb(f.aprende), 'bio', f.bio)
              from public.club_criadores f where f.user_id = v_uid),
    'aceites', (select coalesce(jsonb_agg(a.termo order by a.termo), '[]'::jsonb) from public.club_aceites a where a.user_id = v_uid)
  );
end;
$$;
revoke all on function public.club_portfolio_meu() from public, anon, authenticated;
grant execute on function public.club_portfolio_meu() to authenticated;

-- ── Publico: a pagina do criador ─────────────────────────────────────────────

-- O portfolio de um membro pelo @ do Instagram, para quem nao tem login. So
-- existe para membro do Club com pelo menos um conteudo ativo. Devolve o @, a
-- bio, o que a pessoa produz e ate 60 links. Nunca nome, e-mail, WhatsApp,
-- data de nascimento nem cidade. Sem o membro: {criador: null}.
create or replace function public.club_portfolio_publico(p_arroba text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_ig   text := lower(btrim(coalesce(p_arroba, ''), ' @'));
  v_uid  uuid;
begin
  if v_ig !~ '^[a-z0-9._]{1,30}$' then return jsonb_build_object('criador', null); end if;

  select u.id into v_uid
  from public.users u
  join public.club_membros m on m.user_id = u.id
  where public.club_instagram_limpo(u.instagram) = v_ig
    and exists (select 1 from public.club_conteudos c where c.user_id = u.id and c.status = 'ativo')
  limit 1;
  if v_uid is null then return jsonb_build_object('criador', null); end if;

  return jsonb_build_object(
    'criador', jsonb_build_object(
      'instagram', v_ig,
      'bio', (select f.bio from public.club_criadores f where f.user_id = v_uid),
      'produz', coalesce((select to_jsonb(f.produz) from public.club_criadores f where f.user_id = v_uid), '[]'::jsonb),
      'total', (select count(*) from public.club_conteudos c where c.user_id = v_uid and c.status = 'ativo')
    ),
    'conteudos', (
      select coalesce(jsonb_agg(t.item order by t.pub desc, t.cri desc), '[]'::jsonb)
      from (
        select c.publicado_em as pub, c.created_at as cri,
          jsonb_build_object('rede', c.rede, 'formato', c.formato, 'tema', c.tema, 'url', c.url, 'publicado_em', c.publicado_em) as item
        from public.club_conteudos c
        where c.user_id = v_uid and c.status = 'ativo'
        order by c.publicado_em desc, c.created_at desc
        limit 60
      ) t
    )
  );
end;
$$;
revoke all on function public.club_portfolio_publico(text) from public, anon, authenticated;
grant execute on function public.club_portfolio_publico(text) to anon, authenticated;
