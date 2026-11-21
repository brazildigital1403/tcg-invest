-- Album do Club, Fase 2, Fatia 1: missao como dado.
--
-- Solta o teto de 12 cartas por edicao, descreve a regra de cada missao por
-- dado (tipo + parametro, em lista fechada) e da ao Admin como criar edicao e
-- carta. A edicao 1 NAO muda de comportamento: fica com motor = 1 e continua
-- conferida por club_missao_cumprida (a funcao da Fase 1), que segue intacta,
-- assim como club_colecao_minha, virar carta, pedir o set e o lote da
-- organizacao.
--
-- Nada aqui executa SQL montado em tempo de execucao: a "fonte" de um sinal
-- escolhe um ramo fixo de CASE e os numeros entram como variaveis.
--
-- O que fica para a Fatia 2 (portfolio): os tipos 'conteudos' e
-- 'conteudos_sequencia' e as fontes 'ficha_criador', 'bio_criador' e 'aceite'
-- ja sao aceitos na validacao, mas ainda nao tem tabela para ler: a
-- conferencia devolve falso para eles ate la.
--
-- ROLLBACK (so enquanto nao existir carta com numero > 12 nem missao fora da
-- lista antiga):
--   drop function public.club_colecao_painel_v2_interno(text);
--   drop function public.club_colecao_estado_v2_interno(uuid, text, uuid, jsonb);
--   drop function public.club_carta_apagar_interno(uuid, smallint, uuid);
--   drop function public.club_carta_regra_salvar_interno(uuid, smallint, jsonb, uuid);
--   drop function public.club_carta_criar_interno(uuid, jsonb, uuid);
--   drop function public.club_colecao_criar_interno(jsonb, uuid);
--   drop function public.club_colecao_minha_v2(text);
--   drop function public.club_album_conferir_interno(uuid, uuid);
--   drop function public.club_missao_cumprida_v2(uuid, uuid);
--   drop function public.club_sinal_conta(uuid, text, integer, text, timestamptz, integer);
--   drop function public.club_missao_campos_valida(jsonb);
--   drop function public.club_regra_valida(text, jsonb, boolean);
--   alter table public.club_cartas
--     drop constraint club_cartas_regra_modo_check, drop constraint club_cartas_regra_param_check,
--     drop constraint club_cartas_regra_tipo_check, drop constraint club_cartas_missao_check,
--     drop constraint club_cartas_numero_check,
--     drop column regra_tipo, drop column regra_param, drop column regra_desde_abertura,
--     drop column missao_titulo, drop column missao_icone, drop column missao_botao, drop column missao_href;
--   alter table public.club_cartas
--     add constraint club_cartas_numero_check check (numero between 1 and 12),
--     add constraint club_cartas_missao_check check (missao in ('entrei','data','arroba','colecao','opiniao','indicacao','graduada','plateia','palco','trend','ideia','completo')),
--     add constraint club_cartas_check check (modo = 'manual' or missao in ('entrei','data','arroba','colecao','opiniao','indicacao','graduada','completo'));
--   drop index public.club_colecoes_uma_base_por_ciclo;
--   alter table public.club_colecoes drop column papel, drop column trilha, drop column ciclo, drop column total_previsto, drop column motor;

-- ── Edicao: papel, trilha, ciclo, total previsto e motor ─────────────────────

alter table public.club_colecoes
  add column papel text not null default 'capitulo' check (papel in ('base', 'capitulo', 'especial')),
  add column trilha text check (trilha in ('creator', 'bynx', 'club')),
  add column ciclo smallint not null default 1 check (ciclo >= 1),
  add column total_previsto smallint check (total_previsto between 1 and 99),
  -- 1 = regra da Fase 1 (club_missao_cumprida); 2 = regra por dado.
  add column motor smallint not null default 2 check (motor in (1, 2));

update public.club_colecoes set papel = 'base', total_previsto = 12, motor = 1 where slug = 'edicao-1';

create unique index club_colecoes_uma_base_por_ciclo on public.club_colecoes (ciclo) where papel = 'base';

-- ── Carta: numero ate 99, chave de missao livre, regra e rosto da missao ─────

