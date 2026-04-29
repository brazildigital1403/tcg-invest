# 🟡 BYNX — MASTER CONTEXT (cole isso em qualquer chat novo)

> Última atualização: 29 de abril de 2026 — Sessão 24
> Assistente: Mia (Claude Sonnet)
> Sempre trate o usuário como **Du** e o assistente como **Mia**

---

## 🏗️ STACK & INFRA

| Item | Valor |
|---|---|
| **Framework** | Next.js 16.2.4 + React 19 (App Router, Turbopack) |
| **Banco** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (usuários) + HMAC cookie (admin) |
| **Pagamentos** | Stripe (checkout, webhook, subscription) — API >= 2025-03-31 |
| **Email** | Resend (`noreply@bynx.gg`) |
| **IA** | Anthropic Claude Vision (scan de cartas) |
| **Scraping de preços** | ZenRows (Startup plan, renovação 26/05/2026) |
| **Analytics** | Google Tag Manager `GTM-N94DLM4H` + GA4 `G-1DRTZH1KVH` |
| **Deploy** | Vercel (Node 24.x) |
| **Domínio** | bynx.gg (canonical), www.bynx.gg |
| **Repo** | `brazildigital1403/tcg-invest`, branch `main` |
| **Vercel projectId** | `prj_X1CUMTLMwTL77trWqZdDdmBI9PRC` |
| **Vercel teamId** | `team_FK9fHseL9hy5mbNR6c0Q8JuK` |
| **Supabase project_id** | `hvkcwfcvizrvhkerupfc` |

**Dependências principais:**
`@supabase/supabase-js`, `stripe`, `resend`, `recharts`, `chart.js`, `puppeteer`, `next`, `react`

**Pastas locais (Mac do Du):**
- Origem ZIPs/uploads: `/Users/eduardowillian/Downloads/_____tcg-app/` (5 underscores)
- Repo local: `/Users/eduardowillian/tcg-app/`

---

## 🗂️ ESTRUTURA DE ARQUIVOS

```
src/
├── app/
│   ├── page.tsx                          ← Landing page (relançamento sessão 23: "Quanto vale sua coleção Pokémon hoje?")
│   ├── layout.tsx                        ← GTM, JSON-LD (Organization/WebSite/WebApplication), metadata global
│   ├── para-lojistas/page.tsx            ← Landing B2B (paleta azul/roxo, beta scarcity)
│   ├── lojas/page.tsx                    ← Guia de Lojas público
│   ├── lojas/[slug]/page.tsx             ← Página pública da loja
│   ├── minha-loja/page.tsx               ← Painel do lojista
│   ├── cadastro/page.tsx
│   ├── login/page.tsx
│   ├── dashboard-financeiro/page.tsx     ← Dashboard (patrimônio, gráficos, analytics premium com gating)
│   ├── minha-colecao/page.tsx            ← Coleção + CSV export
│   ├── marketplace/page.tsx              ← Marketplace + Negociações
│   ├── minha-conta/page.tsx              ← Perfil, plano, zona de perigo
│   ├── pokedex/page.tsx                  ← Pokédex pública (Supabase, cache via revalidateTag)
│   ├── separadores/page.tsx
│   ├── perfil/[id]/page.tsx              ← Perfil público
│   ├── carta/[id]/page.tsx
│   ├── termos/page.tsx                   ← LGPD
│   ├── privacidade/page.tsx              ← LGPD
│   ├── pro-ativado/page.tsx              ← Confirmação pós-checkout
│   ├── reset-password/page.tsx
│   ├── suporte/page.tsx                  ← Lista de tickets do user
│   ├── suporte/[id]/page.tsx             ← Conversa do ticket
│   ├── admin/                            ← /admin/login, /dashboard, /tickets, /users, /financeiro
│   ├── sitemap.ts                        ← Sitemap dinâmico
│   ├── robots.ts                         ← robots.txt
│   └── api/
│       ├── contact/route.ts              ← Modal contato comercial
│       ├── scan-cards/route.ts           ← Claude Vision API
│       ├── salvar-carta/route.ts
│       ├── preco/route.ts
│       ├── historico/route.ts
│       ├── ranking/route.ts
│       ├── export/csv/route.ts           ← CSV com BOM (Excel pt-BR)
│       ├── stripe/checkout/route.ts
│       ├── stripe/webhook/route.ts       ← Cria lançamentos, suporta invoice.payments[]
│       ├── stripe/success/route.ts
│       ├── email/welcome/route.ts
│       ├── cron-trial-emails/route.ts
│       ├── cron-precos/route.ts
│       ├── sync-sets/route.ts
│       └── sync-card-sets/route.ts
├── components/
│   ├── ui/
│   │   ├── PublicHeader.tsx              ← Header da landing/lojas/para-lojistas
│   │   ├── PublicFooter.tsx
│   │   ├── AppLayout.tsx                 ← Layout interno (sidebar, bottom nav, header)
│   │   ├── Icons.tsx                     ← 28+ ícones SVG custom (1.4px stroke)
│   │   ├── CardItem.tsx                  ← ⭐ Componente PADRÃO de exibição de carta (collection/select/readonly)
│   │   ├── OnboardingModal.tsx
│   │   ├── ScanModal.tsx                 ← Scan IA + tracking first_card_added
│   │   ├── UpgradeBanner.tsx
│   │   └── useAppModal.tsx               ← showAlert/showConfirm/showPrompt
│   ├── dashboard/
│   │   └── AddCardModal.tsx              ← + tracking first_card_added
│   ├── lojas/
│   │   ├── TrackedLink.tsx               ← Wrapper com tracking de loja_clique
│   │   └── LojistasFAQ.tsx               ← FAQ do /para-lojistas (11 perguntas)
│   └── marketplace/
│       ├── AnunciarModal.tsx
│       ├── NegociacoesTab.tsx            ← + tracking eventos
│       └── AvaliacaoModal.tsx
└── lib/
    ├── supabaseClient.ts
    ├── analytics.ts                      ← ⭐ Helper GTM/GA4 (SSR-safe, fail-safe)
    ├── email.ts                          ← welcome, trial, purchase, 4 funções de ticket
    ├── isPro.ts
    ├── checkCardLimit.ts
    ├── checkNegLimit.ts
    ├── calcPatrimonio.ts
    └── requireAdmin.ts                   ← Helper de proteção admin (17 rotas)
```

