-- Album do Club, Fase 2, Fatia 3: estante de capitulos.
--
-- Tres funcoes novas, nenhuma tabela. O membro passa a enxergar mais de uma
-- edicao (a Base e os capitulos), a organizacao ganha o seletor de edicao e a
-- regra publica mostra todas as edicoes ja abertas. As funcoes da Fase 1
-- (club_colecao_organizar, club_colecao_regras_publica, club_colecao_minha)
-- ficam no banco, intactas.
--
-- ROLLBACK:
--   drop function public.club_colecao_organizar_v2(text);
--   drop function public.club_colecao_regras_publica_v2(text);
--   drop function public.club_album_estante();

-- ── Membro: a estante ────────────────────────────────────────────────────────

-- As edicoes que a pessoa enxerga, a Base primeiro e depois os capitulos na
-- ordem em que nasceram, com os contadores de cada uma e o contador do ciclo
-- (a soma, nao um total cravado). Confere as missoes automaticas das edicoes
-- que estao ganhando cartas, como club_colecao_minha_v2 faz para uma so.
-- Membro so ve edicao publicada ou encerrada que ja abriu; quem tem o papel
-- 'colecao' ve tambem rascunho e agendada, marcadas como previa (e a previa
-- fica fora do contador do ciclo).
create or replace function public.club_album_estante()
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_agora   timestamptz := now();
  v_org     boolean;
  v_c       public.club_colecoes;
  v_edicoes jsonb;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not exists (select 1 from public.club_membros m where m.user_id = v_uid) then raise exception 'nao_membro'; end if;
  v_org := public.club_tem_papel('colecao');

  for v_c in
    select c.* from public.club_colecoes c
    where (v_org or (c.status in ('publicada', 'encerrada') and c.abre_em <= v_agora))
      and c.status in ('rascunho', 'publicada')
      and (c.fecha_em is null or v_agora < c.fecha_em)
      and (c.status = 'rascunho' or c.abre_em <= v_agora or v_org)
    order by c.edicao
  loop
    perform public.club_album_conferir_interno(v_uid, v_c.id);
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
      'slug', c.slug, 'edicao', c.edicao, 'titulo', c.titulo, 'status', c.status,
      'papel', c.papel, 'trilha', c.trilha, 'ciclo', c.ciclo,
      'abre_em', c.abre_em, 'fecha_em', c.fecha_em,
      'previa', (c.status = 'rascunho' or c.abre_em > v_agora),
      'ganhando', (c.status = 'publicada' and c.abre_em <= v_agora and v_agora < c.fecha_em),
      'total', s.total, 'ganhas', s.ganhas, 'reveladas', s.reveladas, 'novas', s.ganhas - s.reveladas
    ) order by (c.papel = 'base') desc, c.edicao), '[]'::jsonb)
  into v_edicoes
  from public.club_colecoes c
  cross join lateral (
    select count(*) as total, count(d.carta_id) as ganhas, count(d.revelada_em) as reveladas
    from public.club_cartas k
    left join public.club_desbloqueios d on d.carta_id = k.id and d.user_id = v_uid and d.revogado_em is null
    where k.colecao_id = c.id
  ) s
  where v_org or (c.status in ('publicada', 'encerrada') and c.abre_em <= v_agora);

  return jsonb_build_object(
    'edicoes', v_edicoes,
    'ciclo', (
      select jsonb_build_object(
        'total', coalesce(sum((e->>'total')::integer), 0),
        'ganhas', coalesce(sum((e->>'ganhas')::integer), 0),
        'reveladas', coalesce(sum((e->>'reveladas')::integer), 0))
      from jsonb_array_elements(v_edicoes) e
      where not (e->>'previa')::boolean
    ),
    'papeis', public.club_meus_papeis()
  );
end;
$$;
revoke all on function public.club_album_estante() from public, anon, authenticated;
grant execute on function public.club_album_estante() to authenticated;

-- ── Regra publica, com todas as edicoes abertas ──────────────────────────────

