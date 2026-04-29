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


## 🔄 Continuação tarde-noite — Saga do Webhook (V1 → V5)

Ao validar o webhook V2 com compra real (cartão `4242 4242 4242 4242` em test mode), descobrimos que o webhook estava deployado e processando (Stripe Dashboard mostrava 200 OK, taxa de erro 0%), **mas o user não ficava Pro**. 5 deploys consecutivos foram necessários até atingir end-to-end funcionando. A saga inteira documentada abaixo serve como case-study das peculiaridades das APIs Stripe modernas E como exemplo do valor do MCP do Vercel pra debug.

### V1 (deployado) — Quebrado em silêncio

Mia propôs SQL pra adicionar `stripe_event_id` em `lancamentos` + UNIQUE INDEX, sem inspecionar schema. Du aprovou e deployou.

**Bug:** coluna inexistente. INSERT falhava em catch silencioso, restante do fluxo (is_pro, créditos, email) não chegava a rodar nas compras de Pro porque outro bug ANTERIOR jogava exceção antes — mas isso só foi descoberto depois.

**Sintoma observado:** webhook respondendo 200 OK, ZERO lançamentos no banco.

### V2 — Reaproveitar schema existente

Antes de aplicar V1 via MCP, Mia finalmente inspecionou a tabela `lancamentos`:

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'lancamentos';
```

E descobriu que **TUDO já existia há tempos**: `stripe_payment_intent_id` (TEXT, nullable), `user_id` (UUID), e UNIQUE INDEX parcial `lancamentos_stripe_unique`. Toda a infraestrutura de idempotência havia sido planejada por alguém em sessão anterior, mas o webhook nunca foi atualizado pra usar.

**V2 hotfix:** trocar `stripe_event_id` (campo inventado) por `stripe_payment_intent_id` (existente). Popular `user_id` no lançamento (rastreabilidade no admin financeiro).

### Validação V2 — bug oculto revelado

Du fez compra de teste com `bianca1@bianca1.com`. Tela `/pro-ativado` apareceu, mas `is_pro=false` no banco. **O webhook real estava quebrado bem antes do problema do V1.**

**Diagnóstico via MCP do Vercel** (descobrimos hoje que o MCP estava disponível — passo importante porque mudou todo o ritmo de debug):

```
[webhook] Erro: Invalid time value
```

`new Date(undefined * 1000).toISOString()` jogava `RangeError`. Caía no catch raiz que só logava e retornava 200 ao Stripe. **Bug existia há semanas e ninguém percebeu** porque catch silencioso enganava o monitoramento.

### V3 — Fix `current_period_end`

**Causa-raiz:** Stripe API `2025-03-31.basil` removeu `subscription.current_period_end` (subscription-level) e moveu pra `subscription.items.data[0].current_period_end` (item-level). Webhook do Stripe usa a versão configurada no Dashboard (no caso, `2026-03-25.dahlia`), não a `apiVersion` hardcoded no SDK.

**V3 hotfix:**
- Helper `getSubscriptionPeriodEnd()` que tenta `items.data[0]` primeiro e cai pra `subscription.current_period_end` antigo (compatibilidade)
- **Reorganização defensiva:** try/catch internos por bloco (UPDATE no user, busca de subscription, lançamento financeiro são INDEPENDENTES). Antes: tudo num try único → 1 erro = silêncio total
- Logs `[webhook] CRITICAL:` em erros pós-pagamento (filtráveis no Vercel pra alerta futuro)
- Logs `[webhook] Recebido: ...` na entrada — sempre tem rastro

**Validação:** bianca1 ficou Pro corretamente (is_pro, plano, customer_id, subscription_id, pro_expira_em populados). MAS lançamento ainda não foi criado.

### V4 — Fix `invoice.payment_intent` deprecated

Logs `[webhook/financeiro] Sem payment_intent_id — pulando lançamento` revelaram outro deprecation: a partir de `2025-03-31.basil`, Stripe removeu `invoice.payment_intent` direto e introduziu o **Invoice Payment object** com a estrutura `invoice.payments[].payment.payment_intent`.

**V4 hotfix:** novo helper `extrairPaymentIntentDeInvoice()` com 3 caminhos em ordem (novo → API list → legacy).

**Validação:** bianca2 também ficou Pro corretamente, mas lançamento AINDA falhou.

### V5 — `expand` explícito (FINAL)

Pesquisa na doc revelou:

> *"You can access invoice payments in two ways: **By expanding the payments field** on the Invoice resource. By using the Invoice Payment retrieve and list endpoints."*

O campo `payments` é **includable**, NÃO incluído por default no retrieve. V4 não expandiu, portanto array vinha vazio.

**V5 hotfix:**
- `expand: ['payments.data.payment.payment_intent']` no `stripe.invoices.retrieve()`
- Logs `[webhook/debug]` em CADA caminho do helper pra diagnóstico cirúrgico
- Logs do tamanho do array + estrutura do primeiro item em fallback

**Validação final** (compra de `teste@teste2.com`):

```
| descricao                     | Bynx Pro — assinatura mensal           |
| valor_bruto                   | R$ 29.90                               |
| fonte                         | stripe                                 |
| stripe_payment_intent_id      | pi_3TRJDOAanyB0hdos2pPB6AfM            |
| recebido                      | true                                   |
| user.is_pro                   | true                                   |
| user.pro_expira_em            | 2026-05-28 (1 mês à frente)            |
```

**End-to-end funcional.** Logs `[webhook/debug] PI extraído via invoice.payments[0]` confirmaram que o caminho principal funcionou — fallbacks ficaram como rede de segurança não usada.

---

## 🛠️ Descoberta de capability — MCP do Vercel

Durante o debug do V2 → V3, Du mencionou: *"pode olhar diretamente o navegador o site Vercel"*. Isso revelou que o **MCP do Vercel estava disponível** — Mia carregou via `tool_search` e descobriu acesso direto a:

- `Vercel:get_runtime_logs` (com filtro de query/level/source/time)
- `Vercel:list_deployments` (mostra commit message + state + URL)
- `Vercel:get_deployment_build_logs`

**Impacto:** o ciclo de debug que antes era "Mia pede print → Du tira print → Mia interpreta" virou "Mia consulta direto, valida, propõe fix". Reduziu cada ciclo de ~10min pra ~2min. **Sem o MCP, a saga V1→V5 teria levado 1-2 dias.** Com MCP, ficou em ~1h.

**Implicação pro fluxo de trabalho futuro:** sempre que Mia tiver dúvida sobre estado de produção (banco, deploys, logs), **carregar MCP via `tool_search` antes** de perguntar pra Du. MCPs disponíveis hoje: Supabase, Vercel, Stripe (não testado ainda).

---

## 🔧 Fix tardio — Comprador visível no admin financeiro

Após o V5 funcionar e gerar o primeiro lançamento Stripe (`teste@teste2.com`, R$ 29,90), Du percebeu um detalhe ao abrir `/admin/financeiro`: a linha aparecia, mas **não dizia QUEM tinha comprado**. O webhook estava populando `lancamentos.user_id` corretamente, mas:

1. **API do admin** (`/api/admin/financeiro/lancamentos` GET) fazia `select('*')` puro — retornava só o UUID do user_id sem joinar com `users`
2. **UI** não tinha nem coluna nem render pra mostrar usuário

**Fix em 2 arquivos:**

- **`src/app/api/admin/financeiro/lancamentos/route.ts`:** trocar `select('*')` por embed Supabase usando a FK existente:
  ```ts
  .select('*, user:users!lancamentos_user_id_fkey(email, name)', { count: 'exact' })
  ```
  Depois flatten do embed: `{ user: { email, name } }` → campos diretos `user_email` e `user_name` no objeto retornado. UI consome simples.

- **`src/app/admin/financeiro/page.tsx`:** + 2 campos no type `Lancamento` + render condicional abaixo da descrição:
  ```tsx
  {l.user_email && (
    <div style={{ fontSize: 11, color: 'rgba(167,139,250,0.85)', marginTop: 2 }}>
      Comprador: {l.user_name ? `${l.user_name} · ` : ''}{l.user_email}
    </div>
  )}
  ```

**Decisão de design:** mostrei inline (abaixo da descrição, junto com a observação) ao invés de criar 8ª coluna na tabela. Razões:
- Lançamentos manuais (infra/marketing/dominio) não têm comprador → coluna ficaria vazia em 90% dos casos
- Tabela já tem 7 colunas; 8ª pode quebrar em mobile
- Cor roxa combina com o badge `[Stripe]` que já é roxo (mesma família visual)
- `{l.user_email && ...}` esconde a linha quando não tem user, mantendo limpo

**Confirmação prévia da FK** (Regra 18 cumprida):
```sql
SELECT * FROM information_schema.table_constraints
WHERE constraint_type='FOREIGN KEY' AND table_name='lancamentos';
-- → lancamentos_user_id_fkey: user_id → users.id ✓
```

**Lição:** ao popular um campo novo no banco (sessão 22 noite, V2: `user_id` no lançamento), **sempre validar que a UI consome o dado também**. Funcionalidade backend completa ≠ funcionalidade entregue. Du só percebeu o gap ao USAR a feature, não ao testá-la tecnicamente.

---

## 📋 Arquivos modificados (sessão 22 inteira — versão final)

```
# Sessão 22 manhã (auth admin)
src/lib/admin-auth.ts                                 ← + função requireAdmin
src/app/api/admin/**/route.ts                         ← + requireAdmin em 19 rotas (28 handlers)
middleware.ts                                         ← try/catch fail-closed + matcher padronizado

