import { NextRequest, NextResponse } from 'next/server'

/**
 * Coletor de violacoes de CSP.
 *
 * O browser faz POST aqui toda vez que a politica (hoje em Report-Only) e
 * violada. Logamos de forma compacta pra ler nos runtime logs da Vercel e
 * decidir o que precisa entrar na policy ANTES de virar pra enforcing.
 *
 * Nao autentica (o browser posta sem credencial) e nao grava em banco: e um
 * canal de diagnostico temporario. Responde 204 sempre.
 */

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const r = body?.['csp-report'] || body || {}

    const directive = r['effective-directive'] || r['violated-directive'] || '?'
    const blocked = String(r['blocked-uri'] || '?').slice(0, 200)
    const doc = String(r['document-uri'] || '?').slice(0, 200)

    // Ignora ruido classico de extensao do browser / adblock
    if (/^(chrome-extension|moz-extension|safari-extension)/.test(blocked)) {
      return new NextResponse(null, { status: 204 })
    }

    console.warn(`[CSP] ${directive} bloquearia: ${blocked} | em: ${doc}`)
  } catch {
    // nunca quebra
  }
  return new NextResponse(null, { status: 204 })
}

export async function GET() {
  return NextResponse.json({ ok: true, info: 'Endpoint de relatorio de CSP (POST only).' })
}
