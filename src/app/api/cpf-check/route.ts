import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/cpf-check  { cpf }  ->  { taken: boolean }
 *
 * POR QUE ESTA ROTA EXISTE (auditoria de seguranca, 26/07/2026)
 *
 * A RPC `cpf_em_uso` e SECURITY DEFINER e estava executavel pelo `anon`. Como
 * ela le `public.users.cpf` contornando a RLS, qualquer pessoa sem login podia
 * perguntar "este CPF tem conta na Bynx?" — um oraculo de enumeracao. Com lista
 * de CPF vazada (o que nao falta no Brasil) da pra cruzar a base inteira.
 *
 * O EXECUTE do `anon` foi revogado. O cadastro continua precisando da checagem
 * (a pessoa ainda nao tem sessao quando preenche o formulario), entao ela passa
 * por aqui, onde da pra limitar por IP. A chamada ao banco usa service_role.
 *
 * LIMITE CONHECIDO: o contador vive na memoria da instancia. Em varias lambdas
 * o teto efetivo e maior que o configurado, e um atacante distribuido contorna.
 * Isso encarece o ataque sem eliminar; a solucao definitiva e contador
 * compartilhado (Redis) ou captcha no cadastro.
 */

const JANELA_MS = 10 * 60 * 1000 // 10 min
const TETO = 12                  // consultas por IP na janela

type Registro = { n: number; ate: number }
const balde = new Map<string, Registro>()

function excedeu(ip: string): boolean {
  const agora = Date.now()
  const r = balde.get(ip)

  if (!r || agora > r.ate) {
    balde.set(ip, { n: 1, ate: agora + JANELA_MS })
    // Poda preguicosa: sem isso o Map cresce pra sempre na instancia quente.
    if (balde.size > 5000) {
      for (const [k, v] of balde) if (agora > v.ate) balde.delete(k)
    }
    return false
  }

  r.n += 1
  return r.n > TETO
}

function ipDe(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'desconhecido'
}

export async function POST(req: NextRequest) {
  const ip = ipDe(req)
  if (excedeu(ip)) {
    // 429 sem revelar nada sobre o CPF consultado.
    return NextResponse.json(
      { error: 'Muitas consultas seguidas. Tente de novo em alguns minutos.' },
      { status: 429 }
    )
  }

  let cpf = ''
  try {
    const body = await req.json()
    cpf = String(body?.cpf ?? '')
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
  }

  // So digito. Fora de 11, nem chega no banco.
  const digitos = cpf.replace(/[^0-9]/g, '')
  if (digitos.length !== 11) return NextResponse.json({ taken: false })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    console.error('[cpf-check] env do Supabase ausente')
    // Nao bloqueia o cadastro: a trava real e o unique no banco.
    return NextResponse.json({ taken: false })
  }

  try {
    const sb = createClient(url, key)
    const { data, error } = await sb.rpc('cpf_em_uso', { p_cpf: digitos })
    if (error) {
      console.error('[cpf-check] rpc:', error.message)
      return NextResponse.json({ taken: false })
    }
    return NextResponse.json({ taken: data === true })
  } catch (e: any) {
    console.error('[cpf-check]', e?.message)
    return NextResponse.json({ taken: false })
  }
}
