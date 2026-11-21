-- ============================================================================
-- Album do Club (Fase 1, fatia 3): funcoes do Admin.
--
-- O /admin e cookie de senha, sem conta no Supabase: as rotas falam com estas
-- funcoes pela chave de servico (so service_role), com autor nulo ("Admin
-- Bynx"). Edicao e cartas (nome, texto, arte, previa), conceder em lote com
-- previa antes de gravar, historico dos lotes (com o que ainda da para desfazer)
-- e os pedidos do set fisico. Conceder, desfazer lote e mudar o estado da
-- edicao ja existem na migration 20261119100000_club_album.
--
-- Tudo registra em club_organizacao_log (papel 'admin', usuario nulo).
--
-- ROLLBACK (ordem inversa):
--   drop function public.club_retirada_status_interno(integer, text, text, uuid);
--   drop function public.club_retiradas_admin_interno(uuid);
--   drop function public.club_colecao_historico_interno(uuid, integer);
--   drop function public.club_colecao_conceder_tokens_interno(uuid, smallint[], text[], text, uuid, text);
--   drop function public.club_colecao_previa_lote_interno(uuid, smallint[], text[]);
--   drop function public.club_carta_salvar_interno(uuid, smallint, jsonb, uuid);
--   drop function public.club_colecao_salvar_interno(uuid, jsonb, uuid);
--   drop function public.club_colecao_painel_interno(text);
--   drop function public.club_colecao_cartas_ids_interno(uuid, smallint[]);
--   delete from public.club_organizacao_log where acao in ('carta_salvar', 'colecao_salvar', 'retirada_status');
-- ============================================================================

-- ── Apoio ───────────────────────────────────────────────────────────────────

-- Ids das cartas pelo numero, ou o erro que explica por que nao deu.
create or replace function public.club_colecao_cartas_ids_interno(p_colecao uuid, p_numeros smallint[])
returns uuid[]
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_nums   smallint[];
  v_cartas uuid[];
begin
  if not exists (select 1 from public.club_colecoes c where c.id = p_colecao) then raise exception 'edicao_nao_encontrada'; end if;
  select coalesce(array_agg(distinct n), '{}'::smallint[]) into v_nums from unnest(coalesce(p_numeros, '{}'::smallint[])) n where n is not null;
  if cardinality(v_nums) = 0 then raise exception 'sem_cartas'; end if;
  select array_agg(k.id) into v_cartas from public.club_cartas k where k.colecao_id = p_colecao and k.numero = any(v_nums);
  if coalesce(cardinality(v_cartas), 0) <> cardinality(v_nums) then raise exception 'carta_nao_encontrada'; end if;
  return v_cartas;
end;
$$;
revoke all on function public.club_colecao_cartas_ids_interno(uuid, smallint[]) from public, anon, authenticated;

-- ── Painel: a edicao, as 12 cartas e os numeros ─────────────────────────────

-- Sem p_slug devolve a edicao de numero mais alto. "fase" e derivada das datas:
-- rascunho, agendada (publicada, ainda nao abriu), aberta (ganhando cartas),
-- so_pedidos (a janela de ganhar fechou, ainda da para pedir o set),
-- prazo_encerrado (passou tudo e ninguem encerrou) e encerrada.
create or replace function public.club_colecao_painel_interno(p_slug text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c       public.club_colecoes;
  v_agora   timestamptz := now();
  v_fase    text;
  v_cartas  jsonb;
  v_falta   jsonb;
  v_edicoes jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'edicao', c.edicao, 'titulo', c.titulo, 'status', c.status) order by c.edicao desc), '[]'::jsonb)
  into v_edicoes from public.club_colecoes c;

  select c.* into v_c from public.club_colecoes c
  where p_slug is null or c.slug = p_slug
  order by c.edicao desc
  limit 1;
  if not found then return jsonb_build_object('edicoes', v_edicoes, 'edicao', null); end if;

  v_fase := case
    when v_c.status = 'rascunho' then 'rascunho'
    when v_c.status = 'encerrada' then 'encerrada'
    when v_c.abre_em > v_agora then 'agendada'
    when v_agora < v_c.fecha_em then 'aberta'
    when v_agora <= v_c.pedir_set_ate then 'so_pedidos'
    else 'prazo_encerrado'
  end;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', k.id, 'numero', k.numero, 'missao', k.missao, 'modo', k.modo, 'como_ganhar', k.como_ganhar,
      'nome', k.nome, 'tipo', k.tipo, 'raridade', k.raridade, 'texto_efeito', k.texto_efeito,
      'homenageado', k.homenageado, 'arte_path', k.arte_path, 'previa', k.previa, 'secreta', k.secreta,
      'donos', coalesce(s.donos, 0), 'viradas', coalesce(s.viradas, 0)
    ) order by k.numero), '[]'::jsonb)
  into v_cartas
  from public.club_cartas k
  left join (
    select d.carta_id, count(*) as donos, count(d.revelada_em) as viradas
    from public.club_desbloqueios d
    where d.revogado_em is null
    group by d.carta_id
  ) s on s.carta_id = k.id
  where k.colecao_id = v_c.id;

  -- O que falta para publicar: o mesmo criterio da funcao de publicar.
  select coalesce(jsonb_agg(jsonb_build_object('numero', k.numero, 'campos', to_jsonb(f.campos)) order by k.numero), '[]'::jsonb)
  into v_falta
  from public.club_cartas k
  cross join lateral (
    select array_remove(array[
      case when k.nome is null then 'nome' end,
      case when k.tipo is null then 'tipo' end,
      case when k.raridade is null then 'raridade' end,
      case when k.texto_efeito is null then 'texto' end,
      case when k.arte_path is null then 'arte' end
    ], null) as campos
  ) f
  where k.colecao_id = v_c.id and cardinality(f.campos) > 0;

  return jsonb_build_object(
    'edicoes', v_edicoes,
    'edicao', jsonb_build_object(
      'id', v_c.id, 'slug', v_c.slug, 'edicao', v_c.edicao, 'titulo', v_c.titulo, 'status', v_c.status, 'fase', v_fase,
      'abre_em', v_c.abre_em, 'fecha_em', v_c.fecha_em, 'pedir_set_ate', v_c.pedir_set_ate, 'tiragem_fisica', v_c.tiragem_fisica,
      'total_cartas', (select count(*) from public.club_cartas k where k.colecao_id = v_c.id),
      'faltando', v_falta,
      'resumo', jsonb_build_object(
        'pessoas', (select count(distinct d.user_id) from public.club_desbloqueios d join public.club_cartas k on k.id = d.carta_id where k.colecao_id = v_c.id and d.revogado_em is null),
        'ganhas', (select count(*) from public.club_desbloqueios d join public.club_cartas k on k.id = d.carta_id where k.colecao_id = v_c.id and d.revogado_em is null),
        'reveladas', (select count(*) from public.club_desbloqueios d join public.club_cartas k on k.id = d.carta_id where k.colecao_id = v_c.id and d.revogado_em is null and d.revelada_em is not null),
        'pedidos', (select count(*) from public.club_retiradas r where r.colecao_id = v_c.id),
        'pedidos_ativos', (select count(*) from public.club_retiradas r where r.colecao_id = v_c.id and r.status <> 'cancelada')
      ),
      'cartas', v_cartas
    )
  );
