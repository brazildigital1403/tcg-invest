'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/ui/AppLayout'
import { supabase } from '@/lib/supabaseClient'

interface MasterSet {
  set_id: string
  nome: string
  series: string
  release_date: string
  preco_centavos: number
  total_cartas: number
  owned_cartas: number
  unlocked: boolean
  via_anual: boolean
}

const GRAD = 'linear-gradient(135deg,#f59e0b,#ef4444)'

function PocketIcon() {
  return (
    <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 3, padding: 8, flexShrink: 0 }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ borderRadius: 2, background: 'rgba(245,158,11,0.5)' }} />
      ))}
    </div>
  )
}

export default function MasterSetsPage() {
  const router = useRouter()
  const [sets, setSets] = useState<MasterSet[]>([])
  const [loading, setLoading] = useState(true)
  const [comprando, setComprando] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [pedido, setPedido] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/master-sets/catalog', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      const json = await res.json()
      setSets(json.sets || [])
    } catch {
      setSets([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const precoFmt = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`

  async function comprar(setId: string) {
    setComprando(setId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { router.push('/'); return }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plano: 'master_set', setId }),
      })
      const json = await res.json()
      if (json.url) { window.location.href = json.url; return }
      if (json.code === 'ALREADY_OWNED' || json.code === 'INCLUDED_ANNUAL') { router.push(`/master-sets/${setId}`); return }
      alert(json.error || 'Nao foi possivel iniciar a compra.')
    } catch {
      alert('Erro ao iniciar a compra.')
    }
    setComprando(null)
  }

  async function assinarAnual() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { router.push('/'); return }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plano: 'anual' }),
      })
      const json = await res.json()
      if (json.url) window.location.href = json.url
      else alert(json.error || 'Nao foi possivel iniciar a assinatura.')
    } catch {
      alert('Erro ao iniciar a assinatura.')
    }
  }

  async function enviarPedido() {
    if (pedido.trim().length < 2) return
    setEnviando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { router.push('/'); return }
      const res = await fetch('/api/master-sets/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ texto: pedido.trim() }),
      })
      if (res.ok) { setEnviado(true); setPedido('') }
      else { const j = await res.json(); alert(j.error || 'Erro ao enviar.') }
    } catch {
      alert('Erro ao enviar pedido.')
    }
    setEnviando(false)
  }

  return (
    <AppLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 80px' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: 0 }}>Master sets</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', margin: '6px 0 0' }}>
            Complete sets inteiros no seu fichario. Imprima a folha e va preenchendo os bolsos.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: '12px 16px', marginBottom: 20 }}>
          <span style={{ fontSize: 14, color: '#fbbf24' }}>O plano anual desbloqueia <strong>todos</strong> os master sets.</span>
          <button onClick={assinarAnual} style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24', background: 'transparent', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}>Ver plano anual</button>
        </div>

        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 60 }}>Carregando...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
            {sets.map((s) => {
              const pct = s.total_cartas > 0 ? Math.round((s.owned_cartas / s.total_cartas) * 100) : 0
              return (
                <div key={s.set_id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                    <PocketIcon />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nome}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{s.total_cartas} cartas</div>
                    </div>
                  </div>

                  {s.owned_cartas > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                        <span>Sua colecao</span><span style={{ color: '#fff' }}>{s.owned_cartas}/{s.total_cartas}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 100, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#22c55e' }} />
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    {s.unlocked ? (
                      <>
                        <span style={{ fontSize: 11, fontWeight: 600, color: s.via_anual ? '#fbbf24' : '#22c55e', background: s.via_anual ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)', padding: '3px 8px', borderRadius: 8 }}>
                          {s.via_anual ? 'Incluso no anual' : 'Desbloqueado'}
                        </span>
                        <button onClick={() => router.push(`/master-sets/${s.set_id}`)} style={{ fontSize: 12, fontWeight: 600, color: '#000', background: GRAD, border: 'none', borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}>Imprimir</button>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{precoFmt(s.preco_centavos)}</span>
                        <button onClick={() => comprar(s.set_id)} disabled={comprando === s.set_id} style={{ fontSize: 12, fontWeight: 600, color: '#000', background: GRAD, border: 'none', borderRadius: 10, padding: '8px 14px', cursor: comprando === s.set_id ? 'wait' : 'pointer', opacity: comprando === s.set_id ? 0.6 : 1 }}>
                          {comprando === s.set_id ? '...' : 'Desbloquear'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 18, border: '1px dashed rgba(255,255,255,0.18)', borderRadius: 16, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Nao achou o set que quer?</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Sets antigos, japoneses ou especiais. Nos avise e a gente prioriza.</div>
          </div>
          <button onClick={() => { setModalOpen(true); setEnviado(false) }} style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: '9px 16px', cursor: 'pointer' }}>Pedir um master set</button>
        </div>
      </div>

      {modalOpen && (
        <div onClick={() => setModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: '#101319', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 22 }}>
            {enviado ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Pedido recebido!</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 18 }}>Obrigado. A gente avalia e prioriza os mais pedidos.</div>
                <button onClick={() => setModalOpen(false)} style={{ fontSize: 14, fontWeight: 600, color: '#000', background: GRAD, border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer' }}>Fechar</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Pedir um master set</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 14 }}>Qual set voce quer ver aqui? (nome, lingua, edicao)</div>
                <textarea value={pedido} onChange={(e) => setPedido(e.target.value)} maxLength={500} rows={4} placeholder="Ex.: Evolving Skies em japones, Base Set 1999..." style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 12, color: '#fff', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                  <button onClick={() => setModalOpen(false)} style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: '9px 16px', cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={enviarPedido} disabled={enviando || pedido.trim().length < 2} style={{ fontSize: 13, fontWeight: 600, color: '#000', background: GRAD, border: 'none', borderRadius: 10, padding: '9px 18px', cursor: enviando ? 'wait' : 'pointer', opacity: (enviando || pedido.trim().length < 2) ? 0.5 : 1 }}>{enviando ? 'Enviando...' : 'Enviar pedido'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  )
}