---

## 🗃️ BANCO DE DADOS (Supabase)

### Tabela: `users`
```sql
id uuid (FK auth.users)
name text NOT NULL                  -- ⚠️ é "name", NÃO "full_name"
email text NOT NULL
cpf, city, whatsapp text
created_at timestamp
is_pro boolean
plano text                          -- free/pro_mensal/pro_anual
stripe_customer_id, stripe_subscription_id text
pro_expira_em timestamptz
trial_expires_at timestamptz
username, username_changed_at
separadores_desbloqueado boolean
scan_creditos integer
suspended_at timestamptz            -- Admin suspende
suspended_reason text
data_nascimento date                -- LGPD
termos_aceitos_em timestamptz       -- LGPD
marketing_aceito boolean            -- LGPD
```

### Tabela: `pokemon_cards` (⭐ FONTE DE VERDADE de cards a partir de 01/05/2026)
```sql
id text PK                          -- ex: "sv3pt5-183"
name, number, rarity, artist text
image_small, image_large text
set_id, set_name, set_series, set_release_date, set_logo, set_symbol text
set_total integer
hp integer
types, subtypes, retreat_cost ARRAY
supertype text
attacks, weaknesses, resistances, legalities jsonb
flavor_text text
-- preços TCG API (USD/EUR)
price_usd_normal, price_usd_holofoil, price_usd_reverse, price_usd_1st_edition numeric
price_eur_normal, price_eur_holofoil, price_eur_reverse numeric
-- Liga (BRL)
liga_cid integer, liga_link text
preco_normal, preco_foil, preco_promo, preco_reverse, preco_pokeball numeric
preco_*_min, preco_*_medio, preco_*_max numeric (5 variantes × 3 = 15 colunas)
tcg_updated_at, liga_updated_at, created_at timestamptz
base_pokemon_names ARRAY            -- nomes para autocomplete
```
**22.861 cartas catalogadas · 172 sets · preços BRL via ZenRows**

### Tabela: `pokemon_sets` (172 sets, sincronizados do TCG API)
### Tabela: `pokemon_species`, `card_attacks_pt`, `card_price_history`

### Tabela: `card_prices` (LEGADO — migrar para `pokemon_cards` a partir de 01/05/2026)

### Tabela: `user_cards`
```sql
id uuid
user_id uuid (FK users)
card_id text (FK pokemon_cards.id)
pokemon_api_id text
card_name, set_name, rarity text
variante text                       -- normal/foil/promo/reverse/pokeball
quantity int
card_link, image_url text
created_at timestamptz
UNIQUE (user_id, pokemon_api_id)    -- ⚠️ NÃO (user_id, card_id) — sets diferentes podem ter o mesmo número
```

