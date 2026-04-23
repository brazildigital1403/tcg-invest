# 🟡 BYNX — CONTEXTO COMPLETO + GUIA DE LOJISTAS

> Cole esse documento inteiro no início do chat novo.
> Assistente: Mia | Usuário: Du

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
│   ├── page.tsx                          ← Landing page
│   ├── layout.tsx
│   ├── cadastro/page.tsx
│   ├── login/page.tsx
│   ├── dashboard-financeiro/page.tsx     ← Dashboard principal
│   ├── minha-colecao/page.tsx
│   ├── marketplace/page.tsx
│   ├── minha-conta/page.tsx
│   ├── pokedex/page.tsx
│   ├── separadores/page.tsx
│   ├── perfil/[id]/page.tsx              ← Perfil público
│   ├── termos/page.tsx
│   ├── privacidade/page.tsx
│   ├── pro-ativado/page.tsx
│   ├── reset-password/page.tsx
│   ├── carta/[id]/page.tsx
│   ├── admin/                            ← Painel admin (login HMAC, dashboard, tickets, usuários)
│   ├── suporte/page.tsx
│   ├── suporte/[id]/page.tsx
│   └── api/
│       ├── contact/route.ts              ← Modal contato comercial
│       ├── scan-cards/route.ts           ← Claude Vision API
│       ├── salvar-carta/route.ts
│       ├── preco/route.ts
│       ├── historico/route.ts
│       ├── ranking/route.ts
│       ├── export/csv/route.ts
│       ├── stripe/checkout/route.ts
│       ├── stripe/webhook/route.ts
│       ├── stripe/success/route.ts
│       ├── email/welcome/route.ts
│       ├── cron-trial-emails/route.ts
│       ├── cron-precos/route.ts
│       └── sync-sets/route.ts
├── components/
│   ├── ui/
│   │   ├── AppLayout.tsx                 ← Layout interno (sidebar + bottom nav mobile)
│   │   ├── Icons.tsx                     ← 28+ ícones SVG custom
│   │   ├── OnboardingModal.tsx
│   │   ├── ScanModal.tsx
│   │   ├── UpgradeBanner.tsx
│   │   └── useAppModal.tsx               ← showAlert, showConfirm, showPrompt
│   ├── dashboard/AddCardModal.tsx
│   └── marketplace/
│       ├── AnunciarModal.tsx
│       ├── NegociacoesTab.tsx
│       └── AvaliacaoModal.tsx
└── lib/
    ├── supabaseClient.ts
    ├── email.ts
    ├── isPro.ts
    ├── checkCardLimit.ts
    ├── checkNegLimit.ts
    └── calcPatrimonio.ts
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
username text
data_nascimento date
termos_aceitos_em timestamptz
marketing_aceito boolean
suspended_at timestamptz
suspended_reason text
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
preco_foil_min/_medio/_max
preco_promo_min/_medio/_max
preco_reverse_min/_medio/_max
preco_pokeball_min/_medio/_max
updated_at timestamptz
```

### Tabelas adicionais
- `tickets` — suporte (id, user_id, subject, status, priority, created_at, updated_at)
- `ticket_messages` — (id, ticket_id, sender, message, created_at)
- `sets` — 172 sets do TCG API
- `card_sets`, `portfolio_history`, `negociacoes`, `avaliacoes`

---

## 💰 PLANOS DO BYNX (usuários)

| Plano | Preço | Cartas | Anúncios |
|---|---|---|---|
| **Free** | Grátis | 6 | 3 |
| **Trial Pro** | Grátis 7 dias | Ilimitado | Ilimitado |
| **Pro Mensal** | R$29,90/mês | Ilimitado | Ilimitado |
| **Pro Anual** | R$249/ano | Ilimitado | Ilimitado |

---

## 🎨 DESIGN SYSTEM

**Cores:**
- Background: `#080a0f`
- Surface: `#0d0f14`
- Brand gradient: `linear-gradient(135deg, #f59e0b, #ef4444)`
- Texto primário: `#f0f0f0`
- Texto secundário: `rgba(255,255,255,0.45)`
- Verde: `#22c55e` | Amarelo: `#f59e0b` | Vermelho: `#ef4444`

**Tipografia:** DM Sans

