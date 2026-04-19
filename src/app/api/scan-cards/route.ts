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
            text: `Analise esta foto de cartas Pokémon TCG e identifique TODAS as cartas visíveis.

Para cada carta retorne um JSON com:
- "name": nome completo da carta em português ou inglês como aparecer na carta
- "number": número da carta no formato "XXX/YYY" (ex: "004/165") — se visível
- "set": nome do set/expansão se visível
- "hp": HP da carta se visível

Retorne SOMENTE um array JSON válido, sem texto adicional, sem markdown, sem explicações.
Exemplo: [{"name":"Charmander","number":"004/165","set":"151","hp":"60"},{"name":"Pikachu","number":"025/165","set":"151","hp":"60"}]

Se não identificar nenhuma carta Pokémon, retorne: []`,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // Parse do JSON retornado
  let cards: any[] = []
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    cards = JSON.parse(clean)
    if (!Array.isArray(cards)) cards = []
  } catch {
    cards = []
  }

  return NextResponse.json({ cards, raw: text })
}