'use client'

import { useEffect, useState } from 'react'
import { useAppModal } from '@/components/ui/useAppModal'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Anuncio = {
  id: string
  user_id: string
  card_id: string | null
  card_name: string
  card_image: string | null
  card_link: string | null
  price: number
  variante: string | null
  condicao: string | null
  descricao: string | null
  status: string | null
  buyer_id: string | null
  created_at: string
  removido_em: string | null
  removido_motivo: string | null
  removido_por: string | null
  // hidratado
  seller_email: string | null
  seller_name: string | null
  seller_city: string | null
  removido_por_nome: string | null
}

const STATUS_VENDA: Record<string, { label: string; color: string }> = {
  disponivel: { label: 'Disponível', color: '#22c55e' },
  reservado:  { label: 'Reservado',  color: '#f59e0b' },
  enviado:    { label: 'Enviado',    color: '#a855f7' },
  concluido:  { label: 'Concluído',  color: '#22c55e' },
  cancelado:  { label: 'Cancelado',  color: '#ef4444' },
}

const VARIANTE_LBL: Record<string, string> = {
  normal:  'Normal',
  foil:    'Foil',
  promo:   'Promo',
  reverse: 'Reverse Foil',
  pokeball:'Pokeball',
}

const CONDICAO_LBL: Record<string, string> = {
  NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played',
  HP: 'Heavily Played', D: 'Damaged',
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'agora'
  if (mins  < 60) return `${mins}min`
  if (hours < 24) return `${hours}h`
  if (days  < 7)  return `${days}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function AdminMarketplace() {
  const { showAlert, showConfirm, showPrompt } = useAppModal()
  const [view, setView]       = useState<'ativos' | 'removidos'>('ativos')
  const [busca, setBusca]     = useState('')
  const [anuncios, setAnuncios] = useState<Anuncio[] | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const p = new URLSearchParams()
    p.set('view', view)
    if (busca.trim()) p.set('q', busca.trim())
    const res = await fetch(`/api/admin/marketplace?${p}`)
    setLoading(false)
    if (!res.ok) {
      setAnuncios([])
      showAlert('Erro ao carregar anúncios. Tenta recarregar.', 'error')
      return
    }
    const d = await res.json()
    setAnuncios(d.anuncios || [])
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [view])

  async function handleRemover(card: Anuncio) {
    const motivo = await showPrompt({
      message: `Por que remover o anúncio "${card.card_name}"?`,
      placeholder: 'Ex: Conteúdo inadequado, preço fraudulento, spam, denúncia confirmada...',
      multiline: true,
    })
    if (!motivo || !motivo.trim()) return

    const res = await fetch('/api/admin/marketplace/moderar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: card.id, action: 'remover', motivo: motivo.trim() }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showAlert(err.error || 'Erro ao remover anúncio.', 'error')
      return
    }
    showAlert('Anúncio removido.', 'success')
    load()
  }

  async function handleRestaurar(card: Anuncio) {
    const ok = await showConfirm({
      message: `Restaurar o anúncio "${card.card_name}"? Ele voltará a aparecer publicamente.`,
      confirmLabel: 'Sim, restaurar',
    })
    if (!ok) return

    const res = await fetch('/api/admin/marketplace/moderar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: card.id, action: 'restaurar' }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showAlert(err.error || 'Erro ao restaurar anúncio.', 'error')
      return
    }
    showAlert('Anúncio restaurado.', 'success')
    load()
  }

  // Filtro de busca local (não precisa nova request)
  const visible = (anuncios || []).filter(a => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return (
      a.card_name?.toLowerCase().includes(q) ||
      a.seller_email?.toLowerCase().includes(q) ||
      a.seller_name?.toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: '#f0f0f0' }}>
          Marketplace
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          Moderação de anúncios. Remoção é soft-delete e pode ser revertida.
        </p>
      </div>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { key: 'ativos',    label: 'Ativos'    },
          { key: 'removidos', label: 'Removidos' },
        ].map(t => {
          const active = view === t.key
          return (
            <button
              key={t.key}
              onClick={() => setView(t.key as any)}
              style={{
                padding: '7px 14px',
                borderRadius: 100,
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: `1px solid ${active ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`,
                background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                color: active ? '#f59e0b' : 'rgba(255,255,255,0.55)',
              }}
            >
              {t.label}
            </button>
          )
        })}

        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por carta, vendedor (nome ou email)..."
          style={{
            flex: 1, minWidth: 220,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 100,
            padding: '7px 14px',
            color: '#f0f0f0', fontSize: 13,
            outline: 'none',
            fontFamily: 'inherit',
            marginLeft: 'auto',
          }}
        />
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Carregando...</p>
      ) : visible.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: 14, padding: '40px 20px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            {view === 'removidos' ? 'Nenhum anúncio removido.' : 'Nenhum anúncio encontrado.'}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 14,
        }}>
          {visible.map(card => {
            const st = STATUS_VENDA[card.status || 'disponivel'] || STATUS_VENDA.disponivel
            const removido = !!card.removido_em

            return (
              <div key={card.id} style={{
                background: removido ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${removido ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 14,
                padding: 14,
                display: 'flex',
                gap: 12,
              }}>
                {/* Foto */}
                <div style={{
                  width: 80, flexShrink: 0,
                  borderRadius: 10, overflow: 'hidden',
                  background: 'rgba(255,255,255,0.04)',
                  alignSelf: 'flex-start',
                }}>
                  {card.card_image ? (
                    <img
                      src={card.card_image}
                      alt={card.card_name}
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: '100%', paddingBottom: '140%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 24 }}>🃏</span>
                    </div>
                  )}
                </div>

                {/* Conteúdo */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>

                  {/* Linha 1: nome + preço */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <p style={{
                      fontSize: 14, fontWeight: 700, color: '#f0f0f0', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {card.card_name}
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b', margin: 0, whiteSpace: 'nowrap' }}>
                      {fmt(card.price)}
                    </p>
                  </div>

                  {/* Linha 2: variante / condição / status venda */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)' }}>
                      {VARIANTE_LBL[card.variante || 'normal'] || card.variante}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)' }}>
                      {card.condicao || 'NM'}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: `${st.color}1A`, color: st.color }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Descrição (se houver) */}
                  {card.descricao && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0', lineHeight: 1.5 }}>
                      {card.descricao}
                    </p>
                  )}

                  {/* Vendedor */}
                  <div style={{ marginTop: 2 }}>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}>Vendedor: </span>
                      {card.seller_name || '—'}
                      {card.seller_email && (
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}> · {card.seller_email}</span>
                      )}
                      {card.seller_city && (
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}> · {card.seller_city}</span>
                      )}
                    </p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>
                      Anunciado há {relativeTime(card.created_at)}
                    </p>
                  </div>

                  {/* Caixa de moderação (se removido) */}
                  {removido && (
                    <div style={{
                      marginTop: 6,
                      padding: '8px 10px',
                      background: 'rgba(239,68,68,0.07)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 8,
                    }}>
                      <p style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, margin: '0 0 4px' }}>
                        Removido há {relativeTime(card.removido_em!)}
                        {card.removido_por_nome && ` por ${card.removido_por_nome}`}
                      </p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.4 }}>
                        <strong style={{ color: 'rgba(255,255,255,0.4)' }}>Motivo:</strong> {card.removido_motivo || '—'}
                      </p>
                    </div>
                  )}

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {card.card_id && (
                      <a
                        href={`/carta/${card.card_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 11, fontWeight: 600,
                          padding: '6px 10px', borderRadius: 8,
                          background: 'rgba(96,165,250,0.08)',
                          border: '1px solid rgba(96,165,250,0.25)',
                          color: '#60a5fa',
                          textDecoration: 'none',
                        }}
                      >
                        Ver no Pokédex ↗
                      </a>
                    )}
                    {removido ? (
                      <button
                        onClick={() => handleRestaurar(card)}
                        style={{
                          fontSize: 11, fontWeight: 700,
                          padding: '6px 10px', borderRadius: 8,
                          background: 'rgba(34,197,94,0.1)',
                          border: '1px solid rgba(34,197,94,0.3)',
                          color: '#22c55e',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Restaurar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRemover(card)}
                        style={{
                          fontSize: 11, fontWeight: 700,
                          padding: '6px 10px', borderRadius: 8,
                          background: 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.3)',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