# Sessão 22 tarde (manutenção + cache + webhook V1/V2)
package.json                                          ← - puppeteer, + next 16.2.4, + overrides.postcss
package-lock.json                                     ← regenerado (~1048 deletions)
src/app/api/stripe/webhook/route.ts                   ← V2 (depois V3, V4, V5)
src/app/api/pokedex/route.ts                          ← unstable_cache + tag 'pokedex'
src/app/api/pokedex/species/route.ts                  ← unstable_cache + tag 'pokedex'
src/app/api/admin/pokedex/invalidate/route.ts         ← NOVO: POST com revalidateTag

# Sessão 22 noite (saga do webhook V3 → V5)
src/app/api/stripe/webhook/route.ts                   ← V3: getSubscriptionPeriodEnd + try/catch isolados + logs CRITICAL
                                                      ← V4: extrairPaymentIntentDeInvoice (3 caminhos)
                                                      ← V5: expand explícito + logs [webhook/debug]

# Sessão 22 fim de dia (fix tardio — comprador visível)
src/app/api/admin/financeiro/lancamentos/route.ts     ← embed users!fk + flatten user_email/user_name
src/app/admin/financeiro/page.tsx                     ← + 2 campos no type + render "Comprador: ..." abaixo da descrição

# Documentação
BYNX_MASTER_CONTEXT.md                                ← errata + sessão 22 + 3 regras novas
```

**Total:** 5 deploys de webhook + 1 deploy de fix UI (comprador) num único dia. Bynx hoje à noite tem auth admin defense-in-depth, dependências limpas, cache de Pokédex otimizado, webhook Stripe **finalmente** funcional end-to-end, e admin financeiro mostrando quem comprou cada item.

---

## 📋 Regras BYNX consolidadas (16 regras + 3)

Regras adicionadas na sessão 22:

| # | Regra |
|---|---|
| 17 | **Auth é em camadas — sempre verificar middleware + matcher antes de declarar vulnerabilidade em route handlers.** Olhar uma camada só e concluir é diagnóstico incompleto. |
| 18 | **Antes de propor SQL/migration, SEMPRE inspecionar schema atual via `Supabase:execute_sql`** com `SELECT FROM information_schema.columns` e `pg_indexes`. Schema do banco evolui sem o código refletir, e propor coluna nova quando já existe equivalente cria redundância e bugs sutis. |
| 19 | **APIs externas mudam — antes de afirmar que um campo existe, consultar a doc da versão-alvo.** Não confiar em padrões assumidos do training data ou de versões antigas. Stripe API foi a primeira lição (4 hotfixes em 1 dia: `current_period_end`, `invoice.payment_intent`, `expand` requerido, `apiVersion` hardcoded ≠ versão do webhook). Princípio aplica também a: Supabase API, Vercel API, Resend, qualquer SDK. **Quando a chamada for crítica (financeiro, auth, dados sensíveis), validar com `web_search` + doc oficial antes de codar.** |

---

## 🚀 Pendências carregadas pra sessão 23

### Imediato
- 🟢 **Passo 11 — Analytics Premium dashboard** (3-4h) — clicks já em `loja_cliques`
- 🟡 Limpeza dos logs `[webhook/debug]` num V6 cosmético (depois de 2-3 semanas observando logs em prod)

### Curto prazo
- 🔴 Passo 8 — Stripe per-loja (6-10h)
- 🔵 **01/05/2026 (3 dias):** começa fase de melhorias de preços (Regra 5)
- 🔵 **26/05/2026 (~1 mês):** ZenRows renova ($227.63), rodar `scan-sets-final.ts`

### Cleanup do sandbox Stripe (não urgente)
- bianca1@bianca1.com tem subscription ativa em test mode (`sub_1TRIuZ...`) sem lançamento financeiro associado
- bianca2@bianca2.com tem subscription ativa em test mode (`sub_1TRJ4b...`) sem lançamento financeiro associado
- teste@teste2.com tem subscription ativa em test mode + lançamento corretamente registrado (validation final do V5)
- **Ação opcional:** cancelar as subscriptions teste no Stripe Dashboard pra limpar o sandbox

### Conhecidos resolvidos
- ~~Webhook Stripe → `lancamentos`~~ → **RESOLVIDO** sessão 22 (V5)
- ~~Cache Pokédex após mudanças~~ → **RESOLVIDO** sessão 22 (revalidateTag)
- ~~17 rotas admin sem auth~~ → **RESOLVIDO** sessão 22 (defense-in-depth, embora não fosse vulnerabilidade real)

### Conhecidos novos
- **Backfill financeiro de compras antigas:** webhook só pega cobranças NOVAS desde o V5. Bianca1, bianca2 ficaram sem lançamento. Em prod real (live mode), se houver compras antigas pré-fix, precisaria script que puxa eventos da Stripe API e insere manualmente. Não urgente.
- **Alerta agressivo se webhook financeiro falhar:** lição da saga foi que catch silencioso queimou semanas sem ninguém perceber. V3+V4+V5 já adicionaram logs `CRITICAL:` filtráveis. **Próximo nível:** Sentry/Resend pra email automático ao Du quando aparecer "[webhook] CRITICAL". Anotar como tarefa de **observabilidade** (~1-2h).

---

## 🔑 Key Learnings — Sessão 22 (consolidado final)

### Sobre auth e camadas
* **"Inseguro no nível X" não significa "inseguro no sistema".** Auth é em camadas e middleware Edge roda antes das route handlers. SEMPRE rastrear a cadeia completa antes de declarar vulnerabilidade. (→ Regra 17)
* **Defense-in-depth não é desperdício**, mesmo quando descobre-se que a camada superior já protegia.
* **Fail-closed > fail-open em auth checks.** Try/catch sem fallback bloqueante = atacante pode forçar erros pra bypassar.

### Sobre schema e processo
* **Inspecionar schema ANTES de propor migration salva tempo, evita bugs e descobre convenções existentes.** (→ Regra 18)
* **Webhook V1 só foi descoberto quando Mia foi rodar SQL via MCP** — o MCP forçou a inspeção que deveria ter sido feita antes.

### Sobre APIs externas (NOVA frente, sessão 22 noite)
* **Stripe API tem MUITAS mudanças breaking entre versões basil/dahlia.** `current_period_end` movido, `invoice.payment_intent` removido, `expand` agora requerido pra `payments`. (→ Regra 19)
* **`apiVersion` hardcoded no SDK ≠ versão do webhook.** Webhook usa a versão configurada no Stripe Dashboard. Pode haver mismatch entre como o código manda e como recebe.
* **Doc oficial é ground truth, não training data.** Em 2 das 5 versões do webhook, o erro veio de Mia assumir comportamento "padrão" sem validar.

### Sobre observabilidade
* **Catch silencioso é dívida técnica disfarçada.** Webhook V0 ficou semanas quebrado porque catch só logava sem alertar. Anteriormente também: bug do RLS em `pokemon_cards` que era falha silenciosa client-side.
* **`[webhook] CRITICAL:` é o mínimo. O ideal seria Sentry ou email automático.** Pra fluxo financeiro, monitorar passivamente é gambiarra perigosa.
* **MCP do Vercel + Supabase mudou completamente a velocidade de debug.** Loop "pede print → tira print → interpreta" virou "consulta direto, decide". Saga V1→V5 levou ~1h, sem MCP teria sido 1-2 dias.

### Sobre o processo de trabalho
* **Quando descobre erro próprio, contar imediatamente** — re-skin de "fix" pra "defense-in-depth" só funciona quando é honesto.
* **Honestidade técnica > parecer competente.** Cada uma das 5 versões do webhook foi precedida de "errei aqui, foi por isso, vou corrigir". Du nunca ficou sem saber o que tava acontecendo.
* **Iteração pequena + validação rápida > fix grande + reza pra dar certo.** V3 → V4 → V5 cada um com diff cirúrgico de 5-50 linhas, deploy + teste + log = ciclo de 5min. Solução grande de uma só vez teria múltiplos bugs misturados.

---

## Footer

Sessão 22 fechada (dia inteiro, ~10h de trabalho):

**Manhã:** Defense-in-depth completo na auth admin (28 handlers + middleware fail-closed + matcher padronizado) + 1 errata + 1 falso positivo de TS narrowing + Regra 17.

**Tarde:** 3 itens de manutenção (npm audit zerado, cache Pokédex via revalidateTag, webhook Stripe automatizado) + descoberta de schema existente que evitou migration redundante + Regra 18.

**Noite:** Saga completa do webhook V1 → V5. 4 bugs encontrados em sequência (coluna inventada → API moderna do Stripe `current_period_end` → `invoice.payment_intent` deprecated → `expand` requerido). End-to-end Stripe → admin financeiro funcionando. Descoberta do MCP do Vercel acelerou debug em 10x. Regra 19.

**Fim de dia:** Fix tardio do "comprador invisível" no admin financeiro (UI não consumia o `user_id` que o webhook V5 já populava). Embed Supabase com FK + render condicional roxo abaixo da descrição. Lição emergente: funcionalidade backend completa ≠ funcionalidade entregue — sempre validar consumo na UI também.

**Bynx hoje:** auth admin com 2 camadas de proteção, dependências sem vulnerabilidades, cache compartilhado entre lambdas, webhook Stripe gerando lançamentos automáticos com idempotência, admin financeiro mostrando quem comprou cada item, e contexto histórico atualizado com todas as decisões e erros documentados.

**Próxima sessão (23):** Passo 11 (Analytics Premium dashboard) ou início antecipado das melhorias de preços (Regra 5 começa oficialmente em 3 dias).

**3 regras adicionadas (17, 18, 19), todas focadas em "**verificar antes de afirmar**" — auth, banco, APIs externas. Padrão emergente que talvez vire uma meta-regra na sessão 23.**


---

## 📅 Sessão 23 (29/04/2026 madrugada) — Passo 11 + Landing Relançamento

### Passo 11 — Analytics Premium dashboard ✅
3 arquivos entregues e testados em produção:
- `src/app/api/lojas/[id]/analytics/route.ts` — GET com gating (402 + `requires_upgrade` se não-premium), agrega cliques por tipo/dia/usuário, períodos 7/30/90 dias
- `src/components/lojas/AnalyticsCard.tsx` — componente client com 2 modos: teaser borrado + CTA upgrade (não-premium) ou dashboard completo (premium) com 5 KPIs por tipo, Line chart (chart.js + react-chartjs-2), stats logado/anônimo
- Patch em `src/app/minha-loja/[id]/page.tsx` — +4 linhas (import + `<AnalyticsCard>` entre PlanoCard e Form/Resumo)

**Validação em prod:** Du tem 3 lojas (básica, pro, premium) — todas funcionaram. Logs Vercel: 5 GETs ao endpoint, 0 erros 4xx/5xx. **Gating client-side funcionando perfeitamente** — lojas básica/pro nem chegam a chamar a API (0 requests 402), só renderizam o teaser.

**Decisões de design:**
- Analytics = exclusivo do plano `premium` (descrição do plano confirmava: "analytics e rotação no topo")
- Defense-in-depth: client esconde, mas server gateia também
- `porTipo` sempre completo (5 tipos mesmo com 0) e `porDia` preenchido com zeros (gráfico contínuo)

### Landing Page — Relançamento estratégico 🚀
Pedido do Du com 3 frentes:
1. Refletir muitas novidades implementadas
2. Remover dependência de LigaPokemon
3. Estudar abordagens de venda baseadas em podcast (NA - ROI Hunters #334)
4. SEO completo para lançamento próximo

**Estudo do podcast** — princípios extraídos e aplicados na landing:
1. **Materializar perda, não pressão** → Hero com headline pergunta + 4 cenários de dor
2. **Confiança > tudo** → Números reais (22k+ cartas, 240+ sets), sem mentir adoção (8 users ainda)
3. **Frequência > Alcance** → copy focada em quem realmente entende, não em maximizar visitantes
4. **5 macro etapas com microcommits** → Hero → Dor → Solução → Prova → CTA
5. **Domina mercado atual antes de diversificar** → Lojista entra como bloco de captura no final, não rouba palco
6. **Need states (ocasiões de uso)** → "Vou pra liga e...", "Abri booster e...", "Recebi oferta no zap..."
7. **CRM = aprofundar no cliente** → Linguagem TCG Pokémon BR (trade, liga, Holo/Reverse/Foil, booster, set)

**Decisão de tom:** Headline opção A — *"Quanto vale sua coleção Pokémon hoje?"* (pergunta direta) com subhead reconhecendo dor + reposicionando Bynx como resposta literal.

**5 arquivos entregues + 2 deletados:**
- `src/app/page.tsx` — landing nova (Hero + 4 dores + Como funciona reescrito sem Liga + 8 features atuais + bloco lojista + FAQ atualizado + JSON-LD FAQPage inline)
- `src/app/layout.tsx` — metadata sem Liga + JSON-LD WebSite SearchAction + WebApplication com 3 planos
- `src/app/sitemap.ts` (NOVO) — substitui `public/sitemap.xml`, lista lojas ativas dinamicamente do Supabase
- `src/app/robots.ts` (NOVO) — substitui `public/robots.txt`
- `public/manifest.json` — description ajustada
- DELETADOS: `public/sitemap.xml` e `public/robots.txt`

**Linguagem usada na landing:**
- Termos do nicho: trade, liga, booster, set, Holo, Reverse, Foil, Promo, Special Illustration
- Cartas no mockup: Mew Star (R$19k), Captain Pikachu (R$7.9k), Umbreon ex (R$5.3k), Charizard Skyridge (R$2.8k) — todas com imagens próprias (Supabase Storage + pokemontcg.io oficial), ZERO dependência da Liga

### 📊 SEO — ganhos concretos do relançamento

| Frente | Antes | Depois |
|---|---|---|
| FAQPage rich snippet (Google) | ❌ | ✅ 7 perguntas estruturadas |
| WebSite SearchAction (sitelinks search box) | ❌ | ✅ Pode ativar |
| Sitemap | Estático, 5 URLs fixas | Dinâmico, lojas BR puxadas do banco |
| Robots | Estático | Dinâmico, atualizado |
| Menções a "LigaPokemon" | 5 ocorrências | 0 |

### 🚀 Pendências carregadas pra próxima sessão (24)

**SEO — fase 2 (continuação do relançamento):**
- 🟢 **Google Analytics 4** — instalar tag (não está no projeto ainda)
- 🟢 **Google Search Console** — adicionar bynx.gg, verificar ownership, submeter sitemap
- 🟢 **Bing Webmaster Tools** — equivalente Bing
- 🟡 **Lighthouse audit** após o deploy (alvo: 90+ em todas as métricas)
- 🟡 **Verificar OG image** (`https://bynx.gg/og-image.jpg`) — confirmar 1200x630
- 🟡 **Página dedicada `/para-lojas`** (sub-landing pra persona lojista, mais profundidade) — anotada como melhoria futura

