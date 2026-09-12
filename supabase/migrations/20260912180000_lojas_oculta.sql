-- Loja ATIVA que nao aparece em lugar publico nenhum: o estado de teste.
--
-- ★ POR QUE UMA COLUNA NOVA (12/09/2026). O Du pediu "pode reativar a loja, so
-- retira ela da vitrine para ninguem acessar" -- e esse estado NAO existia.
-- `status = 'ativa'` e o gate em 21 lugares do codigo, e e o MESMO gate que
-- libera cadastrar produto, abrir o Connect e fechar checkout. `pendente` e
-- `inativa` esconderiam a loja, mas bloqueiam justamente o que se quer testar:
-- com `inativa` o /produtos recusa com "sua loja precisa estar ativa".
--
-- Entao: `ativa` continua significando "funciona", e `oculta` passa a
-- significar "nao se acha". Sao dois eixos, e antes disto estavam colados num.
--
-- ★ QUEM FILTRA E QUEM NAO FILTRA e a parte que importa:
--   FILTRA (descoberta publica)  -> guia /lojas, /lojas/[slug], sitemap,
--        lojas no /marketplace, contagem da /para-lojistas, anuncioPublico.
--   NAO FILTRA (transacao)       -> checkout de carta e de produto, carrinho,
--        cotacao de frete, connect/onboard, produtos, track-click, admin.
--   E deliberado: se a transacao filtrasse, a loja de teste nao testaria nada.
--
-- ★ ORDEM DE APLICACAO, e ela nao e opcional -- sao TRES passos nesta ordem:
--   1. ESTA MIGRATION. Se o deploy subir antes, as 6 consultas passam a pedir
--      uma coluna que nao existe e o PostgREST devolve erro em todas: guia,
--      pagina da loja, sitemap, mapa de lojas do marketplace, contagem da
--      landing e TODA pagina de anuncio caem juntas. O /lojas ainda por cima
--      da `throw` dentro do unstable_cache, de proposito, entao vira 500.
--   2. o deploy com os filtros.
--   3. so ai marcar a loja (`oculta = true`). Ao contrario, ela aparece no
--      guia publico na janela entre o passo 1 e o passo 2.
--
-- Default false: nenhuma loja de verdade muda de comportamento.
alter table public.lojas
  add column if not exists oculta boolean not null default false;

comment on column public.lojas.oculta is
  'true = loja funciona mas nao aparece em superficie publica (guia, pagina, sitemap, marketplace, anuncio). Para teste. Ver 20260912180000_lojas_oculta.sql.';
