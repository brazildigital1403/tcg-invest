-- Feed do Club, Fase 2 da versao C (27/11/2026, decisao do Du).
-- 1) "Chegaram esta semana" e a escolha da semana saem de uma funcao propria (club_feed_destaques),
--    e nao do corte da pagina da club_feed_lista: aparecem sempre, mesmo com centenas de posts.
-- 2) A escolha da semana ganha a frase de quem escolheu (club_feed_semanas.escolha_frase), gravada
--    pela club_feed_semana_salvar_v2. A v1 fica intacta ate o front trocar de chamador.
-- Objetos novos com nome novo; nada aqui muda o que ja existe alem da coluna nova (nula).
--
-- ROLLBACK:
--   drop function public.club_feed_destaques();
--   drop function public.club_feed_semana_salvar_v2(text, uuid, text);
--   alter table public.club_feed_semanas drop column escolha_frase;

alter table public.club_feed_semanas
  add column escolha_frase text check (escolha_frase is null or char_length(escolha_frase) between 3 and 160);

-- Destaques do feed: quem fez o primeiro post nos ultimos 7 dias e a escolha da semana corrente.
-- Aberto a visitante (o feed e publico). "marquei" so vem para quem esta logado.
create or replace function public.club_feed_destaques()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_semana date := public.club_feed_semana_atual();
  v_cheg   jsonb;
  v_esc    jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'arroba', x.arroba, 'rede', x.rede, 'formato', x.formato, 'tema', x.tema, 'url', x.url, 'feed_em', x.feed_em,
           'marquei', case when v_uid is null then null else
             exists (select 1 from public.club_feed_apoios a where a.conteudo_id = x.id and a.user_id = v_uid) end
         ) order by x.feed_em desc), '[]'::jsonb)
    into v_cheg
  from (
    select c.id, c.rede, c.formato, c.tema, c.url, c.feed_em, public.club_instagram_limpo(u.instagram) as arroba
    from public.club_conteudos c
    join public.club_membros m on m.user_id = c.user_id
    join public.users u on u.id = c.user_id
    where c.feed_em is not null and c.feed_em >= now() - interval '7 days'
      and c.status = 'ativo' and c.feed_oculto_em is null
      and (v_uid is null or c.user_id <> v_uid)
      -- o primeiro post da pessoa no feed (mesmo desempate da club_feed_lista)
      and not exists (select 1 from public.club_conteudos o
                      where o.user_id = c.user_id and o.feed_em is not null and (o.feed_em, o.id) < (c.feed_em, c.id))
    order by c.feed_em desc
    limit 20
  ) x;

  select jsonb_build_object(
           'id', c.id, 'arroba', public.club_instagram_limpo(u.instagram), 'rede', c.rede, 'formato', c.formato, 'tema', c.tema,
           'url', c.url, 'capa', case when c.capa_status = 'ok' then c.capa_path end, 'feed_em', c.feed_em,
           'frase', s.escolha_frase,
           'meu', v_uid is not null and c.user_id = v_uid,
           'marquei', case when v_uid is null then null else
             exists (select 1 from public.club_feed_apoios a where a.conteudo_id = c.id and a.user_id = v_uid) end)
    into v_esc
  from public.club_feed_semanas s
  join public.club_conteudos c on c.id = s.escolha
  join public.club_membros m on m.user_id = c.user_id
  join public.users u on u.id = c.user_id
  where s.semana = v_semana and c.feed_em is not null and c.status = 'ativo' and c.feed_oculto_em is null;

  return jsonb_build_object('chegaram', v_cheg, 'escolha', v_esc);
end;
$$;
revoke all on function public.club_feed_destaques() from public, anon, authenticated;
grant execute on function public.club_feed_destaques() to anon, authenticated;

-- Tema, escolha e a frase de quem escolheu. Mesmas travas da v1 (papel feed, post no feed, nunca o
-- proprio post). Sem escolha, a frase sai junto.
create or replace function public.club_feed_semana_salvar_v2(p_tema text, p_escolha uuid, p_frase text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_semana date := public.club_feed_semana_atual();
  v_tema   text := public.club_sem_emoji(p_tema);
  v_frase  text := nullif(btrim(public.club_sem_emoji(p_frase)), '');
begin
  if auth.uid() is null then raise exception 'nao_logado'; end if;
  if not public.club_tem_papel('feed') then raise exception 'sem_papel'; end if;
  if v_tema is not null and (char_length(v_tema) < 3 or char_length(v_tema) > 40 or v_tema ~ '[\n\r]') then
    raise exception 'tema_invalido';
  end if;
  if p_escolha is null then v_frase := null; end if;
  if v_frase is not null and (char_length(v_frase) < 3 or char_length(v_frase) > 160) then
    raise exception 'frase_invalida';
  end if;
  if p_escolha is not null and not exists (
    select 1 from public.club_conteudos c where c.id = p_escolha and c.feed_em is not null and c.feed_oculto_em is null and c.status = 'ativo'
  ) then
    raise exception 'post_nao_encontrado';
  end if;
  if p_escolha is not null and exists (select 1 from public.club_conteudos c where c.id = p_escolha and c.user_id = auth.uid()) then
    raise exception 'proprio_conteudo';
  end if;

  insert into public.club_feed_semanas (semana, tema, escolha, escolha_frase, updated_por, updated_at)
  values (v_semana, v_tema, p_escolha, v_frase, auth.uid(), now())
  on conflict (semana) do update set tema = excluded.tema, escolha = excluded.escolha, escolha_frase = excluded.escolha_frase,
    updated_por = excluded.updated_por, updated_at = now();

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (auth.uid(), 'feed', 'feed_semana', v_semana::text, jsonb_build_object('tema', v_tema, 'escolha', p_escolha, 'frase', v_frase));

  return jsonb_build_object('inicio', v_semana, 'tema', v_tema, 'escolha', p_escolha, 'frase', v_frase);
end;
$$;
revoke all on function public.club_feed_semana_salvar_v2(text, uuid, text) from public, anon, authenticated;
grant execute on function public.club_feed_semana_salvar_v2(text, uuid, text) to authenticated;
