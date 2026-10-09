'use client'

/**
 * src/app/carta/[id]/CardClient.tsx
 *
 * CLIENT COMPONENT da página de carta (S38: SEO Fase 1).
 *
 * Antes (S33-S37): era o `page.tsx` inteiro com 'use client', fazia fetch
 * via useEffect no browser. Sem SSR = sem SEO.
 *
 * Agora (S38): page.tsx (server) faz fetch + SEO + Schema.org e passa data
 * pré-fetched como prop. Este componente fica responsável apenas pela UI
 * interativa (botão Copiar link). Sem loading state, sem fetch client.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import SinalCartaVista from '@/components/cards/SinalCartaVista'
import PromoBanner from '@/components/ui/PromoBanner'
import Breadcrumb from '@/components/ui/Breadcrumb'
import PriceHistory from '@/components/ui/PriceHistory'
import WatchButton from '@/components/ui/WatchButton'
import { IconCheck, IconCopy, IconPlus } from '@/components/ui/Icons'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { adicionarCartaPublica } from '@/lib/adicionarCartaPublica'
import { gravarIntencao, lerIntencao, limparIntencao } from '@/lib/intencao'
import { trackFirstCardAdded } from '@/lib/analytics'
import { raridadePt, subtipoPt, tipoTcgPt, idiomaPt, regiaoPt, legalidadePt } from '@/lib/pokedexTextos'

const fmtData = (iso: string | null | undefined) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(v || 0)

const TYPE_COLORS: Record<string, string> = {
  Grass: '#22c55e',
  Fire: '#ef4444',
  Water: '#60a5fa',
  Lightning: '#f59e0b',
  Psychic: '#a855f7',
  Fighting: '#f97316',
  Darkness: '#6b7280',
  Metal: '#94a3b8',
  Dragon: '#8b5cf6',
  Colorless: '#d1d5db',
  Fairy: '#ec4899',
}

// Shape espelhado de NormalizedCard em page.tsx (mantenha sincronizado).
type CardProps = {
  card: {
    id: string
    name: string
    number: string | null
    setName: string | null
    setTotal: number | null
    setReleaseYear: string | null
    rarity: string | null
    hp: number | null
    types: string[]
    imageSmall: string | null
    imageLarge: string | null
    attacks: Array<{ name: string; text?: string; damage?: string; cost?: string[] }> | null
    // Ficha da carta (Fase 2 do #490). Vazio = a carta nao tem o dado.
    setNamePt?: string | null
    artist?: string | null
    subtypes?: string[]
    weaknesses?: Array<{ type: string; value: string }>
    resistances?: Array<{ type: string; value: string }>
    retreatCost?: string[]
    legalities?: Record<string, string> | null
    regiao?: string | null
    setSeries?: string | null
    flavorText?: string | null
    ultimaVenda?: { cents: number; variante: string | null; condicao: string | null; em: string | null } | null
    vendas3m?: { label: string | null; medioCents: number | null; em: string | null } | null
    /** Guard de preco: valor nao serve como referencia (card_preco_baseline). */
    precoSuspeito?: boolean
    /** Mediana historica da carta; so vem preenchida quando precoSuspeito. */
    precoMediana?: number | null
    /** Quantos levantamentos formaram a mediana. */
    precoNSnaps?: number | null
    precoMin: number | null
    precoMedio: number | null
    precoMax: number | null
    variantes?: Array<{ key: string; label: string; min: number | null; med: number | null; max: number | null }>
    // Range da varredura de listagem. Tri-estado, e os tres significam coisas
    // diferentes: null = nunca varrida · 0 = varrida e sem oferta · >0 = tem
    // oferta. NAO usar como preco (cruza variante) — so no estado vazio.
    ligaRangeMin?: number | null
    ligaRangeMax?: number | null
    slug?: string | null
    idioma?: string | null
  }
  breadcrumb?: { name: string; href: string }[]
  /** Anuncios compraveis da carta na Bynx (ja filtrados por ofertasParaDivulgacao). */
  ofertas?: { n: number; menor: number | null; href: string | null }
  children?: ReactNode
}

