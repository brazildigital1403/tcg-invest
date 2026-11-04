-- ============================================================================
-- Amigo Secreto do Poke Creators Club (04/11/2026, wireframe B aprovado)
-- ============================================================================
-- POR QUE: troca de presentes entre criadores da comunidade. Cadastro na
-- mesma base de /criadores (a conta nasce em users e vira lead); o @ do
-- Instagram e a identidade; sorteio anonimo em ciclo unico; endereco so para
-- quem tirou; mural com remetente sempre anonimo.
--
-- Quatro tabelas, nenhuma lida pelo navegador: RLS ligada sem policy e
-- revoke para anon/authenticated. Tudo passa pelas funcoes security definer
-- deste arquivo, que devolvem so o que o chamador (auth.uid()) pode ver.
-- O sorteio e a limpeza sao so do service_role (a rota de admin usa
-- requireAdmin + chave de servico; o admin nao e papel no banco).
--
-- Rollback (ordem): cron.unschedule('amigo_secreto_limpar');
--   drop function ... (as 10 abaixo); drop table amigo_secreto_mensagens,
--   amigo_secreto_sorteios, amigo_secreto_participantes, amigo_secreto_edicoes.
-- ============================================================================

-- ── Tabelas ─────────────────────────────────────────────────────────────────

create table public.amigo_secreto_edicoes (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  nome            text not null,
  teto_cents      integer not null default 10000,
  inscricoes_ate  timestamptz not null,
  sorteio_em      timestamptz not null,
  postar_ate      timestamptz not null,
  revelacao_em    timestamptz not null,
  estado          text not null default 'inscricoes'
                  check (estado in ('inscricoes', 'sorteado', 'entregas', 'encerrado')),
  feed_ligado     boolean not null default true,
  minimo          integer not null default 3,
  dados_apagados_em timestamptz,
  created_at      timestamptz not null default now()
);

