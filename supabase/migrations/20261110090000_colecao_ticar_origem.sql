-- 10/11/2026: colecao_adicionar_lote gravava p_origem ('set' | 'busca' | 'lote')
-- na coluna user_cards.origem. Em producao essa coluna tem o check
-- chk_user_cards_origem (20260922140000): so 'declarada' | 'scan' | 'compra',
-- porque ela diz o quanto a carta e VERIFICADA, nao por qual tela entrou.
-- Todo lote em producao voltava 400 (check violation) e nada entrava.
-- A branch de prova nao tinha o check, por isso a bateria passou.
--
-- Correcao: a linha nova nasce 'declarada' (ticar e declarar, como a busca
-- avulsa). p_origem segue validado e serve so para a analise no cliente.
-- Unica mudanca no corpo: v_origem -> 'declarada' no insert.

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

  -- Origem e um rotulo fechado (teste adversarial de 09/11 gravou 'scan' por payload adulterado).
  v_origem := coalesce(nullif(btrim(p_origem), ''), 'lote');
  if v_origem not in ('busca', 'set', 'lote') then
    raise exception 'itens_invalidos';
  end if;

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
         v_it.variante, v_it.idioma, v_it.quantity, false, 'declarada', now())
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
