import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

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

  // Recebe imagem base64
  const { image, mediaType } = await req.json()
  if (!image) return NextResponse.json({ error: 'Imagem não recebida' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType || 'image/jpeg',
              data: image,
            },
          },
          {
            type: 'text',
            text: `You are a Pokémon TCG card recognition system. Analyze this image and identify ALL visible Pokémon TCG cards.

IMPORTANT: Respond with ONLY a raw JSON array. No markdown, no code blocks, no explanations, no text before or after.

For each card return an object with:
- "name": card name as shown (Portuguese or English)
- "number": card number like "004/165" if visible, otherwise null
- "set": set/expansion name if visible, otherwise null
- "hp": HP number if visible, otherwise null

Example output:
[{"name":"Charmander","number":"004/165","set":"151","hp":"60"},{"name":"Pikachu","number":"025/165","set":"151","hp":"60"}]

If no Pokémon TCG cards are visible, respond with exactly: []

Start your response with [ and end with ]`,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // Parse do JSON retornado — tenta múltiplas estratégias
  let cards: any[] = []
  try {
    // 1. Remove markdown code blocks
    let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

    // 2. Extrai só o array JSON se houver texto antes/depois
    const arrayMatch = clean.match(/\[[\s\S]*\]/)
    if (arrayMatch) clean = arrayMatch[0]

    // 3. Parse
    const parsed = JSON.parse(clean)
    cards = Array.isArray(parsed) ? parsed : []
  } catch {
    // 4. Fallback: extrai objetos individuais
    try {
      const objMatches = [...text.matchAll(/\{[^{}]+\}/g)]
      for (const m of objMatches) {
        try { cards.push(JSON.parse(m[0])) } catch { /* ignora */ }
      }
    } catch { cards = [] }
  }

  console.log('[scan-cards] raw response:', text.slice(0, 200))
  console.log('[scan-cards] cards found:', cards.length)
  return NextResponse.json({ cards, raw: text })
}