'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/ui/AppLayout'
import { supabase } from '@/lib/supabaseClient'

interface MasterSet {
  set_id: string
  nome: string
  name_pt: string | null
  series: string
  release_date: string
  preco_centavos: number
  total_cartas: number
  owned_cartas: number
  unlocked: boolean
  via_anual: boolean
  logo_url: string | null
}

const GRAD = 'linear-gradient(135deg,#f59e0b,#ef4444)'

function PocketIcon() {
  return (
    <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 3, padding: 8 }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ borderRadius: 2, background: 'rgba(245,158,11,0.5)' }} />
      ))}
    </div>
  )
}

function SetLogo({ url, nome }: { url: string | null; nome: string }) {
  const [err, setErr] = useState(false)
  if (!url || err) return <PocketIcon />
  return <img src={url} alt={nome} onError={() => setErr(true)} style={{ maxHeight: 48, maxWidth: '85%', objectFit: 'contain' }} />
}

export default function MasterSetsPage() {
  const router = useRouter()
  const [sets, setSets] = useState<MasterSet[]>([])
  const [loading, setLoading] = useState(true)
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
            Complete sets inteiros no seu fichario. Clique num set pra ver a amostra, imprima a folha e va preenchendo os bolsos.
          </p>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.06))', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 16, padding: 'clamp(16px,4vw,28px) clamp(16px,4vw,32px)', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <p style={{ fontSize: 'clamp(15px,4vw,18px)', fontWeight: 800, marginBottom: 6, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" stroke="#f59e0b" strokeWidth="1.4" /><path d="M3 8h14M3 12.5h14M8 3v14M12.5 3v14" stroke="#f59e0b" strokeWidth="1.2" /></svg>
              Plano anual — todos os master sets
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              Libere <strong style={{ color: '#f59e0b' }}>todos os master sets</strong> de uma vez com o plano anual. Ou compre avulso por <strong style={{ color: '#f59e0b' }}>R$9,99 cada</strong>, vitalicio.
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
              ✓ Todos os sets · ✓ Novos sets ja inclusos · ✓ Sua colecao marcada · ✓ Impressao ilimitada
            </p>
          </div>
          <button onClick={assinarAnual} style={{ background: GRAD, border: 'none', borderRadius: 12, padding: '14px 28px', color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer', flexShrink: 0 }}>
            Ver plano anual
          </button>
        </div>

        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 60 }}>Carregando...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
            {sets.map((s) => {
              const pct = s.total_cartas > 0 ? Math.round((s.owned_cartas / s.total_cartas) * 100) : 0
              return (
                <button key={s.set_id} onClick={() => router.push(`/master-sets/${s.set_id}`)} style={{ textAlign: 'left', width: '100%', font: 'inherit', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
                  <div style={{ height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <SetLogo url={s.logo_url} nome={s.nome} />
                  </div>
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name_pt || s.nome}</div>
                    {s.name_pt && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nome}</div>}
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{s.total_cartas} cartas{s.release_date ? ` · ${s.release_date.slice(0, 4)}` : ''}</div>
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
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#000', background: GRAD, borderRadius: 10, padding: '8px 14px' }}>Abrir</span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{precoFmt(s.preco_centavos)}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#000', background: GRAD, borderRadius: 10, padding: '8px 14px' }}>Ver amostra</span>
                      </>
                    )}
                  </div>
                </button>
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
