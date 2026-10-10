'use client'

/**
 * src/components/ui/WatchButton.tsx
 *
 * Botão "Acompanhar preço" (watchlist Fase 1).
 * - Deslogado → abre o CADASTRO (nao o login: quem chega numa pagina publica
 *   quase nunca tem conta; "Bem-vindo de volta" pra visitante novo era um
 *   dos vazamentos medidos em 08/10) e guarda a intencao, aplicada no
 *   retorno com sessao.
 * - Logado → insere/remove a carta da tabela `watchlist` (RLS owner-only).
 * Dois estados: "Acompanhar preço" (ghost) e "Acompanhando" (ativo).
 * O alerta de variação (10%) é disparado pelo cron-notificacoes.
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { IconBell, IconCheck } from '@/components/ui/Icons'
import { gravarIntencao, lerIntencao, limparIntencao } from '@/lib/intencao'

export default function WatchButton({
  cardId,
  full = false,
  label,
  cta = 'watch:acompanhar',
}: {
  cardId: string
  full?: boolean
  /** Copy do estado inativo. Padrao: "Acompanhar preço". */
  label?: string
  /** Rotulo do botao na atribuicao do cadastro (ver gravarCta). */
  cta?: string
}) {
  const { openSignup } = useAuthModal()
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
        let tem = !!row
        // Intencao deixada antes do cadastro: aplica agora e limpa.
        const pendente = lerIntencao()
        if (!tem && pendente?.tipo === 'watch' && pendente.cardId === cardId) {
          const { error } = await supabase.from('watchlist').insert({ user_id: uid, card_id: cardId })
          if (!error || error.code === '23505') tem = true
        }
        if (pendente?.tipo === 'watch' && pendente.cardId === cardId) limparIntencao()
        if (active) setWatching(tem)
      }
      if (active) setReady(true)
    })
    return () => {
      active = false
    }
  }, [cardId])

  async function toggle() {
    if (!userId) {
      const next = typeof window !== 'undefined' ? window.location.pathname : null
      gravarIntencao({ tipo: 'watch', cardId, slug: next || '' })
      openSignup({ next, cta })
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
    minHeight: 44,
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
      {!ready ? (label || 'Acompanhar preço') : watching ? 'Acompanhando' : (label || 'Acompanhar preço')}
    </button>
  )
}
