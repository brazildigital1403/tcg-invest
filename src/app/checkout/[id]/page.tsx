'use client'

import { use as usePromise, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { calcularCheckout, fmtBRL, PIX_DISPONIVEL, type MetodoPagamento } from '@/lib/comissao'

/**
 * /checkout/[id] — tela de compra de um anuncio (Opcao A do epico de vendas).
 *
 * POR QUE ESTA TELA EXISTE (e nao mandamos direto pro Stripe Checkout):
 * o modelo de comissao cobra acrescimo POR METODO (Pix +R$0,99 / cartao +4,8%).
 * A Session da Stripe tem UM preco fechado — ela nao recalcula o total depois
 * que o comprador escolhe o metodo. Entao a escolha precisa acontecer AQUI,
 * antes de criar a Session. De quebra, da pra mostrar o quanto o Pix economiza.
 */

interface ItemInfo {
  id: string
  nome: string
  imagem: string | null
  preco_cents: number
  condicao: string | null
  graduada: boolean | null
  graduadora: string | null
  nota: string | null
  disponivel: boolean
  vendedor_user_id: string
}
interface LojaInfo {
  nome: string
  slug: string
  logo_url: string | null
  verificada: boolean | null
  frete_cents: number
  frete_gratis_acima_cents: number | null
  repasse_prazo: 14 | 30
  pode_vender: boolean
}

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: anuncioId } = usePromise(params)
  const router = useRouter()
  const search = useSearchParams()
  const { openSignup } = useAuthModal()

  const [item, setItem] = useState<ItemInfo | null>(null)
  const [loja, setLoja] = useState<LojaInfo | null>(null)
  const [metodo, setMetodo] = useState<MetodoPagamento>(PIX_DISPONIVEL ? 'pix' : 'cartao')
  const [carregando, setCarregando] = useState(true)
  const [indo, setIndo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [uid, setUid] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user?.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const r = await fetch(`/api/marketplace/${anuncioId}/checkout`)
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Não consegui carregar')
      setItem(j.item)
      setLoja(j.loja)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }, [anuncioId])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { if (search.get('cancelado') === '1') setErro('Pagamento cancelado. Seu pedido não foi finalizado.') }, [search])

  async function pagar() {
    if (!uid) { openSignup(); return }
    setIndo(true)
    setErro(null)
    try {
      const { data } = await supabase.auth.getSession()
      const r = await fetch(`/api/marketplace/${anuncioId}/checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ metodo }),
      })
      const j = await r.json()
      if (!r.ok || !j?.url) throw new Error(j?.error || 'Não foi possível iniciar o pagamento.')
      window.location.href = j.url
    } catch (e) {
      setErro((e as Error).message)
      setIndo(false)
    }
  }

  if (carregando) return <Casca><div style={S.vazio}>Carregando…</div></Casca>
  if (!item) return <Casca><div style={S.vazio}>{erro || 'Anúncio não encontrado.'}</div></Casca>

  // ─── Sem venda on-site: cai no fluxo antigo de negociacao ───────────
  if (!loja || !loja.pode_vender) {
    return (
      <Casca>
        <div style={S.card}>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 34 }}>🤝</div>
            <h1 style={S.h1}>Esse anúncio é de negociação direta</h1>
            <p style={S.txt}>
              {loja ? `A ${loja.nome} ainda está ativando os recebimentos.` : 'Esse vendedor ainda não vende pela Bynx.'}{' '}
              Você pode conversar com ele pelo marketplace.
            </p>
            <Link href={`/marketplace?conversa=${item.id}`} style={{ ...S.cta, display: 'inline-block', textDecoration: 'none' }}>
              Tenho interesse →
            </Link>
          </div>
        </div>
      </Casca>
    )
  }

  const ehMeu = uid && uid === item.vendedor_user_id
  const freteBase = loja.frete_cents
  const gratisAcima = loja.frete_gratis_acima_cents
  const frete = gratisAcima != null && item.preco_cents >= gratisAcima ? 0 : freteBase

  const cPix = calcularCheckout(item.preco_cents, loja.repasse_prazo, 'pix')
  const cCartao = calcularCheckout(item.preco_cents, loja.repasse_prazo, 'cartao')
  const c = metodo === 'pix' ? cPix : cCartao
  const total = c.totalCompradorCents + frete
  const economia = cCartao.acrescimoCents - cPix.acrescimoCents

  return (
    <Casca>
      {erro && <div style={S.erro}>{erro}</div>}

      <div style={S.card}>
        <div style={S.cap}>Revisar pedido</div>

        <div style={S.item}>
          <div style={S.thumb}>
            {item.imagem
              ? <Image src={item.imagem} alt={item.nome} width={54} height={75} style={{ objectFit: 'contain', borderRadius: 6 }} unoptimized />
              : <span style={{ fontSize: 22 }}>🎴</span>}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={S.inome}>{item.nome}</div>
            <div style={S.isub}>
              {item.graduada && item.graduadora ? `${item.graduadora} ${item.nota || ''} · ` : item.condicao ? `${item.condicao} · ` : ''}
              {loja.nome}{loja.verificada ? ' ✓' : ''}
            </div>
          </div>
          <div style={S.ipreco}>{fmtBRL(item.preco_cents)}</div>
        </div>

        {!item.disponivel ? (
          <div style={S.aviso}>Esse anúncio não está mais disponível.</div>
        ) : ehMeu ? (
          <div style={S.aviso}>Esse anúncio é seu — você não pode comprá-lo.</div>
        ) : (
          <>
            <div style={S.label}>Como você quer pagar?</div>
            <div style={S.pays}>
              {(['pix', 'cartao'] as MetodoPagamento[]).map(m => {
                const cm = m === 'pix' ? cPix : cCartao
                const on = metodo === m
                const bloqueado = m === 'pix' && !PIX_DISPONIVEL
                return (
                  <button
                    key={m}
                    onClick={() => !bloqueado && setMetodo(m)}
                    disabled={bloqueado}
                    title={bloqueado ? 'O Pix está a caminho' : undefined}
                    style={{ ...S.pay, ...(on ? S.payOn : {}), ...(bloqueado ? S.payOff : {}) }}
                  >
                    <div style={{ fontSize: 18 }}>{m === 'pix' ? '⚡' : '💳'}</div>
                    <div style={S.payL}>{m === 'pix' ? 'Pix' : 'Cartão'}</div>
                    <div style={{ ...S.payP, color: bloqueado ? 'rgba(255,255,255,0.3)' : on ? '#22c55e' : 'rgba(255,255,255,0.4)' }}>
                      {bloqueado ? 'em breve' : `+ ${fmtBRL(cm.acrescimoCents)}`}
                    </div>
                  </button>
                )
              })}
            </div>

            <div style={S.linhas}>
              <div style={S.linha}><span style={S.mut}>Produto</span><span>{fmtBRL(item.preco_cents)}</span></div>
              <div style={S.linha}>
                <span style={S.mut}>{metodo === 'pix' ? 'Taxa do Pix' : 'Acréscimo do cartão'}</span>
                <span>{fmtBRL(c.acrescimoCents)}</span>
              </div>
              <div style={S.linha}>
                <span style={S.mut}>Frete</span>
                <span>{frete === 0 ? <span style={{ color: '#22c55e' }}>Grátis</span> : fmtBRL(frete)}</span>
              </div>
              <div style={S.total}><span>Total</span><span style={{ color: '#22c55e' }}>{fmtBRL(total)}</span></div>
            </div>

            {PIX_DISPONIVEL && metodo === 'cartao' && economia > 0 && (
              <button onClick={() => setMetodo('pix')} style={S.dica}>
                💡 Pagando no Pix você economiza {fmtBRL(economia)}
              </button>
            )}

            <button onClick={pagar} disabled={indo} style={{ ...S.cta, opacity: indo ? 0.6 : 1 }}>
              {indo ? 'Abrindo pagamento…' : uid ? 'Ir para o pagamento →' : 'Entrar e comprar →'}
            </button>
            <p style={S.mini}>🔒 O pagamento é processado pela Stripe. A Bynx não guarda os dados do seu cartão.</p>
          </>
        )}
      </div>

      <Link href={`/lojas/${loja.slug}`} style={S.voltar}>← Voltar para a {loja.nome}</Link>
    </Casca>
  )
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
  card: { background: '#0d0f14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 20 },
  cap: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 },
  item: { display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 16 },
  thumb: { width: 54, height: 75, borderRadius: 6, background: 'linear-gradient(135deg,#1a1030,#0f1628)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  inome: { fontSize: 14, fontWeight: 700, lineHeight: 1.3 },
  isub: { fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
  ipreco: { fontSize: 16, fontWeight: 800, marginLeft: 'auto', whiteSpace: 'nowrap' },
  h1: { fontSize: 18, fontWeight: 800, margin: '10px 0 8px' },
  txt: { fontSize: 13.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  pays: { display: 'flex', gap: 8, marginBottom: 16 },
  pay: { flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 8px', cursor: 'pointer', color: '#f0f0f0' },
  payOff: { opacity: 0.45, cursor: 'not-allowed' },
  payOn: { borderColor: 'rgba(34,197,94,0.45)', background: 'rgba(34,197,94,0.08)' },
  payL: { fontSize: 12.5, fontWeight: 700, marginTop: 3 },
  payP: { fontSize: 11, marginTop: 2 },
  linhas: { borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 },
  linha: { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0' },
  total: { display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 6, paddingTop: 10 },
  mut: { color: 'rgba(255,255,255,0.45)' },
  dica: { width: '100%', textAlign: 'center', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', borderRadius: 10, padding: '9px', fontSize: 12.5, fontWeight: 600, marginTop: 12, cursor: 'pointer' },
  cta: { width: '100%', textAlign: 'center', fontSize: 14, fontWeight: 800, padding: 13, borderRadius: 12, border: 'none', cursor: 'pointer', marginTop: 14, background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: '#fff' },
  mini: { fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 10 },
  aviso: { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f5b942', borderRadius: 10, padding: '11px 14px', fontSize: 13, textAlign: 'center' },
  erro: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  vazio: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 40, fontSize: 14 },
  voltar: { display: 'block', textAlign: 'center', marginTop: 18, fontSize: 12.5, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' },
}
