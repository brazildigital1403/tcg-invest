-- Album do Club, Fase 2, Fatia 2b: amostra do portfolio.
--
-- Quem organiza o album (papel 'colecao') e o Admin conferem uma amostra dos
-- conteudos registrados. "Confere" so carimba. "Nao confere" marca o conteudo
-- como reprovado e tira as cartas de conteudo que deixaram de se sustentar.
-- Desfazer devolve o conteudo e as cartas voltam na conferencia seguinte.
--
-- Para a carta poder voltar, a revogacao passa a ter motivo: 'amostra' pode ser
-- reavaliada; lote desfeito continua definitivo, como na Fase 1.
--
-- ROLLBACK:
--   drop function public.club_conteudo_desfazer_amostra(uuid);
--   drop function public.club_conteudo_conferir(uuid, boolean, text);
--   drop function public.club_portfolio_amostra(integer);
--   drop function public.club_conteudo_desfazer_amostra_interno(uuid, uuid);
--   drop function public.club_conteudo_conferir_interno(uuid, boolean, text, uuid);
--   drop function public.club_portfolio_amostra_interno(integer, uuid);
--   -- e reaplicar club_album_conferir_interno (20261122100000) e club_album_conferir_abertas_interno (20261122120000)
--   alter table public.club_desbloqueios drop column revogado_motivo;
--   alter table public.club_conteudos drop column amostrado_em, drop column amostrado_por, drop column amostra_nota;

alter table public.club_conteudos
  add column amostrado_em timestamptz,
  add column amostrado_por uuid references public.users(id) on delete set null,
  add column amostra_nota text check (char_length(amostra_nota) <= 200);
create index club_conteudos_amostra_idx on public.club_conteudos (created_at) where amostrado_em is null and status = 'ativo';

alter table public.club_desbloqueios
  add column revogado_motivo text check (revogado_motivo in ('lote', 'amostra'));

-- ── Conferencia: carta tirada pela amostra pode voltar ───────────────────────

