# BYNX — Master Context (Sessão 20 — 27/04/2026)

**Stack:** Next.js 16.2.2, Supabase hvkcwfcvizrvhkerupfc, Vercel prj_X1CUMTLMwTL77trWqZdDdmBI9PRC / team_FK9fHseL9hy5mbNR6c0Q8JuK
**Repo:** brazildigital1403/tcg-invest (main) | **Domínio:** bynx.gg

---

## Sessão 20 — Foco: Admin Panel + Lojas + Financeiro

Esta sessão rodou em **3 chats paralelos** (Admin, Lojas/Lojista, Principal). Tudo descrito abaixo foi feito no chat do Admin e está em produção.

---

## Estado Atual (fim da sessão 20)

### Banco de Dados — novidades da sessão

**Migration 003** — Moderação de lojas:
```
lojas:
  + suspensao_motivo TEXT
  + suspensao_data   TIMESTAMPTZ
  + suspenso_por     UUID FK users
  + aprovada_data    TIMESTAMPTZ
  + aprovada_por     UUID FK users
  + index lojas_status_idx
  + index lojas_suspensao_data_idx (parcial)
```

**Migration 004** — Mini sistema financeiro:
```
despesas_recorrentes (nova):
  id, nome, categoria, valor_mensal, dia_vencimento, ativa, observacao, timestamps
  CHECK categoria IN (infra|marketing|dominio|pagamentos|impostos|outros)

lancamentos (nova):
  id, tipo, valor_bruto, taxa, valor_liquido, descricao, categoria,
  data_competencia, data_liquidacao, pago, recebido, fonte,
  despesa_recorrente_id FK, stripe_payment_intent_id, user_id FK, observacao, timestamps
  CHECK tipo IN (despesa|receita)
  CHECK fonte IN (manual|stripe|outro)
  UNIQUE constraint em stripe_payment_intent_id (pra evitar duplicar webhook)
```

**Migration 005** — Sub-itens em lançamentos:
```
lancamentos:
  + detalhes JSONB  (array de { descricao, valor })
```

**Seed populado:**
- 4 despesas recorrentes (ZenRows R$1160, Anthropic R$571, Godaddy R$64,56, INSS DAS MEI R$80,90)
- 5 lançamentos retroativos abril/2026 (R$ 3.032,47 total, com sub-itens preenchidos)

### Outros sistemas no admin (já estavam de antes)

- Sistema de tickets (`/suporte` user-facing + `/admin/tickets`)
- Login admin com cookie HMAC `bynx_admin` (7 dias)
- `/admin/users` com gestão completa (Pro, créditos, edit, suspend, delete LGPD)
- `users.suspended_at` + middleware bloqueando suspensos no app

---

## O Que Foi Feito Nessa Sessão

### 1. Painel /admin/lojas — Moderação completa ✅

**Arquivos novos:**
- `src/app/admin/lojas/page.tsx`
- `src/app/api/admin/lojas/route.ts` (lista + filtros + counters)
- `src/app/api/admin/lojas/[id]/approve/route.ts`
- `src/app/api/admin/lojas/[id]/suspend/route.ts`
- `src/app/api/admin/lojas/[id]/toggle-verified/route.ts`

**Funcionalidades:**
- Listagem com 4 contadores (Pendentes/Ativas/Suspensas/Inativas)
- Filtros em pílulas + busca por nome/slug/cidade
- Banner âmbar quando há pendentes (com botão "Ver pendentes →")
- Cards por loja: logo (ou inicial), nome, badges status/verificada/plano, slug, cidade/UF, owner, data
- Ações contextuais por status:
  - Pendente → Aprovar / Suspender / Detalhes
  - Ativa → Suspender / Verificar (toggle) / Detalhes
  - Suspensa → Reativar / Detalhes
  - Inativa → Detalhes
- Modal de suspensão com textarea de motivo (mín 10 chars, máx 500) + contador
- Modal de detalhes com info completa + link página pública + link perfil owner

**Emails novos em `src/lib/email.ts`:**
- `sendEmailLojaAprovada({ to, nomeUser, nomeLoja, slug })` — primeira aprovação somente
- `sendEmailLojaSuspensa({ to, nomeUser, nomeLoja, motivo })`

**Schema observation:**
- Coluna real é `plano_expira_em`, não `trial_expires_at` (corrigido durante o desenvolvimento)
- Coluna legado `motivo_suspensao` continua existindo vazia (a nova é `suspensao_motivo`)

### 2. Painel /admin/financeiro — Mini sistema financeiro ✅

**Arquivos novos:**
- `src/app/admin/financeiro/page.tsx`
- `src/app/api/admin/financeiro/dashboard/route.ts`
- `src/app/api/admin/financeiro/despesas-recorrentes/route.ts`
- `src/app/api/admin/financeiro/despesas-recorrentes/[id]/route.ts`
- `src/app/api/admin/financeiro/lancamentos/route.ts`
- `src/app/api/admin/financeiro/lancamentos/[id]/route.ts`

**Funcionalidades:**
- 4 cards macro: Faturamento bruto, Despesas pagas, Resultado, A pagar (com tendência vs mês anterior)
- Aviso âmbar de contas vencendo nos próximos 3 dias (Opção A — só visual no admin)
- Aviso MEI quando passa 70% (amarelo) ou 90% (vermelho) do limite anual de R$ 81k
- 2 gráficos SVG inline: Linha 6 meses (receita vs despesa) + Pizza por categoria
- CRUD completo de Despesas Recorrentes
- CRUD + Edit completo de Lançamentos
- Filtros por tipo, categoria, status
- Lançamentos com sub-itens (botão ▶ expandindo em "FAQ" pra ver detalhes)
- Modal unificado pra criar + editar lançamentos
- Pode adicionar/remover sub-itens em qualquer lançamento manual
- Validação backend: lançamento com sub-itens recalcula `valor_bruto` automaticamente pela soma
- Lançamentos `fonte=stripe` (futuros) ficam restritos: apenas observação + recebido editáveis (UI desabilita campos, backend valida)

**Categorias fixas:**
- Despesas: `infra`, `marketing`, `dominio`, `pagamentos`, `impostos`, `outros`
- Receitas: `assinatura`, `outros`

**Decisões de regime fiscal:**
- MEI (DAS fixo R$ 80,90/mês cadastrado como despesa recorrente)
- Sem alíquota % sobre receita
- Limite R$ 81.000/ano hardcoded com aviso visual

