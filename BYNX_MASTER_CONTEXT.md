# BYNX — Master Context

> Atualizado em **04/maio/2026** · Sessão **S29** · Status: aguardando push da landing /scan-ia
> Próxima sessão começa lendo este arquivo.

---

## 1. Identidade & propósito

**Bynx** é uma plataforma SaaS brasileira pra organização e valoração de coleções de **Pokémon TCG**. Domínio: **bynx.gg**. Instagram: **@bynx.gg** (com ponto). Público: colecionadores e lojas brasileiras.

**Du** (founder/dev solo) trabalha com **Mia** (Claude Opus 4.7) como par de programação. Sessões longas, foco em produto + execução.

Diferenciais que sustentam o pricing:
- Pokédex única em PT-BR de **22.861 cartas**, **1.025 Pokémons**, **236 sets**
- Preços em **reais** por variante (Normal/Holo/Reverse/Foil/Promo)
- **Scan IA** com Claude Opus 4.5: multi-card por foto, multilíngue (PT/EN/JP)
- Marketplace + lojas + dashboard financeiro tudo integrado
- Mobile-first

---

## 2. Stack & infra

| | |
|---|---|
| **App** | Next.js 16.2.4, React 19.2.4, TypeScript, Tailwind 4 |
| **DB** | Supabase project `hvkcwfcvizrvhkerupfc` |
| **Auth** | Supabase Auth + RLS + middleware |
| **Pagamentos** | Stripe **LIVE** (aguardando `charges_enabled: true`) |
| **Deploy** | Vercel `prj_X1CUMTLMwTL77trWqZdDdmBI9PRC` team `team_FK9fHseL9hy5mbNR6c0Q8JuK` |
| **Repo** | público `brazildigital1403/tcg-invest` |
| **Mac local** | repo em `/Users/eduardowillian/tcg-app/` · ZIPs em `/Users/eduardowillian/Downloads/_____tcg-app/` (5 underscores) |
| **IA scan** | Claude Opus 4.5 (Anthropic) via `/api/scan-cards` |
| **Scraping preço** | ZenRows Startup plan — multi-script (`scan-sets`, `scan-cid`, `scan-liga-sets`) |

---

## 3. Estado atual do produto

### Páginas públicas (indexáveis)
`/`, `/login`, `/cadastro`, `/lojas`, `/lojas/[slug]`, `/perfil/[id]`, `/carta/[id]`, `/pokedex`, `/marketplace`, `/separadores`, `/para-lojistas`, `/separadores-pokemon`, `/colecionadores`, `/pokedex-pokemon-tcg`, `/scan-ia` (aguardando push), `/termos`, `/privacidade`, `/suporte`

### Páginas autenticadas
`/dashboard-financeiro`, `/minha-colecao`, `/minha-conta`, `/minha-loja/*`, `/marketplace`, `/separadores`, `/pro-ativado`

### Admin (HMAC cookie auth)
`/admin/*` — métricas, tickets, users (grant Pro, extend trial, suspend, delete), financeiro

---

## 4. Roadmap landings B2C/SEO — **4/4 COMPLETO** ✅

| # | Rota | Sessão | Commit | Status |
|---|---|---|---|---|
| 1/4 | `/separadores-pokemon` | S26 | live | ✅ |
| 2/4 | `/colecionadores` | S28 | `280e0cd` | ✅ |
| 3/4 | `/pokedex-pokemon-tcg` | S28 | `cd7e354` | ✅ |
| 4/4 | `/scan-ia` | S29 | aguardando push | 🟡 pronta no `_____tcg-app/` |

**Padrão das landings:**
- Server component (SSG)
- Metadata local: title (60-80 chars), description (150-200), 15-20 keywords
- 4 schemas JSON-LD: WebPage + BreadcrumbList + FAQPage + (ItemList ou SoftwareApplication)
- Componente `<SectionHeader>` reutilizável centralizando eyebrow/title/subtitle
- Cores 100% B2C laranja-vermelho (`#f59e0b` + `#ef4444`)
- Mobile responsive @1024px e @768px
- Funil: ver → cadastro/compra (CTAs apontam pra `?auth=signup&next=/destino`)

---

## 5. Schema Supabase (resumo)

**Tabela central — `pokemon_cards` (22.861 rows)**: id, name, number, rarity, artist, image_small/large, set_id, set_name, set_series, set_release_date, set_total, set_logo, set_symbol, hp, types, supertype, subtypes, attacks, weaknesses, resistances, retreat_cost, **price_usd_normal/holofoil/reverse**, **preco_normal/foil/promo/reverse/pokeball + min/medio/max**, liga_cid, liga_link, base_pokemon_names

**Outras tabelas**: pokemon_species (1.025), pokemon_sets (236), users (com `scan_creditos`, `suspended_at`, `suspended_reason`), lojas, marketplace, user_cards, tickets, ticket_messages, lancamentos, despesas_recorrentes, stripe_events_processed, portfolio_history

---

## 6. Pacotes Stripe (Scan IA)

