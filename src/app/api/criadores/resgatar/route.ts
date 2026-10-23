// src/app/api/criadores/resgatar/route.ts
//
// Quem ja tem conta entra pela landing e resgata o ano aqui. Mesma funcao do
// cadastro (resgatar_convite_grupo): teto, prazo, 1 resgate por conta e
// assinante pago fica fora.

import { NextRequest, NextResponse } from 'next/server'
import { MENSAGEM_RESGATE, normalizarCodigo, resgatarConviteGrupo, usuarioDoToken } from '@/lib/convitesGrupo'

export async function POST(req: NextRequest) {
  const user = await usuarioDoToken(req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Entre na sua conta para ativar o ano.' }, { status: 401 })
  const { c } = (await req.json().catch(() => ({}))) as { c?: string }
  const codigo = normalizarCodigo(c)
  if (!codigo) return NextResponse.json({ error: MENSAGEM_RESGATE.CONVITE_INVALIDO, code: 'CONVITE_INVALIDO' }, { status: 404 })

  const r = await resgatarConviteGrupo(codigo, user.id, false)
  if (!r.ok) {
    const status = r.code === 'ERRO' ? 500 : r.code === 'CONVITE_INVALIDO' ? 404 : 409
    return NextResponse.json({ error: MENSAGEM_RESGATE[r.code], code: r.code }, { status })
  }
  return NextResponse.json({ ok: true, proAte: r.proAte })
}
