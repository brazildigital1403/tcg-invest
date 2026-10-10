-- ============================================================================
-- loja_produtos.formato: "selado" nao e UM formato, sao oito
-- ============================================================================
-- ★ O PROBLEMA (02/10/2026, Quadro #447). O tipo `selado` cobre Elite Trainer
--   Box, booster box de 36 pacotes, blister de 3, deck, lata e colecao
--   especial -- caixas que nao se parecem em nada. A Bynx estimava UMA
--   dimensao para todas (25x20x12), grande demais para a ETB e pequena demais
--   para a booster box.
--
-- ★ POR QUE AGORA: com 4 produtos no ar, as tres medidas manuais resolvem caso
--   a caso. Com 400 ninguem vai medir a mesma ETB quarenta vezes, e o que
--   escala e uma tabela de medida por (formato, idioma) -- a ETB inglesa mede
--   8,6 x 16,5 x 18,8 e a brasileira nao. O `idioma` foi ligado em c8e03b2;
--   esta coluna e a outra metade da chave.
--
-- ★ SO SE APLICA A `selado`. Pelucia, funko, fichario e acessorio nao tem
--   formato de fabrica -- sao produtos avulsos, cada um com a sua caixa. O
--   check garante isso: formato preenchido em tipo que nao e selado e dado
--   que ninguem vai ler e que mente na ficha.
--
-- Tabela de 7 linhas: `add column` sem default nao reescreve nada.
-- ============================================================================

alter table public.loja_produtos
  add column if not exists formato text;

alter table public.loja_produtos
  drop constraint if exists loja_produtos_formato_valido;
alter table public.loja_produtos
  add constraint loja_produtos_formato_valido check (
    formato is null
    or (tipo = 'selado' and formato in (
      'etb', 'booster_box', 'bundle', 'blister', 'deck', 'lata', 'colecao', 'pacote'
    ))
  );

comment on column public.loja_produtos.formato is
  'Subtipo de `selado` (etb, booster_box, bundle, blister, deck, lata, colecao, pacote). NULL em outros tipos e em selado nao classificado. Com `idioma`, e a chave da medida padrao.';
