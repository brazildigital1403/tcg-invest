# Contexto — Construir `/admin/lojas` (Passo 9 do Guia de Lojistas)

Este documento descreve tudo que a Mia do chat admin precisa saber pra construir o painel de moderação de lojas do Bynx. O chat do Guia de Lojistas já está maduro e tem toda a infraestrutura pronta — agora falta o back-office admin.

---

## 🎯 Objetivo

Construir `/admin/lojas` no painel admin existente, pra o Du poder:

- **Ver** todas as lojas cadastradas com filtros
- **Aprovar** lojas pendentes (pra elas aparecerem no guia público)
- **Suspender** lojas com problemas (ocultar do guia + registrar motivo)
- **Verificar** lojas legítimas (badge âmbar no card público)
- **Reativar** lojas suspensas/inativas quando fizer sentido

Hoje o Du faz isso via SQL direto no Supabase — trabalhoso e arriscado.

---

## 🗄️ Schema da tabela `lojas` (relevante pra moderação)

Tabela criada no Passo 1 do Guia de Lojistas. Colunas que o admin vai usar:

```sql
CREATE TABLE lojas (
  id                    UUID PRIMARY KEY,
  owner_user_id         UUID REFERENCES users(id),

  -- Identidade
  nome                  TEXT NOT NULL,
  slug                  TEXT UNIQUE NOT NULL,
  descricao             TEXT,
  logo_url              TEXT,

  -- Localização
  cidade                TEXT NOT NULL,
  estado                TEXT NOT NULL,        -- UF (2 letras)
  endereco              TEXT,
  tipo                  TEXT NOT NULL,        -- 'fisica' | 'online' | 'ambas'

  -- Especialidades
  especialidades        TEXT[] NOT NULL,      -- ['pokemon', 'magic', 'yugioh', 'lorcana', 'digimon', 'outros']

  -- Contatos
  whatsapp              TEXT,
  instagram             TEXT,
  facebook              TEXT,
  website               TEXT,
  fotos                 TEXT[],

  -- Plano e moderação
  plano                 TEXT NOT NULL DEFAULT 'basico',  -- 'basico' | 'pro' | 'premium'
  status                TEXT NOT NULL DEFAULT 'pendente',
                        -- 'pendente' | 'ativa' | 'suspensa' | 'inativa'
  verificada            BOOLEAN NOT NULL DEFAULT false,

  -- Moderação (campos que admin escreve)
  suspensao_motivo      TEXT,                 -- preenchido ao suspender
  suspensao_data        TIMESTAMPTZ,          -- quando foi suspensa
  suspenso_por          UUID REFERENCES users(id), -- admin que suspendeu (opcional)
  aprovada_data         TIMESTAMPTZ,          -- quando passou a 'ativa' pela primeira vez
  aprovada_por          UUID REFERENCES users(id), -- admin que aprovou (opcional)

  -- Trial / limites
  trial_expires_at      TIMESTAMPTZ,          -- fim dos 14 dias de Pro trial
  ultima_aparicao_topo  TIMESTAMPTZ,          -- round-robin Premium (não mexer)

  -- SEO
  seo_title             TEXT,
  seo_description       TEXT,

  -- Timestamps
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

> **IMPORTANTE:** Se as colunas `suspensao_motivo`, `suspensao_data`, `suspenso_por`, `aprovada_data`, `aprovada_por` **não existirem ainda**, a Mia admin precisa criar um SQL migration antes. Checar com `\d lojas` no Supabase SQL Editor:
>
> ```sql
> -- Migration sugerida caso as colunas não existam:
> ALTER TABLE lojas
>   ADD COLUMN IF NOT EXISTS suspensao_motivo TEXT,
>   ADD COLUMN IF NOT EXISTS suspensao_data   TIMESTAMPTZ,
>   ADD COLUMN IF NOT EXISTS suspenso_por     UUID REFERENCES users(id),
>   ADD COLUMN IF NOT EXISTS aprovada_data    TIMESTAMPTZ,
>   ADD COLUMN IF NOT EXISTS aprovada_por     UUID REFERENCES users(id);
> ```

---

## 📊 Estados e transições

### Estados

| Status | Significado | Visível no guia público? |
|---|---|---|
| `pendente` | Acabou de cadastrar, aguardando aprovação | ❌ |
| `ativa` | Aprovada, aparece no guia | ✅ |
| `suspensa` | Admin bloqueou por violação | ❌ |
| `inativa` | Owner desativou (ou foi inativada) | ❌ |

### Transições permitidas pelo admin

```
pendente  → ativa        (aprovar)
pendente  → suspensa     (rejeitar por fraude/problema)
ativa     → suspensa     (suspender)
ativa     → pendente     (caso extremo: forçar re-moderação)
suspensa  → ativa        (reativar após resolver problema)
suspensa  → pendente     (mandar owner refazer dados)
inativa   → ativa        (reativar a pedido do owner, raro)
```

### Transições que o OWNER faz (via `/api/lojas/[id]` PATCH — já existe)

```
ativa     → inativa      (desativar própria loja)
pendente  → inativa      (desistir antes de aprovada)
inativa   → pendente     (reativar pra re-moderação)
```

O owner **NUNCA** pode: sair de `suspensa`, ir pra `suspensa`, ir pra `ativa` diretamente.

---

## 🔐 Autenticação

**Usar o mesmo padrão das outras APIs admin** (ex: `src/app/api/admin/users/[id]/route.ts`):

- Cookie HMAC `bynx_admin` validado pelo `middleware.ts` na raiz
- Middleware já bloqueia `/api/admin/*` com 401 se não autenticado
- Dentro da rota, usar `supabaseAdmin()` com `SUPABASE_SERVICE_KEY`

**NÃO usar Bearer token** (isso é só pra APIs de user comum, como `/api/lojas/*`).

---

## 🛠️ APIs a criar

### 1. `POST /api/admin/lojas/[id]/approve`

Aprova uma loja (`pendente` ou `suspensa` → `ativa`). Envia email.

**Body:** vazio ou `{}`.

**Retornos:**
- `200` → `{ loja }` atualizada
- `400` → loja já está ativa, ou transição inválida (ex: tentar aprovar `inativa`)
- `404` → loja não encontrada
- `500` → erro de DB ou envio de email (loja ainda é aprovada mesmo se email falhar — logar erro)

**O que faz:**
```typescript
// Pseudo-código
const { data: loja } = await sb.from('lojas').select('*').eq('id', id).limit(1)
if (!loja?.[0]) return 404
if (loja[0].status === 'ativa') return 400 'já está ativa'
if (loja[0].status === 'inativa') return 400 'reative primeiro'

const primeiraAprovacao = !loja[0].aprovada_data

await sb.from('lojas').update({
  status: 'ativa',
  aprovada_data: primeiraAprovacao ? new Date().toISOString() : loja[0].aprovada_data,
  // aprovada_por: adminUserId (opcional — se o admin tiver user_id associado)
  suspensao_motivo: null,  // limpa motivo anterior se tinha
  suspensao_data: null,
  suspenso_por: null,
}).eq('id', id)

// Envia email só na PRIMEIRA aprovação (pra não spammar em reativações)
if (primeiraAprovacao) {
  const { data: owner } = await sb.from('users').select('email, name').eq('id', loja[0].owner_user_id).limit(1)
  if (owner?.[0]) {
    await sendEmailLojaAprovada({ to: owner[0].email, nomeLoja: loja[0].nome, slug: loja[0].slug, nomeUser: owner[0].name })
  }
}

return { loja: updated[0] }
```

### 2. `POST /api/admin/lojas/[id]/suspend`

Suspende uma loja. Envia email com motivo.

**Body:** `{ motivo: string }` (obrigatório, min 10 chars, max 500)

**Retornos:**
- `200` → `{ loja }` atualizada
- `400` → motivo faltando/inválido, ou loja já suspensa
- `404` → loja não encontrada

**O que faz:**
```typescript
const { motivo } = body
if (!motivo || motivo.trim().length < 10) return 400 'motivo obrigatório (min 10 chars)'

await sb.from('lojas').update({
  status: 'suspensa',
  suspensao_motivo: motivo.trim(),
  suspensao_data: new Date().toISOString(),
  // suspenso_por: adminUserId (opcional)
}).eq('id', id)

// Envia email avisando owner
const { data: owner } = await sb.from('users').select('email, name').eq('id', loja.owner_user_id).limit(1)
if (owner?.[0]) {
  await sendEmailLojaSuspensa({ to: owner[0].email, nomeLoja: loja.nome, motivo, nomeUser: owner[0].name })
}
```

### 3. `POST /api/admin/lojas/[id]/toggle-verified`

Alterna flag `verificada`. Não envia email (mudança silenciosa).

**Body:** vazio ou `{}`.

**Retornos:**
- `200` → `{ loja }` atualizada
- `404` → loja não encontrada

**O que faz:**
```typescript
await sb.from('lojas').update({
  verificada: !loja.verificada
}).eq('id', id)
```

### 4. (Opcional) `GET /api/admin/lojas`

Lista todas as lojas com filtros. Se preferir, o `/admin/lojas/page.tsx` pode fazer query direta no Supabase (padrão do resto do admin). **Verificar como `/admin/users` e `/admin/tickets` fazem** e seguir o mesmo padrão.

Filtros úteis:
- `?status=pendente|ativa|suspensa|inativa` (default: todas)
- `?search=nome_ou_slug` (LIKE match)
- `?plano=basico|pro|premium`
- `?verificada=true|false`
- Ordenação: `status='pendente'` primeiro (pra priorizar moderação), depois `created_at DESC`

---

## 📧 Templates de email (2 novos)

Adicionar em `src/lib/email.ts` (ou onde os templates existentes estão). Seguir o padrão dos emails de ticket que já funcionam.

### Template 1: Loja aprovada

**Assunto:** `🎉 Sua loja foi aprovada no Bynx!`

**Body:**
```
Olá, [nomeUser]!

Boa notícia: sua loja [nomeLoja] foi aprovada pela equipe do Bynx e já está
no ar no Guia de Lojas.

🔗 Página da sua loja:
https://bynx.gg/lojas/[slug]

🔗 Painel de edição:
https://bynx.gg/minha-loja

Lembretes:
- Seu trial Pro de 14 dias começou agora. Aproveita pra colocar fotos,
  redes sociais e as especialidades da sua loja.
- Depois dos 14 dias, escolhe se quer continuar no Pro (R$ 39/mês) ou
  voltar pro plano Básico (grátis).

Qualquer dúvida, é só responder este email.

Abraços,
Equipe Bynx
```

### Template 2: Loja suspensa

**Assunto:** `Sua loja foi suspensa no Bynx`

**Body:**
```
Olá, [nomeUser]!

Precisamos te avisar que sua loja [nomeLoja] foi suspensa temporariamente
no Guia do Bynx.

Motivo:
[motivo]

Enquanto suspensa, sua loja não aparece no guia público. Pra contestar ou
pedir a reativação, é só responder este email explicando o que mudou.

Abraços,
Equipe Bynx
```

Função assinatura esperada (seguir padrão de `email.ts`):

```typescript
export async function sendEmailLojaAprovada(params: {
  to: string
  nomeUser: string
  nomeLoja: string
  slug: string
}): Promise<void>

export async function sendEmailLojaSuspensa(params: {
  to: string
  nomeUser: string
  nomeLoja: string
  motivo: string
}): Promise<void>
```

---

## 🎨 Página `/admin/lojas/page.tsx`

### Layout

Seguir exatamente o padrão das outras páginas admin (`/admin/users`, `/admin/tickets`).

**Header da página:**
- Título: "Moderação de Lojas"
- Subtítulo: "Aprovar, suspender e verificar lojas do Guia"
- Contador: "X pendentes · Y ativas · Z suspensas" (urgência visual)

**Filtros (chips ou select):**
- Status: Todas / Pendentes (default se tem pelo menos 1 pendente) / Ativas / Suspensas / Inativas
- Busca: input texto (nome ou slug)
- Ordenação: padrão "pendentes primeiro, depois mais recentes"

**Tabela/cards de lojas:**

Cada linha/card mostra:
- Logo (se tiver) ou placeholder
- Nome + slug + badge do status (pendente=âmbar, ativa=verde, suspensa=vermelho, inativa=cinza)
- Cidade/UF · Tipo (física/online/ambas)
- Badge "Verificada ✓" se `verificada=true`
- Badge do plano (Básico/Pro/Premium)
- Email do owner (pra contato rápido)
- Data de criação
- Ações: botões contextuais baseados em status

**Ações por status:**

| Status atual | Botões visíveis |
|---|---|
| pendente | **Aprovar** (verde) · **Suspender** (vermelho) · Ver detalhes |
| ativa | **Suspender** · Toggle verificada · Ver detalhes |
| suspensa | **Reativar** (= approve) · Ver motivo da suspensão · Ver detalhes |
| inativa | Ver detalhes (opcionalmente "Forçar reativação" numa tela separada) |

**Modal de detalhes:**
Ao clicar "Ver detalhes", abre modal com **todos** os dados da loja pra o admin revisar antes de aprovar:
- Todas as info (descrição completa, endereço, contatos, fotos, eventos)
- Link "Abrir página pública" (abre `/lojas/[slug]` em nova aba)
- Link "Ver perfil do owner" (abre `/admin/users/[owner_user_id]`)

**Modal de suspensão:**
Ao clicar "Suspender", abre modal pedindo motivo:
- Textarea com label "Motivo da suspensão" (min 10 chars)
- Exemplos de placeholders: "Fraude confirmada", "Dados falsos", "Produto pirata", "Múltiplas reclamações"
- Aviso: "O owner receberá um email com este motivo"
- Botão "Cancelar" + botão "Suspender" (vermelho)

### Observações visuais

- Lojas com `status='pendente'` deveriam ter um destaque visual (borda âmbar ou background sutil) pra chamar atenção
- Se o admin tem muitas pendentes, mostrar um banner no topo: "⚠️ 5 lojas pendentes aguardando aprovação"

---

## 🧭 Integrar no menu do admin

Adicionar "Lojas" no menu lateral do layout admin (seguir padrão existente). Provavelmente em algum `AdminSidebar.tsx` ou `AdminLayout.tsx`.

Posição sugerida: entre "Usuários" e "Tickets" (ou onde fizer mais sentido no menu atual).

Ícone sugerido: storefront (tem exemplo no `@/components/ui/Icons`, ou SVG inline tipo o `IconGuiaLojas` que existe no `AppLayout`).

---

## 🧪 Testes sugeridos depois de implementar

Com o user `eduardo` tendo 3 lojas de teste:

1. **Listar**: entrar em `/admin/lojas` e confirmar que as 3 aparecem
2. **Filtrar**: trocar filtro pra "Pendentes" — se nenhuma estiver pendente, criar uma via `POST /api/lojas` (a API já cria como pendente)
3. **Aprovar**: clicar aprovar em uma pendente → deve virar ativa + email chegar
4. **Suspender**: pegar a `loja-premium-sp` e suspender com motivo "teste de suspensão admin" → conferir que motivo salva no banco + email chega
5. **Reativar**: clicar reativar → deve voltar pra ativa, limpar motivo
6. **Toggle verificada**: ligar/desligar o badge âmbar → conferir na página pública `/lojas/[slug]`
7. **Detalhes**: clicar ver detalhes de uma loja e conferir que todos os campos aparecem

---

## 📋 Entregáveis esperados

1. **3 API routes novas:**
   - `src/app/api/admin/lojas/[id]/approve/route.ts`
   - `src/app/api/admin/lojas/[id]/suspend/route.ts`
   - `src/app/api/admin/lojas/[id]/toggle-verified/route.ts`

2. **2 funções novas em** `src/lib/email.ts`:
   - `sendEmailLojaAprovada()`
   - `sendEmailLojaSuspensa()`

3. **1 página nova:**
   - `src/app/admin/lojas/page.tsx`

4. **Possivelmente 1 migration SQL** (se as colunas `suspensao_motivo`, etc. não existirem):
   - `supabase/migrations/003_add_moderacao_fields_to_lojas.sql` (ou rodar manualmente no SQL Editor)

5. **Atualização no menu admin** (1 arquivo, path a descobrir pela Mia admin)

---

## ⚠️ Edge cases pra atenção

- **Email falhou mas update passou:** logar o erro, retornar sucesso. A aprovação vale mais que o email.
- **Admin tenta suspender sem motivo:** bloquear no frontend E no backend (min 10 chars)
- **Loja em trial:** aprovar não reseta `trial_expires_at` — mantém o countdown original
- **Reaprovar após suspensão:** **NÃO** envia email de "aprovada" de novo (só na primeira aprovação). Usa a flag `aprovada_data` pra decidir.
- **Admin suspende uma loja já suspensa:** retornar 400 com msg "já está suspensa"
- **Múltiplos admins simultâneos:** last-write-wins no PostgreSQL é OK pra esse caso

---

## 🎬 Estado atual (contexto que pode ser útil)

- Projeto tem ~3 lojas de teste em produção hoje (1 premium SP, 1 pro RJ, 1 básica PR)
- Todas com `status='ativa'` porque foram inseridas via SQL direto durante desenvolvimento
- Nenhuma tem `suspensao_motivo` preenchido
- Tabela `loja_cliques` também existe (tracking de cliques, feature do Passo 7) — não precisa mexer

---

## 🚀 Quando terminar

Depois do Passo 9 funcionando, a ordem recomendada é:

1. **Passo 10** — Upload de fotos via Supabase Storage (retorna pro chat do Guia de Lojistas)
2. **Passo 11** — Analytics Premium (dados já sendo gravados)
3. **Passo 8** — Stripe (último, mais complexo)

Ao final do Passo 9, gerar um update bem resumido (3-5 linhas) pra passar pro chat do Guia de Lojistas sabendo que a moderação tá pronta e as APIs admin existem.

---

_Contexto gerado pela Mia do chat Guia de Lojistas, Bynx — 24/abril/2026._
