import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

  // API Key
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' }, { status: 503 })

  // Recebe imagem
  let image: string, mediaType: string
  try {
    const body = await req.json()
    image = body.image
    mediaType = body.mediaType || 'image/jpeg'
    if (!image) return NextResponse.json({ error: 'Imagem não recebida' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  // Chama API Anthropic via fetch (sem SDK)
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: image,
                },
              },
              {
                type: 'text',
                text: `You are a Pokémon TCG card recognition system. Analyze this image and identify ALL visible Pokémon TCG cards.

IMPORTANT: Respond with ONLY a raw JSON array. No markdown, no code blocks, no explanations.

For each card return an object with:
- "name": card name as shown (Portuguese or English)
- "number": card number like "004/165" if visible, otherwise null
- "set": set/expansion name if visible, otherwise null
- "hp": HP number if visible, otherwise null

If no Pokémon TCG cards are visible, respond with exactly: []

Start your response with [ and end with ]`,
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(50000),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[scan-cards] Anthropic error:', response.status, errText)
      return NextResponse.json({ error: `Erro na API: ${response.status}` }, { status: 502 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    console.log('[scan-cards] raw:', text.slice(0, 200))

    // Parse robusto
    let cards: any[] = []
    try {
      let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const arrayMatch = clean.match(/\[[\s\S]*\]/)
      if (arrayMatch) clean = arrayMatch[0]
      const parsed = JSON.parse(clean)
      cards = Array.isArray(parsed) ? parsed : []
    } catch {
      try {
        const objMatches = [...text.matchAll(/\{[^{}]+\}/g)]
        for (const m of objMatches) {
          try { cards.push(JSON.parse(m[0])) } catch { /* ignora */ }
        }
      } catch { cards = [] }
    }

    console.log('[scan-cards] cards:', cards.length)
    return NextResponse.json({ cards })

  } catch (err: any) {
    console.error('[scan-cards] erro:', err?.message)
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 })
  }
}