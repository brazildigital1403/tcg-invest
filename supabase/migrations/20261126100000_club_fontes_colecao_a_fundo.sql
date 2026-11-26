-- Club / Album: cinco fontes novas do tipo 'sinal' para o capitulo Colecao a fundo (plano de 26/11/2026).
-- colecao_idiomas (Poliglota), colecao_brilho (Brilho Extra), anuncio_24h (Primeiro Anuncio),
-- leilao_seguindo (De Olho no Martelo) e colecao_scan (Olho de Camera). Nada de tabela nova: todas leem por
-- user_id, com indice (idx_user_cards_user, idx_marketplace_user, idx_leilao_seguidores_user). So troca duas funcoes.
--
-- Rollback: reaplicar club_regra_valida (20261125120000_club_capitulos.sql) e club_sinal_conta (a versao de
-- 20261125110000 mais os ramos de link). Antes, trocar de volta para manual qualquer carta que use as cinco fontes.

create or replace function public.club_regra_valida(p_tipo text, p_param jsonb, p_desde boolean)
returns void
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  v_p      jsonb := coalesce(p_param, '{}'::jsonb);
  v_k      text;
  v_fonte  text;
  v_item   jsonb;
  -- Fontes do tipo 'sinal'. As tres ultimas leem tabelas da Fatia 2.
  c_fontes constant text[] := array[
    'membro', 'aniversario', 'instagram', 'voto', 'indicacao',
    'colecao_cartas', 'colecao_graduada', 'colecao_dias', 'colecao_set',
    'meta', 'meta_concluida', 'pasta', 'pasta_publica', 'acompanhando', 'preco_alvo', 'centralizacao',
    'ficha_criador', 'bio_criador', 'aceite',
    -- Meu link do Club (25/11/2026): visitas do @, cadastros pelo link e convidado com N cartas.
    'link_visitas', 'indicacao_cadastro', 'indicado_cartas',
    -- Album, capitulo Colecao a fundo (26/11/2026): gestos que o site ja mede.
    'colecao_idiomas', 'colecao_brilho', 'anuncio_24h', 'leilao_seguindo', 'colecao_scan'];
  -- Fontes que usam o limiar proprio 'n' (cartas na pasta, cartas do set, tamanho da meta).
  c_com_n  constant text[] := array['colecao_set', 'meta_concluida', 'pasta', 'pasta_publica', 'indicado_cartas'];
