-- Busca v10 (21/11/2026): tres buracos que a fila de "carta faltando" mostrou em
-- pedidos reais de 20/11, todos de carta que EXISTE:
--
--   1. numero com prefixo de letra digitado sem o prefixo: "Beldum (30/94)" e o
--      Beldum SV30 (SV30/SV94). Vale para SV, TG, GG, SWSH, SM, XY, BW, RC, H...
--      (2.577 cartas com numero no formato letras+digitos);
--   2. numero composto: "Banette (0703/07)" esta no banco como "0703-07"
--      (number_norm "703-7"; 991 cartas no formato digitos-digitos);
--   3. letras trocadas sem numero: "Jeolton". O trigram nao alcanca troca de
--      letras (word_similarity 0,23), entao o fuzzy da v9 devolve zero.
--
-- A v10 envelopa a v9 inteira e so acrescenta:
--
--   P. nome + numero: cartas com o nome digitado e numero = letras + numero, ou
--      numero-total quando ha total. Sem total, entram DEPOIS do resultado da
--      v9 (ou antes, se a v9 so trouxe nome aproximado). Com total digitado a
--      busca continua estrita (decisao de 12/10): o prefixo so vale em set com
--      aquele total cadastrado ("banette 07/30" = TG07 de um set de 30) e ai
--      vem na frente, porque nome + numero + total bateram; set sem total
--      cadastrado so entra quando a v9 deu zero.
--   T. zero resultado: cada palavra que for anagrama de um nome da Pokedex
--      (1.025 linhas) e trocada pelo nome certo e a busca roda de novo. Nao e
--      fuzzy: ou as letras sao as mesmas ou nada muda. Carta que falta de
--      verdade continua devolvendo zero e continua caindo na fila.
--
-- A v9 continua no banco: rollback = trocar o chamador de volta.

CREATE OR REPLACE FUNCTION public.smart_search_cards_v10(q text, limit_n integer DEFAULT 60, offset_n integer DEFAULT 0)
 RETURNS SETOF pokemon_cards_all
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  qn text;
  teto integer := limit_n + offset_n;
  m text[];
  nome text; snum text; stot text;
  toks text[]; t text; certo text;
  stop text[] := array['de','da','do','das','dos','e','the','of','-','&','a','o'];
  cond_p text := ''; cond_a text; num_cond text; ord_tot text := ''; sql text;
  tem_longo boolean := false;
  corrigido text[] := array[]::text[]; mudou boolean := false;
  n integer;
