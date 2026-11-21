-- ============================================================================
-- Album do Club (Fase 1, fatia 4): organizacao (papel "colecao") e regra publica.
--
-- Quem tem o papel 'colecao' (a Mika) organiza dentro do Club, com a conta normal
-- da Bynx, sem entrar no /admin. O que ela pode ja existia no banco
-- (club_colecao_conceder e club_colecao_desfazer_lote, da migration
-- 20261119100000_club_album): conceder UMA carta de missao manual a quem for colado
-- (ate 60 @ ou e-mails), nunca a si mesma, e desfazer so os lotes que ela mesma
-- concedeu. Faltava o que a tela dela precisa para isso:
--
--   club_colecao_organizar   a edicao, as cartas de missao manual e os lotes dela
--                            (com quantas contas ainda tem a carta: ativas > 0 = da
--                            para desfazer). Nao exige ser membro do Club.
--   club_colecao_previa      o que aconteceria com cada nome colado, ANTES de gravar.
--
-- E a regra publica do album, que qualquer pessoa le sem entrar:
--
--   club_colecao_regras_publica   a edicao ja aberta (datas, tiragem do set) e a lista
--                                 de missoes. So o que e regra: nunca o rosto de uma
--                                 carta (nome, texto, arte), e a carta secreta continua
--                                 secreta. E a unica funcao deste arquivo que o anonimo
--                                 chama, como amigo_secreto_edicao_publica.
--
-- ROLLBACK (ordem inversa):
--   drop function public.club_colecao_regras_publica(text);
--   drop function public.club_colecao_previa(text, smallint, text[]);
--   drop function public.club_colecao_organizar(text);
-- ============================================================================

-- ── Organizacao ─────────────────────────────────────────────────────────────

