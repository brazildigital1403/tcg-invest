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
