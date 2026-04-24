# BYNX — Master Context
_Última atualização: 24/abril/2026 (fim do dia — Passo 7 completo)_

> Documento vivo que resume o estado atual do projeto Bynx pra ser passado como contexto inicial em novas sessões com a Mia. Atualizado ao final de cada sessão.

---

## 🎯 Sobre o projeto

**Bynx** (bynx.gg) é um app brasileiro pra colecionadores de Pokémon TCG organizarem e valorizarem suas coleções. Recentemente expandido com um **Guia de Lojistas** — seção B2B que permite lojas de TCG no Brasil serem descobertas pelos colecionadores da plataforma.

- **Dono:** Du (Eduardo)
- **Repo:** `brazildigital1403/tcg-invest` (main) — pasta local `~/tcg-app`
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
| **Helper de API autenticada** | `@/lib/authFetch` |
| **Link com tracking** | `@/components/lojas/TrackedLink` |
| Form de loja | `@/components/lojas/FormLoja` |
| Icon system | `@/components/ui/Icons` (⚠️ evitar import cross-boundary client→server no Turbopack) |

---

## ✅ Estado atual do Guia de Lojistas

### Passos concluídos e em produção

| # | Passo | Status |
|---|---|---|
| 1 | Tabela `lojas` no Supabase | ✅ |
| 2 | `/lojas` listagem pública com filtros e SEO | ✅ |
| 3 | `/lojas/[slug]` página individual | ✅ |
| 3.5 | Lightbox na galeria (teclado + swipe) | ✅ |
| 4 | `/minha-loja` painel do lojista | ✅ |
| 5 | `/para-lojistas` landing B2B | ✅ |
| 6 | AppLayout adaptativo | ✅ |
| — | Header público unificado (+ remove redirect auto) | ✅ |
| — | Modal de auth unificado (landing serve todas as páginas) | ✅ |
| — | Ajustes mobile /para-lojistas | ✅ |
| **7** | **APIs /api/lojas/* + frontend consumindo** | ✅ **hoje** |

### Pendências — ordem de prioridade

| # | Passo | Dificuldade | Tempo | Por que nessa ordem |
|---|---|---|---|---|
| 🥇 9 | `/admin/lojas` (moderação) | 🟢 Fácil | 2-3h | Destrava moderação manual via SQL; vitória rápida; aproveita toda infra existente (auth HMAC, email) |
| 🥈 10 | Upload de fotos (Storage) | 🟡 Média | 3-5h | Melhora drasticamente o valor percebido de Pro/Premium |
| 🥉 11 | Analytics Premium | 🟡 Média | 3-4h | Dados já sendo gravados desde Passo 7; falta dashboard |
| 4️⃣ 8 | Stripe (Pro/Premium) | 🔴 Alta | 6-10h | Edge cases críticos; beta fechado cobre até lá (30 Pro grátis 6m) |

---

## 🎯 Passo 7 — Detalhamento (sessão de 24/abril)

### Entrega 1 — APIs no servidor

**Nova tabela SQL** — `loja_cliques`:
```
id, loja_id (FK lojas), tipo ('whatsapp'|'instagram'|'facebook'|'website'|'maps'),
user_id (FK users, opcional), user_agent, referrer, ip, created_at
```
3 índices (loja_id, loja_id+tipo, loja_id+date). RLS: owner lê próprios, inserts via service role.

**5 endpoints novos** em `src/app/api/lojas/`:

| Endpoint | Método | Auth | Função |
|---|---|---|---|
| `/api/lojas` | POST | Bearer | Cria loja (whitelist 18 campos, slug único, 1 loja ativa por user, seta `status=pendente` + `plano=pro` trial) |
| `/api/lojas/[id]` | PATCH | Bearer owner | Edita (transições de status: `ativa→inativa`, `pendente→inativa`, `inativa→pendente`; `suspensa` só admin) |
| `/api/lojas/[id]` | DELETE | Bearer owner | Soft delete (`status='inativa'`), idempotente |
| `/api/lojas/[id]/track-click` | POST | **Pública** | Registra clique CTA (captura user-agent, referer, ip, header opcional `x-user-id`) |
| `/api/lojas/[id]/upload-foto` | POST | Bearer owner | **STUB 501** — Passo 10 implementa com Supabase Storage |

### Entrega 2 — Frontend consumindo APIs

**Arquivo novo:**
- `src/components/lojas/TrackedLink.tsx` — Client Component que envolve `<a>` e dispara track-click via fetch (fire-and-forget com `keepalive: true`). Não bloqueia navegação, silent fail.

**Refatorado `FormLoja.tsx`:**
- Antes: `supabase.from('lojas').insert/update()` inline
- Depois: `authFetch('/api/lojas')` POST / `authFetch('/api/lojas/[id]')` PATCH
- `Content-Type: application/json` manual (o `authFetch` existente não seta automaticamente)
- Remove validação manual de slug (servidor valida via 409)
- Remove `owner_user_id` do payload (servidor seta do JWT)

**Refatorado `/lojas/[slug]/page.tsx`:**
- Import de `TrackedLink`
- 5 `<a>` substituídos por `<TrackedLink>` com tipos `whatsapp`, `instagram`, `facebook`, `website`, `maps`

### ⚠️ Notas / pendências do Passo 7

- **Campo `email` NÃO está no whitelist** das APIs. Se quiser salvar email da loja, adicionar em `ALLOWED_FIELDS` e `EDITABLE_FIELDS`.
- **SQL do `loja_cliques` rodado manualmente** no Supabase SQL Editor (não commitado no repo).
- **`/minha-loja/page.tsx` ainda usa Supabase direto** para algumas operações (não mandado pra refatorar). Se tiver botão "Desativar loja" chamando `.delete()` ou `.update({ status: 'inativa' })`, refatorar num próximo passo.

---

## 💰 Pricing travado

| Plano | Preço | Limites |
|---|---|---|
| **Básico** | Grátis | 1 jogo, 160 chars, sem fotos/sociais |
| **Pro** | R$ 39/mês ou R$ 390/ano | 5 fotos, redes sociais, especialidades ilimitadas |
| **Premium** | R$ 89/mês ou R$ 890/ano | 10 fotos, eventos, analytics, rotação no topo |

- Trial Pro 14 dias (sem cartão)
- Renovação anual após 12m: 20% off
- Beta fechado: 30 primeiros Pro grátis por 6m

### Ofertas avulsas (Passo 11)
- Destaque evento na home: R$ 29 / 7 dias
- Boost 72h topo da cidade: R$ 19
- Foto extra acima do limite: R$ 9 permanente

---

## 🧭 Arquitetura User ↔ Lojista

**User único** — detecta perfil em runtime via 2 queries no mount do `AppLayout`:
```sql
SELECT 1 FROM user_cards WHERE user_id = ? LIMIT 1   → temCartas
SELECT id FROM lojas WHERE owner_user_id = ? LIMIT 1 → temLoja
```

4 modos: colecionador puro / híbrido / lojista puro (menu enxuto) / lojista em explore mode (`localStorage['bynx_explore_mode']`).

---

## 🎨 Auth unificado — fluxo atual

**1 modal só** (o rico da landing) serve todas as páginas públicas:

| Origem | Ação | Resultado |
|---|---|---|
| PublicHeader (`/`) | click "Entrar" | CustomEvent `bynx:open-login` (sem reload) |
| PublicHeader (outra página) | click "Entrar" | navigate `/?auth=login` |
| Modal em login | click "Criar conta" | Troca interna pra signup + step plano |

---

## 🗄️ Dados de teste em produção

3 lojas com `owner_user_id='122267ef-5aeb-4fd0-a9c0-616bfca068bd'`:

1. **`loja-premium-sp`** (uuid: `3ce64f94-a4a8-493b-b2f4-e965cba489b1`) — Mestre dos Baralhos (SP, Premium, 6 fotos, 2 eventos)
2. **`card-house-rj`** — Card House Rio (RJ, Pro)
3. **`pokeshop-online`** — PokéShop Online (PR, Básico)

---

## 🧠 Aprendizados técnicos acumulados

### Supabase v2
- `.single().catch()` chaining é **unpredictable** — usar `.limit(1)` e checar `data?.[0]`

### TCG API
- Não aceita card numbers com leading zeros (usar `20`, não `020`)

### Imagens
- `images.pokemontcg.io` bloqueia browser (CORS) — usar scrydex.com

### Next.js 16 / Turbopack
- `params` e `searchParams` são **Promises** — `await ctx.params`
- **Quirk cross-boundary**: Server Component importando Client Component que importa `Icons.tsx` (sem `'use client'`) causa 500. Solução: SVG inline
- `revalidate = 60` + searchParams dinâmicos = conflito. Usar `export const dynamic = 'force-dynamic'`

### Paths/imports
- `@/hooks/useAppModal` **não existe** — usar `@/components/ui/useAppModal`

### Padrão de APIs no repo
- **Cliente no server**: `@supabase/supabase-js` puro com `SUPABASE_SERVICE_KEY`, helper `supabaseAdmin()` em cada arquivo
- **Auth de user APIs**: Bearer token via `Authorization` header, `sb.auth.getUser(token)`
- **Auth admin**: cookie HMAC `bynx_admin` via middleware raiz
- **Retornos**: `NextResponse.json({ error: 'msg' }, { status: 400 })`
- **Try/catch** envolvendo tudo + `console.error('[rota]', err)`

### Vercel / Git
- **Quirk mac**: arquivos baixados às vezes têm atributo `@` (Gatekeeper) — não afeta git
- **`git add` silencioso**: se rodar e não imprimir nada, provavelmente **o commit já foi feito antes** — sempre checar `git log --oneline -5`
- Build logs: `get_deployment_build_logs` com o ID

### Debugging
- `web_fetch_vercel_url` retorna HTML do SSR direto — bom pra confirmar que páginas renderizam sem abrir browser

---

## 📧 Sistema de suporte e admin (já existente)

- `/suporte` e `/suporte/[id]` — tickets do usuário
- `/admin/*` — painel protegido (login HMAC cookie)
- Tabelas: `tickets`, `ticket_messages`
- Colunas em `users`: `suspended_at`, `suspended_reason`
- Middleware protege `/admin/*` e bloqueia suspensos
- `email.ts` com 4 funções de ticket + Resend
- **Passo 9 vai aproveitar essa infraestrutura** pra criar `/admin/lojas`

---

## 🚀 Deploys relevantes da sessão de hoje

| Commit | Descrição | Status |
|---|---|---|
| `502463f` | Entrega 2 Passo 7 — frontend consome APIs + TrackedLink | READY 🆕 |
| `d4acde5` | Entrega 1 Passo 7 — 5 API routes em /api/lojas/* | READY |
| `a1e32de` | Ajustes mobile hero /para-lojistas + centralização CTAs | READY |
| `ce59199` | Auth unificado — remove AuthModal, usa modal antigo | READY |
| `dc9aa32` | Landing lê ?auth=signup query param | READY |

---

## 🧪 Para testar analytics em ação

```sql
-- No Supabase SQL Editor, após clicar em CTAs de uma loja:
SELECT tipo, created_at, user_agent, referrer
FROM loja_cliques
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔜 Próximo passo — Passo 9 (/admin/lojas)

**Dificuldade:** 🟢 Fácil-Média · **Tempo estimado:** 2-3h (1 sessão)

### O que envolve

- Nova página `/admin/lojas/page.tsx` com lista e filtros (pendente/ativa/suspensa/inativa)
- Botões: aprovar, suspender (com motivo), verificar/desverificar
- 3 novas API routes admin:
  - `POST /api/admin/lojas/[id]/approve` (status=ativa, envia email)
  - `POST /api/admin/lojas/[id]/suspend` (status=suspensa, com motivo)
  - `POST /api/admin/lojas/[id]/toggle-verified` (verificada=!verificada)
- Email automático "sua loja foi aprovada" via Resend
- Modal de confirmação pra suspender (com campo de motivo)

### O que a Mia vai precisar pra começar

Na próxima sessão, quando voltarmos, Mia vai pedir:

1. **Exemplo de página admin existente** (ex: `src/app/admin/users/page.tsx` ou similar) — pra seguir o padrão visual/funcional
2. **Exemplo de API admin existente** (ex: `src/app/api/admin/users/[id]/route.ts`) — pra seguir o padrão de auth HMAC
3. **Template de email existente** (ex: `src/lib/email.ts`) — pra adicionar template "loja aprovada"

---

## 📚 Como retomar com a Mia na próxima sessão

1. Abre chat novo no Claude
2. Cola este arquivo como primeira mensagem
3. Diz: **"Bora no Passo 9 — /admin/lojas"**
4. Mia vai pedir os 3 arquivos de referência acima e começar a trabalhar

Se Mia parecer perdida, é só mandar arquivos específicos do repo que ela lê e entende o estado atual.

---

_Feito com ♥ pelo Du e pela Mia — Bynx é pra colecionador brasileiro._
