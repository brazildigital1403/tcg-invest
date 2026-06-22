import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

const VARIACAO_MINIMA = 10 // % mínimo para notificar

function getPrecoVariante(price: any, variante: string): number {
  if (!price) return 0
  switch (variante) {
    case 'foil':     return price.preco_foil_medio    || price.preco_medio || 0
    case 'promo':    return price.preco_promo_medio   || price.preco_medio || 0
    case 'reverse':  return price.preco_reverse_medio || price.preco_medio || 0
    case 'pokeball': return price.preco_pokeball_medio || price.preco_medio || 0
    default:         return price.preco_medio || 0
  }
}

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
    // Busca todos os usuários com cartas
    const { data: userCards } = await supabase
      .from('user_cards')
      .select('user_id, card_name, variante')

    if (!userCards || userCards.length === 0) {
      return NextResponse.json({ message: 'Nenhuma carta', notificacoes: 0 })
    }

    // Agrupa por usuário
    const byUser: Record<string, { card_name: string; variante: string }[]> = {}
    for (const uc of userCards) {
      if (!byUser[uc.user_id]) byUser[uc.user_id] = []
      byUser[uc.user_id].push({ card_name: uc.card_name, variante: uc.variante || 'normal' })
    }

    let totalNotifs = 0

    for (const [userId, cards] of Object.entries(byUser)) {
      const cardNames = [...new Set(cards.map(c => c.card_name))]

      // Busca últimos 2 registros de histórico para cada carta
      for (const card of cards) {
        const { data: history } = await supabase
          .from('card_price_history')
          .select('preco_medio, preco_foil, preco_promo_medio, preco_reverse_medio, preco_pokeball_medio, recorded_at')
          .eq('card_name', card.card_name)
          .order('recorded_at', { ascending: false })
          .limit(2)

        if (!history || history.length < 2) continue

        const [atual, anterior] = history

        // Pega preço correto para a variante
        const precoAtual = card.variante === 'foil' ? (atual.preco_foil || atual.preco_medio || 0)
          : card.variante === 'promo' ? (atual.preco_promo_medio || atual.preco_medio || 0)
          : card.variante === 'reverse' ? (atual.preco_reverse_medio || atual.preco_medio || 0)
          : card.variante === 'pokeball' ? (atual.preco_pokeball_medio || atual.preco_medio || 0)
          : (atual.preco_medio || 0)

        const precoAnterior = card.variante === 'foil' ? (anterior.preco_foil || anterior.preco_medio || 0)
          : card.variante === 'promo' ? (anterior.preco_promo_medio || anterior.preco_medio || 0)
          : card.variante === 'reverse' ? (anterior.preco_reverse_medio || anterior.preco_medio || 0)
          : card.variante === 'pokeball' ? (anterior.preco_pokeball_medio || anterior.preco_medio || 0)
          : (anterior.preco_medio || 0)

        if (!precoAtual || !precoAnterior || precoAnterior === 0) continue

        const variacao = ((precoAtual - precoAnterior) / precoAnterior) * 100
        if (Math.abs(variacao) < VARIACAO_MINIMA) continue

        const fmt = (v: number) => v.toFixed(2).replace('.', ',')
        const subiu = variacao > 0

        const variantLabel: Record<string, string> = {
          normal: 'Normal', foil: 'Foil', promo: 'Promo',
          reverse: 'Reverse Foil', pokeball: 'Pokeball Foil'
        }
        const vLabel = variantLabel[card.variante] || 'Normal'

        // Evita duplicata — verifica se já notificou essa carta hoje
        const today = new Date().toISOString().slice(0, 10)
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', userId)
          .like('data->>card_name', card.card_name)
          .gte('created_at', today)
          .limit(1)

        if (existing && existing.length > 0) continue

        // Cria notificação
        await supabase.from('notifications').insert({
          user_id: userId,
          type: subiu ? 'valorizacao' : 'desvalorizacao',
          title: subiu
            ? `▲ ${card.card_name} valorizou ${variacao.toFixed(1)}%`
            : `▼ ${card.card_name} desvalorizou ${Math.abs(variacao).toFixed(1)}%`,
          message: `${vLabel}: R$ ${fmt(precoAnterior)} → R$ ${fmt(precoAtual)}`,
          data: {
            card_name: card.card_name,
            variante: card.variante,
            preco_anterior: precoAnterior,
            preco_atual: precoAtual,
            variacao: variacao.toFixed(1),
          },
          read: false,
        })

        totalNotifs++
      }
    }

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

    return NextResponse.json({ message: 'Notificações geradas', notificacoes: totalNotifs, watchlist: wlNotifs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}