'use client'

import { CSSProperties, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { fmtBRL, PIX_DISPONIVEL, type MetodoPagamento } from '@/lib/comissao'
import { lojasNoCarrinho, itensDaLoja, remover, definirQtd, assinarCarrinho, type ItemCarrinho } from '@/lib/carrinho'
import { IconBox, IconTrash, IconTruck, IconPokeball, IconArrowRight, IconPlus, IconMinus, IconShield, IconLocation, IconStarFilled } from '@/components/ui/Icons'

/**
 * /carrinho — uma sacola POR LOJA.
 *
 * Cada loja tem a propria conta Connect e o proprio frete, entao nao existe
 * "pagar tudo junto": sao N checkouts, um por loja. A pagina deixa isso
 * explicito em vez de fingir um total unico que nao pode ser cobrado.
 *
 * ★ O cliente so guarda IDs (localStorage). Preco, nome, imagem e
 * disponibilidade vem SEMPRE de /api/carrinho — editar o localStorage nao
 * compra nada mais barato.
 */

interface ItemResumo {
  id: string
  tipo: 'carta' | 'produto'
  nome: string
  imagem: string | null
  preco_cents: number
  disponivel: boolean
  motivo?: string
  qtd: number
  estoque: number
  qtd_ajustada?: boolean
}
interface OpcaoFrete { id: number; nome: string; empresa: string; precoCents: number; prazoDias: number }
interface Resumo {
  loja: {
    id: string; nome: string; slug: string; pode_vender: boolean
    frete_modo: 'fixo' | 'calculado'
    logo_url: string | null; verificada: boolean
    cidade: string | null; estado: string | null; plano: string | null
    rating: { media: number; total: number } | null
    owner_user_id: string
  }
  itens: ItemResumo[]
  subtotal_cents: number
  acrescimo_cents: number
  frete_cents: number
  total_comprador_cents: number | null
  frete_pendente: boolean
  qtd_validos: number
}

/** Unidades da sacola, pro rotulo bater com o contador do header. */
function unidades(r: Resumo): number {
  return r.itens.reduce((s, i) => s + (i.disponivel ? i.qtd : 0), 0)
}

export default function CarrinhoPage() {
  const { openSignup } = useAuthModal()
  const [lojas, setLojas] = useState<string[]>([])
  const [itensPorLoja, setItensPorLoja] = useState<Record<string, ItemCarrinho[]>>({})
  const [resumos, setResumos] = useState<Record<string, Resumo>>({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [uid, setUid] = useState<string | null>(null)

  // frete calculado, por loja
  const [cep, setCep] = useState<Record<string, string>>({})
  const [opcoes, setOpcoes] = useState<Record<string, OpcaoFrete[] | null>>({})
  const [servico, setServico] = useState<Record<string, number | null>>({})
  const [cotando, setCotando] = useState<string | null>(null)
  const [indo, setIndo] = useState<string | null>(null)

  const metodo: MetodoPagamento = PIX_DISPONIVEL ? 'pix' : 'cartao'

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null))
  }, [])

  const lerLocal = useCallback(() => {
    const ls = lojasNoCarrinho()
    setLojas(ls)
    const mapa: Record<string, ItemCarrinho[]> = {}
    for (const l of ls) mapa[l] = itensDaLoja(l)
    setItensPorLoja(mapa)
    return { ls, mapa }
  }, [])

  const buscarResumo = useCallback(async (lojaId: string, itens: ItemCarrinho[], svc?: number | null, cepStr?: string) => {
    const r = await fetch('/api/carrinho?acao=resumo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loja_id: lojaId,
        itens: itens.map(i => ({ id: i.id, tipo: i.tipo, qtd: i.qtd })),
        metodo,
        ...(svc ? { servico: svc, cep: (cepStr || '').replace(/\D/g, '') } : {}),
      }),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j?.error || 'Falha ao carregar o carrinho.')
    return j as Resumo
  }, [metodo])

  const recarregar = useCallback(async () => {
    const { ls, mapa } = lerLocal()
    if (ls.length === 0) { setResumos({}); setCarregando(false); return }
    setCarregando(true)
    setErro(null)
    try {
      const out: Record<string, Resumo> = {}
      await Promise.all(ls.map(async l => {
        try { out[l] = await buscarResumo(l, mapa[l], servico[l], cep[l]) } catch { /* loja some da lista */ }
      }))
      setResumos(out)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
    // servico/cep entram de proposito fora das deps: quem re-cota chama direto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lerLocal, buscarResumo])

  useEffect(() => { recarregar() }, [recarregar])
  // Mudanca no carrinho (qtd ou remocao) INVALIDA a cotacao: o volume mudou e o
  // servidor re-cota na hora de fechar. Mostrar o frete antigo enganaria.
  useEffect(() => assinarCarrinho(() => {
    setOpcoes({})
    setServico({})
    recarregar()
  }), [recarregar])

  async function cotar(lojaId: string) {
    const cd = (cep[lojaId] || '').replace(/\D/g, '')
    if (cd.length !== 8) { setErro('Digite um CEP com 8 dígitos.'); return }
    setCotando(lojaId); setErro(null)
    try {
      const r = await fetch('/api/frete/cotar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'carrinho',
          loja_id: lojaId,
          itens: (itensPorLoja[lojaId] || []).map(i => ({ id: i.id, tipo: i.tipo, qtd: i.qtd })),
          cep: cd,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Não consegui calcular o frete.')
      const ops = (j.opcoes || []) as OpcaoFrete[]
      setOpcoes(o => ({ ...o, [lojaId]: ops }))
      if (ops.length) {
        setServico(sv => ({ ...sv, [lojaId]: ops[0].id }))
        const novo = await buscarResumo(lojaId, itensPorLoja[lojaId] || [], ops[0].id, cd)
        setResumos(rs => ({ ...rs, [lojaId]: novo }))
      }
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCotando(null)
    }
  }

  async function escolherServico(lojaId: string, id: number) {
    setServico(sv => ({ ...sv, [lojaId]: id }))
    try {
      const novo = await buscarResumo(lojaId, itensPorLoja[lojaId] || [], id, cep[lojaId])
      setResumos(rs => ({ ...rs, [lojaId]: novo }))
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function finalizar(lojaId: string) {
    if (!uid) { openSignup(); return }
    setIndo(lojaId); setErro(null)
    try {
      const { data } = await supabase.auth.getSession()
      const cd = (cep[lojaId] || '').replace(/\D/g, '')
      const r = await fetch('/api/carrinho?acao=checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          loja_id: lojaId,
          itens: (itensPorLoja[lojaId] || []).map(i => ({ id: i.id, tipo: i.tipo, qtd: i.qtd })),
          metodo,
          ...(servico[lojaId] ? { servico: servico[lojaId], cep: cd } : {}),
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Não foi possível iniciar a compra.')
      window.location.href = j.url
    } catch (e) {
      setErro((e as Error).message)
      setIndo(null)
    }
  }

  const totalUnidades = Object.values(resumos).reduce((acc, r) => acc + unidades(r), 0)
  const vazio = !carregando && lojas.length === 0

  return (
    <AppLayout>
      <style>{`
        .bx-cart-cta{transition:transform .15s ease, box-shadow .15s ease}
        .bx-cart-cta:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(0,0,0,0.4)}
        @media (prefers-reduced-motion: reduce){
          .bx-cart-cta{transition:none}
          .bx-cart-cta:hover{transform:none}
        }
      `}</style>

      <div style={S.wrap}>
        {/* Header padrao do app (mesmo de /compras, /minha-colecao...). Antes
            era um <h1> solto, que nao seguia o padrao de nenhuma outra tela. */}
        <PageHeader
          trilha={[INICIO, { name: 'Carrinho', href: '/carrinho' }]}
          titulo="Seu carrinho"
          descricao="Revise os itens, calcule o frete e finalize a compra."
          stat={totalUnidades > 0
            ? `${totalUnidades} ${totalUnidades === 1 ? 'unidade' : 'unidades'} · ${lojas.length} ${lojas.length === 1 ? 'loja' : 'lojas'}`
            : undefined}
        />

        {erro && <div style={S.erro}>{erro}</div>}

        {carregando && <p style={S.mut}>Carregando…</p>}

        {vazio && (
          <div style={S.vazio}>
            <IconBox size={30} color="var(--bx-text-faint)" />
            <p style={S.vazioTit}>Seu carrinho está vazio</p>
            <p style={S.vazioSub}>Adicione produtos das lojas parceiras e finalize a compra aqui.</p>
            <Link href="/lojas" className="bx-cart-cta" style={S.ctaGhost}>Ver lojas</Link>
          </div>
        )}

        {lojas.map(lojaId => {
          const r = resumos[lojaId]
          if (!r) return null
          const ops = opcoes[lojaId]
          const calc = r.loja.frete_modo === 'calculado'
          const podeFechar = r.qtd_validos > 0 && r.loja.pode_vender && !r.frete_pendente

          return (
            <section key={lojaId} style={S.card}>
              {/* ★ Cabecalho de CONFIANCA da loja. O atrito real aqui nao e
                  preco, e comprar de uma loja que voce nao conhece — entao o
                  card abre dizendo QUEM esta vendendo: logo, selo de
                  verificada, cidade e reputacao. */}
              <div style={S.lojaTopo}>
                <Link href={`/lojas/${r.loja.slug}`} style={S.lojaBloco}>
                  {r.loja.logo_url ? (
                    <Image src={r.loja.logo_url} alt={r.loja.nome} width={38} height={38} sizes="38px" style={S.lojaLogo} />
                  ) : (
                    <span style={{ ...S.lojaLogo, ...S.lojaLogoVazia }}>{(r.loja.nome || 'L').charAt(0).toUpperCase()}</span>
                  )}
                  <span style={{ minWidth: 0 }}>
                    <span style={S.lojaNome}>
                      {r.loja.nome}
                      {r.loja.verificada && (
                        <span style={S.selo} title="Loja verificada">
                          <IconShield size={12} color="var(--bx-green)" />
                        </span>
                      )}
                    </span>
                    <span style={S.lojaMeta}>
                      {r.loja.cidade && (
                        <span style={S.metaItem}>
                          <IconLocation size={11} color="var(--bx-text-3)" />
                          {r.loja.cidade}{r.loja.estado ? `, ${r.loja.estado}` : ''}
                        </span>
                      )}
                      {r.loja.rating && (
                        <span style={S.metaItem}>
                          <IconStarFilled size={11} color="var(--ac-1)" />
                          {r.loja.rating.media.toFixed(1).replace('.', ',')}
                          <span style={S.mutSm}>({r.loja.rating.total})</span>
                        </span>
                      )}
                      <span style={S.metaItem}>
                        <IconShield size={11} color="var(--bx-text-3)" /> Vendido e enviado pela loja
                      </span>
                    </span>
                  </span>
                </Link>
                <span style={S.mutSm}>{unidades(r)} {unidades(r) === 1 ? 'unidade' : 'unidades'}</span>
              </div>

              {r.itens.map(it => (
                <div key={it.id} style={S.linha}>
                  <div style={S.thumb}>
                    {it.imagem
                      ? <Image src={it.imagem} alt={it.nome} width={54} height={54} style={{ width: '100%', height: '100%', objectFit: 'cover' }} sizes="54px" />
                      : <IconPokeball size={20} color="var(--bx-text-faint)" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...S.itNome, ...(it.disponivel ? {} : S.riscado) }}>{it.nome}</p>
                    {it.disponivel ? (
                      <>
                        <p style={S.itPreco}>
                          {fmtBRL(it.preco_cents * it.qtd)}
                          {it.qtd > 1 && <span style={S.itUnit}> · {it.qtd}x {fmtBRL(it.preco_cents)}</span>}
                        </p>
                        {it.tipo === 'produto' && it.estoque > 1 && (
                          <div style={S.qtdBox}>
                            <button
                              type="button"
                              onClick={() => definirQtd(it.id, it.qtd - 1)}
                              disabled={it.qtd <= 1}
                              style={{ ...S.qtdBtn, opacity: it.qtd <= 1 ? 0.35 : 1 }}
                              aria-label={`Diminuir ${it.nome}`}
                            >
                              <IconMinus size={14} color="currentColor" />
                            </button>
                            <span style={S.qtdNum} aria-live="polite">{it.qtd}</span>
                            <button
                              type="button"
                              onClick={() => definirQtd(it.id, it.qtd + 1)}
                              disabled={it.qtd >= it.estoque}
                              style={{ ...S.qtdBtn, opacity: it.qtd >= it.estoque ? 0.35 : 1 }}
                              aria-label={`Aumentar ${it.nome}`}
                            >
                              <IconPlus size={14} color="currentColor" />
                            </button>
                          </div>
                        )}
                        {it.qtd_ajustada && (
                          <p style={S.itAviso}>
                            A loja tem {it.estoque} {it.estoque === 1 ? 'unidade' : 'unidades'} — ajustamos a quantidade.
                          </p>
                        )}
                      </>
                    ) : (
                      <p style={S.itErro}>Indisponível — {it.motivo}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => remover(it.id)} style={S.rem} aria-label={`Remover ${it.nome}`}>
                    <IconTrash size={16} color="currentColor" />
                  </button>
                </div>
              ))}

              {calc && (
                <div style={S.freteBox}>
                  <div style={S.freteTop}>
                    <IconTruck size={15} color="var(--bx-text-3)" />
                    <span style={S.freteTit}>Frete</span>
                  </div>
                  <div style={S.cepRow}>
                    <input
                      value={cep[lojaId] || ''}
                      onChange={e => setCep(c => ({ ...c, [lojaId]: e.target.value }))}
                      placeholder="Seu CEP"
                      inputMode="numeric"
                      maxLength={9}
                      style={S.input}
                      aria-label="CEP de entrega"
                    />
                    <button type="button" onClick={() => cotar(lojaId)} disabled={cotando === lojaId} style={S.btnCalc}>
                      {cotando === lojaId ? 'Calculando…' : 'Calcular'}
                    </button>
                  </div>
                  {ops && ops.length > 0 && (
                    <div style={S.opcoes}>
                      {ops.map(o => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => escolherServico(lojaId, o.id)}
                          style={{ ...S.opcao, ...(servico[lojaId] === o.id ? S.opcaoOn : {}) }}
                        >
                          <span style={S.opNome}>{o.empresa} {o.nome}</span>
                          <span style={S.opPreco}>{fmtBRL(o.precoCents)}</span>
                          <span style={S.opPrazo}>{o.prazoDias} {o.prazoDias === 1 ? 'dia' : 'dias'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={S.conta}>
                <div style={S.contaLinha}><span style={S.mut}>Subtotal</span><span>{fmtBRL(r.subtotal_cents)}</span></div>
                {r.acrescimo_cents > 0 && (
                  <div style={S.contaLinha}><span style={S.mut}>Acréscimo do cartão</span><span>{fmtBRL(r.acrescimo_cents)}</span></div>
                )}
                <div style={S.contaLinha}>
                  <span style={S.mut}>Frete</span>
                  <span>{r.frete_pendente ? 'a calcular' : r.frete_cents > 0 ? fmtBRL(r.frete_cents) : 'grátis'}</span>
                </div>
                <div style={S.total}>
                  <span>Total</span>
                  <span>{r.total_comprador_cents == null ? '—' : fmtBRL(r.total_comprador_cents)}</span>
                </div>
              </div>

              {!r.loja.pode_vender ? (
                <p style={S.aviso}>Esta loja ainda não finaliza vendas pela Bynx. Fale com ela pela página da loja.</p>
              ) : r.qtd_validos === 0 ? (
                <p style={S.aviso}>Nenhum item deste carrinho está disponível.</p>
              ) : (
                <button
                  type="button"
                  onClick={() => finalizar(lojaId)}
                  disabled={!podeFechar || indo === lojaId}
                  className="bx-ctx-comprador bx-cart-cta"
                  style={{ ...S.cta, opacity: !podeFechar || indo === lojaId ? 0.55 : 1 }}
                >
                  {indo === lojaId ? 'Abrindo pagamento…' : r.frete_pendente ? 'Calcule o frete' : 'Finalizar compra'}
                  {podeFechar && indo !== lojaId && <IconArrowRight size={17} color="currentColor" />}
                </button>
              )}
            </section>
          )
        })}

        {lojas.length > 1 && (
          <p style={S.nota}>
            Cada loja tem o próprio frete e o próprio pagamento, então a compra é finalizada uma loja por vez.
          </p>
        )}
      </div>
    </AppLayout>
  )
}

const S: Record<string, CSSProperties> = {
  wrap: { maxWidth: 720, margin: '0 auto', width: '100%', paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: '4px 0 18px' },
  mut: { color: 'var(--bx-text-3)' },
  mutSm: { color: 'var(--bx-text-3)', fontSize: 12 },

  erro: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#fca5a5', borderRadius: 10, padding: '11px 13px', fontSize: 13, marginBottom: 14,
  },

  vazio: {
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 12,
    padding: '38px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center',
  },
  vazioTit: { fontSize: 15, fontWeight: 700, margin: 0 },
  vazioSub: { fontSize: 13, color: 'var(--bx-text-3)', margin: 0, maxWidth: 300, lineHeight: 1.5 },
  ctaGhost: {
    marginTop: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 44, padding: '0 20px', borderRadius: 10,
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)',
    color: 'var(--bx-text)', fontWeight: 700, fontSize: 13.5, textDecoration: 'none',
  },

  card: {
    background: 'var(--bx-bg-elev)', border: '1px solid var(--bx-border)',
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  lojaTopo: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--bx-border)', marginBottom: 4,
  },
  lojaBloco: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, textDecoration: 'none', color: 'inherit', minHeight: 44 },
  lojaLogo: { width: 38, height: 38, borderRadius: 9, objectFit: 'cover', flex: 'none', background: 'var(--bx-surface-2)' },
  lojaLogoVazia: { display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: 'var(--bx-text-3)' },
  lojaNome: { fontSize: 14.5, fontWeight: 800, color: 'var(--bx-text)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 },
  selo: { display: 'inline-flex', alignItems: 'center' },
  lojaMeta: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 3 },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, color: 'var(--bx-text-3)', fontWeight: 600 },

  linha: { display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderBottom: '1px solid var(--bx-border)' },
  thumb: {
    width: 54, height: 54, borderRadius: 9, flex: 'none', overflow: 'hidden',
    background: 'var(--bx-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  itNome: { fontSize: 13.5, fontWeight: 700, margin: 0, lineHeight: 1.3 },
  riscado: { textDecoration: 'line-through', color: 'var(--bx-text-3)' },
  itPreco: { fontSize: 13, color: 'var(--ac-1)', fontWeight: 800, margin: '3px 0 0' },
  itUnit: { fontSize: 11.5, color: 'var(--bx-text-3)', fontWeight: 600 },
  itAviso: { fontSize: 11, color: '#fbbf24', margin: '5px 0 0', lineHeight: 1.4 },
  qtdBox: {
    display: 'inline-flex', alignItems: 'center', marginTop: 7,
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)',
    borderRadius: 9, overflow: 'hidden',
  },
  qtdBtn: {
    width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', color: 'var(--bx-text)',
    cursor: 'pointer', fontFamily: 'inherit', padding: 0,
  },
  qtdNum: { minWidth: 28, textAlign: 'center', fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  itErro: { fontSize: 11.5, color: '#fca5a5', margin: '3px 0 0' },
  rem: {
    width: 44, height: 44, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', color: 'var(--bx-text-3)', cursor: 'pointer', fontFamily: 'inherit',
  },

  freteBox: { marginTop: 14, background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 10, padding: 12 },
  freteTop: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 },
  freteTit: { fontSize: 11.5, fontWeight: 700, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  cepRow: { display: 'flex', gap: 8 },
  input: {
    flex: 1, minWidth: 0, minHeight: 44, boxSizing: 'border-box',
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', borderRadius: 9,
    padding: '0 12px', fontSize: 16, color: 'var(--bx-text)', outline: 'none', fontFamily: 'inherit',
  },
  btnCalc: {
    minHeight: 44, padding: '0 16px', borderRadius: 9, flex: 'none',
    background: 'var(--bx-surface-3)', border: '1px solid var(--bx-border-2)',
    color: 'var(--bx-text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  opcoes: { display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 },
  opcao: {
    display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '8px 12px',
    borderRadius: 9, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)',
    color: 'var(--bx-text-2)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontSize: 13,
  },
  opcaoOn: { borderColor: 'var(--ac-1)', background: 'rgba(var(--ac-1-rgb),0.1)', color: 'var(--bx-text)' },
  opNome: { flex: 1, minWidth: 0, fontWeight: 700 },
  opPreco: { fontWeight: 800 },
  opPrazo: { fontSize: 11.5, color: 'var(--bx-text-3)', flex: 'none' },

  conta: { marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--bx-border)' },
  contaLinha: { display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 7 },
  total: {
    display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800,
    paddingTop: 9, borderTop: '1px solid var(--bx-border)', marginTop: 4,
  },

  cta: {
    width: '100%', marginTop: 14, minHeight: 50, borderRadius: 11,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)',
    border: 'none', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit',
  },
  aviso: {
    marginTop: 14, fontSize: 12.5, color: 'var(--bx-text-3)', lineHeight: 1.55,
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 10, padding: '11px 13px',
  },
  nota: { fontSize: 12, color: 'var(--bx-text-3)', textAlign: 'center', lineHeight: 1.55, marginTop: 4 },
}
