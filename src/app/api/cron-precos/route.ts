import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Este endpoint é chamado pelo cron da Vercel (vercel.json)
// Autorizado por CRON_SECRET no env

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // service key para bypass RLS
)

export async function GET(req: NextRequest) {
  // Verifica autorização do cron
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Busca cartas que não foram atualizadas nas últimas 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: cartas } = await supabase
      .from('card_prices')
      .select('card_name')
      .lt('updated_at', since)
      .limit(20) // processa 20 por vez para não estourar timeout

    if (!cartas || cartas.length === 0) {
      return NextResponse.json({ message: 'Nenhuma carta para atualizar.', updated: 0 })
    }

    let updated = 0
    let errors  = 0

    for (const carta of cartas) {
      try {
        // Busca preço na API LigaPokemon
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'}/api/preco-puppeteer?name=${encodeURIComponent(carta.card_name)}`,
          { signal: AbortSignal.timeout(15000) }
        )

        if (!res.ok) { errors++; continue }

        const data = await res.json()
        if (!data.preco_min && !data.preco_medio) { errors++; continue }

        await supabase.from('card_prices').upsert({
          card_name: carta.card_name,
          ...data,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'card_name' })

        // Salva histórico
        await supabase.from('card_price_history').insert({
          card_name: carta.card_name,
          preco_min: data.preco_min || 0,
          preco_medio: data.preco_medio || 0,
          preco_max: data.preco_max || 0,
          date: new Date().toISOString().slice(0, 10),
        })

        updated++
        // Pequeno delay para não sobrecarregar
        await new Promise(r => setTimeout(r, 500))
      } catch {
        errors++
      }
    }

    return NextResponse.json({
      message: `Atualização concluída`,
      updated,
      errors,
      total: cartas.length,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}