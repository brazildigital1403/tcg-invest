'use client'

import { useState, useEffect } from 'react'
import { IconSearch, IconClose, IconRocket } from '@/components/ui/Icons'
import CardItem from '@/components/ui/CardItem'
import { supabase } from '@/lib/supabaseClient'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Props {
  userId: string
  onClose: () => void
  onAdded: () => void
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
const CONDICOES = [
  { key: 'NM', label: 'NM', desc: 'Near Mint',         color: '#22c55e' },
  { key: 'LP', label: 'LP', desc: 'Lightly Played',    color: '#84cc16' },
  { key: 'MP', label: 'MP', desc: 'Moderately Played', color: '#f59e0b' },
  { key: 'HP', label: 'HP', desc: 'Heavily Played',    color: '#ef4444' },
  { key: 'D',  label: 'D',  desc: 'Damaged',           color: '#7f1d1d' },
]
const VARIANTES = [
  { key: 'normal',  label: 'Normal'       },
  { key: 'foil',    label: 'Foil'         },
  { key: 'promo',   label: 'Promo'        },
  { key: 'reverse', label: 'Reverse Foil' },
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
  const [usdRate, setUsdRate] = useState(6.0)

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
        const { data: prices } = await supabase
          .from('pokemon_cards')
          .select('id, preco_normal, preco_min, preco_medio, preco_max, preco_foil, preco_foil_min, preco_foil_medio, preco_foil_max, preco_promo, preco_promo_min, preco_promo_medio, preco_promo_max, preco_reverse, preco_reverse_min, preco_reverse_medio, preco_reverse_max, preco_pokeball, preco_pokeball_min, preco_pokeball_medio, preco_pokeball_max, price_usd_normal, price_usd_holofoil, price_usd_reverse, price_eur_normal, price_eur_holofoil')
          .in('id', apiIds)
        priceMap = (prices || []).reduce((acc: any, p: any) => {
          acc[p.id] = p
          return acc
        }, {})
      }

      // Busca cotação USD-BRL pra fallback
      try {
        const rateRes = await fetch('/api/exchange-rate')
        const rate = await rateRes.json()
        setUsdRate(rate?.usd || 6.0)
      } catch { /* mantém default 6.0 */ }

      // Anexa _priceData (objeto inteiro de pokemon_cards) em cada user_card.
      // O CardItem usa a prop `price` pra renderizar valores com cores canonical.
      const enriched = (userCards || []).map((c: any) => ({
        ...c,
        jaAnunciada: nomeAnunciados.has(c.card_name),
        _priceData: c.pokemon_api_id ? (priceMap[c.pokemon_api_id] || null) : null,
      }))
      setCards(enriched)
      setLoading(false)
    }
    load()
  }, [userId])

  const filtered = cards.filter(c => !search || c.card_name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar cartas da sua coleção..."
            style={{ ...INPUT, paddingLeft: 36 }}
            onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
          {filtered.length} carta{filtered.length !== 1 ? 's' : ''} · clique para selecionar

        </p>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingBottom: '145%', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>🃏</p>
            <p>{search ? `Nenhuma carta com "${search}"` : 'Sua coleção está vazia'}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
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
                  exchangeRate={{ usd: usdRate, eur: 6.5 }}
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

function DetalhesAnuncio({ card, precoMercado, precoFonte, onBack, onConfirm, loading }: {
  card: any
  precoMercado: number
  precoFonte: 'BRL' | 'USD' | 'BRL_FOIL' | 'BRL_REVERSE' | 'BRL_PROMO' | null
  onBack: () => void
  onConfirm: (d: any) => void
  loading: boolean
}) {
  const [preco, setPreco]       = useState(precoMercado > 0 ? precoMercado.toFixed(2) : '')
  const [condicao, setCondicao] = useState('NM')
  const [variante, setVariante] = useState(card.variante || 'normal')
  const [descricao, setDescricao] = useState('')

  const precoNum = parseFloat(String(preco).replace(',', '.')) || 0
  const diff = precoMercado > 0 && precoNum > 0 ? ((precoNum - precoMercado) / precoMercado * 100) : null

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Esquerda — preview */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {card.card_image
          ? <img src={card.card_image} alt={card.card_name} style={{ width: '100%', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} />
          : <div style={{ paddingBottom: '140%', background: 'rgba(255,255,255,0.06)', borderRadius: 10 }} />
        }
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, marginBottom: 8 }}>{card.card_name}</p>
          {/* S29 UX v5: card de preço de mercado com fonte explícita.
              Cores seguem padrão canonical (CardItem em /minha-colecao e /pokedex):
              - BRL puro: laranja (#f59e0b) — Liga Pokémon, fonte oficial BR
              - BRL variante: laranja com label da variante
              - USD convertido: azul (#60a5fa) — TCG Player, valor estimado */}
          {precoMercado > 0 && precoFonte && (() => {
            const fonteCfg = {
              BRL:         { label: 'PREÇO DE MERCADO',         badge: 'Liga Pokémon · BRL',          color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.25)' },
              BRL_FOIL:    { label: 'PREÇO MERCADO · FOIL',     badge: 'Liga Pokémon · BRL',          color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.25)' },
              BRL_REVERSE: { label: 'PREÇO MERCADO · REVERSE',  badge: 'Liga Pokémon · BRL',          color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.25)' },
              BRL_PROMO:   { label: 'PREÇO MERCADO · PROMO',    badge: 'Liga Pokémon · BRL',          color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.25)' },
              USD:         { label: 'PREÇO DE MERCADO',         badge: 'TCG Player · USD convertido', color: '#60a5fa', bg: 'rgba(96,165,250,0.07)', border: 'rgba(96,165,250,0.25)' },
            }[precoFonte]
            return (
              <div style={{ background: fonteCfg.bg, border: `1px solid ${fonteCfg.border}`, borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3, fontWeight: 600, letterSpacing: '0.05em' }}>{fonteCfg.label}</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: fonteCfg.color, letterSpacing: '-0.02em', marginBottom: 4 }}>{fmt(precoMercado)}</p>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {precoFonte === 'USD' && <span style={{ fontSize: 8 }}>≈</span>}
                  {fonteCfg.badge}
                </p>
              </div>
            )
          })()}
          {precoMercado === 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                Sem preço de mercado disponível. Defina o valor de venda livremente.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Direita — form */}
      <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Preço */}
        <div>
          <label style={LABEL}>Preço de venda</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 600 }}>R$</span>
            <input type="number" min="0" step="0.01" value={preco} onChange={e => setPreco(e.target.value)}
              placeholder="0,00"
              style={{ ...INPUT, paddingLeft: 44, fontSize: 22, fontWeight: 800 }}
              onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>
          {diff !== null && (
            <p style={{ fontSize: 12, marginTop: 5, color: diff > 0 ? '#22c55e' : diff < 0 ? '#f59e0b' : 'rgba(255,255,255,0.35)' }}>
              {diff === 0 ? '= No preço médio de mercado'
                : diff > 0 ? `▲ ${diff.toFixed(1)}% acima do mercado`
                : `▼ ${Math.abs(diff).toFixed(1)}% abaixo do mercado`}
            </p>
          )}
        </div>

        {/* Variante */}
        <div>
          <label style={LABEL}>Variante</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {VARIANTES.map(v => (
              <button key={v.key} onClick={() => setVariante(v.key)} style={{
                padding: '9px 18px', borderRadius: 10, border: 'none', fontSize: 13, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
                background: variante === v.key ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                color: variante === v.key ? '#f59e0b' : 'rgba(255,255,255,0.5)',
                outline: variante === v.key ? '1.5px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.08)',
              }}>{v.label}</button>
            ))}
          </div>
        </div>

        {/* Condição */}
        <div>
          <label style={LABEL}>Condição da carta</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CONDICOES.map(c => (
              <button key={c.key} onClick={() => setCondicao(c.key)} style={{
                padding: '9px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                background: condicao === c.key ? c.color + '18' : 'rgba(255,255,255,0.04)',
                outline: condicao === c.key ? `1.5px solid ${c.color}55` : '1px solid rgba(255,255,255,0.08)',
                color: condicao === c.key ? c.color : 'rgba(255,255,255,0.45)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{c.label}</span>
                <span style={{ fontSize: 9, opacity: 0.7 }}>{c.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label style={LABEL}>Observações <span style={{ color: 'rgba(255,255,255,0.2)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— opcional</span></label>
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
            placeholder="Ex: guardada em sleeve, sem marcas, comprada na loja oficial..."
            rows={3}
            style={{ ...INPUT, resize: 'none', lineHeight: 1.5 }}
            onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>

        {/* Resumo */}
        {precoNum > 0 && (
          <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.07), rgba(239,68,68,0.05))', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 14, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{card.card_name}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                {VARIANTES.find(v => v.key === variante)?.label} · {CONDICOES.find(c => c.key === condicao)?.desc}
              </p>
            </div>
            <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#f59e0b' }}>{fmt(precoNum)}</p>
          </div>
        )}

        {/* Ações */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', padding: '12px 20px', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
            ← Voltar
          </button>
          <button
            onClick={() => onConfirm({ preco: precoNum, condicao, variante, descricao })}
            disabled={precoNum <= 0 || loading}
            style={{
              flex: 1, background: precoNum > 0 ? BRAND : 'rgba(255,255,255,0.06)', border: 'none',
              color: precoNum > 0 ? '#000' : 'rgba(255,255,255,0.3)', padding: '12px', borderRadius: 10,
              fontSize: 14, cursor: precoNum > 0 && !loading ? 'pointer' : 'not-allowed',
              fontWeight: 700, opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? <><span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Publicando...</> : 'Publicar anúncio'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

export default function AnunciarModal({ userId, onClose, onAdded }: Props) {
  const [step, setStep]         = useState<'escolher' | 'detalhes'>('escolher')
  const [cartaSel, setCartaSel] = useState<any | null>(null)
  const [precoMercado, setPrecoMercado] = useState(0)
  const [precoFonte, setPrecoFonte] = useState<'BRL' | 'USD' | 'BRL_FOIL' | 'BRL_REVERSE' | 'BRL_PROMO' | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSelectCard(card: any) {
    // R6 + S29 UX v4: estratégia de resolução de preço com fallback.
    //
    // PRIORIDADE:
    // 1. preco_medio (REAL · Liga Pokémon · variante normal)
    // 2. preco_<variante>_medio se vendedor escolheu Foil/Reverse/Promo
    // 3. preco_foil/reverse/promo (média geral em BRL — sem min/max)
    // 4. price_usd_normal × cotação USD→BRL (TCG Player)
    // 5. price_usd_holofoil × cotação USD→BRL (TCG Player Foil)
    //
    // Se nenhum bater, vendedor digita manualmente (precoMercado = 0, sem badge).
    let preco = 0
    let fonte: typeof precoFonte = null

    if (card.pokemon_api_id) {
      const { data: priceData } = await supabase
        .from('pokemon_cards')
        .select('preco_medio, preco_foil, preco_reverse, preco_promo, price_usd_normal, price_usd_holofoil')
        .eq('id', card.pokemon_api_id)
        .maybeSingle()

      if (priceData) {
        // Tenta na ordem de prioridade
        if (priceData.preco_medio && Number(priceData.preco_medio) > 0) {
          preco = Number(priceData.preco_medio)
          fonte = 'BRL'
        } else if (priceData.preco_foil && Number(priceData.preco_foil) > 0) {
          preco = Number(priceData.preco_foil)
          fonte = 'BRL_FOIL'
        } else if (priceData.preco_reverse && Number(priceData.preco_reverse) > 0) {
          preco = Number(priceData.preco_reverse)
          fonte = 'BRL_REVERSE'
        } else if (priceData.preco_promo && Number(priceData.preco_promo) > 0) {
          preco = Number(priceData.preco_promo)
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
              const usdBrl = rate?.usd || 6.0
              preco = usd * usdBrl
              fonte = 'USD'
            } catch {
              // Sem internet ou API offline — fallback hardcoded
              preco = usd * 6.0
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
    if (!cartaSel || dados.preco <= 0) return
    setLoading(true)
    await supabase.from('marketplace').insert({
      user_id: userId, card_name: cartaSel.card_name,
      card_image: cartaSel.card_image || null, card_link: cartaSel.card_link || null,
      variante: dados.variante, price: dados.preco,
      condicao: dados.condicao, descricao: dados.descricao || null, status: 'disponivel',
    })
    setLoading(false)
    onAdded()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <div style={{ ...BOX, width: '100%', maxWidth: step === 'detalhes' ? 800 : 720, height: '82vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Header com steps */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {[['escolher', 'Escolher carta'], ['detalhes', 'Detalhes do anúncio']].map(([s, label], i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {i > 0 && <span style={{ color: 'rgba(255,255,255,0.2)' }}>→</span>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: step === s ? BRAND : (step === 'detalhes' && s === 'escolher') ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: step === s ? '#000' : 'rgba(255,255,255,0.4)' }}>
                    {step === 'detalhes' && s === 'escolher' ? <svg width='10' height='10' viewBox='0 0 20 20' fill='none'><path d='M4 10l4.5 4.5L16 6' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/></svg> : i + 1}
                  </div>
                  <span style={{ fontSize: 13, color: step === s ? '#f0f0f0' : 'rgba(255,255,255,0.35)', fontWeight: step === s ? 600 : 400 }}>{label}</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          {step === 'escolher'
            ? <EscolherCarta userId={userId} cartaSel={cartaSel} onSelect={handleSelectCard} />
            : <DetalhesAnuncio card={cartaSel} precoMercado={precoMercado} precoFonte={precoFonte} onBack={() => setStep('escolher')} onConfirm={handlePublicar} loading={loading} />
          }
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
    </div>
  )
}