### Tabela: `lojas` (Guia de Lojas)
```sql
id uuid PK
slug text UNIQUE
nome, descricao text
whatsapp, email, website, instagram, facebook text
cidade, estado, endereco text
tipo text (fisica/online/ambas)
especialidades ARRAY
plano text (basico/pro/premium)
plano_expira_em timestamptz
stripe_subscription_id, stripe_customer_id text
status text (pendente/ativa/suspensa/inativa)
verificada boolean
logo_url, fotos ARRAY
meta_title, meta_description text
eventos jsonb
visualizacoes, cliques_whatsapp integer
owner_user_id uuid (FK users) -- ⚠️ SEM UNIQUE: multi-loja é suportado por design
suspensao_motivo, suspensao_data, suspenso_por
aprovada_data, aprovada_por
created_at, updated_at
```
**Multi-loja**: 1 user pode ter N lojas, cada uma com plano + Stripe sub próprios.

### Tabela: `loja_cliques` (analytics Premium)
### Tabela: `tickets` + `ticket_messages` (suporte)
### Tabela: `marketplace`, `negociacoes`, `avaliacoes`
### Tabela: `lancamentos`, `transactions`, `despesas_recorrentes` (financeiro/admin)
### Tabela: `notifications`, `portfolio_history`, `collection`

---

## 💰 PLANOS

### Plano de Usuário (consumidor)
| Plano | Preço | Cartas | Anúncios |
|---|---|---|---|
| **Free** | Grátis | 6 | 3 |
| **Trial Pro** | Grátis 7 dias | Ilimitado | Ilimitado |
| **Pro Mensal** | R$ 29,90/mês | Ilimitado | Ilimitado |
| **Pro Anual** | R$ 249/ano (~R$ 20,75/mês, 30% OFF) | Ilimitado | Ilimitado |

Trial inicia automaticamente no cadastro. Cron job verifica expiração diariamente.

### Plano de Lojista (B2B — `/para-lojistas`)
| Plano | Preço | Fotos | Eventos | Posicionamento |
|---|---|---|---|---|
| **Básico** | Grátis para sempre | 0 | — | Listagem padrão |
| **Pro** | R$ 39/mês ou R$ 390/ano | 5 | — | Acima das Básico, badge Pro |
| **Premium** | R$ 89/mês ou R$ 890/ano | 10 | Ilimitado | Card 1.5x maior, rotação no topo, analytics |

**Beta fechado:** primeiros 30 lojistas ganham Pro grátis por 6 meses (27 vagas restantes em 29/04/2026).
**Cobrança per-loja:** cada loja tem `plano` e `stripe_subscription_id` próprios.

---

## 🎨 DESIGN SYSTEM

**Cores base:**
- Background: `#080a0f`
- Surface: `#0d0f14`
- Texto primário: `#f0f0f0`
- Texto secundário: `rgba(255,255,255,0.45)`
- Verde sucesso: `#22c55e`

**Paleta primária (Bynx — landing principal, app interno):**
- Brand gradient: `linear-gradient(135deg, #f59e0b, #ef4444)` (âmbar → vermelho)

**Paleta secundária B2B (`/para-lojistas`):**
- `#60a5fa` (blue-400) — primária B2B
- `#a855f7` (purple-500) — secundária B2B
- Gradient: `linear-gradient(135deg, #60a5fa, #a855f7)`
- Inspiração: bloco "Para Lojistas" da landing principal — passa profissionalismo, distinto da paleta de consumer

**Tipografia:** DM Sans (Google Fonts)
**Bordas:** `1px solid rgba(255,255,255,0.1)`
**Border radius:** 10–16px

**Labels (padrão UX):**
```tsx
const lbl: CSSProperties = {
  fontSize: 11, fontWeight: 700,
  color: 'rgba(255,255,255,0.45)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 5, display: 'block'
}
```

**Input padrão:**
```tsx
{
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10, padding: '12px 14px',
  color: '#f0f0f0', fontSize: 14, outline: 'none'
}
```

---

## 🧩 COMPONENTES GLOBAIS

### CardItem (⭐ componente PADRÃO de carta)
Path: `src/components/ui/CardItem.tsx`
Modos: `collection`, `select`, `readonly`
Features: imagem full-width, badge preço flutuante, seletor variante integrado com tabela mín/méd/máx, número formato Liga (`091/124 · Set Name`), dot de raridade, quantidade.
**Sempre usar quando exibir cards de cartas no sistema.**

