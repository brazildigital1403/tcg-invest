-- ============================================================================
-- Busca de cartas v7: total digitado vira FILTRO, com fallback na v6.
-- Saiu do #505 (12/10/2026): "290/217" na v6 trazia toda carta numero 290,
-- com a de total 217 em primeiro -- o usuario leu as outras como erro.
--
-- Regra da v7: NUNCA devolver menos que a v6.
--   camada 0: termo "[nome ]NNN/TTT" -> so cartas com number_norm = NNN e
--             (set_total = TTT ou "(NNN/TTT)" no nome). Se der zero, cai na v6
--             (que e o comportamento de hoje). Paginacao: so cai na v6 quando
--             o conjunto estrito e vazio na pagina 0, para nao misturar paginas.
--   resto:    v6, sem mudanca.
-- Objeto novo com nome novo (regra da casa): a v6 fica.
-- ROLLBACK: trocar os chamadores de volta para v6 (AddCardModal, TradeAnalyzer);
--   drop function public.smart_search_cards_v7(text,integer,integer);
-- ============================================================================

create or replace function public.smart_search_cards_v7(q text, limit_n integer default 60, offset_n integer default 0)
returns setof public.pokemon_cards_all
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  qn text := lower(trim(coalesce(q, '')));
  m text[];
  nome text; snum text; stotal integer; num_regex text;
  tem_estrito boolean;
begin
  if qn = '' then return; end if;
  qn := regexp_replace(qn, '\s+', ' ', 'g');

  -- camada 0: numero/total, com ou sem nome na frente
  m := regexp_match(qn, '^(?:(.+?) )?0*([0-9]{1,4}) ?/ ?0*([0-9]{1,4})$');
  if m is not null then
    nome := nullif(trim(coalesce(m[1], '')), '');
    snum := m[2];
    stotal := m[3]::integer;
    num_regex := '\(0*' || snum || '/0*' || stotal::text || '\)';
    if nome is not null then nome := public.f_unaccent(nome); end if;

    select exists (
      select 1 from public.pokemon_cards pc
       where pc.number_norm = snum
         and (pc.set_total = stotal or pc.name ~* num_regex)
         and (nome is null
              or public.f_unaccent(pc.name) ilike '%' || nome || '%'
              or public.f_unaccent(pc.name_pt) ilike '%' || nome || '%'
              or (length(nome) >= 4 and public.f_unaccent(pc.name) % nome))
    ) into tem_estrito;

    if tem_estrito then
      return query
        select pc.* from public.pokemon_cards pc
         where pc.number_norm = snum
           and (pc.set_total = stotal or pc.name ~* num_regex)
           and (nome is null
                or public.f_unaccent(pc.name) ilike '%' || nome || '%'
                or public.f_unaccent(pc.name_pt) ilike '%' || nome || '%'
                or (length(nome) >= 4 and public.f_unaccent(pc.name) % nome))
         order by (case when nome is null then 0 else similarity(public.f_unaccent(pc.name), nome) end) desc,
                  (pc.image_small is null), pc.set_release_date desc nulls last, pc.id
         limit limit_n offset offset_n;
      return;
    end if;
  end if;

  return query select * from public.smart_search_cards_v6(q, limit_n, offset_n);
end
$$;

revoke all on function public.smart_search_cards_v7(text, integer, integer) from public;
grant execute on function public.smart_search_cards_v7(text, integer, integer) to anon, authenticated, service_role;
