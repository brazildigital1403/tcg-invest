-- ============================================================================
-- Album do Club (Fase 1, fatia 1): tabelas, bucket, papel "colecao" e RPCs.
--
-- Cada membro do Club ganha cartas da edicao em vigor cumprindo missoes. As
-- automaticas sao conferidas na hora em que o membro abre o album
-- (club_colecao_minha), por busca em indice, sem cron e sem varrer tabela
-- grande. As manuais sao concedidas por quem organiza. Nada aparece para
-- membro enquanto a edicao estiver em 'rascunho' (ou antes de abre_em): o
-- status e o interruptor, sem deploy.
--
-- Segredo da arte: o bucket e publico para leitura, mas o caminho de cada arte
-- e imprevisivel (32 hex, imposto por CHECK) e a RPC so devolve arte_path de
-- carta ganha ou liberada como previa. Carta bloqueada nunca manda arte, nome
-- nem texto ao navegador.
--
-- Papeis: quem tem o papel 'colecao' concede so carta de missao manual, nunca
-- a si mesma, e desfaz so os lotes que ela mesma concedeu. O Admin (service
-- role) concede qualquer carta e controla o estado da edicao.
--
-- Tabela nova nasce exposta no Supabase: RLS ligada, zero policy e revoke em
-- todas. Leitura e escrita so por RPC security definer.
--
-- ROLLBACK (ordem inversa; so com o bucket vazio e sem desbloqueios):
--   drop function public.club_colecao_desfazer_lote(uuid);
--   drop function public.club_colecao_conceder(text, smallint, text[], text);
--   drop function public.club_colecao_estado_interno(uuid, text, uuid, jsonb);
--   drop function public.club_colecao_desfazer_lote_interno(uuid, uuid);
--   drop function public.club_colecao_conceder_interno(uuid, smallint[], uuid[], text, uuid, text);
--   drop function public.club_colecao_resolver_interno(text[]);
--   drop function public.club_retirada_pedir(text);
--   drop function public.club_carta_virar(uuid);
--   drop function public.club_colecao_minha(text);
--   drop function public.club_missao_cumprida(uuid, text, uuid);
--   drop table public.club_retiradas;
--   drop table public.club_desbloqueios;
--   drop table public.club_cartas;
--   drop table public.club_colecoes;
--   drop index public.club_avisos_votos_user_idx;
--   delete from storage.buckets where id = 'club-colecao';
--   delete from public.club_organizacao_log where acao in ('conceder_lote', 'desfazer_lote', 'colecao_publicar', 'colecao_recolher', 'colecao_encerrar');
--   (so se ninguem tiver o papel 'colecao':)
--   alter table public.club_organizadores drop constraint club_organizadores_papeis_check;
--   alter table public.club_organizadores add constraint club_organizadores_papeis_check
--     check (cardinality(papeis) >= 1 and papeis <@ array['agenda', 'aniversariantes', 'avisos']);
-- ============================================================================

-- ── Papel novo ──────────────────────────────────────────────────────────────

alter table public.club_organizadores drop constraint club_organizadores_papeis_check;
alter table public.club_organizadores add constraint club_organizadores_papeis_check
  check (cardinality(papeis) >= 1 and papeis <@ array['agenda', 'aniversariantes', 'avisos', 'colecao']);

-- ── Tabelas ─────────────────────────────────────────────────────────────────