### useAppModal (substitui alert/confirm/prompt nativos)
```tsx
const { showAlert, showConfirm, showPrompt } = useAppModal()
await showAlert('Mensagem', 'success' | 'error' | 'warning' | 'info')
const ok = await showConfirm({ message: '...', danger: true })
const val = await showPrompt({ message: '...', placeholder: '...' })
```

### AppLayout
Envolve páginas internas. Recebe `userId`, `isPro`, `isTrial`. Sidebar desktop + bottom nav mobile + header.

### PublicHeader / PublicFooter
Header e footer da landing, `/lojas`, `/para-lojistas`. PublicHeader emite eventos `bynx:open-signup` / `bynx:open-login` capturados pela landing.

### Icons.tsx
28+ ícones: `IconDashboard`, `IconCollection`, `IconMarketplace`, `IconAccount`, `IconScan`, `IconTrash`, `IconEdit`, etc.

---

## 📊 ANALYTICS (GTM + GA4)

**Container:** `GTM-N94DLM4H` instalado em `layout.tsx` via `<Script>` next/script (`strategy="afterInteractive"`)
**Measurement ID GA4:** `G-1DRTZH1KVH` (configurado no painel GTM)

### Helper `src/lib/analytics.ts` (88 linhas, SSR-safe, fail-safe)
```ts
trackFirstCardAdded(userId)         // localStorage flag: bynx_first_card_${userId}
                                    // dispara também signup_completed como proxy
trackProUpgradeInitiated(plano)     // 'mensal' | 'anual'
trackProUpgradeCompleted(plano)
trackLojaClique(lojaId, tipo)       // 'whatsapp' | 'instagram' | 'facebook' | 'website' | 'maps'
```

### 5 eventos custom em produção
| Evento | Disparado em |
|---|---|
| `signup_completed` | Após cadastro (proxy via first_card_added) |
| `first_card_added` | Primeira carta adicionada (AddCardModal, ScanModal) |
| `pro_upgrade_initiated` | Click em Assinar Pro (page.tsx, minha-conta, marketplace, pokedex) |
| `pro_upgrade_completed` | Pós-checkout Stripe (`/pro-ativado`) |
| `loja_clique` | Click em link de loja (TrackedLink) |

### ⚠️ Fase 2 GTM/GA4 — PENDENTE (~30-45min de painel)
Eventos chegam no `dataLayer` mas GTM ainda não tem tags GA4 Event capturando. Roteiro:
1. Criar 4 variáveis Data Layer no GTM: `dlv - plano`, `dlv - user_id`, `dlv - loja_id`, `dlv - tipo`
2. **LIMPAR** event parameters da tag Google Configuration (estão poluindo todo `page_view`)
3. Criar 5 triggers Custom Event (event name = nome exato)
4. Criar 5 tags GA4 Event com mapeamento de Event Parameters
5. Submit/Publish no GTM
6. Custom Definitions no GA4 Admin (4 dimensões: Plano, Loja ID, Tipo Clique, User ID Custom — escopo Event)
7. Validar Network: `&ep.plano=mensal` na URL collect

---

## ⚙️ PADRÕES TÉCNICOS IMPORTANTES

1. **Supabase v2 — NUNCA use `.single().catch()`**
   ```ts
   // ✅ Correto
   const { data } = await supabase.from('users').select('*').eq('id', uid).limit(1)
   const user = data?.[0]
   ```

2. **TCG API — sem zeros à esquerda**
   ```ts
   // ✅ '20' não '020'
   ```

3. **Imagens de cartas:**
   - Source TCG API: `https://images.pokemontcg.io/{set.id}/{number}_hires.png` (CORS, usar proxy `/api/card-image` no client)
   - Source Liga BR: armazenadas em Supabase Storage (`hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/card-images/...`)

4. **Next.js body size:** Limite 4MB. Comprimir imagens no client antes de enviar base64.

5. **Camera permissions no `next.config.ts`:**
   ```ts
   'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()'
   ```

6. **Joins no Supabase:** `user_cards` ↔ `pokemon_cards` matchear por `pokemon_api_id` (não `card_id`).

7. **CSV export:** Usa BOM (`\uFEFF`) para Excel abrir corretamente em pt-BR.

8. **Onboarding:** Chave localStorage por userId: `ob-complete-{userId}`, `ob-step-{userId}-{stepId}`

9. **Admin auth:** Cookie HMAC (não Supabase Auth). Helper `requireAdmin()` protege 17 rotas API.

