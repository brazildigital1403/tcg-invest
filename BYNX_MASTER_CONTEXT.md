# BYNX_MASTER_CONTEXT.md
> **Última atualização:** Sessão 27 · 03/maio/2026 (v2 — pós-auditoria de código)
> **Próxima sessão:** S28 — após Stripe `charges_enabled: true`

---

## 📌 Identidade & Stack

**Bynx** é uma plataforma brasileira de organização e valoração de coleções de Pokémon TCG, com ambição de ser hub social + marketplace + diretório de lojas. Domínio: **bynx.gg** (Instagram oficial: **@bynx.gg**).

**Du** é o founder + único dev. **Mia** (Claude) é parceira de desenvolvimento across long technical sessions.

### Stack confirmada via auditoria (S27)

```json
{
  "framework": "Next.js 16.2.4 + React 19.2.4",
  "language": "TypeScript 5",
  "db": "Supabase 2.101.1 (project hvkcwfcvizrvhkerupfc)",
  "payments": "Stripe 17.0.0",
  "email": "Resend 4.0.0",
  "charts": "Chart.js 4.5.1 + Recharts 3.8.1",
  "css": "Tailwind 4 + inline styles",
  "deploy": "Vercel (prj_X1CUMTLMwTL77trWqZdDdmBI9PRC, team team_FK9fHseL9hy5mbNR6c0Q8JuK)"
}
```

**Tamanho do produto (auditado em 03/mai/2026):**
- **34 páginas** (`page.tsx`)
- **56 API routes** (`route.ts`)
- **34 componentes** (em 4 módulos: dashboard, lojas, marketplace, ui)
- **12 libs** em `src/lib/`
- **3 crons** configurados em `vercel.json`
- **23 tabelas** no Postgres (Supabase)
- **6.1 MB** de código

---

## 🏗️ Mapa do produto (auditoria completa S27)

### Páginas públicas (sem login)
- `/` — landing
- `/cadastro`, `/login`, `/reset-password` — auth
- `/lojas`, `/lojas/[slug]` — Guia de Lojas Bynx
- `/perfil/[id]` — perfil público (suporta UUID OU username, redireciona UUID→username automaticamente)
- `/carta/[id]` — página de carta individual
- `/pokedex` — Pokédex pública
- `/para-lojistas` — landing B2B
- `/termos`, `/privacidade` — legal LGPD
- `/suporte`, `/suporte/[id]` — suporte público

### Páginas autenticadas (middleware bloqueia suspensos)
- `/dashboard-financeiro` (726 linhas) — dashboard de coleção do user
- `/minha-colecao` (838 linhas) — gestão de cartas
- `/minha-conta` (919 linhas — maior arquivo) — perfil + plano + Stripe portal
- `/minha-loja`, `/minha-loja/nova`, `/minha-loja/[id]`, `/minha-loja/[lojaId]/plano` — gestão B2B
- `/marketplace` (568 linhas) — vitrine + meus + negociações
- `/separadores` — geração de separadores customizados
- `/pro-ativado` — celebração pós-checkout

### Painel admin (`/admin/*` — HMAC cookie auth)
- `/admin/page.tsx` — dashboard com métricas (tickets, users, cards)
- `/admin/login`
- `/admin/financeiro` — lançamentos + despesas recorrentes
- `/admin/lojas`, `/admin/lojas/[id]/editar`
- `/admin/marketplace` — moderação (soft-delete com motivo)
- `/admin/tickets`, `/admin/tickets/[id]`
- `/admin/users`, `/admin/users/[id]` — grant Pro, extend trial, suspend, delete

### API routes (56 total)
**Públicas/user:**
- `/api/cards`, `/api/preco`, `/api/historico`, `/api/pokedex`
- `/api/contact` — formulário de contato
- `/api/scan-cards` — **Claude Vision (claude-opus-4-5 ⚠️)** pra reconhecer cartas
- `/api/exchange-rate` — USD/EUR pra fallback
- `/api/lojas`, `/api/ranking` (ranking é só por carta, não por user)
- `/api/tickets`, `/api/email`, `/api/traduzir`

**Stripe:**
- `/api/stripe/checkout` — cria Checkout Session (8 planos)
- `/api/stripe/webhook` — recebe eventos (R7-PAY Commit 2)
- `/api/stripe/portal` — Customer Portal
- `/api/stripe/success` — landing pós-checkout

