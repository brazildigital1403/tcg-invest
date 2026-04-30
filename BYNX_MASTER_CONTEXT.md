# BYNX — Master Context

> **Última atualização:** 30 de abril de 2026 (sessão 24, fechamento)
> **Próxima sessão:** 25 — frente imediata é fechar o cookie banner LGPD

---

## 🧭 Quem somos

- **Du** — founder/dev, único responsável por produto e código
- **Mia** — instância de Claude que trabalha como par técnico do Du
- **Bynx** — plataforma BR de Pokémon TCG (bynx.gg). Pokédex 22.861 cartas, scan IA, preços em reais por variante, marketplace, painel de lojistas B2B
- **Stack:** Next.js 16.2.4 + React 19 (Turbopack), Supabase `hvkcwfcvizrvhkerupfc`, Vercel `prj_X1CUMTLMwTL77trWqZdDdmBI9PRC` (team `team_FK9fHseL9hy5mbNR6c0Q8JuK`), Node 24.x
- **Repo:** `brazildigital1403/tcg-invest` (público, .env nunca commitado)
- **Analytics:** GTM `GTM-N94DLM4H`, GA4 `G-1DRTZH1KVH`
- **Stripe:** sandbox limpo, webhook V5 estável
- **User teste:** eduardo, ID `122267ef-5aeb-4fd0-a9c0-616bfca068bd`, admin `eduardo@brazildigital.ag`
- **Pastas Mac:** origem ZIPs `/Users/eduardowillian/Downloads/_____tcg-app/` (5 underscores), repo local `/Users/eduardowillian/tcg-app/`

---

## 📜 Regras Bynx (operacionais)

- **R3** Paths espelham repo (`src/app/...`)
- **R4** Bloco git único (`add+commit+push` encadeados com `&&`)
- **R5** SEMPRE arquivo 100% completo, NUNCA diff
- **R6** Migração de preços `card_prices`→`pokemon_cards` a partir de 01/05/2026
- **R7** CardItem é padrão (`src/components/ui/CardItem.tsx`)
- **R8** Paths absolutos do Mac
- **R9** Fim de sessão → gerar BYNX_MASTER_CONTEXT.md
- **R17** Auth admin em camadas (HMAC cookie + middleware + `requireAdmin()`)
- **R18** Inspecionar schema antes de SQL
- **R19** Validar versão de API antes de codar
- **R20** Sempre buscar arquivo da versão mais recente em produção ANTES de qualquer modificação. Web_fetch GitHub raw OU pedir Du anexar do Mac

**Candidata R21 (sessão 25 confirmar):** antes de fazer JOIN via supabase-js (`select('outra_tabela!inner(...)')`), verificar `information_schema.table_constraints` pra confirmar que a FK existe — JOIN sem FK retorna `[]` silenciosamente. Causa do bug Mega Charizard.

---

## 🚢 Sessão 24 — entregas

13 deploys, todos READY:

1. `c3c6bf0d` — GTM-N94DLM4H instalado via next/script
2. `2adf813f` — analytics.ts + 5 eventos custom (loja_clique, pro_upgrade_initiated/completed, first_card_added, signup_completed)
3. `cc1453b6` — context provisional GTM
4. `6b300258` — 🆘 RECUPERAÇÃO landing (incidente: zip antigo sobrescreveu relançamento da sessão 23)
5. `6e12d298` — /para-lojistas v1
6. `00354ba5` — /para-lojistas final B2B + paleta azul/roxo + FAQ multi-loja
7. `2ac19436` — master context atualizado (provisório)
8. `481e24c2` — moderação Marketplace soft-delete (`removido_em`, `removido_motivo`, `removido_por`)
9. `4bba0d08` — sitemap fix (/para-lojistas + /separadores)
10. `3134f7c8` — Pokédex stat hero capturados reativa aos filtros
11. `38c32299` — fix Pokédex capturados via base_pokemon_names + FK migration `user_cards_fk_pokemon_cards`
12. (após FK) — Marcação de carta exata na vista 2 da Pokédex (borda + badge laranja por carta)
13. (último) — Termos + Privacidade atualizados (data 30/abr, B2B, moderação, GTM/GA4, LGPD <13 anos)

### Schema migrations aplicadas

- `marketplace_moderation_soft_delete` — `removido_em timestamp`, `removido_motivo text`, `removido_por uuid REFERENCES users(id) ON DELETE SET NULL`, índice parcial
- `user_cards_fk_pokemon_cards` — FK `user_cards.pokemon_api_id → pokemon_cards.id ON DELETE SET NULL`

### Documentos legais (estado final)

- **Termos** (184 linhas, 30/abr/2026): §3.1 idade mínima LGPD <13, §4 planos consumer (R$29,90/R$249), **§4.1 Lojistas (NOVA)** — Básico grátis, Pro R$39, Premium R$89, beta 27 vagas, multi-loja, aprovação 48h. §5.1 Moderação ativa
- **Privacidade** (243 linhas, 30/abr/2026): §2.1 add data nascimento + marketing opcional, **§2.4 Lojistas B2B (NOVA)**, §4 add Google GTM/GA4 + ZenRows, **§8 Cookies reescrito** com 8.1 essenciais / 8.2 analíticos GA4 com opt-out / 8.3 sem publicidade