10. **Middleware:** Bloqueia `/admin/*` e usuários `suspended_at NOT NULL`. Fail-closed.

11. **RLS é falha silenciosa:** sempre verificar policies de leitura em tabelas acessadas pelo anon key. Falha não aparece em runtime logs (só client-side).

12. **Liga URL format:** O código do set vai DENTRO do parâmetro `card=` (ex: `?view=cards/search&card=ed%3D{CODE}`), NÃO como `ed=` separado. Formato errado retorna 0 resultados silenciosamente.

13. **Stripe API >= 2025-03-31:** invoice agora tem `payments[]` em vez de `charge`/`payment_intent` no topo. Hotfix aplicado no webhook.

14. **`x-vercel-cache: HIT` ≠ deploy não landou.** É cache SSR. Sempre validar com fetch real depois do deploy READY.

15. **JSX siblings sem fragment `<>` quebra Turbopack.**

---

## 📱 RESPONSIVIDADE

- Sidebar: oculta em mobile
- Header mobile: logo + menu hamburguer (PublicHeader gerencia próprio state)
- Bottom navigation: 7 itens (Dashboard, Coleção, Pokédex, Marketplace, Separadores, Conta, Suporte)
- Content padding mobile: `16px 12px 100px` (100px para não cobrir bottom nav)
- Breakpoint: `max-width: 768px`

---

## 📧 EMAILS (Resend)

Funções em `src/lib/email.ts`:
- `sendWelcomeEmail(to, name)` — boas-vindas
- `sendTrialExpiring5Email(to, name)` — 5 dias restantes
- `sendTrialExpiring7Email(to, name)` — trial expirou
- `sendPurchaseConfirmationEmail(to, name, type)` — compra confirmada
- 4 funções de ticket: novo ticket, nova mensagem, resolvido, fechado

Todos com template HTML dark theme compatível com Outlook (VML + bgcolor).

---

## 🔐 ADMIN

- **URL:** `/admin/login` → `/admin/dashboard`
- **Email admin:** `eduardo@brazildigital.ag`
- **Auth:** cookie HMAC (não Supabase Auth)
- **Funcionalidades:**
  - Dashboard com métricas
  - Gestão de tickets (responder, mudar status/prioridade)
  - Gestão de usuários (conceder Pro, estender trial, suspender, excluir)
  - Financeiro: lançamentos Stripe com email+nome do comprador visíveis
- **Proteção:** middleware Next.js + helper `requireAdmin()` em 17 rotas API

---

## 🛒 MARKETPLACE

- Anúncios com foto, preço, variante
- Contato via WhatsApp (mensagem pré-preenchida com nome da carta e preço)
- Limite: 3 anúncios (Free) / ilimitado (Pro)
- Aba Negociações com avaliações (estrelas)

---

## 🏪 GUIA DE LOJAS

### Páginas
- `/lojas` — listagem pública (filtros por estado, cidade, especialidade, tipo)
- `/lojas/[slug]` — página da loja (hero, fotos, descrição, redes, WhatsApp em 1 clique)
- `/para-lojistas` — landing B2B (paleta azul/roxo)
- `/minha-loja` — painel do lojista (CRUD da loja, plano, fotos, eventos)

### Métricas Premium (analytics)
- Tabela `loja_cliques` registra cada interação
- Painel mostra views, cliques no WhatsApp, dias da semana

---

## ⭐ ONBOARDING MODAL

4 passos, aparece no dashboard até completar todos:
1. Importar primeira carta → `/minha-colecao`
2. Ver Dashboard → `/dashboard-financeiro`
3. Explorar Marketplace → `/marketplace`
4. Configurar perfil → `/minha-conta`

Persiste por `userId` no localStorage. Fecha permanentemente ao completar todos.

---

## ⚖️ LGPD

- Coleta: `data_nascimento`, `termos_aceitos_em`, `marketing_aceito`
- Menores de 13: bloqueados no cadastro (Art. 14)
- 13–17 anos: aviso de autorização do responsável
- DPO: `privacidade@bynx.gg`
- Suporte: `suporte@bynx.gg`
- Páginas: `/termos` e `/privacidade`

---

## 🗺️ LANDING PAGE PRINCIPAL (`/`)

**Title:** "Bynx — Quanto vale sua coleção Pokémon TCG hoje?"
**Posicionamento:** organizador de coleção Pokémon TCG BR (não "investimento" — evitar juridicamente; sem dependência da LigaPokemon no copy)

