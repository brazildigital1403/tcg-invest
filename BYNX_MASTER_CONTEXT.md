# 🟡 BYNX — MASTER CONTEXT (cole isso em qualquer chat novo)

> Última atualização: 23 de abril de 2026  
> Assistente: Mia (Claude Sonnet)  
> Sempre trate o usuário como **Du** e o assistente como **Mia**

---

## 🏗️ STACK & INFRA

| Item | Valor |
|---|---|
| **Framework** | Next.js 16.2.2 + React 19 (App Router) |
| **Banco** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth |
| **Pagamentos** | Stripe (checkout, webhook, subscription) |
| **Email** | Resend (`noreply@bynx.gg`) |
| **IA** | Anthropic Claude Vision (scan de cartas) |
| **Deploy** | Vercel (Turbopack) |
| **Domínio** | bynx.gg |
| **Repo** | `brazildigital1403/tcg-invest`, branch `main` |
| **Vercel projectId** | `prj_X1CUMTLMwTL77trWqZdDdmBI9PRC` |
| **Vercel teamId** | `team_FK9fHseL9hy5mbNR6c0Q8JuK` |

**Dependências principais:**
`@supabase/supabase-js`, `stripe`, `resend`, `recharts`, `chart.js`, `puppeteer`, `next`, `react`

---

## 🗂️ ESTRUTURA DE ARQUIVOS

```
src/
├── app/
│   ├── page.tsx                          ← Landing page (modal auth, demo animada, FAQ, planos)
│   ├── layout.tsx
│   ├── cadastro/page.tsx                 ← Página de cadastro standalone
│   ├── login/page.tsx
│   ├── dashboard-financeiro/page.tsx     ← Dashboard principal (patrimônio, gráficos, onboarding)
│   ├── minha-colecao/page.tsx            ← Coleção de cartas + CSV export
│   ├── marketplace/page.tsx              ← Marketplace de cartas
│   ├── minha-conta/page.tsx              ← Perfil, plano, zona de perigo
│   ├── pokedex/page.tsx
│   ├── separadores/page.tsx
│   ├── perfil/[id]/page.tsx              ← Perfil público
│   ├── termos/page.tsx                   ← Termos de Uso (LGPD)
│   ├── privacidade/page.tsx              ← Política de Privacidade (LGPD)
│   ├── pro-ativado/page.tsx
│   ├── reset-password/page.tsx
│   ├── carta/[id]/page.tsx
│   └── api/
│       ├── contact/route.ts              ← Modal contato comercial → eduardo@brazildigital.ag
│       ├── scan-cards/route.ts           ← Claude Vision API (scan de cartas)
│       ├── salvar-carta/route.ts
│       ├── preco/route.ts
│       ├── historico/route.ts
│       ├── ranking/route.ts
│       ├── export/csv/route.ts           ← CSV melhorado (Set, Valor Total, Data)
│       ├── stripe/checkout/route.ts
│       ├── stripe/webhook/route.ts
│       ├── stripe/success/route.ts
│       ├── email/welcome/route.ts
│       ├── cron-trial-emails/route.ts
│       ├── cron-precos/route.ts
│       ├── sync-sets/route.ts
│       └── sync-card-sets/route.ts
├── components/
│   ├── ui/
│   │   ├── AppLayout.tsx                 ← Layout interno (sidebar, header, bottom nav mobile)
│   │   ├── Icons.tsx                     ← 28+ ícones SVG custom (1.4px stroke, Pokémon-themed)
│   │   ├── OnboardingModal.tsx           ← Modal boas-vindas (4 passos, persiste por userId)
│   │   ├── ScanModal.tsx                 ← Scan de cartas com IA
│   │   ├── UpgradeBanner.tsx
│   │   └── useAppModal.tsx               ← Sistema de modais (showAlert, showConfirm, showPrompt)
│   ├── dashboard/
│   │   └── AddCardModal.tsx
│   └── marketplace/
│       ├── AnunciarModal.tsx
│       ├── NegociacoesTab.tsx
│       └── AvaliacaoModal.tsx
└── lib/
    ├── supabaseClient.ts
    ├── email.ts                          ← sendWelcomeEmail, sendTrialExpiring, sendPurchaseConfirmation
    ├── isPro.ts
    ├── checkCardLimit.ts
    ├── checkNegLimit.ts
    └── calcPatrimonio.ts
```

**Admin e Suporte** (construídos em sessão paralela, em produção):
```
src/app/
├── admin/                ← /admin/login, /admin/dashboard, /admin/tickets, /admin/users
├── suporte/page.tsx      ← /suporte (usuário abre ticket)
└── suporte/[id]/page.tsx ← /suporte/[id] (conversa do ticket)
```

---

## 🗃️ BANCO DE DADOS (Supabase)

### Tabela: `users`
```sql
id uuid (FK auth.users)
name text
email text
cpf text
city text
whatsapp text
is_pro boolean DEFAULT false
trial_expires_at timestamptz
stripe_customer_id text
stripe_subscription_id text
username text (único, para perfil público)
data_nascimento date           ← LGPD
termos_aceitos_em timestamptz  ← LGPD
marketing_aceito boolean       ← LGPD
suspended_at timestamptz       ← Admin
suspended_reason text          ← Admin
```