| Plano | Scans | Preço | Por scan |
|---|---|---|---|
| `scan_basico` | 5 | R$ 5,90 | R$ 1,18 |
| `scan_popular` ⭐ | 15 | R$ 14,90 | R$ 0,99 (16% off) |
| `scan_colecionador` | 40 | R$ 34,90 | R$ 0,87 (26% off) |

Créditos não expiram. Cada foto consome 1 crédito (independente de quantas cartas a IA identificar).

---

## 7. O que rolou na S29 (04/maio/2026)

### Validação do deploy S28 ✅
- Deploy `dpl_7TKaXKViWVKrUfa2bWsGwPJhF4TE` em READY (commit `16b67c48`)
- HTML de `/separadores-pokemon`: "Explorar Separadores" ok, "Como funciona" e "Conhecer o Bynx" removidos ✓
- HTML SSR de `/pokedex`: AppLayout com novos estilos de transição shipados ✓

### Criação da landing `/scan-ia` (4/4)
**Investigação prévia:**
- ScanModal usa `/api/scan-cards` com Claude Opus 4.5 (Anthropic)
- Multi-card detection nativo (até 8+ cartas/foto)
- PT/EN/JP suportado pelo prompt
- Cross-reference com 22.861 cartas + pokemontcg.io API pra imagens
- Coluna `users.scan_creditos` (integer default 0)

**v1 (rejeitada):** Tentei mistura B2C laranja + accents tech (roxo `#8b5cf6` + cyan `#06b6d4`) na seção de IA. Du pediu refactor.

**v2 (entregue):**
- **Cores 100% B2C** — zero refs de roxo/cyan, só `ORANGE = #f59e0b` + `RED = #ef4444` + `BRAND_GRADIENT`
- **Section headers centralizados** via componente `<SectionHeader>` reutilizável (igual `/pokedex-pokemon-tcg` linha 871) — flex-column, alignItems center, textAlign center, gap 12, marginBottom 56
- 10 seções, 1.533 linhas
- 4 schemas JSON-LD incluindo **SoftwareApplication com 3 Offers** (pacotes viram rich result no Google)
- Mockup hero com 3 cartas reais reconhecidas (Charizard ex SIR sv8/199 R$ 850 / Umbreon ex Prismatic sv8pt5/161 R$ 4.570 / Mew ex Paldean sv4pt5/232 R$ 2.144) com confidence 97-99%

### REGRA 22 cumprida no mesmo commit
- `PublicHeader.tsx`: link "Scan IA" entre Pokédex e Separadores (desktop + mobile)
- `sitemap.ts`: `/scan-ia` priority 0.85
- `robots.ts`: allow explícito de `/scan-ia`

### Status
🟡 **Aguardando Du rodar bloco git** (arquivos prontos em `_____tcg-app/`)

---

## 8. Pendências priorizadas

### IMEDIATO (Du roda no Mac)
```bash
cd /Users/eduardowillian/tcg-app && \
mkdir -p src/app/scan-ia && \
cp /Users/eduardowillian/Downloads/_____tcg-app/scan-ia-page.tsx src/app/scan-ia/page.tsx && \
cp /Users/eduardowillian/Downloads/_____tcg-app/PublicHeader.tsx src/components/ui/PublicHeader.tsx && \
cp /Users/eduardowillian/Downloads/_____tcg-app/sitemap.ts src/app/sitemap.ts && \
cp /Users/eduardowillian/Downloads/_____tcg-app/robots.ts src/app/robots.ts && \
git add src/app/scan-ia/page.tsx src/components/ui/PublicHeader.tsx src/app/sitemap.ts src/app/robots.ts && \
git commit -m "feat(landing): add /scan-ia landing 4/4 do roadmap SEO/Ads" && \
git push origin main
```

Após push (próxima sessão Mia faz):
1. Conferir build no Vercel READY
2. Validar HTML produção via `Vercel:web_fetch_vercel_url` da `/scan-ia`
3. Confirmar 4 schemas JSON-LD no HTML
4. Avisar Du: roadmap 4 landings COMPLETO 🎉

### Pré-lançamento
1. ⏰ **Stripe `charges_enabled: true`** (KYC concluído, especialista contatado, under_review) — bloqueia tudo
2. 💳 Smoke test LIVE R$ 5,90 quando Stripe liberar
3. 📋 Backup manual DB pré-lançamento
4. 🚀 Lançamento Bynx

### Esteira pós-lançamento (REGRA 11)
1. ✅ Migrar env vars Stripe pra Sensitive (S27)
2. Sincronização Stripe ↔ Admin (admin alterando plano via API deve cancelar/atualizar sub Stripe)
3. Alerting webhook crítico (`[webhook] CRITICAL` → email/Sentry)
4. ✅ Páginas 404/500 customizadas
5. Backup manual DB pré-lançamento

