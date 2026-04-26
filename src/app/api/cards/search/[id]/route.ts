import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data, error } = await supabase
    .from('pokemon_cards')
    .select('*')
    .eq('id', id)
    .limit(1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.[0]) return NextResponse.json({ error: 'Carta não encontrada' }, { status: 404 })

  return NextResponse.json({ card: data[0] })
}