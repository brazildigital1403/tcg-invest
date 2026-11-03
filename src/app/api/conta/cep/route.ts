// POST /api/conta/cep -- o proprio usuario informa so o CEP, no meio de uma rodada.
//
// O lance exige CEP (dar_lance), mas o cadastro curto de 09/10 nao pede: 274 de
// 548 contas chegavam sem ele e so descobriam depois de confirmar o lance. Aqui
// entra so o CEP, sem o endereco completo de /api/conta/endereco. Nunca troca um
// CEP que ja existe: quem quer mudar usa Minha conta.

import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

const erro = (status: number, msg: string) => NextResponse.json({ error: msg }, { status })

export async function POST(req: NextRequest) {
  const db = getServiceSupabase()
  if (!db) return erro(500, 'Configuração ausente')
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return erro(401, 'Entre na sua conta.')
  const { data: authData } = await db.auth.getUser(token)
  const user = authData?.user
  if (!user) return erro(401, 'Entre na sua conta.')

  const body = await req.json().catch(() => null)
  const digitos = String(body?.cep || '').replace(/\D/g, '')
  if (digitos.length !== 8) return erro(400, 'O CEP tem 8 números.')

  const cep = `${digitos.slice(0, 5)}-${digitos.slice(5)}`
  const { error } = await db.from('users').update({ cep }).eq('id', user.id).or('cep.is.null,cep.eq.')
  if (error) {
    console.error('[conta/cep]', error.message)
    return erro(500, 'Não foi possível salvar agora.')
  }
  return NextResponse.json({ ok: true })
}
