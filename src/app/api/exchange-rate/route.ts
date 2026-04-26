import { NextResponse } from 'next/server'

// Cache em memória — evita chamadas desnecessárias
let cache: { usd: number; eur: number; updatedAt: number } | null = null
const CACHE_TTL = 60 * 60 * 1000 // 1 hora

export async function GET() {
  // Retorna cache se ainda válido
  if (cache && Date.now() - cache.updatedAt < CACHE_TTL) {
    return NextResponse.json(cache)
  }

  try {
    const res = await fetch(
      'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL',
      { signal: AbortSignal.timeout(5000) }
    )

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    const usd = parseFloat(data.USDBRL?.bid || '6.0')
    const eur = parseFloat(data.EURBRL?.bid || '6.5')

    cache = { usd, eur, updatedAt: Date.now() }
    return NextResponse.json(cache)
  } catch {
    // Fallback com valores aproximados se a API falhar
    return NextResponse.json({ usd: 6.0, eur: 6.5, updatedAt: Date.now() })
  }
}