### Arquivos da Pokédex (estado: 699 linhas)

- Stat hero reativa (`useMemo`, `fmtNum`, `capturados`, `totalNoFiltro`, `temFiltroAtivo`, `completou`, `stagiou`)
- `loadOwnedPokemons(uid)` faz JOIN `.select('pokemon_api_id, pokemon_cards!inner(base_pokemon_names)')` — popula `ownedNames` (Set de nomes-base) + `ownedCardIds` (Set de IDs exatos)
- Vista 2: wrapper visual ao redor do `<CardItem>` com borda laranja `rgba(245,158,11,0.25)`, fundo `rgba(245,158,11,0.06)`, badge ✓ 22px no canto superior direito (zIndex 3)
- `handleAddCard` atualiza ambos os Sets na hora

---

## 🍪 FRENTE PENDENTE — Cookie Banner LGPD (PRÓXIMA SESSÃO PRIORIZA)

Decisões já tomadas pelo Du (não precisa perguntar de novo):

- **Estilo:** Soft banner no rodapé (Opção A) — não modal central
- **Botões:** 2 botões (Aceitar todos + Apenas essenciais)
- **Persistência:** `localStorage 'bynx_cookie_consent' = 'accepted' | 'rejected'`
- **Reload ao aceitar:** sim, `window.location.reload()` é o caminho
- **Noscript do GTM:** mantém sem bloqueio (decisão consciente, <0.5% usuários)

Código completo dos 2 arquivos foi entregue no chat (`CookieBanner.tsx` 173 linhas + `layout.tsx` modificado 258 linhas). **A entrega ficou no chat porque as ferramentas de filesystem da Mia caíram no meio da sessão.** Du não chegou a aplicar no Mac antes de fechar a sessão.

**Status no início da sessão 25:** zero do cookie banner aplicado. Recomeçar do zero é OK — a próxima Mia tem tools normais e pode entregar o zip direito.

---

## 🎯 Outras pendências (priorizadas)

### Alta
- 🔴 **01/05/2026 (sexta) — Migração de preços (R6)**: card_prices→pokemon_cards, autocomplete por nome, Pokédex Supabase, remover dependência Liga link
- 🟡 Bug `full_name` em `src/app/api/admin/tickets/route.ts` linha 51 (provável erro 500 listando tickets — coluna não existe no schema atual)

### Média
- 🟡 Fase 2 GTM/GA4 painel (~30-45min): criar 4 variáveis Data Layer, 5 triggers Custom Event, 5 tags GA4 Event, Custom Definitions
- 🟢 SEO Fase 2: Search Console (verificação via GTM), Bing Webmaster Tools, Lighthouse audit (alvo 90+)
- 🟡 Alerta proativo `[webhook] CRITICAL` (Sentry/email)
- 🟡 V6 cosmético removendo logs `[webhook/debug]` (em 2-3 semanas)

### Baixa
- 🔵 26/05/2026 — ZenRows renova ($227.63), rodar `scan-sets-final.ts`
- 🔴 Junho — Passo 8 Stripe per-loja (6-10h)
- 🟡 Métricas avançadas Admin (conversão trial→Pro, tempo resposta tickets)

---

## 🧠 Aprendizados-chave da sessão 24

1. **GitHub raw com cache stale induz alucinação:** o conteúdo retornado por `web_fetch` em `https://raw.githubusercontent.com/...` foi várias vezes uma versão **antiga** do arquivo, mesmo com Vercel mostrando deploy do commit certo. **Sempre validar via terminal** (`git log -1 src/file.tsx`, `grep -c`) antes de assumir reverter. Pedir Du anexar do Mac é mais seguro.

2. **JOIN supabase-js silencioso sem FK:** `select('outra_tabela!inner(...)')` retorna `[]` silenciosamente se a FK não estiver declarada em `information_schema.table_constraints`. Causa raiz do bug "Mega Charizard X ex" não aparecer capturado. Migration `user_cards_fk_pokemon_cards` consertou.

3. **`cleanPokemonName` regex era frágil:** não cobria `Mega`, `(número)`, prefixos `Team Rocket's`. Substituída por JOIN com `pokemon_cards.base_pokemon_names` (fonte oficial da API Pokémon TCG).

4. **Repo público é seguro:** validado via terminal — `.env` nunca commitado, 20 matches em src/ são `process.env.SUPABASE_SERVICE_KEY!` (correto, não vazamento), zero `sk_live_/whsec_/JWT` hardcoded.

5. **Tools podem cair no meio da sessão:** as tools de filesystem da Mia (`create_file`, `bash_tool`, `present_files`) caíram durante a frente do cookie banner. Recurso: colar código completo no chat. Não-ideal mas funciona. **Próxima Mia: começar nova sessão revalida o ambiente.**

---

## 🛠️ Stack & ferramentas

- **Supabase MCP** — usado ativamente pra queries, migrations, validação de schema
- **Vercel MCP** — usado pra `list_deployments`, `get_runtime_logs`, validação de deploy
- **ZenRows** — Startup plan, renovação 26/05
- **Liga Pokémon** — fonte de preços BR, formato URL `?view=cards/search&card=ed%3D{CODE}`
- **bynx.gg** — domínio principal, robots ok, sitemap dinâmico