-- Igual a versao da Fatia 1, com uma diferenca: alem das cartas sem linha,
-- reavalia as revogadas com motivo 'amostra'. Se a missao voltou a se cumprir
-- (a pessoa registrou outro conteudo, ou a reprovacao foi desfeita), a carta
-- volta. Revogacao sem motivo ou por lote continua definitiva.
create or replace function public.club_album_conferir_interno(p_user uuid, p_colecao uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_motor  smallint;
  v_k      record;
  v_ok     boolean;
begin
  select c.motor into v_motor from public.club_colecoes c where c.id = p_colecao;
  if not found then return; end if;
  for v_k in
    select c.id, c.missao
    from public.club_cartas c
    left join public.club_desbloqueios d on d.user_id = p_user and d.carta_id = c.id
    where c.colecao_id = p_colecao and c.modo = 'auto'
      and (d.carta_id is null or (d.revogado_em is not null and d.revogado_motivo = 'amostra'))
    order by (c.missao = 'completo' or coalesce(c.regra_tipo, '') = 'cartas_da_edicao'), c.numero
  loop
    if v_motor = 1 then
      v_ok := public.club_missao_cumprida(p_user, v_k.missao, p_colecao);
    else
      v_ok := public.club_missao_cumprida_v2(p_user, v_k.id);
    end if;
    if v_ok then
      insert into public.club_desbloqueios (user_id, carta_id, origem)
      values (p_user, v_k.id, 'auto')
      on conflict (user_id, carta_id) do update
        set revogado_em = null, revogado_por = null, revogado_motivo = null, concedido_em = now(), revelada_em = null
        where public.club_desbloqueios.revogado_motivo = 'amostra';
    end if;
  end loop;
end;
$$;
revoke all on function public.club_album_conferir_interno(uuid, uuid) from public, anon, authenticated;

-- Igual a versao da Fatia 2, contando como "antes" so as cartas que valiam: a
-- carta que volta depois de uma reprovacao desfeita aparece como carta que chegou.
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
  select coalesce(array_agg(d.carta_id), '{}') into v_antes
  from public.club_desbloqueios d where d.user_id = p_user and d.revogado_em is null;
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

-- ── A amostra (nucleo, usado pela organizacao e pelo Admin) ──────────────────

-- Ate p_n conteudos ativos ainda nao conferidos, sorteados, mais os reprovados
-- recentes (para desfazer). p_fora tira da lista os conteudos de quem esta
-- conferindo. Devolve o link, a rede, o formato, o tema, as datas e o @ de quem
-- registrou. Nunca e-mail nem nome.
create or replace function public.club_portfolio_amostra_interno(p_n integer, p_fora uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer := greatest(1, least(coalesce(p_n, 10), 30));
begin
  return jsonb_build_object(
    'pendentes', (
      select coalesce(jsonb_agg(t.item), '[]'::jsonb) from (
        select jsonb_build_object('id', c.id, 'url', c.url, 'rede', c.rede, 'formato', c.formato, 'tema', c.tema,
          'publicado_em', c.publicado_em, 'created_at', c.created_at,
          'instagram', nullif(public.club_instagram_limpo(u.instagram), '')) as item
        from public.club_conteudos c
        join public.users u on u.id = c.user_id
        where c.status = 'ativo' and c.amostrado_em is null and (p_fora is null or c.user_id <> p_fora)
        order by random()
        limit v_n
      ) t
    ),
    'total_pendentes', (select count(*) from public.club_conteudos c where c.status = 'ativo' and c.amostrado_em is null and (p_fora is null or c.user_id <> p_fora)),
    'reprovados', (
      select coalesce(jsonb_agg(t.item order by t.quando desc), '[]'::jsonb) from (
        select c.amostrado_em as quando,
          jsonb_build_object('id', c.id, 'url', c.url, 'rede', c.rede, 'formato', c.formato, 'tema', c.tema,
            'publicado_em', c.publicado_em, 'amostrado_em', c.amostrado_em, 'nota', c.amostra_nota,
            'instagram', nullif(public.club_instagram_limpo(u.instagram), '')) as item
        from public.club_conteudos c
        join public.users u on u.id = c.user_id
        where c.status = 'reprovado'
        order by c.amostrado_em desc nulls last
        limit 30
      ) t
    )
  );
end;
$$;
revoke all on function public.club_portfolio_amostra_interno(integer, uuid) from public, anon, authenticated;
grant execute on function public.club_portfolio_amostra_interno(integer, uuid) to service_role;

-- "Confere" carimba a amostra. "Nao confere" reprova o conteudo e tira, com
-- motivo 'amostra', as cartas de conteudo da pessoa que deixaram de se
-- sustentar (recalcula cada uma pela regra). Quem ja pediu o set daquela
-- edicao fica de fora, como no desfazer de lote. Carta derivada (a secreta do
-- capitulo) nao e desfeita.
create or replace function public.club_conteudo_conferir_interno(p_id uuid, p_ok boolean, p_nota text, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c      public.club_conteudos;
  v_nota   text := public.club_sem_emoji(p_nota);
  v_d      record;
  v_tirou  integer := 0;
begin
  if p_ok is null then raise exception 'dados_invalidos'; end if;
  if v_nota is not null and char_length(v_nota) > 200 then raise exception 'nota_grande'; end if;
  select * into v_c from public.club_conteudos c where c.id = p_id for update;
  if not found then raise exception 'conteudo_nao_encontrado'; end if;
  if v_c.status <> 'ativo' then raise exception 'conteudo_ja_reprovado'; end if;

  update public.club_conteudos c
  set amostrado_em = now(), amostrado_por = p_autor, amostra_nota = v_nota, status = case when p_ok then 'ativo' else 'reprovado' end
  where c.id = v_c.id;

  if not p_ok then
    for v_d in
      select d.carta_id
      from public.club_desbloqueios d
      join public.club_cartas k on k.id = d.carta_id
      where d.user_id = v_c.user_id and d.revogado_em is null and d.origem = 'auto'
        and k.regra_tipo in ('conteudos', 'conteudos_sequencia')
        and not exists (select 1 from public.club_retiradas r where r.colecao_id = k.colecao_id and r.user_id = v_c.user_id and r.status <> 'cancelada')
    loop
      if not public.club_missao_cumprida_v2(v_c.user_id, v_d.carta_id) then
        update public.club_desbloqueios d
        set revogado_em = now(), revogado_por = p_autor, revogado_motivo = 'amostra'
        where d.user_id = v_c.user_id and d.carta_id = v_d.carta_id;
        v_tirou := v_tirou + 1;
      end if;
    end loop;
  end if;

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (p_autor, case when p_autor is null then 'admin' else 'colecao' end, case when p_ok then 'conteudo_conferir' else 'conteudo_reprovar' end, v_c.id::text,
          jsonb_build_object('chave', v_c.chave, 'nota', v_nota, 'cartas_tiradas', v_tirou));

  return jsonb_build_object('id', v_c.id, 'status', case when p_ok then 'ativo' else 'reprovado' end, 'cartas_tiradas', v_tirou);
end;
$$;
revoke all on function public.club_conteudo_conferir_interno(uuid, boolean, text, uuid) from public, anon, authenticated;
grant execute on function public.club_conteudo_conferir_interno(uuid, boolean, text, uuid) to service_role;

-- Desfaz uma reprovacao: o conteudo volta a valer (e fica como conferido) e as
-- cartas tiradas por ela voltam na mesma hora, se a missao se cumpre de novo.
create or replace function public.club_conteudo_desfazer_amostra_interno(p_id uuid, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c       public.club_conteudos;
  v_cartas  jsonb;
begin
  select * into v_c from public.club_conteudos c where c.id = p_id for update;
  if not found then raise exception 'conteudo_nao_encontrado'; end if;
  if v_c.status <> 'reprovado' then raise exception 'conteudo_nao_reprovado'; end if;

  update public.club_conteudos c set status = 'ativo', amostrado_em = now(), amostrado_por = p_autor where c.id = v_c.id;
  v_cartas := public.club_album_conferir_abertas_interno(v_c.user_id);

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (p_autor, case when p_autor is null then 'admin' else 'colecao' end, 'conteudo_desfazer', v_c.id::text,
          jsonb_build_object('chave', v_c.chave, 'cartas_devolvidas', jsonb_array_length(v_cartas)));

  return jsonb_build_object('id', v_c.id, 'status', 'ativo', 'cartas_devolvidas', jsonb_array_length(v_cartas));
end;
$$;
revoke all on function public.club_conteudo_desfazer_amostra_interno(uuid, uuid) from public, anon, authenticated;
grant execute on function public.club_conteudo_desfazer_amostra_interno(uuid, uuid) to service_role;

-- ── Quem organiza (papel 'colecao') ──────────────────────────────────────────

-- A amostra da semana para quem organiza. Nunca traz o proprio conteudo.
create or replace function public.club_portfolio_amostra(p_n integer default 10)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('colecao') then raise exception 'sem_papel'; end if;
  return public.club_portfolio_amostra_interno(p_n, v_uid);
end;
$$;
revoke all on function public.club_portfolio_amostra(integer) from public, anon, authenticated;
grant execute on function public.club_portfolio_amostra(integer) to authenticated;

-- Confere ou reprova um conteudo. Nunca o proprio.
create or replace function public.club_conteudo_conferir(p_id uuid, p_ok boolean, p_nota text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('colecao') then raise exception 'sem_papel'; end if;
  if exists (select 1 from public.club_conteudos c where c.id = p_id and c.user_id = v_uid) then raise exception 'proprio_conteudo'; end if;
  return public.club_conteudo_conferir_interno(p_id, p_ok, p_nota, v_uid);
end;
$$;
revoke all on function public.club_conteudo_conferir(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.club_conteudo_conferir(uuid, boolean, text) to authenticated;

-- Desfaz uma reprovacao. Nunca a do proprio conteudo.
create or replace function public.club_conteudo_desfazer_amostra(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('colecao') then raise exception 'sem_papel'; end if;
  if exists (select 1 from public.club_conteudos c where c.id = p_id and c.user_id = v_uid) then raise exception 'proprio_conteudo'; end if;
  return public.club_conteudo_desfazer_amostra_interno(p_id, v_uid);
end;
$$;
revoke all on function public.club_conteudo_desfazer_amostra(uuid) from public, anon, authenticated;
grant execute on function public.club_conteudo_desfazer_amostra(uuid) to authenticated;
