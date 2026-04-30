# BYNX — Master Context

> **Última atualização:** 30 de abril de 2026 (sessão 25, fechamento)
> **Próxima sessão:** 26 — frente imediata é bug `full_name` em /api/admin/tickets, depois migração de preços R6

---

## 🧭 Quem somos

- **Du** — founder/dev, único responsável por produto e código
- **Mia** — instância de Claude que trabalha como par técnico do Du
- **Bynx** — plataforma BR de Pokémon TCG (bynx.gg). Pokédex 22.861 cartas, scan IA, preços em reais por variante, marketplace, painel de lojistas B2B
- **Stack:** Next.js 16.2.4 + React 19 (Turbopack), Supabase `hvkcwfcvizrvhkerupfc`, Vercel `prj_X1CUMTLMwTL77trWqZdDdmBI9PRC` (team `team_FK9fHseL9hy5mbNR6c0Q8JuK`), Node 24.x
- **Repo:** `brazildigital1403/tcg-invest` (público, .env nunca commitado)
- **Analytics:** GTM `GTM-N94DLM4H`, GA4 `G-1DRTZH1KVH` (gated por cookie consent LGPD desde sessão 25)
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
- **R21 (NOVA, sessão 25 confirmada):** antes de fazer JOIN via supabase-js (`select('outra_tabela!inner(...)')`), verificar `information_schema.table_constraints` pra confirmar que a FK existe — JOIN sem FK retorna `[]` silenciosamente. Causa do bug Mega Charizard na sessão 24.
- **R22 (NOVA, sessão 25):** quando `web_fetch` em GitHub raw falhar com `PERMISSIONS_ERROR`, **pedir Du anexar arquivo do Mac diretamente**. Não tentar reconstruir o arquivo de memória (Regra 20 já cobria, mas a tool de fetch não é confiável em todas as sessões).

---

## 🚢 Sessão 25 — entregas

**Frente única: Cookie Banner LGPD.** Pendência da sessão 24 (tools caíram no meio) — refeita do zero com tools normais.

### 1 deploy READY:
- `4168d77` — `feat(lgpd): cookie banner com gate de consent no GTM` — deploy `dpl_DGR9qeHdVE3LmRmjkj1MqSJzgkBk`

### Arquivos entregues (zip `bynx-cookie-banner-v25.zip`):
- **NOVO** `src/components/ui/CookieBanner.tsx` (190 linhas) — soft banner rodapé, 2 botões (Aceitar todos / Apenas essenciais), localStorage `bynx_cookie_consent`
- **EDIT** `src/app/layout.tsx` (261 linhas) — 3 mudanças cirúrgicas:
  1. `+import CookieBanner from "@/components/ui/CookieBanner"`
  2. Gate IIFE no `<Script>` do GTM: `try { if (w.localStorage.getItem('bynx_cookie_consent') !== 'accepted') return; } catch(e) { return; }`
  3. `<CookieBanner />` antes do `</ModalProvider>`

### Validação em produção (5 cenários todos ✅):
1. Anônimo sem consent → banner aparece, GTM bloqueado, localStorage `null` ✓
2. Aceitar todos → reload, GTM passa a carregar (`gtm.js` 200 OK + `js?id=G-1DRTZH1KV…` GA4 + `collect?v=2…` beacon), localStorage `accepted` ✓
3. Apenas essenciais → banner some sem reload, GTM continua bloqueado, localStorage `rejected` ✓
4. Hard refresh → banner não volta ✓
5. Limpar localStorage → banner volta ✓

### Decisões técnicas registradas:
- Soft banner no rodapé (não modal central)
- 2 botões (não picker granular tipo Cookiebot)
- Reload no aceite (`window.location.reload()`) — necessário pq GTM checa localStorage no início do `<Script>`
- `<noscript>` do GTM mantido SEM gate (decisão consciente, <0.5% dos usuários sem JS)
- `mounted` state no banner pra evitar hydration mismatch (localStorage é client-only)
- `try/catch` no localStorage cobre Safari modo privado: default conservador é GTM bloqueado

---

## 🎯 Pendências (priorizadas pra lançamento)

