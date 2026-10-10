// Preferencias de e-mail (regua F0, card #391).
//
// Dois jeitos de se identificar, e um caminho so de escrita:
//   - Bearer (Minha Conta, logado);
//   - `t` = o mesmo token do descadastro (link do rodape, SEM login). Quem
//     clica esta no cliente de e-mail, sem sessao -- e o token e o que ja
//     protege o descadastro hoje: uuid aleatorio por usuario, nao enumeravel.
//
// Escreve com service role de proposito: `authenticated` tem UPDATE por
// COLUNA em `users` e as `email_pref_*` NAO estao nessa lista. Assim o cliente
// nao ganha permissao nova no banco, e as duas portas passam pela mesma regra.
//
// Transacional nao tem toggle aqui: recibo, pedido e suporte sempre chegam.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const CAMPOS = 'email, marketing_aceito, email_optout_nurture, email_pref_colecao, email_pref_mercado, email_pref_novidades, email_pref_radar'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

/** Resolve a conta pelo Bearer ou pelo token do descadastro. */
async function identificar(req: NextRequest): Promise<{ coluna: 'id' | 'unsubscribe_token'; valor: string } | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (bearer) {
    const sbAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await sbAuth.auth.getUser(bearer)
    return user ? { coluna: 'id', valor: user.id } : null
  }
  const t = new URL(req.url).searchParams.get('t') || ''
  if (/^[0-9a-f-]{36}$/i.test(t)) return { coluna: 'unsubscribe_token', valor: t }
  return null
}

/** `ana.souza@gmail.com` -> `an***@gmail.com`. O link pode ser repassado. */
function mascarar(email: string | null): string | null {
  if (!email) return null
  const [u, d] = email.split('@')
  if (!d) return null
  return `${u.slice(0, 2)}***@${d}`
}

type LinhaUser = {
  email: string | null; marketing_aceito: boolean | null; email_optout_nurture: boolean | null
  email_pref_colecao: boolean | null; email_pref_mercado: boolean | null
  email_pref_novidades: boolean | null; email_pref_radar: boolean | null
}

function formatar(u: LinhaUser, logado: boolean) {
  return {
    email: logado ? u.email : mascarar(u.email),
    marketingAceito: u.marketing_aceito === true,
    optOut: !!u.email_optout_nurture,
    prefs: {
      colecao: u.email_pref_colecao !== false,
      mercado: u.email_pref_mercado !== false,
      novidades: u.email_pref_novidades !== false,
      radar: u.email_pref_radar !== false,
    },
  }
}

export async function GET(req: NextRequest) {
  const quem = await identificar(req)
  if (!quem) return NextResponse.json({ error: 'nao_identificado' }, { status: 401 })

  const { data, error } = await supabaseAdmin().from('users').select(CAMPOS).eq(quem.coluna, quem.valor).limit(1)
  if (error) {
    console.error('[email/preferencias] GET', error.message)
    return NextResponse.json({ error: 'erro' }, { status: 500 })
  }
  const u = data?.[0]
  if (!u) return NextResponse.json({ error: 'nao_encontrado' }, { status: 404 })
  return NextResponse.json(formatar(u, quem.coluna === 'id'))
}

/**
 * Corpo aceito (todos opcionais):
 *   { colecao, mercado, novidades, radar, marketingAceito: boolean,
 *     sairDeTudo: true }
 *
 * Regras:
 *   - `sairDeTudo` liga `email_optout_nurture` (o mesmo do descadastro).
 *   - Ligar qualquer categoria, ou aceitar novidades, DESLIGA o opt-out: a
 *     pessoa acabou de dizer que quer receber algo.
 *   - Ligar uma categoria de marketing nao liga `marketing_aceito` sozinho; o
 *     aceite e um toggle proprio, explicito.
 */
export async function POST(req: NextRequest) {
  const quem = await identificar(req)
  if (!quem) return NextResponse.json({ error: 'nao_identificado' }, { status: 401 })

  const corpo = await req.json().catch(() => ({})) as Record<string, unknown>
  const upd: Record<string, boolean> = {}
  const mapa: Record<string, string> = {
    colecao: 'email_pref_colecao', mercado: 'email_pref_mercado',
    novidades: 'email_pref_novidades', radar: 'email_pref_radar',
    marketingAceito: 'marketing_aceito',
  }
  for (const [chave, coluna] of Object.entries(mapa)) {
    if (typeof corpo[chave] === 'boolean') upd[coluna] = corpo[chave] as boolean
  }
  if (corpo.sairDeTudo === true) {
    upd.email_optout_nurture = true
  } else if (Object.values(upd).some((v) => v === true)) {
    upd.email_optout_nurture = false
  }
  if (Object.keys(upd).length === 0) return NextResponse.json({ error: 'nada_para_salvar' }, { status: 400 })

  const { data, error } = await supabaseAdmin()
    .from('users').update(upd).eq(quem.coluna, quem.valor).select(CAMPOS)
  if (error) {
    console.error('[email/preferencias] POST', error.message)
    return NextResponse.json({ error: 'erro' }, { status: 500 })
  }
  const u = data?.[0]
  if (!u) return NextResponse.json({ error: 'nao_encontrado' }, { status: 404 })
  return NextResponse.json(formatar(u, quem.coluna === 'id'))
}
