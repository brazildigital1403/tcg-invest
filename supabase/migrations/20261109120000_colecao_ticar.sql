-- ============================================================================
-- Ticar cartas (busca e set): contratos do banco (09/11/2026, ESPEC-BUILD)
-- ============================================================================
-- POR QUE: a colecao ganha uma grade de tique (modal "Adicionar carta", aba
-- Buscar, e a tela /minha-colecao/por-set/[setId]). A pessoa marca varias
-- cartas e grava tudo de uma vez. Hoje cada caminho de escrita grava uma
-- linha por request pelo navegador e conta o limite do plano no cliente; um
-- lote de 150 cartas seriam 150 requests e 150 contagens. Aqui o lote entra
-- numa transacao so, no servidor, com a mesma regra de limite do trigger
-- (enforce_limite_cartas_colecao) e o mesmo advisory lock por usuario.
--
-- Quatro funcoes, todas security definer com search_path fixo e auth.uid():
--   colecao_set_cartas(p_set_id)        cartas do set + o que o usuario ja tem
--   colecao_meus_sets(p_limite)         sets em que o usuario tem carta
--   colecao_adicionar_lote(p_itens, p_origem)  grava o lote (soma em pilha
--                                       existente, insere carta nova se ha vaga)
--   colecao_desfazer_lote(p_ids, p_somadas)    desfaz o lote de quem chamou
--
-- Nenhuma delas substitui funcao existente. Dependem de objetos que ja estao
-- em producao: a view pokemon_cards (filtra oculto), bynx_valor_carta,
-- cartas_limite_colecao, master_sets.extra_set_ids e o indice de pilha
-- idx_unique_user_card_variante (user_id, pokemon_api_id, variante, idioma).
-- meta_cartas e o trigger enforce_limite_cartas_colecao NAO sao tocados.
--
-- Pilha = linha de user_cards com graduada = false. Carta graduada e item a
-- parte (slab) e fica fora de tenho/pilhas, nas quatro funcoes, pelo mesmo
-- criterio. O limite do plano conta LINHAS (como checkCardLimit e o trigger):
-- somar em pilha existente nao gasta vaga; pilha nova (outra variante ou
-- outro idioma) gasta.
--
-- Erros que sobem como excecao (o cliente le a mensagem): nao_logado,
-- itens_invalidos, set_invalido, usuario_nao_encontrado. Recusa por limite e
-- card_id inexistente NAO sao excecao: voltam em `recusadas` e `ignorados`.
--
-- Rollback (ordem):
--   drop function public.colecao_desfazer_lote(uuid[], jsonb);
--   drop function public.colecao_adicionar_lote(jsonb, text);
--   drop function public.colecao_meus_sets(integer);
--   drop function public.colecao_set_cartas(text);
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Cartas de um set com o que o usuario ja tem
-- ---------------------------------------------------------------------------
-- Molde: meta_cartas (tipo = 'set'). Le pela VIEW pokemon_cards (ja filtra
-- oculto) usando idx_pokemon_cards_set_id; o set principal vem antes dos
-- sets extras do master set, e dentro de cada um a ordem e o numero impresso.
-- Deslogado recebe tudo com tenho = false e pilhas = [] (nada de outro
-- usuario vaza: `minhas` so le user_cards de auth.uid()).

