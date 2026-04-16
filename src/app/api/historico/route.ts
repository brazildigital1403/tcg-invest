import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  // ✅ Verificação de autenticação
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

  if (authError || !user) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const cardName = searchParams.get('name')

  if (!cardName) {
    return NextResponse.json({ message: 'OK - sem nome (rota chamada sem parâmetro)' })
  }

  // ✅ Busca histórico real da tabela card_price_history
  const { data, error } = await supabase
    .from('card_price_history')
    .select('*')
    .ilike('card_name', `%${cardName}%`)
    .order('recorded_at', { ascending: true })

  if (error) {
    console.error('SUPABASE ERROR:', error)
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 })
  }

  const history = data.map(item => ({
    date: item.recorded_at,
    normal: item.preco_normal,
    foil: item.preco_foil,
    preco_min: item.preco_min,
    preco_medio: item.preco_medio,
    preco_max: item.preco_max,
  }))

  return NextResponse.json({
    name: cardName,
    history,
    total: history.length,
    source: 'card_price_history',
  })
}