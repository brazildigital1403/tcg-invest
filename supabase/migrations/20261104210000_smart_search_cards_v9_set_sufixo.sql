-- Busca v9 (04/11/2026): o que a fila de "carta faltando" provou em 30 dias.
--
-- 36 pedidos pendentes, 24 eram carta que EXISTE e a busca nao achava:
--   1. numero com letra: "celebi 106" so devolvia 106/105 (Neo Destiny) e ignorava
--      o Shining Celebi 106c da 30th Celebration Classic (657 cartas com sufixo);
--   2. numero antes do nome: "crobat 076" acha, "076 crobat" dava zero;
--   3. erro de digitacao junto com numero ou na segunda palavra: "Snolarx 119",
--      "zoroak 123", "mega darkai", "mega charizad" davam zero (o fuzzy so rodava
--      na primeira palavra e nunca quando havia numero);
--   4. busca por SET em portugues: "30 anos", "celebracoes 30" davam zero (o set
--      30th Celebration nao tinha nome PT nem apelido);
--   5. ruido de copiar e colar: "Blastoise-EX (029", "gengar 25/",
--      "Celebi Luminescente (106/30)".
--
-- A v9 envelopa a v8 inteira (zero regressao: a camada A e a v8) e so entra
-- nas camadas novas quando a v8 devolve zero -- com uma excecao: termo com
-- numero sempre soma as variantes com sufixo de letra depois do resultado da v8.
--
--   A. v8 com o termo cru; se zero e a limpeza mudou algo, v8 com o termo limpo
--   B. nome + numero (em qualquer ordem): numero exato OU com sufixo a-z,
--      nome por ilike OU word_similarity por token (tolerante a typo)
--   C. SET por nome em qualquer idioma (pokemon_sets.name, name_pt, name_pt2 e
--      set_aliases), contido na query ou parcial/typo; o resto da query filtra
--      por nome e/ou numero dentro do set
--   D. fuzzy em todas as palavras (nome, nome PT, set, set PT), dinamico como a
--      v5 para o GIN trigram continuar valendo
--
-- A v8 continua no banco: rollback = trocar o chamador de volta.
-- set_aliases ganha PK composta (alias, set_id): "30 anos" precisa apontar para
-- os 4 sets da 30th Celebration (158 + 30 Classic + 8 Energia + 3 RGB = 199, o
-- mesmo que a Meta usa). Os leitores existentes fazem `limit 1`, nao quebram.

-- ── set_aliases: um apelido pode apontar para mais de um set ──────────────────
do $$
declare pk text;
begin
  select conname into pk from pg_constraint where conrelid = 'public.set_aliases'::regclass and contype = 'p';
  if pk is not null and pg_get_constraintdef((select oid from pg_constraint where conname = pk and conrelid = 'public.set_aliases'::regclass)) = 'PRIMARY KEY (alias)' then
    execute format('alter table public.set_aliases drop constraint %I', pk);
    alter table public.set_aliases add primary key (alias, set_id);
  end if;
end $$;

insert into public.set_aliases (alias, set_id, source)
select a.alias, s.set_id, 'bynx-busca-v9'
  from unnest(array[
    '30 anos', '30anos', 'trinta anos', '30 celebration', '30th', '30th celebration',
    'celebracao 30', 'celebracao de 30 anos', 'celebracao 30 anos', 'celebracoes 30',
    'celebracoes 30 anos', 'aniversario', 'aniversario 30', '30 aniversario', 'aniversario 30 anos',
    'anniversary', '30th anniversary'
  ]) as a(alias)
  cross join unnest(array['30c', '30c-c', '30c-e', '30c-r']) as s(set_id)
on conflict do nothing;

-- ── glossario PT -> EN: "Celebi Luminescente" e o Shining Celebi ─────────────
insert into public.busca_glossario (pt, en) values ('luminescente', 'shining')
on conflict do nothing;

-- ── nome PT das Classic Cards que tem traducao conhecida em outra impressao ──
update public.pokemon_cards_all a
   set name_pt = o.pt
  from (
    select c.id, (select min(o.name_pt) from public.pokemon_cards_all o where o.name = c.name and o.name_pt is not null) as pt
      from public.pokemon_cards_all c
     where c.set_id = '30c-c' and c.name_pt is null
  ) o
 where a.id = o.id and o.pt is not null;

-- ── a funcao ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.smart_search_cards_v9(q text, limit_n integer DEFAULT 60, offset_n integer DEFAULT 0)
 RETURNS SETOF pokemon_cards_all
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  qn text;
  teto integer := limit_n + offset_n;
  m text[];
  nome text; snum text; sufixo text; nums text[];
  toks text[]; t text; i integer;
  sids text[]; set_nome text; resto text;
  txt_toks text[] := array[]::text[]; num_toks text[] := array[]::text[];
  stop text[] := array['de','da','do','das','dos','e','the','of','-','&','a','o'];
  where_extra text := ''; sql text;