### Alta — pré-lançamento bloqueador
- 🟡 **Bug `full_name` em `src/app/api/admin/tickets/route.ts:51`** — coluna não existe mais (renomeada pra `name`), quebra listagem de tickets no admin. Cirúrgico, 15-30min. **Próxima frente da sessão 26.**
- 🔴 **01/05/2026 (hoje sexta) — Migração de preços (R6):** card_prices→pokemon_cards, autocomplete por nome, Pokédex Supabase, remover dependência Liga link. 6-10h multi-sessão. Maior frente do roadmap.
- 🟡 **Fase 2 GTM/GA4 painel** (~30-45min, sem código) — 4 variáveis Data Layer + 5 triggers Custom Event + 5 tags GA4 Event + Custom Definitions. Sem isso os 5 eventos custom (`loja_clique`, `pro_upgrade_initiated/completed`, `first_card_added`, `signup_completed`) ficam disparando no `dataLayer` mas não chegam em GA4.
- 🟢 **SEO Fase 2:** Search Console (verificação via GTM), Bing Webmaster Tools, Lighthouse audit (alvo 90+). 1-2h.

### Média — pós-lançamento
- 🟡 Alerta proativo `[webhook] CRITICAL` (Sentry/email) — 1-2h
- 🟡 V6 cosmético removendo logs `[webhook/debug]` (em 2-3 semanas)
- 🟡 Métricas avançadas Admin (conversão trial→Pro, tempo resposta tickets) — 2-3h

### Baixa
- 🔵 26/05/2026 — ZenRows renova ($227.63), rodar `scan-sets-final.ts`
- 🔴 Junho — Passo 8 Stripe per-loja (6-10h)

---

## 🧠 Aprendizados-chave da sessão 25

1. **Backup local complementa Vercel.** Vercel guarda deploys mas não substitui backup do código local + `.env`. Ritual de backup periódico (zip do `/Users/eduardowillian/tcg-app/` excluindo `node_modules` e `.next`) recomendado.

2. **`web_fetch` em GitHub raw pode bloquear com `PERMISSIONS_ERROR` mesmo em URLs públicas.** Isso aconteceu na abertura da sessão 25 ao tentar puxar `layout.tsx`. Fallback correto: pedir Du anexar diretamente do Mac. **Regra R22 nasce daí.**

3. **Cookie banner com gate de consent no GTM funciona ponta a ponta.** O padrão IIFE-com-checagem-de-localStorage é mais simples que adapter de Consent Mode v2 do Google e suficiente pra LGPD. Para GDPR (futuro EU expansion) seria diferente — Consent Mode v2 com granularidade analytics/ads/personalization seria necessário.

4. **`Cache-Control: private, max-age=900` no `gtm.js`** é comportamento padrão do Google. Browser cacheia 15min por usuário. Não confundir com cache de SSR do Vercel.

5. **Validação cliente-side só dá pra fazer com browser.** Runtime logs do Vercel (`get_runtime_logs`) só pegam erros server-side. Cookie banner, hydration, localStorage — tudo isso só se valida com olho no browser real, conforme aprendido na sessão 24.

---

## 🛠️ Stack & ferramentas

- **Supabase MCP** — usado ativamente pra queries, migrations, validação de schema
- **Vercel MCP** — usado pra `list_deployments`, `get_runtime_logs`, validação de deploy
- **ZenRows** — Startup plan, renovação 26/05
- **Liga Pokémon** — fonte de preços BR, formato URL `?view=cards/search&card=ed%3D{CODE}`
- **bynx.gg** — domínio principal, robots ok, sitemap dinâmico, **cookie banner LGPD ativo**

---

## 📦 Estado de produção (snapshot 30/abr/2026, 22:00 BRT)

- Último deploy: `dpl_DGR9qeHdVE3LmRmjkj1MqSJzgkBk` (commit `4168d77`) — READY
- Branch local = `origin/main` = produção (verificado via `git status` + `git fetch`)
- Runtime errors últimas 24h: **0**
- Cookie banner LGPD: **ativo e validado em produção**
- GTM/GA4: carregando após consent, beacon `collect` chegando

**Plataforma está funcional em produção.** Falta polimento técnico (frentes da seção 🎯) pra estar pronta pra divulgação pública agressiva.