### Tabela: `user_cards`
```sql
id uuid
user_id uuid (FK users)
card_name text
card_id text
set_name text
rarity text
variante text (normal/foil/promo/reverse/pokeball)
quantity int
card_link text
image_url text
created_at timestamptz
```

### Tabela: `card_prices`
```sql
card_name text (PK)
preco_normal, preco_foil, preco_promo, preco_reverse, preco_pokeball
preco_min, preco_medio, preco_max
preco_foil_min, preco_foil_medio, preco_foil_max
preco_promo_min, preco_promo_medio, preco_promo_max
preco_reverse_min, preco_reverse_medio, preco_reverse_max
preco_pokeball_min, preco_pokeball_medio, preco_pokeball_max
updated_at timestamptz
```

### Tabela: `tickets`
```sql
id uuid
user_id uuid
subject text
status text (open/pending/resolved/closed)
priority text (low/medium/high/urgent)
created_at, updated_at timestamptz
```

### Tabela: `ticket_messages`
```sql
id uuid
ticket_id uuid
sender text (user/admin)
message text
created_at timestamptz
```

### Tabela: `sets` — 172 sets sincronizados do TCG API
### Tabela: `card_sets`, `portfolio_history`, `negociacoes`, `avaliacoes`

---

## 💰 PLANOS

| Plano | Preço | Cartas | Anúncios |
|---|---|---|---|
| **Free** | Grátis | 6 | 3 |
| **Trial Pro** | Grátis 7 dias | Ilimitado | Ilimitado |
| **Pro Mensal** | R$29,90/mês | Ilimitado | Ilimitado |
| **Pro Anual** | R$249/ano (~R$20,75/mês) | Ilimitado | Ilimitado |

Trial inicia automaticamente no cadastro. Cron job verifica expiração diariamente.

---

## 🎨 DESIGN SYSTEM

**Cores:**
- Background: `#080a0f`
- Surface: `#0d0f14`
- Brand gradient: `linear-gradient(135deg, #f59e0b, #ef4444)` (âmbar → vermelho)
- Texto primário: `#f0f0f0`
- Texto secundário: `rgba(255,255,255,0.45)`
- Verde sucesso: `#22c55e`
- Amarelo trial: `#f59e0b`

**Tipografia:** DM Sans (Google Fonts)

**Bordas:** `1px solid rgba(255,255,255,0.1)`
**Border radius padrão:** 10-16px

**Labels dos campos (padrão UX):**
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

### useAppModal (substitui alert/confirm/prompt nativos)
```tsx
const { showAlert, showConfirm, showPrompt } = useAppModal()
await showAlert('Mensagem', 'success' | 'error' | 'warning' | 'info')
const ok = await showConfirm({ message: '...', danger: true })
const val = await showPrompt({ message: '...', placeholder: '...' })
```

### AppLayout
Envolve todas as páginas internas. Recebe `userId`, `isPro`, `isTrial`.
Tem sidebar desktop + bottom nav mobile + header.

### Icons.tsx
28+ ícones: `IconDashboard`, `IconCollection`, `IconMarketplace`, `IconAccount`, `IconScan`, `IconTrash`, `IconEdit`, etc.

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

3. **Imagens de cartas:** `images.pokemontcg.io` bloqueia browser (CORS).
   Usar proxy via `/api/card-image` ou `scrydex.com` para logos de sets.

4. **Imagens de cartas (URL padrão):**
   `https://images.pokemontcg.io/{set.id}/{number}_hires.png`
   Ex: `https://images.pokemontcg.io/sv3pt5/183_hires.png` = Charizard ex 151 SIR

5. **Next.js body size:** Limite 4MB. Comprimir imagens no client antes de enviar base64.

6. **Camera permissions no next.config.ts:**
   ```ts
   'Permissions-Policy': 'camera=(self)' // NÃO 'camera=()'
   ```

7. **Joins no Supabase:** `user_cards` e `card_prices` não têm FK — fazer 2 queries separadas.

8. **CSV export:** Usa BOM (`\uFEFF`) para Excel abrir corretamente em pt-BR.

9. **Onboarding:** Chave localStorage por userId: `ob-complete-{userId}`, `ob-step-{userId}-{stepId}`

10. **Admin auth:** Cookie HMAC (não Supabase Auth). Protegido por middleware.

11. **Middleware:** Bloqueia `/admin/*` e usuários `suspended_at NOT NULL`.

---

## 📱 RESPONSIVIDADE

- Sidebar: oculta em mobile
- Header mobile: logo + menu hamburguer
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
- 4 funções de ticket (suporte) — novo ticket, nova mensagem, resolvido, fechado

Todos com template HTML dark theme compatível com Outlook (VML + bgcolor).

---

## 🔐 ADMIN

- **URL:** `/admin` (login com senha HMAC)
- **Email admin:** `eduardo@brazildigital.ag`
- **Funcionalidades:** dashboard métricas, gestão de tickets (responder, mudar status/prioridade), gestão de usuários (conceder Pro, estender trial, suspender, excluir)
- **Proteção:** middleware Next.js

