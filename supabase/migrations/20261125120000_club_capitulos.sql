-- Club / Album: regra 'capitulos' (plano de 25/11/2026). Derivada do album inteiro: "tenha N capitulos
-- fechados", com filtro opcional de trilha. Serve as secretas Criador Completo ({"minimo":3,"trilha":"creator"})
-- e Album do Ano ({"minimo":5}). 'cartas_da_edicao' so olha a propria edicao; esta olha as outras.
--
-- Capitulo fechado: edicao do mesmo ciclo, papel base ou capitulo, status publicada ou encerrada, com ao menos
-- total_previsto cartas cadastradas e todas elas na mao da pessoa (revogada nao conta). Especial nao conta.
-- So tabelas pequenas: club_cartas (~100 linhas) e club_desbloqueios (chave user_id, carta_id). Sem varredura grande.
--
-- Rollback: reaplicar club_regra_valida (20261125110000) e club_missao_cumprida_v2 (20261122120000) e
--   alter table public.club_cartas drop constraint club_cartas_regra_tipo_check,
--     add constraint club_cartas_regra_tipo_check check (regra_tipo in ('manual','sinal','cartas_da_edicao','conteudos','conteudos_sequencia'));
-- (so e seguro se nenhuma carta usar 'capitulos'.)

alter table public.club_cartas drop constraint club_cartas_regra_tipo_check;
alter table public.club_cartas
  add constraint club_cartas_regra_tipo_check
  check (regra_tipo in ('manual', 'sinal', 'cartas_da_edicao', 'conteudos', 'conteudos_sequencia', 'capitulos'));

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
    'link_visitas', 'indicacao_cadastro', 'indicado_cartas'];
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
revoke all on function public.club_regra_valida(text, jsonb, boolean) from public, anon, authenticated;

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
    -- formatos ou redes diferentes em vez de linhas.
    select case v_k.regra_param->>'distintos_por'
        when 'formato' then count(distinct c.formato)
        when 'rede' then count(distinct c.rede)
        else count(*) end
    into v_tem
    from public.club_conteudos c
    where c.user_id = p_user and c.status = 'ativo'
      and (v_desde is null or c.created_at >= v_desde)
      and (v_k.regra_param->>'formato' is null or c.formato = v_k.regra_param->>'formato')
      and (v_k.regra_param->>'tema' is null or c.tema = v_k.regra_param->>'tema')
      and (v_k.regra_param->>'rede' is null or c.rede = v_k.regra_param->>'rede');
    return v_tem >= v_min;

  elsif v_k.regra_tipo = 'conteudos_sequencia' then
    return public.club_conteudos_semanas(p_user, v_desde) >= greatest(2, coalesce(nullif(v_k.regra_param->>'semanas', '')::integer, 4));
  end if;

  return false;
end;
$$;
revoke all on function public.club_missao_cumprida_v2(uuid, uuid) from public, anon, authenticated;
