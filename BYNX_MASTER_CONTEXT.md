# BYNX — Sessão 27

**Data:** 03 maio 2026
**Duração:** ~3h
**Foco:** Migração completa TEST → LIVE no Stripe + smoke test em produção real

---

## TL;DR

Sessão dedicada à migração da infra de pagamentos do Bynx do TEST mode para o LIVE mode no Stripe. Saímos com **100% da configuração concluída** e validada do nosso lado: 10 produtos LIVE criados, 10 prices LIVE coletados e validados visualmente, Customer Portal LIVE configurado com 6 produtos e 2 links legais, webhook LIVE em produção, 12 envs Vercel atualizadas como Sensitive (cumprindo esteira #4 da S26), 6 deploys produção todos READY, 2 subs TEST órfãs canceladas, DB limpo.

**O único bloqueio para o lançamento é externo:** Stripe Brasil ainda está com `charges_enabled: false` em revisão interna (`disabled_reason: under_review`), apesar do KYC mostrar todas as tarefas como "Concluídas" na UI. Suporte Stripe contatado e ofereceu encaminhamento para especialista que pode acelerar a propagação.

**Lançamento previsto:** 24-72h após Stripe liberar a capability (provável segunda 05/05 a quarta 07/05).

---

## Decisões da sessão

- **Não fazer backup DB pré-migração** (todos os dados são teste, sem necessidade)
- **Lançamento adiado de "amanhã" para "quando Stripe liberar"** (depende de capability externa)
- **Cancelar subs órfãs em TEST mode** ao final (Lendario Premium, gabis Pro)
- **Configurar todas as 12 envs como Sensitive** no Vercel (esteira #4 da S26 cumprida)
- **MCP Stripe segue em TEST mode** — Du fez todas operações LIVE manualmente no Dashboard, Mia validou cada passo via prints
- **Smoke test final só após capability liberar** (sem teste de R$ 5,90 hoje porque Stripe rejeita)

---

## Auditoria inicial e estado do ambiente

### Pré-sessão (start às 06:38 BRT)
- Deploy mais recente: `dpl_EGsPtwAQLzpvLxfenLVj43PoikSL` (commit `46e0891a` — master S26) READY
- DB consistente: 8 eventos processados, 0 erros, 12 lançamentos
- 1 sub Lojista TEST ativa (Lendario Premium trial 14d)
- 1 sub User TEST ativa (gabis Pro Mensal)
- 4 users com `stripe_customer_id` setado (legacy de S26)
- Stripe MCP confirmado em TEST mode (`prod_*` retornados eram TEST mode IDs)

### Stripe LIVE Account
- ID da conta: `acct_1TMuWQPNrv6a7zCF`
- Endereço: Avenida Imperatriz Leopoldina, 701 — São Paulo/SP
- KYC submetido: 03/mai/2026 (mesma data do início da sessão)
- API version: `2026-03-25.dahlia`

---

## FASE 1 — Stripe Dashboard LIVE (~30min)

### 1.1 — Ativação LIVE
Du desligou toggle "Test mode" no Dashboard. Stripe ofereceu opção "Choose what to copy" e foram copiados:
- ✅ Products
- ✅ Prices
- ✅ Customer Portal configuration
- ❌ Customers (orientação Mia: clientes de teste não devem ir pro LIVE)
- ❌ Subscriptions (orientação Mia: subs de teste)
- ❌ Webhooks (orientação Mia: vamos criar do zero pra gerar `STRIPE_WEBHOOK_SECRET` novo)
- ❌ Coupons / Tax rates / Payment links (não usados)

### 1.2 — 10 produtos criados (preservaram product IDs do TEST)
Stripe **preservou os product IDs** ao copiar do sandbox, mas **gerou price IDs novos** (típico do Stripe).

| Produto | Product ID (preservado) | Preço |
|---|---|---|
| Bynx Pro - Mensal | `prod_ULbnx0FcTrb0EM` | R$ 29,90/mês |
| Bynx PRO — Anual | `prod_ULbo5z08W2RUcy` | R$ 249,00/ano |
| Bynx - Scan Básico | `prod_UNXXp19seT5VLI` | R$ 5,90 (one-time) |
| Bynx - Scan Popular | `prod_UNXXGkK2nvJUYf` | R$ 14,90 (one-time) |
| Bynx - Scan Colecionador | `prod_UNXYM65Ni6vwmA` | R$ 34,90 (one-time) |
| Bynx - Separadores de Fichário | `prod_UNVovbwv3KdPhO` | R$ 14,90 (one-time) |
| Bynx Lojista Pro - Mensal | `prod_UR74i9K5tgOkxP` | R$ 39,00/mês |
| Bynx Lojista Pro - Anual | `prod_UR76bUgvKWdt9i` | R$ 390,00/ano |
| Bynx Lojista Premium - Mensal | `prod_UR76wrnzNxOovp` | R$ 89,00/mês |
| Bynx Lojista Premium - Anual | `prod_UR764jWI3VyRhP` | R$ 890,00/ano |

### 1.3 — 10 price IDs LIVE (NOVOS — gerados pela Stripe ao copiar)

```
STRIPE_PRICE_MENSAL=price_1TSvr6PNrv6a7zCFoyRwyfK0
STRIPE_PRICE_ANUAL=price_1TSvr6PNrv6a7zCFzUhD56D5
STRIPE_PRICE_SCAN_BASICO=price_1TSvr5PNrv6a7zCFE4gjgLKM
STRIPE_PRICE_SCAN_POPULAR=price_1TSvr5PNrv6a7zCFXGKpYNU6
STRIPE_PRICE_SCAN_COLECIONADOR=price_1TSvr6PNrv6a7zCFNDXFmvZU
STRIPE_PRICE_SEPARADORES=price_1TSvr5PNrv6a7zCFlZol94Kc
STRIPE_PRICE_LOJISTA_PRO_MENSAL=price_1TSvr7PNrv6a7zCFNGAplIW0
STRIPE_PRICE_LOJISTA_PRO_ANUAL=price_1TSvr6PNrv6a7zCFtPgUE32X
STRIPE_PRICE_LOJISTA_PREMIUM_MENSAL=price_1TSvr5PNrv6a7zCFB4pFDmWW
STRIPE_PRICE_LOJISTA_PREMIUM_ANUAL=price_1TSvr6PNrv6a7zCF6qcvwRZh
```

⚠️ **Atenção a 2 IDs com caracteres ambíguos:**
- `STRIPE_PRICE_SEPARADORES`: tem `lZol` (L minúsculo, Z, O minúsculo, L minúsculo)
- `STRIPE_PRICE_LOJISTA_PRO_MENSAL`: tem `AplIW0` (L minúsculo, I maiúsculo, W, zero)

Validação cruzada feita visualmente pela Mia em todos os 10 prints (cada produto Du clicou e mandou print da seção Events do produto).

**Padrão de identificação:**
- Sufixo LIVE: `PNrv6a7zCF...` (deriva do account ID `acct_1TMuWQPNrv6a7zCF`)
- Sufixo TEST: `AanyB0hdos...` (deriva da sandbox account interna do Stripe)

### 1.4 — Customer Portal LIVE
**Configurado com:**
- ✅ Invoice history
- ✅ Customer information (name, email, billing address, phone, tax ID — sem shipping address)
- ✅ Payment methods
- ✅ Cancel subscriptions com **"Cancel at end of billing period"** (Netflix-style)
- ✅ Cancellation reason (collect ON, com motivos padrão)
- ✅ Customers can switch plans (essencial pra upgrade/downgrade)
- ✅ 6 produtos subscription habilitados (Pro user M/A + Lojista Pro M/A + Lojista Premium M/A)
- ✅ Prorate charges and credits
- ✅ Invoice prorations immediately at the time of the update
- ✅ Downgrades: Update immediately
- ❌ Customers can change quantity (OFF — não usamos)
- ❌ Promotion codes (OFF — não usamos)
- ✅ Portal header: "Bynx"
- ✅ Legal policies via Public business information:
  - Terms of service: `https://www.bynx.gg/termos`
  - Privacy policy: `https://www.bynx.gg/privacidade`

### 1.5 — Webhook LIVE criado
- **Webhook ID:** `we_1TT3XNPNrv6a7zCF1DqNgT4x`
- **Nome:** `elegant-inspiration` (auto-gerado)
- **URL:** `https://www.bynx.gg/api/stripe/webhook` ⭐ (com `www.`)
- **API version:** `2026-03-25.dahlia`
- **Status:** Ativo
- **6 eventos:**
  - `checkout.session.completed`
  - `customer.subscription.deleted`
  - `customer.subscription.updated`
  - `invoice.payment_failed`
  - `invoice.payment_succeeded`
  - `charge.dispute.created`
- **Signing secret:** `whsec_*` (copiado por Du, repassado direto pra env Vercel — não trafegou no chat)

### 1.6 — Custom Domain Stripe (extra, descoberto durante debug)
Du adicionou `checkout.bynx.gg` como custom domain Stripe. Estado ao final da sessão: "Adicionando" (DNS verificado, aguardando 3h pra Stripe estabilizar). Não bloqueou nada — domain custom só afeta a aparência das páginas hospedadas pela Stripe (`checkout.stripe.com` → `checkout.bynx.gg`), não o backend.

---

## FASE 2 — Vercel envs (12 atualizações)

Du atualizou as 12 envs em 3 blocos sequenciais. Cada bloco disparou um redeploy automático do Vercel (action: `redeploy`):

### Bloco 1 — Chaves de autenticação (2 envs)
- `STRIPE_SECRET_KEY` → `sk_live_...`
- `STRIPE_WEBHOOK_SECRET` → `whsec_...` (gerado no passo 1.5)

### Bloco 2 — Price IDs B2C (6 envs)
- `STRIPE_PRICE_MENSAL`
- `STRIPE_PRICE_ANUAL`
- `STRIPE_PRICE_SCAN_BASICO`
- `STRIPE_PRICE_SCAN_POPULAR`
- `STRIPE_PRICE_SCAN_COLECIONADOR`
- `STRIPE_PRICE_SEPARADORES`

### Bloco 3 — Price IDs Lojista (4 envs)
- `STRIPE_PRICE_LOJISTA_PRO_MENSAL`
- `STRIPE_PRICE_LOJISTA_PRO_ANUAL`
- `STRIPE_PRICE_LOJISTA_PREMIUM_MENSAL`
- `STRIPE_PRICE_LOJISTA_PREMIUM_ANUAL`

⚠️ **Todas as 12 envs marcadas como Sensitive** (cumprindo esteira #4 da S26: deletar+recriar, NÃO usar "Rotate Variable" — gera nova chave do Stripe e quebra produção).

---

## FASE 3 — Deploys e debug

### 6 deploys produção da sessão (todos READY)

| # | Deploy ID | Origem | Estado |
|---|---|---|---|
| 1 | `dpl_AkR6pez1qqmGyr2aKFpEGY9aGsbs` | Auto-redeploy (env update Bloco 1 parcial) | READY |
| 2 | `dpl_3W2w3bHaJGRj7jqh8gJRNryFVL5S` | Auto-redeploy (env update intermediário) | READY |
| 3 | `dpl_AYQ8TRjw27n8rGvvNj4MkxQUTxGQ` | Auto-redeploy (env update intermediário) | READY |
| 4 | `dpl_293p3mdvnomK6vAs1bK1FLRk2vVV` | Auto-redeploy (último auto, com envs todas atualizadas) | READY |
| 5 | `dpl_6KiJCGkYC1cEmuXcv8wy1dXYCa7a` | **Force redeploy SEM CACHE** (resolveu bug — ver abaixo) | READY |

### Bug encontrado e resolvido durante debug

**Sintoma:** ao tentar comprar Scan Básico em LIVE pela primeira vez (deploy `dpl_293p3...`), 500 com `[stripe/checkout] CRITICAL: No such price: 'price_1TOmS9AanyB0hdosXHvx08Yc'` (ID TEST).

**Causa raiz:** Vercel disparou auto-redeploys ANTES das 12 envs estarem todas atualizadas. O snapshot de envs do deploy `dpl_293p3...` pegou metade TEST + metade LIVE.

**Solução:** Force redeploy SEM CACHE → Vercel re-leu envs frescas e pegou todas LIVE corretamente. Após isso, erro mudou de `No such price` (price ID errado) para `Your account cannot currently make live charges` (capability bloqueada — confirmação de que as envs LIVE estavam todas certas).

**Aprendizado:** ao atualizar muitas envs em sequência, sempre fazer um force redeploy SEM CACHE no final pra garantir que o deploy ativo tem o snapshot consistente de TODAS as envs.

### Bug paralelo: customer fantasma da gabis

Logado como gabis@gabis.com (que tinha `stripe_customer_id` de TEST mode da S26), checkout em LIVE falhou com `No such customer: 'cus_UQDqTMrH7GKlPV'` — customer existia em TEST mas não LIVE.

**Solução:** SQL UPDATE limpando `stripe_customer_id` e `stripe_subscription_id` da gabis. Backend cria customer LIVE novo no próximo checkout.

---

## FASE 4 — Diagnóstico final do bloqueio Stripe

Após force redeploy + limpar customer fantasma, novo erro: `Your account cannot currently make live charges`. Du contatou suporte Stripe via chat. Resposta oficial:

```json
{
  "charges_enabled": false,
  "capabilities.card_payments": "inactive",
  "capabilities.boleto_payments": "inactive",
  "disabled_reason": "under_review",
  "details_submitted": true,
  "currently_due": []
}
```

Du também rodou `curl https://api.stripe.com/v1/account` com sk_live e confirmou os mesmos valores. **Estado oficial: `under_review` — Stripe Brasil está revisando internamente apesar do KYC mostrar tarefas concluídas na UI.**

Suporte Stripe ofereceu encaminhamento para especialista que pode verificar status interno e potencialmente acelerar a propagação. Du recebeu instrução para responder "sim" e fornecer contexto (volume estimado, setor, URL).

---

## FASE 5 — Limpeza pós-sessão

### Subs TEST canceladas via Stripe MCP
- `sub_1TSubLAanyB0hdosIBpP8iWd` (gabis Pro Mensal active) → canceled
- `sub_1TStIBAanyB0hdosLmwT83S6` (Lendario Premium trialing) → canceled

### DB limpo
- `users.stripe_customer_id` da gabis: NULL
- `users.stripe_subscription_id` da gabis: NULL
- `lojas.stripe_subscription_id` da Lendario: NULL
- `lojas.trial_usado_em` da Lendario: **mantido** (proteção anti-burlagem trial 14d permanece ativa)

---

## Estado final do DB pós-sessão 27

| Métrica | Valor |
|---|---|
| Eventos Stripe processados (legacy S26 TEST) | 8 |
| Eventos com erro | 0 |
| Users com Stripe customer | 4 (todos legacy de TEST mode S26 — não afetam LIVE) |
| Users com Stripe subscription | 0 ✅ (gabis limpa) |
| Lojas com Stripe subscription | 0 ✅ (Lendario limpa) |
| Lojas com trial usado (anti-burlagem) | 1 (Lendario — protegida) |
| Lançamentos Stripe registrados | 12 (todos legacy de TEST mode S26) |
| Soma total movimentada (testes legacy) | R$ 924,10 |

---

## Estado dos users/lojas

| Entidade | Estado | Observação |
|---|---|---|
| `eduardo@eduardowillian.com` (admin) | is_pro=true, plano=mensal, scan_creditos=121, separadores=true, sem stripe_customer_id | Pro de cortesia/admin/teste antigo |
| `gabis@gabis.com` (smoke test S26) | is_pro=true, plano=mensal, scan_creditos=15, separadores=true, **stripe_customer_id=NULL** | Limpa de Stripe TEST refs após bug do customer fantasma |
| Loja "Lendario Card Games" | plano=pro, expira 02/jun/2026, **trial_usado_em=03/mai/2026 set, sub_id=NULL** | Trial usado registrado (anti-burlagem). Sub TEST cancelada na Stripe. |
| Loja "Bianca Cartas" | basico, sem trial, sem sub | Disponível pra teste |
| Loja "Teste Premium Anual" | pro, pendente, sem trial, sem sub | Status pendente bloqueia checkout |
| Loja "PokéShop Online" | pro (admin manual), expira 28/mai/2026, sem sub | Cortesia |

---

## Esteira pós-lançamento (atualizada — REGRA BYNX 11)

1. ✅ **Migrar env vars Stripe pra Sensitive** (esteira #4 da S26) — **CONCLUÍDO na S27**
2. **Sincronização Stripe ↔ Admin:** quando admin altera plano via `/api/admin/lojas/[id]/plano`, sincronizar com Stripe (cancelar/atualizar/criar sub correspondente) pra evitar desalinhamento DB↔Stripe.
3. **Alerting de webhook crítico:** logs com prefixo `[webhook] CRITICAL` deveriam disparar email/Sentry pra Du.
4. **Páginas 404/500 customizadas** com link `/suporte`.
5. **Backup manual DB pré-lançamento.** Fazer assim que Stripe liberar capability e antes do smoke test final.
6. **Custom domain `checkout.bynx.gg` finalizar propagação DNS** (3h após adição em 03/mai 09:21 BRT — esperado funcional ~12:30 BRT).

---

## Próxima sessão (Sessão 28): Smoke test LIVE + Lançamento

### Pré-requisitos
- ⏰ Stripe `charges_enabled` = true (aguardando especialista ou propagação automática 24-72h)
- 💳 Cartão real do Du à mão

### Plano (~15-20min)
1. Verificar status capability via `curl https://api.stripe.com/v1/account` (deve retornar `charges_enabled: true`)
2. **Backup manual DB** (esteira #5)
3. Smoke test em LIVE: comprar Scan Básico R$ 5,90 com cartão real
4. Validar via Supabase MCP:
   - Evento em `stripe_events_processed` com `livemode: true`
   - User ganhou 5 créditos
   - Lançamento R$ 5,90 registrado
   - Webhook POST /api/stripe/webhook 200 nos logs Vercel
5. Reembolsar R$ 5,90 via Stripe Dashboard
6. **Lançamento.** 🚀

---

## Aprendizados / armadilhas pra futuras sessões

- **Stripe preserva product IDs ao copiar de sandbox**, mas **gera price IDs novos**. Ao migrar TEST→LIVE, sempre coletar os 10 price IDs novamente (não reusar os do TEST).
- **Padrão de sufixo identifica TEST vs LIVE:** sufixo `AanyB0hdos` é TEST (sandbox interna Stripe), sufixo igual ao do account ID (ex: `PNrv6a7zCF`) é LIVE. Útil pra debugar se as envs estão certas.
- **Vercel auto-redeploys disparados durante updates de envs múltiplas podem pegar snapshots inconsistentes.** Sempre fazer force redeploy SEM CACHE no final de uma migração de envs em massa.
- **`charges_enabled: false` no Stripe Brasil pode persistir após KYC concluído na UI.** É o estado `under_review` — capability ainda em revisão interna mesmo sem tarefas pendentes na UI. Pode demorar de algumas horas a 3-5 dias úteis. Suporte via chat costuma acelerar.
- **`details_submitted: true` + `currently_due: []` ≠ `charges_enabled: true`.** São sinais separados. UI mostra o primeiro, capability é o segundo.
- **`STRIPE_WEBHOOK_SECRET` muda quando webhook é recriado.** Cada modo (TEST/LIVE) tem seu próprio webhook e seu próprio secret. Migração precisa atualizar essa env junto com as outras.
- **Custom domain Stripe afeta APENAS aparência das páginas hospedadas pela Stripe (`checkout.stripe.com` → `checkout.bynx.gg`), NÃO o backend.** Não bloqueia nada se estiver pendente.
- **Stripe HTTP 405 em `/api/stripe/webhook` ao abrir no navegador é comportamento ESPERADO** — endpoint só aceita POST, browser faz GET → 405 = endpoint vivo. Se desse 404, aí sim seria bug.
- **Bug do customer fantasma:** users com `stripe_customer_id` setado em TEST mode falham em LIVE com `No such customer`. Limpar refs Stripe do DB antes de testar LIVE com user que comprou em TEST.

---

## Referências de comandos úteis

### Verificar capability Stripe via curl
```bash
curl https://api.stripe.com/v1/account \
  -u sk_live_SUACHAVE: | python3 -m json.tool | grep -E "charges_enabled|payouts_enabled|card_payments"
```

### Verificar deploy mais recente Vercel
Inspector URL: `https://vercel.com/brazildigital1403s-projects/bynx/{deployment_id}`

### Endpoint webhook produção
`https://www.bynx.gg/api/stripe/webhook` (POST only — GET retorna 405)

---

## Resumo executivo

**Tudo que dependia do Bynx está 100% pronto.**

| Camada | Estado |
|---|---|
| Backend | ✅ Stripe v2 idempotente, 4 fluxos B2C + 4 Lojista, 6 webhook handlers |
| Frontend | ✅ Páginas /minha-conta, /minha-loja/[id]/plano, /pro-ativado funcionais |
| Emails | ✅ B2C (laranja/vermelho) e B2B (azul/roxo) configurados |
| Stripe LIVE | ✅ 10 produtos, 10 prices, Customer Portal, Webhook, KYC concluído |
| Vercel | ✅ 12 envs Sensitive, deploy READY, 0 erros runtime |
| DB Supabase | ✅ Limpo de refs TEST mode, idempotência ativa, anti-burlagem trial OK |
| Capability Stripe | 🟡 `under_review` — aguardando propagação interna |

**Sessão 27 fechada com a infra Bynx em estado de produção LIVE. Aguardando Stripe.** 🚀