**Resto da fila (sem mudanças):**
- 🟡 Cleanup sandbox Stripe (~5min) — cancelar subscriptions teste de bianca1, bianca2, teste@teste2
- 🟡 Alerta proativo `[webhook] CRITICAL` (~1-2h) — Sentry/email
- 🟡 V6 cosmético removendo logs `[webhook/debug]` (em 2-3 semanas)
- 🔵 **01/05/2026 (em 2 dias):** Melhorias de preços (Regra 5)
- 🔵 **26/05/2026:** ZenRows renova ($227.63), rodar `scan-sets-final.ts`
- 🔴 Passo 8 — Stripe per-loja (6-10h) — provavelmente junho

### 🔑 Lições — Sessão 23

* **Estratégia ANTES de código.** Du pediu landing com base em podcast de vendas. Ler o podcast inteiro + diagnosticar landing atual + apresentar 5 camadas de estratégia + 3 perguntas pra Du decidir → tudo isso ANTES de tocar em arquivo. Resultado: code-fit perfeito, zero retrabalho de tom.
* **Decidir com convicção quando o cliente pede.** Du pediu "qual sua recomendação?" — entreguei opção A com justificativa, ao invés de cair em "depende". Quando há pergunta clara, há resposta clara.
* **Honestidade nas métricas é prova social.** 8 users e 3 lojas seriam "early stage" mentido como "comunidade ativa". 22.861 cartas catalogadas é prova HONESTA do produto. Catálogo robusto > adoção forçada.
* **SEO é trabalho em camadas, não 3 meta tags.** 7 frentes mapeadas: metadata, OG, JSON-LD (4 tipos), sitemap dinâmico, robots dinâmico, manifest, semântica HTML. FAQPage inline é maior ganho de rich snippet.

