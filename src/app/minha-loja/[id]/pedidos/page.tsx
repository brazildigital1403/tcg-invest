'use client'

import { use as usePromise, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { useAppModal } from '@/components/ui/useAppModal'
import { useLojaOwner, LojaEstadoFallback, SH } from '../_shared'
import { fmtBRL } from '@/lib/comissao'
import { IconBox, IconCheck, IconWallet, IconPhone, IconBolt, IconCard, IconPokeball } from '@/components/ui/Icons'

/**
 * /minha-loja/[id]/pedidos — o painel onde o lojista despacha as vendas.
 *
 * E pra ca que os emails de venda linkam. Sem essa tela, o lojista recebe o
 * dinheiro e nao tem onde marcar o envio (e o comprador fica no escuro).
 *
 * LAYOUT (redesign): KPIs no topo (A enviar em destaque = pede acao), e um card
 * por pedido com endereco (+ copiar), o liquido e o prazo de repasse, e as acoes
 * certas por estado — enviar com RASTREIO OBRIGATORIO e cancelar/reembolsar
 * (so antes de enviar). Acento azul->roxo herdado do SH da loja. Zero emoji.
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
  pago: 'A enviar', enviado: 'Em trânsito', entregue: 'Concluído',
  cancelado: 'Cancelado', reembolsado: 'Reembolsado',
}
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function fmtDia(iso: string | null): string {
  if (!iso) return ''
  try { const d = new Date(iso); return `${d.getDate()} ${MES[d.getMonth()]}` } catch { return '' }
}
function enderecoTexto(end: Record<string, string | null>): string {
  const l2 = end.linha2 ? `, ${end.linha2}` : ''
  return [
    end.nome,
    `${end.linha1 || ''}${l2}`,
    [end.cidade, end.estado].filter(Boolean).join(' - '),
    end.cep,
    end.telefone,
  ].filter(Boolean).join('\n')
}

// Caminhao (em transito) e copiar — nao existem no Icons.tsx.
function IcTruck({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2 6h11v9H2V6zM13 9h4l3 3v3h-7V9z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx="6.5" cy="17.5" r="1.7" stroke={color} strokeWidth={1.5} />
      <circle cx="16.5" cy="17.5" r="1.7" stroke={color} strokeWidth={1.5} />
    </svg>
  )
}
function IcCopy({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="7" y="7" width="9" height="9" rx="2" stroke={color} strokeWidth={1.4} />
      <path d="M4 13V5a2 2 0 012-2h6" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  )
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
  const [cancelAberto, setCancelAberto] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [motivos, setMotivos] = useState<Record<string, string>>({})
  const [copiado, setCopiado] = useState<string | null>(null)

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
    const cod = (rastreios[p.id] || '').trim()
    if (cod.length < 8) {
      showAlert('Informe o código de rastreio (mínimo 8 caracteres) para marcar como enviado. O comprador precisa dele para acompanhar a entrega.', 'error')
      return
    }
    setEnviando(p.id)
    try {
      const t = await token()
      const r = await fetch(`/api/lojas/${lojaId}/pedidos`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: p.id, acao: 'enviar', rastreio: cod }),
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

  async function cancelarPedido(p: Pedido) {
    setCancelando(p.id)
    try {
      const t = await token()
      const r = await fetch(`/api/lojas/${lojaId}/pedidos`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: p.id, acao: 'cancelar', motivo: (motivos[p.id] || '').trim() || null }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Falha ao cancelar')
      showAlert('Pedido cancelado e reembolsado. O comprador já foi avisado.', 'success')
      setCancelAberto(null)
      await carregar()
    } catch (e) {
      showAlert((e as Error).message, 'error')
    } finally {
      setCancelando(null)
    }
  }

  function copiarEndereco(p: Pedido) {
    if (!p.endereco) return
    try {
      navigator.clipboard?.writeText(enderecoTexto(p.endereco)).then(() => {
        setCopiado(p.id); setTimeout(() => setCopiado(null), 1500)
      }).catch(() => {})
    } catch { /* noop */ }
  }

  if (estado !== 'pronto' || !loja) return <LojaEstadoFallback estado={estado} />

  const entregues = pedidos.filter(p => p.status === 'entregue').length

  return (
    <div style={SH.page}>
      <header style={SH.head}>
        <h1 style={SH.title}>Pedidos</h1>
        <p style={SH.subtitle}>Vendas feitas na sua vitrine da Bynx. Despache no prazo pra manter sua reputação lá em cima.</p>
      </header>

      {erro && <div style={S.erro}>{erro}</div>}

      {resumo && resumo.total > 0 && (
        <div style={S.kpis}>
          <div style={{ ...S.kpi, ...(resumo.a_enviar > 0 ? S.kpiHot : {}) }}>
            <div style={S.kt}><IconBox size={15} color="#fbbf24" />A enviar</div>
            <div style={{ ...S.kv, color: resumo.a_enviar > 0 ? '#fbbf24' : '#f0f0f0' }}>{resumo.a_enviar}</div>
            <div style={S.ks}>aguardando você despachar</div>
          </div>
          <div style={S.kpi}>
            <div style={S.kt}><IcTruck size={15} color="#a78bfa" />Em trânsito</div>
            <div style={S.kv}>{resumo.enviados}</div>
            <div style={S.ks}>a caminho do comprador</div>
          </div>
          <div style={S.kpi}>
            <div style={S.kt}><IconCheck size={15} color="#4ade80" />Concluídos</div>
            <div style={S.kv}>{entregues}</div>
            <div style={S.ks}>entregues</div>
          </div>
          <div style={S.kpi}>
            <div style={S.kt}><IconWallet size={15} color="#4ade80" />Faturamento</div>
            <div style={{ ...S.kv, color: '#4ade80', fontSize: 20 }}>{fmtBRL(resumo.faturado_cents)}</div>
            <div style={S.ks}>líquido · recebe em até 30 dias</div>
          </div>
        </div>
      )}

      {carregando ? (
        <div style={{ ...SH.card, textAlign: 'center', color: 'rgba(255,255,255,0.45)' }}>Carregando…</div>
      ) : pedidos.length === 0 ? (
        <div style={{ ...SH.card, textAlign: 'center', padding: '32px 20px' }}>
          <div style={S.emptyIco}><IconBox size={30} color="rgba(255,255,255,0.4)" /></div>
          <h2 style={S.h2}>Nenhuma venda ainda</h2>
          <p style={S.txt}>Quando alguém comprar na sua vitrine, o pedido aparece aqui com o endereço de entrega e o quanto você vai receber.</p>
        </div>
      ) : (
        pedidos.map(p => {
          const end = p.endereco
          const aEnviar = p.status === 'pago'
          const abertoAgora = aberto === p.id
          const morto = ['cancelado', 'reembolsado'].includes(p.status)
          const pillStyle = aEnviar ? S.pillEnv
            : p.status === 'enviado' ? S.pillTrans
            : p.status === 'entregue' ? S.pillOk
            : S.pillOff

          return (
            <div key={p.id} style={{ ...SH.card, marginBottom: 13, ...(aEnviar ? S.destaque : {}), ...(morto ? S.opaco : {}) }}>
              {/* cabecalho: item + status */}
              <div style={S.chead}>
                <div style={S.thumb}>
                  {p.item_imagem
                    ? <Image src={p.item_imagem} alt={p.item_nome} width={44} height={60} style={{ objectFit: 'contain', borderRadius: 6 }} unoptimized />
                    : <IconPokeball size={18} color="rgba(255,255,255,0.4)" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.inome}>{p.item_nome}</div>
                  <div style={S.isub}>
                    Pedido #{p.numero} · {p.metodo === 'pix' ? <IconBolt size={11} color="rgba(255,255,255,0.4)" /> : <IconCard size={11} color="rgba(255,255,255,0.4)" />} {p.metodo === 'pix' ? 'Pix' : 'Cartão'} · {fmtDia(p.created_at)}
                  </div>
                </div>
                <span style={{ ...S.pill, ...pillStyle }}>{LABEL[p.status] || p.status}</span>
              </div>

              {/* A ENVIAR: endereco + liquido + acoes */}
              {aEnviar && (
                <>
                  {end?.linha1 && (
                    <div style={S.ship}>
                      <div style={{ minWidth: 0 }}>
                        <div style={S.shipLbl}>ENVIAR PARA</div>
                        <div style={S.shipTo}>
                          {end.nome && <><strong style={{ color: '#f0f0f0', fontWeight: 600 }}>{end.nome}</strong><br /></>}
                          {end.linha1}{end.linha2 ? `, ${end.linha2}` : ''}<br />
                          {[end.cidade, end.estado].filter(Boolean).join(' · ')} {end.cep ? `· ${end.cep}` : ''}
                          {end.telefone && <><br /><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 2 }}><IconPhone size={12} color="rgba(255,255,255,0.5)" />{end.telefone}</span></>}
                        </div>
                        <button onClick={() => copiarEndereco(p)} style={S.copyBtn}>
                          {copiado === p.id ? <IconCheck size={12} color="rgba(255,255,255,0.6)" /> : <IcCopy size={12} color="rgba(255,255,255,0.6)" />}
                          {copiado === p.id ? 'copiado' : 'copiar endereço'}
                        </button>
                      </div>
                      <div style={S.val}>
                        <div style={S.liq}>{fmtBRL(p.liquido_loja_cents)}</div>
                        <div style={S.liqL}>seu líquido · em {p.repasse_prazo} dias</div>
                      </div>
                    </div>
                  )}

                  {abertoAgora ? (
                    <div style={S.form}>
                      <div style={S.formLbl}><IconBox size={14} color="rgba(255,255,255,0.5)" />Código de rastreio <span style={{ color: '#f87171' }}>(obrigatório)</span></div>
                      <input value={rastreios[p.id] || ''} onChange={e => setRastreios(r => ({ ...r, [p.id]: e.target.value }))} placeholder="Cole o código dos Correios / Melhor Envio" style={S.input} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => marcarEnviado(p)} disabled={enviando === p.id || (rastreios[p.id] || '').trim().length < 8} style={{ ...SH.btnPrimary, flex: 1, opacity: (enviando === p.id || (rastreios[p.id] || '').trim().length < 8) ? 0.6 : 1 }}>
                          {enviando === p.id ? 'Salvando…' : 'Confirmar envio'}
                        </button>
                        <button onClick={() => setAberto(null)} style={S.btnGhost}>Voltar</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAberto(p.id)} style={{ ...SH.btnPrimary, width: '100%', marginTop: 12 }}>Marcar como enviado</button>
                  )}

                  {cancelAberto === p.id ? (
                    <div style={S.formCancel}>
                      <div style={S.cancelWarn}>Isso reembolsa o comprador integralmente e não pode ser desfeito.</div>
                      <input value={motivos[p.id] || ''} onChange={e => setMotivos(m => ({ ...m, [p.id]: e.target.value }))} placeholder="Motivo (opcional — o comprador vê)" style={S.input} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => cancelarPedido(p)} disabled={cancelando === p.id} style={{ ...S.btnDanger, flex: 1, opacity: cancelando === p.id ? 0.6 : 1 }}>
                          {cancelando === p.id ? 'Reembolsando…' : 'Confirmar cancelamento'}
                        </button>
                        <button onClick={() => setCancelAberto(null)} style={S.btnGhost}>Voltar</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setCancelAberto(p.id)} style={{ ...S.btnDangerGhost, width: '100%', marginTop: 8 }}>Cancelar e reembolsar</button>
                  )}
                </>
              )}

              {/* EM TRANSITO */}
              {p.status === 'enviado' && (
                <div style={S.note}>
                  <IcTruck size={16} color="#a78bfa" />
                  <span>Enviado{p.enviado_em ? ` em ${fmtDia(p.enviado_em)}` : ''}{p.rastreio ? <> · rastreio <strong style={{ color: '#f0f0f0', fontFamily: 'monospace' }}>{p.rastreio}</strong></> : ''} · aguardando o comprador confirmar o recebimento</span>
                </div>
              )}

              {/* CONCLUIDO */}
              {p.status === 'entregue' && (
                <div style={S.note}>
                  <IconCheck size={16} color="#4ade80" />
                  <span>Entregue e confirmado pelo comprador. Seu líquido de <strong style={{ color: '#4ade80' }}>{fmtBRL(p.liquido_loja_cents)}</strong> cai em até {p.repasse_prazo} dias.</span>
                </div>
              )}

              {/* REEMBOLSADO / CANCELADO */}
              {morto && (
                <div style={S.note}>
                  <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}><IcTruck size={15} color="#f87171" /></span>
                  <span>{p.status === 'reembolsado' ? <>Cancelado e reembolsado · <strong style={{ color: '#f0f0f0' }}>{fmtBRL(p.total_comprador_cents)}</strong> estornado ao comprador.</> : 'Pedido cancelado.'}</span>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  kpis: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  kpi: { flex: '1 1 130px', minWidth: 130, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, background: 'rgba(255,255,255,0.02)', padding: 16 },
  kpiHot: { borderColor: 'rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.05)' },
  kt: { fontSize: 11, color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 6 },
  kv: { fontSize: 26, fontWeight: 800, marginTop: 6, fontVariantNumeric: 'tabular-nums' },
  ks: { fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  destaque: { borderColor: 'rgba(59,130,246,0.3)' },
  opaco: { opacity: 0.8 },
  chead: { display: 'flex', gap: 12, alignItems: 'center' },
  thumb: { width: 44, height: 60, borderRadius: 8, background: 'linear-gradient(160deg,#12203a,#0d1526)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  inome: { fontSize: 15, fontWeight: 600, lineHeight: 1.3 },
  isub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  pill: { fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 },
  pillEnv: { background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' },
  pillTrans: { background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' },
  pillOk: { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' },
  pillOff: { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' },

  ship: { marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  shipLbl: { fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', marginBottom: 5 },
  shipTo: { fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65 },
  copyBtn: { marginTop: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: 'rgba(255,255,255,0.6)', fontSize: 11, padding: '5px 9px', fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 },
  val: { textAlign: 'right', flexShrink: 0 },
  liq: { fontSize: 17, fontWeight: 700, color: '#4ade80', whiteSpace: 'nowrap' },
  liqL: { fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 1 },

  note: { marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 },

  form: { marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 },
  formLbl: { fontSize: 12, color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 6 },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '11px 13px', fontSize: 13, color: '#f0f0f0', outline: 'none', fontFamily: 'inherit' },
  btnGhost: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', borderRadius: 11, padding: '0 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  btnDanger: { background: '#dc2626', border: '1px solid #dc2626', color: '#fff', borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnDangerGhost: { background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 11, padding: '11px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  formCancel: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: 12 },
  cancelWarn: { fontSize: 12, color: '#fca5a5', lineHeight: 1.4 },

  emptyIco: { width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' },
  h2: { fontSize: 16, fontWeight: 800, margin: '10px 0 6px' },
  txt: { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, maxWidth: 380, margin: '0 auto' },
  erro: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
}