create table public.amigo_secreto_participantes (
  id              uuid primary key default gen_random_uuid(),
  edicao_id       uuid not null references public.amigo_secreto_edicoes(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  instagram       text not null check (instagram ~ '^[a-z0-9._]{1,30}$'),
  whatsapp        text,
  nome_completo   text,
  pokemon         text,
  desejo          text check (char_length(desejo) <= 140),
  sugestoes       jsonb not null default '[]'::jsonb check (jsonb_typeof(sugestoes) = 'array' and jsonb_array_length(sugestoes) <= 3),
  me_surpreenda   boolean not null default false,
  cep             text check (cep is null or cep ~ '^[0-9]{8}$'),
  logradouro      text,
  numero          text,
  complemento     text,
  bairro          text,
  cidade          text,
  uf              text check (uf is null or uf ~ '^[A-Z]{2}$'),
  tirou_id        uuid references public.amigo_secreto_participantes(id),
  rastreio        text,
  postado_em      timestamptz,
  recebido_em     timestamptz,
  quer_revelar    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (edicao_id, user_id),
  unique (edicao_id, instagram)
);
create index amigo_secreto_participantes_tirou_idx on public.amigo_secreto_participantes (tirou_id);

create table public.amigo_secreto_mensagens (
  id          uuid primary key default gen_random_uuid(),
  edicao_id   uuid not null references public.amigo_secreto_edicoes(id) on delete cascade,
  de_id       uuid not null references public.amigo_secreto_participantes(id) on delete cascade,
  para_id     uuid not null references public.amigo_secreto_participantes(id) on delete cascade,
  texto       text not null check (char_length(texto) between 1 and 120),
  pronta      smallint,
  criado_em   timestamptz not null default now()
);
create index amigo_secreto_mensagens_edicao_idx on public.amigo_secreto_mensagens (edicao_id, criado_em desc);
create index amigo_secreto_mensagens_de_idx on public.amigo_secreto_mensagens (de_id, criado_em desc);

create table public.amigo_secreto_sorteios (
  id                  uuid primary key default gen_random_uuid(),
  edicao_id           uuid not null references public.amigo_secreto_edicoes(id) on delete cascade,
  seed                text not null,
  algoritmo           text not null,
  hash_participantes  text not null,
  n                   integer not null,
  executado_em        timestamptz not null default now()
);

-- Tabela nova nasce exposta no Supabase: RLS + revoke na criacao.
alter table public.amigo_secreto_edicoes enable row level security;
alter table public.amigo_secreto_participantes enable row level security;
alter table public.amigo_secreto_mensagens enable row level security;
alter table public.amigo_secreto_sorteios enable row level security;
revoke all on public.amigo_secreto_edicoes from public, anon, authenticated;
revoke all on public.amigo_secreto_participantes from public, anon, authenticated;
revoke all on public.amigo_secreto_mensagens from public, anon, authenticated;
revoke all on public.amigo_secreto_sorteios from public, anon, authenticated;

-- ── Helpers internos ────────────────────────────────────────────────────────

-- Dia de Brasilia (limite diario do mural).
create or replace function public.amigo_secreto_hoje_brt()
returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;
revoke all on function public.amigo_secreto_hoje_brt() from public;

-- Ficha publica de um participante: so @ e Pokemon.
create or replace function public.amigo_secreto_ficha(p public.amigo_secreto_participantes)
returns jsonb language sql immutable as $$
  select jsonb_build_object('instagram', p.instagram, 'pokemon', p.pokemon);
$$;
revoke all on function public.amigo_secreto_ficha(public.amigo_secreto_participantes) from public;

-- ── Leitura publica (landing): edicao + contagem + @ de quem entrou ─────────

create or replace function public.amigo_secreto_edicao_publica(p_slug text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_e  public.amigo_secreto_edicoes;
  v_n  integer;
  v_lista jsonb;
begin
  select * into v_e from public.amigo_secreto_edicoes where slug = p_slug;
  if not found then return null; end if;
  select count(*) into v_n from public.amigo_secreto_participantes where edicao_id = v_e.id;
  select coalesce(jsonb_agg(public.amigo_secreto_ficha(p) order by p.created_at desc), '[]'::jsonb)
    into v_lista
  from (select * from public.amigo_secreto_participantes where edicao_id = v_e.id order by created_at desc limit 60) p;
  return jsonb_build_object(
    'slug', v_e.slug, 'nome', v_e.nome, 'teto_cents', v_e.teto_cents,
    'inscricoes_ate', v_e.inscricoes_ate, 'sorteio_em', v_e.sorteio_em,
    'postar_ate', v_e.postar_ate, 'revelacao_em', v_e.revelacao_em,
    'estado', v_e.estado, 'feed_ligado', v_e.feed_ligado, 'minimo', v_e.minimo,
    'participantes', v_n, 'lista', v_lista
  );
end;
$$;
revoke all on function public.amigo_secreto_edicao_publica(text) from public;
grant execute on function public.amigo_secreto_edicao_publica(text) to anon, authenticated;

-- ── Minha sala: meu cadastro, quem eu tirei, o que esta vindo ───────────────

create or replace function public.amigo_secreto_meu(p_slug text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_e   public.amigo_secreto_edicoes;
  v_me  public.amigo_secreto_participantes;
  v_t   public.amigo_secreto_participantes;   -- quem eu tirei
  v_q   public.amigo_secreto_participantes;   -- quem me tirou
  v_tirou jsonb := null;
  v_recebo jsonb := null;
  v_hoje integer := 0;
  v_revelado boolean;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  select * into v_e from public.amigo_secreto_edicoes where slug = p_slug;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  select * into v_me from public.amigo_secreto_participantes where edicao_id = v_e.id and user_id = v_uid;
  if not found then
    return jsonb_build_object('inscrito', false, 'estado', v_e.estado);
  end if;

  v_revelado := v_e.estado = 'encerrado' or now() >= v_e.revelacao_em;

  if v_me.tirou_id is not null then
    select * into v_t from public.amigo_secreto_participantes where id = v_me.tirou_id;
    v_tirou := jsonb_build_object(
      'instagram', v_t.instagram, 'pokemon', v_t.pokemon,
      'nome_completo', v_t.nome_completo,
      'desejo', v_t.desejo, 'sugestoes', v_t.sugestoes, 'me_surpreenda', v_t.me_surpreenda,
      'endereco', case when v_e.dados_apagados_em is null then jsonb_build_object(
        'cep', v_t.cep, 'logradouro', v_t.logradouro, 'numero', v_t.numero, 'complemento', v_t.complemento,
        'bairro', v_t.bairro, 'cidade', v_t.cidade, 'uf', v_t.uf) else null end,
      'recebido_em', v_t.recebido_em
    );
  end if;

  -- O que esta vindo para mim: so rastreio e datas, nunca quem mandou
  -- (salvo revelacao consentida pelos dois lados, depois da data).
  select * into v_q from public.amigo_secreto_participantes where edicao_id = v_e.id and tirou_id = v_me.id;
  if found then
    v_recebo := jsonb_build_object(
      'postado_em', v_q.postado_em, 'rastreio', v_q.rastreio,
      'revelado', case when v_revelado and v_q.quer_revelar and v_me.quer_revelar
                       then public.amigo_secreto_ficha(v_q) else null end
    );
  end if;

  select count(*) into v_hoje from public.amigo_secreto_mensagens
   where de_id = v_me.id and (criado_em at time zone 'America/Sao_Paulo')::date = public.amigo_secreto_hoje_brt();

  return jsonb_build_object(
    'inscrito', true, 'estado', v_e.estado, 'revelado', v_revelado,
    'teto_cents', v_e.teto_cents, 'postar_ate', v_e.postar_ate, 'revelacao_em', v_e.revelacao_em,
    'sorteio_em', v_e.sorteio_em, 'inscricoes_ate', v_e.inscricoes_ate, 'feed_ligado', v_e.feed_ligado,
    'eu', jsonb_build_object(
      'instagram', v_me.instagram, 'whatsapp', v_me.whatsapp, 'nome_completo', v_me.nome_completo,
      'pokemon', v_me.pokemon, 'desejo', v_me.desejo, 'sugestoes', v_me.sugestoes, 'me_surpreenda', v_me.me_surpreenda,
      'cep', v_me.cep, 'logradouro', v_me.logradouro, 'numero', v_me.numero, 'complemento', v_me.complemento,
      'bairro', v_me.bairro, 'cidade', v_me.cidade, 'uf', v_me.uf,
      'rastreio', v_me.rastreio, 'postado_em', v_me.postado_em, 'recebido_em', v_me.recebido_em,
      'quer_revelar', v_me.quer_revelar,
      'perfil_completo', (v_me.instagram is not null and v_me.cep is not null and v_me.numero is not null
                          and (v_me.me_surpreenda or coalesce(v_me.desejo, '') <> ''))
    ),
    'tirou', v_tirou,
    'recebo', v_recebo,
    'mensagens_hoje', v_hoje
  );
end;
$$;
revoke all on function public.amigo_secreto_meu(text) from public;
grant execute on function public.amigo_secreto_meu(text) to authenticated;

-- ── Salvar perfil de participante (cria ou atualiza) ────────────────────────
-- Antes do sorteio: tudo. Depois: @ e endereco travam (quem tirou pode ja ter
-- copiado), o resto segue editavel.

create or replace function public.amigo_secreto_salvar_perfil(p_slug text, p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_e   public.amigo_secreto_edicoes;
  v_me  public.amigo_secreto_participantes;
  v_ig  text;
  v_sug jsonb;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  select * into v_e from public.amigo_secreto_edicoes where slug = p_slug;
  if not found then raise exception 'edicao_nao_encontrada'; end if;

  select * into v_me from public.amigo_secreto_participantes where edicao_id = v_e.id and user_id = v_uid;

  if v_me.id is null and (v_e.estado <> 'inscricoes' or now() > v_e.inscricoes_ate) then
    raise exception 'inscricoes_encerradas';
  end if;

  v_ig := lower(regexp_replace(coalesce(p->>'instagram', v_me.instagram, ''), '^@', ''));
  if v_ig !~ '^[a-z0-9._]{1,30}$' then raise exception 'instagram_invalido'; end if;

  v_sug := coalesce(p->'sugestoes', v_me.sugestoes, '[]'::jsonb);
  if jsonb_typeof(v_sug) <> 'array' or jsonb_array_length(v_sug) > 3 then raise exception 'sugestoes_invalidas'; end if;

  if v_me.id is null then
    insert into public.amigo_secreto_participantes (edicao_id, user_id, instagram, whatsapp, nome_completo, pokemon,
      desejo, sugestoes, me_surpreenda, cep, logradouro, numero, complemento, bairro, cidade, uf)
    values (v_e.id, v_uid, v_ig, nullif(p->>'whatsapp',''), nullif(p->>'nome_completo',''), nullif(p->>'pokemon',''),
      nullif(p->>'desejo',''), v_sug, coalesce((p->>'me_surpreenda')::boolean, false),
      nullif(regexp_replace(coalesce(p->>'cep',''), '\D', '', 'g'), ''), nullif(p->>'logradouro',''), nullif(p->>'numero',''),
      nullif(p->>'complemento',''), nullif(p->>'bairro',''), nullif(p->>'cidade',''), nullif(upper(p->>'uf'),''))
    returning * into v_me;
  else
    update public.amigo_secreto_participantes set
      instagram     = case when v_me.tirou_id is null then v_ig else instagram end,
      whatsapp      = coalesce(nullif(p->>'whatsapp',''), whatsapp),
      nome_completo = coalesce(nullif(p->>'nome_completo',''), nome_completo),
      pokemon       = case when p ? 'pokemon' then nullif(p->>'pokemon','') else pokemon end,
      desejo        = case when p ? 'desejo' then nullif(p->>'desejo','') else desejo end,
      sugestoes     = v_sug,
      me_surpreenda = coalesce((p->>'me_surpreenda')::boolean, me_surpreenda),
      cep           = case when v_me.tirou_id is null and p ? 'cep' then nullif(regexp_replace(p->>'cep', '\D', '', 'g'), '') else cep end,
      logradouro    = case when v_me.tirou_id is null and p ? 'logradouro' then nullif(p->>'logradouro','') else logradouro end,
      numero        = case when v_me.tirou_id is null and p ? 'numero' then nullif(p->>'numero','') else numero end,
      complemento   = case when v_me.tirou_id is null and p ? 'complemento' then nullif(p->>'complemento','') else complemento end,
      bairro        = case when v_me.tirou_id is null and p ? 'bairro' then nullif(p->>'bairro','') else bairro end,
      cidade        = case when v_me.tirou_id is null and p ? 'cidade' then nullif(p->>'cidade','') else cidade end,
      uf            = case when v_me.tirou_id is null and p ? 'uf' then nullif(upper(p->>'uf'),'') else uf end,
      quer_revelar  = coalesce((p->>'quer_revelar')::boolean, quer_revelar),
      updated_at    = now()
    where id = v_me.id
    returning * into v_me;
  end if;

  -- A conta vira lead: @, WhatsApp e endereco tambem vao para users (so o
  -- que veio preenchido; nunca apaga o que ja estava la).
  update public.users set
    instagram   = coalesce(v_me.instagram, instagram),
    whatsapp    = coalesce(v_me.whatsapp, whatsapp),
    cep         = coalesce(v_me.cep, cep),
    logradouro  = coalesce(v_me.logradouro, logradouro),
    numero      = coalesce(v_me.numero, numero),
    complemento = coalesce(v_me.complemento, complemento),
    bairro      = coalesce(v_me.bairro, bairro),
    city        = coalesce(v_me.cidade, city),
    uf          = coalesce(v_me.uf, uf)
  where id = v_uid;

  return public.amigo_secreto_meu(p_slug);
exception
  when unique_violation then raise exception 'instagram_ja_usado';
end;
$$;
revoke all on function public.amigo_secreto_salvar_perfil(text, jsonb) from public;
grant execute on function public.amigo_secreto_salvar_perfil(text, jsonb) to authenticated;

-- ── Postei / recebi ─────────────────────────────────────────────────────────

create or replace function public.amigo_secreto_postei(p_slug text, p_rastreio text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  update public.amigo_secreto_participantes p set
    rastreio = nullif(left(btrim(coalesce(p_rastreio, '')), 40), ''),
    postado_em = coalesce(postado_em, now()),
    updated_at = now()
  from public.amigo_secreto_edicoes e
  where e.slug = p_slug and p.edicao_id = e.id and p.user_id = v_uid and p.tirou_id is not null;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'sem_sorteio'; end if;
  return public.amigo_secreto_meu(p_slug);
end;
$$;
revoke all on function public.amigo_secreto_postei(text, text) from public;
grant execute on function public.amigo_secreto_postei(text, text) to authenticated;

create or replace function public.amigo_secreto_recebi(p_slug text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  update public.amigo_secreto_participantes p set recebido_em = coalesce(recebido_em, now()), updated_at = now()
  from public.amigo_secreto_edicoes e
  where e.slug = p_slug and p.edicao_id = e.id and p.user_id = v_uid and e.estado in ('sorteado', 'entregas', 'encerrado');
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'sem_sorteio'; end if;
  return public.amigo_secreto_meu(p_slug);
end;
$$;
revoke all on function public.amigo_secreto_recebi(text) from public;
grant execute on function public.amigo_secreto_recebi(text) to authenticated;

-- ── Mural: escrever (so para quem eu tirei, 3 por dia) e ler (sem remetente) ─

create or replace function public.amigo_secreto_enviar_mensagem(p_slug text, p_texto text, p_pronta smallint default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_e   public.amigo_secreto_edicoes;
  v_me  public.amigo_secreto_participantes;
  v_hoje integer;
  v_txt text;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  select * into v_e from public.amigo_secreto_edicoes where slug = p_slug;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  if not v_e.feed_ligado then raise exception 'mural_desligado'; end if;
  select * into v_me from public.amigo_secreto_participantes where edicao_id = v_e.id and user_id = v_uid;
  if not found or v_me.tirou_id is null then raise exception 'sem_sorteio'; end if;
  select count(*) into v_hoje from public.amigo_secreto_mensagens
   where de_id = v_me.id and (criado_em at time zone 'America/Sao_Paulo')::date = public.amigo_secreto_hoje_brt();
  if v_hoje >= 3 then raise exception 'limite_diario'; end if;
  v_txt := left(btrim(regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g')), 120);
  if v_txt = '' then raise exception 'texto_vazio'; end if;
  insert into public.amigo_secreto_mensagens (edicao_id, de_id, para_id, texto, pronta)
  values (v_e.id, v_me.id, v_me.tirou_id, v_txt, p_pronta);
  return jsonb_build_object('ok', true, 'mensagens_hoje', v_hoje + 1);
end;
$$;
revoke all on function public.amigo_secreto_enviar_mensagem(text, text, smallint) from public;
grant execute on function public.amigo_secreto_enviar_mensagem(text, text, smallint) to authenticated;

-- Feed: so o dia (nunca a hora) e ordem embaralhada dentro do dia, para o
-- horario nao entregar o remetente. 'para_mim' marca as dirigidas ao chamador.
create or replace function public.amigo_secreto_feed(p_slug text, p_limit integer default 60)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_e   public.amigo_secreto_edicoes;
  v_me_id uuid;
begin
  select * into v_e from public.amigo_secreto_edicoes where slug = p_slug;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  select id into v_me_id from public.amigo_secreto_participantes where edicao_id = v_e.id and user_id = v_uid;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'texto', m.texto, 'pronta', m.pronta,
      'dia', (m.criado_em at time zone 'America/Sao_Paulo')::date,
      'para', public.amigo_secreto_ficha(p),
      'para_mim', m.para_id = v_me_id
    ) order by (m.criado_em at time zone 'America/Sao_Paulo')::date desc, md5(m.id::text))
    from (select * from public.amigo_secreto_mensagens where edicao_id = v_e.id
          order by criado_em desc limit greatest(1, least(coalesce(p_limit, 60), 200))) m
    join public.amigo_secreto_participantes p on p.id = m.para_id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.amigo_secreto_feed(text, integer) from public;
grant execute on function public.amigo_secreto_feed(text, integer) to authenticated;

-- ── Sorteio (so service_role; a rota de admin chama com a chave de servico) ─
-- Ciclo unico: embaralha (Fisher-Yates com semente gravada) e cada um tira o
-- seguinte; o ultimo tira o primeiro. Ninguem tira a si mesmo e nao ha par
-- mutuo com n >= 3. Exige perfil completo (endereco + desejo) de todo mundo.

create or replace function public.amigo_secreto_sortear(p_slug text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_e    public.amigo_secreto_edicoes;
  v_ids  uuid[];
  v_n    integer;
  v_i    integer;
  v_j    integer;
  v_tmp  uuid;
  v_seed text;
  v_incompletos integer;
begin
  select * into v_e from public.amigo_secreto_edicoes where slug = p_slug for update;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  if v_e.estado <> 'inscricoes' then raise exception 'ja_sorteado'; end if;

  select count(*) into v_incompletos from public.amigo_secreto_participantes
   where edicao_id = v_e.id and (cep is null or numero is null or (not me_surpreenda and coalesce(desejo, '') = ''));
  if v_incompletos > 0 then raise exception 'perfis_incompletos: %', v_incompletos; end if;

  select array_agg(id order by id) into v_ids from public.amigo_secreto_participantes where edicao_id = v_e.id;
  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n < greatest(3, v_e.minimo) then raise exception 'minimo_nao_atingido: % de %', v_n, greatest(3, v_e.minimo); end if;

  v_seed := replace(gen_random_uuid()::text, '-', '');
  perform setseed((('x' || left(md5(v_seed), 8))::bit(32)::int)::double precision / 2147483647.0);
  for v_i in reverse v_n .. 2 loop
    v_j := 1 + floor(random() * v_i)::integer;
    v_tmp := v_ids[v_i]; v_ids[v_i] := v_ids[v_j]; v_ids[v_j] := v_tmp;
  end loop;

  for v_i in 1 .. v_n loop
    update public.amigo_secreto_participantes
       set tirou_id = v_ids[case when v_i = v_n then 1 else v_i + 1 end], updated_at = now()
     where id = v_ids[v_i];
  end loop;

  insert into public.amigo_secreto_sorteios (edicao_id, seed, algoritmo, hash_participantes, n)
  values (v_e.id, v_seed, 'fisher-yates-ciclo-unico-v1',
          md5((select string_agg(id::text, ',' order by id) from public.amigo_secreto_participantes where edicao_id = v_e.id)), v_n);
  update public.amigo_secreto_edicoes set estado = 'sorteado' where id = v_e.id;

  return jsonb_build_object('ok', true, 'n', v_n, 'seed', v_seed);
end;
$$;
revoke all on function public.amigo_secreto_sortear(text) from public, anon, authenticated;

-- ── Limpeza: 30 dias depois da revelacao, apaga endereco e desejo ───────────

create or replace function public.amigo_secreto_limpar()
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer := 0;
  v_e record;
begin
  for v_e in select id from public.amigo_secreto_edicoes
             where dados_apagados_em is null and revelacao_em + interval '30 days' < now()
  loop
    update public.amigo_secreto_participantes
       set cep = null, logradouro = null, numero = null, complemento = null, bairro = null, cidade = null, uf = null,
           desejo = null, sugestoes = '[]'::jsonb, whatsapp = null, nome_completo = null, updated_at = now()
     where edicao_id = v_e.id;
    update public.amigo_secreto_edicoes set dados_apagados_em = now(), estado = 'encerrado' where id = v_e.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.amigo_secreto_limpar() from public, anon, authenticated;

-- pg_cron roda em GMT: 06:10 UTC = 03:10 de Brasilia.
select cron.schedule('amigo_secreto_limpar', '10 6 * * *', $$select public.amigo_secreto_limpar()$$);
