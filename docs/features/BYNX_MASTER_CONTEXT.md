# BYNX — Master Context
_Última atualização: 23/abril/2026_

> Documento vivo que resume o estado atual do projeto Bynx pra ser passado como contexto inicial em novas sessões com a Mia. Atualizado ao final de cada sessão.

---

## 🎯 Sobre o projeto

**Bynx** (bynx.gg) é um app brasileiro pra colecionadores de Pokémon TCG organizarem e valorizarem suas coleções. Recentemente expandido com um **Guia de Lojistas** — seção B2B que permite lojas de TCG no Brasil serem descobertas pelos colecionadores da plataforma.

- **Dono:** Du (Eduardo)
- **Repo:** `brazildigital1403/tcg-invest` (main)
- **Stack:** Next.js 16 (Turbopack) + React 19 + Supabase + Stripe + Resend + Vercel
- **User teste:** `eduardo` / `122267ef-5aeb-4fd0-a9c0-616bfca068bd`
- **Projeto Vercel:** `prj_X1CUMTLMwTL77trWqZdDdmBI9PRC` / team `team_FK9fHseL9hy5mbNR6c0Q8JuK`

---

## 📐 Regras de trabalho com a Mia (pins de memória)

1. **Código pronto pra push GitHub** — paths espelhando estrutura exata do repo (`src/app/...`, `src/components/...`)
2. **Comandos git em bloco ÚNICO** — add + commit + push encadeados com `&&`, Du cola uma vez e executa tudo
3. **Código 100% completo** — SEMPRE arquivos inteiros, NUNCA diffs/trechos ("procura esse bloco e substitui")
4. **Ao final de cada sessão** — Mia gera o `BYNX_MASTER_CONTEXT.md` atualizado (este arquivo)

---

## 🏗️ Paths-chave do repo

| Componente | Path |
|---|---|
| Layout autenticado | `@/components/ui/AppLayout` |
| Modais (alert/confirm) | `@/components/ui/useAppModal` |
| Header público unificado | `@/components/ui/PublicHeader` |
| Footer público | `@/components/ui/PublicFooter` |
| Cliente Supabase | `@/lib/supabaseClient` |
| Icon system | `@/components/ui/Icons` (⚠️ evitar import cross-boundary client→server no Turbopack) |

---

## ✅ Estado atual do Guia de Lojistas

### Passos concluídos e em produção

| # | Passo | Status | Arquivos principais |
|---|---|---|---|
| 1 | Tabela `lojas` no Supabase (~30 colunas, 8 índices, 4 RLS policies, CHECK constraints, trigger updated_at) | ✅ | `001_create_lojas.sql` |
| 2 | `/lojas` listagem pública com filtros e SEO dinâmico | ✅ | `src/app/lojas/page.tsx`, `CardLoja.tsx`, `FiltrosGuia.tsx` |
| 3 | `/lojas/[slug]` página individual com CTA WhatsApp | ✅ | `src/app/lojas/[slug]/page.tsx` |
| 3.5 | Lightbox full-screen na galeria (teclado + swipe) | ✅ | `src/components/lojas/GaleriaFotos.tsx` |
| 4 | `/minha-loja` painel do lojista (4 estados, trial Pro 14 dias) | ✅ | `src/app/minha-loja/page.tsx`, `FormLoja.tsx` |
| 5 | `/para-lojistas` landing B2B dedicada | ✅ | `src/app/para-lojistas/page.tsx`, `LojistasFAQ.tsx` |
| 6 | AppLayout adaptativo (colecionador/híbrido/lojista puro) | ✅ | `src/components/ui/AppLayout.tsx` |
| — | Header público unificado (Opção B — prop opcional na landing) | ✅ | `src/components/ui/PublicHeader.tsx`, `src/app/page.tsx` |
| — | Redirect automático removido da landing pra logados | ✅ | `src/app/page.tsx` |

### Pendências do roadmap (backlog)

| # | Passo | Notas |
|---|---|---|
| 7 | APIs `/api/lojas/*` (CRUD + track-click + upload-foto) | próximo lógico |
| 8 | Integração Stripe (Pro/Premium mensal+anual + ofertas avulsas) | |
| 9 | `/admin/lojas` (moderação — aprovar/suspender/verificar) | |
| 10 | Upload de fotos via Supabase Storage | |
| 11 | Analytics de views/cliques + ofertas avulsas (boost 72h, destaque evento, foto extra) | |

---

## 💰 Pricing e modelo de negócio (travado)

### Planos de loja

| Plano | Preço | Limites |
|---|---|---|
| **Básico** | Grátis | 1 jogo, 160 chars descrição, sem fotos/sociais |
| **Pro** | R$ 39/mês ou R$ 390/ano (2 meses grátis) | 5 fotos, redes sociais, especialidades ilimitadas |
| **Premium** | R$ 89/mês ou R$ 890/ano | 10 fotos, eventos, analytics, rotação no topo |

### Condições

- **Trial Pro 14 dias** pra todo novo cadastro (sem cartão)
- **Renovação anual após 12m**: 20% off (só plano anual)
- **Beta fechado**: primeiros 30 lojistas Pro grátis por 6m (contrapartida: feedback/depoimento)