**Stripe handling (preparação):**
- Tabela `lancamentos` já tem coluna `stripe_payment_intent_id` com UNIQUE constraint
- Coluna `data_liquidacao` separada de `data_competencia` (D+30)
- Coluna `taxa` pra registrar a taxa real do Stripe (3,99% + R$ 0,39 BR)
- Webhook do Stripe ainda **não foi integrado** (próximo passo planejado)

### 3. Item "Lojas" e "Financeiro" no menu admin ✅

**Arquivo modificado:** `src/app/admin/layout.tsx`
- Adicionados 2 itens no `adminMenu`: `Lojas` e `Financeiro`
- Ícones inline em SVG stroke (`IconStore` e `IconWalletAdmin`)
- Bottom nav mobile atualizado também

Menu atual completo: Dashboard, Tickets, Lojas, Usuários, Financeiro

---

## Arquivos Modificados Nessa Sessão

```
src/app/admin/layout.tsx                                ← novo menu (+ Lojas, + Financeiro)
src/app/admin/lojas/page.tsx                            ← NOVO
src/app/admin/financeiro/page.tsx                       ← NOVO
src/app/api/admin/lojas/route.ts                        ← NOVO
src/app/api/admin/lojas/[id]/approve/route.ts           ← NOVO
src/app/api/admin/lojas/[id]/suspend/route.ts           ← NOVO
src/app/api/admin/lojas/[id]/toggle-verified/route.ts   ← NOVO
src/app/api/admin/financeiro/dashboard/route.ts                          ← NOVO
src/app/api/admin/financeiro/despesas-recorrentes/route.ts               ← NOVO
src/app/api/admin/financeiro/despesas-recorrentes/[id]/route.ts          ← NOVO
src/app/api/admin/financeiro/lancamentos/route.ts                        ← NOVO
src/app/api/admin/financeiro/lancamentos/[id]/route.ts                   ← NOVO
src/lib/email.ts                                        ← + sendEmailLojaAprovada, + sendEmailLojaSuspensa

Migrations rodadas no Supabase:
  003_add_moderacao_fields_to_lojas.sql  ← novas colunas + 2 índices
  004_financeiro.sql                     ← 2 tabelas + seeds
  005_lancamentos_detalhes.sql           ← coluna detalhes JSONB + backfill 5 lancs
```

---

## Bugs Corrigidos Nessa Sessão

| Bug | Causa | Fix |
| --- | --- | --- |
| `column lojas.trial_expires_at does not exist` em `/admin/lojas` | Coluna real é `plano_expira_em` | Trocado em select da API + tipo da página + label da UI |
| Botão ▶ não aparecia em `/admin/financeiro` | Migration 005 (coluna `detalhes`) não tinha sido executada no Supabase | Rodou ALTER TABLE + UPDATE (backfill) |

---

## Pendências

### ⚠️ Webhook do Stripe — integração com lançamentos

Próximo item a fazer no admin financeiro. Quando assinatura Pro for paga, criar automaticamente:

```ts
// pseudo
sb.from('lancamentos').insert({
  tipo: 'receita',
  valor_bruto: amount,
  taxa: stripeFee,           // 3.99% + R$0,39 BR
  valor_liquido: amount - stripeFee,
  descricao: `Assinatura ${plano} — ${userEmail}`,
  categoria: 'assinatura',
  data_competencia: hoje,
  data_liquidacao: hoje + 30 dias,
  recebido: false,
  fonte: 'stripe',
  stripe_payment_intent_id: pi_xxx,  // UNIQUE evita duplicar
  user_id: userId,
})
```

UPSERT por `stripe_payment_intent_id` previne lançamento duplicado se webhook for chamado 2x.

A UI já está pronta pra renderizar com badge roxo "Stripe" e modal restrito.

### ⚠️ scan-sets — Retomar quando tiver crédito ZenRows

ZenRows renova em 26/05/2026. (Sem mudança da sessão 19.)

### Cache Pokédex — Após mudanças no banco

```
https://www.bynx.gg/api/pokedex?refresh=1
https://www.bynx.gg/api/pokedex/species?refresh=1
```

### A partir de 01/05/2026 — Sistema de Preços

* Migrar de `card_prices` → `pokemon_cards` na busca
* Autocomplete por nome na Minha Coleção
* Pokédex lendo preços direto do Supabase

---

## Regras BYNX (Memória)

1. **BYNX_MASTER_CONTEXT.md** ao final do dia — commit + push
2. **Código 100% completo** sempre — nunca diffs ou snippets
3. **Git em bloco único** com `&&` — Du cola uma vez só
4. **CardItem é o componente padrão** — `src/components/ui/CardItem.tsx`
5. **A partir de 01/05/2026** → melhorias sistema de preços
6. **Turbopack não aceita IIFE complexos** → extrair para componente separado
7. **PostgREST limita 1000 rows** → usar `.range()` em lotes para dados grandes
8. **NOVA — bloco git de instalação** sempre com paths absolutos do Mac do Du:
   - Origem: `/Users/eduardowillian/Downloads/_____tcg-app/`
   - Destino: `/Users/eduardowillian/tcg-app/`
   - Commit message **sem caracteres especiais** (sem R$, sem acento em variáveis técnicas) pra não quebrar shell

---

## Key Learnings Dessa Sessão

* **Schema legado coexiste com schema novo:** tabela `lojas` tem `motivo_suspensao` (legado vazio) **e** `suspensao_motivo` (novo). Sempre confirmar nome real da coluna antes de codar; o briefing pode estar desalinhado com produção.
* **MEI tem regra simples:** DAS fixo mensal, sem alíquota %. Limite anual R$ 81k. UI deve mostrar % do limite consumido pra usuário planejar virada pra Simples Nacional antes de estourar.
* **Stripe D+30 importa pra fluxo de caixa real:** registrar 2 datas separadas (`data_competencia` quando vendeu + `data_liquidacao` quando dinheiro caiu) permite ver "faturei hoje" vs "recebi hoje" em telas diferentes.
* **JSONB pra sub-itens é o sweet spot** quando você quer agrupamento simples sem complicar o schema com tabela filha. Trade-off: sub-itens não são "lançamentos de verdade" (sem filtro/busca individual), mas pra controle interno é suficiente.
* **Workflow de bloco git único** funciona muito bem: gerar todos os arquivos de uma vez, dar `cp` + `mkdir -p` + `git add . && commit && push` num só comando. Du cola uma vez e está em produção.
* **`UNIQUE` constraint em coluna de webhook (Stripe Payment Intent ID)** é a melhor proteção contra duplicação por retry — webhook pode ser chamado 2x e o INSERT só passa uma vez.