### Seções em ordem
1. Header fixo (logo, nav, botão entrar/cadastrar)
2. Hero — H1 "Quanto vale sua coleção Pokémon hoje?" + 4 mockup cards reais
3. Social proof — 22.000+ cartas, 240+ sets, BRL, 100% BR
4. **"Você já passou por isso?"** — 4 cenários (liga/booster/zap/planilha)
5. Como funciona — 4 passos (Pokédex, Scan IA, Variantes, Decida)
6. Recursos — 8 features (Pokédex, Scan IA, Preços por variante, Painel, Histórico, Marketplace, Guia de Lojas, Privacidade)
7. Planos (Free / Pro Mensal / Pro Anual com 30% OFF)
8. FAQ accordion (7 perguntas, JSON-LD FAQPage inline)
9. Bloco "Para lojistas" → CTA para `/lojas`
10. Depoimento (sem "usuário beta")
11. Demo animada (3 cenas em loop: Dashboard, Coleção, Marketplace)
12. CTA final
13. Footer (Fale conosco · Privacidade · Termos)

### Modal Auth
Login + Cadastro em 2 etapas no mesmo modal:
- Step 0: Escolha de plano (free/mensal/anual)
- Step 1: Nome, Data de nascimento, E-mail, Senha
- Step 2: CPF, Cidade, WhatsApp, Aceite de Termos, Marketing (opcional)

### Modal Contato Comercial
6 categorias → formulário → email para `eduardo@brazildigital.ag`:
parceria, loja, imprensa, sugestão, dúvida, investidor

### SEO
- 3 JSON-LD no `layout.tsx`: Organization, WebSite, WebApplication
- 1 JSON-LD inline na page: FAQPage
- Sitemap dinâmico (`app/sitemap.ts`)
- robots.ts
- OG image 1200×630 (`/og-image.jpg`)

---

## 🏢 LANDING B2B (`/para-lojistas`)

**Title:** "Para Lojistas — Bynx | A plataforma 100% Pokémon TCG do Brasil"
**Paleta:** azul/roxo (`#60a5fa` + `#a855f7`)

### Seções
1. Hero — "Onde colecionadores Pokémon do Brasil encontram lojas como a sua." + scarcity 27 vagas + preview card Premium
2. Métricas — 22.000+, 240+, R$ 0, 5 min
3. **"Pra quem é"** — 4 perfis (loja física, online, casa de torneios, vendedor de single/sealed)
4. Como funciona — 3 passos (cadastrar → aprovar 48h → aparecer)
5. **"Vale a pena?"** — ROI: R$ 39/mês → 1 venda de R$ 200 → paga 5 meses
6. Planos (Básico/Pro/Premium, Pro com badge "Recomendado")
7. **"Como aparece"** — 4 benefícios (página própria, geo-relevância, WhatsApp 1 clique, analytics)
8. FAQ (11 perguntas, primeira: geo-relevância; multi-loja com cobrança separada)
9. CTA final — "27 vagas restantes do beta fechado" + "Garantir minha vaga"

### Linguagem do nicho
"liga", "trade", "sealed", "single", "torneio" — vocabulário Pokémon TCG correto.

---

## 📋 BACKLOG PRIORIZADO

### 🔴 Alta prioridade
- [ ] **01/05/2026 — Migração de preços** (Regra 5): `card_prices` → `pokemon_cards`, busca por nome com autocomplete, Pokédex lendo do Supabase, remover dependência de link da LigaPokemon
- [ ] Moderação do Marketplace no Admin
- [ ] Fase 2 GTM/GA4 (configurar variáveis, triggers, tags no painel — ~30-45min)

### 🟡 Média prioridade
- [ ] SEO fase 2: Google Search Console (verificar via GTM em 30s, submeter sitemap), Bing Webmaster Tools, Lighthouse audit pré-lançamento (alvo 90+)
- [ ] Cleanup sandbox Stripe (~5min) — cancelar subs teste de bianca1, bianca2, teste@teste2
- [ ] Alerta proativo `[webhook] CRITICAL` (Sentry/email)
- [ ] V6 cosmético removendo logs `[webhook/debug]` (em 2-3 semanas)
- [ ] Métricas avançadas no Admin (conversão trial→Pro, tempo de resposta tickets)
- [ ] Vídeo demo real na landing (quando Du gravar)

### 🟢 Baixa prioridade / futuro
- [ ] **Junho 2026 — Passo 8 Stripe per-loja** (6-10h): cobrança independente por loja
- [ ] **26/05/2026** — ZenRows renova ($227.63), rodar `scan-sets-final.ts`
- [ ] Analytics por carta (histórico de preço individual)