### Ofertas avulsas (Passo 11 — planejado)

- Destaque evento na home do guia: R$ 29 / 7 dias
- Boost 72h topo da cidade: R$ 19 / 72h (fura rotação Premium)
- Foto extra acima do limite: R$ 9 permanente

### Destaque Premium — diferenciação visual + rotação

- Card 1.5x maior, borda âmbar, preview 3 fotos, preview próximo evento, glow hover
- Dentro do tier Premium: rotação round-robin (coluna `ultima_aparicao_topo`) + verificadas primeiro
- Ordem da listagem: Premium (rotação) → Pro → Básico
- NÃO usa topo absoluto (evita churn quando muitos Premium)

---

## 🧭 Arquitetura User ↔ Lojista (decisão v2)

**User único** — não existe "tipo de conta" separado. Um registro `public.users` pode ser colecionador, lojista, ou ambos ao mesmo tempo. O `AppLayout` detecta o perfil em runtime via 2 queries e adapta o menu.

### Detecção no mount (queries Supabase)

```sql
SELECT 1 FROM user_cards WHERE user_id = ? LIMIT 1   → setTemCartas
SELECT id FROM lojas WHERE owner_user_id = ? LIMIT 1 → setTemLoja
```

### Modos e menus

| Perfil | Condição | Menu |
|---|---|---|
| **Colecionador puro** | tem cartas, sem loja | Dashboard · Coleção · Pokédex · Marketplace · Separadores · Guia de Lojas · Conta · Suporte |
| **Híbrido** | tem cartas E loja | [mesmo acima] + **Minha Loja** |
| **Lojista puro** | tem loja, sem cartas | Minha Loja · Guia de Lojas · Conta · Suporte (menu enxuto) |
| **Lojista em "explore mode"** | clicou em "Explorar como colecionador" | Menu completo + Minha Loja |
| **Novo usuário** | nem cartas nem loja | Menu completo + Guia de Lojas |

### Peculiaridades do AppLayout

- "Guia de Lojas" **sempre visível** pra todo usuário logado
- "Minha Loja" **condicional** (só aparece se owner_user_id = userId retornar loja)
- Botão **"Explorar como colecionador"** — pra lojista puro, persiste em `localStorage['bynx_explore_mode']`
- Banner **"Modo colecionador ativo"** no topo quando explore mode ligado
- Patrimônio **oculto** pra lojista puro (sem cartas não faz sentido mostrar R$ 0,00)
- Logo da sidebar aponta pra `/minha-loja` no lojista puro (vs `/dashboard-financeiro` normal)
- Bottom nav mobile ganhou `overflowX: auto` + `minWidth: 64` pra acomodar até 9 itens
- Logout limpa flag `bynx_explore_mode`

---

## 🎨 Header público unificado

Arquitetura final: **1 componente, 3 páginas, 1 prop opcional**.

### Uso

```tsx
// Landing (src/app/page.tsx)
<PublicHeader landingScrollTargets={{ howRef, pricingRef }} />

// /lojas, /lojas/[slug], /para-lojistas
<PublicHeader />
```

### Comportamento

| Contexto | Nav desktop mostra |
|---|---|
| Landing | Como funciona · Planos · 🏪 Guia de Lojas · Para lojistas · [CTA] |
| Outras páginas públicas | 🏪 Guia de Lojas · Para lojistas · [CTA] |

### CTA dinâmico

- **Logado** → "Meu Dashboard" (navega pra `/dashboard-financeiro`)
- **Deslogado** → "Entrar" (navega pra `/login`)
- **Loading** → placeholder sutil pra evitar flash

### Redirect automático — REMOVIDO

Antes: logado que abria `bynx.gg` era empurrado pra `/dashboard-financeiro` no useEffect. Hoje: permanece na landing, botão do header oferece acesso rápido se quiser. Racional: com várias seções novas (Guia, Para Lojistas, Minha Loja), não faz sentido forçar o user a sair da landing.

### Consequência UX

Botão "Entrar" do header da landing agora navega pra `/login` em vez de abrir modal in-place. CTAs dos cards de planos continuam abrindo o modal normalmente.

---

## 🗄️ Dados de teste em produção (Supabase)

3 lojas com `owner_user_id='122267ef-5aeb-4fd0-a9c0-616bfca068bd'`:

1. **`loja-premium-sp`** — Mestre dos Baralhos (SP, Premium, WhatsApp 11999998888, IG/FB/site, Rua Augusta 1200, 6 fotos Unsplash, 2 eventos)
2. **`card-house-rj`** — Card House Rio (RJ, Pro, física, pokemon+yugioh)
3. **`pokeshop-online`** — PokéShop Online (PR, Básico, online, pokemon)

---

## 🧠 Aprendizados técnicos acumulados

### Supabase v2

- `.single().catch()` chaining é **unpredictable** — usar `.limit(1)` e checar `data?.[0]`

### TCG API

- **Não aceita** card numbers com leading zeros (usar `20`, não `020`)

### Imagens