create or replace function public.colecao_set_cartas(p_set_id text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_sets   text[];
  v_set    jsonb;
  v_cartas jsonb;
  v_total  integer;
  v_tenho  integer;
  v_vt     numeric;
  v_vtenho numeric;
begin
  if p_set_id is null or btrim(p_set_id) = '' then raise exception 'set_invalido'; end if;

  -- Set principal + sets extras do master set (ex.: 30c = 30c + 30c-c + 30c-r).
  v_sets := array[p_set_id] || coalesce(
    (select ms.extra_set_ids from public.master_sets ms where ms.set_id = p_set_id),
    '{}'::text[]);

  select jsonb_build_object(
           'id', s.id, 'name', s.name, 'name_pt', s.name_pt, 'series', s.series,
           'total', s.total, 'printed_total', s.printed_total,
           'logo_url', s.logo_url, 'release_date', s.release_date)
    into v_set
    from public.pokemon_sets s
   where s.id = p_set_id;

  -- Set sem linha em pokemon_sets (sets BR catalogados so na carta): monta a
  -- ficha a partir da primeira carta, para a tela nao ficar sem cabecalho.
  if v_set is null then
    select jsonb_build_object(
             'id', p_set_id, 'name', pc.set_name, 'name_pt', pc.set_name_pt, 'series', pc.set_series,
             'total', pc.set_total, 'printed_total', null,
             'logo_url', pc.set_logo, 'release_date', pc.set_release_date)
      into v_set
      from public.pokemon_cards pc
     where pc.set_id = p_set_id
     limit 1;
  end if;

  with alvo as (
    select pc.id, pc.name, pc.number, pc.set_id, pc.set_name,
           pc.image_small, pc.rarity, pc.regiao, pc.idioma,
           pc.preco_min, pc.preco_foil_min, pc.preco_reverse_min, pc.preco_promo_min, pc.preco_pokeball_min,
           public.bynx_valor_carta(pc, 'normal') as valor,
           array_position(v_sets, pc.set_id) as set_rank
      from public.pokemon_cards pc
     where pc.set_id = any(v_sets)
  ),
  -- Todas as pilhas do usuario, agrupadas por carta, pelo indice de user_id
  -- (uma colecao de 5 mil linhas sao 5 mil leituras de indice; o filtro por
  -- set fica no left join, que e hash e nao cresce com o set).
  minhas as (
    select uc.pokemon_api_id,
           jsonb_agg(jsonb_build_object(
             'id', uc.id,
             'variante', coalesce(uc.variante, 'normal'),
             'idioma', uc.idioma,
             'quantity', coalesce(uc.quantity, 1)
           ) order by coalesce(uc.variante, 'normal'), uc.idioma) as pilhas
      from public.user_cards uc
     where v_uid is not null
       and uc.user_id = v_uid
       and uc.graduada = false
       and uc.pokemon_api_id is not null
     group by 1
  ),
  linhas as (
    select a.*, (mi.pokemon_api_id is not null) as tenho, coalesce(mi.pilhas, '[]'::jsonb) as pilhas
      from alvo a
      left join minhas mi on mi.pokemon_api_id = a.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'card_id', l.id, 'nome', l.name, 'numero', l.number,
           'set_id', l.set_id, 'set_name', l.set_name,
           'image_small', l.image_small, 'raridade', l.rarity, 'regiao', l.regiao,
           'idioma_catalogo', l.idioma,
           'valor', l.valor,
           'precos', jsonb_build_object(
             'normal', l.preco_min, 'foil', l.preco_foil_min, 'reverse', l.preco_reverse_min,
             'promo', l.preco_promo_min, 'pokeball', l.preco_pokeball_min),
           'tenho', l.tenho,
           'pilhas', l.pilhas
         ) order by l.set_rank,
                    nullif(substring(l.number from '^[0-9]+'), '')::integer nulls last,
                    l.number), '[]'::jsonb),
         count(*),
         count(*) filter (where l.tenho),
         coalesce(sum(l.valor), 0),
         coalesce(sum(l.valor) filter (where l.tenho), 0)
    into v_cartas, v_total, v_tenho, v_vt, v_vtenho
    from linhas l;

  return jsonb_build_object(
    'set', v_set,
    'total', coalesce(v_total, 0),
    'tenho', coalesce(v_tenho, 0),
    'valor_total', coalesce(v_vt, 0),
    'valor_tenho', coalesce(v_vtenho, 0),
    'cartas', v_cartas
  );