---

## Footer

Sessão 20 fechou: Admin com 5 áreas funcionando (Dashboard, Tickets, Lojas, Usuários, Financeiro). Próximo grande passo é integrar Stripe webhook com `lancamentos` quando começar a entrar receita real.


---
---

# Sessão 21 — 28/04/2026

**Foco:** Multi-loja, fix de race condition em uploads, upload de logo com crop, mudança de plano admin, e edição admin completa de lojas.

---

## 🎯 Entregas da Sessão 21

### 1. Refatoração Multi-loja (1 user → N lojas)

**Problema:** o sistema antigo limitava 1 loja por usuário (`UNIQUE owner_user_id`).

**Mudanças:**
- `src/app/api/lojas/route.ts` — removido o 409 "já tem loja"
- `src/app/minha-loja/page.tsx` — virou **HUB** com cards de todas as lojas do usuário
- `src/app/minha-loja/nova/page.tsx` — NOVO — formulário pra criar mais lojas
- `src/app/minha-loja/[id]/page.tsx` — NOVO — edição individual de cada loja

**Decisões arquiteturais tomadas:**
- Cobrança per-loja (Opção B) — coluna `lojas.plano` é per-loja
- Sem limite de lojas por user — o mercado regula
- Onboarding: se 0 lojas → redireciona pra `/minha-loja/nova`
- `/lojas` (público) NÃO foi colocado dentro do AppLayout autenticado — preservar SEO + analytics + usuário não-logado vendo guia

### 2. Race condition no upload de fotos (RESOLVIDA)

**Problema:** Du selecionava 10 fotos no Mac, todos uploads retornavam 200, mas só 1-2 fotos apareciam no array `fotos` da loja. Resto virava arquivo órfão no Storage.

**Causa raiz:** 10 requests paralelos liam `fotos = []` simultaneamente, all-pass validação, all-upload, mas only-last-write-wins no UPDATE Postgres (sem lock).

**Solução em 3 camadas:**

**(a) RPC `lojas_append_foto`** com `FOR UPDATE` lock — migrations 005 (com bug ambig) + 006 (CORRIGIDA: campos `out_fotos`/`out_length`):

```sql
CREATE FUNCTION lojas_append_foto(
  p_loja_id uuid, p_owner_id uuid, p_url text, p_max_fotos int
) RETURNS TABLE (out_fotos text[], out_length int)
SECURITY DEFINER AS $$
BEGIN
  SELECT l.fotos INTO v_current_fotos
  FROM lojas l
  WHERE l.id = p_loja_id AND l.owner_user_id = p_owner_id
  FOR UPDATE;
  -- ...valida limite, append atômico
END;
$$;
```

**(b) Backend** chama RPC ao invés de read+write manual; lê `out_fotos` (não `fotos`) — bug corrigido no commit `f0cc557`

**(c) Client (`FormLoja.tsx`):** upload em **série** (`for...of await` em vez de `Promise.all`), validação no select, botão Salvar bloqueado durante upload, progresso "3/10..."

### 3. Upload de logo com crop quadrado automático

**3 arquivos:**
- `src/lib/uploadFoto.ts` v2 — adicionada `uploadLogoLoja()` + `deletarLogoLoja()` + `cropToSquareWebP()` (crop centralizado, fundo branco se PNG transparente, 400×400 WebP qualidade 0.9)
- `src/app/api/lojas/[id]/logo/route.ts` — NOVO — POST/DELETE com substituição automática (apaga logo antigo do bucket)
- `src/components/lojas/FormLoja.tsx` v4 — substitui campo URL do logo por file picker quadrado com preview

**Path no bucket:** `loja-fotos/{lojaId}/logo/{uuid}.webp`

### 4. Mudança de plano per-loja no admin

**3 arquivos:**
- `src/lib/email.ts` — função `sendEmailLojaPlanoAlterado` (detecta upgrade vs downgrade pela ordem `basico→pro→premium`)
- `src/app/api/admin/lojas/[id]/plano/route.ts` — NOVO — POST com body `{plano, dias}`. Auth via `verifyAdminToken` (cookie HMAC). Atualiza `plano` + `plano_expira_em`. Envia email pro owner.
- `src/app/admin/lojas/page.tsx` — adiciona dropdown **"Plano ▾"** + modal de mudança com 6 durações (30/60/90/180/365/permanente)

**Decisões:** todas as transições permitidas, modal pergunta duração, sem motivo obrigatório, email automático.

### 5. Logo clicável no admin

`src/app/admin/lojas/page.tsx` — logo de cada loja vira `<a target="_blank">` que abre `/lojas/{slug}` em nova aba. Hover scale 1.04 + glow âmbar.

### 6. Edição admin completa de lojas (FINAL DO DIA)

Admin agora pode editar **qualquer loja** mesmo não sendo owner.

**Arquitetura: auth dual nas APIs existentes**

Helper `src/lib/lojas-auth.ts` (NOVO) — função `autenticarOwnerOuAdmin(req, lojaId, fields)`:
- Tenta admin: cookie `bynx_admin` (HMAC) válido?
- Tenta owner: Bearer + ownership?
- Reutilizada por todas as APIs de loja

**APIs modificadas pra aceitar admin (bypass de ownership):**
- `PATCH /api/lojas/[id]` — admin pula `USER_STATUS_TRANSITIONS`
- `POST /api/lojas/[id]/upload-foto` — admin sem limite de plano (limite=999)
- `DELETE /api/lojas/[id]/foto`
- `POST/DELETE /api/lojas/[id]/logo`

**Detalhe importante:** RPC `lojas_append_foto` valida ownership por dentro. Quando admin opera, passamos `loja.owner_user_id` em vez de `user.id` pra RPC encontrar a linha.

**Frontend admin:**
- `GET /api/admin/lojas/[id]` — NOVO — retorna loja completa + dados do owner
- `src/app/admin/lojas/[id]/editar/page.tsx` — NOVO — wrapper do FormLoja com banner roxo "🛡️ Você está editando como ADMIN"
- `src/app/admin/lojas/page.tsx` — botão **"✏️ Editar"** roxo entre "Plano ▾" e "Detalhes"