-- Os tres CHECKs que cravam as 12 cartas nasceram sem nome proprio. Derruba
-- pela definicao, para nao depender do nome gerado em cada projeto.
do $$
declare v record;
begin
  for v in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.club_cartas'::regclass and c.contype = 'c'
      and (pg_get_constraintdef(c.oid) like '%numero <= 12%'
        or pg_get_constraintdef(c.oid) like '%missao = ANY%')
  loop
    execute format('alter table public.club_cartas drop constraint %I', v.conname);
  end loop;
end $$;

alter table public.club_cartas
  add constraint club_cartas_numero_check check (numero between 1 and 99),
  add constraint club_cartas_missao_check check (missao ~ '^[a-z0-9_]{2,40}$'),
  add column regra_tipo text,
  add column regra_param jsonb not null default '{}'::jsonb,
  add column regra_desde_abertura boolean not null default false,
  add column missao_titulo text check (char_length(missao_titulo) between 2 and 30),
  add column missao_icone text check (missao_icone ~ '^[a-z0-9]{1,20}$'),
  add column missao_botao text check (char_length(missao_botao) between 2 and 24),
  add column missao_href text check (missao_href ~ '^/[a-z0-9/_-]*(\?[a-z0-9=&_-]*)?$' and char_length(missao_href) <= 120);

-- As 12 cartas da edicao 1 ganham a regra e o rosto da missao que hoje moram
-- no codigo (src/lib/pcc/album.ts). So para o dado ficar completo: a edicao 1
-- segue conferida pela funcao antiga.
update public.club_cartas k
set regra_tipo = v.tipo, regra_param = v.param::jsonb,
    missao_titulo = v.titulo, missao_icone = v.icone, missao_botao = v.botao, missao_href = v.href
from (values
  ('entrei',    'sinal', '{"fonte":"membro","minimo":1}',           'Entrar',            'star',    null,            null),
  ('data',      'sinal', '{"fonte":"aniversario","minimo":1}',      'Aniversário',       'cal',     'Informar data', '/pokecreatorsclub/aniversariantes'),
  ('arroba',    'sinal', '{"fonte":"instagram","minimo":1}',        'Meu @',             'insta',   'Informar @',    '/pokecreatorsclub?entrar=1'),
  ('colecao',   'sinal', '{"fonte":"colecao_cartas","minimo":10}',  'Minha coleção',     'colecao', 'Abrir coleção', '/minha-colecao'),
  ('opiniao',   'sinal', '{"fonte":"voto","minimo":1}',             'Enquete',           'enquete', 'Ver avisos',    '/pokecreatorsclub/avisos'),
  ('indicacao', 'sinal', '{"fonte":"indicacao","minimo":1}',        'Traga alguém',      'share',   'Indicar alguém','/indique-e-ganhe'),
  ('graduada',  'sinal', '{"fonte":"colecao_graduada","minimo":1}', 'Primeira graduada', 'trophy',  'Abrir coleção', '/minha-colecao'),
  ('plateia',   'manual', '{}',                                     'Na plateia',        'users',   'Ver agenda',    '/pokecreatorsclub/agenda'),
  ('palco',     'manual', '{}',                                     'No palco',          'mic',     'Ver agenda',    '/pokecreatorsclub/agenda'),
  ('trend',     'manual', '{}',                                     'Na Trend',          'trend',   'Ver as trends', '/pokecreatorsclub'),
  ('ideia',     'manual', '{}',                                     'Minha ideia',       'chat',    null,            null),
  ('completo',  'cartas_da_edicao', '{"chaves":["entrei","data","arroba","colecao","opiniao"],"minimo":5}', 'Surpresa', 'spark', null, null)
) as v(missao, tipo, param, titulo, icone, botao, href)
where k.missao = v.missao
  and k.colecao_id = (select c.id from public.club_colecoes c where c.slug = 'edicao-1');

alter table public.club_cartas
  add constraint club_cartas_regra_tipo_check check (regra_tipo in ('manual', 'sinal', 'cartas_da_edicao', 'conteudos', 'conteudos_sequencia')),
  add constraint club_cartas_regra_param_check check (jsonb_typeof(regra_param) = 'object'),
  -- Manual e quem a organizacao concede; automatica tem de ter regra.
  add constraint club_cartas_regra_modo_check check ((modo = 'manual') = (regra_tipo is null or regra_tipo = 'manual'));

-- ── Validacao: a regra e o rosto da missao ───────────────────────────────────

