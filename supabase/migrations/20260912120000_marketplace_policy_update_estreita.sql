-- Policy de UPDATE do marketplace: tira o ramo que abria anuncio ALHEIO
--
-- ★ APLICADA em 12/09/2026, e o efeito foi medido no MESMO anuncio antes e
--   depois (rosas-encouragement-123-124), em transacao revertida com
--   `set local role authenticated` + jwt claims -- que e exatamente o papel
--   que o PostgREST usa:
--
--     ANTES:   estranho alterou 1 linha   (o ataque funcionava)
--     DEPOIS:  estranho altera  0 linhas  |  dono continua alterando 1
--
--   E o caminho legitimo conferido em producao pelo Chrome logado, com sessao
--   real: reservar -> 200, liberar -> 200 pela rota nova.
--
-- ★ O QUE ESTAVA ABERTO. O USING tinha tres ramos:
--
--     auth.uid() = user_id                                    (o dono)
--  OR auth.uid() = buyer_id                                   (o comprador)
--  OR (role = 'authenticated' AND status = 'disponivel'
--      AND auth.uid() <> user_id)                             <-- este
--
-- O terceiro existia pro "Tenho interesse", mas NAO restringia o status de
-- DESTINO, e o WITH CHECK so exigia `buyer_id = auth.uid()`. Combinado com o
-- grant POR COLUNA em `status` e `buyer_id` (authenticated=w), qualquer
-- usuario logado escrevia QUALQUER status em QUALQUER anuncio disponivel de
-- outra pessoa -- eram 74 anuncios expostos no dia em que isto foi aplicado.
--
-- Dois abusos concretos que isso permitia:
--   `status='cancelado'`  tira a carta de outra pessoa do ar;
--   `status='vendido'`    a torna IMUNE a regra de 72h, porque a varredura
--                         (de proposito) nunca toca em vendido.
--
-- ★ POR QUE SO AGORA. Estreitar isto antes de 12/09 quebraria o "Tenho
-- interesse" pra todo mundo: eram 13 pontos do BROWSER escrevendo status
-- direto. Em b18509d eles passaram a chamar
-- POST /api/marketplace/[id]/status, que roda com service role (bypassa RLS)
-- e tem a maquina de estados explicita -- provado em producao com sessao real:
-- 403 em carta propria, 200 no caminho feliz, 409 na corrida.
--
-- ★ RECORTE DELIBERADO: os dois primeiros ramos FICAM. Escrever no proprio
-- anuncio (dono) ou no anuncio que voce esta comprando (buyer) e bem menos
-- grave que escrever no alheio, e manter esses dois deixa a mudanca reversivel
-- sem risco caso sobre alguma escrita de cliente que eu nao achei na varredura.
-- O aperto seguinte, se um dia valer: `revoke update (status, buyer_id) on
-- marketplace from authenticated`, que tornaria esta policy irrelevante.

drop policy if exists "Users can update marketplace" on public.marketplace;

create policy "Users can update marketplace" on public.marketplace
  for update
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = buyer_id
  )
  with check (
    (select auth.uid()) = user_id
    or buyer_id = (select auth.uid())
  );

-- ── ROLLBACK ──────────────────────────────────────────────────────────────
-- Recria com o terceiro ramo, exatamente como estava:
--
--   drop policy "Users can update marketplace" on public.marketplace;
--   create policy "Users can update marketplace" on public.marketplace
--     for update
--     using (
--       (select auth.uid()) = user_id
--       or (select auth.uid()) = buyer_id
--       or ((select auth.role()) = 'authenticated'
--           and status = 'disponivel'
--           and (select auth.uid()) <> user_id)
--     )
--     with check (
--       (select auth.uid()) = user_id or buyer_id = (select auth.uid())
--     );
