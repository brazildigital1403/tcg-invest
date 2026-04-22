import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Query 1: cartas do usuário
    const { data: cards, error } = await supabase
      .from('user_cards')
      .select('card_name, card_id, set_name, rarity, variante, quantity, card_link, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    if (!cards || cards.length === 0) {
      return new NextResponse('Nenhuma carta encontrada', { status: 404 })
    }

    // Query 2: preços das cartas
    const cardNames = cards.map(c => c.card_name).filter(Boolean)
    const { data: prices } = await supabase
      .from('card_prices')
      .select('card_name, preco_normal, preco_foil, preco_min, preco_medio, preco_max')
      .in('card_name', cardNames)

    // Mapa de preços por nome
    const priceMap: Record<string, any> = {}
    prices?.forEach(p => { priceMap[p.card_name] = p })

    // Monta CSV
    const header = [
      'Nome', 'ID', 'Set', 'Raridade', 'Variante', 'Quantidade',
      'Preço Normal (R$)', 'Preço Foil (R$)', 'Preço Mín (R$)',
      'Preço Médio (R$)', 'Preço Máx (R$)', 'Valor Total (R$)',
      'Link', 'Adicionada em'
    ].join(',')

    const rows = cards.map(c => {
      const p = priceMap[c.card_name] || {}
      const precoUnit = c.variante === 'foil' ? (p.preco_foil || 0) : (p.preco_normal || 0)
      const total = precoUnit * (c.quantity || 1)
      const data = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : ''

      const esc = (v: any) => {
        const s = String(v ?? '')
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
      }

      return [
        esc(c.card_name), esc(c.card_id), esc(c.set_name), esc(c.rarity), esc(c.variante),
        c.quantity || 1,
        (p.preco_normal || 0).toFixed(2).replace('.', ','),
        (p.preco_foil || 0).toFixed(2).replace('.', ','),
        (p.preco_min || 0).toFixed(2).replace('.', ','),
        (p.preco_medio || 0).toFixed(2).replace('.', ','),
        (p.preco_max || 0).toFixed(2).replace('.', ','),
        total.toFixed(2).replace('.', ','),
        esc(c.card_link), data,
      ].join(',')
    })

    const csv = '\uFEFF' + [header, ...rows].join('\n') // BOM para Excel abrir em pt-BR
    const today = new Date().toISOString().split('T')[0]

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bynx-colecao-${today}.csv"`,
      },
    })
  } catch (err: any) {
    console.error('[export/csv]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}