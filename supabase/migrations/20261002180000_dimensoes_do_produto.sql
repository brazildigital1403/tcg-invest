-- ============================================================================
-- loja_produtos: a DIMENSAO passa a vir do lojista, nao de estimativa nossa
-- ============================================================================
-- ★ O PROBLEMA (02/10/2026, Quadro #447). O lojista informava so o `peso_g` e
--   a Bynx ESTIMAVA a dimensao por tipo, em `DIMS_POR_TIPO`
--   (src/lib/melhor-envio.ts): selado 25x20x12, pelucia 30x25x18, funko
--   16x12x10, fichario 32x28x8, acessorio 20x15x8. Numeros que ninguem mediu
--   -- exatamente a mesma natureza dos "80 g por carta" que inflavam o frete
--   de carta ate hoje de manha.
--
-- ★ POR QUE DOI: o frete cobra pelo MAIOR entre peso real e peso cubado
--   (volume / 6000). A ETB de 500 g da loja Mais Que Geek declara 25x20x12 =
--   1,00 kg de cubado, entao o cubado manda e o frete e de 1 kg. Medido na
--   rota BH -> SP: R$ 18,95 contra R$ 17,99 de uma caixa 20x15x9 (cubado
--   0,45 kg, e ai o peso real volta a mandar). Em 3 unidades, R$ 37,13
--   contra R$ 34,80.
--
-- ★ POR QUE NAO BASTAVA TROCAR A ESTIMATIVA: a correcao da carta tinha fonte
--   (pesquisa do Du, as faixas publicadas da Cardmarket, o peso de cada
--   componente). Para a ETB nao ha nada medido -- trocar um chute por outro
--   teria a aparencia de rigor sem a substancia. Quem tem a caixa na mao e o
--   LOJISTA, e e dele que a medida tem que vir.
--
-- ★ NULL E DIFERENTE DE ZERO, e e por isso que nao ha default: NULL significa
--   "o lojista nao informou" e cai no `DIMS_POR_TIPO`, que continua existindo
--   como fallback. Zero seria uma dimensao declarada e invalida.
--
-- Tabela de 4 linhas: `add column` sem default nao reescreve nada.
-- ============================================================================

alter table public.loja_produtos
  add column if not exists largura_cm     smallint,
  add column if not exists altura_cm      smallint,
  add column if not exists comprimento_cm smallint;

-- Limites sanos: nada abaixo de 1 cm (o minimo postal e maior que isso) e
-- nada acima de 100 cm, que e o teto por lado dos Correios.
alter table public.loja_produtos
  drop constraint if exists loja_produtos_dimensoes_validas;
alter table public.loja_produtos
  add constraint loja_produtos_dimensoes_validas check (
    (largura_cm     is null or (largura_cm     between 1 and 100)) and
    (altura_cm      is null or (altura_cm      between 1 and 100)) and
    (comprimento_cm is null or (comprimento_cm between 1 and 100))
  );

comment on column public.loja_produtos.largura_cm     is 'Largura da embalagem em cm, informada pelo lojista. NULL = usar a estimativa por tipo.';
comment on column public.loja_produtos.altura_cm      is 'Altura da embalagem em cm, informada pelo lojista. NULL = usar a estimativa por tipo.';
comment on column public.loja_produtos.comprimento_cm is 'Comprimento da embalagem em cm, informado pelo lojista. NULL = usar a estimativa por tipo.';
