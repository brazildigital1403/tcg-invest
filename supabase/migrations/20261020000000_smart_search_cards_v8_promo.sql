-- Busca v8 (20/10/2026): "psyduck 007 promo", "061 promo", "charmeleon promo"
-- davam zero na v7 porque a palavra "promo" sobra e nao casa com nada (7 das
-- 31 buscas zeradas de 30 dias). A v8 envelopa a v7 inteira e, se der zero e o
-- termo tiver promo/promos/promocional, tira a palavra e repete priorizando set
-- promocional; termo so com numero vai direto nos sets promo.
-- A v7 continua no banco: rollback = trocar o chamador de volta.
CREATE OR REPLACE FUNCTION public.smart_search_cards_v8(q text, limit_n integer DEFAULT 60, offset_n integer DEFAULT 0)
 RETURNS SETOF pokemon_cards_all
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  qn text := lower(trim(coalesce(q, '')));
  q2 text; snum text;
begin
  if qn = '' then return; end if;
  qn := regexp_replace(qn, '\s+', ' ', 'g');

  -- camada normal (v7 inteira: numero/total, traducao, nome colado, codigo de set)
  return query select * from public.smart_search_cards_v7(q, limit_n, offset_n);
  if found then return; end if;

  -- camada "promo" (20/10/2026): "psyduck 007 promo", "061 promo", "charmeleon promo"
  -- davam zero porque a palavra sobra e nao casa com nada. Tira a palavra e
  -- repete, priorizando set promocional; so numero vai direto nos sets promo.
  if qn ~ '\m(promo|promocional|promos)\M' then
    q2 := trim(regexp_replace(regexp_replace(qn, '\m(promo|promocional|promos)\M', ' ', 'g'), '\s+', ' ', 'g'));
    if q2 = '' then return; end if;
    if q2 ~ '^[0-9]{1,4}$' then
      snum := regexp_replace(q2, '^0+', '');
      return query
        select pc.* from public.pokemon_cards pc
         where pc.number_norm = snum and pc.set_name ilike '%promo%'
         order by (pc.image_small is null), pc.set_release_date desc nulls last, pc.id
         limit limit_n offset offset_n;
      return;
    end if;
    return query
      with r as (select pc as c, row_number() over () as rn from public.smart_search_cards_v7(q2, limit_n + offset_n, 0) pc)
      select (z.c).* from r z
      order by ((z.c).set_name ilike '%promo%') desc, z.rn
      limit limit_n offset offset_n;
  end if;
end
$function$;
