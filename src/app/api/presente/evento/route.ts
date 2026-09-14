// src/app/api/presente/evento/route.ts
//
// Carimbo de etapa que so o navegador enxerga (hoje: abrir o booster).
// Rota publica: a protecao e o token opaco do convite. Sempre responde 200,
// porque medicao nunca pode travar a pessoa nem virar oraculo de token.

import { NextRequest, NextResponse } from 'next/server'
import { buscarConvite, carimbarConvite } from '@/lib/campanhaConvites'
import { ETAPAS_CLIENTE } from '@/lib/ofertaPresente'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { t, etapa } = body as { t?: string; etapa?: string }
    if ((ETAPAS_CLIENTE as readonly string[]).includes(etapa || '')) {
      const convite = await buscarConvite(t)
      if (convite) await carimbarConvite(convite.id, 'presente_aberto_em')
    }
  } catch (e: any) {
    console.error('[presente/evento]', e?.message)
  }
  return NextResponse.json({ ok: true })
}