---

## 🐛 BUGS CONHECIDOS / WATCHLIST / LIÇÕES

- **RLS é falha silenciosa**: sempre verificar policies de leitura no Supabase
- **UNIQUE constraint deve refletir cardinalidade real**: `(user_id, pokemon_api_id)` é mais seguro que `(user_id, card_id)` porque sets diferentes podem compartilhar números
- **Liga URL format é frágil**: encode set code dentro de `card=`, não `ed=` separado
- **`x-vercel-cache: HIT` ≠ deploy issue**: cache SSR, não erro de deploy
- **Runtime logs só capturam server-side**: bugs client-side (RLS, query) não aparecem
- **Supabase upserts em scan scripts**: `Prefer: resolution=merge-duplicates` + header `on_conflict`
- **Imagens `images.pokemontcg.io`**: CORS, usar proxy `/api/card-image` no client
- **JSX siblings sem fragment `<>` quebra Turbopack**
- **Scan IA**: requer créditos Anthropic (erro 400 pode ser saldo)
- **Stripe API >= 2025-03-31**: invoice tem `payments[]`, não `charge`/`payment_intent` no topo

---

## 🔑 VARIÁVEIS DE AMBIENTE (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_MENSAL
STRIPE_PRICE_ANUAL
RESEND_API_KEY
ANTHROPIC_API_KEY
ZENROWS_API_KEY
ADMIN_SECRET
ADMIN_EMAIL=eduardo@brazildigital.ag
NEXT_PUBLIC_APP_URL=https://bynx.gg
NEXT_PUBLIC_GTM_ID=GTM-N94DLM4H
```

---

## 👤 USUÁRIO DE TESTE

- **Username:** eduardo
- **User ID:** `122267ef-5aeb-4fd0-a9c0-616bfca068bd`
- **Email admin:** eduardo@brazildigital.ag

---

## 💡 CONTEXTO DE NEGÓCIO

- **Mercado:** colecionadores de Pokémon TCG no Brasil
- **Posicionamento:** organizador de coleção (não "investimento" — evitar juridicamente)
- **Diferencial:** única plataforma 100% Pokémon TCG BR com Pokédex 22k+ cartas, scan IA, marketplace integrado e guia de lojas
- **Monetização:** assinatura Pro (consumer) + planos Lojista (B2B) + futura comissão sobre eventos
- **Comunidade:** Instagram `@bynx.gg`, Discord `discord.gg/bynx`, WhatsApp

---

## 📐 REGRAS DE TRABALHO (Mia + Du)

### Princípios gerais

- **Mia sempre verifica deploy no Vercel** ao iniciar uma sessão
- **Mia nunca faz git push diretamente** — entrega arquivos, Du faz o push
- **Sempre testar JSX com siblings** — envolver em `<>` quando necessário
- **Labels acima dos campos** (não só placeholder) — padrão UX do Bynx
- **`useAppModal` em vez de `alert()`/`confirm()` nativos** nas páginas internas
- **Nunca `.single().catch()`** no Supabase
- **Posicionamento jurídico:** nunca mencionar "investimento", "tempo real", "LigaPokemon" diretamente no copy público
- **CSS no Bynx:** inline styles com objetos TypeScript (não Tailwind nas páginas internas)
- **Chats segmentados por feature grande** quando faz sentido

### Regras Bynx (numeradas, persistidas nas memórias)

**Regra 3 — Estrutura de paths.** Arquivos entregues em paths que espelham repo (`src/app/...`, `src/components/...`).

**Regra 4 — Bloco git único.** Sempre consolidar `add + commit + push` em um único bloco de terminal (encadeado com `&&` ou `\` + quebra). Du cola uma vez e executa tudo. Nunca dividir em múltiplos blocos.

**Regra 5 — Código 100% completo.** SEMPRE entregar arquivo inteiro modificado, NUNCA diffs/snippets/"procura esse bloco e substitui". Du substitui o arquivo todo — mais seguro e mais rápido. Vale até para alteração mínima.

**Regra 6 — Migração de preços (a partir de 01/05/2026).** Migrar `card_prices` → `pokemon_cards`, busca por nome com autocomplete, Pokédex lendo do Supabase, remover dependência de link da LigaPokemon.

**Regra 7 — CardItem é padrão.** Usar `src/components/ui/CardItem.tsx` sempre que exibir cards de cartas no sistema. Modos: `collection`, `select`, `readonly`.

**Regra 8 — Paths absolutos do Mac.** Origem de uploads: `/Users/eduardowillian/Downloads/_____tcg-app/` (5 underscores). Destino projeto: `/Users/eduardowillian/tcg-app/`. Sempre usar esses paths absolutos nos blocos git.

**Regra 9 — Fim de sessão.** Quando Du sinaliza encerramento (descansar, parar), Mia gera automaticamente `BYNX_MASTER_CONTEXT.md` atualizado.

**Regra 17 — Auth em camadas.** Admin usa cookie HMAC + middleware + helper `requireAdmin()` em rotas API. Não confiar só em uma camada.

**Regra 18 — Inspecionar schema antes de SQL.** Sempre rodar query de inspeção (`information_schema.columns`) antes de qualquer migration ou query complexa. Estrutura real diverge da memória.

**Regra 19 — Validar versão de API antes de codar.** Stripe, Supabase, qualquer SDK — confirmar versão atual antes de assumir comportamento.

**Regra 20 — Fonte da verdade GitHub.** SEMPRE buscar arquivo da versão mais recente em produção ANTES de qualquer modificação. NUNCA usar zips de sessões antigas como base de patches. Processo correto: (1) `web_fetch` do GitHub raw em `https://raw.githubusercontent.com/brazildigital1403/tcg-invest/main/...` OU (2) pedir Du anexar do Mac. Causa raiz do incidente sessão 24: zip de eventos custom baseado em código velho sobrescreveu o relançamento da landing — uma frente de trabalho perdida e recuperada por minutos. Nunca mais.