begin
  if q is null or btrim(q) = '' then return; end if;

  -- mesma limpeza da v9
  qn := lower(public.f_unaccent(q));
  qn := regexp_replace(qn, '[()\[\]{}"“”:;!?,]', ' ', 'g');
  qn := btrim(regexp_replace(qn, '\s+', ' ', 'g'));
  qn := regexp_replace(qn, '[\s/\-]+$', '');
  qn := regexp_replace(qn, '^[\s/\-]+', '');
  if qn = '' then return; end if;

  -- nome + numero [+ total], total separado por / ou -, numero antes ou depois.
  -- Numero com sufixo de letra ("106c") nao casa aqui: e assunto da v9.
  m := regexp_match(qn, '^(.+?) 0*([0-9]{1,4})(?: ?[/\-] ?0*([0-9]{1,4}))?$');
  if m is null then
    m := regexp_match(qn, '^0*([0-9]{1,4})(?: ?[/\-] ?0*([0-9]{1,4}))? (.+)$');
    if m is not null then m := array[m[3], m[1], m[2]]; end if;
  end if;

  if m is not null then
    nome := btrim(m[1]); snum := m[2]; stot := m[3];
    toks := array(
      select x from unnest(string_to_array(lower(public.traduzir_busca_pt(nome)), ' ')) x
       where x <> '' and length(x) >= 2 and not (x = any(stop))
    );
    foreach t in array toks loop
      if length(t) >= 3 then tem_longo := true; end if;
      cond_p := cond_p || format(
        ' AND (public.f_unaccent(pc.name) ILIKE %L OR public.f_unaccent(pc.name_pt) ILIKE %L)',
        '%' || t || '%', '%' || t || '%');
    end loop;
  end if;

  if m is not null and tem_longo then
    -- P. SQL dinamico: o ILIKE no topo do WHERE usa o GIN trigram do nome
    cond_a := replace(cond_p, 'pc.', '(a.c).');
    num_cond := format('pc.number_norm ~ %L', '^[a-z]{1,5}' || snum || '$');
    if stot is not null then
      num_cond := format('((%s AND (pc.set_total = %s OR (pc.set_total IS NULL AND NOT EXISTS (SELECT 1 FROM a)))) OR pc.number_norm = %L)',
                         num_cond, stot, snum || '-' || stot);
      ord_tot := format('(pc.number_norm = %L) DESC, (pc.set_total = %s) DESC NULLS LAST, ', snum || '-' || stot, stot);
    end if;

    sql := 'WITH a AS (SELECT pc AS c, row_number() OVER () AS rn FROM public.smart_search_cards_v9($1, $2, 0) pc), '
        || 'p AS (SELECT pc AS c, row_number() OVER (ORDER BY ' || ord_tot
        || format('(lower(public.f_unaccent(pc.name)) = %L) DESC, ', nome)
        || '(pc.image_small IS NULL), pc.set_release_date DESC NULLS LAST, pc.id) AS rn '
        || 'FROM public.pokemon_cards_all pc WHERE pc.oculto = false' || cond_p || ' AND ' || num_cond
        || ' ORDER BY rn LIMIT $2), '
        || 'f AS (SELECT ' || case when stot is not null then 'FALSE' else 'EXISTS (SELECT 1 FROM a WHERE TRUE' || cond_a || ')' end || ' AS exato), '
        || 'u AS (SELECT a.c, CASE WHEN f.exato THEN 0 ELSE 1 END AS pri, a.rn FROM a, f '
        || 'UNION ALL SELECT p.c, CASE WHEN f.exato THEN 1 ELSE 0 END, p.rn FROM p, f '
        || 'WHERE (p.c).id NOT IN (SELECT (a.c).id FROM a)) '
        || 'SELECT (u.c).* FROM u ORDER BY pri, rn LIMIT $3 OFFSET $4';
    return query execute sql using q, teto, limit_n, offset_n;
    if found then return; end if;
  else
    return query select * from public.smart_search_cards_v9(q, limit_n, offset_n);
    if found then return; end if;
  end if;

  -- Pagina vazia. Se for so o fim da paginacao de uma busca que tem resultado,
  -- acabou: a correcao abaixo e so para busca que da zero desde a primeira pagina.
  -- (a conferencia e no caminho principal, sem a correcao: senao a pagina 2
  -- de uma busca corrigida voltaria vazia)
  if offset_n > 0 then
    if m is not null and tem_longo then
      execute 'SELECT count(*) FROM (' || sql || ') z' into n using q, 1, 1, 0;
    else
      select count(*) into n from (select 1 from public.smart_search_cards_v9(q, 1, 0)) z;
    end if;
    if n > 0 then return; end if;
  end if;

  -- T. letras trocadas: palavra que e anagrama de um nome da Pokedex vira o nome
  foreach t in array string_to_array(qn, ' ') loop
    certo := null;
    -- palavra que ja e um nome da Pokedex nunca e trocada (e e isso que
    -- garante que a chamada recursiva abaixo termina)
    if length(t) >= 4 and t !~ '[0-9]' and not exists (
         select 1 from public.pokemon_pokedex p
          where lower(public.f_unaccent(p.name)) = t or lower(public.f_unaccent(p.name_pt)) = t) then
      select lower(public.f_unaccent(d.nome)) into certo
        from (
          select p.name as nome, p.national_dex from public.pokemon_pokedex p
          union all
          select p.name_pt, p.national_dex from public.pokemon_pokedex p where p.name_pt is not null
        ) d
       where length(d.nome) = length(t)
         and lower(public.f_unaccent(d.nome)) <> t
         and (select string_agg(ch, '' order by ch) from regexp_split_to_table(lower(public.f_unaccent(d.nome)), '') ch)
           = (select string_agg(ch, '' order by ch) from regexp_split_to_table(t, '') ch)
       order by (left(lower(public.f_unaccent(d.nome)), 1) = left(t, 1)) desc, d.national_dex
       limit 1;
    end if;
    if certo is not null then mudou := true; end if;
    corrigido := corrigido || coalesce(certo, t);
  end loop;

  if mudou then
    return query select * from public.smart_search_cards_v10(array_to_string(corrigido, ' '), limit_n, offset_n);
  end if;
end
$function$;
