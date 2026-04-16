import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: cartas } = await supabase
      .from('card_prices')
      .select('card_name')
      .lt('updated_at', since)
      .limit(20)

    if (!cartas || cartas.length === 0) {
      return NextResponse.json({ message: 'Nenhuma carta para atualizar.', updated: 0 })
    }

    let updated = 0
    let errors = 0

    for (const carta of cartas) {
      try {
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

        await supabase.from('card_price_history').insert({
          card_name: carta.card_name,
          preco_min: data.preco_min || 0,
          preco_medio: data.preco_medio || 0,
          preco_max: data.preco_max || 0,
          date: new Date().toISOString().slice(0, 10),
        })

        updated++
        await new Promise(r => setTimeout(r, 500))
      } catch {
        errors++
      }
    }

    return NextResponse.json({ message: 'Atualização concluída', updated, errors, total: cartas.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}