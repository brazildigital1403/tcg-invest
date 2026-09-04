-- Marketplace: a leitura publica para de entregar anuncio removido
--
-- ★ APLICADA EM PRODUCAO em 04/09/2026, com o ok do Du. Efeito conferido no
--   MESMO GET que antes devolvia a tabela toda pela internet:
--     linhas       119 -> 100
--     removidos     19 -> 0
--     buyer_id      14 -> 8   (os 6 que sumiram estavam em anuncios removidos)
--     disponiveis   61 -> 61  (a UI publica nao perdeu nada)
--     INSERT anon   passou a responder 401
--   /marketplace deslogado segue com "61 disponiveis - 5 em negociacao" e as
--   vitrines em 2/5/4/1 itens, iguais a antes.
--
-- ESTADO ANTES (medido em 04/09/2026, com `set local role anon`):
--   119 linhas visiveis pro anon -- TODAS. Dentro delas:
--     19 anuncios REMOVIDOS pela moderacao do admin
--     50 nao disponiveis (vendidos, cancelados, em negociacao)
--     14 com `buyer_id` preenchido, ou seja, quem comprou o que
--   Isso nao era teoria: um GET no PostgREST com a chave publicavel (que vai
--   no bundle JS do site, por design) devolvia as 119 linhas pela internet.
--
-- POR QUE ESTAVA ASSIM: duas policies de SELECT identicas, as duas
-- `using (true)` -- "Anyone can read marketplace" e "Marketplace is public".
-- A UI nunca mostrou anuncio removido porque as duas telas que listam
-- (`/marketplace` e `/perfil/[id]`) filtram `removido_em` no cliente. O
-- comentario em marketplace/page.tsx ate diz "garante que mesmo se RLS
-- falhar" -- ou seja, a frouxidao era conhecida e compensada no lugar
-- errado. Filtro de cliente nao protege quem nao usa o cliente.
--
-- O QUE MUDA: uma policy so, e o removido some pra quem nao tem nada com ele.
-- Dono e comprador continuam vendo -- o dono precisa saber que foi moderado,
-- e o comprador tem negociacao aberta em cima do anuncio.
--
-- PROVADO EM TRANSACAO REVERTIDA antes de virar migration:
--   anon           119 -> 100 linhas, 19 removidos -> 0
--   disponiveis    61 -> 61 (a UI publica nao perde NADA)
--   dono           ve os proprios 10 removidos, 0 de terceiros
--
-- NAO RESOLVE (fica registrado): `buyer_id` continua legivel por qualquer
-- usuario logado. Esconder coluna exige revogar o grant por coluna, e as
-- telas usam `select('*')` -- com a coluna revogada o PostgREST devolve ERRO
-- em vez de omitir, entao a UI quebraria. A correcao de verdade e as telas
-- pedirem colunas nomeadas. Frente separada.

drop policy if exists "Anyone can read marketplace" on public.marketplace;
drop policy if exists "Marketplace is public"      on public.marketplace;

create policy "leitura publica do marketplace" on public.marketplace
  for select using (
    removido_em is null
    or (select auth.uid()) = user_id
    or (select auth.uid()) = buyer_id
  );

-- Defesa em profundidade: o `anon` tinha INSERT na tabela. A policy de INSERT
-- exige `auth.uid() = user_id` e pro anon o `auth.uid()` e NULL, entao a
-- comparacao da NULL e o insert ja falhava. O grant era so superficie a mais,
-- do mesmo tipo que a memoria "tabela nova nasce exposta no Supabase" descreve.
-- Ninguem deslogado anuncia: anunciar exige sessao.
revoke insert on public.marketplace from anon;

-- ROLLBACK (se algo aparecer torto):
--   drop policy "leitura publica do marketplace" on public.marketplace;
--   create policy "Marketplace is public" on public.marketplace
--     for select using (true);
--   grant insert on public.marketplace to anon;
