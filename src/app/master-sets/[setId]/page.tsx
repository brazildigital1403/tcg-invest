'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppLayout from '@/components/ui/AppLayout'
import { supabase } from '@/lib/supabaseClient'

interface Detail {
  set_id: string
  nome: string
  series: string
  total_cartas: number
  total_paginas: number
  owned_cartas: number
  unlocked: boolean
  via_anual: boolean
  preco_centavos: number
}
interface Card {
  card_id: string
  numero: string
  nome: string
  image_small: string | null
  owned: boolean
}

const GRAD = 'linear-gradient(135deg,#f59e0b,#ef4444)'

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

export default function MasterSetSheetPage() {
  const router = useRouter()
  const params = useParams()
  const setId = (params?.setId as string) || ''

  const [detail, setDetail] = useState<Detail | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [locked, setLocked] = useState(true)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [soFalta, setSoFalta] = useState(false)
  const [modo, setModo] = useState<'imagem' | 'economia'>('imagem')
  const [comprando, setComprando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const fetchSheet = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/master-sets/${setId}/sheet`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (res.status === 404) { setErro('Master set nao encontrado.'); setLoading(false); return false }
      const json = await res.json()
      setDetail(json.detail || null)
      setCards(json.cards || [])
      setLocked(!!json.locked)
      setLoading(false)
      return !!json.locked
    } catch {
      setErro('Erro ao carregar a folha.')
      setLoading(false)
      return false
    }
  }, [setId])

  useEffect(() => {
    let veioDoStripe = false
    if (typeof window !== 'undefined' && window.location.search.includes('desbloqueado=1')) {
      veioDoStripe = true
      setSucesso(true)
    }
    ;(async () => {
      const stillLocked = await fetchSheet()
      if (veioDoStripe && stillLocked) {
        setTimeout(() => { fetchSheet() }, 2500)
      }
    })()
  }, [fetchSheet])

  useEffect(() => {
    const handler = () => {
      document.querySelectorAll('.ms-pocket img').forEach((img: any) => {
        if (!img.complete) { const s = img.src; img.src = ''; img.src = s }
      })
    }
    window.addEventListener('beforeprint', handler)
    return () => window.removeEventListener('beforeprint', handler)
  }, [])

  const filtered = useMemo(() => (soFalta ? cards.filter(c => !c.owned) : cards), [cards, soFalta])
  const pages = useMemo(() => chunk(filtered, 9), [filtered])

  const precoFmt = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`

  async function comprar() {
    setComprando(true)
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
      if (json.code === 'ALREADY_OWNED' || json.code === 'INCLUDED_ANNUAL') { fetchSheet(); setComprando(false); return }
      alert(json.error || 'Nao foi possivel iniciar a compra.')
    } catch {
      alert('Erro ao iniciar a compra.')
    }
    setComprando(false)
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

  const pct = detail && detail.total_cartas > 0 ? Math.round((detail.owned_cartas / detail.total_cartas) * 100) : 0

  return (
    <AppLayout>
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .ms-print-page {
            display: grid !important;
            grid-template-columns: repeat(3, 63mm) !important;
            grid-template-rows: repeat(3, 88mm) !important;
            justify-content: center !important;
            align-content: center !important;
            gap: 2mm !important;
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            border: none !important;
            border-radius: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .ms-print-page:last-child { page-break-after: auto !important; break-after: auto !important; }
          .ms-pocket {
            width: 63mm !important;
            height: 88mm !important;
            aspect-ratio: auto !important;
            box-shadow: none !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .ms-bynx { width: 5mm !important; height: 5mm !important; }
          .print-blocked * { display: none !important; }
          .print-blocked::before {
            display: block !important;
            content: 'Desbloqueie este master set em bynx.gg para imprimir a folha completa.';
            font-size: 14pt; text-align: center; margin-top: 120mm; color: #000;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px 80px' }}>

        <button onClick={() => router.push('/master-sets')} className="no-print" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 14 }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Voltar aos master sets
        </button>

        {loading ? (
          <div className="no-print" style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 60 }}>Carregando...</div>
        ) : erro ? (
          <div className="no-print" style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: 60 }}>{erro}</div>
        ) : detail && (
          <>
            {sucesso && (
              <div className="no-print" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 12, padding: '12px 16px', marginBottom: 18, color: '#22c55e', fontSize: 14 }}>
                <strong>Master set desbloqueado!</strong> Ja pode imprimir a folha completa.
              </div>
            )}

            <div className="no-print" style={{ marginBottom: 18 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>{detail.nome}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{detail.total_cartas} cartas · {detail.total_paginas} paginas</span>
                {detail.owned_cartas > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', background: 'rgba(34,197,94,0.12)', padding: '2px 8px', borderRadius: 8 }}>
                    voce tem {detail.owned_cartas}/{detail.total_cartas} ({pct}%)
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                {!locked && (
                  <>
                    <button onClick={() => setSoFalta(v => !v)} style={{ fontSize: 13, fontWeight: 600, color: soFalta ? '#000' : '#fff', background: soFalta ? GRAD : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}>
                      So o que falta
                    </button>
                    <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, overflow: 'hidden' }}>
                      <button onClick={() => setModo('imagem')} style={{ fontSize: 12, fontWeight: 600, color: modo === 'imagem' ? '#000' : 'rgba(255,255,255,0.6)', background: modo === 'imagem' ? GRAD : 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer' }}>Imagem</button>
                      <button onClick={() => setModo('economia')} style={{ fontSize: 12, fontWeight: 600, color: modo === 'economia' ? '#000' : 'rgba(255,255,255,0.6)', background: modo === 'economia' ? GRAD : 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer' }}>Economia de tinta</button>
                    </div>
                    <button onClick={() => window.print()} style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#000', background: GRAD, border: 'none', borderRadius: 10, padding: '9px 18px', cursor: 'pointer' }}>Imprimir</button>
                  </>
                )}
              </div>
            </div>

            {locked && (
              <div className="no-print" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 22, marginBottom: 22 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Pagina 1 liberada como amostra.</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 16 }}>Desbloqueie pra imprimir as {detail.total_paginas} paginas completas, com a sua colecao ja marcada.</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={comprar} disabled={comprando} style={{ fontSize: 14, fontWeight: 700, color: '#000', background: GRAD, border: 'none', borderRadius: 10, padding: '11px 20px', cursor: comprando ? 'wait' : 'pointer', opacity: comprando ? 0.6 : 1 }}>
                    {comprando ? '...' : `Desbloquear por ${precoFmt(detail.preco_centavos)}`}
                  </button>
                  <button onClick={assinarAnual} style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24', background: 'transparent', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 10, padding: '11px 18px', cursor: 'pointer' }}>
                    Ou libere todos no plano anual
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 12 }}>Compra unica, vitalicia. O plano anual inclui todos os master sets enquanto estiver ativo.</div>
              </div>
            )}

            <div className={locked ? 'print-blocked' : undefined}>
              {pages.map((page, pi) => (
                <div key={pi} className="ms-print-page" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: 16, marginBottom: 18, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
                  {page.map((c) => <MSPocket key={c.card_id} card={c} modo={modo} />)}
                </div>
              ))}
              {pages.length === 0 && (
                <div className="no-print" style={{ textAlign: 'center', padding: 50, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
                  {soFalta ? 'Voce ja tem todas as cartas deste set!' : 'Nenhuma carta encontrada.'}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

function MSPocket({ card, modo }: { card: Card; modo: 'imagem' | 'economia' }) {
  const [imgErr, setImgErr] = useState(false)
  const owned = card.owned
  const mostraImg = modo === 'imagem' && !!card.image_small && !imgErr

  return (
    <div className="ms-pocket" style={{ position: 'relative', background: '#fff', border: owned ? '1.5px solid #639922' : '1.5px dashed #c9c7bf', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', aspectRatio: '63 / 88' }}>
      <div style={{ position: 'absolute', top: '4%', left: '5%', fontSize: 'min(2.4vw,11px)', fontWeight: 800, color: '#2c2c2a', zIndex: 2, lineHeight: 1 }}>{card.numero}</div>

      <div className="ms-bynx" style={{ position: 'absolute', top: '3%', right: '4%', width: 'min(4vw,18px)', height: 'min(4vw,18px)', borderRadius: '50%', overflow: 'hidden', zIndex: 3 }}>
        <img src="/bynx_perfil.png" alt="" onError={(e: any) => { e.currentTarget.src = '/favicon.png' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      {owned && (
        <div style={{ position: 'absolute', top: '4%', left: '50%', transform: 'translateX(-50%)', zIndex: 4, width: 'min(4.5vw,20px)', height: 'min(4.5vw,20px)', borderRadius: '50%', background: '#639922', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="62%" height="62%" viewBox="0 0 20 20" fill="none"><path d="M5 10l3.5 3.5L15 6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      )}

      {mostraImg ? (
        <img src={card.image_small as string} alt={card.nome} onError={() => setImgErr(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: owned ? 0.35 : 0.9, padding: '16% 6% 20%' }} />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20% 8%', opacity: owned ? 0.4 : 0.85 }}>
          <span style={{ fontSize: 'min(8vw,34px)', fontWeight: 800, color: '#b4b2a9', lineHeight: 1 }}>{card.numero}</span>
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4% 6%', fontSize: 'min(2.2vw,10px)', fontWeight: 600, color: '#2c2c2a', textAlign: 'center', background: 'rgba(255,255,255,0.88)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.nome}</div>
    </div>
  )
}
