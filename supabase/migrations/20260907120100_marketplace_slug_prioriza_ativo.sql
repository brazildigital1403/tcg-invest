-- Corrige a prioridade do backfill de slug (aplicada logo apos a anterior)
--
-- O backfill ordenava so por `created_at`, entao um anuncio VENDIDO ou
-- CANCELADO levava o slug limpo e o anuncio ATIVO ficava com "-2". O Clefairy
-- graduado, unico anuncio com fotos proprias, tinha ficado
-- `clefairy-94-124-ags-9-5-bynx-2` enquanto um cancelado ficou com o limpo.
-- O slug existe pra ser compartilhado, e quem se compartilha e o que esta a
-- venda.
--
-- ★ DUAS ETAPAS porque o indice unico e checado LINHA A LINHA: trocar A<->B
-- colide no meio do UPDATE ("Key (slug)=(...) already exists"). Passa por um
-- valor temporario unico primeiro.
--
-- Seguro fazer isto agora e SO agora: a coluna tinha nascido minutos antes e
-- nenhum link havia sido publicado. Daqui pra frente slug publicado nao muda.

create temporary table _slug_alvo on commit drop as
select id,
       (case when n = 1 then b else b || '-' || n end) as novo
from (
  select id,
         montar_anuncio_slug_base(card_name, user_id, graduada, graduadora, nota) as b,
         row_number() over (
           partition by montar_anuncio_slug_base(card_name, user_id, graduada, graduadora, nota)
           order by (status = 'disponivel' and removido_em is null) desc, created_at, id
         ) as n
  from public.marketplace
) t;

update public.marketplace m
set slug = 'tmp-' || m.id::text
from _slug_alvo a
where m.id = a.id and m.slug is distinct from a.novo;

update public.marketplace m
set slug = a.novo
from _slug_alvo a
where m.id = a.id and m.slug like 'tmp-%';

-- Resultado: 120/120 com slug, 120 unicos, 0 temporarios, e os 6 ativos que
-- ainda tem "-N" sao casos reais (o mesmo vendedor com dois anuncios da mesma
-- carta, como o Charizard ex 215/197 do magnabosco86).
