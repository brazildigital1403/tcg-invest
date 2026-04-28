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
- Usuário admin é client-side puro (admin/layout.tsx) — adicionar proteção server-side

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