- `images.pokemontcg.io` **bloqueia** requests diretos do browser (CORS) — usar scrydex.com pra set logos

### Next.js 16 / Turbopack

- `params` e `searchParams` são **Promises** — normalizar com `typeof === 'string'` antes de usar
- **Quirk cross-boundary**: Server Component importando Client Component que importa `Icons.tsx` (sem `'use client'`) causa 500. Solução: SVG inline ou adicionar `'use client'` no Icons
- **`revalidate = 60` + searchParams dinâmicos** = conflito. Usar `export const dynamic = 'force-dynamic'`
- Body size default 4MB — client-side image compression antes de base64 pra API routes
- `Permissions-Policy: camera=()` no `next.config.ts` bloqueia câmera — deve ser `camera=(self)`

### Paths que já quebraram antes

- `@/hooks/useAppModal` **não existe** no repo — usar `@/components/ui/useAppModal`

### Vercel

- Build logs ficam em: deployment URL + `/source` ou aba "Logs" dentro do detail
- API do MCP: `get_deployment_build_logs` com o ID
- **Bynx em produção:** `https://www.bynx.gg`

### Debugging

- Interceptar `window.fetch` com wrapper que clone response e logue `res.text()` antes de JSON parse — debugging confiável de APIs no browser
- `web_fetch_vercel_url` retorna HTML do SSR direto — bom pra confirmar que páginas renderizam sem precisar abrir o browser

### Anthropic API

- 400 errors podem indicar **créditos insuficientes** na conta, não necessariamente bug no código

---

## 📧 Sistema de suporte e admin (em produção)

Construído em sessão paralela:

- `/suporte` e `/suporte/[id]` — tickets do usuário
- `/admin/*` — painel protegido (login HMAC cookie, dashboard métricas, gestão de tickets, gestão de usuários)
- Tabelas novas: `tickets`, `ticket_messages`
- Colunas novas em `users`: `suspended_at`, `suspended_reason`
- Middleware protege `/admin/*` e bloqueia suspensos
- `email.ts` tem 4 funções de ticket
- Fix `full_name` → `name` em webhook, welcome e cron-trial

---

## 🚀 Deploys relevantes

| Deploy | Commit | Descrição | Status |
|---|---|---|---|
| — | último | refactor PublicHeader unificado (sessão 23/abr) | 🆕 acabou de subir |
| `dpl_35vWsN5ie7nFrAk5BcSzQAYeAcGD` | `2c82e85` | Passo 6 AppLayout adaptativo | READY |
| `dpl_FbC4bNSFE9rGxhp5nyHoGbF7i2jW` | `87f16be` | Passo 5 landing B2B | READY |
| `dpl_DwDYv7hvSx3TGeJDptHYYNW4LnvQ` | `7adcbc3` | fix path useAppModal | READY |

---

## 🧪 Testes que foram confirmados em produção

- `/lojas` renderiza 3 cards (Premium→Pro→Básico) corretamente
- `/lojas/loja-premium-sp` renderiza completo com lightbox
- `/minha-loja` status 200 no SSR (Client Component com skeleton de loading)
- `/para-lojistas` com hero + métricas + passos + planos + benefícios + FAQ + CTA final
- AppLayout pós-Passo 6: sidebar tem 8 itens incluindo "Guia de Lojas", bottom nav mobile com `overflowX` funcional

---

## 🔜 Próximos passos sugeridos (quando Du voltar)

### Curto prazo — Passo 7: APIs `/api/lojas/*`

Estruturar os endpoints necessários:
- `POST /api/lojas` — criar loja (hoje tá inline no page)
- `PATCH /api/lojas/[id]` — editar loja
- `POST /api/lojas/[id]/track-click` — registra clique em WhatsApp (pra analytics Premium)
- `POST /api/lojas/[id]/upload-foto` — stub (Storage vem no Passo 10)

### Médio prazo — Passo 8: Stripe

- Products: Pro Mensal (R$ 39), Pro Anual (R$ 390), Premium Mensal (R$ 89), Premium Anual (R$ 890)
- Webhook `/api/webhooks/stripe` pra ativar plano após checkout
- Ofertas avulsas (boost/destaque/foto extra) como one-time payments

### Antes de Stripe — melhorias UX possíveis

- Onboarding pós-cadastro: modal perguntando "Você é colecionador, lojista, ou os dois?" — ajuda a direcionar pro primeiro passo certo
- Banner na `/minha-loja` quando trial tá nos últimos 3 dias
- Email de "sua loja foi aprovada" (usando Resend) — hoje a aprovação é silenciosa

---

## 📚 Como retomar com a Mia na próxima sessão

1. Abre chat novo no Claude
2. Cola este arquivo como primeira mensagem
3. Diz o que quer fazer — ex: "Bora no Passo 7" ou "Preciso fazer um ajuste em X"
4. A Mia já vai ter todo o contexto pra não perguntar coisas óbvias

Se a Mia parecer perdida, pode sempre me mandar arquivos específicos do repo que eu leio e entendo o estado atual.

---

_Feito com ♥ pelo Du e pela Mia — Bynx é pra colecionador brasileiro._