begin
  if q is null or btrim(q) = '' then return; end if;

  -- 0. limpeza: minusculo, sem acento, sem pontuacao solta, sem barra/hifen nas pontas
  qn := lower(public.f_unaccent(q));
  qn := regexp_replace(qn, '[()\[\]{}"“”:;!?,]', ' ', 'g');
  qn := btrim(regexp_replace(qn, '\s+', ' ', 'g'));
  qn := regexp_replace(qn, '[\s/\-]+$', '');
  qn := regexp_replace(qn, '^[\s/\-]+', '');
  if qn = '' then return; end if;

  -- nome + numero, numero primeiro ou por ultimo; total (/105) e ignorado aqui,
  -- a v8 ja trata o estrito
  m := regexp_match(qn, '^(.+?) 0*([0-9]{1,4})([a-z])?( ?/ ?[0-9]{1,4})?$');
  if m is null then
    m := regexp_match(qn, '^0*([0-9]{1,4})([a-z])? (.+)$');
    if m is not null then m := array[m[3], m[1], m[2], null]; end if;
  end if;

  if m is not null then
    nome := btrim(m[1]); snum := m[2]; sufixo := m[3];
    if snum = '' then snum := '0'; end if;
    if sufixo is not null then
      nums := array[snum || sufixo];
    else
      -- com total digitado ("4/102") a v7 ja e estrita por decisao do Du
      -- (12/10): aqui so entram as variantes com letra, nunca o numero puro
      -- de outros sets
      nums := case when m[4] is null then array[snum] else array[]::text[] end;
      for i in 97..122 loop nums := nums || (snum || chr(i)); end loop;
    end if;
    toks := array(
      select x from unnest(string_to_array(lower(public.traduzir_busca_pt(nome)), ' ')) x
       where x <> '' and length(x) >= 2 and not (x = any(stop))
    );

    -- A + B: resultado da v8 primeiro, depois as variantes com sufixo e o
    -- nome tolerante a erro, sem repetir carta
    return query
      with a as (
        select pc as c, row_number() over () as rn from public.smart_search_cards_v8(q, teto, 0) pc
      ),
      b as (
        select pc as c, row_number() over (
          order by (pc.number_norm = snum) desc,
                   similarity(public.f_unaccent(pc.name), nome) desc,
                   (pc.image_small is null), pc.set_release_date desc nulls last, pc.id
        ) as rn
          -- pokemon_cards_all direto (com oculto = false): o UNION com a v8 exige o
          -- mesmo tipo de linha, e a view tem tipo proprio
          from public.pokemon_cards_all pc
         where pc.oculto = false
           and pc.number_norm = any(nums)
           -- cada termo precisa casar; name_pt nulo conta como "nao casou"
           -- (bool_and ignora NULL, e NULL aqui aceitava qualquer carta)
           -- fuzzy so quando a v8 veio vazia: "charizard 4/102" com fuzzy
           -- puxava Charmander 004C, e a v8 ja tinha a resposta certa
           and (array_length(toks, 1) is null or (
             select bool_and(
               coalesce(public.f_unaccent(pc.name) ilike '%' || x || '%', false)
               or coalesce(public.f_unaccent(pc.name_pt) ilike '%' || x || '%', false)
               or (not exists (select 1 from a) and length(x) >= 4 and (
                    coalesce(word_similarity(x, public.f_unaccent(pc.name)) >= 0.35, false)
                    or coalesce(word_similarity(x, public.f_unaccent(pc.name_pt)) >= 0.35, false)))
             ) from unnest(toks) x
           ))
         limit teto
      ),
      u as (
        select c, 0 as pri, rn from a
        union all
        select c, 1, rn from b where (b.c).id not in (select (a.c).id from a)
      )
      select (u.c).* from u order by pri, rn limit limit_n offset offset_n;
    if found then return; end if;
  else
    -- A: v8 com o termo cru; se a limpeza mudou algo, v8 com o limpo
    return query select * from public.smart_search_cards_v8(q, limit_n, offset_n);
    if found then return; end if;
    if qn <> lower(btrim(q)) then
      return query select * from public.smart_search_cards_v8(qn, limit_n, offset_n);
      if found then return; end if;
    end if;
  end if;

  -- C. SET por nome em qualquer idioma -----------------------------------------
  --    1) nome do set (ou apelido) contido na query, palavra inteira; o mais
  --       longo vence; o que sobra filtra nome/numero dentro do set
  with nomes as (
    select s.id as set_id, lower(public.f_unaccent(n)) as nome
      from public.pokemon_sets s
      cross join lateral unnest(array[s.name, s.name_pt, s.name_pt2]) as n
     where n is not null
    union all
    select a.set_id, lower(public.f_unaccent(a.alias)) from public.set_aliases a
  )
  select x.nome, array_agg(distinct x.set_id) into set_nome, sids
    from nomes x
   where length(x.nome) >= 3
     and (qn = x.nome or qn like x.nome || ' %' or qn like '% ' || x.nome or qn like '% ' || x.nome || ' %')
   group by x.nome
   -- "Escarlate e Violeta: Obsidiana em Chamas": a serie vem antes do set,
   -- entao o nome que aparece por ULTIMO na query e o set; depois o mais longo
   order by strpos(qn, x.nome) desc, length(x.nome) desc
   limit 1;

  if set_nome is not null then
    resto := btrim(regexp_replace(' ' || qn || ' ', ' ' || set_nome || ' ', ' ', 'g'));
  else
    --  2) query e parte do nome do set, ou nome com erro de digitacao
    with nomes as (
      select s.id as set_id, lower(public.f_unaccent(n)) as nome
        from public.pokemon_sets s
        cross join lateral unnest(array[s.name, s.name_pt, s.name_pt2]) as n
       where n is not null
      union all
      select a.set_id, lower(public.f_unaccent(a.alias)) from public.set_aliases a
    )
    select x.nome, array_agg(distinct x.set_id) into set_nome, sids
      from nomes x
     where length(qn) >= 4
       and (
         x.nome like '%' || qn || '%'
         -- typo no nome do set: "annive", "30 naos"; o guarda de tamanho evita
         -- que "gengar 25" vire o deck "Gengar VMAX High-Class" e "mega darkai"
         -- vire "MEGA Dream ex"
         or (length(x.nome) <= 2 * length(qn) + 2
             and (word_similarity(qn, x.nome) >= 0.6 or (length(qn) >= 6 and similarity(qn, x.nome) >= 0.3)))
       )
     group by x.nome
     order by max(greatest(word_similarity(qn, x.nome), similarity(qn, x.nome))) desc, length(x.nome)
     limit 1;
    resto := null;
  end if;

  if sids is not null then
    if resto is not null and resto <> '' then
      foreach t in array string_to_array(lower(public.traduzir_busca_pt(resto)), ' ') loop
        if t = '' or t = any(stop) then continue; end if;
        if t ~ '^0*[0-9]{1,4}[a-z]?$' then
          num_toks := num_toks || regexp_replace(t, '^0*([0-9]+)', '\1');
        elsif length(t) >= 3 then
          txt_toks := txt_toks || t;
        end if;
      end loop;
    end if;

    return query
      select pc.* from public.pokemon_cards pc
       where pc.set_id = any(sids)
         and (array_length(num_toks, 1) is null or pc.number_norm = any(num_toks)
              or pc.number_norm = any(array(select n || chr(g) from unnest(num_toks) n, generate_series(97, 122) g)))
         and (array_length(txt_toks, 1) is null or exists (
           select 1 from unnest(txt_toks) x
            where public.f_unaccent(pc.name) ilike '%' || x || '%'
               or public.f_unaccent(pc.name_pt) ilike '%' || x || '%'
               or (length(x) >= 4 and word_similarity(x, public.f_unaccent(pc.name)) >= 0.4)
         ))
       order by
         (case when array_length(txt_toks, 1) is null then 0 else -(
            select count(*) from unnest(txt_toks) x
             where public.f_unaccent(pc.name) ilike '%' || x || '%'
                or public.f_unaccent(pc.name_pt) ilike '%' || x || '%') end),
         pc.set_id,
         nullif(regexp_replace(pc.number_norm, '\D', '', 'g'), '')::integer nulls last,
         pc.number_norm, pc.id
       limit limit_n offset offset_n;
    if found then return; end if;
  end if;

  -- D. fuzzy em todas as palavras ----------------------------------------------
  --    SQL dinamico como a v5: predicado no topo do WHERE para o GIN trigram
  --    continuar servindo o ILIKE e o <%. Token que e codigo/apelido de set
  --    vira filtro de set ("soblle mep").
  toks := array(
    select x from unnest(string_to_array(lower(public.traduzir_busca_pt(qn)), ' ')) x
     where x <> '' and length(x) >= 3 and not (x = any(stop))
  );
  if array_length(toks, 1) is null then return; end if;

  perform set_config('pg_trgm.word_similarity_threshold', '0.4', true);
  foreach t in array toks loop
    select array_agg(distinct z) into sids from (
      select sa.set_id as z from public.set_aliases sa where sa.alias = t
      union all
      select s.id from public.pokemon_sets s where s.id = t
    ) y;
    if sids is not null then
      where_extra := where_extra || format(' AND pc.set_id = ANY(%L::text[])', sids);
      continue;
    end if;
    where_extra := where_extra || format(
      ' AND (public.f_unaccent(pc.name) ILIKE %L OR public.f_unaccent(pc.name_pt) ILIKE %L'
      || ' OR public.f_unaccent(pc.set_name) ILIKE %L OR public.f_unaccent(pc.set_name_pt) ILIKE %L'
      || ' OR %L <%% public.f_unaccent(pc.name) OR %L <%% public.f_unaccent(pc.name_pt) OR %L <%% public.f_unaccent(pc.set_name_pt))',
      '%'||t||'%', '%'||t||'%', '%'||t||'%', '%'||t||'%', t, t, t);
  end loop;

  sql := 'SELECT pc.* FROM public.pokemon_cards pc WHERE TRUE' || where_extra
      || format(' ORDER BY similarity(public.f_unaccent(pc.name), %L) DESC, (pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id', array_to_string(toks, ' '))
      || ' LIMIT $1 OFFSET $2';
  return query execute sql using limit_n, offset_n;
end
$function$;
