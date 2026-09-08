-- Conversa do marketplace nunca mais se apaga
--
-- ★ APLICADA em 08/09/2026. Provado em transacao revertida, virando a
--   sessao pro usuario real (set_config de request.jwt.claims + role
--   authenticated): no anuncio haunter-039-086-bynx o autor da mensagem via
--   0 pela policy antiga e passa a ver 1 pela nova.
--
-- POR QUE (08/09/2026): a policy de leitura das mensagens amarra o acesso ao
-- estado ATUAL do anuncio --
--
--   mkt_msg_participantes_leem (SELECT)
--     exists (select 1 from marketplace m
--              where m.id = anuncio_id
--                and (m.user_id = auth.uid() or m.buyer_id = auth.uid()))
--
-- e TODO cancelamento grava `status='disponivel', buyer_id=null`
-- (ChatDock.tsx:473, NegociacoesTab.tsx:197, marketplace/page.tsx:201).
-- Quando o buyer_id cai, o comprador perde a leitura da conversa INTEIRA --
-- combinado de preco, endereco, tudo.
--
-- ISTO NAO E RISCO FUTURO, JA ESTA SANGRANDO. Medido em producao hoje:
-- **5 das 32 mensagens da plataforma (16%) estao inacessiveis** a quem as
-- escreveu, em 3 anuncios -- e uma dessas conversas e de HOJE (Clefairy
-- 94/124, 2 pessoas, anuncio `disponivel` com buyer_id nulo).
--
-- A expiracao automatica de 72h multiplicaria isso por construcao: seria uma
-- rotina que apaga negociacao da tela das duas pessoas sem ninguem pedir.
--
-- ★ POR QUE FUNCAO E NAO UM `or exists` NA PROPRIA POLICY. A regra que falta
--   e "quem escreveu na conversa continua lendo a conversa", e isso e uma
--   consulta a `marketplace_mensagens` de dentro da policy DELA MESMA --
--   recursao, que o Postgres barra. SECURITY DEFINER quebra o ciclo.
--
-- ★ POR QUE NAO UMA COLUNA `buyer_id_anterior`. Ela guardaria so o ULTIMO
--   comprador. Se o anuncio passar por tres, os dois primeiros perdem o
--   historico do mesmo jeito -- so que mais devagar. Participacao real e o
--   criterio certo, e ele ja esta gravado em `sender_id`.

-- ── 1. Quem participou da conversa ────────────────────────────────────────
create or replace function public.participou_da_conversa(p_anuncio uuid)
returns boolean
language sql
security definer
stable
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.marketplace_mensagens z
     where z.anuncio_id = p_anuncio
       and z.sender_id = (select auth.uid())
  );
$function$;

comment on function public.participou_da_conversa(uuid) is
  'True se o usuario da sessao escreveu ao menos uma mensagem neste anuncio. '
  'SECURITY DEFINER para quebrar a recursao de consultar marketplace_mensagens '
  'de dentro da policy da propria tabela. NAO expoe conteudo: devolve booleano.';

-- ★ Funcao SECURITY DEFINER nasce executavel por PUBLIC. Sem este revoke o
--   `anon` chamaria a funcao -- e mesmo devolvendo so booleano, isso e um
--   oraculo de existencia. Mesma disciplina de "tabela nova nasce exposta".
revoke execute on function public.participou_da_conversa(uuid) from public;
revoke execute on function public.participou_da_conversa(uuid) from anon;
grant  execute on function public.participou_da_conversa(uuid) to authenticated;

-- ── 2. A policy ───────────────────────────────────────────────────────────
-- Le quem: (a) e o vendedor, (b) e o comprador ATUAL, (c) JA ESCREVEU ali.
-- O ramo (c) e o unico que sobrevive ao buyer_id ser zerado -- e por isso
-- que ele existe.
drop policy if exists mkt_msg_participantes_leem on public.marketplace_mensagens;

create policy mkt_msg_participantes_leem on public.marketplace_mensagens
  for select
  using (
    exists (
      select 1 from public.marketplace m
       where m.id = marketplace_mensagens.anuncio_id
         and (m.user_id = (select auth.uid()) or m.buyer_id = (select auth.uid()))
    )
    or public.participou_da_conversa(marketplace_mensagens.anuncio_id)
  );

-- ── O QUE ISTO NAO RESOLVE ────────────────────────────────────────────────
-- A policy devolve o ACESSO; nao devolve a TELA. Continuam pendentes, e sao
-- codigo de aplicacao, nao schema:
--   - NegociacoesTab.tsx:361-372 filtra por buyer_id e so poe no historico
--     `concluido`/`cancelado` -- conversa liberada some das duas abas;
--   - ChatDock.tsx:381-385 mostra "Conversa indisponivel";
--   - api/marketplace/[id]/contato/route.ts:11 fecha o WhatsApp da
--     contraparte fora dos status de negociacao.
-- Sem esses tres, o usuario TEM direito de ler e nao encontra onde.

-- ── ROLLBACK ──────────────────────────────────────────────────────────────
--   drop policy mkt_msg_participantes_leem on public.marketplace_mensagens;
--   create policy mkt_msg_participantes_leem on public.marketplace_mensagens
--     for select using (exists (select 1 from marketplace m
--       where m.id = marketplace_mensagens.anuncio_id
--         and (m.user_id = (select auth.uid()) or m.buyer_id = (select auth.uid()))));
--   drop function public.participou_da_conversa(uuid);
