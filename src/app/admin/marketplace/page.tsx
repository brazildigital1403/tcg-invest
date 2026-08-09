'use client'

import { useEffect, useState } from 'react'
import { useAppModal } from '@/components/ui/useAppModal'
import { IconCard, IconSearch, IconLink, IconTrash, IconHistory, IconChevronDown, IconArrowUp, IconArrowDown } from '@/components/ui/Icons'

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
const STATUS_ORDEM = ['disponivel', 'reservado', 'enviado', 'concluido', 'cancelado']

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

const PAGE_SIZE = 50
const RESERVADO_ANTIGO_MS = 3 * 24 * 60 * 60 * 1000

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
  const [statusFiltro, setStatusFiltro] = useState<string>('todos')
  const [anuncios, setAnuncios] = useState<Anuncio[] | null>(null)
  const [loading, setLoading] = useState(true)
  // Sem isso, clique duplo em Remover/Restaurar (rede lenta) disparava duas
  // requisicoes -- achado de auditoria 04/08/2026.
  const [busyId, setBusyId] = useState<string | null>(null)
  const [erro, setErro] = useState(false)
  const [sortKey, setSortKey] = useState<'data' | 'preco'>('data')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  async function load() {
    setLoading(true)
    setErro(false)
    try {
      const p = new URLSearchParams()
      p.set('view', view)
      if (busca.trim()) p.set('q', busca.trim())
      const res = await fetch(`/api/admin/marketplace?${p}`)
      if (!res.ok) {
        setAnuncios([])
        setErro(true)
        showAlert('Erro ao carregar anúncios. Tenta recarregar.', 'error')
        return
      }
      const d = await res.json()
      setAnuncios(d.anuncios || [])
    } catch {
      setAnuncios([])
      setErro(true)
      showAlert('Erro de rede ao carregar anúncios.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [view])
  useEffect(() => { setPage(1) }, [view, busca, statusFiltro])
  useEffect(() => { setStatusFiltro('todos') }, [view])

  async function handleRemover(card: Anuncio) {
    const motivo = await showPrompt({
      message: `Por que remover o anúncio "${card.card_name}"?`,
      placeholder: 'Ex: Conteúdo inadequado, preço fraudulento, spam, denúncia confirmada...',
      multiline: true,
    })
    if (!motivo || !motivo.trim()) return

    setBusyId(card.id)
    try {
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
    } finally {
      setBusyId(null)
    }
  }

  async function handleRestaurar(card: Anuncio) {
    const ok = await showConfirm({
      message: `Restaurar o anúncio "${card.card_name}"? Ele voltará a aparecer publicamente.`,
      confirmLabel: 'Sim, restaurar',
    })
    if (!ok) return

    setBusyId(card.id)
    try {
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
    } finally {
      setBusyId(null)
    }
  }

  function toggleSort(key: 'data' | 'preco') {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  // Contagem por status -- sempre sobre o lote inteiro carregado (nao sobre o
  // filtrado), pra servir de orientacao estavel mesmo com busca/filtro ativos.
  const statusCounts: Record<string, number> = {}
  for (const a of anuncios || []) {
    const k = a.status || 'disponivel'
    statusCounts[k] = (statusCounts[k] || 0) + 1
  }

  const filtrados = (anuncios || []).filter(a => {
    if (statusFiltro !== 'todos' && (a.status || 'disponivel') !== statusFiltro) return false
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return (
      a.card_name?.toLowerCase().includes(q) ||
      a.seller_email?.toLowerCase().includes(q) ||
      a.seller_name?.toLowerCase().includes(q)
    )
  })

  const ordenados = [...filtrados].sort((a, b) => {
    const mult = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'preco') return (a.price - b.price) * mult
    return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * mult
  })

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / PAGE_SIZE))
  const paginaAtual = Math.min(page, totalPaginas)
  const visiveis = ordenados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE)

  function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
    if (!active) return <span style={{ opacity: 0.3, fontSize: 9, marginLeft: 3 }}>↕</span>
    const Icon = dir === 'asc' ? IconArrowUp : IconArrowDown
    return <Icon size={9} color="var(--ac-1)" style={{ display: 'inline-block', marginLeft: 3, verticalAlign: 'middle' }} />
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        .mkt-row { transition: background 0.12s ease; }
        .mkt-row:hover { background: rgba(255,255,255,0.03); }
        .mkt-row:hover .mkt-acoes, .mkt-row:focus-within .mkt-acoes { opacity: 1 !important; }
        .mkt-th-sort { cursor: pointer; user-select: none; }
        .mkt-th-sort:hover { color: rgba(255,255,255,0.7) !important; }
        @media (max-width: 900px) {
          .mkt-col-vendedor, .mkt-col-status { display: none !important; }
        }
      `}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: '#f0f0f0' }}>
          Marketplace
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          Moderação de anúncios. Remoção é soft-delete e pode ser revertida.
        </p>
      </div>

      {/* ── KPIs por status (só faz sentido dentro de Ativos -- Removidos nao
          tem variedade de status relevante) ── */}
      {view === 'ativos' && !loading && !erro && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button
            onClick={() => setStatusFiltro('todos')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10,
              background: statusFiltro === 'todos' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${statusFiltro === 'todos' ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: statusFiltro === 'todos' ? '#f59e0b' : 'rgba(255,255,255,0.55)' }}>Todos</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: statusFiltro === 'todos' ? '#f59e0b' : '#f0f0f0' }}>{anuncios?.length ?? 0}</span>
          </button>
          {STATUS_ORDEM.filter(k => statusCounts[k] > 0).map(k => {
            const st = STATUS_VENDA[k]
            const active = statusFiltro === k
            return (
              <button
                key={k}
                onClick={() => setStatusFiltro(active ? 'todos' : k)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10,
                  background: active ? `${st.color}1A` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? `${st.color}59` : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: active ? st.color : 'rgba(255,255,255,0.55)' }}>{st.label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: active ? st.color : '#f0f0f0' }}>{statusCounts[k]}</span>
              </button>
            )
          })}
        </div>
      )}

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
              onClick={() => setView(t.key as 'ativos' | 'removidos')}
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

        <div style={{
          flex: 1, minWidth: 220, marginLeft: 'auto',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 100,
          padding: '7px 14px',
        }}>
          <IconSearch size={13} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0 }} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por carta, vendedor (nome ou email)..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#f0f0f0', fontSize: 13, fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Carregando...</p>
      ) : erro ? (
        <div style={{
          background: 'rgba(239,68,68,0.06)',
          border: '1px dashed rgba(239,68,68,0.3)',
          borderRadius: 14, padding: '40px 20px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: '#ef4444', margin: '0 0 12px' }}>Não deu pra carregar os anúncios.</p>
          <button onClick={load} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', fontWeight: 700, fontSize: 12, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>Tentar de novo</button>
        </div>
      ) : ordenados.length === 0 ? (
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
        <>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: 64 }} />
                  <th style={thStyle}>Carta</th>
                  <th className="mkt-th-sort" onClick={() => toggleSort('preco')} style={{ ...thStyle, textAlign: 'right', cursor: 'pointer' }}>
                    Preço<SortIcon active={sortKey === 'preco'} dir={sortDir} />
                  </th>
                  <th className="mkt-col-status" style={thStyle}>Status</th>
                  <th className="mkt-col-vendedor" style={thStyle}>Vendedor</th>
                  <th className="mkt-th-sort" onClick={() => toggleSort('data')} style={{ ...thStyle, textAlign: 'right', cursor: 'pointer' }}>
                    Anunciado<SortIcon active={sortKey === 'data'} dir={sortDir} />
                  </th>
                  <th style={{ width: 84 }} />
                </tr>
              </thead>
              <tbody>
                {visiveis.map(card => {
                  const st = STATUS_VENDA[card.status || 'disponivel'] || STATUS_VENDA.disponivel
                  const removido = !!card.removido_em
                  const isExpanded = expandedId === card.id
                  // reservado_em nao existe no schema -- created_at e o melhor
                  // proxy disponivel hoje pra sinalizar "reserva parada ha
                  // muito tempo" (proposta de agente, achado 04/08/2026).
                  const reservadoAntigo = card.status === 'reservado' &&
                    (Date.now() - new Date(card.created_at).getTime()) > RESERVADO_ANTIGO_MS

                  return (
                    <>
                      <tr
                        key={card.id}
                        className="mkt-row"
                        style={{
                          borderTop: '1px solid rgba(255,255,255,0.06)',
                          boxShadow: reservadoAntigo ? 'inset 3px 0 0 #f59e0b' : undefined,
                        }}
                      >
                        <td style={{ padding: '8px 10px 8px 14px' }}>
                          <div style={{
                            width: 56, height: 78, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                            background: 'rgba(255,255,255,0.04)', position: 'relative',
                          }}>
                            {card.card_image ? (
                              <img
                                src={card.card_image}
                                alt={card.card_name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                onError={e => {
                                  const img = e.currentTarget
                                  img.style.display = 'none'
                                  const fallback = img.nextElementSibling as HTMLElement | null
                                  if (fallback) fallback.style.display = 'flex'
                                }}
                              />
                            ) : null}
                            <div style={{
                              position: 'absolute', inset: 0, display: card.card_image ? 'none' : 'flex',
                              alignItems: 'center', justifyContent: 'center',
                            }}>
                              <IconCard size={20} color="rgba(255,255,255,0.3)" />
                            </div>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : card.id)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <IconChevronDown size={11} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                              {card.card_name}
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 4, marginLeft: 17 }}>
                            <span style={badgeStyle()}>{VARIANTE_LBL[card.variante || 'normal'] || card.variante}</span>
                            <span style={badgeStyle()}>{card.condicao || 'NM'}</span>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: '#f0f0f0', whiteSpace: 'nowrap' }}>
                          {fmt(card.price)}
                        </td>
                        <td className="mkt-col-status" style={tdStyle}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 100,
                            background: `${st.color}1A`, color: st.color, whiteSpace: 'nowrap',
                          }}>
                            {st.label}{reservadoAntigo && ' · parado'}
                          </span>
                        </td>
                        <td className="mkt-col-vendedor" style={{ ...tdStyle, maxWidth: 180 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {card.seller_name || '—'}
                          </p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {card.seller_city || '—'}
                          </p>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                          {relativeTime(card.created_at)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <div className="mkt-acoes" style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', opacity: busyId === card.id ? 1 : 0, transition: 'opacity 0.12s' }}>
                            {card.card_id && (
                              <a
                                href={`/carta/${card.card_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Ver no Pokédex"
                                style={iconBtnStyle('#60a5fa', 'rgba(96,165,250,0.3)')}
                              >
                                <IconLink size={12} color="#60a5fa" />
                              </a>
                            )}
                            {removido ? (
                              <button
                                onClick={() => handleRestaurar(card)}
                                disabled={busyId === card.id}
                                title="Restaurar"
                                style={{ ...iconBtnStyle('#22c55e', 'rgba(34,197,94,0.3)'), cursor: busyId === card.id ? 'not-allowed' : 'pointer', opacity: busyId === card.id ? 0.5 : 1 }}
                              >
                                <IconHistory size={12} color="#22c55e" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRemover(card)}
                                disabled={busyId === card.id}
                                title="Remover"
                                style={{ ...iconBtnStyle('#ef4444', 'rgba(239,68,68,0.3)'), cursor: busyId === card.id ? 'not-allowed' : 'pointer', opacity: busyId === card.id ? 0.5 : 1 }}
                              >
                                <IconTrash size={12} color="#ef4444" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${card.id}-expand`} style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <td colSpan={7} style={{ padding: '12px 20px 16px 84px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, fontSize: 12 }}>
                              <div>
                                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Descrição</p>
                                <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 }}>{card.descricao || 'Sem descrição.'}</p>
                              </div>
                              <div>
                                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Vendedor</p>
                                <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 }}>{card.seller_email || '—'}</p>
                              </div>
                              {removido && (
                                <div>
                                  <p style={{ fontSize: 10, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                                    Removido há {relativeTime(card.removido_em!)}{card.removido_por_nome && ` por ${card.removido_por_nome}`}
                                  </p>
                                  <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 }}>
                                    <strong style={{ color: 'rgba(255,255,255,0.4)' }}>Motivo:</strong> {card.removido_motivo || '—'}
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={paginaAtual === 1}
                style={pagerBtnStyle(paginaAtual === 1)}
              >
                ← Anterior
              </button>
              Página {paginaAtual} de {totalPaginas} · {ordenados.length} anúncios
              <button
                onClick={() => setPage(p => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual === totalPaginas}
                style={pagerBtnStyle(paginaAtual === totalPaginas)}
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
  color: 'rgba(255,255,255,0.4)', padding: '11px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.02)', whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 12px', verticalAlign: 'middle', fontSize: 12.5,
}

function badgeStyle(): React.CSSProperties {
  return { fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }
}

function iconBtnStyle(color: string, border: string): React.CSSProperties {
  return {
    width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${border}`, background: 'rgba(255,255,255,0.03)', flexShrink: 0, textDecoration: 'none',
    fontFamily: 'inherit',
  }
}

function pagerBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)', color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
    fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
  }
}
