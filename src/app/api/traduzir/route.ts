import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { textos, cardId } = await req.json()

    if (!textos || textos.length === 0) {
      return NextResponse.json({ erro: 'sem textos' }, { status: 400 })
    }

    // 1. Verifica cache no Supabase
    if (cardId) {
      const { data: cached } = await supabase
        .from('card_attacks_pt')
        .select('traducoes')
        .eq('card_id', cardId)
        .single()

      if (cached?.traducoes) {
        console.log('[traduzir] cache hit:', cardId)
        return NextResponse.json(cached.traducoes)
      }
    }

    // 2. Verifica se tem API key
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[traduzir] ANTHROPIC_API_KEY não configurada')
      return NextResponse.json({ erro: 'sem api key' }, { status: 500 })
    }

    console.log('[traduzir] chamando Claude para:', cardId)

    // 3. Traduz com Claude Haiku
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Traduza esses textos de ataques de cartas Pokémon do inglês para o português brasileiro. Retorne APENAS um JSON válido com os textos originais como chaves e as traduções como valores. Sem explicações, sem markdown, apenas o JSON.\n\n${JSON.stringify(textos)}`
        }]
      })
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[traduzir] erro Claude:', res.status, err)
      return NextResponse.json({ erro: err }, { status: 500 })
    }

    const data = await res.json()
    const texto = data.content?.[0]?.text || '{}'
    console.log('[traduzir] resposta Claude:', texto.slice(0, 100))

    let mapa: Record<string, string> = {}
    try {
      mapa = JSON.parse(texto.replace(/```json|```/g, '').trim())
    } catch (e) {
      console.error('[traduzir] erro parse JSON:', e)
      return NextResponse.json({})
    }

    // 4. Salva no cache
    if (cardId && Object.keys(mapa).length > 0) {
      await supabase
        .from('card_attacks_pt')
        .upsert({ card_id: cardId, traducoes: mapa }, { onConflict: 'card_id' })
      console.log('[traduzir] cache salvo:', cardId)
    }

    return NextResponse.json(mapa)

  } catch (e: any) {
    console.error('[traduzir] erro geral:', e.message)
    return NextResponse.json({})
  }
}