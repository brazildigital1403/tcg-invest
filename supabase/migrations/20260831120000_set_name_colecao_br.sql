-- ============================================================================
-- Tira o nome do fornecedor de preco do set_name visivel.
-- Decisao do Du em 31/08/2026.
--
-- POR QUE
-- 9.202 cartas em 170 sets tem set_name 'Liga BR — XX'. Esse campo NAO fica so
-- no corpo da pagina: entra no <title> e na <meta description> de cada carta.
-- Medido em producao:
--   <title>Copycat 069/70 — Liga BR — L1SS | Bynx.gg</title>
-- Ou seja, o nome do fornecedor esta em texto indexado pelo Google, em 9.202
-- paginas. As URLs, essas, sempre estiveram limpas -- o achado original falava
-- em slug e estava errado quanto ao lugar.
--
-- ★ AS DUAS PARTES TEM QUE IR JUNTAS
-- `montar_card_slug` tem 'Liga BR%' HARDCODED, e e justamente essa condicao que
-- mantem as URLs limpas hoje: quando o set comeca com "Liga BR", a funcao OMITE
-- o segmento de set do slug. Se o UPDATE rodasse sozinho, a condicao pararia de
-- casar e toda carta NOVA desses sets passaria a carregar `colecao-br-xx` na
-- URL -- reintroduzindo na URL o problema que estamos tirando do title.
-- Rodar so a funcao tambem nao serve. As duas, na mesma transacao.
--
-- O QUE NAO MUDA
-- - Slug das cartas existentes: o trigger trg_card_slug nao sobrescreve slug
--   preenchido. Nenhuma URL publica muda, nenhum link quebra.
-- - pokemon_sets: esses 170 sets NAO tem linha la (conferido: 0 de 265), entao
--   nao ha nada a atualizar.
-- - id da carta: continua `liga-...`. E FK em 7 tabelas, com 2.225 cartas de
--   usuarios e 62 anuncios apontando -- fora de escopo de proposito.
-- ============================================================================

begin;

-- 1. A funcao passa a reconhecer o nome novo. Mantem 'Liga BR%' tambem: entre
--    o deploy e o UPDATE ha uma janela, e carta que entrar nela tem que sair
--    com slug limpo do mesmo jeito. Guardar as duas condicoes custa nada.
create or replace function public.montar_card_slug(
  p_name text, p_number text, p_printed integer, p_set_name text
) returns text language sql immutable as $function$
  select nullif(btrim(regexp_replace(
    concat_ws('-',
      nullif(pkmn_slugify(coalesce(p_name,'')), ''),
      lower(nullif(regexp_replace(coalesce(p_number,''), '[^A-Za-z0-9]+', '', 'g'), '')),
      p_printed::text,
      nullif(case
        when p_set_name ilike 'Cole%o BR%' then ''
        when p_set_name ilike 'Liga BR%'   then ''
        else pkmn_slugify(coalesce(p_set_name,''))
      end, '')
    ), '-+', '-', 'g'), '-'), '')
$function$;

-- 2. O rename. `substring from 8` preserva o resto do nome a partir do espaco
--    que antecede o em-dash (' — L1SS'), entao so o prefixo 'Liga BR' troca.
--    ★ Comecou como `from 9` e o preview pegou: cortava o espaco e produzia
--    'Coleção BR— L1SS', colado, nos 170 sets. Preview antes de escrever em
--    massa nao e formalidade.
update public.pokemon_cards_all
   set set_name = 'Coleção BR' || substring(set_name from 8)
 where set_name like 'Liga BR%';

commit;