end;
$$;
revoke all on function public.colecao_set_cartas(text) from public, anon, authenticated;
grant execute on function public.colecao_set_cartas(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Sets em que o usuario tem carta, por quantidade de cartas distintas
-- ---------------------------------------------------------------------------
-- user_cards.set_id quando preenchido; quando nulo, resolve pela carta do
-- catalogo (pokemon_cards.set_id via pokemon_api_id). Linha sem set em
-- nenhum dos dois lados fica de fora. Deslogado: [].

create or replace function public.colecao_meus_sets(p_limite integer default 12)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then return '[]'::jsonb; end if;

  with minhas as (
    select coalesce(uc.set_id, pc.set_id) as set_id, uc.pokemon_api_id, uc.set_name
      from public.user_cards uc
      left join public.pokemon_cards pc on uc.set_id is null and pc.id = uc.pokemon_api_id
     where uc.user_id = v_uid
       and uc.graduada = false
       and uc.pokemon_api_id is not null
  ),
  por_set as (
    select m.set_id, count(distinct m.pokemon_api_id) as tenho, max(m.set_name) as set_name_uc
      from minhas m
     where m.set_id is not null
     group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'set_id', x.set_id,
           'name', coalesce(x.name, x.set_name_uc),
           'name_pt', x.name_pt,
           'logo_url', x.logo_url,
           'release_date', x.release_date,
           'total', x.total,
           'tenho', x.tenho
         ) order by x.tenho desc, x.release_date desc nulls last, x.set_id), '[]'::jsonb)
    into v_out
    from (
      select p.set_id, p.tenho, p.set_name_uc, s.name, s.name_pt, s.logo_url, s.release_date, s.total
        from por_set p
        left join public.pokemon_sets s on s.id = p.set_id
       order by p.tenho desc, s.release_date desc nulls last, p.set_id
       limit greatest(1, least(coalesce(p_limite, 12), 100))
    ) x;

  return v_out;