**Label padrão (acima dos campos):**
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
  color: '#f0f0f0', fontSize: 14, outline: 'none',
  fontFamily: 'inherit', width: '100%', boxSizing: 'border-box'
}
```

**CSS:** Sempre inline styles com objetos TypeScript (não Tailwind nas páginas internas)

---

## ⚙️ PADRÕES TÉCNICOS OBRIGATÓRIOS

1. **Supabase v2 — NUNCA `.single().catch()`**
```ts
// ✅ Sempre assim:
const { data } = await supabase.from('users').select('*').eq('id', uid).limit(1)
const user = data?.[0]
```

2. **TCG API:** sem zeros à esquerda (`'20'` não `'020'`)

3. **Imagens de cartas:** `images.pokemontcg.io` bloqueia browser (CORS) — usar proxy `/api/card-image`

4. **URL padrão de imagem de carta:**
`https://images.pokemontcg.io/{set.id}/{number}_hires.png`

5. **Next.js body size:** 4MB. Comprimir imagens client-side antes de enviar base64.

6. **Camera no next.config.ts:** `'Permissions-Policy': 'camera=(self)'` (não `camera=()`)

7. **Joins:** `user_cards` e `card_prices` não têm FK — sempre 2 queries separadas

8. **Admin auth:** Cookie HMAC (não Supabase Auth)

9. **useAppModal** em vez de `alert()`/`confirm()` nativos

10. **JSX siblings:** sempre envolver em `<>` — Turbopack quebra sem fragment

11. **Logos de sets:** usar `scrydex.com` (não `images.pokemontcg.io`)

---

## 📱 RESPONSIVIDADE

- Sidebar: oculta em mobile (`max-width: 768px`)
- Bottom nav: 7 itens
- Content padding mobile: `16px 12px 100px`
- Header mobile: logo + hamburguer

---

## 📧 EMAILS (Resend)

Funções em `src/lib/email.ts`:
- `sendWelcomeEmail(to, name)`
- `sendTrialExpiring5Email(to, name)`
- `sendTrialExpiring7Email(to, name)`
- `sendPurchaseConfirmationEmail(to, name, type)`
- 4 funções de ticket (novo, mensagem, resolvido, fechado)

Template: HTML dark theme, compatível Outlook (VML + bgcolor)

---

## 🔐 ADMIN

- URL: `/admin`
- Auth: senha HMAC cookie
- Funções: dashboard métricas, tickets (responder/status/prioridade), usuários (Pro/trial/suspender/excluir)
- Proteção: middleware Next.js
- Email admin: `eduardo@brazildigital.ag`

---

## ⚖️ LGPD

- Coleta: `data_nascimento`, `termos_aceitos_em`, `marketing_aceito`
- Menores 13: bloqueados | 13-17: aviso responsável
- DPO: `privacidade@bynx.gg` | Suporte: `suporte@bynx.gg`

---

## 🔑 VARIÁVEIS DE AMBIENTE

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

- Username: `eduardo`
- User ID: `122267ef-5aeb-4fd0-a9c0-616bfca068bd`

---

## 📐 REGRAS DE TRABALHO (Mia + Du)

1. Mia sempre verifica o deploy no Vercel ao iniciar a sessão
2. Arquivos grandes entregues como output para Du substituir e fazer git push
3. Mia nunca faz git push diretamente
4. Labels sempre acima dos campos (não só placeholder)
5. useAppModal em vez de alert()/confirm() nativos
6. Ao final do dia/sessão, Mia gera BYNX_MASTER_CONTEXT.md atualizado para Du fazer push
7. Posicionamento jurídico: nunca mencionar "investimento", "tempo real", "LigaPokemon" diretamente no copy

---

---

# 🏪 FEATURE: GUIA DE LOJISTAS

## Contexto de Negócio

O Bynx já possui um Marketplace entre colecionadores. Agora vamos criar um **Guia de Lojas** — um diretório pago de lojas físicas e online especializadas em Pokémon TCG no Brasil.

**Inspiração:** GeekNinja.com.br, Booking.com (listagem paga), Airbnb (perfil rico por estabelecimento)

**Modelo:** Lojas pagam mensalidade para aparecer no guia. O Bynx é apenas o diretório — **não intermediamos vendas, não somos plataforma transacional.** Contato loja↔cliente via WhatsApp/redes sociais próprias da loja.

