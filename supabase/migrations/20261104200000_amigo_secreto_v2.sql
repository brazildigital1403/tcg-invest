-- ============================================================================
-- Amigo Secreto v2 (04/11/2026): achados da analise externa
-- ============================================================================
-- 1. Recebimento so depois de quem me tirou postar, ou "recebi em maos".
-- 2. Mural guarda os recados do sorteio ate a revelacao (a janela de 14 dias
--    apagaria os primeiros numa edicao de 21 dias) e abre 60 minutos depois
--    do sorteio (quem posta na hora entregava o par pelo contexto).
-- 3. A sala sabe se o outro lado aceitou a revelacao (sem dizer quem e).
--
-- Rollback: drop function amigo_secreto_recebi(text, boolean) e
-- amigo_secreto_mural_abre_em(uuid); recriar meu/feed/enviar_mensagem/recebi
-- da migration 20261104100000; alter table ... drop column recebido_em_maos.
-- ============================================================================

alter table public.amigo_secreto_participantes
  add column if not exists recebido_em_maos boolean not null default false;

-- ── Mural abre 60 minutos depois do sorteio executado ───────────────────────

create or replace function public.amigo_secreto_mural_abre_em(p_edicao uuid)
returns timestamptz language sql stable as $$
  select max(executado_em) + interval '60 minutes' from public.amigo_secreto_sorteios where edicao_id = p_edicao;
$$;
revoke all on function public.amigo_secreto_mural_abre_em(uuid) from public, anon, authenticated;

-- ── Minha sala (v2: mural_abre_em, aceite do outro lado, recebido em maos) ──

create or replace function public.amigo_secreto_meu(p_slug text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_e   public.amigo_secreto_edicoes;
  v_me  public.amigo_secreto_participantes;
  v_t   public.amigo_secreto_participantes;
  v_q   public.amigo_secreto_participantes;
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
      'recebido_em', v_t.recebido_em,
      'aceitou', v_t.quer_revelar
    );
  end if;

  select * into v_q from public.amigo_secreto_participantes where edicao_id = v_e.id and tirou_id = v_me.id;
  if found then
    v_recebo := jsonb_build_object(
      'postado_em', v_q.postado_em, 'rastreio', v_q.rastreio,
      'outro_aceitou', v_q.quer_revelar,
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
    'minimo', greatest(3, v_e.minimo),
    'mural_abre_em', public.amigo_secreto_mural_abre_em(v_e.id),
    'eu', jsonb_build_object(
      'instagram', v_me.instagram, 'whatsapp', v_me.whatsapp, 'nome_completo', v_me.nome_completo,
      'pokemon', v_me.pokemon, 'desejo', v_me.desejo, 'sugestoes', v_me.sugestoes, 'me_surpreenda', v_me.me_surpreenda,
      'cep', v_me.cep, 'logradouro', v_me.logradouro, 'numero', v_me.numero, 'complemento', v_me.complemento,
      'bairro', v_me.bairro, 'cidade', v_me.cidade, 'uf', v_me.uf,
      'rastreio', v_me.rastreio, 'postado_em', v_me.postado_em, 'recebido_em', v_me.recebido_em,
      'recebido_em_maos', v_me.recebido_em_maos,
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
revoke all on function public.amigo_secreto_meu(text) from public, anon, authenticated;
grant execute on function public.amigo_secreto_meu(text) to authenticated;

-- ── Recebi (v2): so depois da postagem de quem me tirou, ou em maos ─────────

drop function if exists public.amigo_secreto_recebi(text);

create or replace function public.amigo_secreto_recebi(p_slug text, p_em_maos boolean default false)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_e   public.amigo_secreto_edicoes;
  v_me  public.amigo_secreto_participantes;
  v_q   public.amigo_secreto_participantes;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;
  select * into v_e from public.amigo_secreto_edicoes where slug = p_slug;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  if v_e.estado not in ('sorteado', 'entregas', 'encerrado') then raise exception 'sem_sorteio'; end if;
  select * into v_me from public.amigo_secreto_participantes where edicao_id = v_e.id and user_id = v_uid;
  if not found then raise exception 'nao_participante'; end if;
  select * into v_q from public.amigo_secreto_participantes where edicao_id = v_e.id and tirou_id = v_me.id;
  if not found then raise exception 'sem_sorteio'; end if;
  if not coalesce(p_em_maos, false) and v_q.postado_em is null then raise exception 'sem_postagem'; end if;
  update public.amigo_secreto_participantes
     set recebido_em = coalesce(recebido_em, now()), recebido_em_maos = coalesce(p_em_maos, false), updated_at = now()
   where id = v_me.id;
  return public.amigo_secreto_meu(p_slug);
end;
$$;
revoke all on function public.amigo_secreto_recebi(text, boolean) from public, anon, authenticated;
grant execute on function public.amigo_secreto_recebi(text, boolean) to authenticated;

-- ── Mural (v2): do sorteio ate a revelacao, aberto 60 min depois do sorteio ─

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
  if v_e.estado = 'encerrado' or v_e.dados_apagados_em is not null then raise exception 'edicao_encerrada'; end if;
  select * into v_me from public.amigo_secreto_participantes where edicao_id = v_e.id and user_id = v_uid;
  if not found or v_me.tirou_id is null then raise exception 'sem_sorteio'; end if;
  if now() < coalesce(public.amigo_secreto_mural_abre_em(v_e.id), now()) then raise exception 'mural_aguardando'; end if;
  perform pg_advisory_xact_lock(hashtext(v_me.id::text));
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
revoke all on function public.amigo_secreto_enviar_mensagem(text, text, smallint) from public, anon, authenticated;
grant execute on function public.amigo_secreto_enviar_mensagem(text, text, smallint) to authenticated;

create or replace function public.amigo_secreto_feed(p_slug text, p_limit integer default 400)
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
  if v_uid is null then raise exception 'nao_logado'; end if;
  select id into v_me_id from public.amigo_secreto_participantes where edicao_id = v_e.id and user_id = v_uid;
  if v_me_id is null then raise exception 'nao_participante'; end if;
  if now() < coalesce(public.amigo_secreto_mural_abre_em(v_e.id), now()) then raise exception 'mural_aguardando'; end if;
  -- Todos os recados da edicao (do sorteio ate a revelacao), do dia mais
  -- recente para o mais antigo e embaralhados dentro do dia.
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'texto', m.texto, 'pronta', m.pronta,
      'dia', (m.criado_em at time zone 'America/Sao_Paulo')::date,
      'para', public.amigo_secreto_ficha(p),
      'para_mim', (v_me_id is not null and m.para_id = v_me_id)
    ) order by (m.criado_em at time zone 'America/Sao_Paulo')::date desc, md5(m.id::text))
    from (select * from public.amigo_secreto_mensagens
          where edicao_id = v_e.id
          order by (criado_em at time zone 'America/Sao_Paulo')::date desc, md5(id::text)
          limit greatest(1, least(coalesce(p_limit, 400), 1000))) m
    join public.amigo_secreto_participantes p on p.id = m.para_id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.amigo_secreto_feed(text, integer) from public, anon, authenticated;
grant execute on function public.amigo_secreto_feed(text, integer) to authenticated;