end;
$$;
revoke all on function public.colecao_meus_sets(integer) from public, anon, authenticated;
grant execute on function public.colecao_meus_sets(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Gravar o lote
-- ---------------------------------------------------------------------------
-- p_itens = [ { card_id, variante, idioma, quantity } ], ate 300. Itens com a
-- mesma (card_id, variante, idioma) sao somados antes do laco, entao cada
-- pilha aparece uma vez so no retorno (o desfazer depende disso).
--
-- Ordem das regras: nao_logado; itens_invalidos (formato); limite do plano
-- via cartas_limite_colecao (-1 = sem limite); advisory lock com a MESMA
-- chave do trigger (reentrante na mesma transacao); por item: card_id fora
-- do catalogo -> ignorados; pilha existente -> soma (nao gasta vaga);
-- senao, se count(*) < limite (recontado a cada insert) -> insert; senao ->
-- recusadas. O trigger continua armado: se disparar mesmo assim (corrida com
-- outro caminho de escrita), a excecao P0001 LIMITE_CARTAS vira recusada e
-- nada vaza. unique_violation (pilha nasceu entre o update e o insert) vira
-- soma na pilha que nasceu.

create or replace function public.colecao_adicionar_lote(p_itens jsonb, p_origem text default 'lote')
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_origem    text;
  v_limite    integer;
  v_total     integer;
  v_it        record;
  v_pc        record;
  v_id        uuid;
  v_entraram  jsonb := '[]'::jsonb;
  v_somadas   jsonb := '[]'::jsonb;
  v_recusadas jsonb := '[]'::jsonb;
  v_ignorados jsonb := '[]'::jsonb;
  c_variantes constant text[] := array['normal', 'reverse', 'foil', 'promo', 'pokeball'];
  c_idiomas   constant text[] := array['pt', 'en', 'jp', 'es', 'fr', 'de', 'it', 'cn', 'kr'];
begin
  if v_uid is null then raise exception 'nao_logado'; end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 300 then
    raise exception 'itens_invalidos';
  end if;

  -- Formato de cada item. Ausente ou vazio = padrao (normal / pt / 1);
  -- presente e fora da lista = lote inteiro invalido.
  if exists (
    select 1
      from jsonb_array_elements(p_itens) x
     where jsonb_typeof(x) <> 'object'
        or coalesce(btrim(x->>'card_id'), '') = ''
        or char_length(x->>'card_id') > 120
        or coalesce(nullif(btrim(x->>'variante'), ''), 'normal') <> all(c_variantes)
        or coalesce(nullif(btrim(x->>'idioma'), ''), 'pt') <> all(c_idiomas)
        or coalesce(nullif(btrim(x->>'quantity'), ''), '1') !~ '^[1-9][0-9]{0,3}$'
  ) then
    raise exception 'itens_invalidos';
  end if;

  v_origem := left(coalesce(nullif(btrim(p_origem), ''), 'lote'), 40);

  select public.cartas_limite_colecao(u.plano, coalesce(u.is_pro, false), u.pro_expira_em, u.trial_expires_at)
    into v_limite
    from public.users u
   where u.id = v_uid;
  if v_limite is null then raise exception 'usuario_nao_encontrado'; end if;

  -- Mesma chave do trigger enforce_limite_cartas_colecao: dois lotes do mesmo
  -- usuario nao passam juntos pela contagem.
  perform pg_advisory_xact_lock(hashtextextended('limite_colecao:' || v_uid::text, 0));

  for v_it in
    select n.card_id, n.variante, n.idioma, least(sum(n.quantity), 9999)::integer as quantity
      from (
        select btrim(x->>'card_id') as card_id,
               coalesce(nullif(btrim(x->>'variante'), ''), 'normal') as variante,
               coalesce(nullif(btrim(x->>'idioma'), ''), 'pt') as idioma,
               coalesce(nullif(btrim(x->>'quantity'), ''), '1')::integer as quantity,
               t.ord
          from jsonb_array_elements(p_itens) with ordinality as t(x, ord)
      ) n
     group by n.card_id, n.variante, n.idioma
     order by min(n.ord)
  loop
    select pc.id, pc.name, pc.image_small, pc.set_id, pc.set_name, pc.rarity
      into v_pc
      from public.pokemon_cards pc
     where pc.id = v_it.card_id;
    if not found then
      v_ignorados := v_ignorados || to_jsonb(v_it.card_id);
      continue;
    end if;

    -- Pilha existente: soma e nao gasta vaga.
    update public.user_cards
       set quantity = coalesce(quantity, 0) + v_it.quantity
     where user_id = v_uid
       and pokemon_api_id = v_it.card_id
       and coalesce(variante, 'normal') = v_it.variante
       and idioma = v_it.idioma
       and graduada = false
     returning id into v_id;
    if found then
      v_somadas := v_somadas || jsonb_build_object('id', v_id, 'card_id', v_it.card_id, 'quantity', v_it.quantity);
      continue;
    end if;

    -- Carta nova: precisa de vaga. Reconta a cada insert, sob o lock.
    if v_limite <> -1 then
      select count(*) into v_total from public.user_cards where user_id = v_uid;
      if v_total >= v_limite then
        v_recusadas := v_recusadas || to_jsonb(v_it.card_id);
        continue;
      end if;
    end if;

    begin
      insert into public.user_cards
        (user_id, pokemon_api_id, card_id, card_name, card_image, set_id, set_name, rarity,
         variante, idioma, quantity, graduada, origem, origem_em)
      values
        (v_uid, v_pc.id, v_pc.id, v_pc.name, v_pc.image_small, v_pc.set_id, v_pc.set_name, v_pc.rarity,
         v_it.variante, v_it.idioma, v_it.quantity, false, v_origem, now())
      returning id into v_id;
      v_entraram := v_entraram || jsonb_build_object(
        'id', v_id, 'card_id', v_it.card_id, 'variante', v_it.variante,
        'idioma', v_it.idioma, 'quantity', v_it.quantity);
    exception
      when sqlstate 'P0001' then
        -- Trigger do limite disparou (corrida com outro caminho de escrita).
        if sqlerrm like 'LIMITE_CARTAS%' then
          v_recusadas := v_recusadas || to_jsonb(v_it.card_id);
        else
          raise;
        end if;
      when unique_violation then
        -- A pilha nasceu entre o update e o insert: soma nela.
        update public.user_cards
           set quantity = coalesce(quantity, 0) + v_it.quantity
         where user_id = v_uid
           and pokemon_api_id = v_it.card_id
           and coalesce(variante, 'normal') = v_it.variante
           and idioma = v_it.idioma
           and graduada = false
         returning id into v_id;
        if found then
          v_somadas := v_somadas || jsonb_build_object('id', v_id, 'card_id', v_it.card_id, 'quantity', v_it.quantity);
        else
          v_recusadas := v_recusadas || to_jsonb(v_it.card_id);
        end if;
    end;
  end loop;

  select count(*) into v_total from public.user_cards where user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'entraram', v_entraram,
    'somadas', v_somadas,
    'recusadas', v_recusadas,
    'ignorados', v_ignorados,
    'limite', v_limite,
    'total_agora', v_total
  );
