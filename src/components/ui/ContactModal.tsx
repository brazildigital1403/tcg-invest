'use client'

/**
 * Modal global "Fale conosco" — extraído da landing para uso em qualquer página.
 *
 * Renderização: sempre via ContactModalProvider (não importar direto em páginas).
 * Pra abrir o modal de qualquer lugar:
 *
 *   const { openContactModal } = useContactModal()
 *   <button onClick={openContactModal}>Fale conosco</button>
 */

import { useState } from 'react'

// ─── Categorias ──────────────────────────────────────────────────────────────

const CONTACT_CATEGORIES = [
  { id: 'parceria',   icon: '🤝', label: 'Parceria',                  desc: 'Lojas, distribuidores, organizadores de torneios' },
  { id: 'loja',       icon: '🏪', label: 'Quero minha loja na Bynx',  desc: 'Cadastre sua loja no nosso Guia de Lojas' },
  { id: 'imprensa',   icon: '📣', label: 'Imprensa & Mídia',          desc: 'Canais, podcasts e influencers de Pokémon TCG' },
  { id: 'sugestao',   icon: '💡', label: 'Sugestão de funcionalidade', desc: 'Ideias para melhorar a Bynx' },
  { id: 'duvida',     icon: '❓', label: 'Dúvida geral',              desc: 'Planos, pagamentos, privacidade' },
  { id: 'investidor', icon: '💼', label: 'Investidor',                desc: 'Interesse em investir na Bynx' },
]

interface Props {
  onClose: () => void
}

export default function ContactModal({ onClose }: Props) {
  const [step, setStep]         = useState<'category' | 'form' | 'done'>('category')
  const [category, setCategory] = useState<string>('')
  const [nome, setNome]         = useState('')
  const [email, setEmail]       = useState('')
  const [mensagem, setMensagem] = useState('')
  const [loading, setLoading]   = useState(false)
  const [closing, setClosing]   = useState(false)

  const selectedCat = CONTACT_CATEGORIES.find(c => c.id === category)

  const handleClose = () => {
    setClosing(true)
    setTimeout(onClose, 200)
  }

  async function handleSend() {
    if (!nome.trim() || !email.trim() || !mensagem.trim()) return
    setLoading(true)
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, categoryLabel: selectedCat?.label, nome, email, mensagem }),
      })
      setStep('done')
    } catch {
      // mesmo com erro, mostra sucesso (Resend pode ter recebido)
      setStep('done')
    }
    setLoading(false)
  }

  const S = {
    overlay: {
      position: 'fixed' as const, inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      opacity: closing ? 0 : 1, transition: 'opacity 0.2s ease',
    },
    box: {
      background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 500,
      fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0',
      transform: closing ? 'scale(0.97)' : 'scale(1)', transition: 'transform 0.2s ease',
      maxHeight: '90vh', overflowY: 'auto' as const,
    },
  }

  return (
    <div style={S.overlay} onClick={handleClose}>
      <div style={S.box} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>✦ Fale conosco</p>
            <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
              {step === 'done' ? 'Mensagem enviada!' : step === 'form' ? selectedCat?.label : 'Como podemos ajudar?'}
            </h2>
          </div>
          <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>×</button>
        </div>

        {/* Step 1 — escolha de categoria */}
        {step === 'category' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CONTACT_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setCategory(cat.id); setStep('form') }}
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s', fontFamily: 'inherit' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>{cat.icon}</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', marginBottom: 2 }}>{cat.label}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{cat.desc}</p>
                </div>
                <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.25)', fontSize: 18, flexShrink: 0 }}>›</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — formulário */}
        {step === 'form' && (
          <div>
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>{selectedCat?.icon}</span>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{selectedCat?.desc}</p>
              <button onClick={() => setStep('category')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12, flexShrink: 0, fontFamily: 'inherit' }}>← Trocar</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <input
                type="text" placeholder="Seu nome" value={nome} onChange={e => setNome(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
              <input
                type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
              <textarea
                placeholder="Sua mensagem..." value={mensagem} onChange={e => setMensagem(e.target.value)}
                rows={4}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={loading || !nome.trim() || !email.trim() || !mensagem.trim()}
              style={{ width: '100%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', color: '#000', padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: loading ? 'wait' : 'pointer', opacity: (!nome.trim() || !email.trim() || !mensagem.trim()) ? 0.5 : 1, fontFamily: 'inherit' }}
            >
              {loading ? 'Enviando...' : 'Enviar mensagem →'}
            </button>
          </div>
        )}

        {/* Step 3 — confirmação */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 20px' }}>✓</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>Recebemos sua mensagem!</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28, lineHeight: 1.6 }}>Entraremos em contato em breve pelo e-mail <strong style={{ color: '#f59e0b' }}>{email}</strong>.</p>
            <button onClick={handleClose} style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', color: '#000', padding: '12px 32px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Fechar
            </button>
          </div>
        )}

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Prefere e-mail direto?{' '}
            <a href="mailto:suporte@bynx.gg" style={{ color: '#f59e0b', textDecoration: 'none' }}>suporte@bynx.gg</a>
          </p>
        </div>

      </div>
    </div>
  )
}
