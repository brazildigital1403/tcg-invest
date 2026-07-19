'use client'

import { use as usePromise, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { authFetch } from '@/lib/authFetch'
import { fmtBRL } from '@/lib/comissao'

/**
 * /pedido/[id] — acompanhamento do pedido.
 *
 * E o `success_url` do Stripe Checkout: o comprador cai aqui logo depois de
 * pagar. Le direto do Supabase (a RLS de `pedidos` so libera pro comprador e pro
 * vendedor), entao nao precisa de rota.
 *
 * GOTCHA: ao voltar da Stripe o webhook pode nao ter processado ainda (leva
 * segundos). Por isso, quando cai aqui com ?ok=1 e o status ainda esta
 * 'aguardando_pagamento', a pagina faz alguns re-fetch antes de dar como certo —
 * senao o comprador ve "aguardando pagamento" logo apos ter pago e entra em
 * panico.
 *
 * PoS-VENDA: quando o comprador ve o proprio pedido em 'enviado'/'entregue',
 * aparece o bloco de avaliar a loja (+ botao "Confirmar recebimento" no enviado,
 * que hoje e a unica forma da timeline chegar em 'entregue'). A avaliacao vai
 * pra rota /api/pedidos/[id]/avaliar (comprador-verificado, 1 por pedido).
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
  { k: 'pago', ic: '💳', label: 'Pagamento confirmado' },
  { k: 'enviado', ic: '📦', label: 'Enviado pela loja' },
  { k: 'entregue', ic: '🏠', label: 'Entregue' },
]
const ORDEM: Record<string, number> = { aguardando_pagamento: -1, pago: 0, enviado: 1, entregue: 2 }
const LABEL_ESTRELA = ['', 'Muito ruim', 'Ruim', 'Ok', 'Boa', 'Excelente!']

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
  // UM push alimenta os dois: o GTM tem uma tag do GA4 e outra da Meta ouvindo
  // o evento 'purchase'. Formato = GA4 ecommerce (padrao de mercado).
  //
  // DEDUP: a chave no localStorage garante 1 disparo por pedido pra sempre —
  // recarregar a pagina, voltar nela semana que vem ou abrir em outra aba nao
  // conta venda de novo. Sem isso o Meta otimizaria com faturamento inflado.
  //
  // Se o usuario nao aceitou cookies, o GTM nao existe e o push cai num array
  // solto — inofensivo, e nada e enviado. (Consent LGPD respeitado.)
  useEffect(() => {
    if (!pedido) return
    if (pedido.status === 'aguardando_pagamento' || pedido.status === 'cancelado' || pedido.status === 'reembolsado') return

    const chave = `bx_purchase_${pedido.id}`
    try {
      if (localStorage.getItem(chave)) return
      localStorage.setItem(chave, '1')
    } catch {
      return // sem localStorage nao da pra garantir o dedup: melhor nao disparar
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

  if (carregando) return <Casca><div style={S.vazio}>Carregando…</div></Casca>
  if (semAcesso || !pedido) {
    return (
      <Casca>
        <div style={S.card}>
          <div style={{ textAlign: 'center', padding: '14px 0' }}>
            <div style={{ fontSize: 34 }}>🔒</div>
            <h1 style={S.h1}>Pedido não encontrado</h1>
            <p style={S.txt}>Ou ele não existe, ou você precisa entrar com a conta que fez a compra.</p>
            <Link href="/marketplace" style={{ ...S.cta, display: 'inline-block', textDecoration: 'none' }}>Ir para o marketplace</Link>
          </div>
        </div>
      </Casca>
    )
  }

  const processando = pedido.status === 'aguardando_pagamento' && veioDoPagamento
  const passoAtual = ORDEM[pedido.status] ?? -1
  const cancelado = pedido.status === 'cancelado' || pedido.status === 'reembolsado'
  const end = pedido.endereco

  const souComprador = !!meuId && meuId === pedido.comprador_user_id
  const podeConfirmar = souComprador && pedido.status === 'enviado'
  const podeAvaliar = souComprador && !cancelado && (pedido.status === 'enviado' || pedido.status === 'entregue') && jaAvaliou === false && !avalOk
  const avaliou = souComprador && !cancelado && (avalOk || jaAvaliou === true)

  return (
    <Casca>
      {processando ? (
        <div style={S.topo}>
          <div style={{ fontSize: 34 }}>⏳</div>
          <div style={S.topoT}>Confirmando seu pagamento…</div>
          <div style={S.topoS}>Isso leva alguns segundos. Pode deixar essa página aberta.</div>
        </div>
      ) : pedido.status !== 'aguardando_pagamento' && !cancelado ? (
        <div style={S.topo}>
          <div style={{ fontSize: 34 }}>✅</div>
          <div style={S.topoT}>Pagamento aprovado!</div>
          <div style={S.topoS}>A loja foi avisada e vai preparar seu envio.</div>
        </div>
      ) : null}

      <div style={S.card}>
        <div style={S.head}>
          <span style={S.cap}>Pedido #{pedido.numero}</span>
          <span style={{ ...S.pill, ...(cancelado ? S.pillOff : pedido.status === 'aguardando_pagamento' ? S.pillWait : S.pillOk) }}>
            {LABEL[pedido.status] || pedido.status}
          </span>
        </div>

        <div style={S.item}>
          <div style={S.thumb}>
            {pedido.item_imagem
              ? <Image src={pedido.item_imagem} alt={pedido.item_nome} width={54} height={75} style={{ objectFit: 'contain', borderRadius: 6 }} unoptimized />
              : <span style={{ fontSize: 22 }}>🎴</span>}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={S.inome}>{pedido.item_nome}</div>
            <div style={S.isub}>{pedido.metodo === 'pix' ? '⚡ Pix' : '💳 Cartão'}</div>
          </div>
          <div style={S.ipreco}>{fmtBRL(pedido.total_comprador_cents)}</div>
        </div>

        {!cancelado && (
          <div style={S.timeline}>
            {PASSOS.map((pp, i) => {
              const feito = passoAtual >= i
              return (
                <div key={pp.k} style={S.passo}>
                  <div style={{ ...S.bola, ...(feito ? S.bolaOn : {}) }}>{feito ? pp.ic : ''}</div>
                  <div style={{ ...S.passoL, color: feito ? '#f0f0f0' : 'rgba(255,255,255,0.3)' }}>{pp.label}</div>
                  {i < PASSOS.length - 1 && <div style={{ ...S.linhaT, background: passoAtual > i ? '#22c55e' : 'rgba(255,255,255,0.1)' }} />}
                </div>
              )
            })}
          </div>
        )}

        {pedido.rastreio && (
          <div style={S.rastreio}>
            <span style={S.mut}>Código de rastreio</span>
            <strong style={{ letterSpacing: '0.04em' }}>{pedido.rastreio}</strong>
          </div>
        )}

        <div style={S.linhas}>
          <div style={S.linha}><span style={S.mut}>Produto</span><span>{fmtBRL(pedido.valor_item_cents)}</span></div>
          {pedido.acrescimo_cents > 0 && (
            <div style={S.linha}>
              <span style={S.mut}>{pedido.metodo === 'pix' ? 'Taxa do Pix' : 'Acréscimo do cartão'}</span>
              <span>{fmtBRL(pedido.acrescimo_cents)}</span>
            </div>
          )}
          <div style={S.linha}>
            <span style={S.mut}>Frete</span>
            <span>{pedido.frete_cents === 0 ? <span style={{ color: '#22c55e' }}>Grátis</span> : fmtBRL(pedido.frete_cents)}</span>
          </div>
          <div style={S.total}><span>Total</span><span>{fmtBRL(pedido.total_comprador_cents)}</span></div>
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

      {erroAcao && <div style={S.avalErro}>{erroAcao}</div>}

      {podeConfirmar && (
        <div style={S.acaoCard}>
          <div style={S.acaoTxt}>Já recebeu seu pedido? Confirme pra fechar a compra.</div>
          <button onClick={confirmarRecebimento} disabled={confirmando} style={{ ...S.btnReceber, opacity: confirmando ? 0.7 : 1 }}>
            {confirmando ? 'Confirmando…' : 'Confirmar recebimento'}
          </button>
        </div>
      )}

      {podeAvaliar && (
        <div style={S.avalCard}>
          <div style={S.avalTitulo}>Como foi sua compra{lojaNome ? ` com ${lojaNome}` : ''}?</div>
          <div style={S.avalSub}>Sua avaliação ajuda outros colecionadores a confiar {lojaNome ? `na ${lojaNome}` : 'na loja'}.</div>
          <div style={S.estrelasRow}>
            {[1, 2, 3, 4, 5].map(n => {
              const on = (hoverEstrela || estrelas) >= n
              return (
                <button
                  key={n}
                  onClick={() => setEstrelas(n)}
                  onMouseEnter={() => setHoverEstrela(n)}
                  onMouseLeave={() => setHoverEstrela(0)}
                  aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
                  style={{ ...S.estrelaBtn, transform: on ? 'scale(1.12)' : 'scale(1)' }}
                >
                  <svg width="30" height="30" viewBox="0 0 20 20" fill={on ? '#f59e0b' : 'none'}>
                    <path d="M10 2l2.4 5 5.4.5-4.1 3.7 1.2 5.3L10 14.9 5.1 16.2l1.2-5.3L2.2 7.5l5.4-.5L10 2z" stroke={on ? '#f59e0b' : 'rgba(255,255,255,0.25)'} strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                </button>
              )
            })}
          </div>
          {(hoverEstrela || estrelas) > 0 && (
            <div style={S.estrelaLabel}>{LABEL_ESTRELA[hoverEstrela || estrelas]}</div>
          )}
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            placeholder="Conte como foi (opcional)…"
            maxLength={200}
            style={S.avalTextarea}
          />
          <button
            onClick={enviarAvaliacao}
            disabled={enviandoAval || estrelas === 0}
            style={{ ...S.btnAvaliar, opacity: enviandoAval ? 0.7 : estrelas === 0 ? 0.5 : 1, cursor: estrelas === 0 ? 'not-allowed' : 'pointer' }}
          >
            {enviandoAval ? 'Enviando…' : 'Enviar avaliação'}
          </button>
        </div>
      )}

      {avaliou && (
        <div style={S.avalFeito}>
          <span style={{ color: '#22c55e', fontWeight: 800 }}>✓</span> Você avaliou esta loja. Obrigado pelo feedback!
        </div>
      )}

      <Link href="/marketplace" style={S.voltar}>← Voltar ao marketplace</Link>
    </Casca>
  )
}

const LABEL: Record<string, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  reembolsado: 'Reembolsado',
}

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <Link href="/" style={S.logo}>BYNX</Link>
        {children}
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#080a0f', color: '#f0f0f0', padding: '28px 18px 60px' },
  wrap: { maxWidth: 480, margin: '0 auto' },
  logo: { display: 'block', textAlign: 'center', fontWeight: 900, letterSpacing: '0.1em', color: '#f59e0b', textDecoration: 'none', marginBottom: 20, fontSize: 15 },
  topo: { textAlign: 'center', marginBottom: 16 },
  topoT: { fontSize: 18, fontWeight: 800, marginTop: 8 },
  topoS: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  card: { background: '#0d0f14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 20 },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cap: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  pill: { fontSize: 10.5, fontWeight: 800, padding: '4px 9px', borderRadius: 20 },
  pillOk: { background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' },
  pillWait: { background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' },
  pillOff: { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' },
  item: { display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 16 },
  thumb: { width: 54, height: 75, borderRadius: 6, background: 'linear-gradient(135deg,#1a1030,#0f1628)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  inome: { fontSize: 14, fontWeight: 700, lineHeight: 1.3 },
  isub: { fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
  ipreco: { fontSize: 16, fontWeight: 800, marginLeft: 'auto', whiteSpace: 'nowrap' },
  timeline: { display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: 18, gap: 4 },
  passo: { flex: 1, textAlign: 'center', position: 'relative', minWidth: 0 },
  bola: { width: 30, height: 30, borderRadius: '50%', margin: '0 auto 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, position: 'relative', zIndex: 1 },
  bolaOn: { background: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.45)' },
  passoL: { fontSize: 10.5, lineHeight: 1.3 },
  linhaT: { position: 'absolute', top: 15, left: '58%', width: '84%', height: 2, zIndex: 0 },
  rastreio: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, marginBottom: 14 },
  linhas: { borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 },
  linha: { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0' },
  total: { display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 6, paddingTop: 10 },
  mut: { color: 'rgba(255,255,255,0.45)' },
  endereco: { marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' },
  endT: { fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginTop: 6 },
  h1: { fontSize: 18, fontWeight: 800, margin: '10px 0 8px' },
  txt: { fontSize: 13.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, marginBottom: 16 },
  cta: { textAlign: 'center', fontSize: 13.5, fontWeight: 800, padding: '11px 20px', borderRadius: 11, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: '#fff' },
  vazio: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 40, fontSize: 14 },
  voltar: { display: 'block', textAlign: 'center', marginTop: 18, fontSize: 12.5, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' },

  // ─── Pos-venda ─────────────────────────────────────────────
  acaoCard: { background: '#0d0f14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 11 },
  acaoTxt: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.45 },
  btnReceber: { background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', padding: '11px', borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  avalCard: { background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 16, padding: '16px 16px 18px', marginTop: 12 },
  avalTitulo: { fontSize: 15, fontWeight: 800, marginBottom: 3 },
  avalSub: { fontSize: 12.5, color: 'rgba(255,255,255,0.45)', marginBottom: 14, lineHeight: 1.45 },
  estrelasRow: { display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 6 },
  estrelaBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0, transition: 'transform 0.12s ease' },
  estrelaLabel: { textAlign: 'center', fontSize: 12.5, color: '#f59e0b', fontWeight: 700, marginBottom: 4 },
  avalTextarea: { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#f0f0f0', fontSize: 13, resize: 'vertical', minHeight: 70, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginTop: 10, marginBottom: 12 },
  btnAvaliar: { width: '100%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', color: '#0a0a0a', padding: '12px', borderRadius: 10, fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit' },
  avalFeito: { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: '12px 14px', marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  avalErro: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '9px 12px', marginTop: 12, fontSize: 12.5, color: '#ef4444' },
}
