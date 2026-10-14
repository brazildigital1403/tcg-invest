-- Epico Cadastro de carta, item 1 (15/10/2026): foil e normal viram pilhas separadas.
--
-- POR QUE: hoje o unico indice de deduplicacao e (user_id, pokemon_api_id). Variante e
-- idioma ficam de fora, entao o banco so aceita UMA linha por carta por usuario. Somar a
-- foil na pilha da normal nao e descuido do AddCardModal: e o modelo de dados. Com o
-- indice atual, mesmo corrigindo o SELECT o insert morreria com 23505.
--
-- ESTADO MEDIDO EM 15/10/2026, EM PRODUCAO:
--   user_cards            7.596 linhas, 4.104 kB  (nao e a pokemon_cards_all de 187 MB,
--                                                  entao criar indice aqui nao encosta
--                                                  no orcamento de IO da instancia)
--   variante nula         0 linhas  (coluna e nullable com default 'normal')
--   idioma nulo           0 linhas  (coluna e NOT NULL com default 'pt')
--   graduada = true       13 linhas (ficam fora do indice parcial, como ja ficavam)
--   conflitos no indice   0 linhas  -- NENHUMA pilha precisa ser mesclada antes
--
-- O coalesce e obrigatorio: em indice unico, dois NULL nao conflitam entre si. Sem ele,
-- duas linhas com variante nula passariam a conviver e a dedup voltaria a falhar
-- exatamente no caso que ela existe pra impedir.
--
-- ORDEM: o indice novo nasce ANTES de o antigo cair. O antigo e mais restritivo (ignora
-- variante e idioma), entao tudo que passa nele passa no novo -- nao ha janela em que
-- uma escrita duplicada entre.

begin;

create unique index if not exists idx_unique_user_card_variante
  on public.user_cards (user_id, pokemon_api_id, coalesce(variante, 'normal'), idioma)
  where pokemon_api_id is not null and graduada = false;

drop index if exists public.idx_unique_user_pokemon_api;

commit;

-- VERIFICACAO (rodar depois, em statement separado):
--   select indexname, indexdef from pg_indexes
--   where schemaname='public' and tablename='user_cards' and indexname like 'idx_unique%';
--   -- esperado: SO idx_unique_user_card_variante
--
-- ROLLBACK (uma linha, sem migration nova):
--   create unique index idx_unique_user_pokemon_api on public.user_cards (user_id, pokemon_api_id)
--     where pokemon_api_id is not null and graduada = false;
--   drop index idx_unique_user_card_variante;
--   -- ATENCAO: se ja tiverem nascido pilhas separadas, o indice antigo nao sobe enquanto
--   -- elas existirem. Mesclar antes:
--   --   select user_id, pokemon_api_id, count(*) from user_cards
--   --   where pokemon_api_id is not null and graduada = false
--   --   group by 1,2 having count(*) > 1;
--
-- DEPOIS DESTA MIGRATION, E SO DEPOIS, os 7 caminhos de escrita que casam carta apenas
-- por pokemon_api_id precisam passar a considerar variante e idioma. Enquanto nao
-- passarem, eles continuam somando na primeira pilha que acharem -- o comportamento de
-- hoje, nem melhor nem pior. O indice sozinho nao quebra nada; so para de proibir.
--   src/components/dashboard/AddCardModal.tsx : 321 (select) e 377 (fallback 23505)
--   src/app/pokedex/page.tsx                  : 359
--   src/lib/adicionarCartaPublica.ts          : 38
--   src/app/metas/[id]/page.tsx               : 281
--   src/components/ui/ScanModal.tsx           : 417  (casa por NOME, o mais fragil)
--   src/lib/concluirCompra.ts                 : 68
--   src/app/carta/[id]/CardClient.tsx         : 178
