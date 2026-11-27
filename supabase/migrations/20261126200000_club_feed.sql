-- Feed do Club (26/11/2026). Substitui a sala de links da comunidade de WhatsApp.
-- Wireframe v3 e UI v3 aprovados pelo Du em 26/11. Decisoes:
--   * so membro do Club (com @ valido) posta e marca apoio; denuncia e de qualquer conta logada;
--   * a lista e publica (anon le), inclusive para o Google;
--   * o apoio que vale e o engajamento feito NA REDE do post, declarado na volta
--     (curti, comentei, compartilhei, salvei, segui), sem print e sem prova;
--   * retorno privado (respostas prontas, so o autor ve) vem ligado e o autor desliga;
--   * sem limite de post nem de apoio; o Album conta no maximo 5 conteudos por dia;
--   * apoio nao vale carta do Album;
--   * papel 'feed' em club_organizadores para a organizacao moderar.
--
-- O post do feed e uma linha de club_conteudos (a mesma do Portfolio, que ja valida o
-- link e regrava a URL a partir do id do post) com feed_em preenchido.
--
-- ROLLBACK:
--   drop function public.club_feed_semana_salvar(text, uuid);
--   drop function public.club_feed_moderar(uuid, text, text, text);
--   drop function public.club_feed_moderar_interno(uuid, text, text, text, uuid);
--   drop function public.club_feed_organizar_lista();
--   drop function public.club_feed_denunciar(uuid, text);
--   drop function public.club_feed_meu_apoio();
--   drop function public.club_feed_meus();
--   drop function public.club_feed_confirmar_comentario(uuid, text);
--   drop function public.club_feed_quem_apoiou(uuid);
--   drop function public.club_feed_retornar(uuid, text[]);
--   drop function public.club_feed_desmarcar(uuid);
--   drop function public.club_feed_marcar(uuid, text[]);
--   drop function public.club_feed_retorno_ligar(uuid, boolean);
--   drop function public.club_feed_tirar_meu(uuid);
--   drop function public.club_feed_postar(jsonb);
--   drop function public.club_feed_lista(text, timestamptz, text, text, integer);
--   drop function public.club_feed_avisar_interno(uuid, text, text, text, text);
--   drop function public.club_feed_semana_atual();
--   drop table public.club_feed_bloqueios, public.club_feed_semanas, public.club_feed_denuncias,
--     public.club_feed_retornos, public.club_feed_apoios;
--   alter table public.club_conteudos drop column feed_em, drop column feed_pergunta, drop column feed_retorno,
--     drop column feed_semana, drop column feed_conferir_arroba, drop column feed_oculto_em,
--     drop column feed_oculto_por, drop column feed_oculto_motivo, drop column feed_oculto_nota;
--   update public.club_organizadores set papeis = array_remove(papeis, 'feed') where papeis @> array['feed'];
--   delete from public.club_organizadores where cardinality(papeis) = 0;
--   alter table public.club_organizadores drop constraint club_organizadores_papeis_check,
--     add constraint club_organizadores_papeis_check check (cardinality(papeis) >= 1
--       and papeis <@ array['agenda', 'aniversariantes', 'avisos', 'colecao']);
--   -- e reaplicar club_missao_cumprida_v2 de 20261125120000_club_capitulos.sql
--   -- e club_conteudo_salvar de 20261122120000_club_portfolio.sql (antes de dropar feed_em)

-- ── Colunas do feed em club_conteudos ────────────────────────────────────────

alter table public.club_conteudos
  add column feed_em              timestamptz,
  add column feed_pergunta        text check (feed_pergunta in ('gancho', 'edicao', 'capa', 'tamanho', 'parte2', 'so_ver')),
  add column feed_retorno         boolean not null default true,
  add column feed_semana          date,
  -- TikTok: o @ do video quando e diferente do @ do membro. A organizacao confere.
  add column feed_conferir_arroba text check (feed_conferir_arroba ~ '^[a-z0-9._]{1,30}$'),
  add column feed_oculto_em       timestamptz,
  add column feed_oculto_por      uuid references public.users(id) on delete set null,
  add column feed_oculto_motivo   text check (feed_oculto_motivo in ('cobra_apoio', 'nao_e_da_pessoa', 'spam', 'link_quebrado', 'ofensivo', 'fora_do_tema', 'outro', 'denuncias')),
  add column feed_oculto_nota     text check (char_length(feed_oculto_nota) <= 300);

create index club_conteudos_feed_idx on public.club_conteudos (feed_em desc) where feed_em is not null;

-- ── Tabelas novas ────────────────────────────────────────────────────────────

-- Uma linha por pessoa por post. gestos vazio = "So vi" (nao conta como apoio, o autor nao ve).
create table public.club_feed_apoios (
  conteudo_id               uuid not null references public.club_conteudos(id) on delete cascade,
  user_id                   uuid not null references public.users(id) on delete cascade,
  gestos                    text[] not null default '{}'
                              check (gestos <@ array['curti', 'comentei', 'compartilhei', 'salvei', 'segui'] and cardinality(gestos) <= 5),
  comentario_confirmado_em  timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  primary key (conteudo_id, user_id)
);
create index club_feed_apoios_user_idx on public.club_feed_apoios (user_id, created_at);