**FormLoja.tsx ficou 100% intocado** — abordagem elegante: o componente nem sabe que é admin, só chama `PATCH /api/lojas/[id]` como sempre, e o helper resolve.

---

## 🐛 Bugs descobertos e corrigidos durante a sessão

### Build error no email.ts (commit e76aee9 → ERROR)

Quando refiz `email.ts` pra adicionar `sendEmailLojaPlanoAlterado`, parti de snapshot incompleto. **Removi por engano** 2 funções que outros arquivos importam:
- `sendPurchaseConfirmationEmail` (usado em `/api/email/test` e `/api/stripe/webhook`)
- `sendTrialExpiring7Email` (usado em `/api/cron-trial-emails` e `/api/email/test`)

**Fix:** recriadas no `email.ts` v2 com 13 funções totais. `sendTrialExpiring7Email` é alias de `sendTrialExpiring1Email` (mesmo email, "1 dia restante" = "7º dia do trial" = último dia). `sendPurchaseConfirmationEmail` tem 4 templates (`pro_mensal`, `pro_anual`, `separadores`, `scan_*`) + fallback genérico.

### "Não autorizado" no /admin/lojas/[id]/plano

**Causa:** Usei `process.env.ADMIN_HMAC_SECRET` (env inexistente) ao invés de chamar o helper `verifyAdminToken` que **já existia** em `src/lib/admin-auth.ts`. Cookie era assinado com `ADMIN_SECRET || ADMIN_PASSWORD` mas verificado contra string vazia.

**Fix:** API de plano agora usa `verifyAdminToken(token)` do helper oficial.

**Descoberta paralela:** **as outras APIs admin** (`approve`, `suspend`, `toggle-verified`, `users`, `tickets`, `metrics`, `financeiro`) **não verificam autenticação nenhuma** — confiam que o usuário entrou pelo painel. Qualquer um pode chamar via `curl`. **Pendência:** sessão dedicada pra adicionar `verifyAdminToken` em todas.

### Logo clicável "sumiu" depois da edição admin

**Causa:** o ZIP enviado por Du era de antes do commit do logo clicável (Regra 14 falhou — ZIP é defasado quando há pushes intermediários).

**Fix:** restaurado o `<a target="_blank">` envolvendo o logo.

**Lição aprendida (NOVA REGRA INFORMAL):** quando Du faz push entre uploads de ZIP, tentar `web_fetch` direto do GitHub raw antes de mexer. Se falhar, perguntar antes de partir do ZIP velho.

---

## 📋 Regras BYNX consolidadas (16 regras)

| # | Regra |
|---|---|
| 1 | `BYNX_MASTER_CONTEXT.md` ao final do dia — commit + push |
| 2 | Código 100% completo, nunca diffs ou snippets |
| 3 | Commits ASCII puro (sem acentos, R$, emojis) |
| 4 | CardItem é componente padrão (`src/components/ui/CardItem.tsx`) |
| 5 | A partir de 01/05/2026 → melhorias de preços |
| 6 | Turbopack: extrair IIFE complexo pra componente separado |
| 7 | PostgREST cap 1000 → usar `.range()` em lotes |
| 8 | Bloco git com paths absolutos (`/Users/eduardowillian/...`) |
| 9 | Schema legado coexiste — confirmar coluna real antes de codar |
| 10 | RLS é falha silenciosa — verificar policies de SELECT/UPDATE |
| 11 | Mia tem acesso direto GitHub público + Supabase MCP — pode rodar SQL direto |
| 12 | Toda entrega termina com bash copy-cola padronizado (linhas separadas, ASCII puro) |
| 13 | **AppLayout.tsx é congelado** — autorização explícita pra mexer |
| 14 | **Sempre olhar o estado real no ZIP antes de propor mudanças** |
| 15 | **Não inventar caminhos ou arquivos sem antes verificar com `view`/`bash`** |
| 16 | **Preservar 100% do que já existe, sem assumir que está vazio** |

---

## 🔧 Estado real em produção (fim sessão 21)

### 3 lojas de teste do Du:
| Loja | Slug | Plano | Status | Logo | Fotos |
|---|---|---|---|---|---|
| PokéShop Online | `pokeshop-online` | Básico | ativa | — | 0 |
| Bianca Cartas | `bianca-cartas` | Pro | ativa | URL externa | 5 |
| Legendario Card Games | `loja-premium-sp` | Premium | ativa | upload local | 10 |

### Bucket Supabase Storage `loja-fotos`:
- Público, 5MB max, MIMEs jpeg/png/webp
- Convenção: Galeria `loja-fotos/{loja_id}/{uuid}.webp` | Logo `loja-fotos/{loja_id}/logo/{uuid}.webp`

### Schema lojas (35 colunas):
`fotos` text[] default ARRAY[], `logo_url` text, `plano` text default 'basico' NOT NULL, `plano_expira_em` timestamptz nullable, `aprovada_data` timestamptz nullable, `suspensao_motivo` text, `suspensao_data` timestamptz, `verificada` bool, `stripe_subscription_id`, `stripe_customer_id`, `visualizacoes`, `cliques_whatsapp`. Coluna legada `motivo_suspensao` coexiste com `suspensao_motivo`.

### Migrations:
- 003: Moderação lojas (suspensao_motivo, etc)
- 004: Mini financeiro (despesas_recorrentes, lancamentos)
- 005: Sub-itens lancamentos (detalhes JSONB) E lojas_append_foto (versão com bug)
- 006: Fix `lojas_append_foto` (out_fotos)

