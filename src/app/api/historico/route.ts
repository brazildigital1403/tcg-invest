import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabaseAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cardName = searchParams.get('name')
  if (!cardName) return NextResponse.json({ history: [], total: 0 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  const { data, error } = await supabase
    .from('card_price_history')
    .select('recorded_at, preco_normal, preco_foil, preco_min, preco_medio, preco_max')
    .ilike('card_name', cardName)
    .order('recorded_at', { ascending: true })
    .limit(60) // últimos 60 registros

  if (error) return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 })

  // Agrupa por dia — mantém o último registro de cada dia
  const byDay: Record<string, any> = {}
  for (const item of data || []) {
    const day = item.recorded_at?.slice(0, 10) // "2026-04-17"
    if (day) byDay[day] = item
  }

  const history = Object.entries(byDay).map(([day, item]) => ({
    date: day,
    normal: item.preco_normal || item.preco_medio || null,
    foil: item.preco_foil || null,
    min: item.preco_min || null,
    max: item.preco_max || null,
  }))

  return NextResponse.json({ name: cardName, history, total: history.length })
}