-- Recusa regra fora da lista fechada. Nenhum valor daqui vira comando: fonte
-- escolhe um ramo de CASE em club_sinal_conta. Sem acesso para ninguem.
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
    'ficha_criador', 'bio_criador', 'aceite'];
  -- Fontes que usam o limiar proprio 'n' (cartas na pasta, cartas do set, tamanho da meta).
  c_com_n  constant text[] := array['colecao_set', 'meta_concluida', 'pasta', 'pasta_publica'];
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

  else
    raise exception 'regra_invalida' using detail = 'tipo';
  end if;
end;
$$;
revoke all on function public.club_regra_valida(text, jsonb, boolean) from public, anon, authenticated;

-- O rosto da missao no album: titulo curto, icone (da lista do Club), texto do
-- botao e para onde ele leva (so caminho interno). Devolve os quatro campos
-- limpos. Sem acesso para ninguem.
create or replace function public.club_missao_campos_valida(p jsonb)
returns jsonb
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  v_titulo text := public.club_sem_emoji(p->>'missao_titulo');
  v_icone  text := nullif(btrim(coalesce(p->>'missao_icone', '')), '');
  v_botao  text := public.club_sem_emoji(p->>'missao_botao');
  v_href   text := nullif(btrim(coalesce(p->>'missao_href', '')), '');
  -- Os icones de src/app/pokecreatorsclub/amigo-secreto/estilo.tsx. Icone novo e codigo.
  c_icones constant text[] := array[
    'menu', 'user', 'x', 'chev', 'down', 'check', 'lock', 'gift', 'cal', 'clock', 'box', 'eye', 'copy', 'ext', 'send',
    'search', 'star', 'users', 'alert', 'truck', 'video', 'trophy', 'pin', 'spark', 'share', 'plus', 'trash', 'megafone',
    'loja', 'sacola', 'livro', 'tachinha', 'enquete', 'link', 'mic', 'insta', 'colecao', 'trend', 'chat'];
begin
  if v_titulo is not null and char_length(v_titulo) not between 2 and 30 then raise exception 'missao_titulo_invalido'; end if;
  if v_icone is not null and not (v_icone = any (c_icones)) then raise exception 'missao_icone_invalido'; end if;
  if v_botao is not null and char_length(v_botao) not between 2 and 24 then raise exception 'missao_botao_invalido'; end if;
  if v_href is not null and (v_href !~ '^/[a-z0-9/_-]*(\?[a-z0-9=&_-]*)?$' or char_length(v_href) > 120 or v_href like '//%') then
    raise exception 'missao_href_invalido';
  end if;
  -- Botao e destino andam juntos.
  if (v_botao is null) <> (v_href is null) then raise exception 'missao_botao_invalido'; end if;
  return jsonb_build_object('missao_titulo', v_titulo, 'missao_icone', v_icone, 'missao_botao', v_botao, 'missao_href', v_href);
end;
$$;
revoke all on function public.club_missao_campos_valida(jsonb) from public, anon, authenticated;

-- ── Catalogo de fontes do tipo 'sinal' ───────────────────────────────────────

-- Conta, ate p_limite, as ocorrencias da pessoa na fonte. Cada ramo e uma
-- busca por indice em tabela pequena por user_id; nenhum encosta no catalogo
-- de cartas. p_desde, quando vem, so conta o que aconteceu a partir dali.
-- p_n e o limiar proprio de algumas fontes (cartas na pasta, cartas do set,
-- tamanho da meta). Fonte nova e migration. Sem acesso para ninguem.
create or replace function public.club_sinal_conta(
  p_user uuid, p_fonte text, p_n integer, p_ref text, p_desde timestamptz, p_limite integer
)
returns integer
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
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
    -- 'ficha_criador', 'bio_criador' e 'aceite': tabelas da Fatia 2. Ate la, zero.
    else
      v_out := 0;
  end case;
  return coalesce(v_out, 0);
end;
$$;
revoke all on function public.club_sinal_conta(uuid, text, integer, text, timestamptz, integer) from public, anon, authenticated;

-- ── Conferencia por dado ─────────────────────────────────────────────────────