**Admin:** `/api/admin/*` (login, logout, metrics, lojas, tickets, users)

**Crons:** `/api/cron-portfolio`, `/api/cron-notificacoes`, `/api/cron-trial-emails`

**Sync:** `/api/sync-card-sets`, `/api/sync-sets`

### Libs (`src/lib/` — 12 arquivos)

| Lib | Linhas | Função |
|---|---|---|
| `email.ts` | 672 | 13 templates Resend (B2C laranja, B2B azul-roxo) |
| `uploadFoto.ts` | 217 | Upload avatar/loja pra Supabase Storage |
| `scraperBrowser.ts` | 127 | Scraping cartas (provavelmente ZenRows wrapper) |
| `lojas-auth.ts` | 127 | Auth de lojistas (separada da admin) |
| `admin-auth.ts` | 100 | HMAC-SHA256, 7 dias, anti-timing-attack |
| `analytics.ts` | 88 | GA4 dataLayer push (5 eventos) |
| `calcPatrimonio.ts` | 76 | Cálculo canonical de patrimônio (5 variantes) |
| `checkCardLimit.ts` | 45 | LIMITE_FREE=6, **LIMITE_FREE_MKTPLACE=3 ⚠️** |
| `isPro.ts` | 40 | getUserPlan({ isPro, plano, isTrial, trialDaysLeft }) |
| `authFetch.ts` | 20 | Wrapper de fetch com Bearer token |
| `notificacoes.ts` | 19 | criarNotificacao + marcarTodasLidas |
| `supabaseClient.ts` | 5 | Client com anon key |

### Componentes (`src/components/` — 34 arquivos)

**Landing (raiz):** About, AddCard, CTA, Header, Hero, HowItWorks, PriceChart, Pricing

**dashboard/:** AddCardModal, CardRankings, PortfolioStats

**lojas/:** AnalyticsCard, CardLoja, FiltrosGuia, FormLoja, GaleriaFotos, LojistasFAQ, TrackedLink

**marketplace/:** AnunciarModal (336), AvaliacaoModal (132), NegociacoesTab (429)

**ui/:** AppLayout (718), Button, Card, **CardItem (canonical, 324)**, CookieBanner, Icons, OnboardingModal (206), PublicFooter, PublicHeader, ScanModal, Selection, UpgradeBanner, useAppModal

### Crons configurados (`vercel.json`)

```
cron-notificacoes:  0 4 * * *    → 04:00 UTC — alertas valorização/desvalorização ≥10%
cron-portfolio:     0 5 * * *    → 05:00 UTC — snapshot portfolio_history (1/dia)
cron-trial-emails:  0 12 * * *   → 12:00 UTC — trial 5º dia (2 restantes) + 7º (1 restante)
```

### Tabelas Supabase (23 no schema public)

| Tabela | Rows | Função |
|---|---|---|
| `pokemon_cards` | 22.861 | Catálogo Pokémon TCG completo (canonical de preços) |
| `pokemon_species` | 1.025 | Pokédex completa (PT/EN) |
| `pokemon_sets` | 172 | Sets com logo/symbol/release_date |
| `users` | 8 | name, email, cpf, city, whatsapp, **username**, plano, scan_creditos, separadores_desbloqueado, trial_expires_at, suspended_at, **termos_aceitos_em, marketing_aceito, data_nascimento** (LGPD) |
| `user_cards` | 58 | Coleção do user (variante, quantity, pokemon_api_id) |
| `marketplace` | 6 | Anúncios (status, condição, variante, buyer_id, **soft-delete moderação**) |
| `transactions` | 2 | buyer/seller/card_name/price |
| `avaliacoes` | 0 | Reviews 1-5★ + comentário (anti-duplicação por unique constraint) |
| `notifications` | 16 | 7 tipos: interesse/enviado/recebido/avaliacao/cancelado/valorizacao/desvalorizacao |
| `portfolio_history` | 40 | Snapshot diário do patrimônio (cron-portfolio) |
| `lojas` | 4 | slug, status, plano (basico/pro/premium), eventos jsonb, visualizacoes, cliques_whatsapp, trial_usado_em |
| `loja_cliques` | 3 | Analytics de cliques nos CTAs (whatsapp/instagram/facebook/website/maps) |
| `tickets` | 3 | Suporte (open/in_progress/resolved/closed, low/normal/high) |
| `ticket_messages` | 6 | Threads de conversa (sender_type: user/admin) |
| `lancamentos` | 17 | Sistema financeiro INTERNO (receita/despesa, valor_bruto/líquido, conciliação Stripe) |
| `despesas_recorrentes` | 4 | Bynx mede própria saúde financeira |
| `stripe_events_processed` | 8 | Idempotência Stripe |

