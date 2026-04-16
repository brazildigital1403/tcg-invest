'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAppModal } from '@/components/ui/useAppModal'
import { criarNotificacao } from '@/lib/notificacoes'

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'

interface Props {
  card: any
  userId: string
  role: 'comprador' | 'vendedor'
  onClose: () => void
}

export default function AvaliacaoModal({ card, userId, role, onClose }: Props) {
  const { showAlert } = useAppModal()
  const [estrelas, setEstrelas] = useState(0)
  const [hover, setHover]       = useState(0)
  const [comentario, setComentario] = useState('')
  const [loading, setLoading]   = useState(false)

  const avaliado_id = role === 'comprador' ? card.user_id : card.buyer_id
  const nomeAvaliado = role === 'comprador' ? card.seller_name : card.buyer_name

  async function handleEnviar() {
    if (estrelas === 0) { showAlert('Selecione pelo menos 1 estrela.', 'warning'); return }
    setLoading(true)

    const { error } = await supabase.from('avaliacoes').insert({
      marketplace_id: card.id,
      avaliador_id: userId,
      avaliado_id,
      papel: role,
      estrelas,
      comentario: comentario.trim() || null,
    })

    if (error) {
      showAlert('Você já avaliou essa negociação.', 'warning')
      setLoading(false)
      return
    }

    // Notifica o avaliado
    await criarNotificacao(
      avaliado_id,
      'avaliacao',
      `⭐ Você recebeu uma avaliação!`,
      `${estrelas} estrela${estrelas > 1 ? 's' : ''} pela negociação de "${card.card_name}"${comentario ? `: "${comentario.slice(0, 60)}..."` : '.'}`,
      { marketplace_id: card.id, estrelas }
    )

    showAlert('Avaliação enviada! Obrigado pelo feedback. 🙏', 'success')
    setLoading(false)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 440, padding: '32px 28px', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ fontSize: 36, marginBottom: 8 }}>⭐</p>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>
            Avaliar negociação
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            Como foi sua experiência com <strong style={{ color: '#f0f0f0' }}>{nomeAvaliado || 'o usuário'}</strong>?
          </p>
        </div>

        {/* Carta */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          {card.card_image && <img src={card.card_image} alt={card.card_name} style={{ width: 36, height: 50, objectFit: 'cover', borderRadius: 4 }} />}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600 }}>{card.card_name}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              {role === 'comprador' ? 'Você comprou' : 'Você vendeu'} · R$ {Number(card.price).toFixed(2).replace('.', ',')}
            </p>
          </div>
        </div>

        {/* Estrelas */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setEstrelas(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              style={{ background: 'none', border: 'none', fontSize: 36, cursor: 'pointer', transition: 'transform 0.1s', transform: (hover || estrelas) >= n ? 'scale(1.2)' : 'scale(1)', filter: (hover || estrelas) >= n ? 'none' : 'grayscale(1) opacity(0.3)' }}
            >
              ⭐
            </button>
          ))}
        </div>

        {/* Label da nota */}
        {(hover || estrelas) > 0 && (
          <p style={{ textAlign: 'center', fontSize: 13, color: '#f59e0b', fontWeight: 600, marginBottom: 16 }}>
            {['', 'Muito ruim 😞', 'Ruim 😕', 'Ok 😐', 'Boa 😊', 'Excelente! 🎉'][hover || estrelas]}
          </p>
        )}

        {/* Comentário */}
        <textarea
          value={comentario}
          onChange={e => setComentario(e.target.value)}
          placeholder="Conte como foi a negociação... (opcional)"
          maxLength={200}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#f0f0f0', fontSize: 13, resize: 'vertical', minHeight: 80, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 6 }}
        />
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 20, textAlign: 'right' }}>{comentario.length}/200</p>

        {/* Botões */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', padding: '12px', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Agora não
          </button>
          <button onClick={handleEnviar} disabled={loading || estrelas === 0}
            style={{ flex: 1, background: estrelas > 0 ? BRAND : 'rgba(255,255,255,0.05)', border: 'none', color: estrelas > 0 ? '#000' : 'rgba(255,255,255,0.3)', padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: estrelas > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Enviando...' : 'Enviar avaliação'}
          </button>
        </div>

      </div>
    </div>
  )
}