import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

    const supabaseAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Sessao invalida' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const cardId = searchParams.get('id') || searchParams.get('card_id')
    if (!cardId) return NextResponse.json({ history: [], total: 0 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

    const { data, error } = await supabase
      .from('price_history')
      .select('recorded_at, preco_normal, preco_foil, preco_min, preco_medio, preco_max')
      .eq('card_id', cardId)
      .order('recorded_at', { ascending: true })
      .limit(120)

    // Nunca derruba com 500: qualquer falha devolve historico vazio (degrada com graca).
    if (error) {
      console.error('[api/historico]', error.message)
      return NextResponse.json({ history: [], total: 0 })
    }

    const byDay: Record<string, any> = {}
    for (const item of data || []) {
      const day = item.recorded_at?.slice(0, 10)
      if (day) byDay[day] = item
    }

    const history = Object.entries(byDay).map(([day, item]) => ({
      date: day,
      normal: item.preco_normal ?? item.preco_medio ?? null,
      foil: item.preco_foil ?? null,
      min: item.preco_min ?? null,
      max: item.preco_max ?? null,
    }))

    return NextResponse.json({ id: cardId, history, total: history.length })
  } catch (err: any) {
    console.error('[api/historico] fatal', err?.message)
    return NextResponse.json({ history: [], total: 0 })
  }
}