---

## 🛒 MARKETPLACE

- Anúncio de cartas com foto, preço, variante
- Contato via WhatsApp (mensagem pré-preenchida com nome da carta e preço)
- Limite: 3 anúncios (Free) / ilimitado (Pro)
- Moderação pelo Admin (pendente implementação)

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
- Menores de 13: bloqueados no cadastro
- 13-17 anos: aviso de autorização do responsável
- DPO: `privacidade@bynx.gg`
- Suporte: `suporte@bynx.gg`
- Páginas: `/termos` e `/privacidade`

---

## 🗺️ LANDING PAGE (`/`)

Seções em ordem:
1. Header fixo (logo, nav, botão entrar/cadastrar)
2. Hero (headline, subtítulo, CTAs, mockup animado)
3. Como funciona (3 passos)
4. Estatísticas (cartas, usuários, sets)
5. Sets disponíveis (logos scrydex.com)
6. Features grid
7. Planos (Free / Pro Mensal / Pro Anual com 30% OFF)
8. **Demo animada** (3 cenas: Dashboard, Minha Coleção com cartas reais, Marketplace)
9. FAQ accordion
10. Depoimentos
11. CTA final
12. Footer (Fale conosco · Privacidade · Termos de uso)

**Modal Auth:** Login + Cadastro em 2 etapas no mesmo modal
- Etapa 1: Nome, Data de nascimento, E-mail, Senha
- Etapa 2: CPF, Cidade*, WhatsApp*, Aceite de Termos*, Marketing (opcional)

**Modal Contato Comercial:** 6 categorias → formulário → email para eduardo@brazildigital.ag

---

## 🏪 GUIA DE LOJAS (PRÓXIMA FEATURE — chat separado)

**Fase 1 (diretório):**
- Lojas pagam para estar listadas
- Página pública: `bynx.gg/lojas/nome-da-loja`
- Planos: Básico (grátis), Pro R$49/mês, Premium R$99/mês
- Leads de lojistas já chegam pelo modal de contato (categoria "Quero minha loja no Bynx")
- **Não transacional** — contato via WhatsApp, sem pagamentos intermediados

---

## 📋 BACKLOG PRIORIZADO

### 🔴 Alta prioridade
- [ ] Moderação do Marketplace no Admin
- [ ] **Guia de Lojas** (novo chat)

### 🟡 Média prioridade
- [ ] Métricas avançadas no Admin (conversão trial→Pro, tempo de resposta tickets)
- [ ] Vídeo demo real na landing page (quando Du gravar)

### 🟢 Baixa prioridade / futuro
- [ ] Planos Lojista com Stripe
- [ ] Analytics por carta (histórico de preço individual)

---

## 🐛 BUGS CONHECIDOS / WATCHLIST

- `user_cards` ↔ `card_prices`: sem FK, sempre fazer 2 queries separadas
- `images.pokemontcg.io`: CORS, usar proxy `/api/card-image`
- Deploy Vercel: JSX com siblings sem fragment `<>` quebra o Turbopack
- Scan com IA: requer créditos suficientes na conta Anthropic (erro 400 pode ser saldo)

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
ADMIN_SECRET
ADMIN_EMAIL=eduardo@brazildigital.ag
NEXT_PUBLIC_APP_URL=https://bynx.gg
```

---

## 👤 USUÁRIO DE TESTE

- **Username:** eduardo
- **User ID:** `122267ef-5aeb-4fd0-a9c0-616bfca068bd`

---

## 💡 CONTEXTO DE NEGÓCIO

- Mercado: colecionadores de Pokémon TCG no Brasil
- Posicionamento: **organizador** de coleção (não "investimento" — evitar juridicamente)
- Diferencial: único app brasileiro focado em TCG com marketplace integrado
- Monetização: assinatura Pro + (futuro) planos Lojista
- Comunidade: Instagram `@bynx.gg`, Discord `discord.gg/bynx`, WhatsApp

---

## 📐 REGRAS DE TRABALHO (Mia + Du)

1. **Mia sempre verifica o deploy no Vercel** ao iniciar uma sessão
2. **Arquivos grandes são entregues como output** para Du substituir localmente e fazer git push
3. **Nunca usar `.single().catch()`** no Supabase
4. **Sempre testar JSX com siblings** — envolver em `<>` quando necessário
5. **Labels acima dos campos** (não só placeholder) — padrão UX do Bynx
6. **useAppModal** em vez de `alert()`/`confirm()` nativos nas páginas internas
7. **Mia nunca faz git push diretamente** — entrega arquivos, Du faz o push
8. **Chats segmentados por feature grande** (Admin foi num chat, Guia de Lojas vai em outro)
9. **Posicionamento jurídico:** nunca mencionar "investimento", "tempo real", "LigaPokemon" diretamente no copy
10. **CSS no Bynx:** inline styles com objetos TypeScript (não Tailwind nas páginas internas)

---

*Documento gerado em 23/04/2026 — Sessão 14 do Bynx*
