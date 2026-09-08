-- Loja ganha TikTok, YouTube, X/Twitter e Discord
--
-- POR QUE (08/09/2026): a loja so tinha `website`, `instagram` e `facebook`.
-- Medido antes de escolher: das 12 lojas, **9 preencheram o instagram e
-- NENHUMA preencheu o facebook**. Ou seja, ter o campo nao gera uso -- o que
-- decide e qual rede o publico realmente ocupa. Dai as quatro novas serem
-- escolha do Du, nao uma lista generica de redes.
--
-- `twitter` e nao `x`: a rede mudou de nome, a coluna nao precisa mudar de
-- sentido. Uma coluna chamada `x` num SELECT nao diz nada; o rotulo da tela e
-- que carrega o nome novo ("X (Twitter)").
--
-- TEXT e nao URL validada: o mesmo tratamento que instagram/facebook ja tem.
-- Quem normaliza e `normalizarUrlSocial` na pagina da loja, que aceita tanto
-- "instagram.com/loja" quanto a URL inteira -- o lojista digita como quiser.
--
-- CUSTO: `lojas` tem 12 linhas. `add column` sem default e mudanca de
-- catalogo, nao reescreve tabela.

alter table public.lojas add column if not exists tiktok  text;
alter table public.lojas add column if not exists youtube text;
alter table public.lojas add column if not exists twitter text;
alter table public.lojas add column if not exists discord text;

comment on column public.lojas.tiktok  is 'Perfil no TikTok. URL ou handle -- normalizado na exibicao.';
comment on column public.lojas.youtube is 'Canal no YouTube. URL ou handle -- normalizado na exibicao.';
comment on column public.lojas.twitter is 'Perfil no X (ex-Twitter). Coluna mantem o nome antigo de proposito.';
comment on column public.lojas.discord is 'Convite do servidor no Discord. Servidor de loja e comum no TCG.';

-- ── GRANTS: nada a fazer, e isto e proposital ────────────────────────────
-- `lojas` ja tem RLS e as policies existentes valem pra linha inteira, nao
-- por coluna -- entao coluna nova herda exatamente a mesma regra de quem
-- pode ler e escrever a loja. E a ESCRITA passa pela whitelist das rotas
-- (api/lojas e api/lojas/[id]), nao direto do cliente: sem entrar naquela
-- lista, o campo novo simplesmente e ignorado no PATCH.

-- ── ROLLBACK ─────────────────────────────────────────────────────────────
--   alter table public.lojas
--     drop column tiktok, drop column youtube,
--     drop column twitter, drop column discord;
