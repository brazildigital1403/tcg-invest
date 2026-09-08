-- Slug de anuncio: /anuncio/{slug} em vez de /anuncio/{uuid}
--
-- ★ APLICADA em 07/09/2026, junto da 20260907120100 (que corrige a prioridade
--   do backfill). Resultado: 120/120 com slug, 120 unicos, 0 vazios.
--
-- POR QUE AGORA (07/09/2026): nao existe URL compartilhavel de anuncio. O
-- /marketplace nem linka por href (e onClick), e quem copia a URL do checkout
-- manda pro WhatsApp o banner GENERICO da Bynx -- nao a carta, nao o preco,
-- nao a foto. O vendedor nao tem como dizer "olha minha carta a venda".
--
-- Mesmo padrao ja aplicado em `loja_produtos` (coluna + trigger + indice
-- unico parcial, reusando `pkmn_slugify`). O UUID cru na URL ja foi recusado
-- uma vez pelo Du, com razao.
--
-- FORMATO: {carta}-{graduacao}-{vendedor}
--   clefairy-94-124-ags-9-5-bynx
--   mega-sableye-tyranitar-gx-245-236-adriano
--
-- A graduacao entra no slug de proposito: slab e OUTRO produto, e sem isso
-- dois anuncios da mesma carta (um cru, um graduado) so se diferenciariam
-- pelo sufixo numerico -2, que nao diz nada a quem recebe o link.

alter table public.marketplace add column if not exists slug text;

-- ★ DUAS FUNCOES, e a separacao NAO e estilo -- e o que fez a primeira
-- tentativa desta migration falhar. A versao unica resolvia a unicidade com
-- um `while exists (select ... from marketplace)` dentro dela mesma. Isso
-- funciona no trigger (linha a linha), mas no BACKFILL em massa a funcao le o
-- snapshot PRE-UPDATE: as linhas ainda nao tem slug gravado, ninguem enxerga
-- ninguem, e duas linhas geram o mesmo texto. O indice unico entao recusou:
-- "Key (slug)=(clefairy-94-124-bynx) is duplicated". E a armadilha de CTE/
-- snapshot que o CLAUDE.md ja documenta, aparecendo em UPDATE.
--
-- `_base` monta o texto e nao consulta a tabela. Quem resolve colisao e:
--   - o backfill, via row_number() sobre o proprio lote;
--   - o trigger, via loop (ai e uma linha por vez e o snapshot esta correto).

create or replace function public.montar_anuncio_slug_base(
  p_card_name text,
  p_user_id uuid,
  p_graduada boolean,
  p_graduadora text,
  p_nota numeric
) returns text
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_vend text;
  v_base text;
begin
  -- `/` vira `-` ANTES do slugify: o `pkmn_slugify` REMOVE a barra em vez de
  -- separar, entao "Clefairy (94/124)" colapsava em "clefairy-94124". Pego
  -- testando em transacao revertida antes de aplicar.
  v_base := trim(both '-' from pkmn_slugify(replace(coalesce(p_card_name, 'carta'), '/', '-')));
  if v_base = '' then v_base := 'carta'; end if;

  -- Graduacao no slug: distingue o slab da carta crua do mesmo vendedor.
  if coalesce(p_graduada, false) and p_graduadora is not null then
    v_base := v_base || '-' || pkmn_slugify(p_graduadora);
    if p_nota is not null then
      -- Mesmo motivo: 9.5 vira "9-5", nao "95".
      v_base := v_base || '-' || pkmn_slugify(replace(trim(trailing '0' from trim(trailing '.' from p_nota::text)), '.', '-'));
    end if;
  end if;

  -- Vendedor: slug da LOJA quando ele tem uma ativa; senao o username. Os 57
  -- anuncios de hoje sao 47 de colecionador e 10 de loja -- os dois casos sao
  -- comuns, nenhum e excecao.
  select coalesce(l.slug, u.username) into v_vend
  from public_users u
  left join lojas l on l.owner_user_id = u.id and l.status = 'ativa'
  where u.id = p_user_id;

  if v_vend is not null and v_vend <> '' then
    v_base := v_base || '-' || pkmn_slugify(v_vend);
  end if;

  return v_base;
end;
$function$;

-- Versao com unicidade, usada SO pelo trigger (uma linha por vez).
create or replace function public.montar_anuncio_slug(
  p_card_name text,
  p_user_id uuid,
  p_graduada boolean,
  p_graduadora text,
  p_nota numeric,
  p_id uuid
) returns text
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_base text;
  v_slug text;
  v_n    int := 1;
begin
  v_base := montar_anuncio_slug_base(p_card_name, p_user_id, p_graduada, p_graduadora, p_nota);
  v_slug := v_base;
  while exists (select 1 from marketplace where slug = v_slug and id is distinct from p_id) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$function$;

create or replace function public.trg_marketplace_slug_fn()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Gera SO quando falta. Slug ja publicado nunca muda, nem se o anuncio for
  -- editado: o ponto da coluna e ser link compartilhavel, e link que muda
  -- sozinho quebra na mao de quem recebeu.
  if new.slug is null or new.slug = '' then
    new.slug := montar_anuncio_slug(new.card_name, new.user_id, new.graduada, new.graduadora, new.nota, new.id);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_marketplace_slug on public.marketplace;
create trigger trg_marketplace_slug
  before insert or update on public.marketplace
  for each row execute function public.trg_marketplace_slug_fn();

-- Backfill: 120 linhas. `row_number()` desempata DENTRO do lote -- ver o
-- bloco no topo sobre por que a funcao sozinha nao consegue.
with base as (
  select id, created_at,
         montar_anuncio_slug_base(card_name, user_id, graduada, graduadora, nota) as b
  from public.marketplace
  where slug is null
), num as (
  select id, b, row_number() over (partition by b order by created_at, id) as n
  from base
)
update public.marketplace m
set slug = case when num.n = 1 then num.b else num.b || '-' || num.n end
from num
where m.id = num.id;

-- Unico parcial, igual ao de loja_produtos.
create unique index if not exists marketplace_slug_unique
  on public.marketplace (slug) where (slug is not null);

-- ROLLBACK:
--   drop trigger trg_marketplace_slug on public.marketplace;
--   drop function trg_marketplace_slug_fn();
--   drop function montar_anuncio_slug(text, uuid, boolean, text, numeric, uuid);
--   drop function montar_anuncio_slug_base(text, uuid, boolean, text, numeric);
--   drop index marketplace_slug_unique;
--   alter table public.marketplace drop column slug;