-- O topo ('edicao' e 'cartas') continua no formato da Fase 1 e traz a edicao
-- pedida ou, sem p_slug, a Base. 'edicoes' traz todas as que ja abriram para o
-- membro, a Base primeiro, cada uma com as suas cartas. A carta secreta vai so
-- com o numero. Nunca nome, texto, arte, previa nem quantos ganharam.
create or replace function public.club_colecao_regras_publica_v2(p_slug text default null)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_todas  jsonb;
  v_uma    jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'edicao', jsonb_build_object(
        'slug', c.slug, 'edicao', c.edicao, 'titulo', c.titulo, 'status', c.status,
        'abre_em', c.abre_em, 'fecha_em', c.fecha_em, 'pedir_set_ate', c.pedir_set_ate,
        'tiragem_fisica', c.tiragem_fisica, 'papel', c.papel, 'trilha', c.trilha,
        'total', (select count(*) from public.club_cartas k where k.colecao_id = c.id)
      ),
      'cartas', (
        select coalesce(jsonb_agg(
          case when k.secreta
            then jsonb_build_object('numero', k.numero, 'secreta', true)
            else jsonb_build_object('numero', k.numero, 'secreta', false, 'missao', k.missao, 'modo', k.modo,
                                    'como_ganhar', k.como_ganhar, 'missao_titulo', k.missao_titulo, 'missao_icone', k.missao_icone)
          end
          order by k.numero), '[]'::jsonb)
        from public.club_cartas k where k.colecao_id = c.id
      )
    ) order by (c.papel = 'base') desc, c.edicao), '[]'::jsonb)
  into v_todas
  from public.club_colecoes c
  where c.status in ('publicada', 'encerrada') and c.abre_em <= now();

  select e into v_uma
  from jsonb_array_elements(v_todas) with ordinality as t(e, ord)
  where case when p_slug is null then true else (e->'edicao'->>'slug') = p_slug end
  order by (case when p_slug is null then (e->'edicao'->>'papel') = 'base' else true end) desc, ord
  limit 1;

  return jsonb_build_object(
    'edicao', case when v_uma is null then null else v_uma->'edicao' end,
    'cartas', coalesce(v_uma->'cartas', '[]'::jsonb),
    'edicoes', v_todas
  );
end;
$$;
revoke all on function public.club_colecao_regras_publica_v2(text) from public, anon, authenticated;
grant execute on function public.club_colecao_regras_publica_v2(text) to anon, authenticated;

-- ── Organizacao, com seletor de edicao ───────────────────────────────────────

-- Igual a club_colecao_organizar, com duas diferencas: sem p_slug abre na Base
-- (e nao na publicada mais nova, que com capitulos deixaria as cartas manuais
-- da Base inalcancaveis) e devolve 'edicoes', a lista para o seletor, com
-- quantas cartas de missao conferida cada uma tem.
create or replace function public.club_colecao_organizar_v2(p_slug text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_agora   timestamptz := now();
  v_c       public.club_colecoes;
  v_fase    text;
  v_cartas  jsonb;
  v_lotes   jsonb;
  v_edicoes jsonb;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('colecao') then raise exception 'sem_papel'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'slug', c.slug, 'edicao', c.edicao, 'titulo', c.titulo, 'status', c.status, 'papel', c.papel, 'trilha', c.trilha,
      'manuais', (select count(*) from public.club_cartas k where k.colecao_id = c.id and k.modo = 'manual')
    ) order by (c.papel = 'base') desc, c.edicao), '[]'::jsonb)
  into v_edicoes
  from public.club_colecoes c;

  select c.* into v_c
  from public.club_colecoes c
  where p_slug is null or c.slug = p_slug
  order by (c.papel = 'base') desc, (c.status = 'publicada') desc, c.edicao desc
  limit 1;
  if not found then return jsonb_build_object('edicao', null, 'edicoes', v_edicoes); end if;

  v_fase := case
    when v_c.status = 'rascunho' then 'rascunho'
    when v_c.status = 'encerrada' then 'encerrada'
    when v_c.abre_em > v_agora then 'agendada'
    when v_agora < v_c.fecha_em then 'aberta'
    when v_agora <= v_c.pedir_set_ate then 'so_pedidos'
    else 'prazo_encerrado'
  end;

  select coalesce(jsonb_agg(jsonb_build_object('numero', k.numero, 'missao', k.missao, 'como_ganhar', k.como_ganhar,
      'missao_titulo', k.missao_titulo) order by k.numero), '[]'::jsonb)
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
      'abre_em', v_c.abre_em, 'fecha_em', v_c.fecha_em, 'pedir_set_ate', v_c.pedir_set_ate,
      'papel', v_c.papel, 'trilha', v_c.trilha
    ),
    'cartas', v_cartas,
    'lotes', v_lotes,
    'edicoes', v_edicoes
  );
end;
$$;
revoke all on function public.club_colecao_organizar_v2(text) from public, anon, authenticated;
grant execute on function public.club_colecao_organizar_v2(text) to authenticated;