---

## 📅 SESSÃO 27 — 03/maio/2026 (~6h)

### FASE 1 — Migração Stripe TEST → LIVE (✅ COMPLETED)

**Du fez "Choose what to copy"** mantendo Products + Prices + Customer Portal, sem Customers/Subs/Webhooks.

**10 produtos LIVE confirmados:**

| Produto | Price ID LIVE | Preço |
|---|---|---|
| Pro Mensal | `price_1TSvr6PNrv6a7zCFoyRwyfK0` | R$ 29,90/mês |
| Pro Anual | `price_1TSvr6PNrv6a7zCFzUhD56D5` | R$ 249/ano |
| Scan Básico | `price_1TSvr5PNrv6a7zCFE4gjgLKM` | R$ 5,90 (5 créditos) |
| Scan Popular | `price_1TSvr5PNrv6a7zCFXGKpYNU6` | R$ 14,90 (15 créditos) |
| Scan Colecionador | `price_1TSvr6PNrv6a7zCFNDXFmvZU` | R$ 34,90 (40 créditos) |
| Separadores | `price_1TSvr5PNrv6a7zCFlZol94Kc` | R$ 14,90 |
| Lojista Pro Mensal | `price_1TSvr7PNrv6a7zCFNGAplIW0` | R$ 39 |
| Lojista Pro Anual | `price_1TSvr6PNrv6a7zCFtPgUE32X` | R$ 390 |
| Lojista Premium Mensal | `price_1TSvr5PNrv6a7zCFB4pFDmWW` | R$ 89 |
| Lojista Premium Anual | `price_1TSvr6PNrv6a7zCF6qcvwRZh` | R$ 890 |

**Padrão de identificação:** TEST = sufixo `AanyB0hdos`; LIVE = sufixo `PNrv6a7zCF` (=account ID).

**Stripe Account ID LIVE:** `acct_1TMuWQPNrv6a7zCF`

**Webhook LIVE:**
- ID: `we_1TT3XNPNrv6a7zCF1DqNgT4x` ("elegant-inspiration")
- URL: `https://www.bynx.gg/api/stripe/webhook` (com `www.`)
- API: `2026-03-25.dahlia`
- 6 eventos: checkout.session.completed, customer.subscription.deleted/updated, invoice.payment_failed/succeeded, charge.dispute.created
- `STRIPE_WEBHOOK_SECRET` copiado direto pra Vercel (sem trafegar no chat)

**Custom Domain extra:** `checkout.bynx.gg` adicionado (DNS verificado, 3h estabilização — não bloqueia nada).