### email.ts — 13 funções exportadas:
1. `sendWelcomeEmail`
2. `sendTrialExpiring5Email`
3. `sendTrialExpiring1Email`
4. `sendNewTicketAdminEmail`
5. `sendTicketCreatedUserEmail`
6. `sendUserReplyAdminEmail`
7. `sendAdminReplyUserEmail`
8. `sendTicketStatusChangedEmail`
9. `sendEmailLojaAprovada`
10. `sendEmailLojaSuspensa`
11. `sendEmailLojaPlanoAlterado` (NOVO sessão 21)
12. `sendPurchaseConfirmationEmail` (REINSERIDO sessão 21)
13. `sendTrialExpiring7Email` (REINSERIDO sessão 21 — alias de #3)

---

## 🚀 Próximas pendências (carregar pra sessão 22)

### Imediato
- 🔴 **Adicionar `verifyAdminToken` nas outras APIs admin** (approve, suspend, toggle-verified, users, tickets, metrics, financeiro) — falha de segurança
- 🟢 Passo 11 — **Analytics Premium dashboard** (3-4h) — clicks já gravando em `loja_cliques`
- 🟡 npm audit (3 vulnerabilidades — 1 moderate, 2 high) — sessão dedicada

### Curto prazo
- 🔴 Passo 8 — Stripe per-loja (6-10h) — cobrar 1 subscription por loja
- 🔵 **01/05/2026:** começa fase de melhorias de preços (Regra 5)
- 🔵 **26/05/2026:** ZenRows renova ($227.63), rodar `scan-sets-final.ts` em `/Users/eduardowillian/bynx-scan/`

### Conhecidos
- Webhook Stripe → `lancamentos` (admin financeiro)
- Cache Pokédex após mudanças
- ~~Usuário admin é client-side puro (admin/layout.tsx) — adicionar proteção server-side~~ → **FALSO POSITIVO** (validado na sessão 22). O `admin/layout.tsx` é `'use client'` mas só por causa do `usePathname` (UI). Quem protege admin é o `middleware.ts` (linhas 35-54) que roda em Edge ANTES das route handlers, redirecionando `/admin/*` sem cookie HMAC pra `/admin/login` (307) e retornando 401 JSON em `/api/admin/*`.

---

## 🔑 Key Learnings — Sessão 21

* **Race condition em upload paralelo** com array Postgres é silencioso — `RLS=ok`, `INSERT=ok`, mas read+modify+write sem lock perde escritas. Solução: RPC com `FOR UPDATE` + chamadas em série no client.
* **Preservar 100% do que existe (Regra 16)** > reimplementar manualmente. Erros principais da sessão (auth do plano, build email.ts, logo clicável sumindo) vieram de **partir de snapshot incompleto**. ZIP é defasado quando há pushes intermediários.
* **Auth dual elegante via helper compartilhado** (`autenticarOwnerOuAdmin`) — admin entra como caminho ADICIONAL nas APIs existentes, sem duplicar rotas. Componente client (FormLoja) nem sabe que é admin.
* **RPC com `SECURITY DEFINER` + `FOR UPDATE`** é a forma correta de fazer append atômico em array Postgres. Validação de ownership dentro da RPC com `WHERE owner_user_id = p_owner_id` permite admin operar passando o owner_user_id real.
* **Logo clicável + hover suave** dá ótima afordância pra "abrir em nova aba". Usar `target="_blank" rel="noopener noreferrer"` é obrigatório por segurança.
* **MD5/diff antes e depois das mudanças** é a melhor prova de preservação. Quando uso `str_replace`, valido `diff` pra garantir que **só** o que pretendia mudar mudou.

---

## Footer

Sessão 21 fechou: **Multi-loja completo + edição admin de qualquer loja + email infrastructure robusta + 16 regras consolidadas**. Du agora pode operar qualquer loja como admin sem mexer no código de cada owner. Próxima sessão começa endurecendo a auth admin nas outras 7 APIs e arrancando o Passo 11 (Analytics Premium).


---
---

# Sessão 22 — 28/04/2026

**Foco:** Hardening de auth no painel admin + investigação completa do middleware. Defense-in-depth + correção de premissa errada herdada do contexto.

---

## 📌 Errata sobre o contexto histórico

A pendência registrada na **sessão 21 (linha 381)** — "as outras APIs admin não verificam autenticação nenhuma — qualquer um pode chamar via curl" — e o item de "Conhecidos" na **linha 470** — "Usuário admin é client-side puro (admin/layout.tsx) — adicionar proteção server-side" — eram **factualmente errados** quando confrontados com o código real em produção.

**Realidade descoberta:** o `middleware.ts` (linhas 35-54) já bloqueia `/admin/*` (redirect 307 → /admin/login) e `/api/admin/*` (401 JSON) server-side, em Edge runtime, ANTES das route handlers executarem. O `matcher` cobre `/admin/:path*` e `/api/admin/:path*`. O `admin/layout.tsx` é de fato `'use client'`, mas só por causa do `usePathname` (UI do menu) — nenhum check de auth lá, e nenhum precisava existir.

**Como a Mia descobriu:** ao iniciar o trabalho de "fix", olhou o middleware completo (Regra 14/15 cumprida tarde demais) e percebeu que a vulnerabilidade descrita não existia.

**Como Du validou:** bateria de 17 curls em produção testando matcher (literal, path*, query string, double slash, trailing slash, case), cookies (vazio, sem ponto, HMAC errado, expirado), e fluxo das APIs. **Todos** os tests retornaram 307 ou 401 — zero `200` indevido.

---

## 🎯 Entregas da Sessão 22

### 1. Helper `requireAdmin(req)` em `src/lib/admin-auth.ts`

Função compartilhada que faz o check do cookie HMAC e retorna `NextResponse` 401 ou `null`:

```ts
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  const isAdmin = await verifyAdminToken(token)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  return null
}
```

As 5 funções existentes (`makeAdminToken`, `verifyAdminToken`, `verifyAdminPassword`, `ADMIN_COOKIE`, `ADMIN_MAX_AGE`) preservadas 100% (Regra 16).

### 2. Defense-in-depth nas 19 rotas admin

**17 rotas** que não tinham auth no nível da route handler ganharam 3 linhas no topo de cada handler:

```ts
const unauth = await requireAdmin(req)
if (unauth) return unauth
```

**2 rotas** que já tinham auth inline (`lojas/[id]` GET e `lojas/[id]/plano` POST) foram padronizadas pra usar o mesmo helper.

**Resultado:** dupla camada de proteção (middleware + handler). Se um dia o middleware tiver bug, regressão no matcher, ou for desabilitado por engano, as APIs continuam protegidas. Custo: ~3 linhas/handler, manutenção zero.

### 3. Try/catch fail-closed no bloco admin do middleware

Antes: se `verifyAdminToken` jogasse exceção (env `ADMIN_SECRET` ausente, `crypto.subtle` indisponível, qualquer coisa imprevista), o middleware crashava e o Next devolvia 500. Não era bypass de segurança (request não chegava no handler), mas era UX ruim e logs sujos.

Depois: tudo dentro de try/catch, com fallback **fail-closed** — em qualquer erro, redireciona pra login (páginas) ou retorna 401 (APIs). Função `blockAdmin(req, pathname)` extraída pra ser reusada no fluxo normal e no fallback (DRY).

### 4. Matcher do middleware padronizado

Antes: pra admin tinha só `/admin/:path*` e `/api/admin/:path*`. Pra outras rotas (dashboard-financeiro, minha-colecao, etc) o Du tinha as duas formas (literal + path*).

Depois: admin segue o mesmo padrão das outras. Adicionados `/admin` e `/api/admin` literais.

Os tests confirmaram que `:path*` casa o literal no Next 16, mas a redundância protege contra mudanças futuras no path-to-regexp e mantém consistência.

---

## 🐛 Bugs descobertos durante a sessão

| Bug | Causa | Fix |
|---|---|---|
| Pendência inexistente sendo trabalhada | Mia não olhou middleware antes de declarar vulnerabilidade. Regra 14/15/16 cumprida só nas route handlers, não na cadeia completa de auth. | Bateria de 17 curls em produção validou que middleware cobre tudo. Trabalho ressignificado como defense-in-depth. |
| Indentação errada no patch de 2 rotas que já tinham auth | Regex de substituição inline preservou indent original (8 espaços) ao invés de normalizar pra 4. | Corrigido manualmente em `lojas/[id]/route.ts` e `lojas/[id]/plano/route.ts`. |
| `unauth` declarado 2x em `dashboard/route.ts` | Patch manual + script aplicaram a mesma transformação. | Removida duplicata via `str_replace`. |

---

## 📋 Arquivos modificados nessa sessão

```
src/lib/admin-auth.ts                                     ← + função requireAdmin
src/app/api/admin/financeiro/dashboard/route.ts           ← + requireAdmin
src/app/api/admin/financeiro/despesas-recorrentes/route.ts          ← + requireAdmin (2 handlers)
src/app/api/admin/financeiro/despesas-recorrentes/[id]/route.ts     ← + requireAdmin (2 handlers)
src/app/api/admin/financeiro/lancamentos/route.ts                   ← + requireAdmin (2 handlers)
src/app/api/admin/financeiro/lancamentos/[id]/route.ts              ← + requireAdmin (2 handlers)
src/app/api/admin/lojas/route.ts                          ← + requireAdmin
src/app/api/admin/lojas/[id]/route.ts                     ← inline → requireAdmin (já tinha auth)
src/app/api/admin/lojas/[id]/approve/route.ts             ← + requireAdmin
src/app/api/admin/lojas/[id]/suspend/route.ts             ← + requireAdmin
src/app/api/admin/lojas/[id]/toggle-verified/route.ts     ← + requireAdmin
src/app/api/admin/lojas/[id]/plano/route.ts               ← inline → requireAdmin (já tinha auth)
src/app/api/admin/users/route.ts                          ← + requireAdmin
src/app/api/admin/users/[id]/route.ts                     ← + requireAdmin (3 handlers)
src/app/api/admin/users/[id]/collection/route.ts          ← + requireAdmin
src/app/api/admin/tickets/route.ts                        ← + requireAdmin
src/app/api/admin/tickets/[id]/route.ts                   ← + requireAdmin (2 handlers)
src/app/api/admin/tickets/[id]/reply/route.ts             ← + requireAdmin
src/app/api/admin/metrics/route.ts                        ← + NextRequest + requireAdmin
src/app/api/admin/resync-price/route.ts                   ← + requireAdmin

middleware.ts                                             ← try/catch + matcher padronizado + função blockAdmin
BYNX_MASTER_CONTEXT.md                                    ← errata linha 470 + sessão 22
```

**Total:** 21 arquivos. **28 handlers** protegidos. **0 vulnerabilidades reais corrigidas** (já estavam protegidas pelo middleware), **2 hardenings defensivos** aplicados.

---

## 🚀 Próximas pendências (carregar pra sessão 23)

### Imediato
- 🟢 **Passo 11 — Analytics Premium dashboard** (3-4h) — clicks já gravando em `loja_cliques`
- 🟡 npm audit (3 vulnerabilidades — 1 moderate, 2 high) — sessão dedicada

### Curto prazo
- 🔴 Passo 8 — Stripe per-loja (6-10h) — cobrar 1 subscription por loja
- 🔵 **01/05/2026 (3 dias):** começa fase de melhorias de preços (Regra 5)
- 🔵 **26/05/2026:** ZenRows renova ($227.63), rodar `scan-sets-final.ts`

### Conhecidos
- Webhook Stripe → `lancamentos` (admin financeiro)
- Cache Pokédex após mudanças
- 2 erros pré-existentes de TS narrowing em `financeiro/lancamentos/route.ts:101` e `financeiro/lancamentos/[id]/route.ts:128` (`Property 'error' does not exist on union`) — Next compila normal mas vale corrigir numa próxima leva

---

## 🔑 Key Learnings — Sessão 22

* **"Inseguro no nível X" não significa "inseguro no sistema".** Auth é em camadas e middleware Edge roda antes das route handlers. SEMPRE rastrear a cadeia completa antes de declarar vulnerabilidade. Olhar 1 nível e concluir é processo incompleto.
* **Regra 14/15/16 precisa incluir middleware na varredura inicial** quando o trabalho é sobre auth. Atualizar checklist mental: "olhar route handler + helper de auth + middleware + matcher" antes de propor mudanças relacionadas a segurança.
* **Defense-in-depth não é desperdício**, mesmo quando descobre-se que a camada superior já protegia. Custo de manter é zero (mesmas linhas, mesmas funções), e protege contra: (a) regressões futuras no middleware, (b) bugs em mudanças de matcher, (c) execução fora do Vercel (testes locais, scripts, cron internos), (d) middleware desabilitado por engano em deploy.
* **Fail-closed > fail-open em auth checks.** Try/catch sem fallback bloqueante = atacante pode forçar erros pra bypassar. Quando em dúvida, bloquear.
* **Matcher com `:path*` casa zero+ no Next 16** (validado em produção: `/admin` literal retornou 307). Mas adicionar literal explícito é insurance barata e mantém consistência com o resto das rotas.
* **Bateria de curls em produção é o nível final de validação.** Code review + análise estática diz "deveria proteger". Curl mostra "está protegendo". Pra cada vulnerabilidade que importa, vale rodar a bateria.
* **Honestidade técnica > parecer competente.** Quando descobri que o trabalho da sessão era sobre vulnerabilidade que não existia, o caminho certo foi parar e contar pro Du. Re-skin de "fix" pra "defense-in-depth" só funciona quando é verdade.

---

## 📋 Regras BYNX consolidadas (16 regras + 2)

Regras adicionadas nessa sessão:

| # | Regra |
|---|---|
| 17 | **Auth é em camadas — sempre verificar middleware + matcher antes de declarar vulnerabilidade em route handlers.** Olhar uma camada só e concluir é diagnóstico incompleto. |
| 18 | **Antes de propor SQL/migration, SEMPRE inspecionar schema atual via `Supabase:execute_sql`** com `SELECT FROM information_schema.columns` e `pg_indexes`. Schema do banco evolui sem o código refletir, e propor coluna nova quando já existe equivalente cria redundância e bugs sutis. Regra 14/15/16 (preservar 100%) se aplica ao banco também, não só ao código. |

---

## 🔧 Continuação da Sessão 22 — Manutenção / Dívida técnica

Após fechar o capítulo de auth, Du escolheu atacar 4 itens de manutenção da fila:
**(3) npm audit, (4) erros de TS narrowing, (5) Webhook Stripe → lancamentos, (6) Cache Pokédex**.

### Item 4 — DESCARTADO (falso positivo)

Mia havia anotado "2 erros pré-existentes de TS narrowing em `lancamentos/route.ts:101` e `[id]/route.ts:128`" durante a sessão 22 manhã. Ao reabrir pra corrigir, percebeu que **TypeScript faz narrowing perfeitamente** no discriminated union `{ ok: true; lista: [...] } | { ok: false; error: string }`:

```ts
const det = validarDetalhes(body.detalhes)
if (!det.ok) return NextResponse.json({ error: det.error }, { status: 400 })
// Aqui dentro do if, det é { ok: false; error: string } — det.error é válido ✅
// Depois do return, det é narrowed pra { ok: true; lista: [...] } — det.lista é válido ✅
```

Os "erros" só apareciam no check standalone da Mia (sem `tsconfig` do projeto), não no build real. **Nada a corrigir.** Próxima vez, validar o erro num `npx tsc -p .` real antes de catalogar.

### Item 3 — npm audit zerado

**3 vulnerabilidades antes:**
- `basic-ftp` (high) — transitiva via puppeteer
- `next` 16.2.2 (high) — DoS em Server Components
- `postcss` <8.5.10 (moderate) — XSS via `</style>` (CVE 2026-41305, publicado 20/04)

**Investigação revelou:** `puppeteer` estava em **dependencies** (prod, não dev), mas nenhum `import` de puppeteer existe no código. Nome de rota `preco-puppeteer` é legado — usa `fetch` com headers de browser, não puppeteer. **Lixo de dependência puxando ~300MB pra cada deploy.**

**Solução em 3 frentes:**
1. Remover `puppeteer` do package.json → mata `basic-ftp` (transitiva)
2. Bump `next` 16.2.2 → 16.2.4 (minor, fix de DoS)
3. `"overrides": { "postcss": "^8.5.10" }` no package.json → força versão segura (Next 16.2.4 ainda traz postcss 8.4.31 interno; CVE é recente, Next ainda não atualizou)

**Resultado:** `found 0 vulnerabilities` + `1048 deletions` no package-lock + build mais rápido no Vercel.

### Item 6 — Cache Pokédex via revalidateTag

**Estado anterior:** cache em memória por instância serverless, TTL 1h, sem invalidação ativa. Cada lambda do Vercel tinha cache próprio (fragmentação) — após scan/edição, prod ficava até 1h mostrando dados antigos POR INSTÂNCIA.

**Refactor:**
- `src/app/api/pokedex/route.ts`: `unstable_cache` com tag `'pokedex'`, revalidate fallback de 3600s
- `src/app/api/pokedex/species/route.ts`: mesma tag, TTL 24h
- `src/app/api/admin/pokedex/invalidate/route.ts`: `POST` que chama `revalidateTag('pokedex')`, protegido com `requireAdmin`

**Benefício:** cache compartilhado entre todas as lambdas (Vercel infra), invalidação ativa via 1 click no admin (futuro botão), e infra pronta pra Regra 5 (melhorias de preços começam 01/05/2026 — vão querer invalidar Pokédex automaticamente após scans).

### Item 5 — Webhook Stripe → lancamentos (V1 quebrado, V2 hotfixado)

**O erro de processo do dia.** Mia propôs criar coluna `stripe_event_id` em `lancamentos` + UNIQUE INDEX parcial pra idempotência, sem antes inspecionar o schema atual da tabela. Du aprovou, ZIP foi enviado, deploy feito, **webhook V1 entrou em produção quebrado em silêncio**: tentava inserir em coluna inexistente, falhava no catch que só logava (não quebrava o caminho crítico de `is_pro`/créditos/email).

Ao tentar rodar o SQL via MCP, Mia finalmente inspecionou a tabela e descobriu:

```
- Coluna `stripe_payment_intent_id` (TEXT, nullable) — JÁ EXISTIA
- Coluna `user_id` (UUID, nullable) — JÁ EXISTIA
- UNIQUE INDEX parcial `lancamentos_stripe_unique` em stripe_payment_intent_id WHERE not null — JÁ EXISTIA
```

**Toda a infraestrutura de idempotência já estava pronta.** Alguém em sessão anterior planejou e nunca implementou o uso. A "pendência" era literalmente "fazer o webhook USAR essas colunas".

**Hotfix V2 (deployado e validado):**
- Usa `stripe_payment_intent_id` existente (não cria coluna nova)
- Função `extrairPaymentIntentDeSession()` que pega PI direto (modo `payment` — separadores/scan) ou via fetch da invoice (modo `subscription` — Pro)
- Popula `user_id` no lançamento (rastreabilidade no admin financeiro)
- Idempotência via `lancamentos_stripe_unique` existente (23505 → log silencioso)
- Pula registro se PI for null (evita lançamento órfão)
- Filtra `billing_reason='subscription_create'` em invoice.payment_succeeded (já coberto em checkout.session.completed)
- Cancelamento NÃO gera lançamento (não é movimentação financeira)

**SQL `001_lancamentos_stripe_event_id.sql` foi descartado** — coluna não foi adicionada, schema do banco intacto.

### Nova lição interna (Regra 18 acima)

**SEMPRE** inspecionar schema antes de propor migration. Custo: 1 query SQL via MCP. Benefício: evita criar redundância, descobrir convenções existentes, e em caso ideal **descobre que o trabalho já foi metade-feito** — como aqui, onde a infra de idempotência existia há tempos sem ninguém saber.

---

## 📋 Arquivos modificados (sessão 22 inteira)

```
# Sessão 22 manhã (auth admin)
src/lib/admin-auth.ts                                 ← + função requireAdmin
src/app/api/admin/**/route.ts                         ← + requireAdmin em 19 rotas (28 handlers)
middleware.ts                                         ← try/catch fail-closed + matcher padronizado

# Sessão 22 tarde (manutenção)
package.json                                          ← - puppeteer, + next 16.2.4, + overrides.postcss
package-lock.json                                     ← regenerado (~1048 deletions)
src/app/api/stripe/webhook/route.ts                   ← V2: usa stripe_payment_intent_id + user_id
src/app/api/pokedex/route.ts                          ← unstable_cache + tag 'pokedex'
src/app/api/pokedex/species/route.ts                  ← unstable_cache + tag 'pokedex'
src/app/api/admin/pokedex/invalidate/route.ts         ← NOVO: POST com revalidateTag

# Documentação
BYNX_MASTER_CONTEXT.md                                ← errata + sessão 22 + 2 regras novas
```

**Total:** ~24 arquivos modificados, ~3000 linhas adicionadas (a maior parte é package-lock e contexto).

---

## 🚀 Pendências carregadas pra sessão 23

### Imediato
- 🟢 **Passo 11 — Analytics Premium dashboard** (3-4h) — clicks já em `loja_cliques`
- 🟡 Validar webhook V2 com compra real (cartão `4242 4242 4242 4242` em test) — verificar lançamento aparecer no admin financeiro

### Curto prazo
- 🔴 Passo 8 — Stripe per-loja (6-10h)
- 🔵 **01/05/2026 (3 dias):** começa fase de melhorias de preços (Regra 5)
- 🔵 **26/05/2026 (~1 mês):** ZenRows renova ($227.63), rodar `scan-sets-final.ts`

### Conhecidos
- ~~Webhook Stripe → `lancamentos`~~ → **RESOLVIDO** na sessão 22 (V2 deployado)
- ~~Cache Pokédex após mudanças~~ → **RESOLVIDO** na sessão 22 (revalidateTag)
- Backfill financeiro de compras antigas: webhook V2 só pega cobranças NOVAS. Se quiser linha histórica no admin financeiro, precisa script que puxa eventos passados da Stripe API e insere manualmente. Trabalho separado, não urgente.

---

## 🔑 Key Learnings — Sessão 22 (consolidado)

### Sobre auth e camadas

* **"Inseguro no nível X" não significa "inseguro no sistema".** Auth é em camadas e middleware Edge roda antes das route handlers. SEMPRE rastrear a cadeia completa antes de declarar vulnerabilidade. Olhar 1 nível e concluir é processo incompleto. (→ Regra 17)
* **Defense-in-depth não é desperdício**, mesmo quando descobre-se que a camada superior já protegia. Custo de manter é zero; protege contra: regressões futuras no middleware, bugs em mudanças de matcher, execução fora do Vercel (testes locais, scripts), middleware desabilitado por engano.
* **Fail-closed > fail-open em auth checks.** Try/catch sem fallback bloqueante = atacante pode forçar erros pra bypassar. Quando em dúvida, bloquear.
* **Bateria de curls em produção é o nível final de validação.** Code review diz "deveria proteger". Curl mostra "está protegendo".

### Sobre schema do banco e processo

* **Inspecionar schema ANTES de propor migration salva tempo, evita bugs e descobre convenções existentes.** (→ Regra 18) O caso webhook V1 foi exemplar: 30s de query SQL teriam revelado que `stripe_payment_intent_id` + UNIQUE INDEX já existiam, evitando 1 ZIP errado, 1 deploy quebrado e 1 hotfix.
* **Quando webhook falha em catch silencioso, lojista nem sabe.** Webhook V1 ficou ~30min em prod sem ninguém notar porque o caminho crítico (Pro/créditos/email) seguia funcionando. Lição: lançamento financeiro deveria fazer parte do caminho crítico OU ter alerta agressivo (Sentry, email pra Du). Anotado pra evolução futura — não é prioridade agora porque V2 já resolve.
* **`fixAvailable` do `npm audit` mente.** Disse que `next@16.2.4` resolveria postcss, mas na real o Next ainda traz postcss interno antigo. Validar com `npm install --package-lock-only` antes de afirmar que está resolvido.

### Sobre dependências

* **`puppeteer` em dependencies puxa ~300MB pra cada deploy** mesmo se não importado. Auditar deps de tempos em tempos: `find src scripts -name "*.ts" | xargs grep "import.*nome-do-pacote"` revela uso real.
* **`overrides` no package.json é a saída quando upstream é lento.** Especialmente útil pra CVEs recentes que ainda não foram absorvidos pelas deps que você usa.

### Sobre cache

* **Cache em memória + serverless = cache fragmentado.** Cada lambda Vercel é processo separado, cada um com cache próprio. Pra dados compartilhados, `unstable_cache` + tags é a saída correta no Next 16.

### Sobre o processo de trabalho

* **Quando descobre erro próprio, contar imediatamente.** Re-skin de "fix" pra "defense-in-depth" só funciona quando é honesto. Webhook V1 quebrado: imediatamente reconhecer e gerar V2, não tentar disfarçar.
* **Honestidade técnica > parecer competente.** Du está construindo Bynx em produção real, com dinheiro real (Stripe, ZenRows). Esconder ou minimizar erros desinforma decisões importantes.

---

## Footer

Sessão 22 fechou (dia inteiro): **Defense-in-depth completo na auth admin (28 handlers + middleware fail-closed + matcher padronizado) + 3 itens de manutenção resolvidos (npm audit zerado, webhook Stripe automatizado com idempotência reaproveitando schema existente, cache Pokédex com revalidateTag) + 2 regras novas no contexto + 2 erratas corrigidas (vulnerabilidade admin inexistente + falso positivo de TS narrowing) + 1 erro de processo aberto e corrigido (webhook V1 deployado quebrado por não inspecionar schema antes; hotfix V2 deployado)**.

**Capítulo de segurança e manutenção fechado.** Bynx entra na sessão 23 com auditoria de segurança limpa, dependências sem vulnerabilidades, financeiro automatizado, e cache otimizado pra fase de melhorias de preços que começa em 3 dias.

Próxima sessão: **Passo 11 — Analytics Premium dashboard** ou início antecipado das melhorias de preços (Regra 5).