**Por que não transacional agora?**
- Exige licença de subadquirente do Bacen
- Cada loja tem sistema de estoque diferente (Bling, Tiny, planilha...)
- Mediação de conflitos, logística, estornos — complexidade jurídica e operacional alta
- Foco agora: validar o modelo de diretório, gerar receita simples

**Diferencial:** Base de usuários já é de colecionadores ativos — exatamente o público que as lojas querem atingir. Leads qualificados.

---

## Planos Lojista

| Plano | Preço | O que inclui |
|---|---|---|
| **Básico** | Grátis | Nome, cidade, WhatsApp, tipo de loja |
| **Pro** | R$49/mês | Página completa, fotos (até 5), redes sociais, badge "Verificado", aparece na busca |
| **Premium** | R$99/mês | Tudo do Pro + topo da busca por cidade/região, anúncio de eventos/torneios, analytics de visualizações |

---

## Estrutura de Dados — Tabela `lojas`

```sql
CREATE TABLE lojas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Identificação
  slug text UNIQUE NOT NULL,         -- ex: 'geek-ninja-sp' → bynx.gg/lojas/geek-ninja-sp
  nome text NOT NULL,
  descricao text,
  
  -- Contato
  whatsapp text,
  email text,
  website text,
  instagram text,
  facebook text,
  
  -- Localização
  cidade text NOT NULL,
  estado text NOT NULL,              -- sigla: 'SP', 'RJ', 'MG'...
  endereco text,                     -- opcional (loja física)
  
  -- Tipo
  tipo text DEFAULT 'online',        -- 'fisica', 'online', 'ambas'
  especialidades text[],             -- ['pokemon', 'yugioh', 'magic', 'lorcana']
  
  -- Plano
  plano text DEFAULT 'basico',       -- 'basico', 'pro', 'premium'
  plano_expira_em timestamptz,
  stripe_subscription_id text,
  
  -- Status
  status text DEFAULT 'pendente',    -- 'pendente', 'ativa', 'suspensa', 'inativa'
  verificada boolean DEFAULT false,   -- badge verificado (admin aprova)
  
  -- Mídia
  logo_url text,
  fotos text[],                      -- array de URLs (máx 5 no Pro, 10 no Premium)
  
  -- SEO / Meta
  meta_title text,
  meta_description text,
  
  -- Eventos (Premium)
  eventos jsonb DEFAULT '[]',        -- [{titulo, data, descricao, link}]
  
  -- Analytics
  visualizacoes int DEFAULT 0,
  cliques_whatsapp int DEFAULT 0,
  
  -- Gestão
  owner_user_id uuid REFERENCES users(id), -- usuário Bynx dono da loja
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX idx_lojas_cidade ON lojas(cidade);
CREATE INDEX idx_lojas_estado ON lojas(estado);
CREATE INDEX idx_lojas_status ON lojas(status);
CREATE INDEX idx_lojas_plano ON lojas(plano);
CREATE INDEX idx_lojas_slug ON lojas(slug);
```

---

## Páginas a Criar

### 1. `/lojas` — Página pública do Guia
- Listagem de lojas **ativas**
- Filtros: por cidade, estado, tipo (física/online/ambas), especialidade
- Cards de loja: logo, nome, cidade, tipo, badge Verificado, especialidades
- Lojas Premium aparecem primeiro (destaque)
- Lojas Pro aparecem em seguida
- Lojas Básico aparecem por último
- Busca por nome ou cidade
- CTA para lojistas: "Cadastre sua loja →"

### 2. `/lojas/[slug]` — Página pública da loja
- Header: logo, nome, badge verificado, tipo
- Descrição
- Galeria de fotos (Pro/Premium)
- Especialidades (chips)
- Localização (cidade/estado + endereço se física)
- Botão WhatsApp (rastreia clique)
- Links: Instagram, Facebook, Website
- Eventos/torneios (Premium)
- SEO: meta tags dinâmicas

### 3. `/minha-loja` — Painel do lojista (autenticado)
- Criar/editar perfil da loja
- Upload de logo e fotos
- Gerenciar eventos (Premium)
- Ver analytics (visualizações, cliques no WhatsApp)
- Ver plano atual e botão de upgrade
- Área de pagamento (Stripe)

### 4. `/admin/lojas` — Moderação no Admin
- Listagem de todas as lojas (pendentes, ativas, suspensas)
- Aprovar/verificar loja
- Suspender loja
- Ver detalhes e plano