-- Le a regra da carta e decide. Nao e "stable": 'cartas_da_edicao' le os
-- desbloqueios que a conferencia acabou de gravar. "So vale depois da
-- abertura" usa abre_em da edicao; em rascunho (sem data) nada conta ainda.
-- Sem acesso para ninguem.
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
begin
  select * into v_k from public.club_cartas k where k.id = p_carta;
  if not found or v_k.regra_tipo is null then return false; end if;
  v_min := greatest(1, coalesce(nullif(v_k.regra_param->>'minimo', '')::integer, 1));

  if v_k.regra_tipo = 'sinal' then
    if v_k.regra_desde_abertura then
      select c.abre_em into v_abre from public.club_colecoes c where c.id = v_k.colecao_id;
      v_desde := coalesce(v_abre, now());
    end if;
    return public.club_sinal_conta(
      p_user, v_k.regra_param->>'fonte', nullif(v_k.regra_param->>'n', '')::integer, v_k.regra_param->>'ref', v_desde, v_min
    ) >= v_min;

  elsif v_k.regra_tipo = 'cartas_da_edicao' then
    select count(*) into v_tem
    from public.club_desbloqueios d
    join public.club_cartas c on c.id = d.carta_id
    where d.user_id = p_user and d.revogado_em is null and c.colecao_id = v_k.colecao_id and c.id <> v_k.id
      and (coalesce((v_k.regra_param->>'todas')::boolean, false)
        or c.missao in (select jsonb_array_elements_text(coalesce(v_k.regra_param->'chaves', '[]'::jsonb))));
    return v_tem >= v_min;
  end if;

  -- 'manual' nao se confere. 'conteudos' e 'conteudos_sequencia' chegam com o portfolio (Fatia 2).
  return false;
end;
$$;
revoke all on function public.club_missao_cumprida_v2(uuid, uuid) from public, anon, authenticated;

-- O laco de conferencia que na Fase 1 mora dentro de club_colecao_minha: para
-- cada carta automatica ainda sem linha (nem revogada: revogar e definitivo),
-- pergunta se a missao foi cumprida e grava. As derivadas por ultimo. O motor
-- da edicao escolhe a regra: 1 = a da Fase 1, 2 = por dado. Sem acesso para ninguem.
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
    where c.colecao_id = p_colecao and c.modo = 'auto'
      and not exists (select 1 from public.club_desbloqueios d where d.user_id = p_user and d.carta_id = c.id)
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
      on conflict (user_id, carta_id) do nothing;
    end if;
  end loop;
end;
$$;
revoke all on function public.club_album_conferir_interno(uuid, uuid) from public, anon, authenticated;

-- ── Membro: o album, agora com mais de uma edicao ────────────────────────────

-- Igual a club_colecao_minha no que devolve, mais o rosto da missao em cada
-- carta e papel, trilha, ciclo e total previsto na edicao. Sem p_slug devolve
-- a Base do ciclo mais novo (e nao "a publicada mais nova"): e o que mantem a
-- casa e a cerimonia de entrada na Base quando um capitulo abrir.
create or replace function public.club_colecao_minha_v2(p_slug text default null)
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
  where (case when p_slug is null then c.papel = 'base' else c.slug = p_slug end)
    and (v_org or (c.status in ('publicada', 'encerrada') and c.abre_em <= v_agora))
  order by (c.status = 'publicada') desc, c.ciclo desc, c.edicao desc
  limit 1;
  if not found then
    return jsonb_build_object('edicao', null, 'papeis', public.club_meus_papeis());
  end if;

  v_avalia := v_c.status in ('rascunho', 'publicada')
          and (v_c.fecha_em is null or v_agora < v_c.fecha_em)
          and (v_c.status = 'rascunho' or v_c.abre_em <= v_agora or v_org);

  if v_avalia then
    perform public.club_album_conferir_interno(v_uid, v_c.id);
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
      || case when not (c.secreta and d.carta_id is null) then jsonb_build_object(
           'missao', c.missao, 'missao_titulo', c.missao_titulo, 'missao_icone', c.missao_icone,
           'missao_botao', c.missao_botao, 'missao_href', c.missao_href
         ) else '{}'::jsonb end
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
      'previa', (v_c.status = 'rascunho' or v_c.abre_em > v_agora),
      'papel', v_c.papel, 'trilha', v_c.trilha, 'ciclo', v_c.ciclo, 'total_previsto', v_c.total_previsto
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
revoke all on function public.club_colecao_minha_v2(text) from public, anon, authenticated;
grant execute on function public.club_colecao_minha_v2(text) to authenticated;

-- ── Admin: criar edicao e carta, regra, apagar ───────────────────────────────

