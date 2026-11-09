'use client'

/**
 * Cartao "Marcar as que tenho" da pagina publica /set/[id] (quadro 15).
 *
 * A pagina e server-side e cacheada por 6 h; este pedaco carrega no cliente
 * (como o sino) e nao mexe em cache, revalidate nem SEO. Logado: "Voce tem N
 * de total deste set" e o botao para /minha-colecao/por-set/[id]. Deslogado:
 * o mesmo botao abre o login com `next` apontando para a tela nova. Sem
 * sessao conhecida ainda, renderiza so o espaco reservado (sem salto).
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { IconCheck } from '@/components/ui/Icons'

const ALTURA_MIN = 112

export default function MarcarAsQueTenho({ setId, total }: { setId: string; total: number }) {
  const router = useRouter()
  const { openLogin } = useAuthModal()
  // undefined = ainda nao sabemos; null = deslogado.
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [tenho, setTenho] = useState<number | null>(null)
  const destino = `/minha-colecao/por-set/${setId}`

  useEffect(() => {
    let ativo = true
    const aplicar = (uid: string | null) => { if (!ativo) return; setUserId(uid); if (!uid) setTenho(null) }
    supabase.auth.getSession().then(({ data }) => aplicar(data.session?.user?.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => aplicar(s?.user?.id ?? null))
    return () => { ativo = false; sub.subscription.unsubscribe() }
  }, [])

  // Contagem leve: so as linhas do usuario neste set, contadas por carta
  // distinta no cliente (copia repetida em outra variante nao conta duas vezes).
  useEffect(() => {
    if (!userId) return
    let ativo = true
    supabase.from('user_cards').select('pokemon_api_id').eq('user_id', userId).eq('set_id', setId).eq('graduada', false).limit(2000)
      .then(({ data }) => {
        if (!ativo) return
        const ids = new Set((data || []).map((r: { pokemon_api_id: string | null }) => r.pokemon_api_id).filter(Boolean))
        setTenho(ids.size)
      })
    return () => { ativo = false }
  }, [userId, setId])

  const pct = total > 0 && tenho !== null ? Math.min(100, Math.max(tenho > 0 ? 1 : 0, Math.round((tenho / total) * 100))) : 0
  const completo = total > 0 && tenho !== null && tenho >= total

  const botao: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
    minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
    font: 'inherit', fontSize: 14, fontWeight: 800, background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)',
    textDecoration: 'none', whiteSpace: 'nowrap',
  }

  return (
    <div
      className="bx-marcar-tenho"
      aria-busy={userId === undefined || (userId !== null && tenho === null)}
      style={{ minHeight: ALTURA_MIN, flex: '1 1 260px', maxWidth: 420, boxSizing: 'border-box', borderRadius: 16, border: `1px solid ${userId === undefined ? 'transparent' : 'var(--bx-border)'}`, background: userId === undefined ? 'transparent' : 'var(--bx-surface)', padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, transition: 'background 0.2s ease, border-color 0.2s ease' }}
    >
      {userId === undefined ? null : userId ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: 'var(--bx-text-2)' }}>
              Você tem <b style={{ color: 'var(--bx-text)', fontSize: 16 }}>{tenho === null ? '…' : tenho} de {total}</b> deste set
            </span>
            {completo && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--bx-green)' }}><IconCheck size={14} color="var(--bx-green)" />Completo</span>}
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progresso do set na sua coleção" style={{ height: 6, borderRadius: 99, background: 'var(--bx-surface-2)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: completo ? 'var(--bx-green)' : 'var(--ac-grad)', transition: 'width 0.2s ease' }} />
          </div>
          <button type="button" onClick={() => router.push(destino)} style={botao}>Marcar as que tenho</button>
        </>
      ) : (
        <>
          <span style={{ fontSize: 14, color: 'var(--bx-text-2)', lineHeight: 1.45 }}>Entre para marcar as que você tem e ver quanto falta deste set.</span>
          <button type="button" onClick={() => openLogin({ next: destino })} style={botao}>Marcar as que tenho</button>
        </>
      )}
    </div>
  )
}
