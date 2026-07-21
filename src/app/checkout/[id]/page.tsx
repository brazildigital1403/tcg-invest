'use client'

import { use as usePromise, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { calcularCheckout, fmtBRL, PIX_DISPONIVEL, type MetodoPagamento } from '@/lib/comissao'
import { IconShield, IconCard, IconBolt, IconArrowRight, IconCheck, IconBox, IconPokeball } from '@/components/ui/Icons'
import AppLayout from '@/components/ui/AppLayout'

/**
 * /checkout/[id] — tela de compra de um anuncio (Opcao A do epico de vendas).
 *
 * POR QUE ESTA TELA EXISTE (e nao mandamos direto pro Stripe Checkout):
 * o modelo de comissao cobra acrescimo POR METODO (Pix +R$0,99 / cartao +4,8%).
 * A Session da Stripe tem UM preco fechado — ela nao recalcula o total depois
 * que o comprador escolhe o metodo. Entao a escolha precisa acontecer AQUI,
 * antes de criar a Session. De quebra, da pra mostrar o quanto o Pix economiza.
 *
 * FRETE: se a loja usa frete calculado, o comprador digita o CEP e escolhe
 * PAC/SEDEX aqui. O preco vem de /api/frete/cotar (so estimativa); o checkout
 * RE-COTA no servidor na hora de fechar — o cliente nunca dita o preco do frete.
 *
 * LAYOUT (redesign): 2 colunas — esquerda "palco" (item em destaque + reputacao
 * da loja + como funciona), direita "acao" (entrega -> pagamento -> resumo ->
 * pagar). No mobile empilha. Selos de seguranca no rodape. Zero emoji: icones SVG.
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
  frete_modo?: 'fixo' | 'calculado'
  repasse_prazo: 14 | 30
  pode_vender: boolean
}
interface OpcaoFrete {
  id: number
  nome: string
  empresa: string
  precoCents: number
  prazoDias: number
}

function fmtCep(v: string): string {
  const d = String(v || '').replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

// Condicao "crua" (NM/LP/...) -> rotulo amigavel pro comprador entender.
const COND_LABEL: Record<string, string> = {
  NM: 'NM · Quase perfeita',
  LP: 'LP · Pouco usada',
  MP: 'MP · Sinais de uso',
  HP: 'HP · Bem usada',
  DMG: 'DMG · Danificada',
}

// Iconezinho de info (nao existe no Icons.tsx) — usado no acrescimo.
function IcInfo({ size = 13, color = 'rgba(255,255,255,0.35)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="7.5" stroke={color} strokeWidth={1.4} />
      <path d="M10 9v4.5" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <circle cx="10" cy="6.4" r="0.9" fill={color} />
    </svg>
  )
}

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: anuncioId } = usePromise(params)
  const router = useRouter()
  const search = useSearchParams()
  const { openSignup } = useAuthModal()

  // Carta e produto usam a MESMA tela: muda so a API por tras. O ?tipo=produto
  // vem do link da vitrine. Sem isso precisariamos de duas telas identicas.
  const ehProduto = search.get('tipo') === 'produto'
  const apiBase = ehProduto ? `/api/produtos/${anuncioId}/checkout` : `/api/marketplace/${anuncioId}/checkout`

  const [item, setItem] = useState<ItemInfo | null>(null)
  const [loja, setLoja] = useState<LojaInfo | null>(null)
  const [metodo, setMetodo] = useState<MetodoPagamento>(PIX_DISPONIVEL ? 'pix' : 'cartao')
  const [carregando, setCarregando] = useState(true)
  const [indo, setIndo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [uid, setUid] = useState<string | null>(null)

  // Frete calculado
  const [cepDest, setCepDest] = useState('')
  const [opcoesFrete, setOpcoesFrete] = useState<OpcaoFrete[] | null>(null)
  const [servicoSel, setServicoSel] = useState<number | null>(null)
  const [cotando, setCotando] = useState(false)
  const [erroFrete, setErroFrete] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user?.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const r = await fetch(apiBase)
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Não consegui carregar')
      setItem(j.item)
      setLoja(j.loja)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }, [apiBase])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { if (search.get('cancelado') === '1') setErro('Pagamento cancelado. Seu pedido não foi finalizado.') }, [search])

  async function cotar() {
    const cd = cepDest.replace(/\D/g, '')
    if (cd.length !== 8) { setErroFrete('Digite um CEP válido (8 dígitos).'); return }
    setCotando(true)
    setErroFrete(null)
    setOpcoesFrete(null)
    setServicoSel(null)
    try {
      const r = await fetch('/api/frete/cotar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: ehProduto ? 'produto' : 'marketplace', id: anuncioId, cep: cd }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Não consegui calcular o frete.')
      const ops = (j.opcoes || []) as OpcaoFrete[]
      setOpcoesFrete(ops)
      if (ops.length) setServicoSel(ops[0].id) // ja seleciona o mais barato
    } catch (e) {
      setErroFrete((e as Error).message)
    } finally {
      setCotando(false)
    }
  }

  async function pagar() {
    if (!uid) { openSignup(); return }
    setIndo(true)
    setErro(null)
    try {
      const { data } = await supabase.auth.getSession()
      const ehCalc = loja?.frete_modo === 'calculado'
      const corpo: Record<string, unknown> = { metodo }
      if (ehCalc) {
        corpo.cep = cepDest.replace(/\D/g, '')
        corpo.servico = servicoSel
      }
      const r = await fetch(apiBase, {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
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
        <div style={S.fallbackCard}>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={S.fallbackIco}><IconBox size={26} color="#c084fc" /></div>
            <h1 style={S.fh1}>Esse anúncio é de negociação direta</h1>
            <p style={S.ftxt}>
              {loja ? `A ${loja.nome} ainda está ativando os recebimentos.` : 'Esse vendedor ainda não vende pela Bynx.'}{' '}
              {ehProduto ? 'Volte em breve para comprar por aqui.' : 'Você pode conversar com ele pelo marketplace.'}
            </p>
            {!ehProduto && (
              <Link href={`/marketplace?conversa=${item.id}`} style={{ ...S.cta, display: 'inline-flex', width: 'auto', padding: '12px 20px', textDecoration: 'none' }}>
                Tenho interesse <IconArrowRight size={16} color="#fff" />
              </Link>
            )}
          </div>
        </div>
      </Casca>
    )
  }

  const ehMeu = uid && uid === item.vendedor_user_id
  const ehCalculado = loja.frete_modo === 'calculado'
  const freteBase = loja.frete_cents
  const gratisAcima = loja.frete_gratis_acima_cents

  // Frete resolvido: no fixo e sempre um numero; no calculado so depois que o
  // comprador cota e escolhe um servico (ate la, null = total indefinido).
  let freteResolvido: number | null
  if (ehCalculado) {
    const op = opcoesFrete?.find(o => o.id === servicoSel)
    freteResolvido = op ? op.precoCents : null
  } else {
    freteResolvido = gratisAcima != null && item.preco_cents >= gratisAcima ? 0 : freteBase
  }

  const cPix = calcularCheckout(item.preco_cents, loja.repasse_prazo, 'pix')
  const cCartao = calcularCheckout(item.preco_cents, loja.repasse_prazo, 'cartao')
  const c = metodo === 'pix' ? cPix : cCartao
  const total = freteResolvido == null ? null : c.totalCompradorCents + freteResolvido
  const economia = cCartao.acrescimoCents - cPix.acrescimoCents
  const precisaFrete = ehCalculado && freteResolvido == null

  // Rotulo de condicao amigavel (cai no cru se nao mapeado).
  const condChip = item.graduada && item.graduadora
    ? `${item.graduadora} ${item.nota || ''}`.trim()
    : item.condicao
      ? (COND_LABEL[item.condicao.toUpperCase()] || item.condicao)
      : null

  const stepPag = ehCalculado ? 2 : 1
  const indisponivel = !item.disponivel
  const bloqueado = indisponivel || !!ehMeu

  return (
    <Casca>
      <div style={S.head}>
        <h1 style={S.h1}>Finalizar compra</h1>
        <p style={S.sub}>Revise o que está levando, escolha o frete e pague. Você acompanha o pedido até a entrega.</p>
      </div>

      {erro && <div style={S.erro}>{erro}</div>}

      <div style={S.cols}>

        {/* ───────── PALCO (esquerda) ───────── */}
        <div style={S.left}>
          <div style={S.heroRow}>
            <div style={S.heroImg}>
              {item.imagem
                ? <Image src={item.imagem} alt={item.nome} width={150} height={208} style={{ objectFit: 'contain', borderRadius: 10, width: '100%', height: 'auto' }} unoptimized />
                : <IconPokeball size={30} color="rgba(255,255,255,0.4)" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.heroName}>{item.nome}</div>
              {condChip && (
                <div style={S.chipRow}>
                  <span style={S.chip}>{condChip}</span>
                </div>
              )}
              <div style={S.heroPrice}>{fmtBRL(item.preco_cents)}</div>
              <div style={S.heroQtd}>1 unidade</div>
            </div>
          </div>

          <div style={S.sellcard}>
            <div style={S.avatar}>{(loja.nome || 'B').charAt(0).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.sellName}>
                Loja {loja.nome}
                {loja.verificada && <span style={{ display: 'inline-flex', marginLeft: 5 }}><IconShield size={14} color="#22c55e" /></span>}
              </div>
              <div style={S.sellSub}>Vendido e enviado pela loja</div>
            </div>
            <Link href={`/lojas/${loja.slug}`} style={S.verBtn}>Ver loja</Link>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={S.howTit}>Como funciona sua compra</div>
            <div style={S.howRow}><span style={S.howIco}><IconShield size={19} color="#c084fc" /></span><div><div style={S.howB}>Pagamento seguro</div><div style={S.howS}>Processado pela Stripe. A Bynx nunca guarda os dados do seu cartão.</div></div></div>
            <div style={S.howRow}><span style={S.howIco}><IconBox size={19} color="#c084fc" /></span><div><div style={S.howB}>A loja despacha com rastreio</div><div style={S.howS}>Você recebe o código pra acompanhar a entrega, tudo dentro da Bynx.</div></div></div>
            <div style={{ ...S.howRow, marginBottom: 0 }}><span style={S.howIco}><IconCheck size={19} color="#c084fc" /></span><div><div style={S.howB}>Você confirma e avalia</div><div style={S.howS}>Ao receber, confirma o recebimento e deixa sua avaliação da loja.</div></div></div>
          </div>
        </div>

        {/* ───────── ACAO (direita) ───────── */}
        <div style={S.right}>
          {bloqueado ? (
            <div style={{ padding: 18 }}>
              <div style={S.aviso}>{indisponivel ? 'Esse anúncio não está mais disponível.' : 'Esse anúncio é seu — você não pode comprá-lo.'}</div>
            </div>
          ) : (
            <>
              {ehCalculado && (
                <div style={{ padding: '16px 16px 4px' }}>
                  <div style={S.stepRow}><span style={S.stepN}>1</span><span style={S.stepLbl}>Entrega</span></div>
                  <div style={S.cepRow}>
                    <input value={cepDest} onChange={e => setCepDest(fmtCep(e.target.value))} placeholder="Seu CEP" inputMode="numeric" style={S.cepInput} />
                    <button onClick={cotar} disabled={cotando} style={{ ...S.btnCep, opacity: cotando ? 0.6 : 1 }}>{cotando ? '…' : 'Calcular'}</button>
                  </div>
                  {erroFrete && <div style={S.freteErro}>{erroFrete}</div>}
                  {opcoesFrete && opcoesFrete.length > 0 && (
                    <div style={S.opcoes}>
                      {opcoesFrete.map(o => {
                        const on = servicoSel === o.id
                        return (
                          <button key={o.id} onClick={() => setServicoSel(o.id)} style={{ ...S.opcao, ...(on ? S.opcaoOn : {}) }}>
                            <span style={{ ...S.radio, ...(on ? S.radioOn : {}) }}>{on && <IconCheck size={12} color="#c084fc" />}</span>
                            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                              <div style={S.opNome}>{o.empresa} {o.nome}</div>
                              <div style={S.opPrazo}>chega em ~{o.prazoDias} dia{o.prazoDias > 1 ? 's' : ''} úteis</div>
                            </div>
                            <div style={S.opPreco}>{fmtBRL(o.precoCents)}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div style={{ padding: ehCalculado ? '6px 16px 4px' : '16px 16px 4px' }}>
                <div style={S.stepRow}><span style={S.stepN}>{stepPag}</span><span style={S.stepLbl}>Pagamento</span></div>
                <div style={S.pays}>
                  {(['pix', 'cartao'] as MetodoPagamento[]).map(m => {
                    const cm = m === 'pix' ? cPix : cCartao
                    const on = metodo === m
                    const blk = m === 'pix' && !PIX_DISPONIVEL
                    return (
                      <button key={m} onClick={() => !blk && setMetodo(m)} disabled={blk} title={blk ? 'O Pix está a caminho' : undefined} style={{ ...S.pay, ...(on ? S.payOn : {}), ...(blk ? S.payOff : {}) }}>
                        <span style={{ display: 'inline-flex' }}>{m === 'pix' ? <IconBolt size={17} color={on ? '#c084fc' : 'rgba(255,255,255,0.6)'} /> : <IconCard size={17} color={on ? '#c084fc' : 'rgba(255,255,255,0.6)'} />}</span>
                        <div style={S.payL}>{m === 'pix' ? 'Pix' : 'Cartão'}</div>
                        <div style={{ ...S.payP, color: blk ? 'rgba(255,255,255,0.3)' : on ? '#c084fc' : 'rgba(255,255,255,0.4)' }}>{blk ? 'em breve' : `+ ${fmtBRL(cm.acrescimoCents)}`}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={S.linhas}>
                <div style={S.linha}><span style={S.mut}>Produto</span><span>{fmtBRL(item.preco_cents)}</span></div>
                <div style={S.linha}>
                  <span style={{ ...S.mut, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{metodo === 'pix' ? 'Taxa do Pix' : 'Acréscimo do cartão'} <IcInfo /></span>
                  <span>{fmtBRL(c.acrescimoCents)}</span>
                </div>
                <div style={S.linha}>
                  <span style={S.mut}>Frete</span>
                  <span>{freteResolvido == null ? <span style={{ color: 'rgba(255,255,255,0.4)' }}>calcule acima</span> : freteResolvido === 0 ? <span style={{ color: '#22c55e' }}>Grátis</span> : fmtBRL(freteResolvido)}</span>
                </div>
                <div style={S.total}><span>Total</span><span style={S.totalVal}>{total == null ? '—' : fmtBRL(total)}</span></div>
              </div>

              {PIX_DISPONIVEL && metodo === 'cartao' && economia > 0 && (
                <div style={{ padding: '0 16px' }}>
                  <button onClick={() => setMetodo('pix')} style={S.dica}><IconBolt size={14} color="#22c55e" /> Pagando no Pix você economiza {fmtBRL(economia)}</button>
                </div>
              )}

              <div style={{ padding: '14px 16px 16px' }}>
                <button onClick={pagar} disabled={indo || precisaFrete} style={{ ...S.cta, opacity: (indo || precisaFrete) ? 0.6 : 1 }}>
                  {indo ? 'Abrindo pagamento…' : precisaFrete ? 'Calcule o frete para continuar' : !uid ? <>Entrar e comprar <IconArrowRight size={16} color="#fff" /></> : <>Pagar {total == null ? '' : fmtBRL(total)} <IconArrowRight size={16} color="#fff" /></>}
                </button>
                <div style={S.stripeLine}><IconShield size={14} color="rgba(255,255,255,0.4)" /><span>Pagamento pela Stripe · seus dados de cartão não passam pela Bynx</span></div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ───────── SELOS ───────── */}
      <div style={S.seals}>
        <span style={S.seal}><IconShield size={16} color="#22c55e" /><b style={S.sealB}>Conexão segura</b> SSL</span>
        <span style={S.seal}><IconShield size={16} color="#22c55e" />Processado por <span style={S.stripe}>stripe</span></span>
        <span style={S.seal}><IconCard size={16} color="#22c55e" />Não guardamos seu <b style={S.sealB}>cartão</b></span>
        <span style={S.seal}><IconShield size={16} color="#22c55e" />Dados protegidos <b style={S.sealB}>LGPD</b></span>
      </div>
      <div style={S.brands}>
        {['VISA', 'MASTERCARD', 'ELO', 'AMEX', 'PIX'].map(b => <span key={b} style={S.brand}>{b}</span>)}
      </div>

      <button onClick={() => window.history.back()} style={S.voltar}>← Voltar</button>
    </Casca>
  )
}

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      <div style={S.wrap}>{children}</div>
    </AppLayout>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#080a0f', color: '#f0f0f0', padding: '0 0 60px' },
  topbar: { padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1000, margin: '0 auto' },
  brand0: { display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' },
  mark: { width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: '#0a0a0a' },
  wm: { fontWeight: 800, letterSpacing: '0.12em', fontSize: 14, color: '#f0f0f0' },
  safe: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  wrap: { maxWidth: 1000, margin: '0 auto' },

  head: { padding: '24px 0 6px' },
  h1: { fontSize: 24, fontWeight: 800, margin: 0 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 },

  cols: { display: 'flex', gap: 18, padding: '16px 0 24px', alignItems: 'flex-start', flexWrap: 'wrap' },
  left: { flex: '1.15 1 320px', minWidth: 280 },
  right: { flex: '0.85 1 300px', minWidth: 280, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, background: 'rgba(255,255,255,0.02)', overflow: 'hidden' },

  heroRow: { display: 'flex', gap: 16 },
  heroImg: { width: 150, flexShrink: 0, aspectRatio: '0.72', borderRadius: 12, background: 'linear-gradient(160deg,#1a1030,#0f1628)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroName: { fontSize: 18, fontWeight: 800, lineHeight: 1.25 },
  chipRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  chip: { fontSize: 11, padding: '3px 9px', borderRadius: 7, background: 'rgba(96,165,250,0.14)', color: '#93c5fd' },
  heroPrice: { fontSize: 20, fontWeight: 800, marginTop: 14 },
  heroQtd: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  sellcard: { marginTop: 18, padding: 13, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 11 },
  avatar: { width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#0a0a0a', flexShrink: 0 },
  sellName: { fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center' },
  sellSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  verBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, color: 'rgba(255,255,255,0.7)', fontSize: 12, padding: '7px 12px', textDecoration: 'none', whiteSpace: 'nowrap' },

  howTit: { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 },
  howRow: { display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 13 },
  howIco: { flexShrink: 0, display: 'inline-flex', marginTop: 1 },
  howB: { fontSize: 13, fontWeight: 500 },
  howS: { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginTop: 1 },

  stepRow: { display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 10px' },
  stepN: { width: 19, height: 19, borderRadius: '50%', background: 'rgba(168,85,247,0.18)', color: '#c084fc', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  stepLbl: { fontSize: 13, fontWeight: 500 },

  cepRow: { display: 'flex', gap: 8, marginBottom: 8 },
  cepInput: { flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '9px 11px', fontSize: 13, fontWeight: 600, color: '#f0f0f0', outline: 'none' },
  btnCep: { flexShrink: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0', borderRadius: 10, padding: '0 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  freteErro: { fontSize: 12, color: '#fca5a5', marginBottom: 8 },
  opcoes: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 },
  opcao: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '9px 11px', cursor: 'pointer', color: '#f0f0f0' },
  opcaoOn: { borderColor: 'rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.06)' },
  radio: { flexShrink: 0, width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: '#a855f7' },
  opNome: { fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  opPrazo: { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
  opPreco: { fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' },

  pays: { display: 'flex', gap: 8 },
  pay: { flex: 1, minWidth: 0, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11, padding: '10px 8px', cursor: 'pointer', color: '#f0f0f0', textAlign: 'center' },
  payOff: { opacity: 0.5, cursor: 'not-allowed' },
  payOn: { border: '1.5px solid #a855f7', background: 'rgba(168,85,247,0.08)' },
  payL: { fontSize: 12, fontWeight: 500, marginTop: 3 },
  payP: { fontSize: 9, marginTop: 2 },

  linhas: { margin: '14px 16px 0', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' },
  linha: { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 7 },
  total: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 14, fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 3, paddingTop: 10 },
  totalVal: { fontSize: 20, fontWeight: 800, background: 'linear-gradient(90deg,#a855f7,#ec4899)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' },
  mut: { color: 'rgba(255,255,255,0.6)' },

  dica: { width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', borderRadius: 10, padding: '9px', fontSize: 12.5, fontWeight: 600, marginTop: 12, cursor: 'pointer' },
  cta: { width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 700, padding: 14, borderRadius: 13, border: 'none', cursor: 'pointer', background: 'linear-gradient(90deg,#a855f7,#ec4899)', color: '#fff' },
  stripeLine: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.5 },

  seals: { borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 22px', justifyContent: 'center' },
  seal: { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'rgba(255,255,255,0.55)' },
  sealB: { color: '#f0f0f0', fontWeight: 500 },
  stripe: { fontWeight: 800, letterSpacing: '-0.02em', color: '#8b85ff' },
  brands: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center', paddingBottom: 4 },
  brand: { fontSize: 10, fontWeight: 700, letterSpacing: '0.03em', padding: '4px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.08)' },

  aviso: { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f5b942', borderRadius: 10, padding: '11px 14px', fontSize: 13, textAlign: 'center' },
  erro: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 13, margin: '6px 0 0' },
  vazio: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 40, fontSize: 14 },
  voltar: { display: 'block', textAlign: 'center', margin: '8px auto 0', fontSize: 12.5, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%', padding: 0 },

  fallbackCard: { maxWidth: 460, margin: '24px auto 0', background: '#0d0f14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 24 },
  fallbackIco: { width: 52, height: 52, borderRadius: '50%', background: 'rgba(168,85,247,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' },
  fh1: { fontSize: 18, fontWeight: 800, margin: '10px 0 8px' },
  ftxt: { fontSize: 13.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, marginBottom: 16 },
}
