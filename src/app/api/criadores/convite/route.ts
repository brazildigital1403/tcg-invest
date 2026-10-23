// src/app/api/criadores/convite/route.ts
//
// Estado publico do convite de grupo (ativo, encerrado ou invalido), lido pela
// landing /criadores, que e estatica e pega o codigo do link no navegador.
// Devolve so nome, dias e prazo: teto e usos ficam no servidor.

import { NextRequest, NextResponse } from 'next/server'
import { buscarConviteGrupo, conviteParaPublico } from '@/lib/convitesGrupo'

export async function GET(req: NextRequest) {
  const c = req.nextUrl.searchParams.get('c')
  const convite = await buscarConviteGrupo(c)
  return NextResponse.json(conviteParaPublico(convite), { headers: { 'Cache-Control': 'no-store' } })
}
