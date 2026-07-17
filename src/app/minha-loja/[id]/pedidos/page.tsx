'use client'

import { use as usePromise, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { useAppModal } from '@/components/ui/useAppModal'
import { useLojaOwner, LojaEstadoFallback, SH } from '../_shared'
import { fmtBRL } from '@/lib/comissao'

/**
 * /minha-loja/[id]/pedidos — o painel onde o lojista despacha as vendas.
 *
 * E pra ca que os emails de venda linkam. Sem essa tela, o lojista recebe o
 * dinheiro e nao tem onde marcar o envio (e o comprador fica no escuro).
 */

interface Pedido {
  id: string
  numero: number
  status: string
  item_nome: string
  item_imagem: string | null
  valor_item_cents: number
  frete_cents: number
  liquido_loja_cents: number
  total_comprador_cents: number
  metodo: string
  repasse_prazo: number
  endereco: Record<string, string | null> | null
  rastreio: string | null
  created_at: string
  pago_em: string | null
  enviado_em: string | null
}

const LABEL: Record<string, string> = {
  pago: 'A enviar', enviado: 'Enviado', entregue: 'Entregue',
  cancelado: 'Cancelado', reembolsado: 'Reembolsado',
}

export default function LojaPedidosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lojaId } = usePromise(params)
  const { estado, loja } = useLojaOwner(lojaId)
  const { showAlert } = useAppModal()

  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [resumo, setResumo] = useState<{ a_enviar: number; enviados: number; total: number; faturado_cents: number } | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [rastreios, setRastreios] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState<string | null>(null)

  const token = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const t = await token()
      const r = await fetch(`/api/lojas/${lojaId}/pedidos`, { headers: { Authorization: `Bearer ${t}` } })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Falha ao carregar')
      setPedidos(j.pedidos || [])
      setResumo(j.resumo || null)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }, [lojaId, token])

  useEffect(() => { if (estado === 'pronto') carregar() }, [estado, carregar])

  async function marcarEnviado(p: Pedido) {
    setEnviando(p.id)
    try {
      const t = await token()
      const r = await fetch(`/api/lojas/${lojaId}/pedidos`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: p.id, acao: 'enviar', rastreio: rastreios[p.id] || null }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Falha ao enviar')
      showAlert('Pedido marcado como enviado. O comprador já foi avisado!', 'success')
      setAberto(null)
      await carregar()
    } catch (e) {
      showAlert((e as Error).message, 'error')
    } finally {
      setEnviando(null)
    }
  }

  if (estado !== 'pronto' || !loja) return <LojaEstadoFallback estado={estado} />

  return (
    <div style={SH.page}>
      <header style={SH.head}>
        <h1 style={SH.title}>Pedidos</h1>
        <p style={SH.subtitle}>Vendas feitas na sua vitrine da Bynx.</p>
      </header>

      {erro && <div style={S.erro}>{erro}</div>}

      {resumo && resumo.total > 0 && (
        <div style={S.kpis}>
          <div style={S.kpi}><div style={{ ...S.kv, color: resumo.a_enviar > 0 ? '#f59e0b' : '#f0f0f0' }}>{resumo.a_enviar}</div><div style={S.kl}>A enviar</div></div>
          <div style={S.kpi}><div style={S.kv}>{resumo.enviados}</div><div style={S.kl}>Enviados</div></div>
          <div style={S.kpi}><div style={{ ...S.kv, color: '#22c55e', fontSize: 19 }}>{fmtBRL(resumo.faturado_cents)}</div><div style={S.kl}>Seu faturamento</div></div>
        </div>
      )}

      {carregando ? (
        <div style={{ ...SH.card, textAlign: 'center', color: 'rgba(255,255,255,0.45)' }}>Carregando…</div>
      ) : pedidos.length === 0 ? (
        <div style={{ ...SH.card, textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ fontSize: 34 }}>📦</div>
          <h2 style={S.h2}>Nenhuma venda ainda</h2>
          <p style={S.txt}>Quando alguém comprar na sua vitrine, o pedido aparece aqui com o endereço de entrega e o quanto você vai receber.</p>
        </div>
      ) : (
        pedidos.map(p => {
          const end = p.endereco
          const aEnviar = p.status === 'pago'
          const abertoAgora = aberto === p.id
          return (
            <div key={p.id} style={{ ...SH.card, marginBottom: 12, ...(aEnviar ? S.destaque : {}) }}>
              <div style={S.top}>
                <span style={S.num}>#{p.numero}</span>
                <span style={{ ...S.pill, ...(aEnviar ? S.pillWait : p.status === 'enviado' || p.status === 'entregue' ? S.pillOk : S.pillOff) }}>
                  {LABEL[p.status] || p.status}
                </span>
              </div>

              <div style={S.item}>
                <div style={S.thumb}>
                  {p.item_imagem
                    ? <Image src={p.item_imagem} alt={p.item_nome} width={44} height={60} style={{ objectFit: 'contain', borderRadius: 5 }} unoptimized />
                    : <span style={{ fontSize: 18 }}>🎴</span>}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={S.inome}>{p.item_nome}</div>
                  <div style={S.isub}>{p.metodo === 'pix' ? '⚡ Pix' : '💳 Cartão'} · {new Date(p.created_at).toLocaleDateString('pt-BR')}</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={S.liq}>{fmtBRL(p.liquido_loja_cents)}</div>
                  <div style={S.liqL}>em {p.repasse_prazo} dias</div>
                </div>
              </div>

              {end?.linha1 && (
                <div style={S.end}>
                  <div style={S.endT}>Enviar para</div>
                  <div style={S.endC}>
                    {end.nome && <strong>{end.nome}</strong>}{end.nome && <br />}
                    {end.linha1}{end.linha2 ? `, ${end.linha2}` : ''}<br />
                    {[end.cidade, end.estado].filter(Boolean).join(' · ')} {end.cep ? `· ${end.cep}` : ''}
                    {end.telefone && <><br />📞 {end.telefone}</>}
                  </div>
                </div>
              )}

              {p.rastreio && (
                <div style={S.rast}>Rastreio: <strong style={{ letterSpacing: '0.04em' }}>{p.rastreio}</strong></div>
              )}

              {aEnviar && (
                abertoAgora ? (
                  <div style={S.form}>
                    <input
                      value={rastreios[p.id] || ''}
                      onChange={e => setRastreios(r => ({ ...r, [p.id]: e.target.value }))}
                      placeholder="Código de rastreio (opcional)"
                      style={S.input}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => marcarEnviado(p)} disabled={enviando === p.id} style={{ ...SH.btnPrimary, flex: 1, opacity: enviando === p.id ? 0.6 : 1 }}>
                        {enviando === p.id ? 'Salvando…' : 'Confirmar envio'}
                      </button>
                      <button onClick={() => setAberto(null)} style={{ ...S.btnGhost }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAberto(p.id)} style={{ ...SH.btnPrimary, width: '100%', marginTop: 12 }}>
                    Marcar como enviado
                  </button>
                )
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 },
  kpi: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '13px 8px', textAlign: 'center', minWidth: 0 },
  kv: { fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  kl: { fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
  destaque: { borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.02)' },
  top: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  num: { fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.5)' },
  pill: { fontSize: 10, fontWeight: 800, padding: '4px 9px', borderRadius: 20 },
  pillOk: { background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' },
  pillWait: { background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' },
  pillOff: { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' },
  item: { display: 'flex', gap: 11, alignItems: 'center' },
  thumb: { width: 44, height: 60, borderRadius: 5, background: 'linear-gradient(135deg,#1a1030,#0f1628)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  inome: { fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 },
  isub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  liq: { fontSize: 15, fontWeight: 800, color: '#22c55e', whiteSpace: 'nowrap' },
  liqL: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 },
  end: { marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' },
  endT: { fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  endC: { fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginTop: 5 },
  rast: { marginTop: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 9, padding: '8px 11px', fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  form: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, padding: '10px 12px', fontSize: 13, color: '#f0f0f0', outline: 'none' },
  btnGhost: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '10px 16px', fontSize: 13, cursor: 'pointer' },
  h2: { fontSize: 16, fontWeight: 800, margin: '10px 0 6px' },
  txt: { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, maxWidth: 380, margin: '0 auto' },
  erro: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
}