-- Uma edicao do album. 'publicada' com abre_em no futuro = agendada: so quem
-- tem o papel enxerga ate chegar a hora.
create table public.club_colecoes (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  edicao          smallint not null unique check (edicao >= 1),
  titulo          text not null check (char_length(titulo) between 3 and 80),
  status          text not null default 'rascunho' check (status in ('rascunho', 'publicada', 'encerrada')),
  -- Janela de ganhar cartas: abre_em ate fecha_em. Depois, ate pedir_set_ate, so
  -- o pedido do set fisico. Publicada e encerrada exigem as tres datas.
  abre_em         timestamptz,
  fecha_em        timestamptz,
  pedir_set_ate   timestamptz,
  -- Teto de pedidos do set fisico. Nulo = sem teto definido.
  tiragem_fisica  integer check (tiragem_fisica is null or tiragem_fisica >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (status = 'rascunho' or (abre_em is not null and fecha_em is not null and pedir_set_ate is not null)),
  check (abre_em is null or fecha_em is null or abre_em < fecha_em),
  check (fecha_em is null or pedir_set_ate is null or fecha_em <= pedir_set_ate)
);

-- As 12 cartas de uma edicao. Uma carta por missao. O rosto (nome, tipo,
-- raridade, texto, homenageado, arte) so chega ao membro depois de ganhar, ou
-- antes se a carta estiver marcada como previa.
create table public.club_cartas (
  id            uuid primary key default gen_random_uuid(),
  colecao_id    uuid not null references public.club_colecoes(id) on delete cascade,
  numero        smallint not null check (numero between 1 and 12),
  missao        text not null check (missao in ('entrei', 'data', 'arroba', 'colecao', 'opiniao', 'indicacao', 'graduada', 'plateia', 'palco', 'trend', 'ideia', 'completo')),
  modo          text not null check (modo in ('auto', 'manual')),
  como_ganhar   text not null check (char_length(como_ganhar) between 3 and 80),
  nome          text check (char_length(nome) between 2 and 60),
  tipo          text check (char_length(tipo) between 2 and 30),
  raridade      text check (char_length(raridade) between 2 and 30),
  texto_efeito  text check (char_length(texto_efeito) between 1 and 280),
  homenageado   text check (char_length(homenageado) between 2 and 80),
  -- Caminho no bucket club-colecao: <slug-da-edicao>/<32 hex>.<ext>. O trecho
  -- aleatorio e o que mantem a arte secreta num bucket de leitura publica.
  arte_path     text unique check (arte_path ~ '^[a-z0-9]+(-[a-z0-9]+)*/[0-9a-f]{32}\.(webp|png|jpg)$'),
  previa        boolean not null default false,
  secreta       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (colecao_id, numero),
  unique (colecao_id, missao),
  -- Missao sem regra automatica so pode ser manual.
  check (modo = 'manual' or missao in ('entrei', 'data', 'arroba', 'colecao', 'opiniao', 'indicacao', 'graduada', 'completo')),
  check (not (previa and secreta))
);

-- Quem ganhou o que. A linha nunca some: revogar so carimba revogado_em, e e
-- isso que impede a conferencia automatica de devolver a carta de novo.
-- revelada_em e por pessoa (a carta chega fechada e o toque vira).
create table public.club_desbloqueios (
  user_id        uuid not null references public.users(id) on delete cascade,
  carta_id       uuid not null references public.club_cartas(id) on delete restrict,
  origem         text not null check (origem in ('auto', 'manual', 'brinde')),
  lote           uuid,
  concedido_por  uuid references public.users(id) on delete set null,
  concedido_em   timestamptz not null default now(),
  revelada_em    timestamptz,
  revogado_em    timestamptz,
  revogado_por   uuid references public.users(id) on delete set null,
  primary key (user_id, carta_id)
);
create index club_desbloqueios_carta_idx on public.club_desbloqueios (carta_id);
create index club_desbloqueios_lote_idx on public.club_desbloqueios (lote) where lote is not null;

-- Pedido de receber o set fisico. Fase 1: so o "quero receber", sem endereco.
create table public.club_retiradas (
  numero         integer generated always as identity primary key,
  colecao_id     uuid not null references public.club_colecoes(id) on delete restrict,
  user_id        uuid references public.users(id) on delete set null,
  status         text not null default 'solicitada' check (status in ('solicitada', 'combinada', 'postada', 'entregue', 'cancelada')),
  nota           text check (char_length(nota) <= 500),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
-- Um pedido ativo por pessoa e por edicao (o cancelado libera).
create unique index club_retiradas_um_por_pessoa on public.club_retiradas (colecao_id, user_id) where status <> 'cancelada';

alter table public.club_colecoes enable row level security;
alter table public.club_cartas enable row level security;
alter table public.club_desbloqueios enable row level security;
alter table public.club_retiradas enable row level security;
revoke all on public.club_colecoes from public, anon, authenticated;
revoke all on public.club_cartas from public, anon, authenticated;
revoke all on public.club_desbloqueios from public, anon, authenticated;
revoke all on public.club_retiradas from public, anon, authenticated;

-- A missao "votar numa enquete" pergunta "esta pessoa ja votou?". A chave dos
-- votos e (aviso_id, user_id): sem este indice a pergunta varre a tabela toda a
-- cada vez que um membro que ainda nao votou abre o album.
create index club_avisos_votos_user_idx on public.club_avisos_votos (user_id);

-- ── Bucket da arte ──────────────────────────────────────────────────────────

-- Leitura publica pela URL (caminho imprevisivel). Sem nenhuma policy em
-- storage.objects para este bucket: so o servidor (service role) escreve, e
-- ninguem lista o conteudo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-colecao', 'club-colecao', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- ── Missoes automaticas ─────────────────────────────────────────────────────

-- A regra de cada missao automatica. Cada ramo e uma busca por indice. Nao e
-- "stable" de proposito: 'completo' le os desbloqueios que a conferencia acabou
-- de gravar. Sem acesso para ninguem: so as funcoes abaixo a chamam.
create or replace function public.club_missao_cumprida(p_user uuid, p_missao text, p_colecao uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  return case p_missao
    when 'entrei' then exists (select 1 from public.club_membros m where m.user_id = p_user)
    when 'data' then exists (select 1 from public.club_aniversarios a where a.user_id = p_user)
    when 'arroba' then exists (
      select 1 from public.users u
      where u.id = p_user and public.club_instagram_limpo(u.instagram) ~ '^[a-z0-9._]{1,30}$'
    )
    -- 10 cartas diferentes na colecao (linhas, nao copias: uma carta com
    -- quantidade 10 nao cumpre a missao sozinha).
    when 'colecao' then (select count(*) from public.user_cards uc where uc.user_id = p_user) >= 10
    when 'opiniao' then exists (select 1 from public.club_avisos_votos v where v.user_id = p_user)
    when 'indicacao' then exists (
      select 1 from public.referrals r
      where r.referrer_user_id = p_user and r.ativou_at is not null and not coalesce(r.is_suspicious, false)
    )
    when 'graduada' then exists (select 1 from public.user_cards uc where uc.user_id = p_user and uc.graduada)
    -- Carta secreta: derivada das outras, sem sinal novo. Tem as cartas das
    -- cinco primeiras missoes desta edicao.
    when 'completo' then (
      select count(*)
      from public.club_desbloqueios d
      join public.club_cartas c on c.id = d.carta_id
      where d.user_id = p_user and d.revogado_em is null and c.colecao_id = p_colecao
        and c.missao in ('entrei', 'data', 'arroba', 'colecao', 'opiniao')
    ) = 5
    else false
  end;
end;
$$;
revoke all on function public.club_missao_cumprida(uuid, text, uuid) from public, anon, authenticated;

-- ── Membro: o album, virar a carta, pedir o set ─────────────────────────────

-- O album da pessoa logada. Sem p_slug devolve a edicao em vigor (a publicada
-- mais nova); sem edicao visivel devolve {edicao: null}, sem erro. Quem tem o
-- papel 'colecao' enxerga tambem rascunho e edicao agendada (previa).
-- Confere as missoes automaticas das cartas ainda sem linha, enquanto a edicao
-- ganha cartas. Carta bloqueada sai sem arte, nome, tipo, raridade, texto e
-- homenageado: so o numero, o estado e como ganhar.
create or replace function public.club_colecao_minha(p_slug text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_agora      timestamptz := now();
  v_org        boolean;
  v_c          public.club_colecoes;
  v_avalia     boolean;
  v_k          record;
  v_cartas     jsonb;
  v_total      integer;
  v_ganhas     integer;
  v_reveladas  integer;
  v_ret        jsonb;
  v_ativos     integer;
  v_pode       boolean;
  v_esgotado   boolean := false;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not exists (select 1 from public.club_membros m where m.user_id = v_uid) then raise exception 'nao_membro'; end if;
  v_org := public.club_tem_papel('colecao');

  select c.* into v_c
  from public.club_colecoes c
  where (p_slug is null or c.slug = p_slug)
    and (v_org or (c.status in ('publicada', 'encerrada') and c.abre_em <= v_agora))
  order by (c.status = 'publicada') desc, c.edicao desc
  limit 1;
  if not found then
    return jsonb_build_object('edicao', null, 'papeis', public.club_meus_papeis());
  end if;

  -- Ganhando cartas: dentro da janela. Para o membro so existe a publicada ja
  -- aberta; a previa da organizacao tambem confere (os sinais sao reais).
  v_avalia := v_c.status in ('rascunho', 'publicada')
          and (v_c.fecha_em is null or v_agora < v_c.fecha_em)
          and (v_c.status = 'rascunho' or v_c.abre_em <= v_agora or v_org);

  if v_avalia then
    -- Cartas automaticas ainda sem linha (nem revogada: revogar e definitivo
    -- para a conferencia). 'completo' por ultimo, porque deriva das outras.
    for v_k in
      select c.id, c.missao
      from public.club_cartas c
      where c.colecao_id = v_c.id and c.modo = 'auto'
        and not exists (select 1 from public.club_desbloqueios d where d.user_id = v_uid and d.carta_id = c.id)
      order by (c.missao = 'completo'), c.numero
    loop
      if public.club_missao_cumprida(v_uid, v_k.missao, v_c.id) then
        insert into public.club_desbloqueios (user_id, carta_id, origem)
        values (v_uid, v_k.id, 'auto')
        on conflict (user_id, carta_id) do nothing;
      end if;
    end loop;
  end if;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'numero', c.numero,
        'estado', e.estado,
        'modo', c.modo,
        'secreta', c.secreta,
        'previa', c.previa,
        'como_ganhar', case when c.secreta and d.carta_id is null then 'Surpresa' else c.como_ganhar end
      )
      || case when not (c.secreta and d.carta_id is null) then jsonb_build_object('missao', c.missao) else '{}'::jsonb end
      || case when e.mostra then jsonb_build_object(
           'nome', c.nome, 'tipo', c.tipo, 'raridade', c.raridade, 'texto_efeito', c.texto_efeito,
           'homenageado', c.homenageado, 'arte_path', c.arte_path
         ) else '{}'::jsonb end
      || case when d.carta_id is not null then jsonb_build_object(
           'ganha_em', d.concedido_em, 'revelada_em', d.revelada_em, 'origem', d.origem
         ) else '{}'::jsonb end
      order by c.numero
    ), '[]'::jsonb)
  into v_cartas
  from public.club_cartas c
  left join public.club_desbloqueios d on d.carta_id = c.id and d.user_id = v_uid and d.revogado_em is null
  cross join lateral (
    select
      case when d.carta_id is not null then (case when d.revelada_em is null then 'nova' else 'ganha' end)
           when c.previa then 'previa'
           when c.secreta then 'secreta'
           else 'bloqueada' end as estado,
      (d.carta_id is not null or c.previa) as mostra
  ) e
  where c.colecao_id = v_c.id;

  select count(*) into v_total from public.club_cartas c where c.colecao_id = v_c.id;
  select count(*), count(d.revelada_em) into v_ganhas, v_reveladas
  from public.club_desbloqueios d
  join public.club_cartas c on c.id = d.carta_id
  where d.user_id = v_uid and d.revogado_em is null and c.colecao_id = v_c.id;

  select jsonb_build_object('numero', r.numero, 'status', r.status, 'criado_em', r.criado_em) into v_ret
  from public.club_retiradas r
  where r.colecao_id = v_c.id and r.user_id = v_uid and r.status <> 'cancelada';

  v_pode := v_c.status = 'publicada' and v_c.abre_em <= v_agora
        and v_c.pedir_set_ate is not null and v_agora <= v_c.pedir_set_ate
        and v_total > 0 and v_reveladas = v_total and v_ret is null;
  if v_pode and v_c.tiragem_fisica is not null then
    select count(*) into v_ativos from public.club_retiradas r where r.colecao_id = v_c.id and r.status <> 'cancelada';
    if v_ativos >= v_c.tiragem_fisica then v_pode := false; v_esgotado := true; end if;
  end if;

  return jsonb_build_object(
    'edicao', jsonb_build_object(
      'slug', v_c.slug, 'edicao', v_c.edicao, 'titulo', v_c.titulo, 'status', v_c.status,
      'abre_em', v_c.abre_em, 'fecha_em', v_c.fecha_em, 'pedir_set_ate', v_c.pedir_set_ate,
      'ganhando', v_avalia,
      'previa', (v_c.status = 'rascunho' or v_c.abre_em > v_agora)
    ),
    'cartas', v_cartas,
    'total', v_total,
    'ganhas', v_ganhas,
    'reveladas', v_reveladas,
    'retirada', v_ret,
    'pode_pedir_set', v_pode,
    'set_esgotado', v_esgotado,
    'papeis', public.club_meus_papeis()
  );
end;
$$;
revoke all on function public.club_colecao_minha(text) from public, anon, authenticated;
grant execute on function public.club_colecao_minha(text) to authenticated;

-- Vira a carta: grava revelada_em so na linha da propria pessoa. Idempotente
-- (a primeira vez vale). So conta como virada para o contador do album.
create or replace function public.club_carta_virar(p_carta uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_col  uuid;
  v_rev  timestamptz;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  select c.colecao_id into v_col from public.club_cartas c where c.id = p_carta;
  if not found then raise exception 'carta_nao_ganha'; end if;

  select d.revelada_em into v_rev
  from public.club_desbloqueios d
  where d.user_id = v_uid and d.carta_id = p_carta and d.revogado_em is null
  for update;
  if not found then raise exception 'carta_nao_ganha'; end if;

  if v_rev is null then
    update public.club_desbloqueios d set revelada_em = now()
    where d.user_id = v_uid and d.carta_id = p_carta
    returning d.revelada_em into v_rev;
  end if;

  return jsonb_build_object(
    'carta', p_carta,
    'revelada_em', v_rev,
    'reveladas', (
      select count(*) from public.club_desbloqueios d
      join public.club_cartas c on c.id = d.carta_id
      where d.user_id = v_uid and d.revogado_em is null and d.revelada_em is not null and c.colecao_id = v_col
    ),
    'total', (select count(*) from public.club_cartas c where c.colecao_id = v_col)
  );
end;
$$;
revoke all on function public.club_carta_virar(uuid) from public, anon, authenticated;
grant execute on function public.club_carta_virar(uuid) to authenticated;

-- Pedido do set fisico ("Receber meu set em casa"): so com todas as cartas
-- viradas, dentro do prazo, uma vez por edicao e ate o teto da tiragem.
create or replace function public.club_retirada_pedir(p_slug text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_agora  timestamptz := now();
  v_c      public.club_colecoes;
  v_total  integer;
  v_rev    integer;
  v_ativos integer;
  v_r      public.club_retiradas;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not exists (select 1 from public.club_membros m where m.user_id = v_uid) then raise exception 'nao_membro'; end if;

  select c.* into v_c
  from public.club_colecoes c
  where (p_slug is null or c.slug = p_slug) and c.status = 'publicada' and c.abre_em <= v_agora
  order by c.edicao desc
  limit 1;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  if v_c.pedir_set_ate is null or v_agora > v_c.pedir_set_ate then raise exception 'prazo_encerrado'; end if;

  -- Fila: quem pede ao mesmo tempo nao fura o teto da tiragem.
  perform pg_advisory_xact_lock(hashtext('club_retirada:' || v_c.id::text));

  select count(*) into v_total from public.club_cartas c where c.colecao_id = v_c.id;
  select count(*) into v_rev
  from public.club_desbloqueios d
  join public.club_cartas c on c.id = d.carta_id
  where d.user_id = v_uid and d.revogado_em is null and d.revelada_em is not null and c.colecao_id = v_c.id;
  if v_total = 0 or v_rev < v_total then raise exception 'album_incompleto'; end if;

  if exists (select 1 from public.club_retiradas r where r.colecao_id = v_c.id and r.user_id = v_uid and r.status <> 'cancelada') then
    raise exception 'ja_pediu';
  end if;
  if v_c.tiragem_fisica is not null then
    select count(*) into v_ativos from public.club_retiradas r where r.colecao_id = v_c.id and r.status <> 'cancelada';
    if v_ativos >= v_c.tiragem_fisica then raise exception 'sets_esgotados'; end if;
  end if;

  insert into public.club_retiradas (colecao_id, user_id) values (v_c.id, v_uid) returning * into v_r;
  return jsonb_build_object('numero', v_r.numero, 'status', v_r.status, 'criado_em', v_r.criado_em);
end;
$$;
revoke all on function public.club_retirada_pedir(text) from public, anon, authenticated;
grant execute on function public.club_retirada_pedir(text) to authenticated;

-- ── Interno (so service_role): resolver, conceder, desfazer, estado ─────────

-- Cola de @ ou e-mails -> pessoas. Devolve quem e membro (com nome e @), quem
-- tem conta mas nao entrou no Club, o que nao existe e o que bate em mais de um
-- membro. O e-mail so entra como chave de busca: nunca volta na resposta.
create or replace function public.club_colecao_resolver_interno(p_ids text[])
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_toks text[];
  v_enc  jsonb;
  v_nm   jsonb;
  v_ne   jsonb;
  v_amb  jsonb;
begin
  select coalesce(array_agg(distinct s.tok), '{}'::text[]) into v_toks
  from (select lower(regexp_replace(btrim(x), '^@+', '')) as tok from unnest(coalesce(p_ids, '{}'::text[])) x) s
  where s.tok <> '';
  if cardinality(v_toks) > 200 then raise exception 'lista_grande_demais'; end if;

  with toks as (
    select unnest(v_toks) as tok
  ), achados as (
    -- Dois joins de igualdade simples (um por tipo de chave) em vez de um CASE no
    -- join: assim o Postgres faz hash join e le a tabela de usuarios uma vez so,
    -- em vez de cruzar cada nome colado com todos os usuarios.
    select t.tok, u.id as uid, u.name as nome, public.club_instagram_limpo(u.instagram) as ig, (m.user_id is not null) as membro
    from toks t
    join public.users u on public.club_instagram_limpo(u.instagram) = t.tok
    left join public.club_membros m on m.user_id = u.id
    where position('@' in t.tok) = 0
    union all
    select t.tok, u.id, u.name, public.club_instagram_limpo(u.instagram), (m.user_id is not null)
    from toks t
    join public.users u on lower(btrim(u.email)) = t.tok
    left join public.club_membros m on m.user_id = u.id
    where position('@' in t.tok) > 0
  ), por_token as (
    select t.tok,
      count(a.uid) filter (where a.membro) as n_membros,
      count(a.uid) as n_usuarios,
      (array_agg(a.uid) filter (where a.membro))[1] as uid,
      (array_agg(a.nome) filter (where a.membro))[1] as nome,
      (array_agg(a.ig) filter (where a.membro))[1] as ig,
      (array_agg(a.nome) filter (where not a.membro))[1] as nome_fora
    from toks t
    left join achados a on a.tok = t.tok
    group by t.tok
  )
  select
    coalesce(jsonb_agg(jsonb_build_object('token', p.tok, 'user_id', p.uid, 'nome', p.nome, 'instagram', p.ig) order by p.tok) filter (where p.n_membros = 1), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('token', p.tok, 'nome', p.nome_fora) order by p.tok) filter (where p.n_membros = 0 and p.n_usuarios > 0), '[]'::jsonb),
    coalesce(jsonb_agg(p.tok order by p.tok) filter (where p.n_usuarios = 0), '[]'::jsonb),
    coalesce(jsonb_agg(p.tok order by p.tok) filter (where p.n_membros > 1), '[]'::jsonb)
  into v_enc, v_nm, v_ne, v_amb
  from por_token p;

  return jsonb_build_object('encontrados', v_enc, 'nao_membros', v_nm, 'nao_encontrados', v_ne, 'ambiguos', v_amb);
end;
$$;
revoke all on function public.club_colecao_resolver_interno(text[]) from public, anon, authenticated;
grant execute on function public.club_colecao_resolver_interno(text[]) to service_role;

-- Concede cartas (por numero) a varias pessoas de uma vez, num lote que depois
-- da para desfazer inteiro. So membros recebem: quem nao entrou no Club e
-- contado em "ignorados". Quem ja tinha a carta nao muda; quem teve a carta
-- revogada volta a te-la (lote novo). p_origem: 'manual' (missao a mao) ou
-- 'brinde' (varias de uma vez, por fora das missoes). p_autor nulo = Admin.
create or replace function public.club_colecao_conceder_interno(
  p_colecao uuid, p_numeros smallint[], p_users uuid[], p_origem text, p_autor uuid, p_nota text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c       public.club_colecoes;
  v_lote    uuid := gen_random_uuid();
  v_nums    smallint[];
  v_cartas  uuid[];
  v_pedidas uuid[];
  v_pessoas uuid[];
  v_novas   integer := 0;
  v_reativ  integer := 0;
  v_ja      integer := 0;
begin
  if p_origem not in ('manual', 'brinde') then raise exception 'origem_invalida'; end if;
  select * into v_c from public.club_colecoes c where c.id = p_colecao for share;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  if v_c.status = 'encerrada' then raise exception 'edicao_encerrada'; end if;

  select coalesce(array_agg(distinct n), '{}'::smallint[]) into v_nums from unnest(coalesce(p_numeros, '{}'::smallint[])) n where n is not null;
  if cardinality(v_nums) = 0 then raise exception 'sem_cartas'; end if;
  select array_agg(k.id) into v_cartas from public.club_cartas k where k.colecao_id = p_colecao and k.numero = any(v_nums);
  if coalesce(cardinality(v_cartas), 0) <> cardinality(v_nums) then raise exception 'carta_nao_encontrada'; end if;

  select coalesce(array_agg(distinct u), '{}'::uuid[]) into v_pedidas from unnest(coalesce(p_users, '{}'::uuid[])) u where u is not null;
  if cardinality(v_pedidas) = 0 then raise exception 'sem_pessoas'; end if;
  if cardinality(v_pedidas) > 200 then raise exception 'lote_grande_demais'; end if;
  select coalesce(array_agg(m.user_id), '{}'::uuid[]) into v_pessoas from public.club_membros m where m.user_id = any(v_pedidas);

  if cardinality(v_pessoas) > 0 then
    with ins as (
      insert into public.club_desbloqueios as d (user_id, carta_id, origem, lote, concedido_por)
      select p, k, p_origem, v_lote, p_autor
      from unnest(v_pessoas) p cross join unnest(v_cartas) k
      on conflict (user_id, carta_id) do update
        set revogado_em = null, revogado_por = null, origem = excluded.origem, lote = excluded.lote,
            concedido_por = excluded.concedido_por, concedido_em = now()
        where d.revogado_em is not null
      returning (xmax = 0) as novo
    )
    select count(*) filter (where novo), count(*) filter (where not novo) into v_novas, v_reativ from ins;
  end if;
  v_ja := cardinality(v_pessoas) * cardinality(v_cartas) - v_novas - v_reativ;

  if v_novas + v_reativ > 0 then
    insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
    values (p_autor, case when p_autor is null then 'admin' else 'colecao' end, 'conceder_lote', v_lote::text,
            jsonb_build_object('colecao', v_c.slug, 'numeros', to_jsonb(v_nums), 'origem', p_origem,
                               'pessoas', cardinality(v_pessoas), 'novas', v_novas, 'reativadas', v_reativ,
                               'ja_tinham', v_ja, 'nota', left(p_nota, 200)));
  end if;

  return jsonb_build_object(
    'lote', case when v_novas + v_reativ > 0 then v_lote else null end,
    'pessoas', cardinality(v_pessoas),
    'ignorados', cardinality(v_pedidas) - cardinality(v_pessoas),
    'novas', v_novas,
    'reativadas', v_reativ,
    'ja_tinham', v_ja
  );
end;
$$;
revoke all on function public.club_colecao_conceder_interno(uuid, smallint[], uuid[], text, uuid, text) from public, anon, authenticated;
grant execute on function public.club_colecao_conceder_interno(uuid, smallint[], uuid[], text, uuid, text) to service_role;

-- Desfaz um lote inteiro (carimba revogado_em). Quem ja pediu o set fisico fica
-- de fora e e contado em bloqueadas_por_retirada: cancelar o pedido primeiro.
create or replace function public.club_colecao_desfazer_lote_interno(p_lote uuid, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_col   uuid;
  v_rev   integer;
  v_pess  integer;
  v_resta integer;
begin
  select c.colecao_id into v_col
  from public.club_desbloqueios d
  join public.club_cartas c on c.id = d.carta_id
  where d.lote = p_lote
  limit 1;
  if not found then raise exception 'lote_nao_encontrado'; end if;

  with up as (
    update public.club_desbloqueios d set revogado_em = now(), revogado_por = p_autor
    where d.lote = p_lote and d.revogado_em is null
      and not exists (
        select 1 from public.club_retiradas r
        where r.user_id = d.user_id and r.colecao_id = v_col and r.status <> 'cancelada'
      )
    returning d.user_id
  )
  select count(*), count(distinct up.user_id) into v_rev, v_pess from up;

  -- O que sobrou no lote sem revogar so pode ser de quem tem pedido de set.
  select count(distinct d.user_id) into v_resta
  from public.club_desbloqueios d
  where d.lote = p_lote and d.revogado_em is null;

  if v_rev > 0 then
    insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
    values (p_autor, case when p_autor is null then 'admin' else 'colecao' end, 'desfazer_lote', p_lote::text,
            jsonb_build_object('revogadas', v_rev, 'pessoas', v_pess, 'bloqueadas_por_retirada', v_resta));
  end if;

  return jsonb_build_object('revogadas', v_rev, 'pessoas', v_pess, 'bloqueadas_por_retirada', v_resta);
end;
$$;
revoke all on function public.club_colecao_desfazer_lote_interno(uuid, uuid) from public, anon, authenticated;
grant execute on function public.club_colecao_desfazer_lote_interno(uuid, uuid) to service_role;

-- Estado da edicao. 'publicar' so com as 12 cartas completas (nome, tipo,
-- raridade, texto e arte) e define a janela: abre_em (agora, ou p_dados.abre_em),
-- 'dias' para ganhar cartas (90) e 'dias_pedido' para pedir o set (30).
-- 'recolher' volta para rascunho (a edicao some para o membro; as cartas
-- ganhas ficam). 'encerrar' fecha de vez.
create or replace function public.club_colecao_estado_interno(p_colecao uuid, p_acao text, p_autor uuid, p_dados jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c       public.club_colecoes;
  v_total   integer;
  v_falta   smallint[];
  v_abre    timestamptz;
  v_dias    integer;
  v_pedido  integer;
begin
  select * into v_c from public.club_colecoes c where c.id = p_colecao for update;
  if not found then raise exception 'edicao_nao_encontrada'; end if;

  if p_acao = 'publicar' then
    if v_c.status <> 'rascunho' then raise exception 'estado_invalido'; end if;
    select count(*) into v_total from public.club_cartas k where k.colecao_id = v_c.id;
    if v_total <> 12 then raise exception 'cartas_incompletas' using detail = 'cartas: ' || v_total || ' de 12'; end if;
    select array_agg(k.numero order by k.numero) into v_falta
    from public.club_cartas k
    where k.colecao_id = v_c.id
      and (k.nome is null or k.tipo is null or k.raridade is null or k.texto_efeito is null or k.arte_path is null);
    if v_falta is not null then raise exception 'cartas_incompletas' using detail = array_to_string(v_falta, ','); end if;

    v_abre := coalesce(nullif(p_dados->>'abre_em', '')::timestamptz, now());
    v_dias := coalesce(nullif(p_dados->>'dias', '')::integer, 90);
    v_pedido := coalesce(nullif(p_dados->>'dias_pedido', '')::integer, 30);
    if v_dias not between 7 and 365 or v_pedido not between 0 and 120 then raise exception 'prazo_invalido'; end if;

    update public.club_colecoes c
    set status = 'publicada', abre_em = v_abre,
        fecha_em = v_abre + make_interval(days => v_dias),
        pedir_set_ate = v_abre + make_interval(days => v_dias + v_pedido),
        updated_at = now()
    where c.id = v_c.id
    returning * into v_c;
  elsif p_acao = 'recolher' then
    if v_c.status <> 'publicada' then raise exception 'estado_invalido'; end if;
    update public.club_colecoes c set status = 'rascunho', updated_at = now() where c.id = v_c.id returning * into v_c;
  elsif p_acao = 'encerrar' then
    if v_c.status <> 'publicada' then raise exception 'estado_invalido'; end if;
    update public.club_colecoes c set status = 'encerrada', updated_at = now() where c.id = v_c.id returning * into v_c;
  else
    raise exception 'acao_invalida';
  end if;

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (p_autor, case when p_autor is null then 'admin' else 'colecao' end, 'colecao_' || p_acao, v_c.slug,
          jsonb_build_object('status', v_c.status, 'abre_em', v_c.abre_em, 'fecha_em', v_c.fecha_em, 'pedir_set_ate', v_c.pedir_set_ate));

  return jsonb_build_object('slug', v_c.slug, 'status', v_c.status, 'abre_em', v_c.abre_em, 'fecha_em', v_c.fecha_em, 'pedir_set_ate', v_c.pedir_set_ate);
end;
$$;
revoke all on function public.club_colecao_estado_interno(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.club_colecao_estado_interno(uuid, text, uuid, jsonb) to service_role;

-- ── Organizacao (papel 'colecao') ───────────────────────────────────────────

-- Concede UMA carta de missao manual a quem for colado (ate 60 @ ou e-mails).
-- Nunca a si mesma, nunca carta automatica. Devolve o resultado do lote e o
-- que nao deu para resolver.
create or replace function public.club_colecao_conceder(p_slug text, p_numero smallint, p_ids text[], p_nota text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_c     public.club_colecoes;
  v_k     public.club_cartas;
  v_res   jsonb;
  v_users uuid[];
  v_eu    boolean;
  v_out   jsonb;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('colecao') then raise exception 'sem_papel'; end if;
  select * into v_c from public.club_colecoes c where c.slug = p_slug;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  select * into v_k from public.club_cartas k where k.colecao_id = v_c.id and k.numero = p_numero;
  if not found then raise exception 'carta_nao_encontrada'; end if;
  if v_k.modo <> 'manual' then raise exception 'carta_automatica'; end if;
  if cardinality(coalesce(p_ids, '{}'::text[])) > 60 then raise exception 'lote_grande_demais'; end if;

  v_res := public.club_colecao_resolver_interno(p_ids);
  select coalesce(array_agg((e->>'user_id')::uuid) filter (where (e->>'user_id')::uuid <> v_uid), '{}'::uuid[]),
         coalesce(bool_or((e->>'user_id')::uuid = v_uid), false)
  into v_users, v_eu
  from jsonb_array_elements(v_res->'encontrados') e;

  if cardinality(v_users) = 0 then
    v_out := jsonb_build_object('lote', null, 'pessoas', 0, 'ignorados', 0, 'novas', 0, 'reativadas', 0, 'ja_tinham', 0);
  else
    v_out := public.club_colecao_conceder_interno(v_c.id, array[p_numero], v_users, 'manual', v_uid, p_nota);
  end if;

  return v_out || jsonb_build_object(
    'proprio_ignorado', v_eu,
    'nao_membros', v_res->'nao_membros',
    'nao_encontrados', v_res->'nao_encontrados',
    'ambiguos', v_res->'ambiguos'
  );
end;
$$;
revoke all on function public.club_colecao_conceder(text, smallint, text[], text) from public, anon, authenticated;
grant execute on function public.club_colecao_conceder(text, smallint, text[], text) to authenticated;

-- Desfaz um lote que a propria pessoa concedeu (nunca o de outra pessoa).
create or replace function public.club_colecao_desfazer_lote(p_lote uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('colecao') then raise exception 'sem_papel'; end if;
  if not exists (
    select 1 from public.club_desbloqueios d
    where d.lote = p_lote and d.concedido_por = v_uid and d.origem = 'manual'
  ) then
    raise exception 'lote_nao_encontrado';
  end if;
  return public.club_colecao_desfazer_lote_interno(p_lote, v_uid);
end;
$$;
revoke all on function public.club_colecao_desfazer_lote(uuid) from public, anon, authenticated;
grant execute on function public.club_colecao_desfazer_lote(uuid) to authenticated;

-- ── Edicao 1 (rascunho) ─────────────────────────────────────────────────────

-- As 12 missoes ja no lugar; nome, tipo, raridade, texto e arte entram pelo
-- Admin, fora do git. 'publicar' recusa a edicao enquanto faltar qualquer um.
-- Tiragem de 50 sets e suposicao ate a confirmacao.
insert into public.club_colecoes (slug, edicao, titulo, status, tiragem_fisica)
values ('edicao-1', 1, 'Álbum do Club', 'rascunho', 50)
on conflict (slug) do nothing;

insert into public.club_cartas (colecao_id, numero, missao, modo, como_ganhar, secreta)
select c.id, v.numero, v.missao, v.modo, v.como_ganhar, v.secreta
from public.club_colecoes c
cross join (values
  (1::smallint,  'entrei',    'auto',   'Entre no Club',                          false),
  (2::smallint,  'data',      'auto',   'Coloque sua data nos Aniversariantes',   false),
  (3::smallint,  'arroba',    'auto',   'Confirme seu @ do Instagram',            false),
  (4::smallint,  'colecao',   'auto',   'Tenha 10 cartas na sua coleção',         false),
  (5::smallint,  'opiniao',   'auto',   'Vote em uma enquete do Club',            false),
  (6::smallint,  'indicacao', 'auto',   'Traga alguém para a Bynx',               false),
  (7::smallint,  'graduada',  'auto',   'Registre uma carta graduada',            false),
  (8::smallint,  'plateia',   'manual', 'Esteja em um evento do Club',            false),
  (9::smallint,  'palco',     'manual', 'Suba ao palco em um evento',             false),
  (10::smallint, 'trend',     'manual', 'Apareça em uma Trend do Club',           false),
  (11::smallint, 'ideia',     'manual', 'Mande uma ideia para o Club',            false),
  (12::smallint, 'completo',  'auto',   'Surpresa',                               true)
) as v(numero, missao, modo, como_ganhar, secreta)
where c.slug = 'edicao-1'
on conflict (colecao_id, numero) do nothing;