-- Retorno privado: ate 3 respostas prontas, so o autor le.
create table public.club_feed_retornos (
  conteudo_id  uuid not null references public.club_conteudos(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  respostas    text[] not null check (cardinality(respostas) between 1 and 3 and respostas <@ array[
                 'funcionou', 'capa_abriu', 'ate_o_fim', 'aprendi', 'parte2', 'capa_escura', 'texto_pequeno', 'longo']),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (conteudo_id, user_id)
);

create table public.club_feed_denuncias (
  id             uuid primary key default gen_random_uuid(),
  conteudo_id    uuid not null references public.club_conteudos(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  motivo         text not null check (motivo in ('cobra_apoio', 'nao_e_da_pessoa', 'spam', 'link_quebrado', 'ofensivo', 'golpe', 'outro')),
  created_at     timestamptz not null default now(),
  resolvida_em   timestamptz,
  resolvida_por  uuid references public.users(id) on delete set null,
  unique (conteudo_id, user_id)
);
create index club_feed_denuncias_abertas_idx on public.club_feed_denuncias (conteudo_id) where resolvida_em is null;

-- Ritual de segunda: tema e escolha da semana, uma linha por semana (segunda-feira).
create table public.club_feed_semanas (
  semana       date primary key check (extract(isodow from semana) = 1),
  tema         text check (char_length(tema) between 3 and 40 and tema !~ '[\n\r]'),
  escolha      uuid references public.club_conteudos(id) on delete set null,
  updated_por  uuid references public.users(id) on delete set null,
  updated_at   timestamptz not null default now()
);

-- Link tirado do feed (pela organizacao ou por denuncias). Fica pela chave do post, e nao
-- pela linha: apagar o conteudo pelo Portfolio e postar de novo nao limpa o bloqueio.
create table public.club_feed_bloqueios (
  chave   text primary key check (chave ~ '^[a-z]+:[A-Za-z0-9_-]{5,40}$'),
  motivo  text not null,
  por     uuid references public.users(id) on delete set null,
  em      timestamptz not null default now()
);

alter table public.club_feed_apoios    enable row level security;
alter table public.club_feed_retornos  enable row level security;
alter table public.club_feed_denuncias enable row level security;
alter table public.club_feed_semanas   enable row level security;
alter table public.club_feed_bloqueios enable row level security;
revoke all on table public.club_feed_apoios    from public, anon, authenticated;
revoke all on table public.club_feed_retornos  from public, anon, authenticated;
revoke all on table public.club_feed_denuncias from public, anon, authenticated;
revoke all on table public.club_feed_semanas   from public, anon, authenticated;
revoke all on table public.club_feed_bloqueios from public, anon, authenticated;

-- ── Papel 'feed' ─────────────────────────────────────────────────────────────

alter table public.club_organizadores drop constraint club_organizadores_papeis_check;
alter table public.club_organizadores add constraint club_organizadores_papeis_check
  check (cardinality(papeis) >= 1 and papeis <@ array['agenda', 'aniversariantes', 'avisos', 'colecao', 'feed']);

-- ── Internas ─────────────────────────────────────────────────────────────────

-- Segunda-feira da semana corrente, relogio de Brasilia.
create or replace function public.club_feed_semana_atual()
returns date
language sql stable
set search_path = public, pg_temp
as $$
  select date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::date
$$;
revoke all on function public.club_feed_semana_atual() from public, anon, authenticated;

-- Grava um aviso no sino, no maximo um por chave por dia (Brasilia). Agrupa: nunca um por apoio.
create or replace function public.club_feed_avisar_interno(p_user uuid, p_titulo text, p_mensagem text, p_link text, p_chave text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if p_user is null then return; end if;
  if exists (
    select 1 from public.notifications n
    where n.user_id = p_user and n.data->>'chave' = p_chave
      and (n.created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
  ) then
    return;
  end if;
  insert into public.notifications (user_id, type, title, message, read, data)
  values (p_user, 'aviso', p_titulo, p_mensagem, false,
          jsonb_build_object('link', p_link, 'origem', 'club_feed', 'chave', p_chave));
end;
$$;
revoke all on function public.club_feed_avisar_interno(uuid, text, text, text, text) from public, anon, authenticated;

-- ── Leitura publica ──────────────────────────────────────────────────────────

-- Lista do feed. Anon le 'recentes'; 'para_ver' exige login e tira os proprios posts e os que a
-- pessoa ja marcou (apoio ou "So vi"). Nunca devolve user_id, nome nem quem apoiou.
-- Leitura pura: nao confere Album nem grava nada (roda como anon, com 3 s).
create or replace function public.club_feed_lista(
  p_aba    text default 'recentes',
  p_antes  timestamptz default null,
  p_rede   text default null,
  p_tema   text default null,
  p_limite integer default 20
)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_lim    integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_semana date := public.club_feed_semana_atual();
  v_itens  jsonb;
  v_mais   boolean;
begin
  if p_aba not in ('recentes', 'para_ver') then raise exception 'aba_invalida'; end if;
  if p_aba = 'para_ver' and v_uid is null then raise exception 'nao_logado'; end if;

  with base as (
    select c.*, public.club_instagram_limpo(u.instagram) as arroba
    from public.club_conteudos c
    join public.club_membros m on m.user_id = c.user_id
    join public.users u on u.id = c.user_id
    where c.feed_em is not null and c.status = 'ativo' and c.feed_oculto_em is null
      and (p_antes is null or c.feed_em < p_antes)
      and (p_rede is null or c.rede = p_rede)
      and (p_tema is null or (p_tema = 'semana' and c.feed_semana = v_semana) or c.tema = p_tema)
      and (p_aba = 'recentes' or (
            c.user_id <> v_uid
            and not exists (select 1 from public.club_feed_apoios a where a.conteudo_id = c.id and a.user_id = v_uid)))
    order by c.feed_em desc
    limit v_lim + 1
  ), pagina as (
    select * from base order by feed_em desc limit v_lim
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'rede', p.rede, 'formato', p.formato, 'tema', p.tema, 'pergunta', p.feed_pergunta,
      'url', p.url, 'arroba', p.arroba, 'feed_em', p.feed_em, 'retorno', p.feed_retorno,
      'primeiro', not exists (select 1 from public.club_conteudos o
                              where o.user_id = p.user_id and o.feed_em is not null and o.feed_em < p.feed_em),
      'tema_semana', p.feed_semana = v_semana,
      'escolha', exists (select 1 from public.club_feed_semanas s where s.escolha = p.id),
      'meu', v_uid is not null and p.user_id = v_uid,
      'minha_marca', case when v_uid is null then null else
        (select to_jsonb(a.gestos) from public.club_feed_apoios a where a.conteudo_id = p.id and a.user_id = v_uid) end,
      'meu_retorno', case when v_uid is null then false else
        exists (select 1 from public.club_feed_retornos r where r.conteudo_id = p.id and r.user_id = v_uid) end,
      'ja_sigo', case when v_uid is null then false else
        exists (select 1 from public.club_feed_apoios a join public.club_conteudos o on o.id = a.conteudo_id
                where a.user_id = v_uid and o.user_id = p.user_id and a.gestos @> array['segui']) end,
      'apoiaram', case when v_uid is not null and p.user_id = v_uid then
        (select count(*) from public.club_feed_apoios a where a.conteudo_id = p.id and cardinality(array_remove(a.gestos, 'segui')) > 0) end
    ) order by p.feed_em desc), '[]'::jsonb),
    (select count(*) > v_lim from base)
  into v_itens, v_mais
  from pagina p;

  return jsonb_build_object(
    'itens', v_itens,
    'tem_mais', coalesce(v_mais, false),
    'semana', (select jsonb_build_object('inicio', s.semana, 'tema', s.tema) from public.club_feed_semanas s where s.semana = v_semana)
  );
end;
$$;
revoke all on function public.club_feed_lista(text, timestamptz, text, text, integer) from public, anon, authenticated;
grant execute on function public.club_feed_lista(text, timestamptz, text, text, integer) to anon, authenticated;

-- ── Membro: postar e cuidar do proprio post ──────────────────────────────────

-- Posta um link no feed. Sem limite de quantidade. Se o link ja e da pessoa (veio do
-- Portfolio ou saiu do feed), so volta para o feed. Link de outra pessoa e recusado.
-- TikTok com @ diferente do @ do membro pede confirmacao e vai para a organizacao conferir.
create or replace function public.club_feed_postar(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_hoje     date := (now() at time zone 'America/Sao_Paulo')::date;
  v_semana   date := public.club_feed_semana_atual();
  v_ig       text;
  v_lido     jsonb;
  v_formato  text := nullif(btrim(coalesce(p->>'formato', '')), '');
  v_tema     text := nullif(btrim(coalesce(p->>'tema', '')), '');
  v_pergunta text := nullif(btrim(coalesce(p->>'pergunta', '')), '');
  v_retorno  boolean := coalesce((p->>'retorno')::boolean, true);
  v_na_sem   boolean := coalesce((p->>'tema_semana')::boolean, false);
  v_arroba   text;
  v_conferir text;
  v_existe   public.club_conteudos;
  v_post     public.club_conteudos;
  v_primeiro boolean;
  v_cartas   jsonb := '[]'::jsonb;
  v_org      uuid;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not exists (select 1 from public.club_membros m where m.user_id = v_uid) then raise exception 'nao_membro'; end if;
  select public.club_instagram_limpo(u.instagram) into v_ig from public.users u where u.id = v_uid;
  if v_ig is null or v_ig !~ '^[a-z0-9._]{1,30}$' then raise exception 'sem_instagram'; end if;
  if coalesce((p->>'declarou')::boolean, false) is not true then raise exception 'sem_declaracao'; end if;

  v_lido := public.club_conteudo_ler_url(p->>'url');
  if v_lido is null then raise exception 'link_invalido'; end if;
  if v_formato is null or v_formato not in ('video_curto', 'video_longo', 'carrossel', 'foto', 'live') then raise exception 'formato_invalido'; end if;
  if v_tema is not null and v_tema not in ('abertura', 'tour_fichario', 'historia_carta', 'resposta_publico', 'colecao', 'outro') then raise exception 'tema_invalido'; end if;
  if v_pergunta is null or v_pergunta not in ('gancho', 'edicao', 'capa', 'tamanho', 'parte2', 'so_ver') then raise exception 'pergunta_invalida'; end if;
  if v_na_sem and not exists (select 1 from public.club_feed_semanas s where s.semana = v_semana and s.tema is not null) then
    v_na_sem := false;
  end if;

  if v_lido->>'rede' = 'tiktok' then
    v_arroba := lower((regexp_match(v_lido->>'url', '^https://www\.tiktok\.com/@([A-Za-z0-9._]{1,30})/'))[1]);
    if v_arroba is not null and v_arroba <> v_ig then
      if coalesce((p->>'confirmo_arroba')::boolean, false) is not true then raise exception 'arroba_diferente'; end if;
      v_conferir := v_arroba;
    end if;
  end if;

  -- Link tirado do feed fica bloqueado pela chave, mesmo que a linha tenha sido apagada no Portfolio.
  if exists (select 1 from public.club_feed_bloqueios b where b.chave = v_lido->>'chave') then
    raise exception 'tirado_do_feed';
  end if;

  v_primeiro := not exists (select 1 from public.club_conteudos c where c.user_id = v_uid and c.feed_em is not null);

  select * into v_existe from public.club_conteudos c where c.chave = v_lido->>'chave' for update;
  if found then
    if v_existe.user_id <> v_uid then raise exception 'post_de_outra_pessoa'; end if;
    if v_existe.status <> 'ativo' then raise exception 'link_invalido'; end if;
    -- Tirado por denuncia ou pela organizacao: so a organizacao devolve.
    if v_existe.feed_oculto_em is not null then raise exception 'tirado_do_feed'; end if;
    if v_existe.feed_em is not null then raise exception 'ja_no_feed'; end if;
    update public.club_conteudos c
       set feed_em = now(), feed_pergunta = v_pergunta, feed_retorno = v_retorno,
           feed_semana = case when v_na_sem then v_semana end, feed_conferir_arroba = v_conferir,
           -- Link que ja estava no Portfolio mantem formato e tema de la (o Album conta por eles).
           tema = coalesce(c.tema, v_tema)
     where c.id = v_existe.id
     returning * into v_post;
  else
    begin
      insert into public.club_conteudos (user_id, rede, formato, tema, url, chave, publicado_em,
                                         feed_em, feed_pergunta, feed_retorno, feed_semana, feed_conferir_arroba)
      values (v_uid, v_lido->>'rede', v_formato, v_tema, v_lido->>'url', v_lido->>'chave', v_hoje,
              now(), v_pergunta, v_retorno, case when v_na_sem then v_semana end, v_conferir)
      returning * into v_post;
    exception when unique_violation then
      raise exception 'link_ja_cadastrado';
    end;
    -- Conteudo novo pode render carta do Album (o Album conta no maximo 5 por dia).
    v_cartas := public.club_album_conferir_abertas_interno(v_uid);
  end if;

  if v_primeiro or v_conferir is not null then
    for v_org in select o.user_id from public.club_organizadores o where o.papeis @> array['feed'] loop
      if v_primeiro then
        perform public.club_feed_avisar_interno(v_org, 'Primeiro post no feed',
          '@' || v_ig || ' postou no feed pela primeira vez.', '/pokecreatorsclub/feed?organizar=1', 'feed_primeiro:' || v_post.id);
      end if;
      if v_conferir is not null then
        perform public.club_feed_avisar_interno(v_org, 'Conferir o @ de um post',
          '@' || v_ig || ' postou um video de @' || v_conferir || '.', '/pokecreatorsclub/feed?organizar=1', 'feed_conferir:' || v_post.id);
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'post', jsonb_build_object('id', v_post.id, 'rede', v_post.rede, 'formato', v_post.formato, 'tema', v_post.tema,
      'pergunta', v_post.feed_pergunta, 'url', v_post.url, 'feed_em', v_post.feed_em, 'retorno', v_post.feed_retorno,
      'primeiro', v_primeiro),
    'cartas', coalesce(v_cartas, '[]'::jsonb)
  );
end;
$$;
revoke all on function public.club_feed_postar(jsonb) from public, anon, authenticated;
grant execute on function public.club_feed_postar(jsonb) to authenticated;

-- O autor tira o proprio post do feed. Continua no Portfolio. Post ja tirado pela organizacao
-- ou por denuncias fica como esta (senao sairia da fila e ninguem conseguiria devolver).
create or replace function public.club_feed_tirar_meu(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if exists (select 1 from public.club_conteudos c where c.id = p_id and c.user_id = v_uid and c.feed_oculto_em is not null) then
    raise exception 'tirado_do_feed';
  end if;
  update public.club_conteudos c set feed_em = null, feed_semana = null
   where c.id = p_id and c.user_id = v_uid and c.feed_em is not null;
  if not found then raise exception 'post_nao_encontrado'; end if;
  return jsonb_build_object('tirado', p_id);
end;
$$;
revoke all on function public.club_feed_tirar_meu(uuid) from public, anon, authenticated;
grant execute on function public.club_feed_tirar_meu(uuid) to authenticated;

-- O autor liga ou desliga o retorno privado do proprio post.
create or replace function public.club_feed_retorno_ligar(p_id uuid, p_ligado boolean)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  update public.club_conteudos c set feed_retorno = coalesce(p_ligado, true)
   where c.id = p_id and c.user_id = v_uid and c.feed_em is not null;
  if not found then raise exception 'post_nao_encontrado'; end if;
  return jsonb_build_object('id', p_id, 'retorno', coalesce(p_ligado, true));
end;
$$;
revoke all on function public.club_feed_retorno_ligar(uuid, boolean) from public, anon, authenticated;
grant execute on function public.club_feed_retorno_ligar(uuid, boolean) to authenticated;

-- ── Membro: apoiar e dar retorno ─────────────────────────────────────────────

-- Marca o que a pessoa fez na rede (gestos vazio = "So vi"). Sem limite. Nunca no proprio post.
-- Twitch nao tem "salvei". Tirar "comentei" desfaz a confirmacao do autor.
create or replace function public.club_feed_marcar(p_id uuid, p_gestos text[])
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_c      public.club_conteudos;
  v_g      text[];
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not exists (select 1 from public.club_membros m where m.user_id = v_uid) then raise exception 'nao_membro'; end if;
  if coalesce((select public.club_instagram_limpo(u.instagram) from public.users u where u.id = v_uid), '') !~ '^[a-z0-9._]{1,30}$' then
    raise exception 'sem_instagram';
  end if;
  select * into v_c from public.club_conteudos c
   where c.id = p_id and c.feed_em is not null and c.status = 'ativo' and c.feed_oculto_em is null;
  if not found then raise exception 'post_nao_encontrado'; end if;
  if v_c.user_id = v_uid then raise exception 'proprio_post'; end if;

  select coalesce(array_agg(distinct g order by g), '{}') into v_g from unnest(coalesce(p_gestos, '{}')) g;
  if not (v_g <@ array['curti', 'comentei', 'compartilhei', 'salvei', 'segui']) then raise exception 'gesto_invalido'; end if;
  if v_c.rede = 'twitch' and v_g @> array['salvei'] then raise exception 'gesto_invalido'; end if;

  insert into public.club_feed_apoios as a (conteudo_id, user_id, gestos)
  values (p_id, v_uid, v_g)
  on conflict (conteudo_id, user_id) do update
    set gestos = excluded.gestos,
        updated_at = now(),
        comentario_confirmado_em = case when excluded.gestos @> array['comentei'] then a.comentario_confirmado_em end;

  if cardinality(array_remove(v_g, 'segui')) > 0 then
    perform public.club_feed_avisar_interno(v_c.user_id, 'Seu post recebeu apoio',
      'Creators do Club apoiaram o seu post no feed.', '/pokecreatorsclub/feed?aba=meus', 'feed_apoio:' || v_c.user_id);
  end if;

  return jsonb_build_object('id', p_id, 'gestos', to_jsonb(v_g));
end;
$$;
revoke all on function public.club_feed_marcar(uuid, text[]) from public, anon, authenticated;
grant execute on function public.club_feed_marcar(uuid, text[]) to authenticated;

-- Desfaz a marca (o post volta para "Para ver").
create or replace function public.club_feed_desmarcar(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  delete from public.club_feed_apoios a where a.conteudo_id = p_id and a.user_id = v_uid;
  return jsonb_build_object('id', p_id, 'gestos', null);
end;
$$;
revoke all on function public.club_feed_desmarcar(uuid) from public, anon, authenticated;
grant execute on function public.club_feed_desmarcar(uuid) to authenticated;

-- Retorno privado: de 1 a 3 respostas prontas, so se o autor deixou ligado.
create or replace function public.club_feed_retornar(p_id uuid, p_respostas text[])
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_c   public.club_conteudos;
  v_r   text[];
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not exists (select 1 from public.club_membros m where m.user_id = v_uid) then raise exception 'nao_membro'; end if;
  if coalesce((select public.club_instagram_limpo(u.instagram) from public.users u where u.id = v_uid), '') !~ '^[a-z0-9._]{1,30}$' then
    raise exception 'sem_instagram';
  end if;
  select * into v_c from public.club_conteudos c
   where c.id = p_id and c.feed_em is not null and c.status = 'ativo' and c.feed_oculto_em is null;
  if not found then raise exception 'post_nao_encontrado'; end if;
  if v_c.user_id = v_uid then raise exception 'proprio_post'; end if;
  if not v_c.feed_retorno then raise exception 'retorno_desligado'; end if;

  select coalesce(array_agg(distinct r order by r), '{}') into v_r from unnest(coalesce(p_respostas, '{}')) r;
  if cardinality(v_r) < 1 or cardinality(v_r) > 3
     or not (v_r <@ array['funcionou', 'capa_abriu', 'ate_o_fim', 'aprendi', 'parte2', 'capa_escura', 'texto_pequeno', 'longo']) then
    raise exception 'resposta_invalida';
  end if;

  insert into public.club_feed_retornos as r (conteudo_id, user_id, respostas)
  values (p_id, v_uid, v_r)
  on conflict (conteudo_id, user_id) do update set respostas = excluded.respostas, updated_at = now();

  return jsonb_build_object('id', p_id, 'respostas', to_jsonb(v_r));
end;
$$;
revoke all on function public.club_feed_retornar(uuid, text[]) from public, anon, authenticated;
grant execute on function public.club_feed_retornar(uuid, text[]) to authenticated;

-- ── Autor ────────────────────────────────────────────────────────────────────

-- Quem apoiou e como: so o autor. "So vi" nao aparece. Seguir nao entra na soma.
create or replace function public.club_feed_quem_apoiou(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not exists (select 1 from public.club_conteudos c where c.id = p_id and c.user_id = v_uid) then
    raise exception 'post_nao_encontrado';
  end if;
  return jsonb_build_object(
    'apoios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'arroba', public.club_instagram_limpo(u.instagram),
        'gestos', to_jsonb(array(select g from unnest(a.gestos) g where g <> 'segui')),
        'comentou', a.gestos @> array['comentei'],
        'confirmado_em', a.comentario_confirmado_em,
        'em', a.updated_at) order by a.updated_at desc)
      from public.club_feed_apoios a join public.users u on u.id = a.user_id
      where a.conteudo_id = p_id and cardinality(array_remove(a.gestos, 'segui')) > 0), '[]'::jsonb),
    'soma', (
      select jsonb_build_object(
        'pessoas', count(*),
        'curti', count(*) filter (where a.gestos @> array['curti']),
        'comentei', count(*) filter (where a.gestos @> array['comentei']),
        'compartilhei', count(*) filter (where a.gestos @> array['compartilhei']),
        'salvei', count(*) filter (where a.gestos @> array['salvei']))
      from public.club_feed_apoios a where a.conteudo_id = p_id and cardinality(array_remove(a.gestos, 'segui')) > 0),
    'retornos', coalesce((
      select jsonb_agg(jsonb_build_object('arroba', public.club_instagram_limpo(u.instagram), 'respostas', to_jsonb(r.respostas), 'em', r.updated_at)
             order by r.updated_at desc)
      from public.club_feed_retornos r join public.users u on u.id = r.user_id
      where r.conteudo_id = p_id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.club_feed_quem_apoiou(uuid) from public, anon, authenticated;
grant execute on function public.club_feed_quem_apoiou(uuid) to authenticated;

-- O autor confirma que recebeu o comentario de @x. E o unico "verificado" do apoio.
create or replace function public.club_feed_confirmar_comentario(p_id uuid, p_arroba text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_ig     text;
  v_quem   uuid;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not exists (select 1 from public.club_conteudos c where c.id = p_id and c.user_id = v_uid) then
    raise exception 'post_nao_encontrado';
  end if;
  if lower(btrim(coalesce(p_arroba, ''), ' @')) !~ '^[a-z0-9._]{1,30}$' then raise exception 'apoio_nao_encontrado'; end if;
  select a.user_id into v_quem
  from public.club_feed_apoios a join public.users u on u.id = a.user_id
  where a.conteudo_id = p_id and a.gestos @> array['comentei']
    and public.club_instagram_limpo(u.instagram) = lower(btrim(coalesce(p_arroba, ''), ' @'))
  limit 1;
  if v_quem is null then raise exception 'apoio_nao_encontrado'; end if;

  update public.club_feed_apoios a set comentario_confirmado_em = coalesce(a.comentario_confirmado_em, now())
   where a.conteudo_id = p_id and a.user_id = v_quem;

  select public.club_instagram_limpo(u.instagram) into v_ig from public.users u where u.id = v_uid;
  perform public.club_feed_avisar_interno(v_quem, 'Comentario confirmado',
    '@' || coalesce(v_ig, '') || ' confirmou o seu comentario.', '/pokecreatorsclub/feed?apoio=1', 'feed_confirmado:' || v_quem);

  return jsonb_build_object('id', p_id, 'confirmado', true);
end;
$$;
revoke all on function public.club_feed_confirmar_comentario(uuid, text) from public, anon, authenticated;
grant execute on function public.club_feed_confirmar_comentario(uuid, text) to authenticated;

-- Meus posts no feed, inclusive os tirados (com o motivo que o autor le).
create or replace function public.club_feed_meus()
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'rede', c.rede, 'formato', c.formato, 'tema', c.tema, 'pergunta', c.feed_pergunta,
      'url', c.url, 'feed_em', c.feed_em, 'retorno', c.feed_retorno,
      'oculto', c.feed_oculto_em is not null, 'oculto_motivo', c.feed_oculto_motivo,
      'apoiaram', (select count(*) from public.club_feed_apoios a where a.conteudo_id = c.id and cardinality(array_remove(a.gestos, 'segui')) > 0),
      'a_confirmar', (select count(*) from public.club_feed_apoios a
                      where a.conteudo_id = c.id and a.gestos @> array['comentei'] and a.comentario_confirmado_em is null),
      'retornos', (select count(*) from public.club_feed_retornos r where r.conteudo_id = c.id)
    ) order by c.feed_em desc)
    from public.club_conteudos c
    where c.user_id = v_uid and c.feed_em is not null), '[]'::jsonb);
end;
$$;
revoke all on function public.club_feed_meus() from public, anon, authenticated;
grant execute on function public.club_feed_meus() to authenticated;

-- "Seu apoio": so a propria pessoa ve. Sem ranking, sem comparacao.
create or replace function public.club_feed_meu_apoio()
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  return (
    select jsonb_build_object(
      'creators', count(distinct c.user_id),
      'comentarios_confirmados', count(*) filter (where a.comentario_confirmado_em is not null),
      'desde', min(a.created_at))
    from public.club_feed_apoios a join public.club_conteudos c on c.id = a.conteudo_id
    where a.user_id = v_uid and cardinality(array_remove(a.gestos, 'segui')) > 0
  );
end;
$$;
revoke all on function public.club_feed_meu_apoio() from public, anon, authenticated;
grant execute on function public.club_feed_meu_apoio() to authenticated;

-- ── Denuncia (qualquer conta logada) ─────────────────────────────────────────

-- Uma por conta por post. Tres denuncias abertas de MEMBROS diferentes tiram o post do feed
-- ate a organizacao decidir. A organizacao e avisada na primeira denuncia do post.
create or replace function public.club_feed_denunciar(p_id uuid, p_motivo text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_c         public.club_conteudos;
  v_abertas   integer;
  v_membros   integer;
  v_org       uuid;
  v_ig        text;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if p_motivo is null or p_motivo not in ('cobra_apoio', 'nao_e_da_pessoa', 'spam', 'link_quebrado', 'ofensivo', 'golpe', 'outro') then
    raise exception 'motivo_invalido';
  end if;
  select * into v_c from public.club_conteudos c where c.id = p_id and c.feed_em is not null and c.status = 'ativo';
  if not found then raise exception 'post_nao_encontrado'; end if;
  if v_c.user_id = v_uid then raise exception 'proprio_post'; end if;

  insert into public.club_feed_denuncias (conteudo_id, user_id, motivo) values (p_id, v_uid, p_motivo)
  on conflict (conteudo_id, user_id) do nothing;
  if not found then return jsonb_build_object('id', p_id, 'denunciado', true, 'repetida', true); end if;

  select count(*), count(*) filter (where exists (select 1 from public.club_membros m where m.user_id = d.user_id))
    into v_abertas, v_membros
  from public.club_feed_denuncias d where d.conteudo_id = p_id and d.resolvida_em is null;

  if v_membros >= 3 and v_c.feed_oculto_em is null then
    update public.club_conteudos c set feed_oculto_em = now(), feed_oculto_por = null, feed_oculto_motivo = 'denuncias'
     where c.id = p_id;
    insert into public.club_feed_bloqueios (chave, motivo, por) values (v_c.chave, 'denuncias', null)
    on conflict (chave) do nothing;
  end if;

  if v_abertas = 1 or (v_membros >= 3 and v_c.feed_oculto_em is null) then
    select public.club_instagram_limpo(u.instagram) into v_ig from public.users u where u.id = v_c.user_id;
    for v_org in select o.user_id from public.club_organizadores o where o.papeis @> array['feed'] loop
      perform public.club_feed_avisar_interno(v_org, 'Denuncia no feed',
        case when v_membros >= 3 then 'O post de @' || coalesce(v_ig, '') || ' saiu do feed por denuncias.'
             else 'O post de @' || coalesce(v_ig, '') || ' foi denunciado.' end,
        '/pokecreatorsclub/feed?organizar=1', 'feed_denuncia:' || p_id || ':' || (v_membros >= 3)::text);
    end loop;
  end if;

  return jsonb_build_object('id', p_id, 'denunciado', true, 'repetida', false);
end;
$$;
revoke all on function public.club_feed_denunciar(uuid, text) from public, anon, authenticated;
grant execute on function public.club_feed_denunciar(uuid, text) to authenticated;

-- ── Organizacao (papel 'feed') ───────────────────────────────────────────────

create or replace function public.club_feed_organizar_lista()
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_semana date := public.club_feed_semana_atual();
begin
  if auth.uid() is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('feed') then raise exception 'sem_papel'; end if;

  return jsonb_build_object(
    'primeiros', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'arroba', public.club_instagram_limpo(u.instagram), 'rede', c.rede,
               'tema', c.tema, 'url', c.url, 'feed_em', c.feed_em,
               'apoiaram', (select count(*) from public.club_feed_apoios a where a.conteudo_id = c.id and cardinality(array_remove(a.gestos, 'segui')) > 0))
             order by c.feed_em)
      from public.club_conteudos c join public.users u on u.id = c.user_id
      where c.feed_em > now() - interval '72 hours' and c.feed_oculto_em is null and c.status = 'ativo'
        and not exists (select 1 from public.club_conteudos o where o.user_id = c.user_id and o.feed_em is not null and o.feed_em < c.feed_em)
    ), '[]'::jsonb),
    'denunciados', coalesce((
      select jsonb_agg(x order by x->>'ultima' desc) from (
        select jsonb_build_object('id', c.id, 'arroba', public.club_instagram_limpo(u.instagram), 'rede', c.rede, 'tema', c.tema,
                 'url', c.url, 'oculto', c.feed_oculto_em is not null,
                 'motivos', (select jsonb_object_agg(m.motivo, m.n) from (
                    select d.motivo, count(*) n from public.club_feed_denuncias d
                    where d.conteudo_id = c.id and d.resolvida_em is null group by d.motivo) m),
                 'ultima', (select max(d.created_at) from public.club_feed_denuncias d where d.conteudo_id = c.id and d.resolvida_em is null)) as x
        from public.club_conteudos c join public.users u on u.id = c.user_id
        where exists (select 1 from public.club_feed_denuncias d where d.conteudo_id = c.id and d.resolvida_em is null)
      ) s
    ), '[]'::jsonb),
    'conferir_arroba', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'arroba', public.club_instagram_limpo(u.instagram),
               'arroba_video', c.feed_conferir_arroba, 'url', c.url, 'feed_em', c.feed_em) order by c.feed_em)
      from public.club_conteudos c join public.users u on u.id = c.user_id
      where c.feed_conferir_arroba is not null and c.feed_em is not null and c.feed_oculto_em is null
    ), '[]'::jsonb),
    'fora', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'arroba', public.club_instagram_limpo(u.instagram), 'rede', c.rede,
               'url', c.url, 'motivo', c.feed_oculto_motivo, 'nota', c.feed_oculto_nota, 'em', c.feed_oculto_em)
             order by c.feed_oculto_em desc)
      from public.club_conteudos c join public.users u on u.id = c.user_id
      where c.feed_em is not null and c.feed_oculto_em is not null
    ), '[]'::jsonb),
    'semana', jsonb_build_object('inicio', v_semana,
      'tema', (select s.tema from public.club_feed_semanas s where s.semana = v_semana),
      'escolha', (select s.escolha from public.club_feed_semanas s where s.semana = v_semana))
  );
