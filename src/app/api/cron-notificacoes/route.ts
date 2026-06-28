import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

const VARIACAO_MINIMA = 10 // % mínimo para notificar

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  try {
    // --- Watchlist (Fase 1): alerta de variacao para cartas acompanhadas ---
    let wlNotifs = 0
    const { data: watch } = await supabase
      .from('watchlist')
      .select('user_id, card_id')

    if (watch && watch.length > 0) {
      const cardIds = [...new Set(watch.map((w: any) => w.card_id))]

      const { data: cardsAtuais } = await supabase
        .from('pokemon_cards')
        .select('id, name, preco_medio')
        .in('id', cardIds)
      const atualById: Record<string, { name: string; preco: number }> = {}
      for (const c of cardsAtuais || []) {
        atualById[(c as any).id] = { name: (c as any).name, preco: Number((c as any).preco_medio) || 0 }
      }

      const desde = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10)
      const { data: snaps } = await supabase
        .from('price_snapshots')
        .select('card_id, preco_medio, snapshot_date')
        .in('card_id', cardIds)
        .gte('snapshot_date', desde)
        .order('snapshot_date', { ascending: true })
      const baseById: Record<string, number> = {}
      for (const sn of snaps || []) {
        if (baseById[(sn as any).card_id] === undefined) baseById[(sn as any).card_id] = Number((sn as any).preco_medio) || 0
      }

      const cleanNome = (raw: string) =>
        (raw || '')
          .replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
          .replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()
      const fmtBRL = (v: number) => v.toFixed(2).replace('.', ',')
      const hoje = new Date().toISOString().slice(0, 10)

      for (const cardId of cardIds) {
        const atual = atualById[cardId]
        const base = baseById[cardId]
        if (!atual || !atual.preco || !base || base === 0) continue
        const variacao = ((atual.preco - base) / base) * 100
        if (Math.abs(variacao) < VARIACAO_MINIMA) continue

        const subiu = variacao > 0
        const nome = cleanNome(atual.name)
        const watchers = watch.filter((w: any) => w.card_id === cardId)

        for (const w of watchers) {
          const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', (w as any).user_id)
            .eq('data->>card_id', cardId)
            .gte('created_at', hoje)
            .limit(1)
          if (existing && existing.length > 0) continue

          await supabase.from('notifications').insert({
            user_id: (w as any).user_id,
            type: subiu ? 'valorizacao' : 'desvalorizacao',
            title: subiu
              ? `▲ ${nome} valorizou ${variacao.toFixed(1)}%`
              : `▼ ${nome} desvalorizou ${Math.abs(variacao).toFixed(1)}%`,
            message: `Acompanhando: R$ ${fmtBRL(base)} → R$ ${fmtBRL(atual.preco)}`,
            data: { card_id: cardId, preco_anterior: base, preco_atual: atual.preco, variacao: variacao.toFixed(1), origem: 'watchlist' },
            read: false,
          })
          wlNotifs++
        }
      }
    }

    return NextResponse.json({ message: 'Notificações geradas', notificacoes: wlNotifs, watchlist: wlNotifs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}