import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  // Verifica autenticação
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

  const body = await req.json()
  const { card_name, card_number, card_image, link, rarity, variantes } = body

  if (!card_name) return NextResponse.json({ error: 'Nome da carta não informado' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const v = variantes || {}
  const normal = v.normal || {}
  const foil = v.foil || {}
  const promo = v.promo || {}

  // Salva preços no banco
  await Promise.all([
    supabaseAdmin.from('card_prices').upsert({
      card_name,
      preco_min: normal.min || 0,
      preco_medio: normal.medio || 0,
      preco_max: normal.max || 0,
      preco_normal: normal.medio || 0,
      preco_foil: foil.medio || 0,
      preco_foil_min: foil.min || null,
      preco_foil_medio: foil.medio || null,
      preco_foil_max: foil.max || null,
      preco_promo_min: promo.min || null,
      preco_promo_medio: promo.medio || null,
      preco_promo_max: promo.max || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'card_name' }),
    supabaseAdmin.from('card_price_history').insert({
      card_name,
      preco_min: normal.min || null,
      preco_medio: normal.medio || null,
      preco_max: normal.max || null,
      preco_normal: normal.medio || null,
      preco_foil: foil.medio || null,
      recorded_at: new Date().toISOString(),
    })
  ])

  return NextResponse.json({
    card_name,
    card_number,
    card_image,
    link,
    rarity,
    preco_min: normal.min || null,
    preco_medio: normal.medio || null,
    preco_max: normal.max || null,
    preco_normal: normal.medio || null,
    preco_foil: foil.medio || null,
    variantes,
  })
}