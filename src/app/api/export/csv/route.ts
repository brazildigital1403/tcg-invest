import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const userId = req.nextUrl.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Busca cartas do usuário com preços
    const { data: cards, error } = await supabase
      .from('user_cards')
      .select(`
        card_name, card_id, set_name, rarity, variante, quantity,
        card_link, created_at,
        card_prices ( preco_normal, preco_foil, preco_min, preco_medio, preco_max )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    if (!cards || cards.length === 0) {
      return new NextResponse('Nenhuma carta encontrada', { status: 404 })
    }

    // Monta o CSV
    const header = [
      'Nome', 'ID', 'Set', 'Raridade', 'Variante', 'Quantidade',
      'Preço Normal (R$)', 'Preço Foil (R$)', 'Preço Mín (R$)',
      'Preço Médio (R$)', 'Preço Máx (R$)', 'Valor Total (R$)',
      'Link', 'Adicionada em'
    ].join(',')

    const rows = cards.map(c => {
      const prices = (c.card_prices as any) || {}
      const precoUnit = c.variante === 'foil' ? (prices.preco_foil || 0) : (prices.preco_normal || 0)
      const totalCard = precoUnit * (c.quantity || 1)
      const addedAt = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : ''

      const escape = (val: any) => {
        const str = String(val ?? '').replace(/"/g, '""')
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str
      }

      return [
        escape(c.card_name),
        escape(c.card_id),
        escape(c.set_name),
        escape(c.rarity),
        escape(c.variante),
        c.quantity || 1,
        (prices.preco_normal || 0).toFixed(2).replace('.', ','),
        (prices.preco_foil || 0).toFixed(2).replace('.', ','),
        (prices.preco_min || 0).toFixed(2).replace('.', ','),
        (prices.preco_medio || 0).toFixed(2).replace('.', ','),
        (prices.preco_max || 0).toFixed(2).replace('.', ','),
        totalCard.toFixed(2).replace('.', ','),
        escape(c.card_link),
        addedAt,
      ].join(',')
    })

    const csv = [header, ...rows].join('\n')
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