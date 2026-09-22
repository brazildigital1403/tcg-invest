'use client'

import { useState, useEffect } from 'react'
import { revalidarCartaComOferta } from '@/app/carta/actions'
import { IconSearch, IconClose, IconRocket, IconCollection } from '@/components/ui/Icons'
import CardItem, { montarUltimaVenda } from '@/components/ui/CardItem'
import MarketplaceFotosInput from './MarketplaceFotosInput'
import { supabase } from '@/lib/supabaseClient'
import { GRADUADORA_MAP, tierNome, notaCurta, isNotaTop } from '@/lib/graduadoras'
import { CAMPO_VALOR, getPrecoVariante } from '@/lib/calcPatrimonio'
import { mensagemLimiteAnuncios } from '@/lib/checkCardLimit'
import { CONDICOES } from '@/lib/condicoes'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Props {
  userId: string
  onClose: () => void
  onAdded: () => void
  initialCard?: any | null
}

// ─── Estilos ───────────────────────────────────────────────────────────────

const BRAND   = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const BOX: React.CSSProperties = {
  background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 20, fontFamily: "'DM Sans', system-ui, sans-serif",
  color: '#f0f0f0', boxShadow: '0 32px 80px rgba(0,0,0,0.7)', overflow: 'hidden',
}
const INPUT: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  padding: '12px 16px', color: '#f0f0f0', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', fontFamily: "'DM Sans', system-ui, sans-serif", transition: 'border-color 0.2s',
}
const LABEL: React.CSSProperties = {
  fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase',
  letterSpacing: '0.07em', marginBottom: 6, display: 'block',
}
const VARIANTES = [
  { key: 'normal',  label: 'Normal'       },
  { key: 'foil',    label: 'Holo'         },
  { key: 'reverse', label: 'Reverse'      },
  { key: 'promo',   label: 'Promo'        },
]
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

// ─── Step 1 — Escolher carta ────────────────────────────────────────────────
//
// S29 fix: o sub-componente recebe `cartaSel` por prop. Antes, o JSX da linha 112
// referenciava `cartaSel` que era state do componente pai (AnunciarModal),
// quebrando o build minificado em produção (`ReferenceError: cartaSel is not
// defined`). O bug era pré-existente e só era flagrante em prod com user_cards
// suficientes pra renderizar muitos `<CardItem>` em sequência via `.map`.

