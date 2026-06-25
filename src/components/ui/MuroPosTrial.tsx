'use client'

import { useState, useEffect } from 'react'

// Muro pos-trial (semi-bloqueante). Aparece pra usuario FREE que terminou os 7 dias
// de Pro e ficou acima do limite free de cartas. Loss-framing ancorado no que ele ja
// construiu. Tem saida discreta ("continuar limitado") com soneca de 24h.
// O gatilho (quem ve) e decidido no AppLayout; aqui so cuida de exibir + snooze.

const SNOOZE_KEY = 'bynx_muro_postrial_snooze'
const SNOOZE_MS = 24 * 60 * 60 * 1000

export default function MuroPosTrial({ cardCount }: { cardCount: number }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let until = 0
    try { until = parseInt(localStorage.getItem(SNOOZE_KEY) || '0', 10) || 0 } catch { until = 0 }
    if (Date.now() >= until) setShow(true)
  }, [])

  useEffect(() => {
    if (!show) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [show])

  if (!show) return null

  const adiar = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)) } catch {}
    setShow(false)
  }

  const feats = [
    'Coleção completa, sempre acessível',
    'Valor de cada carta em reais',
    'Pokédex completa e Dashboard',
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      background: 'rgba(5,6,10,0.72)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: '#0d0f14',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28,
        boxShadow: '0 30px 80px rgba(0,0,0,0.7)', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
      }}>
        <div style={{
          width: 54, height: 54, borderRadius: '50%',
          background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M4 7l8-4 8 4v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7z" stroke="#f59e0b" strokeWidth="1.6" strokeLinejoin="round"/>
          </svg>
        </div>

        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 12 }}>
          Seus 7 dias de Pro acabaram
        </div>
        <div style={{ fontSize: 23, fontWeight: 800, lineHeight: 1.2, marginBottom: 8, letterSpacing: '-0.01em', color: '#f5f5f5' }}>
          Você guardou {cardCount} cartas na Bynx
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.55, marginBottom: 16 }}>
          Não perca o controle da sua coleção. Continue com tudo desbloqueado e o valor em reais sempre na sua mão.
        </div>

        {feats.map((f) => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, color: 'rgba(255,255,255,0.82)', marginBottom: 9 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(245,158,11,0.14)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>✓</span>
            {f}
          </div>
        ))}

        <div style={{ textAlign: 'center', margin: '20px 0 18px' }}>
          <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '6px 12px', borderRadius: 100 }}>
            A partir de 14,90/mês no Plus
          </span>
        </div>

        <a href="/minha-conta" style={{
          display: 'block', width: '100%', textAlign: 'center', boxSizing: 'border-box',
          background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#000',
          fontWeight: 800, fontSize: 15, borderRadius: 12, padding: 14, textDecoration: 'none',
        }}>
          Desbloquear tudo →
        </a>
        <button onClick={adiar} style={{
          display: 'block', width: '100%', textAlign: 'center',
          background: 'transparent', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 13,
          border: 'none', padding: 12, cursor: 'pointer', marginTop: 4, fontFamily: 'inherit',
        }}>
          Continuar limitado a 100 cartas
        </button>
      </div>
    </div>
  )
}