-- Sem p_slug devolve a edicao em vigor (a publicada, senao a de numero mais alto),
-- inclusive rascunho e agendada: quem organiza enxerga antes do membro. As cartas
-- sao so as de missao manual (as unicas que ela concede), sem rosto: numero,
-- missao e o texto de "como ganhar". Os lotes sao so os dela.
create or replace function public.club_colecao_organizar(p_slug text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_agora  timestamptz := now();
  v_c      public.club_colecoes;
  v_fase   text;
  v_cartas jsonb;
  v_lotes  jsonb;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('colecao') then raise exception 'sem_papel'; end if;

  select c.* into v_c
  from public.club_colecoes c
  where p_slug is null or c.slug = p_slug
  order by (c.status = 'publicada') desc, c.edicao desc
  limit 1;
  if not found then return jsonb_build_object('edicao', null); end if;

  v_fase := case
    when v_c.status = 'rascunho' then 'rascunho'
    when v_c.status = 'encerrada' then 'encerrada'
    when v_c.abre_em > v_agora then 'agendada'
    when v_agora < v_c.fecha_em then 'aberta'
    when v_agora <= v_c.pedir_set_ate then 'so_pedidos'
    else 'prazo_encerrado'
  end;

  select coalesce(jsonb_agg(jsonb_build_object('numero', k.numero, 'missao', k.missao, 'como_ganhar', k.como_ganhar) order by k.numero), '[]'::jsonb)
  into v_cartas
  from public.club_cartas k
  where k.colecao_id = v_c.id and k.modo = 'manual';

  select coalesce(jsonb_agg(t.item order by t.quando desc), '[]'::jsonb) into v_lotes
  from (
    select l.created_at as quando,
      jsonb_build_object(
        'lote', l.alvo, 'quando', l.created_at,
        'numeros', l.detalhe->'numeros', 'pessoas', l.detalhe->'pessoas', 'nota', l.detalhe->>'nota',
        'ativas', (select count(*) from public.club_desbloqueios d where d.lote = l.alvo::uuid and d.revogado_em is null)
      ) as item
    from public.club_organizacao_log l
    where l.user_id = v_uid and l.acao = 'conceder_lote' and l.detalhe->>'colecao' = v_c.slug
    order by l.created_at desc
    limit 30
  ) t;

  return jsonb_build_object(
    'edicao', jsonb_build_object(
      'slug', v_c.slug, 'edicao', v_c.edicao, 'titulo', v_c.titulo, 'status', v_c.status, 'fase', v_fase,
      'abre_em', v_c.abre_em, 'fecha_em', v_c.fecha_em, 'pedir_set_ate', v_c.pedir_set_ate
    ),
    'cartas', v_cartas,
    'lotes', v_lotes
  );
end;
$$;
revoke all on function public.club_colecao_organizar(text) from public, anon, authenticated;
grant execute on function public.club_colecao_organizar(text) to authenticated;

-- Antes de gravar: o que aconteceria com cada nome colado, nas mesmas regras de
-- club_colecao_conceder (so carta manual, ate 60 nomes, edicao nao encerrada).
-- estado: recebe (ainda nao tem a carta), ja_tem, proprio (a propria pessoa: nunca
-- recebe de si mesma), nao_membro (tem conta, nao entrou no Club), ambiguo (mais de
-- um membro com o mesmo @: use o e-mail) e sem_conta. O e-mail so serve de chave de
-- busca: nunca volta na resposta.
create or replace function public.club_colecao_previa(p_slug text, p_numero smallint, p_ids text[])
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_c      public.club_colecoes;
  v_k      public.club_cartas;
  v_res    jsonb;
  v_linhas jsonb;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('colecao') then raise exception 'sem_papel'; end if;
  select * into v_c from public.club_colecoes c where c.slug = p_slug;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  if v_c.status = 'encerrada' then raise exception 'edicao_encerrada'; end if;
  select * into v_k from public.club_cartas k where k.colecao_id = v_c.id and k.numero = p_numero;
  if not found then raise exception 'carta_nao_encontrada'; end if;
  if v_k.modo <> 'manual' then raise exception 'carta_automatica'; end if;
  if cardinality(coalesce(p_ids, '{}'::text[])) > 60 then raise exception 'lote_grande_demais'; end if;

  v_res := public.club_colecao_resolver_interno(p_ids);

  select coalesce(jsonb_agg(jsonb_build_object(
      'token', x.token, 'estado', x.estado, 'nome', x.nome, 'instagram', x.instagram, 'faltam', x.faltam
    ) order by x.ordem, x.token), '[]'::jsonb)
  into v_linhas
  from (
    select
      e->>'token' as token,
      e->>'nome' as nome,
      e->>'instagram' as instagram,
      case when (e->>'user_id')::uuid = v_uid then 'proprio' when ja.tem then 'ja_tem' else 'recebe' end as estado,
      case when (e->>'user_id')::uuid = v_uid or ja.tem then 0 else 1 end as faltam,
      case when (e->>'user_id')::uuid = v_uid then 3 when ja.tem then 2 else 1 end as ordem
    from jsonb_array_elements(v_res->'encontrados') e
    cross join lateral (
      select exists (
        select 1 from public.club_desbloqueios d
        where d.user_id = (e->>'user_id')::uuid and d.carta_id = v_k.id and d.revogado_em is null
      ) as tem
    ) ja
    union all
    select e->>'token', e->>'nome', null, 'nao_membro', 0, 4
    from jsonb_array_elements(v_res->'nao_membros') e
    union all
    select t, null, null, 'ambiguo', 0, 5
    from jsonb_array_elements_text(v_res->'ambiguos') t
    union all
    select t, null, null, 'sem_conta', 0, 6
    from jsonb_array_elements_text(v_res->'nao_encontrados') t
  ) x;

  return jsonb_build_object(
    'linhas', v_linhas,
    'totais', jsonb_build_object(
      'recebe', (select count(*) from jsonb_array_elements(v_linhas) l where l->>'estado' = 'recebe'),
      'ja_tem', (select count(*) from jsonb_array_elements(v_linhas) l where l->>'estado' = 'ja_tem'),
      'proprio', (select count(*) from jsonb_array_elements(v_linhas) l where l->>'estado' = 'proprio'),
      'nao_membro', (select count(*) from jsonb_array_elements(v_linhas) l where l->>'estado' = 'nao_membro'),
      'sem_conta', (select count(*) from jsonb_array_elements(v_linhas) l where l->>'estado' = 'sem_conta'),
      'ambiguo', (select count(*) from jsonb_array_elements(v_linhas) l where l->>'estado' = 'ambiguo')
    )
  );
end;
$$;
revoke all on function public.club_colecao_previa(text, smallint, text[]) from public, anon, authenticated;
grant execute on function public.club_colecao_previa(text, smallint, text[]) to authenticated;

-- ── Regra publica ───────────────────────────────────────────────────────────

-- A edicao que ja abriu para os membros (publicada ou encerrada, com abre_em no
-- passado): a mesma que o membro enxerga. Rascunho e agendada nao aparecem. Devolve as
-- datas, a tiragem do set e uma linha por carta com o numero, o modo (automatica ou
-- conferida pela organizacao) e o texto de "como ganhar". A carta secreta vai so com
-- o numero. Nunca nome, texto, arte, previa nem quantos ganharam.
create or replace function public.club_colecao_regras_publica(p_slug text default null)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_c      public.club_colecoes;
  v_total  integer;
  v_cartas jsonb;
begin
  select c.* into v_c
  from public.club_colecoes c
  where (p_slug is null or c.slug = p_slug)
    and c.status in ('publicada', 'encerrada') and c.abre_em <= now()
  order by (c.status = 'publicada') desc, c.edicao desc
  limit 1;
  if not found then return jsonb_build_object('edicao', null); end if;

  select count(*) into v_total from public.club_cartas k where k.colecao_id = v_c.id;

  select coalesce(jsonb_agg(
      case when k.secreta
        then jsonb_build_object('numero', k.numero, 'secreta', true)
        else jsonb_build_object('numero', k.numero, 'secreta', false, 'missao', k.missao, 'modo', k.modo, 'como_ganhar', k.como_ganhar)
      end
      order by k.numero), '[]'::jsonb)
  into v_cartas
  from public.club_cartas k
  where k.colecao_id = v_c.id;

  return jsonb_build_object(
    'edicao', jsonb_build_object(
      'slug', v_c.slug, 'edicao', v_c.edicao, 'titulo', v_c.titulo, 'status', v_c.status,
      'abre_em', v_c.abre_em, 'fecha_em', v_c.fecha_em, 'pedir_set_ate', v_c.pedir_set_ate,
      'tiragem_fisica', v_c.tiragem_fisica, 'total', v_total
    ),
    'cartas', v_cartas
  );
end;
$$;
revoke all on function public.club_colecao_regras_publica(text) from public, anon, authenticated;
grant execute on function public.club_colecao_regras_publica(text) to anon, authenticated;