begin
  if p_tipo is null or jsonb_typeof(v_p) <> 'object' then raise exception 'regra_invalida'; end if;

  if p_tipo = 'manual' then
    if v_p <> '{}'::jsonb or coalesce(p_desde, false) then raise exception 'regra_invalida'; end if;

  elsif p_tipo = 'sinal' then
    for v_k in select jsonb_object_keys(v_p) loop
      if v_k not in ('fonte', 'minimo', 'n', 'ref') then raise exception 'regra_invalida' using detail = 'chave: ' || v_k; end if;
    end loop;
    v_fonte := v_p->>'fonte';
    if jsonb_typeof(v_p->'fonte') is distinct from 'string' or not (v_fonte = any (c_fontes)) then
      raise exception 'regra_invalida' using detail = 'fonte';
    end if;
    if jsonb_typeof(v_p->'minimo') is distinct from 'number' or (v_p->>'minimo') !~ '^[0-9]{1,3}$'
       or (v_p->>'minimo')::integer not between 1 and 500 then
      raise exception 'regra_invalida' using detail = 'minimo';
    end if;
    if v_p ? 'n' then
      if not (v_fonte = any (c_com_n)) or jsonb_typeof(v_p->'n') <> 'number' or (v_p->>'n') !~ '^[0-9]{1,3}$'
         or (v_p->>'n')::integer not between 1 and 500 then
        raise exception 'regra_invalida' using detail = 'n';
      end if;
    end if;
    if v_fonte = 'aceite' then
      if jsonb_typeof(v_p->'ref') is distinct from 'string' or (v_p->>'ref') !~ '^[a-z0-9-]{2,40}$' then
        raise exception 'regra_invalida' using detail = 'ref';
      end if;
    elsif v_p ? 'ref' then
      raise exception 'regra_invalida' using detail = 'ref';
    end if;
    -- O @ do perfil nao tem data: nao da para saber se veio depois da abertura.
    if coalesce(p_desde, false) and v_fonte = 'instagram' then raise exception 'fonte_sem_data'; end if;

  elsif p_tipo = 'cartas_da_edicao' then
    for v_k in select jsonb_object_keys(v_p) loop
      if v_k not in ('chaves', 'todas', 'minimo') then raise exception 'regra_invalida' using detail = 'chave: ' || v_k; end if;
    end loop;
    if coalesce(p_desde, false) then raise exception 'regra_invalida' using detail = 'desde'; end if;
    if jsonb_typeof(v_p->'minimo') is distinct from 'number' or (v_p->>'minimo') !~ '^[0-9]{1,2}$'
       or (v_p->>'minimo')::integer not between 1 and 99 then
      raise exception 'regra_invalida' using detail = 'minimo';
    end if;
    if v_p ? 'todas' then
      if v_p->'todas' <> 'true'::jsonb or v_p ? 'chaves' then raise exception 'regra_invalida' using detail = 'todas'; end if;
    else
      if jsonb_typeof(v_p->'chaves') is distinct from 'array' or jsonb_array_length(v_p->'chaves') not between 1 and 99 then
        raise exception 'regra_invalida' using detail = 'chaves';
      end if;
      for v_item in select jsonb_array_elements(v_p->'chaves') loop
        if jsonb_typeof(v_item) <> 'string' or (v_item #>> '{}') !~ '^[a-z0-9_]{2,40}$' then
          raise exception 'regra_invalida' using detail = 'chaves';
        end if;
      end loop;
      if (v_p->>'minimo')::integer > jsonb_array_length(v_p->'chaves') then raise exception 'regra_invalida' using detail = 'minimo'; end if;
    end if;

  elsif p_tipo = 'conteudos' then
    for v_k in select jsonb_object_keys(v_p) loop
      if v_k not in ('formato', 'tema', 'rede', 'minimo', 'distintos_por') then raise exception 'regra_invalida' using detail = 'chave: ' || v_k; end if;
      -- As listas fechadas de formato, tema e rede nascem com o portfolio (Fatia 2).
      if v_k in ('formato', 'tema', 'rede')
         and (jsonb_typeof(v_p->v_k) <> 'string' or (v_p->>v_k) !~ '^[a-z0-9_]{2,30}$') then
        raise exception 'regra_invalida' using detail = v_k;
      end if;
    end loop;
    if jsonb_typeof(v_p->'minimo') is distinct from 'number' or (v_p->>'minimo') !~ '^[0-9]{1,3}$'
       or (v_p->>'minimo')::integer not between 1 and 500 then
      raise exception 'regra_invalida' using detail = 'minimo';
    end if;
    if v_p ? 'distintos_por' and (jsonb_typeof(v_p->'distintos_por') <> 'string' or (v_p->>'distintos_por') not in ('formato', 'rede')) then
      raise exception 'regra_invalida' using detail = 'distintos_por';
    end if;

  elsif p_tipo = 'conteudos_sequencia' then
    for v_k in select jsonb_object_keys(v_p) loop
      if v_k <> 'semanas' then raise exception 'regra_invalida' using detail = 'chave: ' || v_k; end if;
    end loop;
    if jsonb_typeof(v_p->'semanas') is distinct from 'number' or (v_p->>'semanas') !~ '^[0-9]{1,2}$'
       or (v_p->>'semanas')::integer not between 2 and 12 then
      raise exception 'regra_invalida' using detail = 'semanas';
    end if;

  elsif p_tipo = 'capitulos' then
    -- Capitulos fechados (25/11/2026): deriva do album inteiro, nao de uma edicao so.
    for v_k in select jsonb_object_keys(v_p) loop
      if v_k not in ('minimo', 'trilha') then raise exception 'regra_invalida' using detail = 'chave: ' || v_k; end if;
    end loop;
    if coalesce(p_desde, false) then raise exception 'regra_invalida' using detail = 'desde'; end if;
    if jsonb_typeof(v_p->'minimo') is distinct from 'number' or (v_p->>'minimo') !~ '^[0-9]{1,2}$'
       or (v_p->>'minimo')::integer not between 1 and 99 then
      raise exception 'regra_invalida' using detail = 'minimo';
    end if;
    if v_p ? 'trilha' and (jsonb_typeof(v_p->'trilha') <> 'string' or (v_p->>'trilha') not in ('creator', 'bynx', 'club')) then
      raise exception 'regra_invalida' using detail = 'trilha';
    end if;

  else
    raise exception 'regra_invalida' using detail = 'tipo';
  end if;
end;
$$;

create or replace function public.club_sinal_conta(p_user uuid, p_fonte text, p_n integer, p_ref text, p_desde timestamp with time zone, p_limite integer)
 returns integer
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_lim  integer := greatest(1, least(coalesce(p_limite, 1), 500));
  v_n    integer := greatest(1, least(coalesce(p_n, 1), 500));
  -- user_cards.created_at e timestamp sem fuso, gravado em UTC.
  v_d_utc timestamp := (p_desde at time zone 'UTC');
  v_out  integer := 0;
begin
  case p_fonte
    when 'membro' then
      select count(*) into v_out from (
        select 1 from public.club_membros m
        where m.user_id = p_user and (p_desde is null or m.created_at >= p_desde) limit v_lim) t;
    when 'aniversario' then
      select count(*) into v_out from (
        select 1 from public.club_aniversarios a
        where a.user_id = p_user and (p_desde is null or a.created_at >= p_desde) limit v_lim) t;
    when 'instagram' then
      select count(*) into v_out from (
        select 1 from public.users u
        where u.id = p_user and public.club_instagram_limpo(u.instagram) ~ '^[a-z0-9._]{1,30}$' limit 1) t;
    when 'voto' then
      select count(*) into v_out from (
        select 1 from public.club_avisos_votos v
        where v.user_id = p_user and (p_desde is null or v.updated_at >= p_desde) limit v_lim) t;
    when 'indicacao' then
      select count(*) into v_out from (
        select 1 from public.referrals r
        where r.referrer_user_id = p_user and r.ativou_at is not null and not coalesce(r.is_suspicious, false)
          and (p_desde is null or r.ativou_at >= p_desde) limit v_lim) t;
    -- Linhas, nao copias: uma carta com quantidade 10 nao vale por dez.
    when 'colecao_cartas' then
      select count(*) into v_out from (
        select 1 from public.user_cards uc
        where uc.user_id = p_user and (p_desde is null or uc.created_at >= v_d_utc) limit v_lim) t;
    when 'colecao_graduada' then
      select count(*) into v_out from (
        select 1 from public.user_cards uc
        where uc.user_id = p_user and uc.graduada and (p_desde is null or uc.created_at >= v_d_utc) limit v_lim) t;
    -- Dias distintos, no relogio de Brasilia, em que a pessoa adicionou carta.
    when 'colecao_dias' then
      select count(*) into v_out from (
        select distinct ((uc.created_at at time zone 'UTC') at time zone 'America/Sao_Paulo')::date
        from public.user_cards uc
        where uc.user_id = p_user and uc.created_at is not null and (p_desde is null or uc.created_at >= v_d_utc)
        limit v_lim) t;
    -- Sets em que a pessoa tem p_n linhas ou mais (pelo set_id gravado na linha).
    when 'colecao_set' then
      select count(*) into v_out from (
        select uc.set_id from public.user_cards uc
        where uc.user_id = p_user and nullif(uc.set_id, '') is not null and (p_desde is null or uc.created_at >= v_d_utc)
        group by uc.set_id having count(*) >= v_n
        limit v_lim) t;
    when 'meta' then
      select count(*) into v_out from (
        select 1 from public.metas_colecao g
        where g.user_id = p_user and (p_desde is null or g.created_at >= p_desde) limit v_lim) t;
    when 'meta_concluida' then
      select count(*) into v_out from (
        select 1 from public.metas_colecao g
        where g.user_id = p_user and g.concluida_em is not null and coalesce(g.total, 0) >= v_n
          and (p_desde is null or g.concluida_em >= p_desde) limit v_lim) t;
    when 'pasta' then
      select count(*) into v_out from (
        select 1 from public.pastas p
        where p.user_id = p_user and (p_desde is null or p.created_at >= p_desde)
          and (select count(*) from (select 1 from public.pasta_cards pc where pc.pasta_id = p.id limit v_n) x) >= v_n
        limit v_lim) t;
    when 'pasta_publica' then
      select count(*) into v_out from (
        select 1 from public.pastas p
        where p.user_id = p_user and p.publico and (p_desde is null or p.updated_at >= p_desde)
          and (select count(*) from (select 1 from public.pasta_cards pc where pc.pasta_id = p.id limit v_n) x) >= v_n
        limit v_lim) t;
    when 'acompanhando' then
      select count(*) into v_out from (
        select 1 from public.watchlist w
        where w.user_id = p_user and (p_desde is null or w.created_at >= p_desde) limit v_lim) t;
    when 'preco_alvo' then
      select count(*) into v_out from (
        select 1 from public.watchlist w
        where w.user_id = p_user and w.target_price is not null and (p_desde is null or w.created_at >= p_desde) limit v_lim) t;
    when 'centralizacao' then
      select count(*) into v_out from (
        select 1 from public.centralizacao_previas z
        where z.user_id = p_user and not z.oculta and (p_desde is null or z.created_at >= p_desde) limit v_lim) t;
    -- Meu link do Club. Visitas do endereco @ (soma por dia, dia em Brasilia). So conta
    -- aberturas, nao pessoas: serve para a carta mais simples, nunca para recompensa de valor.
    when 'link_visitas' then
      select least(coalesce(sum(v.visitas), 0), v_lim)::integer into v_out
      from public.club_link_visitas v
      where v.user_id = p_user
        and (p_desde is null or v.dia >= (p_desde at time zone 'America/Sao_Paulo')::date);
    -- Cadastros feitos pelo link da pessoa, ativados ou nao, sem os marcados como suspeitos.
    when 'indicacao_cadastro' then
      select count(*) into v_out from (
        select 1 from public.referrals r
        where r.referrer_user_id = p_user and not coalesce(r.is_suspicious, false)
          and (p_desde is null or r.cadastrou_at >= p_desde) limit v_lim) t;
    -- Convidados ativados (sem suspeita) que tem p_n cartas ou mais; com p_desde, so as cartas
    -- adicionadas depois dele. Cada convidado e uma busca por idx_user_cards_user.
    when 'indicado_cartas' then
      select count(*) into v_out from (
        select 1 from public.referrals r
        where r.referrer_user_id = p_user and r.ativou_at is not null and not coalesce(r.is_suspicious, false)
          and (select count(*) from (
                 select 1 from public.user_cards uc
                 where uc.user_id = r.referred_user_id and (p_desde is null or uc.created_at >= v_d_utc)
                 limit v_n) x) >= v_n
        limit v_lim) t;
    -- Capitulo Colecao a fundo (26/11/2026). Todas leem por user_id, com indice.
    -- Idiomas distintos entre as cartas da colecao (idioma nulo nao conta).
    when 'colecao_idiomas' then
      select count(*) into v_out from (
        select distinct uc.idioma from public.user_cards uc
        where uc.user_id = p_user and uc.idioma is not null and (p_desde is null or uc.created_at >= v_d_utc)
        limit v_lim) t;
    -- Linhas foil ou reverse.
    when 'colecao_brilho' then
      select count(*) into v_out from (
        select 1 from public.user_cards uc
        where uc.user_id = p_user and uc.variante in ('foil', 'reverse') and (p_desde is null or uc.created_at >= v_d_utc)
        limit v_lim) t;
    -- Anuncio com foto propria, ainda no ar e criado ha 24 horas ou mais (marketplace.created_at e UTC sem fuso).
    when 'anuncio_24h' then
      select count(*) into v_out from (
        select 1 from public.marketplace m
        where m.user_id = p_user and jsonb_typeof(m.fotos) = 'array' and jsonb_array_length(m.fotos) >= 1
          and m.removido_em is null and m.status <> 'cancelado'
          and m.created_at <= (now() at time zone 'UTC') - interval '24 hours'
          and (p_desde is null or m.created_at >= v_d_utc)
        limit v_lim) t;
    -- Lotes de leilao seguidos.
    when 'leilao_seguindo' then
      select count(*) into v_out from (
        select 1 from public.leilao_seguidores s
        where s.user_id = p_user and (p_desde is null or s.created_at >= p_desde) limit v_lim) t;
    -- Cartas adicionadas pelo Scan (user_cards.origem so existe desde 22/09/2026).
    when 'colecao_scan' then
      select count(*) into v_out from (
        select 1 from public.user_cards uc
        where uc.user_id = p_user and uc.origem = 'scan' and (p_desde is null or uc.created_at >= v_d_utc)
        limit v_lim) t;
    -- 'ficha_criador', 'bio_criador' e 'aceite': tabelas da Fatia 2. Ate la, zero.
    else
      v_out := 0;
  end case;
  return coalesce(v_out, 0);
end;
$function$;
