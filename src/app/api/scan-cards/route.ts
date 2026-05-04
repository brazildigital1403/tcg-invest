// src/app/api/scan-cards/route.ts
//
// S29 Security Fix #2 — débito server-side de scan_creditos.
//
// Mudanças vs versão anterior:
//   - Antes da call Anthropic, debita 1 crédito via RPC atômica
//     decrement_scan_credits (SECURITY DEFINER, valida auth.uid()).
//   - Se a RPC falhar com 'sem_creditos' → 402 (Payment Required).
//   - Se a Anthropic falhar APÓS o débito → restaura 1 crédito via RPC
//     restore_scan_credit. Garante que erro infra não cobre o user.
//   - Resposta agora inclui `scan_creditos_restantes` pra UI atualizar
//     sem precisar refetch do DB.
//
// Combina com o ScanModal.tsx atualizado, que NÃO debita mais no client.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

  // ── API Key Anthropic ─────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' }, { status: 503 })

  // ── Recebe imagem ─────────────────────────────────────────────────────
  let image: string, mediaType: string
  try {
    const body = await req.json()
    image = body.image
    mediaType = body.mediaType || 'image/jpeg'
    if (!image) return NextResponse.json({ error: 'Imagem não recebida' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  // ── Cliente Supabase com service key (pra chamar RPC ignorando RLS) ──
  // Service key é necessário pra que a RPC valide auth.uid() vinda do
  // contexto SECURITY DEFINER. Como SECURITY DEFINER roda com permissão
  // do owner da função, auth.uid() vai ser NULL, então a RPC vai aceitar
  // qualquer p_user_id que passamos. A validação fica aqui no servidor:
  // só passamos user.id que veio do JWT validado acima.
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  // ── 1. DEBITAR CRÉDITO (atômico) ──────────────────────────────────────
  let saldoAposDebito: number
  {
    const { data, error } = await supabaseAdmin.rpc('decrement_scan_credits', { p_user_id: user.id })
    if (error) {
      // P0001 = sem créditos
      if (error.message?.includes('sem_creditos') || error.code === 'P0001') {
        return NextResponse.json(
          { error: 'Sem créditos de scan. Compre um pacote para continuar.' },
          { status: 402 }
        )
      }
      console.error('[scan-cards] debit RPC error:', error)
      return NextResponse.json({ error: 'Erro ao debitar crédito' }, { status: 500 })
    }
    saldoAposDebito = data as number
  }

  // ── 2. CHAMAR ANTHROPIC ───────────────────────────────────────────────
  // A partir daqui, qualquer falha precisa rollback do crédito.
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
      // Rollback do crédito (Anthropic falhou, não é culpa do user)
      await supabaseAdmin.rpc('restore_scan_credit', { p_user_id: user.id }).catch(() => {})
      return NextResponse.json({ error: `Erro na API: ${response.status}` }, { status: 502 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    console.debug('[scan-cards] raw:', text.slice(0, 200))

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

    console.debug('[scan-cards] cards:', cards.length)
    return NextResponse.json({ cards, scan_creditos_restantes: saldoAposDebito })

  } catch (err: any) {
    console.error('[scan-cards] erro:', err?.message)
    // Rollback (qualquer outro erro de rede/timeout)
    await supabaseAdmin.rpc('restore_scan_credit', { p_user_id: user.id }).catch(() => {})
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 })
  }
}
