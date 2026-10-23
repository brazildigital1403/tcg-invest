// src/app/api/criadores/evento/route.ts
//
// Etapas do funil que so o navegador enxerga: visita e toque no CTA. Envio,
// erro e conta criada sao gravados pelo servidor. Sempre responde 200: medicao
// nunca trava a pessoa nem vira oraculo de codigo.

import { NextRequest, NextResponse } from 'next/server'
import { buscarConviteGrupo, registrarEventoConvite } from '@/lib/convitesGrupo'
import { criarLimitador, ipDaRequest } from '@/lib/rateLimit'

const limite = criarLimitador({ janelaMs: 60_000, max: 20 })

export async function POST(req: NextRequest) {
  try {
    const ip = ipDaRequest(req)
    limite.gc()
    if (ip && limite.excedeu(ip)) return NextResponse.json({ ok: true })
    const { c, etapa } = (await req.json().catch(() => ({}))) as { c?: string; etapa?: string }
    if (etapa === 'visita' || etapa === 'cta') {
      const convite = await buscarConviteGrupo(c)
      if (convite) await registrarEventoConvite(convite.id, etapa)
    }
  } catch (e) {
    console.error('[criadores/evento]', e instanceof Error ? e.message : e)
  }
  return NextResponse.json({ ok: true })
}