---

## API Routes a Criar

```
/api/lojas/create         POST  → cria loja (autenticado)
/api/lojas/update         PUT   → atualiza loja (owner only)
/api/lojas/upload-foto    POST  → upload de foto (storage Supabase)
/api/lojas/track-click    POST  → registra clique no WhatsApp
/api/lojas/stripe/checkout POST → assina plano Pro/Premium
/api/lojas/stripe/webhook  POST → atualiza plano via webhook
/api/admin/lojas          GET   → lista lojas para admin
/api/admin/lojas/aprovar  POST  → aprova/suspende (admin only)
```

---

## Componentes a Criar

```
src/components/lojas/
├── CardLoja.tsx           ← Card da loja na listagem
├── FiltrosGuia.tsx        ← Filtros (cidade, estado, tipo)
├── GaleriaFotos.tsx       ← Galeria de fotos com lightbox
├── BadgeVerificado.tsx    ← Badge amarelo/dourado
├── EventoCard.tsx         ← Card de evento/torneio
└── PlanoLojista.tsx       ← Cards de planos Pro/Premium

src/app/lojas/
├── page.tsx               ← /lojas
└── [slug]/page.tsx        ← /lojas/[slug]

src/app/minha-loja/
├── page.tsx               ← painel lojista
└── editar/page.tsx        ← edição do perfil
```

---

## Adições na Landing Page

Após implementar o Guia, adicionar seção na landing page:

```
── PARA LOJISTAS ──
Sua loja no maior guia de TCG do Brasil
[Card Básico grátis] [Card Pro R$49/mês] [Card Premium R$99/mês]
[ Cadastrar minha loja → ]
```

---

## Adições no AppLayout (sidebar)

Adicionar no menu interno:
```
🏪 Guia de Lojas  → /lojas
```

E para lojistas (verificar se `owner_user_id` existe na tabela lojas):
```
🏪 Minha Loja     → /minha-loja
```

---

## Adições no Admin

- Nova aba "Lojas" em `/admin/lojas`
- Métricas no dashboard: total de lojas, lojas por plano, receita de lojistas

---

## Fluxo de Cadastro do Lojista

1. Lojista vê a seção na landing ou `/lojas` e clica em "Cadastre sua loja"
2. Se não tem conta Bynx → modal de cadastro normal → após cadastro vai para `/minha-loja`
3. Se já tem conta → vai direto para `/minha-loja`
4. Preenche formulário: nome, cidade, estado, tipo, especialidades, contatos
5. Escolhe plano: Básico (grátis, fica ativo imediatamente) ou Pro/Premium (vai para Stripe)
6. Status inicial: `pendente` → Admin aprova → status `ativa`
7. Loja aparece no guia após aprovação

---

## Leads já captados

O modal de contato comercial da landing page já tem a categoria **"Quero minha loja no Bynx"** capturando leads via email para `eduardo@brazildigital.ag`. Antes de implementar, Du pode contatar esses leads manualmente para validar interesse.

---

## Ordem de implementação sugerida

1. **SQL:** Criar tabela `lojas` no Supabase
2. **`/lojas`:** Página de listagem pública (começa simples, sem filtros)
3. **`/lojas/[slug]`:** Página pública da loja
4. **`/minha-loja`:** Painel básico (criar/editar loja, plano Básico)
5. **`/api/lojas/*`:** Rotas de CRUD
6. **Stripe:** Integrar planos Pro/Premium
7. **`/admin/lojas`:** Moderação no Admin
8. **Upload de fotos:** Supabase Storage
9. **Analytics:** track de visualizações e cliques
10. **Landing page:** seção de lojistas
11. **AppLayout:** adicionar item no menu

---

## Decisões já tomadas

- ✅ Fase 1 = diretório simples (sem transacional)
- ✅ Contato loja↔cliente via WhatsApp (fora do Bynx)
- ✅ Planos: Básico grátis / Pro R$49 / Premium R$99
- ✅ Aprovação manual pelo Admin (evitar spam)
- ✅ Slug único por loja (`bynx.gg/lojas/nome-da-loja`)
- ✅ Especialidades: pokemon, yugioh, magic, lorcana, digimon, outros
- ✅ Tipos: física, online, ambas

---

*Documento gerado em 23/04/2026 — início do chat Guia de Lojistas*