> Regras 1, 2, 10–16 não foram persistidas nas memórias permanentes (foram convenções implícitas durante construção do produto). Os números pulados refletem o histórico real.

---

## 🛠️ FERRAMENTAS MCP DISPONÍVEIS PARA MIA

- **Supabase MCP** — schema, queries, migrations, advisors, logs
- **Vercel MCP** — deployments, runtime logs, validação de produção (`web_fetch_vercel_url`), build logs
- **Stripe MCP** — disponível mas usado raramente (validação manual via dashboard preferida)

**Uso preferido:**
- Validar deploy: `Vercel:list_deployments` + `Vercel:web_fetch_vercel_url` (HTML real, não cache)
- Validar schema: `Supabase:execute_sql` em `information_schema.columns` antes de qualquer mexida
- Bugs em produção: `Vercel:get_runtime_logs` (lembrar: só server-side)

---

## 🔭 SESSÕES RECENTES (resumo)

**Sessão 22 (~28/04):** auth admin com `requireAdmin()` em 17 rotas, manutenção webhook V1-V5, Regras 18-19 criadas.

**Sessão 23 (~28/04 madrugada):** **Relançamento da landing principal** — nova copy "Quanto vale sua coleção Pokémon hoje?", removida menção a LigaPokemon, SEO completo (FAQPage JSON-LD, sitemap dinâmico, robots.ts), mockup com URLs reais (Supabase + pokemontcg.io). Analytics premium dashboard com gating + gráfico temporal.

**Sessão 24 (29/04):**
- ✅ Google Tag Manager `GTM-N94DLM4H` instalado em `layout.tsx`
- ✅ GA4 `G-1DRTZH1KVH` conectado (validação real via Network: POST `/g/collect` 204)
- ✅ 5 eventos custom: helper `analytics.ts` (88 linhas) + 9 patches em arquivos do app
- ⚠️ **Incidente landing:** zip de eventos custom (montado por Mia em cima de código velho da sessão 21) sobrescreveu o relançamento da sessão 23 quando Du fez `git push`. Recuperado anexando arquivo do Mac (que ainda tinha a landing nova) + 3 patches cirúrgicos de tracking. Commit `6b300258` restaurou produção.
- ✅ **Regra Bynx 20 criada** (fonte da verdade GitHub) — gravada em memórias permanentes.
- ✅ **Reformulação `/para-lojistas`**: paleta azul/roxo, copy B2B 100% Pokémon, headline "Onde colecionadores Pokémon do Brasil encontram lojas como a sua.", scarcity 27 vagas, ROI "1 venda R$ 200 paga 5 meses Pro", FAQ atualizado (multi-loja suportado, validado via Supabase). Commit `00354ba5`.
- ✅ Tudo validado em produção via `Vercel:web_fetch_vercel_url`.
- 🟡 Pendente: fase 2 GTM/GA4 (configurar variáveis/triggers/tags no painel, ~30-45min).

---

*Documento atualizado em 29/04/2026 — Sessão 24 do Bynx*