### 11 achados housekeeping pendentes (auditoria S27, REGRA 21)
1. `claude-opus-4-5` → `claude-opus-4-7` em scan-cards
2. LIMITE_FREE_MKTPLACE 3 vs 6 (inconsistência)
3. csv-parser dep zumbi
4. sendTrialExpiring1Email função órfã
5. Stripe API version inconsistente entre files
6. Cálculo patrimônio duplicado em 2 lugares
7. Tipo de notificação `'marketplace'` fantasma
8. Admin sem métricas marketplace/lojas/MRR
9. `/minha-loja/[id]` E `/minha-loja/[lojaId]` coexistem
10. Nomenclatura emails trial confusa
11. Title duplicado `"...| Bynx | Bynx"` em algumas páginas

---

## 9. Regras Bynx (ativas)

| # | Regra |
|---|---|
| 1 | Mia em todos os chats; código 100% completo nunca diffs; bloco git único; gerar master ao fim de sessão |
| 2 | Pasta ZIPs Mac: `/Users/eduardowillian/Downloads/_____tcg-app/` (5 underscores) |
| 3 | CardItem é canonical em `src/components/ui/CardItem.tsx` (modes: collection/select/readonly) |
| 4 | Instagram oficial: `@bynx.gg` (com ponto) |
| 11 | Esteira pós-lançamento (sync Stripe↔Admin, alerting, etc) |
| 20 | Sempre buscar versão mais recente em produção ANTES de modificar (raw GitHub ou Du anexa) |
| 21 | Auditoria de código antes de roadmap (S27) |
| 22 | Toda landing nova SEMPRE inclui edição do PublicHeader + sitemap + robots no MESMO bloco git |
| 23 | Evitar `!` em commit messages dentro de aspas duplas no zsh (S28) |
| 24 | Em Next.js 16+, hooks de URL (`useSearchParams`) usados em layouts root ou Providers globais precisam estar dentro de `<Suspense>` boundary |

---

## 10. Learnings consolidados

- **RLS é falha silenciosa**: sempre verificar políticas de leitura em tabelas Supabase acessadas por anon key. Nada vai aparecer no servidor.
- **Unique constraints precisam casar com cardinalidade real**: `UNIQUE (user_id, pokemon_api_id)` é mais seguro que `UNIQUE (user_id, card_id)` (sets diferentes podem compartilhar números).
- **Liga URL format é frágil**: encoda set code DENTRO do `card=` (ex: `?view=cards/search&card=ed%3D{CODE}`), não como `ed=` separado.
- **`x-vercel-cache: HIT` ≠ deploy issue**: cached SSR. Não é sinal de que o deploy não landou.
- **Runtime logs só capturam server-side**: client-side JS failures (RLS blocks, query errors) não aparecem em `get_runtime_logs`.
- **Supabase upserts**: usar `Prefer: resolution=merge-duplicates` + `on_conflict` header pra scan scripts.
- **Cores B2C consistentes**: laranja `#f59e0b` + vermelho `#ef4444` em TODAS as landings públicas (S29 reforçou).
- **SectionHeader centralizado**: padrão das landings é flex-column, alignItems center, eyebrow uppercase laranja, title `clamp(28px, 3.6vw, 40px)`, subtitle maxWidth 720.

---

## 11. Mapa do código (referências rápidas)

| Caminho | Função |
|---|---|
| `src/app/scan-ia/page.tsx` | Landing /scan-ia (S29, aguardando push) |
| `src/app/pokedex-pokemon-tcg/page.tsx` | Landing 3/4 — referência de SectionHeader (linha 871) |
| `src/app/colecionadores/page.tsx` | Landing 2/4 |
| `src/app/separadores-pokemon/page.tsx` | Landing 1/4 |
| `src/components/ui/PublicHeader.tsx` | Nav público, 6 links + CTA |
| `src/components/ui/CardItem.tsx` | Componente canonical de carta (REGRA 3) |
| `src/components/ui/ScanModal.tsx` | Modal do Scan IA dentro do app |
| `src/app/api/scan-cards/route.ts` | Endpoint Claude Opus 4.5 + parse JSON robusto |
| `src/app/sitemap.ts` | Sitemap dinâmico (estáticas + lojas via Supabase) |
| `src/app/robots.ts` | robots.txt dinâmico |

---

## 12. Próxima sessão — onde retomar

**Cenário A (Du já rodou o push da S29):**
1. Validar build `/scan-ia` no Vercel via `list_deployments`
2. `Vercel:web_fetch_vercel_url` em `https://bynx.gg/scan-ia` pra confirmar 4 schemas + render
3. Avisar Du: roadmap 4 landings COMPLETO 🎉
4. Próximo foco: aguardar Stripe `charges_enabled` ou atacar housekeeping (REGRA 21)

**Cenário B (Du ainda não rodou):**
1. Confirmar arquivos ainda em `_____tcg-app/`
2. Reentregar bloco git único se preciso
3. Aguardar push pra validar

**Cenário C (algo deu errado no build):**
1. `Vercel:get_deployment_build_logs` pra investigar
2. Causa provável: import quebrado ou typo. Sintaxe foi sanity-checked (10/10 sections, 128/128 divs).

---

*Sessão S29 fechada em 04/maio/2026. Boa noite, Du! 🎴✨*
