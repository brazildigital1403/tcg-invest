# Contexto do projeto Bynx — Referência para APIs

Este documento responde às 2 perguntas sobre padrão de API e autenticação no Bynx, pra servir de referência na construção das rotas do módulo Lojista.

---

## 1. Padrão de API route usado no projeto

Todas as APIs seguem o mesmo padrão. Exemplo real extraído de `src/app/api/admin/users/[id]/route.ts`:

### Cliente Supabase

Uso `@supabase/supabase-js` puro com service role key. **Não** uso `@supabase/ssr` nem `createServerClient`. Crio uma função helper em cada arquivo:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const sb = supabaseAdmin()

    const { data: users, error } = await sb
      .from('users')
      .select('*')
      .eq('id', id)
      .limit(1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!users?.[0]) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    return NextResponse.json({ user: users[0] })
  } catch (err: any) {
    console.error('[admin/users/[id] GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

### Padrões importantes a seguir

- **Sempre `NextResponse.json()`** pra retornos
- **Params sempre com `Promise`** (Next 15/16): `{ params: Promise<{ id: string }> }` e `const { id } = await ctx.params`
- **Try/catch envolvendo tudo** + `console.error` com prefixo `[rota]`
- **`.limit(1)` e checar `data?.[0]`** em vez de `.single()` — é mais previsível
- **Erros formatados** como `{ error: 'mensagem' }` + status code apropriado

---

## 2. Autenticação

### Para APIs admin (`/api/admin/*`)

Uso **cookie HMAC customizado** (`bynx_admin`), validado por um `middleware.ts` na raiz — ele bloqueia `/api/admin/*` com 401 se não autenticado. **Não se aplica ao módulo Lojista.**

### Para APIs de usuário comum (caso do Lojista)

Uso **Bearer token do Supabase Auth** passado no header.

**No frontend** (via helper `src/lib/authFetch.ts`), as chamadas vão assim:

```typescript
const session = await supabase.auth.getSession()
fetch(url, { 
  headers: { 
    Authorization: `Bearer ${session.data.session.access_token}` 
  } 
})
```

**No servidor**, valido o token assim (exemplo de `src/app/api/tickets/route.ts`):

```typescript
const authHeader = req.headers.get('authorization')
const token = authHeader?.replace('Bearer ', '')
if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

const sb = supabaseAdmin()
const { data: { user }, error: authErr } = await sb.auth.getUser(token)
if (authErr || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

// Agora tenho user.id pra validar ownership (ex: dono da loja)
```

**Use esse padrão para todas as rotas `/api/lojas/*`** — é o correto pra ações do próprio usuário.

---

## 3. Env vars disponíveis

```
NEXT_PUBLIC_SUPABASE_URL       = https://hvkcwfcvizrvhkerupfc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = (anon key, pública)
SUPABASE_SERVICE_KEY           = (service role key, SÓ no servidor)
```

---

## 4. Schema da tabela `users` (relevante pra validação de plano Pro)

Colunas principais:

```
id, email, name, username, cpf, city, whatsapp,
is_pro, plano, pro_expira_em, trial_expires_at,
scan_creditos, suspended_at, suspended_reason,
created_at
```

### Como calcular o plano efetivo

Se precisar bloquear features Premium (tipo analytics da loja), use esta lógica:

```typescript
const now = Date.now()
const trialMs = user.trial_expires_at ? new Date(user.trial_expires_at).getTime() : 0
const isTrial = !user.is_pro && trialMs > now
const planoEfetivo = user.is_pro ? 'pro' : isTrial ? 'trial' : 'free'
```

`planoEfetivo` retorna `'pro'`, `'trial'` ou `'free'`. Features Premium geralmente liberam pra `'pro'` e `'trial'`.

---

## 5. Middleware e rotas protegidas

Existe um `middleware.ts` na raiz que:

1. Protege rotas admin (`/admin/*`, `/api/admin/*`)
2. Bloqueia usuários suspensos (`suspended_at` preenchido) nas rotas protegidas do app

**Rotas atualmente protegidas** no matcher:

```
/dashboard-financeiro, /minha-colecao, /minha-conta, /marketplace,
/pokedex, /separadores, /pro-ativado, /suporte
```

### Decisão sobre `/lojas/*`

- Se `/lojas/[slug]` é **página pública** (qualquer pessoa vê a loja) → **não precisa mexer no middleware**
- Se tem páginas privadas tipo `/lojas/minhas` ou `/lojas/nova` → **adicione elas ao matcher do middleware**
- As rotas **de API** (`/api/lojas/*`) não precisam estar no middleware porque elas mesmas validam o Bearer token

---

## 6. FormLoja.tsx

**Ainda falta enviar o código atual do `FormLoja.tsx`** pra definir o shape exato do body que `POST /api/lojas` vai aceitar. Eu (Du) vou mandar em seguida.

---

## Resumo pra começar a Entrega 1

Você tem agora:

✅ Padrão de API route (imports, estrutura, handlers, try/catch)
✅ Como autenticar via Bearer token do Supabase Auth
✅ Como validar ownership (via `user.id` depois do `getUser(token)`)
✅ Env vars disponíveis
✅ Schema de `users` pra bloquear features Premium se necessário
✅ Info sobre middleware (se precisa mexer ou não)

⏳ Falta só o **`FormLoja.tsx` atual** pra definir o body do POST.

Com isso, a Entrega 1 (5 API routes + SQL de `loja_cliques`) pode começar 🚀