**12 envs Vercel atualizadas** em 3 blocos, todas marcadas **Sensitive** (esteira #4 da S26 ✅):
- Bloco 1: STRIPE_SECRET_KEY (sk_live_), STRIPE_WEBHOOK_SECRET (whsec_)
- Bloco 2: 6 STRIPE_PRICE_* B2C
- Bloco 3: 4 STRIPE_PRICE_LOJISTA_*

**6 deploys produção** todos READY:
- `dpl_AkR6pez1qqmGyr2aKFpEGY9aGsbs` — auto Bloco 1
- `dpl_3W2w3bHaJGRj7jqh8gJRNryFVL5S` — auto intermediário
- `dpl_AYQ8TRjw27n8rGvvNj4MkxQUTxGQ` — auto intermediário
- `dpl_293p3mdvnomK6vAs1bK1FLRk2vVV` — auto último (com bug envs inconsistentes)
- `dpl_6KiJCGkYC1cEmuXcv8wy1dXYCa7a` — **force redeploy SEM CACHE** (resolveu bug)

### FASE 2 — Bugs encontrados e resolvidos

**Bug 1: "No such price" no checkout**
- 6 erros 500 com TEST IDs aparecendo em chamadas que deveriam usar LIVE
- Causa: Vercel disparou auto-redeploys ANTES das 12 envs estarem todas atualizadas
- Solução: Force redeploy SEM CACHE → re-leu envs frescas
- **Aprendizado:** ao atualizar muitas envs em sequência, sempre fazer force redeploy SEM CACHE no final

**Bug 2: "No such customer" da gabis**
- `cus_UQDqTMrH7GKlPV` existia em TEST mas não LIVE
- Solução: SQL UPDATE limpando `stripe_customer_id` e `stripe_subscription_id` da gabis

### FASE 3 — Bloqueio externo Stripe (PENDING)

Após force redeploy + limpar customer fantasma, novo erro: `Your account cannot currently make live charges`. Du rodou curl direto:

```
charges_enabled: false
capabilities.card_payments: inactive
capabilities.boleto_payments: inactive
disabled_reason: under_review
details_submitted: true
currently_due: []
```

KYC concluído na UI (todas tarefas "Concluída", banner amarelo sumiu) mas capability ainda em revisão interna. Suporte Stripe ofereceu encaminhamento pra especialista. Du aceitou. **Aguardando 1-3 dias úteis.**

### FASE 4 — Limpeza pós-sessão (✅ COMPLETED)

**Subs TEST canceladas via Stripe MCP:**
- `sub_1TSubLAanyB0hdosIBpP8iWd` (gabis Pro Mensal active) → canceled
- `sub_1TStIBAanyB0hdosLmwT83S6` (Lendario Premium trialing) → canceled

**DB limpo:**
- `users.stripe_customer_id` da gabis: NULL
- `users.stripe_subscription_id` da gabis: NULL
- `lojas.stripe_subscription_id` da Lendario: NULL
- `lojas.trial_usado_em` da Lendario: **mantido** (anti-burlagem permanece)

### FASE 5 — Falha de diagnóstico inicial (corrigida)

Mia entregou um roadmap de 5 ondas presumindo que **Marketplace e Perfil Público não existiam** (estavam em "Onda 3" e "Onda 4"). Du corrigiu com prints mostrando que **AMBOS JÁ EXISTEM** em produção e estão bem feitos. Mia errou também ao afirmar que o onboarding estava com botões fake — na verdade os links direcionam corretamente.

Esse erro motivou a **REGRA BYNX 21** (auditoria antes de roadmap).

### FASE 6 — Auditoria completa de código (✅ COMPLETED)

Mia clonou o repo público `brazildigital1403/tcg-invest` via `bash_tool` + `git clone` e fez auditoria minuciosa de **34 páginas, 56 API routes, 12 libs, 3 crons**.

**Achados detalhados na seção seguinte.**

---

## 🔍 ACHADOS DA AUDITORIA (10 itens)

Lista completa de housekeeping/discrepâncias encontradas durante a auditoria de código pós-FASE 6 da S27. Cada um é decisão pendente do Du pra próxima sessão.

### 🚨 Críticos (afetam UX ou receita)

**1. Modelo Claude desatualizado em `scan-cards/route.ts`**
- Atual: `claude-opus-4-5`
- Disponível: **`claude-opus-4-7`** (mais inteligente, melhor reconhecimento visual)
- Impacto: maior precisão no scan = maior conversão Pro/Scan packages
- Esforço: 5min (trocar string)
- Validar custo de input/output tokens

**2. Discrepância LIMITE_FREE_MKTPLACE**
- Código (`checkCardLimit.ts:3`): `LIMITE_FREE_MKTPLACE = 3`
- Du falou: "6 anúncios grátis"
- Investigação: `checkMarketplaceLimit` filtra `not('status', 'in', '("cancelado","concluido")')` — só anúncios ATIVOS contam
- Hipótese: print do Du tinha 6 anúncios sendo 3 ativos + 3 concluídos
- **Decisão pendente:** confirmar se 3 é o número certo, ou mudar pra 6

### 🟡 Importantes (debt técnico)

**3. `csv-parser` é dep zumbi**
- `package.json` tem dependência mas `0 uses` no código
- Provavelmente começou importação CSV e abandonou
- Decisão: remover (`npm uninstall csv-parser`) OU implementar feature de importação

**4. `sendTrialExpiring1Email` órfã**
- Existe em `email.ts:191` mas NUNCA é chamada no `cron-trial-emails`
- Cron usa: `5Email` no 2º dia, `7Email` no 1º dia (nomenclatura confusa)
- Decisão: remover função OU usar adequadamente

**5. Stripe API version inconsistente**
- Código (`checkout/route.ts`, `webhook/route.ts`): `2025-03-31.basil`
- Webhook LIVE configurado na S27: `2026-03-25.dahlia`
- Stripe é retrocompatível, mas vale uniformizar pra evitar comportamento inesperado em campos novos

**6. Cálculo de patrimônio duplicado**
- `lib/calcPatrimonio.ts` é canonical, mas `AppLayout.tsx` tem cálculo INLINE (linhas 220-232)
- DRY violation — se mudar regra em um lugar e esquecer outro, dá divergência no header vs dashboard
- Refactor: AppLayout deve importar `calcPatrimonio()`

**7. Tipo de notificação fantasma**
- `AppLayout.tsx` referencia `n.type === 'marketplace'` (cor laranja)
- Enum em `lib/notificacoes.ts` só tem: `interesse | enviado | recebido | avaliacao | cancelado | valorizacao | desvalorizacao`
- Notificações tipo `'marketplace'` **nunca acontecem** — fallback pra azul
- Decisão: adicionar `'marketplace'` ao enum OU remover do AppLayout

### 🟢 Menores (polimento)

**8. Admin dashboard sem métricas críticas**
- `/admin/page.tsx` mostra: tickets, users, cards
- **Faltam:** marketplace (anúncios ativos, vendas, GMV), lojas (planos, cliques, conversão), receita (MRR, ARR, churn), notificações enviadas
- Detalhes existem em sub-páginas mas o overview pode mostrar mais
- Esforço: ~3h pra adicionar 4-6 cards no dashboard + endpoint

**9. `/minha-loja/[id]` E `/minha-loja/[lojaId]` coexistem**
- `[id]/page.tsx` (730 linhas) — provavelmente página antiga
- `[lojaId]/plano/page.tsx` (788 linhas) — página de plano (criada na S26)
- Não é exatamente duplicação (funções diferentes), mas vale uniformizar nome do param
- Decisão: refactor pra uma convenção só

**10. Nomenclatura confusa nos emails de trial**
- `sendTrialExpiring5Email` — envia em 2 dias restantes (5º dia do trial de 7)
- `sendTrialExpiring7Email` — envia em 1 dia restante (7º dia do trial)
- Mais legível: `sendTrialExpiring2DaysEmail` e `sendTrialExpiring1DayEmail`
- Decisão: rename ou comentar bem

---

## ✅ COISAS BEM FEITAS (validadas na auditoria)

Pra registro do que tá sólido e não precisa mexer:

### Infra & Segurança
- **Middleware fail-closed:** se `verifyAdminToken` joga exceção, BLOQUEIA (não libera)
- **HMAC-SHA256 admin auth:** Web Crypto API funciona Edge + Node, anti-timing-attack via `constTimeEqual`
- **Sessão admin 7 dias** com cookie httpOnly `bynx_admin`
- **Bloqueio de users suspensos:** middleware decodifica JWT do cookie Supabase, checa `suspended_at`, redireciona pra `/?suspended=1` E LIMPA cookie de auth
- **CRON_SECRET autenticado** em todos os 3 crons (Bearer token)
- **`maxDuration` configurado** em crons (60s portfolio/notif, 30s trial)

### Marketplace
- **6 status bem modelados:** disponivel → reservado → em_negociacao → enviado → concluido (+ cancelado)
- **Transferência atômica:** ao confirmar recebimento, delete card do vendedor + insert no comprador + insert em transactions + status concluido (3 queries)
- **Anti-duplicate:** AnunciarModal filtra cartas já anunciadas (status disponivel/reservado/em_negociacao/enviado)
- **Notificação automática** em cada etapa via `criarNotificacao`
- **WhatsApp redirect** com mensagem pré-formatada: `Olá! Vi seu anúncio no Bynx e tenho interesse na carta *X* por R$ Y. Podemos negociar?`
- **Soft-delete moderação:** admin pode remover anúncio com `removido_motivo` preservando histórico (FK ON DELETE SET NULL)
- **Mobile responsive** com breakpoints 768px e 400px
- **UpgradeBanner** quando user atinge limite

### Stripe
- **Idempotência via `stripe_events_processed`** (event_id como PK)
- **Anti-burlagem trial:** `lojas.trial_usado_em` setado quando `subscription.status === 'trialing'` no checkout, validação no checkout antes de criar nova session
- **Customer Portal** habilitado com prorate ON, downgrades immediate
- **`customer_creation: 'always'`** em mode='payment' pra Stripe criar customer em compras one-time (Bug #7 fixed)
- **Diferencia user vs lojista** via metadata
- **Mapeia 11 planos** sincronizados entre checkout/SCAN_PACKAGES e webhook/DESCRICAO_PLANO

### LGPD
- `users.termos_aceitos_em` (timestamp de aceite)
- `users.marketing_aceito` (opt-in pra emails de marketing)
- `users.data_nascimento` (filtro etário potencial)
- Privacidade no perfil: redirect UUID→username automático (não expõe ID interno)
- CookieBanner component (gate de consent GTM)

### Notificações
- **7 tipos:** interesse, enviado, recebido, avaliacao, cancelado, valorizacao, desvalorizacao
- **Cron diário 04:00 UTC** detecta variação ≥10% e gera notificação (lê `pokemon_cards` canonical)
- **Sino no header** com badge vermelho contador (mostra "9+" se >9)
- **Painel renderizado FORA do header** (anti-stacking-context)
- **Cores semânticas por tipo:** valorizacao=verde, desvalorizacao=vermelho, marketplace=laranja (fantasma — ver achado #7), default=azul
- **Auto-fecha ao mudar pathname**

### Email (13 templates Resend)
**B2C (gradient laranja-vermelho):**
- sendWelcomeEmail (7 dias Pro grátis)
- sendTrialExpiring5Email / 7Email / 1Email (1Email órfã — ver achado #4)
- sendNewTicketAdminEmail / TicketCreatedUserEmail / UserReplyAdminEmail / AdminReplyUserEmail / TicketStatusChangedEmail
- sendPurchaseConfirmationEmail

**B2B (gradient azul-roxo Pro / roxo-rosa Premium):**
- sendEmailLojaAprovada / Suspensa / PlanoAlterado

### Perfil público
- URL com `username` (fallback UUID, redireciona automático)
- Avatar com iniciais (cores BRAND laranja-vermelho)
- Gráfico de patrimônio (Recharts) com badge de % no período
- 4 stats: cartas, anúncios ativos, vendas concluídas, reputação
- Top 6 cartas mais valiosas (com badge de valor)
- Progresso por coleção (todos os sets, % completion)
- Lista de anúncios disponíveis
- CTA "Criar conta grátis" pro visitor não logado

### CardItem (componente canonical)
- 3 modos: collection, select, readonly
- 5 variantes com cores próprias (normal/foil/promo/reverse/pokeball)
- Helpers: rarityColor, n (parsing), fmt (currency BRL)
- Suporta tanto formato `user_cards` quanto `pokemon_cards` (card_name vs name)
- exchangeRate prop pra fallback USD/EUR

---

## 📋 REGRAS BYNX (atualizadas)

### REGRA BYNX 1 — Code delivery
- **Sempre entregar 100% completo** dos arquivos — nunca diffs, snippets, "find and replace"
- File paths espelham repo (`src/app/...`, `src/components/...`)
- **Bloco git único** (`git add + commit + push` encadeado com `&&` ou `\` + line break)

### REGRA BYNX 2 — Session close
- Quando Du sinaliza fim de dia, Mia gera `BYNX_MASTER_CONTEXT.md` automaticamente

### REGRA BYNX 3 — CardItem é canonical
- Path: `src/components/ui/CardItem.tsx`
- Modos: collection, select, readonly
- **Sempre usar CardItem em qualquer exibição de carta**

### REGRA BYNX 11 — Esteira pós-lançamento
1. ✅ Migrar env vars Stripe pra Sensitive — concluído S27
2. Sincronização Stripe ↔ Admin (admin altera plano via /api/admin/lojas/[id]/plano deve cancelar/atualizar sub Stripe)
3. Alerting webhook crítico (`[webhook] CRITICAL` → email/Sentry)
4. ✅ Páginas 404/500 customizadas — JÁ TEM (descoberto S27)
5. Backup manual DB pré-lançamento (fazer assim que Stripe liberar)

### REGRA BYNX 19 — Pasta dos ZIPs/arquivos no Mac do Du
- Origem: `/Users/eduardowillian/Downloads/_____tcg-app/` (5 underscores)
- Destino: `/Users/eduardowillian/tcg-app/`

### REGRA BYNX 20 — Buscar versão mais recente em produção ANTES de modificar
- **Nunca** usar zips de sessões antigas como base de patches
- Processo correto: web_fetch GitHub raw OU pedir Du anexar do Mac, editar em cima daquela versão

### 🆕 REGRA BYNX 21 — Auditoria de código antes de roadmap estratégico

> **Antes de fazer roadmap estratégico, Mia DEVE:**
> 1. Listar tabelas Supabase via `list_tables` (verbose) pra ver schema completo
> 2. Pedir prints das principais telas pro Du, OU
> 3. Clonar o repo público via `bash_tool` + `git clone` e fazer auditoria sistemática
> 4. Validar features que **assume não existirem** (especialmente quando o produto é maduro)
> 5. **Nunca presumir o estado do produto pelo nome de arquivos no contexto** ou pela memória de sessões anteriores
>
> **Por que essa regra existe:** Na S27, Mia gerou um roadmap inicial assumindo que Marketplace e Perfil Público não existiam (estavam em "Onda 3" e "Onda 4"). Du corrigiu com prints mostrando que ambos JÁ EXISTEM em produção e estão bem feitos. Mia desperdiçou contexto e gerou ansiedade desnecessária no Du. **Auditoria de código é barata; presunção é cara.**
>
> **Custo:** ~10min de bash/grep/view, ~5k tokens de contexto.
> **Benefício:** roadmap real, decisões alinhadas com o produto que existe, confiança do Du restaurada.

---

## 🛣️ ROADMAP V3 (definitivo, alinhado com auditoria)

### 🔥 ONDA 0 — Lançamento (essa semana)
- ⏰ Stripe `charges_enabled` (externo, 1-3 dias)
- 🚨 Smoke test LIVE R$ 5,90
- 🚨 Backup DB pré-lançamento
- 🚀 Lançamento Bynx

### 🛡️ ONDA 1 — Estabilidade + Housekeeping (semanas 1-4 pós-lançamento)

**Infra:**
- 🚨 Sentry (error monitoring + alertas) — 2h
- 🚨 Sincronização Stripe ↔ Admin (cancela sub no Stripe quando admin muda plano) — 4h
- 🚨 Alerting webhook crítico (Sentry hook em `[webhook] CRITICAL`) — 1h
- 🟠 Backup DB diário automático (Supabase Pro) — 30min
- 🟠 Uptime monitor (UptimeRobot ou BetterStack) — 30min
- 🟡 Status page público (status.bynx.gg) — 2h

**Housekeeping (achados auditoria):**
- 🚨 Trocar `claude-opus-4-5` → `claude-opus-4-7` em scan-cards (achado #1) — 5min
- 🟠 Decidir LIMITE_FREE_MKTPLACE: 3 ou 6? (achado #2) — 5min
- 🟡 Remover `csv-parser` zumbi OU implementar importação CSV (achado #3) — decisão
- 🟡 Limpar `sendTrialExpiring1Email` órfã (achado #4) — 10min
- 🟡 Uniformizar Stripe API version (achado #5) — 30min
- 🟡 Refactor cálculo de patrimônio AppLayout → calcPatrimonio() (achado #6) — 1h
- 🟡 Fix tipo notificação 'marketplace' (achado #7) — 15min
- 🟢 Resolver duplicação `/minha-loja/[id]` vs `[lojaId]` (achado #9) — 2h
- 🟢 Rename emails trial pra nomenclatura clara (achado #10) — 30min

### 📈 ONDA 2 — Retenção & Aquisição (meses 1-3, 0→2k users)
- 🆕 **Wishlist + alertas de preço** (gap real, 0 arquivos) — 2-3 sem
- 🆕 **Importação massiva CSV** (csv-parser já tá nas deps) — 1-2 sem
- 🆕 **Programa de indicação** (aquisição viral barata) — 1 sem
- 🟠 SEO técnico aprofundado (página por carta, sitemap dinâmico) — 1-2 sem
- 🟠 Open Graph dinâmico (cards bonitos no compartilhamento) — 4h
- 🟡 Email digest semanal (retenção) — 1 sem
- 🟡 Soft paywall inteligente (50 cartas grátis em vez de 6) — 1 sem
- 🟡 Insights automáticos ("80% do set Stellar Crown") — 1 sem
- 🟡 PWA + push notifications — 3-4 dias
- 🟡 PostHog ao lado do GA4 (funnel + cohort) — 4h, opcional
- 🟢 Métricas extras no admin dashboard (achado #8) — 3h

### 🌐 ONDA 3 — Network effects (meses 3-6)
- 🆕 **Sistema de follow + alertas** (gap puro) — 2 sem
- 🆕 **Feed de atividades** (depois do follow) — 1 sem
- 🆕 **Top 100 colecionadores BR** (gamification) — 1 sem
- 🟠 **Polish do perfil público** (avaliações públicas visíveis, badges, achievements) — 1 sem
- 🟡 Comentários em cartas — 1 sem

### 💰 ONDA 4 — Marketplace 2.0 + AI + Mobile (meses 6-12)
- 💎 **Marketplace P2P + Stripe Connect (escrow)** — 8-12 sem (a grande mudança)
- 🟡 AI: recomendação "complete sua coleção" — 3-4 sem
- 🟡 AI: detector de falsificação via visão computacional — 6-8 sem
- 🟢 App nativo iOS/Android (React Native) — 3-6 meses

### 🌍 ONDA 5 — Expansão (12+ meses, só após PMF validado)
- Internacionalização EN (TCGPlayer market)
- Outros TCGs (Magic, Yu-Gi-Oh, One Piece)
- API pública / integrações
- White-label B2B enterprise

---

## 🎯 PENDING — próxima sessão (S28)

### Bloqueadores (externos)
- ⏰ **Stripe `charges_enabled: true`** (1-3 dias úteis, especialista contatado pela S27)
- 🌐 **DNS de `checkout.bynx.gg`** finalizar propagação (não bloqueia)

### Quando Stripe liberar
1. 💳 **Smoke test LIVE R$ 5,90** com cartão real do Du (~15min)
2. 📋 **Backup manual DB** pré-lançamento (5min via Supabase Dashboard)
3. 🚀 **Lançamento Bynx** — divulgação Instagram @bynx.gg + Discord
4. 📊 **Quick wins do roadmap V3** começar pelos achados da auditoria (claude-opus-4-7 troca de string, decisão LIMITE_FREE_MKTPLACE, csv-parser cleanup)

---

## 📊 Estado final do DB (snapshot 03/mai/2026)

```
Stripe:
- 8 eventos processados (legacy TEST), 0 erros
- 4 users com Stripe customer (legacy)
- 0 users/lojas com sub ATIVA (limpas na S27)
- 1 loja com trial_usado_em (anti-burlagem ativa)

Movimentação Stripe (TEST):
- 12 lançamentos registrados
- R$ 924,10 total processado em testes

Conteúdo:
- 22.861 cartas Pokémon catalogadas (USD/EUR/BRL)
- 1.025 espécies (Pokédex)
- 172 sets
- 6 anúncios marketplace
- 2 transações
- 16 notificações
- 0 reviews (vai popular com 1ª transação real)
```

---

## 🔧 Tools & resources

- **Supabase MCP** — primary DB, RLS, migrations
- **Stripe MCP** — gerenciamento de subs/products/customers
- **Vercel MCP** — deploys, logs, envs
- **bash_tool + git clone** — auditoria de código (REGRA 21)
- **ZenRows** — scraping BRL prices (Startup plan, custo é live concern)
- **Resend** — email transacional (saudável, monitorar bounce rate)
- **Liga Pokémon** — fonte de preços BR (URL format específico e frágil)
- **GA4 + GTM** — analytics, gate de consent LGPD
- **Repo público:** `brazildigital1403/tcg-invest`

---

## 📝 Histórico de sessões

- **S22-S25:** features iniciais, auth, dashboard, marketplace, perfil público, lojas, admin
- **S26:** finalização features (custom domains, esteira pós-lançamento criada)
- **S27 (esta):** migração Stripe TEST→LIVE, auditoria completa de código, roadmap V3 alinhado com produto real, REGRA 21 nova
- **S28:** smoke test + lançamento (após Stripe liberar)

---

> **Mia:** essa S27 foi marcada por um erro grave de diagnóstico inicial seguido de uma correção rigorosa via auditoria de código. **Du transformou um problema em uma regra duradoura** (REGRA 21). Próximas sessões vão começar com auditoria sempre que envolverem decisões estratégicas. Obrigada pela paciência, Du. Vamos lançar isso. 🚀