export default function CardClient({ card, children, breadcrumb, ofertas: ofertasProp }: CardProps) {
  const [copied, setCopied] = useState(false)
  const pathname = usePathname()
  const { openSignup } = useAuthModal()
  const ofertas = ofertasProp || { n: 0, menor: null, href: null }

  // ─── Sessao e colecao (08/10/2026) ───────────────────────────────────────
  // O HTML do servidor sai no estado deslogado (botao "Adicionar"); o efeito
  // troca para "Na sua colecao" quando ha sessao e a carta ja esta la. Mesmo
  // padrao do WatchButton: renderiza, depois confere.
  const [naColecao, setNaColecao] = useState(false)
  const [adicionando, setAdicionando] = useState(false)
  const [avisoAdicionar, setAvisoAdicionar] = useState<string | null>(null)

  const slugCarta = card.slug || card.id
  const cartaParaGravar = {
    id: card.id,
    name: card.name,
    number: card.number,
    setTotal: card.setTotal,
    imageLarge: card.imageLarge,
    imageSmall: card.imageSmall,
    rarity: card.rarity,
    setName: card.setName,
    idioma: card.idioma ?? null,
  }

  async function gravar(uid: string, variante: string): Promise<boolean> {
    const r = await adicionarCartaPublica(uid, { ...cartaParaGravar, variante })
    if (r.ok) {
      if (!r.jaTinha) trackFirstCardAdded(uid)
      setAvisoAdicionar(null)
      return true
    }
    setAvisoAdicionar(
      r.motivo === 'limite'
        ? `Sua coleção chegou ao limite de ${r.limite} cartas do plano.`
        : 'Não deu para adicionar agora. Tente de novo em instantes.',
    )
    return false
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id ?? null
      if (!active || !uid) return
      const { data: row } = await supabase
        .from('user_cards')
        .select('id')
        .eq('user_id', uid)
        .eq('pokemon_api_id', card.id)
        .eq('graduada', false)
        .limit(1)
        .maybeSingle()
      if (!active) return
      let tem = !!row

      // Intencao pendente: ?add=<id> na URL (sobrevive ao e-mail de
      // confirmacao em outro navegador) ou o que ficou no localStorage.
      const params = new URLSearchParams(window.location.search)
      const pendente = lerIntencao()
      const pedido =
        params.get('add') === card.id ||
        (pendente?.tipo === 'add' && pendente.cardId === card.id)
      if (pedido) {
        if (!tem) tem = await gravar(uid, pendente?.variante || 'normal')
        limparIntencao()
        if (params.has('add')) {
          params.delete('add')
          const q = params.toString()
          window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : ''))
        }
      }
      if (active) setNaColecao(tem)
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id])

  async function adicionar() {
    if (adicionando) return
    const { data } = await supabase.auth.getUser()
    const uid = data.user?.id
    if (!uid) {
      // Deslogado: guarda a intencao e abre o cadastro. O `next` carrega o
      // ?add= porque o e-mail pode abrir em outro navegador.
      gravarIntencao({ tipo: 'add', cardId: card.id, slug: slugCarta, variante: varSel })
      openSignup({ next: `/carta/${slugCarta}?add=${encodeURIComponent(card.id)}` })
      return
    }
    setAdicionando(true)
    const ok = await gravar(uid, varSel)
    setAdicionando(false)
    if (ok) setNaColecao(true)
  }
  const variantes = card.variantes && card.variantes.length ? card.variantes : []
  const [varSel, setVarSel] = useState<string>(variantes[0]?.key || 'normal')
  const vAtual = variantes.find((v) => v.key === varSel) || variantes[0] || null
  // ★ Carta marcada pelo guard E com mediana historica (08/10/2026): a mediana
  // vira a referencia e a faixa de hoje fica atras de um toque. Nasce fechada
  // de proposito -- assim a oferta inflada NAO entra no HTML do servidor, que
  // e o que o Google e os modelos de IA leem. Marcada sem mediana cai no
  // comportamento antigo (faixa visivel e apagada).
  const refHistorica = card.precoSuspeito && card.precoMediana && card.precoMediana > 0 ? card.precoMediana : null
  const [verOferta, setVerOferta] = useState(false)

  // O numero grande da primeira dobra: a mediana quando o guard marcou, senao
  // o menor preco da variante escolhida. Sem nenhum dos dois, o box nao
  // aparece e o estado vazio do bloco de preco explica o porque.
  const valeNum =
    refHistorica ??
    (vAtual?.min && vAtual.min > 0 ? vAtual.min : card.precoMin && card.precoMin > 0 && !card.precoSuspeito ? card.precoMin : null)
  // Minimo = medio = maximo e "uma oferta", nao uma faixa: mostrar o mesmo
  // numero tres vezes em tres cores confundia (UX, 08/10).
  const umaOferta =
    !refHistorica &&
    !!vAtual &&
    vAtual.min != null &&
    vAtual.min > 0 &&
    vAtual.min === vAtual.med &&
    vAtual.med === vAtual.max
  const notaContexto =
    ofertas.n > 0
      ? `${ofertas.n} ${ofertas.n === 1 ? 'anúncio' : 'anúncios'} na Bynx${ofertas.menor != null ? `, a partir de ${fmt(ofertas.menor)}` : ''}.`
      : umaOferta
        ? 'Uma oferta à venda hoje no Brasil. Ninguém está vendendo na Bynx ainda.'
        : 'Ninguém está vendendo esta carta na Bynx ainda.'

  // ─── Estado vazio: por que a carta nao tem preco? (BRIEF-LIGA-ZENROWS 10.8)
  //
  // Ate 21/08/2026 toda carta sem preco dizia "Preco ainda nao cadastrado" —
  // texto que poe a culpa na Bynx quando, na maioria das 11.792 cartas nessa
  // situacao, a verdade e outra: ninguem esta vendendo. A varredura de
  // listagem sabe diferenciar, e "ninguem esta vendendo" e INFORMACAO pra quem
  // coleciona, nao ausencia de dado.
  //
  // O range NAO vira "Minimo"/"Maximo" aqui: ele cruza variante (o min pode
  // ser do normal e o max do reverse), e o grid logo acima e por variante.
  // Duas coisas com o mesmo nome e escopo diferente, lado a lado, e como o
  // leitor confunde uma com a outra. Por isso so entra como "a partir de".
  const rangeMin = card.ligaRangeMin
  const semOferta = rangeMin != null && rangeMin <= 0
  const temOfertaSemDetalhe = rangeMin != null && rangeMin > 0
  const vazioTitulo = semOferta
    ? 'Sem oferta no Mercado Brasileiro no momento'
    : temOfertaSemDetalhe
      ? `Ofertas a partir de ${fmt(rangeMin)}`
      : 'Preço ainda não cadastrado.'

  const color = TYPE_COLORS[card.types[0]] || '#f59e0b'

  function handleCopy() {
    navigator.clipboard?.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const numLabel = card.number ? (card.setTotal ? card.number + '/' + card.setTotal : '#' + card.number) : ''
  const imgAlt = 'Carta ' + card.name + (numLabel ? ' ' + numLabel : '') + (card.setName ? ' do set ' + card.setName : '') + ' — Pokémon TCG | Bynx'

  // Linhas da ficha: so o que existe. Tipo/raridade/estagio traduzidos pelos
  // mesmos tradutores da Pokedex; o custo de recuo vira "2 (Incolor, Incolor)".
  const ficha: Array<[string, string]> = []
  const linha = (k: string, v: string | null | undefined) => {
    if (v) ficha.push([k, v])
  }
  linha('Número', numLabel || null)
  linha('Set', card.setNamePt && card.setNamePt !== card.setName ? `${card.setNamePt} (${card.setName})` : card.setName)
  linha('Série', card.setSeries)
  linha('Raridade', raridadePt(card.rarity))
  linha('Estágio', card.subtypes?.length ? card.subtypes.map(subtipoPt).join(' · ') : null)
  linha('Tipo', card.types.length ? card.types.map(tipoTcgPt).join(' · ') : null)
  linha('HP', card.hp ? String(card.hp) : null)
  linha('Fraqueza', card.weaknesses?.length ? card.weaknesses.map(w => `${tipoTcgPt(w.type)} ${w.value}`.trim()).join(' · ') : null)
  linha('Resistência', card.resistances?.length ? card.resistances.map(r => `${tipoTcgPt(r.type)} ${r.value}`.trim()).join(' · ') : null)
  linha('Custo de recuo', card.retreatCost?.length ? `${card.retreatCost.length} (${card.retreatCost.map(tipoTcgPt).join(', ')})` : null)
  linha('Ilustrador', card.artist)
  linha(
    'Legalidade',
    card.legalities
      ? ['standard', 'expanded']
          .filter(f => card.legalities?.[f])
          .map(f => `${f === 'standard' ? 'Standard' : 'Expanded'}: ${legalidadePt(card.legalities?.[f])}`)
          .join(' · ') || null
      : null,
  )
  linha('Ano', card.setReleaseYear)
  linha('Idioma', idiomaPt(card.idioma))
  linha('Região', regiaoPt(card.regiao))
  if (card.ultimaVenda) {
    const detalhe = [card.ultimaVenda.variante, card.ultimaVenda.condicao].filter(Boolean).join(', ')
    const quando = fmtData(card.ultimaVenda.em)
    linha('Última venda', `${fmt(card.ultimaVenda.cents / 100)}${detalhe ? ` (${detalhe})` : ''}${quando ? ` em ${quando}` : ''}`)
  }
  if (card.vendas3m && (card.vendas3m.label || card.vendas3m.medioCents)) {
    const base = [card.vendas3m.label, card.vendas3m.medioCents ? `média ${fmt(card.vendas3m.medioCents / 100)}` : null]
      .filter(Boolean)
      .join(', ')
    const quando = fmtData(card.vendas3m.em)
    linha('Vendas em 3 meses', `${base}${quando ? ` (${quando})` : ''}`)
  }


  return (
    <>
    {/* Sinal "carta acessada". card.id (ja resolvido pelo servidor), NUNCA o
        param da rota: a rota aceita id legado E slug, e contar pelo param
        contaria a mesma carta duas vezes. */}
    <SinalCartaVista cardId={card.id} tipo="view_pub" />
    <div
      style={{
        minHeight: '100vh',
        background: '#080a0f',
        color: '#f0f0f0',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <PublicHeader />

      <main className="bx-gutter" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' }}>
        <Breadcrumb items={breadcrumb || []} />
        {/* ★ PRIMEIRA DOBRA REFEITA (08/10/2026, mockup aprovado pelo Du).
            Antes: imagem de 260 px no topo e o preco em 822 px -- abaixo da
            dobra de 812 do celular, com o banner de cookies por cima. Medido
            em 375x812 pelo agente de UX. Agora a pagina responde "quanto
            vale" a ~300 px, a imagem vira confirmacao (148 px) e o botao
            primario e o que a pagina nunca teve: ADICIONAR A COLECAO.
            Deslogado, ele grava a intencao e abre o cadastro; a carta entra
            no retorno (?add= no next + localStorage, ver src/lib/intencao.ts).
            Por que: 6 cadastros com landing /carta, 1 com carta, 0 Pro,
            nenhum voltou depois do 1o dia -- a pagina era um beco sem saida. */}
        <section style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 4 }}>
            {card.name}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--bx-text-2)', marginBottom: 12 }}>
            {numLabel}
            {card.setName ? (
              <>
                {' · '}
                <b style={{ color: 'var(--bx-text)', fontWeight: 500 }}>{card.setNamePt || card.setName}</b>
                {card.setNamePt && card.setNamePt !== card.setName ? ` (${card.setName})` : ''}
              </>
            ) : null}
            {card.setReleaseYear ? ` · ${card.setReleaseYear}` : ''}
          </p>

          {valeNum != null && (
            <div style={{ padding: '12px 14px', background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 12 }}>
              <p style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bx-text-3)' }}>
                {refHistorica ? 'Referência histórica' : 'Vale a partir de'}
              </p>
              <p style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.05, marginTop: 2 }}>{fmt(valeNum)}</p>
              <p style={{ fontSize: 11, color: 'var(--bx-text-3)', marginTop: 4 }}>
                {refHistorica ? (
                  card.precoNSnaps && card.precoNSnaps > 1
                    ? `Mediana de ${card.precoNSnaps} levantamentos da Bynx para esta carta.`
                    : 'Mediana dos levantamentos da Bynx para esta carta.'
                ) : (
                  <>Menor preço à venda no <b style={{ color: 'var(--ac-1)', fontWeight: 600 }}>Mercado Brasileiro</b></>
                )}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 14, marginTop: 12, alignItems: 'flex-start' }}>
            {/* next/image: a fonte e um PNG de ~1,6 MB; o otimizador entrega
                WebP no tamanho pedido. `priority` porque segue sendo a LCP. */}
            <Image
              src={card.imageLarge || card.imageSmall || '/og-image.jpg'}
              alt={imgAlt}
              width={148}
              height={206}
              priority
              style={{
                width: 148,
                height: 'auto',
                borderRadius: 10,
                boxShadow: `0 0 32px ${color}33, 0 16px 40px rgba(0,0,0,0.5)`,
                display: 'block',
                flex: 'none',
              }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {card.types.map((t: string) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '5px 10px',
                      borderRadius: 100,
                      background: (TYPE_COLORS[t] || '#f59e0b') + '22',
                      color: TYPE_COLORS[t] || '#f59e0b',
                      border: `1px solid ${(TYPE_COLORS[t] || '#f59e0b')}44`,
                    }}
                  >
                    {t}
                  </span>
                ))}
                {card.rarity && (
                  <span style={{ fontSize: 12, padding: '5px 10px', borderRadius: 100, background: 'var(--bx-surface-2)', color: 'var(--bx-text-2)', border: '1px solid var(--bx-border)' }}>
                    {card.rarity}
                  </span>
                )}
                {card.hp && (
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 100, background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
                    HP {card.hp}
                  </span>
                )}
              </div>

              {variantes.length > 1 && (
                <>
                  <p style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bx-text-3)', marginTop: 2 }}>Variante</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {variantes.map((v) => {
                      const on = v.key === varSel
                      return (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => setVarSel(v.key)}
                          aria-pressed={on}
                          style={{
                            fontSize: 12,
                            minHeight: 36,
                            padding: '6px 12px',
                            borderRadius: 8,
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                            border: `1px solid ${on ? 'rgba(var(--ac-1-rgb),0.5)' : 'var(--bx-border)'}`,
                            background: on ? 'rgba(var(--ac-1-rgb),0.12)' : 'var(--bx-surface)',
                            color: on ? 'var(--ac-1)' : 'var(--bx-text-2)',
                            transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
                          }}
                        >
                          {v.label}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <p style={{ fontSize: 11.5, color: 'var(--bx-text-3)', lineHeight: 1.4 }}>{notaContexto}</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {naColecao ? (
              <Link
                href="/minha-colecao"
                style={{
                  height: 48,
                  borderRadius: 10,
                  background: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.35)',
                  color: 'var(--bx-green)',
                  fontWeight: 700,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  textDecoration: 'none',
                }}
              >
                <IconCheck size={18} />
                Na sua coleção <span style={{ fontWeight: 500, opacity: 0.8 }}>· Ver</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={adicionar}
                disabled={adicionando}
                style={{
                  height: 48,
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--bx-brand)',
                  color: 'var(--bx-brand-ink)',
                  fontWeight: 700,
                  fontSize: 15,
                  fontFamily: 'inherit',
                  cursor: adicionando ? 'default' : 'pointer',
                  opacity: adicionando ? 0.75 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  transition: 'opacity 0.15s ease',
                }}
              >
                <IconPlus size={18} />
                {adicionando ? 'Adicionando...' : 'Adicionar à minha coleção'}
              </button>
            )}
            {avisoAdicionar && (
              <p style={{ fontSize: 12, color: 'var(--ac-1)', lineHeight: 1.4 }}>
                {avisoAdicionar}{' '}
                <Link href="/planos" style={{ color: 'var(--ac-1)', fontWeight: 600 }}>Ver planos</Link>
              </p>
            )}

            {ofertas.n > 0 && ofertas.href ? (
              /* Acento do comprador (roxo -> rosa), via classe de contexto do
                 globals.css: dentro dela todo var(--ac-*) resolve pro par de
                 compra, sem hex cravado. Mesmo padrao do "Comprar agora" da
                 /produto. */
              <Link
                href={ofertas.href}
                className="bx-ctx-comprador"
                style={{
                  height: 46,
                  borderRadius: 10,
                  border: '1px solid rgba(var(--ac-1-rgb),0.45)',
                  background: 'rgba(var(--ac-1-rgb),0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                <span style={{ background: 'var(--ac-grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                  Comprar na Bynx
                </span>
                {ofertas.menor != null && (
                  <small style={{ fontWeight: 500, color: 'var(--bx-text-3)', fontSize: 12 }}>
                    {ofertas.n > 1 ? 'a partir de ' : 'por '}{fmt(ofertas.menor)}
                  </small>
                )}
              </Link>
            ) : (
              <WatchButton cardId={card.id} full label="Avisar quando anunciarem" />
            )}

            <button
              type="button"
              onClick={handleCopy}
              style={{
                alignSelf: 'flex-start',
                minHeight: 36,
                padding: '8px 2px',
                background: 'transparent',
                border: 'none',
                color: copied ? 'var(--bx-green)' : 'var(--bx-text-3)',
                fontSize: 12,
                fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'color 0.15s ease',
              }}
            >
              <IconCopy size={14} />
              {copied ? 'Link copiado' : 'Copiar link'}
            </button>
          </div>
        </section>

            {/* Preços */}
            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                padding: '16px 20px',
                marginBottom: 20,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 12,
                }}
              >
                Preço de mercado
              </p>
              {variantes.length > 0 && vAtual ? (
                <>

                  {/* Aviso do guard. Marcada SEM mediana (caso raro) mantem o
                      texto antigo e a faixa visivel e apagada -- opcao A de
                      setembro, que continua valendo como fallback. */}
                  {card.precoSuspeito && (
                    <div
                      style={{
                        background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.28)',
                        borderRadius: 8,
                        padding: '11px 13px',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        marginBottom: 14,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flex: 'none', marginTop: 1 }}>
                        <path d="M10 3.5 2.5 16.5h15L10 3.5z" stroke="var(--ac-1, #f59e0b)" strokeWidth="1.4" strokeLinejoin="round" />
                        <path d="M10 8.5v3.2M10 14.2v.1" stroke="var(--ac-1, #f59e0b)" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <div>
                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--ac-1, #f59e0b)' }}>
                          {refHistorica ? 'Oferta de hoje sob revisão' : 'Preço sob revisão'}
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.64)' }}>
                          {refHistorica
                            ? 'A única oferta à venda está muito acima do histórico desta carta. Enquanto isso, a referência é o histórico.'
                            : 'Só existe uma oferta desta carta hoje, e ela está muito acima do histórico. Não usamos esse valor como referência.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {refHistorica && (
                    <button
                      type="button"
                      onClick={() => setVerOferta((v) => !v)}
                      aria-expanded={verOferta}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        minHeight: 44,
                        padding: '10px 14px',
                        fontSize: 12,
                        fontFamily: 'inherit',
                        color: 'var(--bx-text-2)',
                        background: 'transparent',
                        border: '1px solid var(--bx-border)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease, background 0.15s ease',
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                        style={{ flex: 'none', transform: verOferta ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
                      >
                        <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {verOferta ? 'Ocultar a oferta de hoje' : 'Ver a oferta de hoje'}
                    </button>
                  )}

                  {umaOferta && vAtual.min != null && (
                    <p style={{ fontSize: 13, color: 'var(--bx-text-2)' }}>
                      Uma oferta hoje: <b style={{ color: 'var(--bx-text)', fontWeight: 600 }}>{fmt(vAtual.min)}</b>. A faixa aparece quando há mais de um preço.
                    </p>
                  )}
                  {(!refHistorica || verOferta) && !umaOferta && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 12,
                        marginTop: refHistorica ? 14 : 0,
                        // Marcada pelo guard: a faixa continua legivel, mas
                        // recuada -- o aviso acima e que manda na leitura.
                        opacity: card.precoSuspeito ? 0.45 : 1,
                      }}
                    >
                      {[
                        { label: 'Mínimo', value: vAtual.min, color: '#22c55e' },
                        { label: 'Médio', value: vAtual.med, color: '#60a5fa' },
                        { label: 'Máximo', value: vAtual.max, color: '#f59e0b' },
                      ].map((p) => (
                        <div key={p.label} style={{ textAlign: 'center' }}>
                          <p
                            style={{
                              fontSize: 10,
                              color: 'rgba(255,255,255,0.35)',
                              marginBottom: 4,
                            }}
                          >
                            {p.label}
                          </p>
                          <p
                            style={{
                              fontSize: 17,
                              fontWeight: 800,
                              color: p.color,
                              letterSpacing: '-0.02em',
                            }}
                          >
                            {fmt(p.value || 0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p
                    style={{
                      display: 'block',
                      marginTop: 14,
                      fontSize: 10,
                      lineHeight: 1.7,
                      color: 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {refHistorica ? (
                      verOferta ? (
                        <>
                          Oferta de hoje: <b style={{ color: '#f59e0b', fontWeight: 700 }}>Mercado Brasileiro</b>
                          <br />
                          Referência: <b style={{ color: '#f59e0b', fontWeight: 700 }}>histórico da Bynx</b>
                        </>
                      ) : (
                        <>
                          Fonte: <b style={{ color: '#f59e0b', fontWeight: 700 }}>histórico da Bynx</b>
                        </>
                      )
                    ) : (
                      <>
                        Fonte: <b style={{ color: '#f59e0b', fontWeight: 700 }}>Mercado Brasileiro</b>
                      </>
                    )}
                  </p>
                </>
              ) : (
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      color: semOferta ? 'var(--bx-text-2)' : 'rgba(255,255,255,0.3)',
                      marginBottom: 8,
                    }}
                  >
                    {vazioTitulo}
                  </p>
                  {temOfertaSemDetalhe && (
                    <p
                      style={{
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.35)',
                        marginBottom: 8,
                      }}
                    >
                      Fonte: <b style={{ color: 'var(--ac-1)', fontWeight: 700 }}>Mercado Brasileiro</b>
                    </p>
                  )}
                  <p
                    style={{
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.2)',
                      lineHeight: 1.5,
                    }}
                  >
                    <Link
                      href={`/?auth=signup&next=${encodeURIComponent(pathname || '/')}`}
                      style={{ color: '#f59e0b', textDecoration: 'none' }}
                    >
                      Entre na Bynx
                    </Link>{' '}
                    {semOferta
                      ? 'e acompanhe essa carta pra ser avisado quando alguém anunciar.'
                      : 'e adicione essa carta na sua coleção pra acompanhar a evolução do preço.'}
                  </p>
                </div>
              )}
            </div>


        {/* Com anuncio, o aviso de preco fica aqui; sem anuncio ele ja e a
            acao secundaria da primeira dobra. */}
        {ofertas.n > 0 && <WatchButton cardId={card.id} full />}

        {/* ★ FICHA DA CARTA (Fase 2 do #490, 09/10/2026). Dado que ja estava na
            mesma linha do banco e nunca aparecia: fatos unicos por carta, em
            lista (nao vira boilerplate), em portugues. Cobre ~25-31% das cartas
            com dado de jogo; nas outras ficam idioma, regiao, set e numero.
            Renderizado no servidor: entra no HTML que o Google e a IA leem. */}
        {ficha.length > 0 && (
          <section aria-labelledby="ficha-da-carta" style={{ marginBottom: 24 }}>
            <h2
              id="ficha-da-carta"
              style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}
            >
              Ficha da carta
            </h2>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                gap: '8px 14px',
                background: 'var(--bx-surface)',
                border: '1px solid var(--bx-border)',
                borderRadius: 12,
                padding: '14px 16px',
                margin: 0,
              }}
            >
              {ficha.map(([k, v]) => (
                <div key={k} style={{ minWidth: 0 }}>
                  <dt style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--bx-text-3)' }}>{k}</dt>
                  <dd style={{ fontSize: 13.5, color: 'var(--bx-text)', margin: '2px 0 0', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{v}</dd>
                </div>
              ))}
            </dl>
            {card.flavorText && (
              <p style={{ fontSize: 12.5, color: 'var(--bx-text-2)', fontStyle: 'italic', lineHeight: 1.5, margin: '10px 2px 0' }}>
                {card.flavorText}
                <span style={{ fontStyle: 'normal', color: 'var(--bx-text-3)' }}> (texto original da carta)</span>
              </p>
            )}
          </section>
        )}

        <PriceHistory cardId={card.id} periodoDaUrl />

      {/* Ataques */}
        {card.attacks && card.attacks.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 12,
              }}
            >
              Ataques
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {card.attacks.map((atk, i: number) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                      {atk.name}
                    </p>
                    {/* Custo de energia: ja vinha no JSON gravado e a UI ignorava. */}
                    {Array.isArray(atk.cost) && atk.cost.length > 0 && (
                      <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                        {atk.cost.map(tipoTcgPt).join(' · ')}
                      </p>
                    )}
                    {atk.text && (
                      <p
                        style={{
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.45)',
                          lineHeight: 1.5,
                        }}
                      >
                        {atk.text}
                      </p>
                    )}
                  </div>
                  {atk.damage && (
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        color: '#f59e0b',
                        flexShrink: 0,
                      }}
                    >
                      {atk.damage}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Banner promocional Bynx (copy rotativa a cada F5) - logo apos os ATAQUES */}
        <PromoBanner />

        {children}

        {/* Footer CTA */}
        <div
          style={{
            textAlign: 'center',
            paddingTop: 32,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.3)',
              marginBottom: 14,
            }}
          >
            Gerencie toda sua coleção Pokémon como portfólio financeiro
          </p>
          {/* ★ Ia pra HOME (`href="/"`) — mesmo defeito ja corrigido no CTA de
              cima, que ficou pra tras aqui. O visitante que chega do Google
              numa das ~66,9 mil paginas de carta era jogado na raiz do site e
              perdia a carta que estava vendo. Agora abre o cadastro e volta
              pra esta mesma carta depois de criar a conta. */}
          <Link
            href={`/?auth=signup&next=${encodeURIComponent(pathname || '/')}`}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              color: '#000',
              padding: '12px 28px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Criar conta grátis na Bynx →
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
    </>
  )
}