function EscolherCarta({
  userId,
  cartaSel,
  onSelect,
}: {
  userId: string
  cartaSel: any | null
  onSelect: (c: any) => void
}) {
  const [cards, setCards]     = useState<any[]>([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  // /api/exchange-rate ja devolve usd E eur (cache de 1h). O eur estava cravado
  // em 6.5 no JSX e nunca era buscado -- toda carta em euro saia inflada.
  // Os defaults abaixo sao so o estado inicial ate a API responder.
  const [usdRate, setUsdRate] = useState(5.19)
  const [eurRate, setEurRate] = useState(6.01)

  useEffect(() => {
    async function load() {
      const { data: userCards } = await supabase
        .from('user_cards').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      const { data: anunciadas } = await supabase
        .from('marketplace').select('card_name').eq('user_id', userId)
        .in('status', ['disponivel', 'reservado', 'em_negociacao', 'enviado'])
      const nomeAnunciados = new Set((anunciadas || []).map((a: any) => a.card_name))

      // S29 UX v5: batch query pra pegar preços de mercado de todas as cartas.
      // Mostra preço (BRL ou USD convertido) embaixo de cada carta na grid via
      // o próprio CardItem (que já tem renderização com cores canonical:
      // laranja pra BRL, azul pra USD convertido).
      // Usa pokemon_api_id quando disponível pra ser preciso (1 pokemon_card por carta).
      const apiIds = [...new Set((userCards || []).map((c: any) => c.pokemon_api_id).filter(Boolean))]
      let priceMap: Record<string, any> = {}
      if (apiIds.length > 0) {
        // Seleciona TODOS os campos de preço pra CardItem renderizar variantes corretamente
        const prices = await fetch('/api/cards/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: apiIds }),
        }).then((r) => r.json()).then((d) => d.cards || []).catch(() => [])
        priceMap = (prices || []).reduce((acc: any, p: any) => {
          acc[p.id] = p
          return acc
        }, {})
      }

      // Busca cotação USD-BRL pra fallback
      try {
        const rateRes = await fetch('/api/exchange-rate')
        const rate = await rateRes.json()
        if (rate?.usd) setUsdRate(rate.usd)
        if (rate?.eur) setEurRate(rate.eur)
      } catch { /* mantem o estado inicial */ }

      // Anexa _priceData (objeto inteiro de pokemon_cards) em cada user_card.
      // O CardItem usa a prop `price` pra renderizar valores com cores canonical.
      const enriched = (userCards || []).map((c: any) => {
        const p = c.pokemon_api_id ? (priceMap[c.pokemon_api_id] || null) : null
        return {
          ...c,
          jaAnunciada: nomeAnunciados.has(c.card_name),
          _priceData: p,
          ultima_venda: montarUltimaVenda(p || {}),
        }
      })
      setCards(enriched)
      setLoading(false)
    }
    load()
  }, [userId])

  const filtered = cards.filter(c => !search || c.card_name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="bx-an-busca">
        <div style={{ position: 'relative' }}>
          <IconSearch size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar na sua coleção"
            aria-label="Buscar na sua coleção"
            style={{ ...INPUT, paddingLeft: 36, fontSize: 16, minHeight: 44 }}
            onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
          {filtered.length} carta{filtered.length !== 1 ? 's' : ''} · toque na que vai vender

        </p>
      </div>
      <div className="bx-an-lista">
        {loading ? (
          <div className="bx-an-grade">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingBottom: '145%', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ marginBottom: 12 }}><IconCollection size={36} color="rgba(255,255,255,0.3)" /></div>
            <p>{search ? `Nenhuma carta com "${search}"` : 'Sua coleção está vazia'}</p>
          </div>
        ) : (
          <div className="bx-an-grade">
            {filtered.map(card => (
              <div key={card.id} onClick={() => !card.jaAnunciada && onSelect(card)}
                style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, overflow: 'hidden', position: 'relative',
                  cursor: card.jaAnunciada ? 'not-allowed' : 'pointer',
                  opacity: card.jaAnunciada ? 0.5 : 1, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!card.jaAnunciada) { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = 'rgba(245,158,11,0.6)'; el.style.transform = 'translateY(-2px)' }}}
                onMouseLeave={e => { if (!card.jaAnunciada) { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = 'rgba(255,255,255,0.07)'; el.style.transform = '' }}}
              >
                {card.jaAnunciada && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: 'rgba(0,0,0,0.8)', padding: '4px 8px', borderRadius: 6 }}>JÁ ANUNCIADA</span>
                  </div>
                )}
                <CardItem
                  card={card}
                  mode="select"
                  selected={cartaSel?.id === card.id}
                  price={card._priceData}
                  exchangeRate={{ usd: usdRate, eur: eurRate }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 2 — Detalhes ────────────────────────────────────────────────────────

// Redesenhado em 22/09/2026 (mockup "Anunciar carta: celular", aprovado pelo
// Du). Antes eram duas colunas fixas -- 220px de carta e o formulario ao lado
// --, que no celular deixavam ~100px pro formulario: preco, resumo e o
// Publicar saiam cortados da tela (print do Du, 01:20). Agora:
//   celular -> carta numa linha compacta no topo, formulario em coluna, resumo
//              e Publicar fixos no rodape;
//   desktop -> carta na coluna da esquerda, formulario na direita, rodape com
//              Voltar, resumo e Publicar.
const CONDICAO_TEXTO: Record<string, string> = {
  NM: 'Near Mint: quase perfeita, sem marcas visíveis.',
  LP: 'Lightly Played: marcas leves de uso, só de perto.',
  MP: 'Moderately Played: desgaste visível nas bordas ou na superfície.',
  HP: 'Heavily Played: muito desgaste, vincos ou marcas fortes.',
  D: 'Damaged: danificada, com dobra, rasgo ou mancha.',
}

function DetalhesAnuncio({ card, precoMercado, precoFonte, onBack, onConfirm, loading, erro, userId, isPro }: {
  card: any
  precoMercado: number
  precoFonte: 'BRL' | 'USD' | 'BRL_FOIL' | 'BRL_REVERSE' | 'BRL_PROMO' | null
  onBack: () => void
  onConfirm: (d: any) => void
  loading: boolean
  erro?: string | null
  userId: string
  isPro: boolean
}) {
  const grad = card.graduada && card.graduadora ? GRADUADORA_MAP[card.graduadora] : null
  const [preco, setPreco]       = useState(grad && card.valor_graduada ? Number(card.valor_graduada).toFixed(2).replace('.', ',') : (precoMercado > 0 ? precoMercado.toFixed(2).replace('.', ',') : ''))
  const [condicao, setCondicao] = useState('NM')
  const [variante, setVariante] = useState(card.variante || 'normal')
  const [descricao, setDescricao] = useState('')
  const [fotos, setFotos] = useState<string[]>([])

  const precoNum = parseFloat(String(preco).replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) || 0
  // Graduada nao compara: o preco do catalogo e o da carta crua, e o slab
  // custa mais por definicao -- a conta so sabia dar "acima do mercado". Mesma
  // regra da vitrine (marketplace/page.tsx), pra o vendedor nao ver aqui um
  // numero que o comprador nao ve la.
  const diff = !grad && precoMercado > 0 && precoNum > 0 ? ((precoNum - precoMercado) / precoMercado * 100) : null
  const emReais = (v: number) => v.toFixed(2).replace('.', ',')
  const atalhos = !grad && precoMercado > 0
    ? [{ rot: '−5%', valor: Math.round(precoMercado * 95) / 100 }, { rot: 'Menor preço', valor: precoMercado }]
    : []

  const fonteRotulo = precoFonte === 'USD' ? 'TCGPlayer, convertido' : 'Mercado Brasileiro, menor preço'
  const nome = String(card.card_name || '').replace(/\s*\([^)]*\)\s*$/, '')
  const setNome = card.set_name && !/^Liga BR\b/i.test(card.set_name) ? card.set_name : null
  const numero = card.number ? String(card.number) : null
  const idioma = card.idioma ? String(card.idioma).toUpperCase() : null
  const subtitulo = [setNome, numero, idioma].filter(Boolean).join(' · ')
  const resumo = [nome, VARIANTES.find(v => v.key === variante)?.label, grad ? `${grad.curto} ${notaCurta(card.nota, card.black_label)}` : condicao].filter(Boolean).join(' · ')

  const chip = (ativo: boolean, cor = 'var(--ac-1)', corRgb = 'var(--ac-1-rgb)'): React.CSSProperties => ({
    font: 'inherit', fontSize: 13.5, fontWeight: 700, minHeight: 44, padding: '0 12px', borderRadius: 12, cursor: 'pointer',
    border: `1px solid ${ativo ? cor : 'var(--bx-border-2)'}`, background: ativo ? `rgba(${corRgb}, 0.12)` : 'transparent',
    color: ativo ? cor : 'var(--bx-text-2)', transition: 'background .15s ease, border-color .15s ease, color .15s ease',
  })

  const slab = (largura: number) => grad ? (
    <div style={{ width: largura, borderRadius: 12, overflow: 'hidden', background: card.black_label ? '#0a0a0a' : grad.cor, padding: '0 4px 4px', boxShadow: `0 0 0 2px ${grad.cor}${isNotaTop(card.nota, card.black_label) ? `, 0 0 24px -3px ${grad.cor}` : ''}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: largura > 100 ? '6px 6px' : '3px 3px' }}>
        <span style={{ fontSize: largura > 100 ? 12 : 9, fontWeight: 900, color: card.black_label ? '#e8c878' : '#fff' }}>{grad.curto}</span>
        <b style={{ fontSize: largura > 100 ? 17 : 11, fontWeight: 900, color: card.black_label ? '#e8c878' : '#fff', lineHeight: 1 }}>{notaCurta(card.nota, card.black_label)}</b>
      </div>
      {card.card_image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={card.card_image} alt={nome} style={{ width: '100%', display: 'block', borderRadius: 7, aspectRatio: '63 / 88', objectFit: 'cover' }} />
        : <div style={{ aspectRatio: '63 / 88', background: 'var(--bx-surface-2)', borderRadius: 7 }} />}
    </div>
  ) : card.card_image
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={card.card_image} alt={nome} style={{ width: largura, aspectRatio: '63 / 88', objectFit: 'cover', borderRadius: largura > 100 ? 12 : 8, boxShadow: '0 12px 30px -12px rgba(0,0,0,.8)', flexShrink: 0, display: 'block' }} />
    : <div style={{ width: largura, aspectRatio: '63 / 88', background: 'var(--bx-surface-2)', borderRadius: 8, flexShrink: 0 }} />

  const blocoValor = grad ? (
    <div style={{ padding: 12, borderRadius: 12, background: grad.cor + '1a', border: `1px solid ${grad.cor}59` }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: grad.cor }}>{grad.curto} {notaCurta(card.nota, card.black_label)} {tierNome(card.graduadora, card.nota, card.black_label)}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: grad.cor, marginTop: 2 }}>{card.valor_graduada ? fmt(Number(card.valor_graduada)) : 'Sem valor informado'}</div>
      <div style={{ fontSize: 12, color: 'var(--bx-text-2)', marginTop: 4, lineHeight: 1.4 }}>Graduada não compara com o Mercado: o catálogo tem o preço da carta sem graduação.</div>
      {card.cert_graduacao && <div style={{ fontSize: 11.5, color: 'var(--bx-text-3)', marginTop: 6 }}>Certificado {card.cert_graduacao}</div>}
    </div>
  ) : precoMercado > 0 ? (
    <div style={{ padding: 12, borderRadius: 12, background: 'rgba(var(--ac-1-rgb), .07)', border: '1px solid rgba(var(--ac-1-rgb), .28)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--bx-text-3)' }}>{fonteRotulo}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: precoFonte === 'USD' ? '#60a5fa' : 'var(--ac-1)', marginTop: 2 }}>{fmt(precoMercado)}</div>
    </div>
  ) : (
    <div style={{ padding: 12, borderRadius: 12, border: '1px dashed var(--bx-border-2)', fontSize: 12.5, color: 'var(--bx-text-3)', lineHeight: 1.45 }}>Sem preço de mercado para esta carta. Defina o valor livremente.</div>
  )

  const publicar = () => onConfirm({ preco: precoNum, condicao: grad ? null : condicao, variante, descricao, fotos, graduada: !!grad, graduadora: grad ? card.graduadora : null, nota: grad ? card.nota : null, black_label: grad ? !!card.black_label : false, cert_graduacao: grad ? (card.cert_graduacao || null) : null, subnotas: grad ? (card.subnotas || null) : null })

  return (
    <div className="bx-an-det">
      <div className="bx-an-det-corpo">
        {/* Desktop: coluna da carta */}
        <aside className="bx-an-lado">
          {slab(212)}
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.25 }}>{nome}</div>
            {subtitulo && <div style={{ fontSize: 12.5, color: 'var(--bx-text-3)', marginTop: 2 }}>{subtitulo}</div>}
          </div>
          {blocoValor}
          <button type="button" onClick={onBack} className="bx-an-link">Trocar de carta</button>
        </aside>

        <div className="bx-an-form">
          {/* Celular: carta numa linha */}
          <div className="bx-an-linha">
            {slab(64)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.25 }}>{nome}</div>
              {subtitulo && <div style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>{subtitulo}</div>}
              {grad ? (
                <div style={{ fontSize: 12.5, fontWeight: 800, color: grad.cor, marginTop: 6 }}>{grad.curto} {notaCurta(card.nota, card.black_label)} {tierNome(card.graduadora, card.nota, card.black_label)}</div>
              ) : precoMercado > 0 ? (
                <>
                  <div style={{ fontSize: 12, color: 'var(--bx-text-2)', marginTop: 6 }}>{fonteRotulo}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: precoFonte === 'USD' ? '#60a5fa' : 'var(--ac-1)' }}>{fmt(precoMercado)}</div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--bx-text-3)', marginTop: 6 }}>Sem preço de mercado</div>
              )}
            </div>
            <button type="button" onClick={onBack} style={{ ...chip(false), minHeight: 36, fontSize: 12.5, alignSelf: 'flex-start' }}>Trocar</button>
          </div>

          {/* Preco */}
          <div>
            <label htmlFor="bx-an-preco" className="bx-an-rot">Preço de venda</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, fontWeight: 700, color: 'var(--bx-text-3)' }}>R$</span>
              <input id="bx-an-preco" value={preco} onChange={e => setPreco(e.target.value.replace(/[^\d,.]/g, ''))} inputMode="decimal" placeholder="0,00" className="bx-an-preco" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: diff === null ? 'var(--bx-text-3)' : Math.abs(diff) < 0.05 ? 'var(--bx-green)' : diff > 0 ? 'var(--bx-text-2)' : 'var(--ac-1)' }}>
                {grad ? 'Preenchido com o valor que você informou na coleção. Pode mudar.'
                  : diff === null ? (precoMercado > 0 ? 'Digite o valor de venda.' : 'Sem preço de mercado para comparar.')
                  : Math.abs(diff) < 0.05 ? 'No menor preço do Mercado'
                  : diff > 0 ? `${diff.toFixed(1).replace('.', ',')}% acima do menor preço`
                  : `${Math.abs(diff).toFixed(1).replace('.', ',')}% abaixo do menor preço`}
              </span>
              {atalhos.length > 0 && (
                <div style={{ display: 'flex', gap: 5 }}>
                  {atalhos.map(a => {
                    const on = Math.abs(precoNum - a.valor) < 0.005
                    return <button key={a.rot} type="button" onClick={() => setPreco(emReais(a.valor))} aria-pressed={on} style={{ ...chip(on), minHeight: 32, fontSize: 12, borderRadius: 999, padding: '0 10px' }}>{a.rot}</button>
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Variante + condicao */}
          <div className="bx-an-dupla">
            <div>
              <div className="bx-an-rot">Variante</div>
              <div className="bx-an-variantes">
                {VARIANTES.map(v => <button key={v.key} type="button" onClick={() => setVariante(v.key)} aria-pressed={variante === v.key} style={chip(variante === v.key)}>{v.label}</button>)}
              </div>
            </div>
            <div>
              <div className="bx-an-rot">Condição</div>
              {grad ? (
                <div style={{ fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.45, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--bx-border)', background: 'var(--bx-surface)' }}>
                  Carta graduada: a nota {grad.curto} {notaCurta(card.nota, card.black_label)} substitui a condição.
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 5 }}>
                    {CONDICOES.map(c => {
                      const on = condicao === c.key
                      return (
                        <button key={c.key} type="button" onClick={() => setCondicao(c.key)} aria-pressed={on} aria-label={`${c.label}, ${c.desc}`}
                          style={{ font: 'inherit', fontSize: 14, fontWeight: 800, minHeight: 48, borderRadius: 12, cursor: 'pointer', transition: 'background .15s ease, border-color .15s ease',
                            border: `1px solid ${on ? c.color : 'var(--bx-border-2)'}`, background: on ? c.color + '1f' : 'transparent', color: on ? c.color : 'var(--bx-text-2)' }}>
                          {c.label}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--bx-text-2)', marginTop: 6 }}>{CONDICAO_TEXTO[condicao]}</div>
                </>
              )}
            </div>
          </div>

          {/* Observacoes */}
          <div>
            <label htmlFor="bx-an-obs" className="bx-an-rot">Observações <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(opcional)</span></label>
            <textarea id="bx-an-obs" value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
              placeholder={grad ? 'Ex.: slab sem riscos, certificado conferido' : 'Ex.: guardada em sleeve, sem marcas, comprada na loja oficial'}
              className="bx-an-texto" />
          </div>

          <MarketplaceFotosInput userId={userId} isPro={isPro} fotos={fotos} setFotos={setFotos} graduada={!!grad} />
        </div>
      </div>

      {/* Rodape: resumo + publicar */}
      <div className="bx-an-rodape">
        {erro && <div role="alert" className="bx-an-erro">{erro}</div>}
        <button type="button" onClick={onBack} className="bx-an-voltar">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>Voltar
        </button>
        <div className="bx-an-resumo">
          <span style={{ fontSize: 12.5, color: 'var(--bx-text-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumo}</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--ac-1)', whiteSpace: 'nowrap' }}>{precoNum > 0 ? fmt(precoNum) : 'R$ 0,00'}</span>
        </div>
        <button type="button" onClick={publicar} disabled={precoNum <= 0 || loading} className="bx-an-publicar">
          {loading ? <><span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Publicando…</> : 'Publicar anúncio'}
        </button>
      </div>
    </div>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

export default function AnunciarModal({ userId, onClose, onAdded, initialCard }: Props) {
  const [step, setStep]         = useState<'escolher' | 'detalhes'>(initialCard ? 'detalhes' : 'escolher')
  // Erro de publicacao: ate 03/09 o insert descartava o `error` e o modal
  // fechava como se tivesse dado certo.
  const [erroPublicar, setErroPublicar] = useState<string | null>(null)
  const [cartaSel, setCartaSel] = useState<any | null>(initialCard || null)
  const [bootstrapping, setBootstrapping] = useState<boolean>(!!initialCard)
  const [precoMercado, setPrecoMercado] = useState(0)
  const [precoFonte, setPrecoFonte] = useState<'BRL' | 'USD' | 'BRL_FOIL' | 'BRL_REVERSE' | 'BRL_PROMO' | null>(null)
  const [loading, setLoading]   = useState(false)

  // A carta do CATALOGO que casou com a carta da colecao (resolvida no
  // handleSelectCard). E ela que manda no card_id do anuncio -- ver o comentario
  // do handlePublicar. null = nao casou com nada visivel no catalogo.
  const [cartaCatalogo, setCartaCatalogo] = useState<any | null>(null)

  const [isPro, setIsPro] = useState(false)
  useEffect(() => {
    supabase.from('users').select('is_pro').eq('id', userId).single().then(({ data }) => setIsPro(!!(data as any)?.is_pro))
  }, [userId])

  // Abre direto no step 2 quando a carta ja vem escolhida (ex: vindo da colecao).
  // Reusa handleSelectCard pra resolver o preco de mercado igual ao fluxo normal.
  useEffect(() => {
    if (initialCard) handleSelectCard(initialCard).finally(() => setBootstrapping(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSelectCard(card: any) {
    // Estrategia de resolucao de preco com fallback.
    //
    // A cascata canonica vive em src/lib/calcPatrimonio.ts -- este bloco usa
    // getPrecoVariante/CAMPO_VALOR de la, nao reimplementa. A ordem efetiva e:
    // 1. faixa da variante escolhida, no campo que CAMPO_VALOR define (hoje min)
    // 2. queda para a variante normal se a escolhida nao tem preco
    // 3. cotacao USD->BRL sobre o preco em dolar do catalogo
    //
    // Se nenhum bater, vendedor digita manualmente (precoMercado = 0, sem badge).
    let preco = 0
    let fonte: typeof precoFonte = null

    // Manda os DOIS ids que o user_card pode ter. O lookup le a view
    // `pokemon_cards`, que ja filtra oculto=false -- entao o que voltar e,
    // por construcao, uma carta viva no catalogo. E assim que a gente
    // descobre qual dos dois campos presta (ver handlePublicar).
    const idsCandidatos = [...new Set([card.pokemon_api_id, card.card_id].filter(Boolean))]

    if (idsCandidatos.length > 0) {
      const achadas = await fetch('/api/cards/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsCandidatos }),
      }).then((r) => r.json()).then((d) => d.cards || []).catch(() => [])

      // Respeita a ordem dos candidatos: pokemon_api_id (canonico) ganha do
      // card_id quando os dois existem.
      const priceData =
        idsCandidatos.map((id: string) => achadas.find((c: any) => c.id === id)).find(Boolean) || null

      setCartaCatalogo(priceData)

      if (priceData) {
        // Tenta na ordem de prioridade
        // ★ Sugestao de preco = MENOR preco (25/08/2026). Sugerir a media
        // faria o vendedor anunciar acima do que o comprador encontra.
        // As colunas sem faixa (preco_foil, preco_reverse, preco_promo) sairam
        // da cascata: elas guardam a MEDIA daquela variante.
        const brlNormal = getPrecoVariante(priceData, 'normal')[CAMPO_VALOR]
        const brlFoil = getPrecoVariante(priceData, 'foil', { fallbackNormal: false })[CAMPO_VALOR]
        const brlReverse = getPrecoVariante(priceData, 'reverse', { fallbackNormal: false })[CAMPO_VALOR]
        const brlPromo = getPrecoVariante(priceData, 'promo', { fallbackNormal: false })[CAMPO_VALOR]
        if (brlNormal > 0) {
          preco = brlNormal
          fonte = 'BRL'
        } else if (brlFoil > 0) {
          preco = brlFoil
          fonte = 'BRL_FOIL'
        } else if (brlReverse > 0) {
          preco = brlReverse
          fonte = 'BRL_REVERSE'
        } else if (brlPromo > 0) {
          preco = brlPromo
          fonte = 'BRL_PROMO'
        } else {
          // Fallback USD: pega o melhor disponível (normal > holofoil) e converte
          const usd = Number(priceData.price_usd_holofoil) > 0 ? Number(priceData.price_usd_holofoil)
                     : Number(priceData.price_usd_normal) > 0 ? Number(priceData.price_usd_normal)
                     : 0
          if (usd > 0) {
            try {
              const rateRes = await fetch('/api/exchange-rate')
              const rate = await rateRes.json()
              const usdBrl = rate?.usd || 5.19
              preco = usd * usdBrl
              fonte = 'USD'
            } catch {
              // Sem internet ou API offline — fallback hardcoded
              preco = usd * 5.19
              fonte = 'USD'
            }
          }
        }
      }
    }

    setPrecoMercado(preco)
    setPrecoFonte(fonte)
    setCartaSel(card)
    setStep('detalhes')
  }

  async function handlePublicar(dados: any) {
    setErroPublicar(null)
    if (!cartaSel || dados.preco <= 0) return
    setLoading(true)
    // ★ card_id sai do CATALOGO, nao do user_card (achado 23/08/2026).
    //
    // Ate aqui gravava `cartaSel.card_id` cru, e isso nasceu quebrado em 45
    // anuncios (18 ativos): sem foto, sem link pra carta, sem preco de
    // referencia. Tres formas do mesmo defeito, porque o user_card guarda dois
    // campos de id e nenhum e confiavel sozinho:
    //   - card_id com so o NUMERO ("94", "108") -> nao existe no catalogo
    //   - card_id apontando pra carta que uma fusao de set ocultou depois
    //   - os dois null, quando a carta entrou na colecao sem casar (o proprio
    //     arquivo ja tratava pokemon_api_id como o canonico na busca de preco,
    //     mas gravava o outro na hora de publicar)
    //
    // `cartaCatalogo` veio do lookup, que le a view `pokemon_cards` (oculto
    // filtrado): se tem valor, o id existe e esta vivo. O fallback antigo fica
    // como ultimo recurso pra nao regredir caso o lookup falhe por rede.
    const cardIdFinal = cartaCatalogo?.id || cartaSel.pokemon_api_id || cartaSel.card_id || null

    const { data: anuncio, error: erroInsert } = await supabase.from('marketplace').insert({
      user_id: userId, card_id: cardIdFinal, card_name: cartaSel.card_name,
      // Imagem e link tambem herdam do catalogo quando o user_card nao tem --
      // e o que faz a foto aparecer no card do marketplace.
      card_image: cartaSel.card_image || cartaCatalogo?.image_small || null,
      card_link: cartaSel.card_link || null,
      variante: dados.variante, price: dados.preco,
      // ★ Idioma nao era gravado (#372, 21/09/2026): todo anuncio caia no
      // default 'pt' do banco, inclusive carta japonesa ou inglesa. A carta
      // vem da colecao, que ja sabe o idioma -- e o que a meta por idioma e a
      // pagina do anuncio precisam.
      idioma: cartaSel.idioma || 'pt',
      condicao: dados.condicao, descricao: dados.descricao || null, fotos: dados.fotos && dados.fotos.length ? dados.fotos : null, status: 'disponivel',
      graduada: dados.graduada || false, graduadora: dados.graduadora || null, nota: dados.nota ?? null,
      black_label: dados.black_label || false, cert_graduacao: dados.cert_graduacao || null, subnotas: dados.subnotas || null,
    }).select('id').single()

    // ★ O `error` era DESCARTADO e o modal fechava chamando `onAdded()` de
    // qualquer jeito: RLS negada, limite ou constraint viravam "anuncio
    // publicado" pro vendedor, sem anuncio nenhum no banco. Agora falha vira
    // erro na tela e o modal FICA ABERTO, com o formulario preenchido.
    if (erroInsert || !anuncio) {
      console.error('[AnunciarModal] insert falhou:', erroInsert?.message)
      setLoading(false)
      // O gatilho de limite responde com "LIMITE_ANUNCIOS: <texto>"; o codigo sai.
      setErroPublicar(mensagemLimiteAnuncios(erroInsert) || erroInsert?.message || 'Não consegui publicar o anúncio. Tente de novo.')
      return
    }

    setLoading(false)
    onAdded()
    onClose()

    // A pagina publica da carta e ISR de 24h. Sem isto o anuncio recem-criado
    // so apareceria la no dia seguinte, embora ja estivesse no /marketplace e
    // na vitrine da loja (as duas sao ao vivo). Nao damos `await`: o anuncio
    // ja esta gravado e a invalidacao nao pode segurar o fechamento do modal.
    if (cardIdFinal) void revalidarCartaComOferta(cardIdFinal)

    // Watchlist Fase 2: avisa quem acompanha essa carta que ela apareceu no
    // Marketplace. Fire-and-forget -- nunca deve travar nem falhar o anuncio.
    if (anuncio?.id) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) return
        fetch('/api/marketplace/notificar-watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ anuncio_id: anuncio.id }),
        }).catch(() => { /* silencioso -- o anuncio ja foi criado */ })
      })
    }
  }

  const titulo = step === 'escolher' ? 'Qual carta vai vender?' : 'Detalhes do anúncio'
  return (
    <div className="bx-an-fundo" onClick={onClose}>
      <div className={`bx-an${step === 'detalhes' ? ' bx-an-largo' : ''}`} role="dialog" aria-modal="true" aria-label="Anunciar carta" onClick={e => e.stopPropagation()}>

        {/* Cabecalho: passo, titulo e progresso */}
        <div className="bx-an-topo">
          {step === 'detalhes' && !bootstrapping && (
            <button type="button" onClick={() => setStep('escolher')} aria-label="Voltar e escolher outra carta" className="bx-an-icone bx-an-so-cel">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ac-1)' }}>Passo {step === 'escolher' ? 1 : 2} de 2</div>
            <h2 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em' }}>{titulo}</h2>
          </div>
          <div className="bx-an-progresso bx-an-so-desk" aria-hidden="true"><span className="on" /><span className={step === 'detalhes' ? 'on' : ''} /></div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="bx-an-icone">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="bx-an-progresso bx-an-so-cel" aria-hidden="true" style={{ padding: '0 16px 12px' }}><span className="on" /><span className={step === 'detalhes' ? 'on' : ''} /></div>

        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {bootstrapping
            ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: 'rgba(255,255,255,0.5)' }}>
                <div style={{ width: 34, height: 34, border: '3px solid rgba(245,158,11,0.25)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 13 }}>Preparando anúncio…</span>
              </div>
            )
            : step === 'escolher'
            ? <EscolherCarta userId={userId} cartaSel={cartaSel} onSelect={handleSelectCard} />
            : <DetalhesAnuncio userId={userId} isPro={isPro} card={cartaSel} precoMercado={precoMercado} precoFonte={precoFonte} onBack={() => setStep('escolher')} onConfirm={handlePublicar} loading={loading} erro={erroPublicar} />
          }
        </div>
      </div>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}
        .bx-an-fundo { position: fixed; inset: 0; z-index: 9998; background: rgba(0,0,0,.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 24px; font-family: 'DM Sans', system-ui, sans-serif; }
        .bx-an { width: 100%; max-width: 760px; height: min(82vh, 820px); display: flex; flex-direction: column; overflow: hidden; background: var(--bx-bg-elev); border: 1px solid var(--bx-border-2); border-radius: 22px; box-shadow: 0 32px 100px rgba(0,0,0,.7); color: var(--bx-text); }
        .bx-an-largo { max-width: 880px; }
        .bx-an-topo { display: flex; align-items: center; gap: 12px; padding: 12px 10px 12px 22px; border-bottom: 1px solid var(--bx-border); flex-shrink: 0; }
        .bx-an-icone { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: none; border: none; border-radius: 10px; color: var(--bx-text-2); cursor: pointer; flex-shrink: 0; }
        .bx-an-icone:hover { background: var(--bx-surface-2); }
        .bx-an-progresso { display: flex; gap: 4px; width: 120px; flex-shrink: 0; }
        .bx-an-progresso span { flex: 1; height: 3px; border-radius: 999px; background: var(--bx-surface-3); transition: background .2s ease; }
        .bx-an-progresso span.on { background: var(--ac-1); }
        .bx-an-so-cel { display: none; }
        .bx-an-busca { padding: 14px 22px 10px; border-bottom: 1px solid var(--bx-border); }
        .bx-an-lista { flex: 1; overflow-y: auto; padding: 16px 22px; }
        .bx-an-grade { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .bx-an-det { display: flex; flex-direction: column; height: 100%; }
        .bx-an-det-corpo { flex: 1; min-height: 0; display: grid; grid-template-columns: 260px minmax(0, 1fr); }
        .bx-an-lado { padding: 22px; border-right: 1px solid var(--bx-border); display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
        .bx-an-link { align-self: flex-start; min-height: 44px; padding: 0; border: none; background: none; color: var(--bx-text-2); font: inherit; font-size: 13px; font-weight: 700; text-decoration: underline; cursor: pointer; }
        .bx-an-form { padding: 22px 26px; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; min-width: 0; }
        .bx-an-linha { display: none; }
        .bx-an-rot { display: block; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--bx-text-3); margin-bottom: 6px; }
        .bx-an-preco { width: 100%; box-sizing: border-box; min-height: 60px; padding: 0 14px 0 50px; border-radius: 14px; border: 1px solid var(--bx-border-2); background: var(--bx-surface-2); color: var(--bx-text); font: inherit; font-size: 28px; font-weight: 900; letter-spacing: -.02em; outline: none; transition: border-color .15s ease; }
        .bx-an-preco:focus, .bx-an-texto:focus { border-color: var(--ac-1); }
        .bx-an-texto { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 12px; border: 1px solid var(--bx-border-2); background: var(--bx-surface-2); color: var(--bx-text); font: inherit; font-size: 16px; line-height: 1.5; resize: none; outline: none; transition: border-color .15s ease; }
        .bx-an-dupla { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .bx-an-variantes { display: flex; gap: 6px; flex-wrap: wrap; }
        .bx-an-rodape { display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; padding: 14px 22px; border-top: 1px solid var(--bx-border); flex-shrink: 0; background: var(--bx-bg-elev); }
        .bx-an-erro { flex-basis: 100%; background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3); color: #fca5a5; border-radius: 10px; padding: 10px 12px; font-size: 12.5px; line-height: 1.5; }
        .bx-an-voltar { display: inline-flex; align-items: center; gap: 6px; min-height: 46px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--bx-border-2); background: transparent; color: var(--bx-text-2); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
        .bx-an-resumo { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; min-width: 0; }
        .bx-an-publicar { min-height: 48px; padding: 0 26px; border: none; border-radius: 12px; background: var(--ac-grad); color: var(--bx-brand-ink); font: inherit; font-size: 15px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease; }
        .bx-an-publicar:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 28px -14px rgba(var(--ac-1-rgb), .9); }
        .bx-an-publicar:disabled { opacity: .45; cursor: not-allowed; }
        @media (max-width: 760px) {
          .bx-an-fundo { align-items: flex-end; padding: 0; }
          .bx-an, .bx-an-largo { max-width: none; height: 94dvh; border-radius: 22px 22px 0 0; border-bottom: none; animation: bxAnSobe .25s cubic-bezier(.22,.61,.36,1) both; }
          .bx-an-topo { padding: 10px 6px 8px 16px; border-bottom: none; }
          .bx-an-topo > .bx-an-so-cel { margin-left: -10px; }
          .bx-an-so-cel { display: flex; }
          .bx-an-so-desk { display: none; }
          .bx-an-progresso.bx-an-so-cel { width: auto; }
          .bx-an-busca { padding: 0 16px 10px; }
          .bx-an-lista { padding: 12px 16px; }
          .bx-an-grade { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .bx-an-det-corpo { display: block; overflow-y: auto; }
          .bx-an-lado { display: none; }
          .bx-an-form { padding: 4px 16px 20px; overflow: visible; }
          .bx-an-linha { display: flex; gap: 12px; align-items: center; padding: 10px; border-radius: 16px; background: var(--bx-surface); border: 1px solid var(--bx-border); }
          .bx-an-dupla { grid-template-columns: minmax(0, 1fr); gap: 18px; }
          .bx-an-variantes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .bx-an-rodape { padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 0px)); gap: 10px; }
          .bx-an-voltar { display: none; }
          .bx-an-resumo { margin-left: 0; flex: 1 1 100%; flex-direction: row; justify-content: space-between; align-items: baseline; gap: 10px; }
          .bx-an-publicar { flex: 1 1 100%; min-height: 50px; }
        }
        @keyframes bxAnSobe { from { transform: translateY(24px) } to { transform: none } }
        @media (prefers-reduced-motion: reduce) { .bx-an { animation: none !important; } .bx-an-publicar:hover { transform: none; } }
      `}</style>
    </div>
  )
}
