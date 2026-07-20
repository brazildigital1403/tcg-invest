'use client'

import { use as usePromise, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { authFetch } from '@/lib/authFetch'
import { fmtBRL } from '@/lib/comissao'
import { IconCheck, IconBox, IconClock, IconShield, IconArrowRight, IconCard, IconBolt, IconPokeball } from '@/components/ui/Icons'

/**
 * /pedido/[id] — acompanhamento do pedido.
 *
 * E o `success_url` do Stripe Checkout: o comprador cai aqui logo depois de
 * pagar. Le direto do Supabase (a RLS de `pedidos` so libera pro comprador e pro
 * vendedor), entao nao precisa de rota.
 *
 * GOTCHA: ao voltar da Stripe o webhook pode nao ter processado ainda (leva
 * segundos). Por isso, quando cai aqui com ?ok=1 e o status ainda esta
 * 'aguardando_pagamento', a pagina faz alguns re-fetch antes de dar como certo.
 *
 * PoS-VENDA: quando o comprador ve o proprio pedido em 'enviado'/'entregue',
 * aparece o bloco de avaliar a loja (+ botao "Confirmar recebimento" no enviado).
 *
 * LAYOUT (redesign): status hero que se adapta (pago/enviado/entregue) + 2
 * colunas — esquerda "acompanhamento" (timeline vertical + confirmar/avaliar),
 * direita "resumo" (item + valores + endereco). Zero emoji: icones SVG.
 */

declare global {
  interface Window { dataLayer?: Record<string, unknown>[] }
}

interface Pedido {
  id: string
  numero: number
  status: string
  item_nome: string
  item_imagem: string | null
  item_card_id: string | null
  valor_item_cents: number
  frete_cents: number
  acrescimo_cents: number
  total_comprador_cents: number
  metodo: string
  rastreio: string | null
  endereco: Record<string, string | null> | null
  created_at: string
  pago_em: string | null
  enviado_em: string | null
  loja_id: string
  comprador_user_id: string
}

const PASSOS = [
  { k: 'pago', label: 'Pagamento confirmado' },
  { k: 'enviado', label: 'Enviado pela loja' },
  { k: 'entregue', label: 'Entregue' },
]
const ORDEM: Record<string, number> = { aguardando_pagamento: -1, pago: 0, enviado: 1, entregue: 2 }
const LABEL_ESTRELA = ['', 'Muito ruim', 'Ruim', 'Ok', 'Boa', 'Excelente!']
const LABEL: Record<string, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  reembolsado: 'Reembolsado',
}
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function fmtData(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${d.getDate()} ${MES[d.getMonth()]}, ${hh}:${mm}`
  } catch { return '' }
}

// Casa (entregue) e copiar — nao existem no Icons.tsx.
function IcHome({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 9l7-5.5L17 9v7.5a1 1 0 01-1 1h-3v-5H7v5H4a1 1 0 01-1-1V9z" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  )
}
function IcTruck({ size = 26, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2 6h11v9H2V6zM13 9h4l3 3v3h-7V9z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx="6.5" cy="17.5" r="1.7" stroke={color} strokeWidth={1.5} />
      <circle cx="16.5" cy="17.5" r="1.7" stroke={color} strokeWidth={1.5} />
    </svg>
  )
}
function IcCopy({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="7" y="7" width="9" height="9" rx="2" stroke={color} strokeWidth={1.4} />
      <path d="M4 13V5a2 2 0 012-2h6" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  )
}

export default function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const search = useSearchParams()
  const veioDoPagamento = search.get('ok') === '1'

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [tentativas, setTentativas] = useState(0)
  const [semAcesso, setSemAcesso] = useState(false)

  // ─── Pos-venda (avaliacao + recebimento) ──────────────────────────────
  const [meuId, setMeuId] = useState<string | null>(null)
  const [lojaNome, setLojaNome] = useState('')
  const [jaAvaliou, setJaAvaliou] = useState<boolean | null>(null)
  const [estrelas, setEstrelas] = useState(0)
  const [hoverEstrela, setHoverEstrela] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviandoAval, setEnviandoAval] = useState(false)
  const [avalOk, setAvalOk] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const buscar = useCallback(async () => {
    const { data, error } = await supabase.from('pedidos').select('*').eq('id', id).maybeSingle()
    if (error || !data) { setSemAcesso(true); setCarregando(false); return }
    setPedido(data as Pedido)
    setCarregando(false)
    return data as Pedido
  }, [id])

  useEffect(() => { buscar() }, [buscar])

  // Espera o webhook: re-tenta ate 5x (2s) quando acabou de pagar.
  useEffect(() => {
    if (!veioDoPagamento || !pedido || pedido.status !== 'aguardando_pagamento' || tentativas >= 5) return
    const t = setTimeout(async () => { await buscar(); setTentativas(n => n + 1) }, 2000)
    return () => clearTimeout(t)
  }, [veioDoPagamento, pedido, tentativas, buscar])

  // Contexto pos-venda: quem sou eu, nome da loja e se ja avaliei este pedido.
  useEffect(() => {
    if (!pedido) return
    let active = true
    ;(async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (active) setMeuId(auth.user?.id ?? null)

      const { data: lj } = await supabase.from('lojas').select('nome').eq('id', pedido.loja_id).maybeSingle()
      if (active && lj?.nome) setLojaNome(lj.nome)

      const { data: av } = await supabase.from('avaliacoes').select('id').eq('pedido_id', pedido.id).limit(1)
      if (active) setJaAvaliou((av?.length ?? 0) > 0)
    })()
    return () => { active = false }
  }, [pedido])

  // ─── Conversao pro GTM (GA4 + Meta Pixel) ─────────────────────────────
  // UM push alimenta os dois. DEDUP por localStorage: 1 disparo por pedido.
  useEffect(() => {
    if (!pedido) return
    if (pedido.status === 'aguardando_pagamento' || pedido.status === 'cancelado' || pedido.status === 'reembolsado') return

    const chave = `bx_purchase_${pedido.id}`
    try {
      if (localStorage.getItem(chave)) return
      localStorage.setItem(chave, '1')
    } catch {
      return
    }

    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'purchase',
      ecommerce: {
        transaction_id: String(pedido.numero),
        value: pedido.total_comprador_cents / 100,
        shipping: pedido.frete_cents / 100,
        currency: 'BRL',
        items: [
          {
            item_id: pedido.item_card_id || pedido.id,
            item_name: pedido.item_nome,
            price: pedido.valor_item_cents / 100,
            quantity: 1,
          },
        ],
      },
    })
  }, [pedido])

  async function confirmarRecebimento() {
    setConfirmando(true); setErroAcao(null)
    try {
      const r = await authFetch(`/api/pedidos/${id}/receber`, { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || 'Nao consegui confirmar o recebimento.')
      await buscar()
    } catch (e) {
      setErroAcao((e as Error).message)
    } finally {
      setConfirmando(false)
    }
  }

  async function enviarAvaliacao() {
    if (estrelas === 0) { setErroAcao('Selecione pelo menos 1 estrela.'); return }
    setEnviandoAval(true); setErroAcao(null)
    try {
      const r = await authFetch(`/api/pedidos/${id}/avaliar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estrelas, comentario: comentario.trim() || null }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || 'Nao consegui enviar a avaliacao.')
      setAvalOk(true); setJaAvaliou(true)
    } catch (e) {
      setErroAcao((e as Error).message)
    } finally {
      setEnviandoAval(false)
    }
  }

  function copiarRastreio() {
    if (!pedido?.rastreio) return
    try {
      navigator.clipboard?.writeText(pedido.rastreio).then(() => {
        setCopiado(true); setTimeout(() => setCopiado(false), 1500)
      }).catch(() => {})
    } catch { /* noop */ }
  }

  if (carregando) return <Casca><div style={S.vazio}>Carregando…</div></Casca>
  if (semAcesso || !pedido) {
    return (
      <Casca>
        <div style={S.fallbackCard}>
          <div style={{ textAlign: 'center', padding: '14px 0' }}>
            <div style={S.fallbackIco}><IconShield size={26} color="#c084fc" /></div>
            <h1 style={S.fh1}>Pedido não encontrado</h1>
            <p style={S.ftxt}>Ou ele não existe, ou você precisa entrar com a conta que fez a compra.</p>
            <Link href="/marketplace" style={{ ...S.cta, display: 'inline-flex', width: 'auto', padding: '12px 20px', textDecoration: 'none' }}>Ir para o marketplace</Link>
          </div>
        </div>
      </Casca>
    )
  }

  const processando = pedido.status === 'aguardando_pagamento' && veioDoPagamento
  const passoAtual = ORDEM[pedido.status] ?? -1
  const cancelado = pedido.status === 'cancelado' || pedido.status === 'reembolsado'
  const reembolsado = pedido.status === 'reembolsado'
  const end = pedido.endereco

  const souComprador = !!meuId && meuId === pedido.comprador_user_id
  const podeConfirmar = souComprador && pedido.status === 'enviado'
  const podeAvaliar = souComprador && !cancelado && (pedido.status === 'enviado' || pedido.status === 'entregue') && jaAvaliou === false && !avalOk
  const avaliou = souComprador && !cancelado && (avalOk || jaAvaliou === true)

  // ─── Status hero (adapta ao momento) ───────────────────────────────
  let heroIco: React.ReactNode, heroH: string, heroS: string, heroBg: string
  if (processando) {
    heroIco = <IconClock size={28} color="#c084fc" />; heroBg = 'rgba(168,85,247,0.14)'
    heroH = 'Confirmando seu pagamento…'; heroS = 'Isso leva alguns segundos. Pode deixar essa página aberta.'
  } else if (reembolsado) {
    heroIco = <IconArrowRight size={26} color="#f87171" />; heroBg = 'rgba(239,68,68,0.12)'
    heroH = 'Pedido reembolsado'; heroS = 'O valor foi estornado no seu cartão. Pode levar alguns dias pra aparecer na fatura.'
  } else if (pedido.status === 'cancelado') {
    heroIco = <IconShield size={26} color="#f87171" />; heroBg = 'rgba(239,68,68,0.12)'
    heroH = 'Pedido cancelado'; heroS = 'Este pedido foi cancelado. Se tiver dúvida, fale com a loja.'
  } else if (pedido.status === 'entregue') {
    heroIco = <IcHome size={26} color="#22c55e" />; heroBg = 'rgba(34,197,94,0.14)'
    heroH = 'Pedido entregue!'; heroS = 'Que bom que chegou. Conta pra gente como foi a compra.'
  } else if (pedido.status === 'enviado') {
    heroIco = <IcTruck size={28} color="#c084fc" />; heroBg = 'rgba(168,85,247,0.14)'
    heroH = 'Seu pedido está a caminho!'; heroS = 'A loja despachou. Acompanhe pelo código de rastreio abaixo.'
  } else if (pedido.status === 'pago') {
    heroIco = <IconCheck size={30} color="#22c55e" />; heroBg = 'rgba(34,197,94,0.14)'
    heroH = 'Pagamento aprovado!'; heroS = 'A loja foi avisada e já vai preparar seu envio.'
  } else {
    heroIco = <IconClock size={28} color="#f5b942" />; heroBg = 'rgba(245,158,11,0.12)'
    heroH = 'Aguardando pagamento'; heroS = 'Assim que o pagamento for confirmado, seu pedido aparece aqui.'
  }

  function stepIco(k: string, feito: boolean, atual: boolean) {
    const col = feito ? '#0a0a0a' : atual ? '#c084fc' : 'rgba(255,255,255,0.4)'
    if (k === 'pago') return <IconCheck size={17} color={col} />
    if (k === 'enviado') return <IconBox size={16} color={col} />
    return <IcHome size={15} color={col} />
  }
  function stepSub(k: string, feito: boolean, atual: boolean): string {
    if (k === 'pago') return feito ? (fmtData(pedido!.pago_em || pedido!.created_at) || 'confirmado') : 'aguardando'
    if (k === 'enviado') return feito ? (fmtData(pedido!.enviado_em) || 'despachado') : atual ? 'a loja vai despachar e você recebe o rastreio' : 'aguardando'
    return feito ? 'recebimento confirmado' : atual ? 'aguardando confirmação' : 'aguardando'
  }

  const metodoTxt = pedido.metodo === 'pix' ? 'Pix' : 'Cartão'

  return (
    <Casca>
      <div style={S.hero}>
        <div style={{ ...S.heroIc, background: heroBg }}>{heroIco}</div>
        <div style={S.heroH}>{heroH}</div>
        <div style={S.heroS}>{heroS}</div>
      </div>

      {erroAcao && <div style={S.avalErro}>{erroAcao}</div>}

      <div style={S.cols}>

        {/* ───────── ESQUERDA: acompanhamento ───────── */}
        <div style={S.left}>
          {cancelado ? (
            <div style={S.panel}>
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <span style={{ display: 'inline-flex', marginTop: 1 }}><IconArrowRight size={18} color="#f87171" /></span>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55 }}>
                  {reembolsado
                    ? `Este pedido foi cancelado pela loja e o valor de ${fmtBRL(pedido.total_comprador_cents)} foi estornado no seu cartão.`
                    : 'Este pedido foi cancelado.'}
                </div>
              </div>
            </div>
          ) : (
            <div style={S.panel}>
              <div style={S.ptit}>Status do pedido</div>
              {PASSOS.map((pp, i) => {
                const feito = passoAtual >= i
                const atual = i === passoAtual + 1
                const ultimo = i === PASSOS.length - 1
                const nodeStyle = feito ? S.tlnDone : atual ? S.tlnNext : S.tlnPend
                return (
                  <div key={pp.k} style={S.tl}>
                    <div style={S.tlcol}>
                      <div style={{ ...S.tln, ...nodeStyle }}>{stepIco(pp.k, feito, atual)}</div>
                      {!ultimo && <div style={{ ...S.tlc, background: passoAtual > i ? '#22c55e' : 'rgba(255,255,255,0.12)' }} />}
                    </div>
                    <div style={{ paddingBottom: ultimo ? 0 : 20, flex: 1, minWidth: 0 }}>
                      <div style={{ ...S.tlt, ...(feito || atual ? {} : S.tltOff) }}>{pp.label}</div>
                      <div style={S.tld}>{stepSub(pp.k, feito, atual)}</div>
                      {pp.k === 'enviado' && feito && pedido.rastreio && (
                        <div style={S.rastr}>
                          <div style={{ minWidth: 0 }}>
                            <div style={S.rastrLbl}>CÓDIGO DE RASTREIO</div>
                            <div style={S.rastrCod}>{pedido.rastreio}</div>
                          </div>
                          <button onClick={copiarRastreio} style={S.copyBtn}>
                            {copiado ? <IconCheck size={13} color="#c084fc" /> : <IcCopy size={13} color="#c084fc" />}
                            {copiado ? 'copiado' : 'copiar'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {podeConfirmar && (
            <div style={S.actionG}>
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <span style={{ display: 'inline-flex', marginTop: 1 }}><IconCheck size={22} color="#22c55e" /></span>
                <div style={{ flex: 1 }}>
                  <div style={S.actionH}>Já recebeu seu pedido?</div>
                  <div style={S.actionS}>Confirme o recebimento pra fechar a compra. Isso avisa a loja e libera sua avaliação.</div>
                  <button onClick={confirmarRecebimento} disabled={confirmando} style={{ ...S.btnG, opacity: confirmando ? 0.7 : 1 }}>
                    <IconCheck size={17} color="#0a0a0a" />{confirmando ? 'Confirmando…' : 'Confirmar recebimento'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {podeAvaliar && (
            <div style={S.avalCard}>
              <div style={S.avalTitulo}>Como foi sua compra{lojaNome ? ` com a ${lojaNome}` : ''}?</div>
              <div style={S.avalSub}>Sua avaliação ajuda outros colecionadores a confiar {lojaNome ? `na ${lojaNome}` : 'na loja'}.</div>
              <div style={S.estrelasRow}>
                {[1, 2, 3, 4, 5].map(n => {
                  const on = (hoverEstrela || estrelas) >= n
                  return (
                    <button key={n} onClick={() => setEstrelas(n)} onMouseEnter={() => setHoverEstrela(n)} onMouseLeave={() => setHoverEstrela(0)} aria-label={`${n} estrela${n > 1 ? 's' : ''}`} style={{ ...S.estrelaBtn, transform: on ? 'scale(1.12)' : 'scale(1)' }}>
                      <svg width="32" height="32" viewBox="0 0 20 20" fill={on ? '#f59e0b' : 'none'}>
                        <path d="M10 2l2.4 5 5.4.5-4.1 3.7 1.2 5.3L10 14.9 5.1 16.2l1.2-5.3L2.2 7.5l5.4-.5L10 2z" stroke={on ? '#f59e0b' : 'rgba(255,255,255,0.25)'} strokeWidth="1.2" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )
                })}
              </div>
              {(hoverEstrela || estrelas) > 0 && <div style={S.estrelaLabel}>{LABEL_ESTRELA[hoverEstrela || estrelas]}</div>}
              <textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Conte como foi (opcional)…" maxLength={200} style={S.avalTextarea} />
              <button onClick={enviarAvaliacao} disabled={enviandoAval || estrelas === 0} style={{ ...S.btnAvaliar, opacity: enviandoAval ? 0.7 : estrelas === 0 ? 0.5 : 1, cursor: estrelas === 0 ? 'not-allowed' : 'pointer' }}>
                {enviandoAval ? 'Enviando…' : 'Enviar avaliação'}
              </button>
            </div>
          )}

          {avaliou && (
            <div style={S.avalFeito}>
              <span style={{ display: 'inline-flex' }}><IconCheck size={15} color="#22c55e" /></span> Você avaliou esta loja. Obrigado pelo feedback!
            </div>
          )}
        </div>

        {/* ───────── DIREITA: resumo ───────── */}
        <div style={S.right}>
          <div style={S.rHead}>
            <span style={S.cap}>Pedido #{pedido.numero}</span>
            <span style={{ ...S.pill, ...(cancelado ? S.pillOff : pedido.status === 'aguardando_pagamento' ? S.pillWait : S.pillOk) }}>{LABEL[pedido.status] || pedido.status}</span>
          </div>

          <div style={S.item}>
            <div style={S.thumb}>
              {pedido.item_imagem
                ? <Image src={pedido.item_imagem} alt={pedido.item_nome} width={44} height={60} style={{ objectFit: 'contain', borderRadius: 6 }} unoptimized />
                : <IconPokeball size={18} color="rgba(255,255,255,0.4)" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.inome}>{pedido.item_nome}</div>
              <div style={S.isub}>{pedido.metodo === 'pix' ? <IconBolt size={12} color="rgba(255,255,255,0.5)" /> : <IconCard size={12} color="rgba(255,255,255,0.5)" />}{metodoTxt}</div>
            </div>
            <div style={S.ipreco}>{fmtBRL(pedido.valor_item_cents)}</div>
          </div>

          <div style={S.linhas}>
            <div style={S.linha}><span style={S.mut}>Produto</span><span>{fmtBRL(pedido.valor_item_cents)}</span></div>
            {pedido.acrescimo_cents > 0 && (
              <div style={S.linha}><span style={S.mut}>{pedido.metodo === 'pix' ? 'Taxa do Pix' : 'Acréscimo do cartão'}</span><span>{fmtBRL(pedido.acrescimo_cents)}</span></div>
            )}
            <div style={S.linha}><span style={S.mut}>Frete</span><span>{pedido.frete_cents === 0 ? <span style={{ color: '#22c55e' }}>Grátis</span> : fmtBRL(pedido.frete_cents)}</span></div>
            <div style={S.total}><span>{cancelado ? 'Total' : 'Total pago'}</span><span>{fmtBRL(pedido.total_comprador_cents)}</span></div>
          </div>

          {end?.linha1 && (
            <div style={S.endereco}>
              <div style={S.cap}>Entrega</div>
              <div style={S.endT}>
                {end.nome && <>{end.nome}<br /></>}
                {end.linha1}{end.linha2 ? `, ${end.linha2}` : ''}<br />
                {[end.cidade, end.estado].filter(Boolean).join(' · ')} {end.cep ? `· ${end.cep}` : ''}
              </div>
            </div>
          )}
        </div>
      </div>

      <Link href="/marketplace" style={S.voltar}>← Voltar ao marketplace</Link>
    </Casca>
  )
}

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div style={S.page}>
      <div style={S.topbar}>
        <Link href="/" style={S.brand0}>
          <span style={S.mark}>B</span>
          <span style={S.wm}>BYNX</span>
        </Link>
        <span style={S.safe}><IconShield size={13} color="rgba(255,255,255,0.5)" />ambiente seguro</span>
      </div>
      <div style={S.wrap}>{children}</div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#080a0f', color: '#f0f0f0', padding: '0 0 60px' },
  topbar: { padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 900, margin: '0 auto' },
  brand0: { display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' },
  mark: { width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: '#0a0a0a' },
  wm: { fontWeight: 800, letterSpacing: '0.12em', fontSize: 14, color: '#f0f0f0' },
  safe: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  wrap: { maxWidth: 900, margin: '0 auto', padding: '0 22px' },

  hero: { textAlign: 'center', padding: '30px 0 20px' },
  heroIc: { width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' },
  heroH: { fontSize: 23, fontWeight: 800 },
  heroS: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 5, maxWidth: 420, marginInline: 'auto', lineHeight: 1.5 },

  cols: { display: 'flex', gap: 18, padding: '4px 0 24px', alignItems: 'flex-start', flexWrap: 'wrap' },
  left: { flex: '1.1 1 300px', minWidth: 280 },
  right: { flex: '0.9 1 280px', minWidth: 260, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, background: 'rgba(255,255,255,0.02)', overflow: 'hidden' },

  panel: { border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, background: 'rgba(255,255,255,0.02)', padding: '20px 18px' },
  ptit: { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 18 },
  tl: { display: 'flex', gap: 13 },
  tlcol: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  tln: { width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tlnDone: { background: '#22c55e' },
  tlnNext: { background: 'rgba(168,85,247,0.16)', border: '2px solid #a855f7' },
  tlnPend: { border: '2px solid rgba(255,255,255,0.15)' },
  tlc: { width: 2, flex: 1, minHeight: 26 },
  tlt: { fontSize: 14, fontWeight: 500 },
  tltOff: { color: 'rgba(255,255,255,0.6)' },
  tld: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  rastr: { marginTop: 9, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'rgba(255,255,255,0.02)' },
  rastrLbl: { fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.03em' },
  rastrCod: { fontSize: 13, fontWeight: 500, fontFamily: 'monospace', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  copyBtn: { flexShrink: 0, background: 'rgba(168,85,247,0.14)', border: '1px solid rgba(168,85,247,0.35)', borderRadius: 8, color: '#c084fc', fontSize: 11, padding: '6px 10px', fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 },

  actionG: { marginTop: 16, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.05)', borderRadius: 16, padding: 18 },
  actionH: { fontSize: 15, fontWeight: 500 },
  actionS: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 3, lineHeight: 1.5 },
  btnG: { marginTop: 13, width: '100%', border: 'none', borderRadius: 11, padding: 12, fontSize: 14, fontWeight: 700, color: '#0a0a0a', fontFamily: 'inherit', background: '#22c55e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer' },

  avalCard: { marginTop: 16, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 16, padding: '20px 18px', textAlign: 'center' },
  avalTitulo: { fontSize: 16, fontWeight: 700 },
  avalSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, lineHeight: 1.45 },
  estrelasRow: { display: 'flex', gap: 6, justifyContent: 'center', margin: '14px 0 4px' },
  estrelaBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0, transition: 'transform 0.12s ease' },
  estrelaLabel: { textAlign: 'center', fontSize: 12.5, color: '#f59e0b', fontWeight: 700, marginBottom: 4 },
  avalTextarea: { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#f0f0f0', fontSize: 13, resize: 'none', minHeight: 60, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginTop: 10, marginBottom: 12 },
  btnAvaliar: { width: '100%', background: 'linear-gradient(90deg,#a855f7,#ec4899)', border: 'none', color: '#fff', padding: '12px', borderRadius: 11, fontSize: 14, fontWeight: 700, fontFamily: 'inherit' },
  avalFeito: { marginTop: 16, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  avalErro: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '9px 12px', margin: '6px 0 0', fontSize: 12.5, color: '#ef4444' },

  rHead: { padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cap: { fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  pill: { fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' },
  pillOk: { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' },
  pillWait: { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' },
  pillOff: { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' },
  item: { display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px' },
  thumb: { width: 44, height: 60, borderRadius: 8, background: 'linear-gradient(160deg,#1a1030,#0f1628)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  inome: { fontSize: 13, fontWeight: 500, lineHeight: 1.3 },
  isub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 4 },
  ipreco: { fontSize: 14, fontWeight: 700, marginLeft: 'auto', whiteSpace: 'nowrap' },
  linhas: { margin: '0 16px', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.08)' },
  linha: { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 7 },
  total: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 14, fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 3, paddingTop: 10 },
  mut: { color: 'rgba(255,255,255,0.6)' },
  endereco: { margin: '0 16px 16px', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' },
  endT: { fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginTop: 6 },

  cta: { textAlign: 'center', fontSize: 13.5, fontWeight: 700, padding: '11px 20px', borderRadius: 11, border: 'none', cursor: 'pointer', background: 'linear-gradient(90deg,#a855f7,#ec4899)', color: '#fff', alignItems: 'center', justifyContent: 'center', gap: 8 },
  vazio: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 40, fontSize: 14 },
  voltar: { display: 'block', textAlign: 'center', marginTop: 8, fontSize: 12.5, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' },

  fallbackCard: { maxWidth: 460, margin: '24px auto 0', background: '#0d0f14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 24 },
  fallbackIco: { width: 52, height: 52, borderRadius: '50%', background: 'rgba(168,85,247,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' },
  fh1: { fontSize: 18, fontWeight: 800, margin: '10px 0 8px' },
  ftxt: { fontSize: 13.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, marginBottom: 16 },
}
