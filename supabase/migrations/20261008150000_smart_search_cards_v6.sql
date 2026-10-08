-- ============================================================================
-- Busca de cartas v6 (modal de adicionar e analisador de troca).
-- Aplicada em producao em 08/10/2026 e provada antes de trocar os chamadores.
--
-- Origem: limpeza dos 85 registros pendentes de card_requests (log automatico
-- de busca-zero). 14 deles eram erro nosso na smart_search_cards_v5:
--   #1 traduzir_busca_pt rodava ANTES de tudo e trocava palavra de tipo por
--      ingles ("raio" -> "lightning") e tirava o "de" -- destruindo nome em PT
--      que existe em name_pt (Raio Furia, Maca Noturna, Treino de Faixa Preta).
--   #2 nome colado ao numero ("mel104") caia na regra de numero puro.
--   #3 codigo de set junto do nome ("snorlax svp", "snorlax swsh1") nao era
--      reconhecido -- a v5 so entende "codigo numero".
--
-- Regra da v6: NUNCA devolver menos que a v5.
--   camada 1: resultado SEM traducao + resultado traduzido (so se a traducao
--             mudar o termo), sem duplicar, os sem-traducao primeiro.
--   camada 2 (so se a camada 1 der zero): #2 e #3 acima. Tokens que sao sufixo
--             de nome (ex, gx, v, vmax...) nunca viram set -- "pikachu ex"
--             tem que continuar dando 60.
-- smart_search_cards_v5_nt = a v5 sem a linha de traducao, gerada da PROPRIA
-- definicao da v5 no DO abaixo, para nao divergir em mais nada. A v5 fica.
--
-- PROVA (08/10): 82 termos da limpeza, v5 acha 3, v6 acha 13, nenhum pior;
-- 18 termos de regressao iguais ou melhores; 150 nomes reais de user_cards
-- com contagem e primeiro resultado identicos; paginacao sem sobreposicao.
--
-- CUSTO: igual a v5 na maioria das buscas (camada 1 sem traducao = v5 sem a
-- linha). Quando a traducao muda o termo, roda duas vezes. Zero resultado
-- pode rodar ate 4 vezes -- e o caso raro.
-- ROLLBACK: trocar os chamadores de volta para v5 (2 arquivos); depois
--   drop function public.smart_search_cards_v6(text,integer,integer);
--   drop function public.smart_search_cards_v5_nt(text,integer,integer);
-- ============================================================================

do $do$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'smart_search_cards_v5';
  def := replace(def, 'smart_search_cards_v5', 'smart_search_cards_v5_nt');
  def := replace(def, 'query_text := public.traduzir_busca_pt(query_text);', '');
  execute def;
end
$do$;

create or replace function public.smart_search_cards_v6(q text, limit_n integer default 60, offset_n integer default 0)
returns setof public.pokemon_cards_all
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  qn text := lower(trim(coalesce(q, '')));
  trad text;
  alpha text; digits text; q2 text;
  tokens text[]; t text; m text[];
  sid text; snum text; resto text[] := array[]::text[];
  sufixos text[] := array['ex','gx','v','vmax','vstar','mega','m','lv','x','break','tag','team','shiny','promo','delta','star','prime','legend','dark','light','ball','energy','hp','de','da','do'];
  teto integer := limit_n + offset_n;
begin
  if qn = '' then return; end if;
  qn := regexp_replace(qn, '\s+', ' ', 'g');
  trad := lower(public.traduzir_busca_pt(qn));

  -- camada 1
  if trad = qn then
    return query select * from public.smart_search_cards_v5_nt(qn, limit_n, offset_n);
  else
    return query
      with a as (select pc as c, row_number() over () as rn from public.smart_search_cards_v5_nt(qn, teto, 0) pc),
           b as (select pc as c, row_number() over () as rn from public.smart_search_cards_v5(qn, teto, 0) pc),
           u as (select c, 0 as pri, rn from a
                 union all
                 select c, 1, rn from b where (b.c).id not in (select (a.c).id from a))
      select (u.c).* from u order by pri, rn limit limit_n offset offset_n;
  end if;
  if found then return; end if;

  -- camada 2a: nome colado ao numero
  if qn ~ '^[a-z]{3,}[0-9]{1,4}$' then
    alpha := substring(qn from '^[a-z]+');
    digits := substring(qn from '[0-9]+$');
    if not exists (select 1 from public.set_aliases sa where sa.alias = alpha)
       and not exists (select 1 from public.pokemon_cards pc where pc.set_id = alpha limit 1) then
      q2 := alpha || ' ' || digits;
      return query select * from public.smart_search_cards_v5_nt(q2, limit_n, offset_n);
      if found then return; end if;
    end if;
  end if;

  -- camada 2b: codigo de set em qualquer posicao, com ou sem numero colado
  tokens := string_to_array(qn, ' ');
  if array_length(tokens, 1) >= 2 then
    foreach t in array tokens loop
      if sid is null and not (t = any(sufixos)) then
        select sa.set_id into sid from public.set_aliases sa where sa.alias = t limit 1;
        if sid is null and exists (select 1 from public.pokemon_cards pc where pc.set_id = t limit 1) then sid := t; end if;
        if sid is null then
          m := regexp_match(t, '^([a-z]+)([0-9]+)$');
          if m is not null and not (m[1] = any(sufixos)) then
            select sa.set_id into sid from public.set_aliases sa where sa.alias = m[1] limit 1;
            if sid is null and exists (select 1 from public.pokemon_cards pc where pc.set_id = m[1] limit 1) then sid := m[1]; end if;
            if sid is not null then snum := regexp_replace(m[2], '^0+', ''); end if;
          end if;
        end if;
        if sid is not null then continue; end if;
      end if;
      resto := resto || t;
    end loop;
    if sid is not null and array_length(resto, 1) >= 1 then
      t := public.f_unaccent(array_to_string(resto, ' '));
      return query
        select pc.* from public.pokemon_cards pc
         where pc.set_id = sid
           and (snum is null or pc.number_norm = snum)
           and (public.f_unaccent(pc.name) ilike '%' || t || '%' or public.f_unaccent(pc.name_pt) ilike '%' || t || '%')
         order by (pc.image_small is null), pc.set_release_date desc nulls last, pc.id
         limit limit_n offset offset_n;
    end if;
  end if;
end
$$;

revoke all on function public.smart_search_cards_v5_nt(text, integer, integer) from public;
grant execute on function public.smart_search_cards_v5_nt(text, integer, integer) to anon, authenticated, service_role;
revoke all on function public.smart_search_cards_v6(text, integer, integer) from public;
grant execute on function public.smart_search_cards_v6(text, integer, integer) to anon, authenticated, service_role;