end;
$$;
revoke all on function public.club_feed_organizar_lista() from public, anon, authenticated;
grant execute on function public.club_feed_organizar_lista() to authenticated;

-- Acoes da organizacao. Tambem usada pelo /admin (service_role). Nunca mexe em status nem em carta.
--   tirar     : tira do feed com motivo (o autor le) e nota interna; resolve as denuncias.
--   devolver  : volta para o feed; resolve as denuncias.
--   manter    : resolve as denuncias e deixa o post no feed.
--   arroba_ok : o @ do TikTok esta certo.
create or replace function public.club_feed_moderar_interno(p_id uuid, p_acao text, p_motivo text, p_nota text, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c    public.club_conteudos;
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  -- Sem filtro de feed_em: post que o autor tirou continua moderavel (denuncia aberta, devolver).
  select * into v_c from public.club_conteudos c where c.id = p_id for update;
  if not found then raise exception 'post_nao_encontrado'; end if;
  if p_autor is not null and v_c.user_id = p_autor then raise exception 'proprio_conteudo'; end if;
  if v_nota is not null and char_length(v_nota) > 300 then raise exception 'nota_longa'; end if;

  if p_acao = 'tirar' then
    if p_motivo is null or p_motivo not in ('cobra_apoio', 'nao_e_da_pessoa', 'spam', 'link_quebrado', 'ofensivo', 'fora_do_tema', 'outro') then
      raise exception 'motivo_invalido';
    end if;
    update public.club_conteudos c set feed_oculto_em = now(), feed_oculto_por = p_autor,
           feed_oculto_motivo = p_motivo, feed_oculto_nota = v_nota
     where c.id = p_id;
    insert into public.club_feed_bloqueios (chave, motivo, por) values (v_c.chave, p_motivo, p_autor)
    on conflict (chave) do update set motivo = excluded.motivo, por = excluded.por, em = now();
  elsif p_acao = 'devolver' then
    update public.club_conteudos c set feed_oculto_em = null, feed_oculto_por = null,
           feed_oculto_motivo = null, feed_oculto_nota = null
     where c.id = p_id;
    delete from public.club_feed_bloqueios b where b.chave = v_c.chave;
  elsif p_acao = 'arroba_ok' then
    update public.club_conteudos c set feed_conferir_arroba = null where c.id = p_id;
  elsif p_acao <> 'manter' then
    raise exception 'acao_invalida';
  end if;

  if p_acao in ('tirar', 'devolver', 'manter') then
    update public.club_feed_denuncias d set resolvida_em = now(), resolvida_por = p_autor
     where d.conteudo_id = p_id and d.resolvida_em is null;
  end if;

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (p_autor, 'feed', 'feed_' || p_acao, p_id::text,
          jsonb_build_object('motivo', p_motivo, 'nota', v_nota, 'autor_post', v_c.user_id));

  return jsonb_build_object('id', p_id, 'acao', p_acao);
end;
$$;
revoke all on function public.club_feed_moderar_interno(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.club_feed_moderar_interno(uuid, text, text, text, uuid) to service_role;

create or replace function public.club_feed_moderar(p_id uuid, p_acao text, p_motivo text default null, p_nota text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('feed') then raise exception 'sem_papel'; end if;
  return public.club_feed_moderar_interno(p_id, p_acao, p_motivo, p_nota, auth.uid());
end;
$$;
revoke all on function public.club_feed_moderar(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.club_feed_moderar(uuid, text, text, text) to authenticated;

-- Tema e escolha da semana corrente.
create or replace function public.club_feed_semana_salvar(p_tema text, p_escolha uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_semana date := public.club_feed_semana_atual();
  v_tema   text := public.club_sem_emoji(p_tema);
begin
  if auth.uid() is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('feed') then raise exception 'sem_papel'; end if;
  if v_tema is not null and (char_length(v_tema) < 3 or char_length(v_tema) > 40 or v_tema ~ '[\n\r]') then
    raise exception 'tema_invalido';
  end if;
  if p_escolha is not null and not exists (
    select 1 from public.club_conteudos c where c.id = p_escolha and c.feed_em is not null and c.feed_oculto_em is null and c.status = 'ativo'
  ) then
    raise exception 'post_nao_encontrado';
  end if;
  if p_escolha is not null and exists (select 1 from public.club_conteudos c where c.id = p_escolha and c.user_id = auth.uid()) then
    raise exception 'proprio_conteudo';
  end if;

  insert into public.club_feed_semanas (semana, tema, escolha, updated_por, updated_at)
  values (v_semana, v_tema, p_escolha, auth.uid(), now())
  on conflict (semana) do update set tema = excluded.tema, escolha = excluded.escolha,
    updated_por = excluded.updated_por, updated_at = now();

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (auth.uid(), 'feed', 'feed_semana', v_semana::text, jsonb_build_object('tema', v_tema, 'escolha', p_escolha));

  return jsonb_build_object('inicio', v_semana, 'tema', v_tema, 'escolha', p_escolha);
end;
$$;
revoke all on function public.club_feed_semana_salvar(text, uuid) from public, anon, authenticated;
grant execute on function public.club_feed_semana_salvar(text, uuid) to authenticated;

-- ── Album: conta no maximo 5 conteudos por dia ───────────────────────────────
-- Igual a 20261125120000_club_capitulos.sql, exceto o ramo 'conteudos' sem 'distintos_por':
-- soma, por dia de Brasilia, no maximo 5. O feed nao tem limite; o limite fica so na recompensa.
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

  elsif v_k.regra_tipo = 'capitulos' then
    -- Capitulo fechado = edicao do mesmo ciclo, base ou capitulo, no ar ou encerrada, com ao menos
    -- total_previsto cartas cadastradas e TODAS elas na mao da pessoa (revogada nao conta). Rascunho
    -- nao conta (a previa da organizacao nao fecha nada) e especial tambem nao (evita a carta contar a si mesma).
    select count(*) into v_tem
    from public.club_colecoes e
    where e.ciclo = (select c.ciclo from public.club_colecoes c where c.id = v_k.colecao_id)
      and e.papel in ('base', 'capitulo') and e.status in ('publicada', 'encerrada')
      and (v_k.regra_param->>'trilha' is null or e.trilha = v_k.regra_param->>'trilha')
      and e.total_previsto is not null
      and (select count(*) from public.club_cartas k where k.colecao_id = e.id) >= e.total_previsto
      and (select count(*) from public.club_cartas k where k.colecao_id = e.id) = (
            select count(*) from public.club_desbloqueios d
            join public.club_cartas k on k.id = d.carta_id
            where d.user_id = p_user and d.revogado_em is null and k.colecao_id = e.id);
    return v_tem >= v_min;

  elsif v_k.regra_tipo = 'conteudos' then
    -- Conteudos ativos da pessoa, com os filtros da regra. 'distintos_por' conta
    -- formatos ou redes diferentes em vez de linhas. Sem ele, cada dia (Brasilia)
    -- vale no maximo 5: o feed nao tem limite de post, a recompensa tem.
    if v_k.regra_param->>'distintos_por' in ('formato', 'rede') then
      select case v_k.regra_param->>'distintos_por'
          when 'formato' then count(distinct c.formato)
          else count(distinct c.rede) end
      into v_tem
      from public.club_conteudos c
      where c.user_id = p_user and c.status = 'ativo'
        and (v_desde is null or c.created_at >= v_desde)
        and (v_k.regra_param->>'formato' is null or c.formato = v_k.regra_param->>'formato')
        and (v_k.regra_param->>'tema' is null or c.tema = v_k.regra_param->>'tema')
        and (v_k.regra_param->>'rede' is null or c.rede = v_k.regra_param->>'rede');
    else
      select coalesce(sum(least(d.n, 5)), 0)::integer into v_tem
      from (
        select count(*) as n
        from public.club_conteudos c
        where c.user_id = p_user and c.status = 'ativo'
          and (v_desde is null or c.created_at >= v_desde)
          and (v_k.regra_param->>'formato' is null or c.formato = v_k.regra_param->>'formato')
          and (v_k.regra_param->>'tema' is null or c.tema = v_k.regra_param->>'tema')
          and (v_k.regra_param->>'rede' is null or c.rede = v_k.regra_param->>'rede')
        group by (c.created_at at time zone 'America/Sao_Paulo')::date
      ) d;
    end if;
    return v_tem >= v_min;

  elsif v_k.regra_tipo = 'conteudos_sequencia' then
    return public.club_conteudos_semanas(p_user, v_desde) >= greatest(2, coalesce(nullif(v_k.regra_param->>'semanas', '')::integer, 4));
  end if;

  return false;
end;
$$;
revoke all on function public.club_missao_cumprida_v2(uuid, uuid) from public, anon, authenticated;

-- ── Portfolio: o feed nao gasta a cota do Portfolio ──────────────────────────
-- Igual a 20261122120000_club_portfolio.sql, exceto as duas contagens de limite, que agora
-- ignoram o que foi postado pelo feed (feed_em preenchido). O feed nao tem limite; o Portfolio
-- segue com 5 por dia e 300 no total.
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
      where c.user_id = v_uid and c.feed_em is null and (c.created_at at time zone 'America/Sao_Paulo')::date = v_hoje) >= 5 then
    raise exception 'limite_do_dia';
  end if;
  if (select count(*) from public.club_conteudos c where c.user_id = v_uid and c.feed_em is null and c.status = 'ativo') >= 300 then
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