-- Cria uma edicao em rascunho. O numero da edicao e o maior + 1 e o motor e
-- sempre 2. So o servidor chama (rota do Admin, service role).
create or replace function public.club_colecao_criar_interno(p jsonb, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_slug     text := nullif(btrim(coalesce(p->>'slug', '')), '');
  v_titulo   text := public.club_sem_emoji(p->>'titulo');
  v_papel    text := coalesce(nullif(btrim(coalesce(p->>'papel', '')), ''), 'capitulo');
  v_trilha   text := nullif(btrim(coalesce(p->>'trilha', '')), '');
  v_total    integer;
  v_tiragem  integer;
  v_ciclo    integer;
  v_c        public.club_colecoes;
  v_con      text;
begin
  if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_slug) > 60 then raise exception 'slug_invalido'; end if;
  if v_titulo is null or char_length(v_titulo) not between 3 and 80 then raise exception 'titulo_invalido'; end if;
  if v_papel not in ('base', 'capitulo', 'especial') then raise exception 'papel_invalido'; end if;
  if v_trilha is not null and v_trilha not in ('creator', 'bynx', 'club') then raise exception 'trilha_invalida'; end if;
  if coalesce(p->>'total_previsto', '') !~ '^[0-9]{1,2}$' or (p->>'total_previsto')::integer not between 1 and 99 then raise exception 'total_invalido'; end if;
  v_total := (p->>'total_previsto')::integer;
  if p ? 'tiragem_fisica' and nullif(p->>'tiragem_fisica', '') is not null then
    if (p->>'tiragem_fisica') !~ '^[0-9]{1,6}$' then raise exception 'tiragem_invalida'; end if;
    v_tiragem := (p->>'tiragem_fisica')::integer;
  end if;
  if p ? 'ciclo' and nullif(p->>'ciclo', '') is not null then
    if (p->>'ciclo') !~ '^[0-9]{1,3}$' or (p->>'ciclo')::integer < 1 then raise exception 'ciclo_invalido'; end if;
    v_ciclo := (p->>'ciclo')::integer;
  else
    select coalesce(max(c.ciclo), 1) into v_ciclo from public.club_colecoes c;
  end if;

  begin
    insert into public.club_colecoes (slug, edicao, titulo, status, tiragem_fisica, papel, trilha, ciclo, total_previsto, motor)
    select v_slug, coalesce(max(c.edicao), 0) + 1, v_titulo, 'rascunho', v_tiragem, v_papel, v_trilha, v_ciclo, v_total, 2
    from public.club_colecoes c
    returning * into v_c;
  exception when unique_violation then
    get stacked diagnostics v_con = constraint_name;
    if v_con = 'club_colecoes_uma_base_por_ciclo' then raise exception 'base_repetida'; end if;
    if v_con = 'club_colecoes_slug_key' then raise exception 'slug_repetido'; end if;
    raise exception 'edicao_repetida';
  end;

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (p_autor, case when p_autor is null then 'admin' else 'colecao' end, 'colecao_criar', v_c.slug,
          jsonb_build_object('edicao', v_c.edicao, 'papel', v_c.papel, 'trilha', v_c.trilha, 'total_previsto', v_c.total_previsto));

  return jsonb_build_object('id', v_c.id, 'slug', v_c.slug, 'edicao', v_c.edicao, 'titulo', v_c.titulo, 'status', v_c.status,
    'papel', v_c.papel, 'trilha', v_c.trilha, 'ciclo', v_c.ciclo, 'total_previsto', v_c.total_previsto, 'tiragem_fisica', v_c.tiragem_fisica);
