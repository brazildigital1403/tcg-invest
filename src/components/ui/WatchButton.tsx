'use client'

/**
 * src/components/ui/WatchButton.tsx
 *
 * Botão "Acompanhar preço" (watchlist Fase 1).
 * - Deslogado → abre o modal de login.
 * - Logado → insere/remove a carta da tabela `watchlist` (RLS owner-only).
 * Dois estados: "Acompanhar preço" (ghost) e "Acompanhando" (ativo).
 * O alerta de variação (10%) é disparado pelo cron-notificacoes.
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { IconBell, IconCheck } from '@/components/ui/Icons'

export default function WatchButton({ cardId, full = false }: { cardId: string; full?: boolean }) {
  const { openLogin } = useAuthModal()
  const [userId, setUserId] = useState<string | null>(null)
  const [watching, setWatching] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null
      if (!active) return
      setUserId(uid)
      if (uid) {
        const { data: row } = await supabase
          .from('watchlist')
          .select('id')
          .eq('user_id', uid)
          .eq('card_id', cardId)
          .maybeSingle()
        if (active) setWatching(!!row)
      }
      if (active) setReady(true)
    })
    return () => {
      active = false
    }
  }, [cardId])

  async function toggle() {
    if (!userId) {
      openLogin({ next: typeof window !== 'undefined' ? window.location.pathname : null })
      return
    }
    if (busy) return
    setBusy(true)
    if (watching) {
      await supabase.from('watchlist').delete().eq('user_id', userId).eq('card_id', cardId)
      setWatching(false)
    } else {
      await supabase.from('watchlist').insert({ user_id: userId, card_id: cardId })
      setWatching(true)
    }
    setBusy(false)
  }

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 700,
    padding: '12px 18px',
    borderRadius: 11,
    cursor: busy ? 'default' : 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1,
    width: full ? '100%' : undefined,
    opacity: busy ? 0.7 : 1,
    transition: 'background 0.15s, border-color 0.15s',
  }

  const style: React.CSSProperties = watching
    ? { ...base, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.5)', color: '#f59e0b' }
    : { ...base, background: 'transparent', border: '1px solid rgba(245,158,11,0.5)', color: '#f59e0b' }

  return (
    <button onClick={toggle} disabled={busy} style={style} aria-pressed={watching} title={watching ? 'Deixar de acompanhar' : 'Acompanhar preço desta carta'}>
      {watching ? <IconCheck size={17} color="#f59e0b" /> : <IconBell size={17} color="#f59e0b" />}
      {!ready ? 'Acompanhar preço' : watching ? 'Acompanhando' : 'Acompanhar preço'}
    </button>
  )
}