end;
$$;
revoke all on function public.club_colecao_painel_interno(text) from public, anon, authenticated;
grant execute on function public.club_colecao_painel_interno(text) to service_role;

-- ── Edicao: titulo, tiragem e datas ─────────────────────────────────────────

-- Campos aceitos em p: titulo, tiragem_fisica (nulo = sem teto), abre_em,
-- fecha_em, pedir_set_ate (ISO). Datas so depois de publicar (o publicar as
-- define); a abertura so muda enquanto nao abriu; a tiragem nao cai abaixo do
-- que ja foi pedido. Edicao encerrada nao muda.
create or replace function public.club_colecao_salvar_interno(p_colecao uuid, p jsonb, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c      public.club_colecoes;
  v_agora  timestamptz := now();
  v_titulo text;
  v_tir    integer;
  v_abre   timestamptz;
  v_fecha  timestamptz;
  v_pedir  timestamptz;
  v_mud    text[] := '{}';
begin
  select * into v_c from public.club_colecoes c where c.id = p_colecao for update;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  if v_c.status = 'encerrada' then raise exception 'edicao_encerrada'; end if;

  v_titulo := v_c.titulo; v_tir := v_c.tiragem_fisica;
  v_abre := v_c.abre_em; v_fecha := v_c.fecha_em; v_pedir := v_c.pedir_set_ate;

  if p ? 'titulo' then
    v_titulo := public.club_sem_emoji(p->>'titulo');
    if v_titulo is null or char_length(v_titulo) not between 3 and 80 then raise exception 'titulo_invalido'; end if;
    if v_titulo is distinct from v_c.titulo then v_mud := array_append(v_mud, 'titulo'); end if;
  end if;

  if p ? 'tiragem_fisica' then
    begin
      v_tir := nullif(btrim(coalesce(p->>'tiragem_fisica', '')), '')::integer;
    exception when others then
      raise exception 'tiragem_invalida';
    end;
    if v_tir is not null and v_tir < 0 then raise exception 'tiragem_invalida'; end if;
    if v_tir is not null and v_tir < (select count(*) from public.club_retiradas r where r.colecao_id = v_c.id and r.status <> 'cancelada') then
      raise exception 'tiragem_menor_que_pedidos';
    end if;
    if v_tir is distinct from v_c.tiragem_fisica then v_mud := array_append(v_mud, 'tiragem_fisica'); end if;
  end if;

  if p ? 'abre_em' or p ? 'fecha_em' or p ? 'pedir_set_ate' then
    if v_c.status = 'rascunho' then raise exception 'datas_so_depois_de_publicar'; end if;
    begin
      if p ? 'abre_em' then v_abre := (p->>'abre_em')::timestamptz; end if;
      if p ? 'fecha_em' then v_fecha := (p->>'fecha_em')::timestamptz; end if;
      if p ? 'pedir_set_ate' then v_pedir := (p->>'pedir_set_ate')::timestamptz; end if;
    exception when others then
      raise exception 'data_invalida';
    end;
    if v_abre is null or v_fecha is null or v_pedir is null then raise exception 'data_invalida'; end if;
    if v_abre is distinct from v_c.abre_em and v_c.abre_em <= v_agora then raise exception 'ja_abriu'; end if;
    if not (v_abre < v_fecha and v_fecha <= v_pedir) then raise exception 'datas_fora_de_ordem'; end if;
    if v_abre is distinct from v_c.abre_em then v_mud := array_append(v_mud, 'abre_em'); end if;
    if v_fecha is distinct from v_c.fecha_em then v_mud := array_append(v_mud, 'fecha_em'); end if;
    if v_pedir is distinct from v_c.pedir_set_ate then v_mud := array_append(v_mud, 'pedir_set_ate'); end if;
  end if;

  if cardinality(v_mud) > 0 then
    update public.club_colecoes c
    set titulo = v_titulo, tiragem_fisica = v_tir, abre_em = v_abre, fecha_em = v_fecha, pedir_set_ate = v_pedir, updated_at = now()
    where c.id = v_c.id;

    insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
    values (p_autor, case when p_autor is null then 'admin' else 'colecao' end, 'colecao_salvar', v_c.slug,
            jsonb_build_object('campos', to_jsonb(v_mud)));
  end if;

  return jsonb_build_object('slug', v_c.slug, 'titulo', v_titulo, 'tiragem_fisica', v_tir,
                            'abre_em', v_abre, 'fecha_em', v_fecha, 'pedir_set_ate', v_pedir, 'campos', to_jsonb(v_mud));
end;
$$;
revoke all on function public.club_colecao_salvar_interno(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.club_colecao_salvar_interno(uuid, jsonb, uuid) to service_role;

-- ── Carta: nome, texto, arte e previa ───────────────────────────────────────

-- Campos aceitos em p: nome, tipo, raridade, texto_efeito, homenageado,
-- como_ganhar, previa e arte_path (caminho no bucket, da propria edicao). O texto
-- passa por club_sem_emoji. Vazio vira nulo (exceto como_ganhar). Depois de
-- publicada, os campos do rosto nao podem ficar em branco. Previa so com nome e
-- arte, e nunca na carta secreta. Devolve a carta e a arte anterior (para quem
-- chamou apagar do bucket).
create or replace function public.club_carta_salvar_interno(p_colecao uuid, p_numero smallint, p jsonb, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c     public.club_colecoes;
  v_k     public.club_cartas;
  v_novo  public.club_cartas;
  v_mud   text[] := '{}';
  v_ant   text;
begin
  select * into v_c from public.club_colecoes c where c.id = p_colecao for share;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  if v_c.status = 'encerrada' then raise exception 'edicao_encerrada'; end if;
  select * into v_k from public.club_cartas k where k.colecao_id = p_colecao and k.numero = p_numero for update;
  if not found then raise exception 'carta_nao_encontrada'; end if;
  v_novo := v_k;

  if p ? 'nome' then
    v_novo.nome := public.club_sem_emoji(p->>'nome');
    if v_novo.nome is not null and char_length(v_novo.nome) not between 2 and 60 then raise exception 'nome_invalido'; end if;
  end if;
  if p ? 'tipo' then
    v_novo.tipo := public.club_sem_emoji(p->>'tipo');
    if v_novo.tipo is not null and char_length(v_novo.tipo) not between 2 and 30 then raise exception 'tipo_invalido'; end if;
  end if;
  if p ? 'raridade' then
    v_novo.raridade := public.club_sem_emoji(p->>'raridade');
    if v_novo.raridade is not null and char_length(v_novo.raridade) not between 2 and 30 then raise exception 'raridade_invalida'; end if;
  end if;
  if p ? 'texto_efeito' then
    v_novo.texto_efeito := public.club_sem_emoji(p->>'texto_efeito');
    if v_novo.texto_efeito is not null and char_length(v_novo.texto_efeito) not between 1 and 280 then raise exception 'texto_invalido'; end if;
  end if;
  if p ? 'homenageado' then
    v_novo.homenageado := public.club_sem_emoji(p->>'homenageado');
    if v_novo.homenageado is not null and char_length(v_novo.homenageado) not between 2 and 80 then raise exception 'homenageado_invalido'; end if;
  end if;
  if p ? 'como_ganhar' then
    v_novo.como_ganhar := public.club_sem_emoji(p->>'como_ganhar');
    if v_novo.como_ganhar is null or char_length(v_novo.como_ganhar) not between 3 and 80 then raise exception 'como_ganhar_invalido'; end if;
  end if;
  if p ? 'previa' then
    if jsonb_typeof(p->'previa') <> 'boolean' then raise exception 'previa_invalida'; end if;
    v_novo.previa := (p->>'previa')::boolean;
  end if;
  if p ? 'arte_path' then
    v_novo.arte_path := nullif(btrim(coalesce(p->>'arte_path', '')), '');
    if v_novo.arte_path is not null
       and (v_novo.arte_path !~ '^[a-z0-9]+(-[a-z0-9]+)*/[0-9a-f]{32}\.(webp|png|jpg)$' or split_part(v_novo.arte_path, '/', 1) <> v_c.slug) then
      raise exception 'arte_invalida';
    end if;
  end if;

  if v_novo.previa and v_novo.secreta then raise exception 'previa_e_secreta'; end if;
  if v_novo.previa and (v_novo.nome is null or v_novo.arte_path is null) then raise exception 'previa_sem_rosto'; end if;
  if v_c.status <> 'rascunho'
     and (v_novo.nome is null or v_novo.tipo is null or v_novo.raridade is null or v_novo.texto_efeito is null or v_novo.arte_path is null) then
    raise exception 'campo_obrigatorio';
  end if;

  if v_novo.nome is distinct from v_k.nome then v_mud := array_append(v_mud, 'nome'); end if;
  if v_novo.tipo is distinct from v_k.tipo then v_mud := array_append(v_mud, 'tipo'); end if;
  if v_novo.raridade is distinct from v_k.raridade then v_mud := array_append(v_mud, 'raridade'); end if;
  if v_novo.texto_efeito is distinct from v_k.texto_efeito then v_mud := array_append(v_mud, 'texto_efeito'); end if;
  if v_novo.homenageado is distinct from v_k.homenageado then v_mud := array_append(v_mud, 'homenageado'); end if;
  if v_novo.como_ganhar is distinct from v_k.como_ganhar then v_mud := array_append(v_mud, 'como_ganhar'); end if;
  if v_novo.previa is distinct from v_k.previa then v_mud := array_append(v_mud, 'previa'); end if;
  if v_novo.arte_path is distinct from v_k.arte_path then v_mud := array_append(v_mud, 'arte'); v_ant := v_k.arte_path; end if;

  if cardinality(v_mud) > 0 then
    begin
      update public.club_cartas k
      set nome = v_novo.nome, tipo = v_novo.tipo, raridade = v_novo.raridade, texto_efeito = v_novo.texto_efeito,
          homenageado = v_novo.homenageado, como_ganhar = v_novo.como_ganhar, previa = v_novo.previa,
          arte_path = v_novo.arte_path, updated_at = now()
      where k.id = v_k.id;
    exception when unique_violation then
      raise exception 'arte_repetida';
    end;
    insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
    values (p_autor, case when p_autor is null then 'admin' else 'colecao' end, 'carta_salvar', v_c.slug || '#' || p_numero,
            jsonb_build_object('numero', p_numero, 'campos', to_jsonb(v_mud)));
  end if;

  return jsonb_build_object(
    'carta', jsonb_build_object(
      'numero', v_novo.numero, 'missao', v_novo.missao, 'modo', v_novo.modo, 'como_ganhar', v_novo.como_ganhar,
      'nome', v_novo.nome, 'tipo', v_novo.tipo, 'raridade', v_novo.raridade, 'texto_efeito', v_novo.texto_efeito,
      'homenageado', v_novo.homenageado, 'arte_path', v_novo.arte_path, 'previa', v_novo.previa, 'secreta', v_novo.secreta
    ),
    'campos', to_jsonb(v_mud),
    'arte_anterior', v_ant
  );
end;
$$;
revoke all on function public.club_carta_salvar_interno(uuid, smallint, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.club_carta_salvar_interno(uuid, smallint, jsonb, uuid) to service_role;

-- ── Conceder: previa e gravacao a partir da cola de @ ou e-mails ────────────

-- Antes de gravar: o que aconteceria com cada nome colado. estado:
-- recebe (falta ao menos uma das cartas), ja_tem, nao_membro (tem conta, nao
-- entrou no Club), sem_conta e ambiguo (mais de um membro com o mesmo @: use o
-- e-mail). faltam = quantas das cartas escolhidas a pessoa ainda nao tem.
create or replace function public.club_colecao_previa_lote_interno(p_colecao uuid, p_numeros smallint[], p_ids text[])
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cartas uuid[] := public.club_colecao_cartas_ids_interno(p_colecao, p_numeros);
  v_res    jsonb  := public.club_colecao_resolver_interno(p_ids);
  v_ok     jsonb;
  v_linhas jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'token', x.tok, 'estado', case when x.faltam > 0 then 'recebe' else 'ja_tem' end,
      'nome', x.nome, 'instagram', x.ig, 'faltam', x.faltam
    ) order by (x.faltam = 0), x.tok), '[]'::jsonb)
  into v_ok
  from (
    select e->>'token' as tok, e->>'nome' as nome, e->>'instagram' as ig,
      (select count(*) from unnest(v_cartas) c(id)
       where not exists (
         select 1 from public.club_desbloqueios d
         where d.user_id = (e->>'user_id')::uuid and d.carta_id = c.id and d.revogado_em is null
       )) as faltam
    from jsonb_array_elements(v_res->'encontrados') e
  ) x;

  v_linhas := v_ok
    || coalesce((select jsonb_agg(jsonb_build_object('token', e->>'token', 'estado', 'nao_membro', 'nome', e->>'nome', 'instagram', null, 'faltam', 0)) from jsonb_array_elements(v_res->'nao_membros') e), '[]'::jsonb)
    || coalesce((select jsonb_agg(jsonb_build_object('token', t, 'estado', 'ambiguo', 'nome', null, 'instagram', null, 'faltam', 0)) from jsonb_array_elements_text(v_res->'ambiguos') t), '[]'::jsonb)
    || coalesce((select jsonb_agg(jsonb_build_object('token', t, 'estado', 'sem_conta', 'nome', null, 'instagram', null, 'faltam', 0)) from jsonb_array_elements_text(v_res->'nao_encontrados') t), '[]'::jsonb);

  return jsonb_build_object(
    'linhas', v_linhas,
    'totais', jsonb_build_object(
      'recebe', (select count(*) from jsonb_array_elements(v_linhas) l where l->>'estado' = 'recebe'),
      'ja_tem', (select count(*) from jsonb_array_elements(v_linhas) l where l->>'estado' = 'ja_tem'),
      'nao_membro', (select count(*) from jsonb_array_elements(v_linhas) l where l->>'estado' = 'nao_membro'),
      'sem_conta', (select count(*) from jsonb_array_elements(v_linhas) l where l->>'estado' = 'sem_conta'),
      'ambiguo', (select count(*) from jsonb_array_elements(v_linhas) l where l->>'estado' = 'ambiguo')
    )
  );
end;
$$;
revoke all on function public.club_colecao_previa_lote_interno(uuid, smallint[], text[]) from public, anon, authenticated;
grant execute on function public.club_colecao_previa_lote_interno(uuid, smallint[], text[]) to service_role;

-- Grava o lote: acha as contas pelo @ ou e-mail e concede (as mesmas regras do
-- conceder_interno: so membro, quem ja tem nao muda, quem teve revogada volta).
-- Sem nenhuma conta achada nao e erro: devolve zeros e o que nao deu para achar.
create or replace function public.club_colecao_conceder_tokens_interno(
  p_colecao uuid, p_numeros smallint[], p_ids text[], p_origem text, p_autor uuid, p_nota text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cartas uuid[] := public.club_colecao_cartas_ids_interno(p_colecao, p_numeros);
  v_res    jsonb  := public.club_colecao_resolver_interno(p_ids);
  v_users  uuid[];
  v_out    jsonb;
begin
  if p_origem not in ('manual', 'brinde') then raise exception 'origem_invalida'; end if;
  select coalesce(array_agg((e->>'user_id')::uuid), '{}'::uuid[]) into v_users from jsonb_array_elements(v_res->'encontrados') e;

  if cardinality(v_users) = 0 then
    v_out := jsonb_build_object('lote', null, 'pessoas', 0, 'ignorados', 0, 'novas', 0, 'reativadas', 0, 'ja_tinham', 0);
  else
    v_out := public.club_colecao_conceder_interno(p_colecao, p_numeros, v_users, p_origem, p_autor, p_nota);
  end if;

  return v_out || jsonb_build_object(
    'nao_membros', v_res->'nao_membros',
    'nao_encontrados', v_res->'nao_encontrados',
    'ambiguos', v_res->'ambiguos'
  );
end;
$$;
revoke all on function public.club_colecao_conceder_tokens_interno(uuid, smallint[], text[], text, uuid, text) from public, anon, authenticated;
grant execute on function public.club_colecao_conceder_tokens_interno(uuid, smallint[], text[], text, uuid, text) to service_role;

-- ── Historico ───────────────────────────────────────────────────────────────

-- O que a organizacao fez na edicao, do mais novo para o mais antigo: lotes
-- concedidos (com quantas linhas ainda valem: ativas > 0 = da para desfazer),
-- lotes desfeitos, mudancas de estado, edicao e cartas salvas, pedidos do set.
create or replace function public.club_colecao_historico_interno(p_colecao uuid, p_limite integer default 60)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text;
  v_out  jsonb;
begin
  select c.slug into v_slug from public.club_colecoes c where c.id = p_colecao;
  if not found then raise exception 'edicao_nao_encontrada'; end if;

  select coalesce(jsonb_agg(t.item order by t.quando desc, t.id desc), '[]'::jsonb) into v_out
  from (
    select l.id, l.created_at as quando,
      jsonb_build_object(
        'id', l.id, 'quando', l.created_at, 'papel', l.papel,
        'quem', case when l.user_id is null then null else coalesce(nullif(u.instagram, ''), u.name) end,
        'acao', l.acao, 'alvo', l.alvo, 'detalhe', l.detalhe,
        'ativas', case when l.acao = 'conceder_lote'
                       then (select count(*) from public.club_desbloqueios d where d.lote = l.alvo::uuid and d.revogado_em is null) end
      ) as item
    from public.club_organizacao_log l
    left join public.users u on u.id = l.user_id
    where case l.acao
      when 'conceder_lote' then l.detalhe->>'colecao' = v_slug
      when 'desfazer_lote' then exists (
        select 1 from public.club_desbloqueios d join public.club_cartas k on k.id = d.carta_id
        where d.lote = l.alvo::uuid and k.colecao_id = p_colecao)
      when 'carta_salvar' then l.alvo like v_slug || '#%'
      when 'colecao_publicar' then l.alvo = v_slug
      when 'colecao_recolher' then l.alvo = v_slug
      when 'colecao_encerrar' then l.alvo = v_slug
      when 'colecao_salvar' then l.alvo = v_slug
      when 'retirada_status' then l.detalhe->>'colecao' = v_slug
      else false
    end
    order by l.created_at desc, l.id desc
    limit least(greatest(coalesce(p_limite, 60), 1), 200)
  ) t;

  return v_out;
end;
$$;
revoke all on function public.club_colecao_historico_interno(uuid, integer) from public, anon, authenticated;
grant execute on function public.club_colecao_historico_interno(uuid, integer) to service_role;

-- ── Pedidos do set fisico ───────────────────────────────────────────────────

-- A lista, com o contato de quem pediu (o Admin ja ve esses dados nas contas).
create or replace function public.club_retiradas_admin_interno(p_colecao uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c public.club_colecoes;
begin
  select * into v_c from public.club_colecoes c where c.id = p_colecao;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  return jsonb_build_object(
    'tiragem', v_c.tiragem_fisica,
    'ativos', (select count(*) from public.club_retiradas r where r.colecao_id = p_colecao and r.status <> 'cancelada'),
    'lista', coalesce((
      select jsonb_agg(jsonb_build_object(
        'numero', r.numero, 'status', r.status, 'nota', r.nota, 'criado_em', r.criado_em, 'atualizado_em', r.atualizado_em,
        'nome', u.name, 'instagram', u.instagram, 'email', u.email, 'whatsapp', u.whatsapp
      ) order by r.numero)
      from public.club_retiradas r
      left join public.users u on u.id = r.user_id
      where r.colecao_id = p_colecao
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.club_retiradas_admin_interno(uuid) from public, anon, authenticated;
grant execute on function public.club_retiradas_admin_interno(uuid) to service_role;

-- Muda o andamento de um pedido (solicitada, combinada, postada, entregue) ou
-- cancela. O cancelado libera a pessoa para pedir de novo; o entregue nao
-- cancela. p_nota nulo mantem a nota; vazio apaga.
create or replace function public.club_retirada_status_interno(p_numero integer, p_status text, p_nota text, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_r    public.club_retiradas;
  v_slug text;
  v_de   text;
  v_nota text;
begin
  if p_status not in ('solicitada', 'combinada', 'postada', 'entregue', 'cancelada') then raise exception 'status_invalido'; end if;
  select * into v_r from public.club_retiradas r where r.numero = p_numero for update;
  if not found then raise exception 'pedido_nao_encontrado'; end if;
  if v_r.status = 'cancelada' then raise exception 'pedido_cancelado'; end if;
  if v_r.status = 'entregue' and p_status = 'cancelada' then raise exception 'pedido_entregue'; end if;
  select c.slug into v_slug from public.club_colecoes c where c.id = v_r.colecao_id;

  v_de := v_r.status;
  v_nota := case when p_nota is null then v_r.nota else left(public.club_sem_emoji(p_nota), 500) end;
  update public.club_retiradas r set status = p_status, nota = v_nota, atualizado_em = now() where r.numero = p_numero returning * into v_r;

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (p_autor, case when p_autor is null then 'admin' else 'colecao' end, 'retirada_status', p_numero::text,
          jsonb_build_object('colecao', v_slug, 'de', v_de, 'para', p_status));

  return jsonb_build_object('numero', v_r.numero, 'status', v_r.status, 'nota', v_r.nota, 'atualizado_em', v_r.atualizado_em);
end;
$$;
revoke all on function public.club_retirada_status_interno(integer, text, text, uuid) from public, anon, authenticated;
grant execute on function public.club_retirada_status_interno(integer, text, text, uuid) to service_role;
