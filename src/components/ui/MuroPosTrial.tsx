'use client'

// src/components/ui/MuroPosTrial.tsx
// Muro pos-trial (reverse-trial). Bloqueante, mostrado APENAS quando:
//   - usuario logado, NAO pago e NAO em trial ativo (trial expirado/inexistente)
//   - colecao com MAIS de 100 cartas (perda real -> loss framing)
// "Decidir Depois" guarda flag de sessao e cai no Free (cap de 100 ligado na fase de enforcement).
// O muro reaparece no proximo login enquanto a pessoa estiver acima de 100 e sem plano.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getUserPlan } from '@/lib/isPro'

const DISMISS_KEY = 'bynx_muro_postrial_dismissed'

const AMBER = '#f59e0b'
const GRAD = 'linear-gradient(135deg,#f59e0b,#ef4444)'
const T1 = '#f6f7f9'
const T2 = 'rgba(255,255,255,0.56)'
const T3 = 'rgba(255,255,255,0.34)'
const BD = 'rgba(255,255,255,0.08)'
const BD_AMBER = 'rgba(245,158,11,0.45)'
const GREEN = '#34d399'
const RED = '#ef4444'

function Tick({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
      <path d="M5 12l5 5L20 7" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function Cross() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke={RED} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export default function MuroPosTrial() {
  const [show, setShow] = useState(false)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function check() {
      try {
        // Flag de seguranca: muro so liga quando a env estiver '1' (rollout coordenado).
        // Mantem o codigo no ar sem surpreender usuarios antigos antes de copy/legal/email.
        if (process.env.NEXT_PUBLIC_MURO_POSTRIAL_ATIVO !== '1') return
        if (typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1') return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const plan = await getUserPlan(user.id)
        // Pago ou em trial ativo -> nao mostra
        if (plan.isPaid || plan.isTrial) return
        const { count: n } = await supabase
          .from('user_cards')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
        const total = n || 0
        if (total <= 100) return
        if (!alive) return
        setCount(total)
        setShow(true)
      } catch {
        // silencioso: na duvida, nao bloqueia
      }
    }
    check()
    return () => { alive = false }
  }, [])

  async function checkout(plano: 'plus' | 'mensal' | 'anual') {
    setLoading(plano)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { alert('Faça login para continuar'); setLoading(null); return }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plano }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) { alert(data.error || 'Erro ao iniciar checkout. Tente novamente.'); setLoading(null); return }
      window.location.href = data.url
    } catch {
      alert('Erro ao iniciar checkout. Tente novamente.')
      setLoading(null)
    }
  }

  function decidirDepois() {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch {}
    setShow(false)
  }

  if (!show) return null

  const plusIdeal = count <= 500
  const freePct = Math.min(96, Math.max(8, Math.round((100 / count) * 100)))

  const planTitle = (txt: string, amber?: boolean) => (
    <div style={{ fontSize: 13, fontWeight: 800, color: amber ? AMBER : T1, marginBottom: 2 }}>{txt}</div>
  )
  const feat = (color: string, txt: string, cross?: boolean) => (
    <li style={{ fontSize: 11.5, color: T2, display: 'flex', gap: 6, alignItems: 'flex-start', lineHeight: 1.35 }}>
      {cross ? <Cross /> : <Tick color={color} />}{txt}
    </li>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(4,6,10,0.80)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 18px', overflowY: 'auto' }}>
      <style>{`
        .muro-plans{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}
        @media(max-width:560px){.muro-plans{grid-template-columns:1fr}}
      `}</style>

      <div style={{ width: '100%', maxWidth: 620, background: '#0f131c', border: `1px solid ${BD}`, borderRadius: 22, padding: '38px 34px 30px', position: 'relative', overflow: 'hidden', boxShadow: '0 30px 90px rgba(0,0,0,0.6)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: GRAD }} />

        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: AMBER, marginBottom: 20 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: AMBER, boxShadow: `0 0 10px ${AMBER}` }} />
          Seu trial Pro acabou
        </span>

        <p style={{ fontSize: 15, color: T2, margin: '0 0 6px', fontWeight: 500 }}>Sua coleção tem</p>
        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 }}>
          {count}<span style={{ fontSize: 26, fontWeight: 800, WebkitTextFillColor: T1, marginLeft: 6 }}>cartas</span>
        </div>
        <p style={{ fontSize: 14.5, color: T2, lineHeight: 1.55, margin: '14px 0 22px', maxWidth: '46ch' }}>
          No plano <b style={{ color: T1, fontWeight: 700 }}>Grátis</b> você organiza até 100. Suas cartas continuam salvas — mas pra <b style={{ color: T1, fontWeight: 700 }}>seguir adicionando novas</b>, sem precisar apagar nada, escolha um plano.
        </p>

        <div style={{ marginBottom: 28 }}>
          <div style={{ position: 'relative', height: 16, borderRadius: 9, overflow: 'hidden', background: 'rgba(255,255,255,0.07)' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${freePct}%`, background: 'rgba(255,255,255,0.20)' }} />
            <div style={{ position: 'absolute', left: `${freePct}%`, right: 0, top: 0, bottom: 0, background: GRAD }} />
            <div style={{ position: 'absolute', left: `${freePct}%`, top: -6, bottom: -6, width: 2, background: '#fff', opacity: 0.85 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9, fontSize: 11.5, color: T3 }}>
            <span>0</span>
            <span style={{ color: T1, fontWeight: 700 }}>limite Grátis · 100</span>
            <span style={{ color: AMBER, fontWeight: 800 }}>você · {count}</span>
          </div>
        </div>

        <div className="muro-plans">
          {/* Grátis */}
          <div style={{ background: '#12161f', border: `1px solid ${BD}`, borderRadius: 16, padding: '18px 15px 16px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ height: 16 }} />
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', color: T3, lineHeight: 1.1 }}>Grátis</div>
            <div style={{ fontSize: 12, color: T2, margin: '6px 0 12px', fontWeight: 600 }}>até 100 cartas</div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, margin: 0, padding: 0, marginBottom: 14, flex: 1 }}>
              {feat('rgba(255,255,255,0.4)', 'Perfil público')}
              {feat('rgba(255,255,255,0.4)', '3 anúncios')}
              {feat('', 'Sem Dashboard', true)}
            </ul>
            <button onClick={decidirDepois} style={{ border: `1px solid ${BD}`, borderRadius: 11, padding: 11, fontSize: 13, fontWeight: 800, cursor: 'pointer', width: '100%', fontFamily: 'inherit', background: 'transparent', color: T3 }}>Decidir Depois</button>
          </div>

          {/* Plus */}
          <div style={{ background: plusIdeal ? '#171206' : '#12161f', border: `1px solid ${plusIdeal ? BD_AMBER : BD}`, borderRadius: 16, padding: '18px 15px 16px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {plusIdeal && <span style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: GRAD, color: '#1a1205', fontSize: 10, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '4px 11px', borderRadius: 20, whiteSpace: 'nowrap' }}>Ideal pra você</span>}
            <div style={{ height: 16 }} />
            {planTitle('Plus', true)}
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', color: T1, lineHeight: 1.1 }}>14,90<span style={{ fontSize: 12, fontWeight: 600, color: T3 }}>/mês</span></div>
            <div style={{ fontSize: 12, color: T2, margin: '6px 0 12px', fontWeight: 600 }}>até 500 cartas</div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, margin: 0, padding: 0, marginBottom: 14, flex: 1 }}>
              {feat(GREEN, 'Dashboard completo')}
              {feat(GREEN, 'Marketplace ilimitado')}
              {feat(GREEN, 'Pokédex completa + pastas')}
            </ul>
            <button onClick={() => checkout('plus')} disabled={loading === 'plus'} style={{ border: 'none', borderRadius: 11, padding: 11, fontSize: 13, fontWeight: 800, cursor: 'pointer', width: '100%', fontFamily: 'inherit', background: plusIdeal ? GRAD : 'transparent', color: plusIdeal ? '#1a1205' : AMBER, ...(plusIdeal ? {} : { border: `1.5px solid ${BD_AMBER}` }), opacity: loading === 'plus' ? 0.6 : 1 }}>{loading === 'plus' ? '...' : 'Assinar Plus'}</button>
          </div>

          {/* Pro */}
          <div style={{ background: !plusIdeal ? '#171206' : '#12161f', border: `1px solid ${!plusIdeal ? BD_AMBER : BD}`, borderRadius: 16, padding: '18px 15px 16px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {!plusIdeal && <span style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: GRAD, color: '#1a1205', fontSize: 10, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '4px 11px', borderRadius: 20, whiteSpace: 'nowrap' }}>Ideal pra você</span>}
            <div style={{ height: 16 }} />
            {planTitle('Pro', true)}
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', color: T1, lineHeight: 1.1 }}>29,90<span style={{ fontSize: 12, fontWeight: 600, color: T3 }}>/mês</span></div>
            <div style={{ fontSize: 12, color: T2, margin: '6px 0 12px', fontWeight: 600 }}>cartas ilimitadas</div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, margin: 0, padding: 0, marginBottom: 14, flex: 1 }}>
              {feat(AMBER, 'Tudo do Plus')}
              {feat(AMBER, '10 scans IA/mês')}
              {feat(AMBER, 'Separadores + exportar')}
            </ul>
            <button onClick={() => checkout('mensal')} disabled={loading === 'mensal'} style={{ border: 'none', borderRadius: 11, padding: 11, fontSize: 13, fontWeight: 800, cursor: 'pointer', width: '100%', fontFamily: 'inherit', background: !plusIdeal ? GRAD : 'transparent', color: !plusIdeal ? '#1a1205' : AMBER, ...(!plusIdeal ? {} : { border: `1.5px solid ${BD_AMBER}` }), opacity: loading === 'mensal' ? 0.6 : 1 }}>{loading === 'mensal' ? '...' : 'Assinar Pro'}</button>
          </div>
        </div>

        <button onClick={() => checkout('anual')} disabled={loading === 'anual'} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'rgba(245,158,11,0.06)', border: `1px solid ${BD_AMBER}`, borderRadius: 13, padding: '13px 16px', margin: '2px 0 18px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: loading === 'anual' ? 0.6 : 1 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: AMBER }}>Pro Anual · 249/ano<span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T3, marginTop: 2 }}>2 meses grátis · Economize 30% + Todos os Master Sets</span></span>
          <span style={{ fontSize: 12, fontWeight: 700, color: T2, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
            {loading === 'anual' ? '...' : 'Assinar anual'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </button>

        <p style={{ borderTop: `1px solid ${BD}`, paddingTop: 14, fontSize: 12, color: T3, lineHeight: 1.5, textAlign: 'center', margin: 0 }}>
          <b style={{ color: T2, fontWeight: 700 }}>Suas {count} cartas continuam salvas e visíveis</b> mesmo no Grátis.<br />Você só não adiciona novas até assinar. Cancele quando quiser.
        </p>
      </div>
    </div>
  )
}