end;
$$;
revoke all on function public.colecao_adicionar_lote(jsonb, text) from public, anon, authenticated;
grant execute on function public.colecao_adicionar_lote(jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Desfazer o lote (toast "Desfazer")
-- ---------------------------------------------------------------------------
-- Apaga so linhas do proprio usuario que estao em p_ids (as que `entraram`)
-- e devolve a quantidade das `somadas` (p_somadas = [ { id, quantity } ]).
-- Linha que ja existia nunca e apagada: se a quantidade chegar a 0, fica 1.

create or replace function public.colecao_desfazer_lote(p_ids uuid[], p_somadas jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_apagadas   integer := 0;
  v_revertidas integer := 0;
  v_n          integer;
  v_s          record;
begin
  if v_uid is null then raise exception 'nao_logado'; end if;

  if coalesce(array_length(p_ids, 1), 0) > 300 then raise exception 'itens_invalidos'; end if;
  if p_somadas is not null and (
       jsonb_typeof(p_somadas) <> 'array'
       or jsonb_array_length(p_somadas) > 300
       or exists (
         select 1 from jsonb_array_elements(p_somadas) x
          where jsonb_typeof(x) <> 'object'
             or coalesce(x->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             or coalesce(x->>'quantity', '') !~ '^[1-9][0-9]{0,3}$')
     ) then
    raise exception 'itens_invalidos';
  end if;

  if coalesce(array_length(p_ids, 1), 0) > 0 then
    delete from public.user_cards
     where id = any(p_ids)
       and user_id = v_uid;
    get diagnostics v_apagadas = row_count;
  end if;

  for v_s in
    select (x->>'id')::uuid as id, (x->>'quantity')::integer as q
      from jsonb_array_elements(coalesce(p_somadas, '[]'::jsonb)) x
  loop
    update public.user_cards
       set quantity = greatest(1, coalesce(quantity, 1) - v_s.q)
     where id = v_s.id
       and user_id = v_uid
       and graduada = false;
    get diagnostics v_n = row_count;
    v_revertidas := v_revertidas + v_n;
  end loop;

  return jsonb_build_object('ok', true, 'apagadas', v_apagadas, 'revertidas', v_revertidas);
end;
$$;
revoke all on function public.colecao_desfazer_lote(uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.colecao_desfazer_lote(uuid[], jsonb) to authenticated;

-- VERIFICACAO (depois de aplicar):
--   select proname, proacl from pg_proc
--    where proname in ('colecao_set_cartas','colecao_meus_sets','colecao_adicionar_lote','colecao_desfazer_lote');
--   -- esperado em cada uma: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