end;
$$;
revoke all on function public.club_colecao_criar_interno(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.club_colecao_criar_interno(jsonb, uuid) to service_role;

-- Cria uma carta numa edicao em rascunho, com a regra da missao. O modo sai
-- da regra (manual ou automatica). O rosto (nome, arte, texto) continua em
-- club_carta_salvar_interno. Recusa edicao do motor antigo, edicao cheia,
-- numero ou chave de missao repetidos.
create or replace function public.club_carta_criar_interno(p_colecao uuid, p jsonb, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c       public.club_colecoes;
  v_num     integer;
  v_missao  text := nullif(btrim(coalesce(p->>'missao', '')), '');
  v_tipo    text := nullif(btrim(coalesce(p->>'regra_tipo', '')), '');
  v_param   jsonb := coalesce(p->'regra_param', '{}'::jsonb);
  v_desde   boolean := false;
  v_como    text := public.club_sem_emoji(p->>'como_ganhar');
  v_secreta boolean := false;
  v_m       jsonb;
  v_total   integer;
  v_k       public.club_cartas;
  v_con     text;
begin
  select * into v_c from public.club_colecoes c where c.id = p_colecao for update;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  if v_c.motor <> 2 then raise exception 'edicao_motor_antigo'; end if;
  if v_c.status <> 'rascunho' then raise exception 'edicao_publicada'; end if;

  if coalesce(p->>'numero', '') !~ '^[0-9]{1,2}$' or (p->>'numero')::integer not between 1 and 99 then raise exception 'numero_invalido'; end if;
  v_num := (p->>'numero')::integer;
  if v_missao is null or v_missao !~ '^[a-z0-9_]{2,40}$' then raise exception 'missao_invalida'; end if;
  if v_como is null or char_length(v_como) not between 3 and 80 then raise exception 'como_ganhar_invalido'; end if;
  if p ? 'regra_desde_abertura' then
    if jsonb_typeof(p->'regra_desde_abertura') <> 'boolean' then raise exception 'regra_invalida' using detail = 'desde'; end if;
    v_desde := (p->>'regra_desde_abertura')::boolean;
  end if;
  if p ? 'secreta' then
    if jsonb_typeof(p->'secreta') <> 'boolean' then raise exception 'secreta_invalida'; end if;
    v_secreta := (p->>'secreta')::boolean;
  end if;
  perform public.club_regra_valida(v_tipo, v_param, v_desde);
  v_m := public.club_missao_campos_valida(p);

  select count(*) into v_total from public.club_cartas k where k.colecao_id = v_c.id;
  if v_c.total_previsto is not null and v_total >= v_c.total_previsto then raise exception 'edicao_cheia'; end if;

  begin
    insert into public.club_cartas (colecao_id, numero, missao, modo, como_ganhar, secreta,
      regra_tipo, regra_param, regra_desde_abertura, missao_titulo, missao_icone, missao_botao, missao_href)
    values (v_c.id, v_num, v_missao, case when v_tipo = 'manual' then 'manual' else 'auto' end, v_como, v_secreta,
      v_tipo, v_param, v_desde, v_m->>'missao_titulo', v_m->>'missao_icone', v_m->>'missao_botao', v_m->>'missao_href')
    returning * into v_k;
  exception when unique_violation then
    get stacked diagnostics v_con = constraint_name;
    if v_con = 'club_cartas_colecao_id_numero_key' then raise exception 'numero_repetido'; end if;
    raise exception 'missao_repetida';
  end;

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (p_autor, case when p_autor is null then 'admin' else 'colecao' end, 'carta_criar', v_c.slug || '#' || v_num,
          jsonb_build_object('numero', v_num, 'missao', v_missao, 'regra_tipo', v_tipo, 'regra_param', v_param, 'desde', v_desde));

  return jsonb_build_object('numero', v_k.numero, 'missao', v_k.missao, 'modo', v_k.modo);
end;
$$;
revoke all on function public.club_carta_criar_interno(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.club_carta_criar_interno(uuid, jsonb, uuid) to service_role;

-- Muda a regra e o rosto da missao de uma carta, so com a edicao em rascunho e
-- so em edicao do motor novo (na edicao 1 a regra e a da Fase 1: mudar o dado
-- nao mudaria nada e enganaria quem le). So mexe no que veio em p.
create or replace function public.club_carta_regra_salvar_interno(p_colecao uuid, p_numero smallint, p jsonb, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c      public.club_colecoes;
  v_k      public.club_cartas;
  v_tipo   text;
  v_param  jsonb;
  v_desde  boolean;
  v_como   text;
  v_m      jsonb;
begin
  select * into v_c from public.club_colecoes c where c.id = p_colecao for share;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  if v_c.motor <> 2 then raise exception 'edicao_motor_antigo'; end if;
  if v_c.status <> 'rascunho' then raise exception 'edicao_publicada'; end if;
  select * into v_k from public.club_cartas k where k.colecao_id = p_colecao and k.numero = p_numero for update;
  if not found then raise exception 'carta_nao_encontrada'; end if;

  v_tipo := case when p ? 'regra_tipo' then nullif(btrim(coalesce(p->>'regra_tipo', '')), '') else v_k.regra_tipo end;
  v_param := case when p ? 'regra_param' then coalesce(p->'regra_param', '{}'::jsonb) else v_k.regra_param end;
  if p ? 'regra_desde_abertura' then
    if jsonb_typeof(p->'regra_desde_abertura') <> 'boolean' then raise exception 'regra_invalida' using detail = 'desde'; end if;
    v_desde := (p->>'regra_desde_abertura')::boolean;
  else
    v_desde := v_k.regra_desde_abertura;
  end if;
  perform public.club_regra_valida(v_tipo, v_param, v_desde);

  v_como := case when p ? 'como_ganhar' then public.club_sem_emoji(p->>'como_ganhar') else v_k.como_ganhar end;
  if v_como is null or char_length(v_como) not between 3 and 80 then raise exception 'como_ganhar_invalido'; end if;

  v_m := public.club_missao_campos_valida(jsonb_build_object(
    'missao_titulo', case when p ? 'missao_titulo' then p->>'missao_titulo' else v_k.missao_titulo end,
    'missao_icone',  case when p ? 'missao_icone'  then p->>'missao_icone'  else v_k.missao_icone end,
    'missao_botao',  case when p ? 'missao_botao'  then p->>'missao_botao'  else v_k.missao_botao end,
    'missao_href',   case when p ? 'missao_href'   then p->>'missao_href'   else v_k.missao_href end));

  update public.club_cartas k
  set regra_tipo = v_tipo, regra_param = v_param, regra_desde_abertura = v_desde,
      modo = case when v_tipo = 'manual' then 'manual' else 'auto' end, como_ganhar = v_como,
      missao_titulo = v_m->>'missao_titulo', missao_icone = v_m->>'missao_icone',
      missao_botao = v_m->>'missao_botao', missao_href = v_m->>'missao_href', updated_at = now()
  where k.id = v_k.id;

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (p_autor, case when p_autor is null then 'admin' else 'colecao' end, 'carta_regra', v_c.slug || '#' || p_numero,
          jsonb_build_object('numero', p_numero, 'regra_tipo', v_tipo, 'regra_param', v_param, 'desde', v_desde));

  return jsonb_build_object('numero', p_numero, 'regra_tipo', v_tipo, 'regra_param', v_param, 'regra_desde_abertura', v_desde,
    'modo', case when v_tipo = 'manual' then 'manual' else 'auto' end);
end;
$$;
revoke all on function public.club_carta_regra_salvar_interno(uuid, smallint, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.club_carta_regra_salvar_interno(uuid, smallint, jsonb, uuid) to service_role;

-- Apaga uma carta de edicao em rascunho do motor novo, so se ninguem a tem
-- (nem revogada: a linha de desbloqueio nunca some). Devolve o caminho da arte
-- para quem chamou apagar do bucket.
create or replace function public.club_carta_apagar_interno(p_colecao uuid, p_numero smallint, p_autor uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_c  public.club_colecoes;
  v_k  public.club_cartas;
begin
  select * into v_c from public.club_colecoes c where c.id = p_colecao for update;
  if not found then raise exception 'edicao_nao_encontrada'; end if;
  if v_c.motor <> 2 then raise exception 'edicao_motor_antigo'; end if;
  if v_c.status <> 'rascunho' then raise exception 'edicao_publicada'; end if;
  select * into v_k from public.club_cartas k where k.colecao_id = p_colecao and k.numero = p_numero for update;
  if not found then raise exception 'carta_nao_encontrada'; end if;
  if exists (select 1 from public.club_desbloqueios d where d.carta_id = v_k.id) then raise exception 'carta_com_dono'; end if;

  delete from public.club_cartas k where k.id = v_k.id;

  insert into public.club_organizacao_log (user_id, papel, acao, alvo, detalhe)
  values (p_autor, case when p_autor is null then 'admin' else 'colecao' end, 'carta_apagar', v_c.slug || '#' || p_numero,
          jsonb_build_object('numero', p_numero, 'missao', v_k.missao));

  return jsonb_build_object('numero', p_numero, 'arte_anterior', v_k.arte_path);
end;
$$;
revoke all on function public.club_carta_apagar_interno(uuid, smallint, uuid) from public, anon, authenticated;
grant execute on function public.club_carta_apagar_interno(uuid, smallint, uuid) to service_role;

-- Estado da edicao, versao que aceita qualquer total. 'publicar' exige o total
-- previsto de cartas, todas com rosto completo (nome, tipo, raridade, texto e
-- arte), titulo de missao e, no motor novo, regra valida. O resto e igual a
-- club_colecao_estado_interno.
create or replace function public.club_colecao_estado_v2_interno(p_colecao uuid, p_acao text, p_autor uuid, p_dados jsonb default null)
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
  v_k       record;
begin
  select * into v_c from public.club_colecoes c where c.id = p_colecao for update;
  if not found then raise exception 'edicao_nao_encontrada'; end if;

  if p_acao = 'publicar' then
    if v_c.status <> 'rascunho' then raise exception 'estado_invalido'; end if;
    select count(*) into v_total from public.club_cartas k where k.colecao_id = v_c.id;
    if v_c.total_previsto is null or v_total <> v_c.total_previsto then
      raise exception 'cartas_incompletas' using detail = 'cartas: ' || v_total || ' de ' || coalesce(v_c.total_previsto::text, '?');
    end if;
    select array_agg(k.numero order by k.numero) into v_falta
    from public.club_cartas k
    where k.colecao_id = v_c.id
      and (k.nome is null or k.tipo is null or k.raridade is null or k.texto_efeito is null or k.arte_path is null
        or k.missao_titulo is null);
    if v_falta is not null then raise exception 'cartas_incompletas' using detail = array_to_string(v_falta, ','); end if;

    if v_c.motor = 2 then
      for v_k in select k.numero, k.regra_tipo, k.regra_param, k.regra_desde_abertura
                 from public.club_cartas k where k.colecao_id = v_c.id order by k.numero loop
        begin
          perform public.club_regra_valida(v_k.regra_tipo, v_k.regra_param, v_k.regra_desde_abertura);
        exception when others then
          raise exception 'regra_invalida' using detail = v_k.numero::text;
        end;
      end loop;
    end if;

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
revoke all on function public.club_colecao_estado_v2_interno(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.club_colecao_estado_v2_interno(uuid, text, uuid, jsonb) to service_role;

-- Painel do Admin, versao com as colunas novas da edicao e de cada carta. O
-- "faltando" segue o criterio de publicar da v2 (inclui o titulo da missao).
create or replace function public.club_colecao_painel_v2_interno(p_slug text default null)
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
  select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'edicao', c.edicao, 'titulo', c.titulo, 'status', c.status,
      'papel', c.papel, 'trilha', c.trilha) order by c.edicao desc), '[]'::jsonb)
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
      'regra_tipo', k.regra_tipo, 'regra_param', k.regra_param, 'regra_desde_abertura', k.regra_desde_abertura,
      'missao_titulo', k.missao_titulo, 'missao_icone', k.missao_icone, 'missao_botao', k.missao_botao, 'missao_href', k.missao_href,
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

  select coalesce(jsonb_agg(jsonb_build_object('numero', k.numero, 'campos', to_jsonb(f.campos)) order by k.numero), '[]'::jsonb)
  into v_falta
  from public.club_cartas k
  cross join lateral (
    select array_remove(array[
      case when k.nome is null then 'nome' end,
      case when k.tipo is null then 'tipo' end,
      case when k.raridade is null then 'raridade' end,
      case when k.texto_efeito is null then 'texto' end,
      case when k.arte_path is null then 'arte' end,
      case when k.missao_titulo is null then 'missao' end
    ], null) as campos
  ) f
  where k.colecao_id = v_c.id and cardinality(f.campos) > 0;

  return jsonb_build_object(
    'edicoes', v_edicoes,
    'edicao', jsonb_build_object(
      'id', v_c.id, 'slug', v_c.slug, 'edicao', v_c.edicao, 'titulo', v_c.titulo, 'status', v_c.status, 'fase', v_fase,
      'abre_em', v_c.abre_em, 'fecha_em', v_c.fecha_em, 'pedir_set_ate', v_c.pedir_set_ate, 'tiragem_fisica', v_c.tiragem_fisica,
      'papel', v_c.papel, 'trilha', v_c.trilha, 'ciclo', v_c.ciclo, 'total_previsto', v_c.total_previsto, 'motor', v_c.motor,
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
revoke all on function public.club_colecao_painel_v2_interno(text) from public, anon, authenticated;
grant execute on function public.club_colecao_painel_v2_interno(text) to service_role;
