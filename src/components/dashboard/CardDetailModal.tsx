'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import CondicaoEditor from '@/components/dashboard/CondicaoEditor'

interface Props {
  card: any
  isPro: boolean
  exchangeRate?: { usd: number; eur: number }
  onClose: () => void
  onVarianteChange: (v: string) => void
  onQuantitySet: (novaQty: number) => void
  onCondicoesSaved: (novas: Record<string, number> | null) => void
  onAnunciar: () => void
  onRemove: () => void
}

const VAR_LABELS: Record<string, string> = {
  normal: 'Normal', foil: 'Foil', promo: 'Promo', reverse: 'Reverse', pokeball: 'Pokéball',
}
const TEXT_MUTED = 'rgba(255,255,255,0.5)'

function fmtBRL(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s }

// Lista de variantes que a carta possui (preco BRL na coluna, OU em outras_variantes,
// OU a variante atualmente salva). Cada uma com o medio pra ordenar/exibir.
function buildVariantes(price: any, varianteSalva: string) {
  const p = price || {}
  const std = [
    { key: 'normal',   medio: p.preco_medio },
    { key: 'foil',     medio: p.preco_foil_medio },
    { key: 'promo',    medio: p.preco_promo_medio },
    { key: 'reverse',  medio: p.preco_reverse_medio },
    { key: 'pokeball', medio: p.preco_pokeball_medio },
  ].map(v => ({ key: v.key, label: VAR_LABELS[v.key] || cap(v.key), medio: Number(v.medio) || 0 }))

  const ov = (p.outras_variantes && typeof p.outras_variantes === 'object') ? p.outras_variantes : {}
  const extra = Object.entries(ov).map(([k, val]: [string, any]) => ({
    key: k, label: cap(k), medio: Number(val?.medio) || 0,
  }))

  const all = [...std, ...extra]
  // mostra as que tem preco; sempre inclui a variante salva
  let list = all.filter(v => v.medio > 0 || v.key === varianteSalva)
  if (varianteSalva && !list.find(v => v.key === varianteSalva)) {
    list = [{ key: varianteSalva, label: VAR_LABELS[varianteSalva] || cap(varianteSalva), medio: 0 }, ...list]
  }
  // ordem: salva primeiro, depois por preco desc
  list.sort((a, b) => (a.key === varianteSalva ? -1 : b.key === varianteSalva ? 1 : b.medio - a.medio))
  return list
}

// Preco da variante selecionada: BRL (coluna) -> outras_variantes -> USD convertido.
function precoVariante(price: any, v: string, rate?: { usd: number; eur: number }) {
  const p = price || {}
  const brlMap: Record<string, [any, any, any]> = {
    normal:   [p.preco_min, p.preco_medio, p.preco_max],
    foil:     [p.preco_foil_min, p.preco_foil_medio, p.preco_foil_max],
    promo:    [p.preco_promo_min, p.preco_promo_medio, p.preco_promo_max],
    reverse:  [p.preco_reverse_min, p.preco_reverse_medio, p.preco_reverse_max],
    pokeball: [p.preco_pokeball_min, p.preco_pokeball_medio, p.preco_pokeball_max],
  }
  const brl = brlMap[v]
  if (brl && Number(brl[1]) > 0) {
    return { medio: Number(brl[1]), min: Number(brl[0]) || 0, max: Number(brl[2]) || 0, fonte: 'BRL', label: 'Liga Pokémon · BRL' }
  }
  const ov = p.outras_variantes?.[v]
  if (ov && Number(ov.medio) > 0) {
    return { medio: Number(ov.medio), min: Number(ov.min) || 0, max: Number(ov.max) || 0, fonte: 'BRL', label: 'Liga Pokémon · BRL' }
  }
  const usdMap: Record<string, any> = { normal: p.price_usd_normal, foil: p.price_usd_holofoil, reverse: p.price_usd_reverse }
  const usd = usdMap[v]
  if (Number(usd) > 0 && rate?.usd) {
    return { medio: Number(usd) * rate.usd, min: 0, max: 0, fonte: 'USD', label: 'TCG Player · USD convertido' }
  }
  return { medio: 0, min: 0, max: 0, fonte: null as string | null, label: null as string | null }
}

export default function CardDetailModal({
  card, isPro, exchangeRate, onClose,
  onVarianteChange, onQuantitySet, onCondicoesSaved, onAnunciar, onRemove,
}: Props) {
  const [isMobile, setIsMobile] = useState(false)
  const [variante, setVariante] = useState<string>(card.variante || 'normal')
  const [condicoes, setCondicoes] = useState<Record<string, number> | null>(card.condicoes || null)
  const [quantity, setQuantity] = useState<number>(card.quantity || 1)
  const [anunciados, setAnunciados] = useState<number | null>(null)
  const [savedVar, setSavedVar] = useState<string>(card.variante || 'normal')
  const [savedQty, setSavedQty] = useState<number>(card.quantity || 1)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Status no marketplace (copias ativas a venda desta carta)
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data: u } = await supabase.auth.getUser()
        if (!u?.user || !card.card_id) { if (active) setAnunciados(0); return }
        const { count } = await supabase
          .from('marketplace')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', u.user.id)
          .eq('card_id', card.card_id)
          .in('status', ['disponivel', 'reservado', 'em_negociacao', 'enviado'])
        if (active) setAnunciados(count || 0)
      } catch {
        if (active) setAnunciados(0)
      }
    })()
    return () => { active = false }
  }, [card.id, card.card_id])

  const price = card.price || null
  const variantes = buildVariantes(price, savedVar)
  const pv = precoVariante(price, variante, exchangeRate)
  const valorTotal = pv.medio * quantity
  const cartaUrlId = price?.id || card.pokemon_api_id || null

  function selecionarVariante(v: string) {
    setVariante(v)
  }

  function alterarQuantidade(delta: number) {
    const nova = quantity + delta
    if (nova < 1) return // remocao total fica no botao Remover
    setQuantity(nova)
  }

  const dirty = quantity !== savedQty || variante !== savedVar

  async function salvar() {
    if (!dirty || saving) return
    setSaving(true)
    try {
      if (quantity !== savedQty) await Promise.resolve(onQuantitySet(quantity))
      if (variante !== savedVar) await Promise.resolve(onVarianteChange(variante))
      setSavedQty(quantity)
      setSavedVar(variante)
      setFlash(true)
      window.setTimeout(() => setFlash(false), 1800)
    } finally {
      setSaving(false)
    }
  }

  // Suprime o rotulo "Liga BR — XXX" quando o set nao tem nome real de mercado.
  const setNomeRaw = price?.set_name || card.set_name || ''
  const setNome = /^Liga BR\b/i.test(setNomeRaw) ? null : (setNomeRaw || null)
  const subtitleParts = [
    setNome,
    (price?.number || card.number) ? `#${price?.number || card.number}` : null,
    price?.rarity || card.rarity,
  ].filter(Boolean) as string[]

  // ---- estilos ----
  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
    zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 0 : 24,
  }
  const modal: React.CSSProperties = {
    width: '100%', maxWidth: isMobile ? '100%' : 760, maxHeight: isMobile ? '100dvh' : '92vh',
    height: isMobile ? '100dvh' : 'auto', background: '#0d0f14',
    border: isMobile ? 'none' : '1px solid rgba(255,255,255,0.10)', borderRadius: isMobile ? 0 : 22,
    boxShadow: '0 40px 120px rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0',
  }
  const card3: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: '14px 16px',
  }
  const ttl: React.CSSProperties = {
    fontSize: 10, letterSpacing: '0.08em', fontWeight: 700, color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase', marginBottom: 12,
  }
  const rowi: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, gap: 12 }
  const kStyle: React.CSSProperties = { fontSize: 13, color: 'rgba(255,255,255,0.55)', flexShrink: 0 }
  const step: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#f0f0f0', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
  }
  const chipBase: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)', transition: 'all .12s',
  }
  const chipOn: React.CSSProperties = {
    ...chipBase, background: 'rgba(245,158,11,0.16)', borderColor: 'rgba(245,158,11,0.4)', color: '#f59e0b',
  }
  const btn: React.CSSProperties = {
    padding: 13, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', border: '1px solid transparent', fontFamily: 'inherit',
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: isMobile ? '18px 18px 14px' : '22px 26px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: '0.12em', fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', marginBottom: 6 }}>Detalhes da carta</p>
            <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{card.card_name}</p>
            {subtitleParts.length > 0 && (
              <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 5, display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                {subtitleParts.map((s, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {i > 0 && <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />}
                    {s}
                  </span>
                ))}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>×</button>
        </div>

        {/* BODY */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '248px 1fr', gap: isMobile ? 18 : 26, padding: isMobile ? 18 : 26, overflowY: 'auto' }}>

          {/* COLUNA ESQUERDA — imagem */}
          <div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: -12, borderRadius: 20, zIndex: 0, background: 'radial-gradient(closest-side, rgba(245,158,11,0.30), transparent 75%)', filter: 'blur(14px)' }} />
              {card.card_image ? (
                <img src={card.card_image} alt={card.card_name} style={{ position: 'relative', width: '100%', borderRadius: 14, display: 'block', boxShadow: '0 18px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)' }} />
              ) : (
                <div style={{ position: 'relative', width: '100%', aspectRatio: '63 / 88', borderRadius: 14, background: 'linear-gradient(160deg,#1a1d29,#0f1119)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, padding: 18, textAlign: 'center', boxShadow: '0 18px 50px rgba(0,0,0,0.6)' }}>{card.card_name}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.14)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>{VAR_LABELS[variante] || cap(variante)}</span>
              {(price?.rarity || card.rarity) && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>{price?.rarity || card.rarity}</span>
              )}
            </div>
          </div>

          {/* COLUNA DIREITA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* PRECO DE MERCADO */}
            <div style={{ background: pv.fonte === 'USD' ? 'rgba(96,165,250,0.07)' : 'rgba(245,158,11,0.07)', border: `1px solid ${pv.fonte === 'USD' ? 'rgba(96,165,250,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 14, padding: '14px 16px' }}>
              <p style={{ fontSize: 9, letterSpacing: '0.08em', fontWeight: 700, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>PREÇO DE MERCADO · {(VAR_LABELS[variante] || cap(variante)).toUpperCase()}</p>
              {pv.medio > 0 ? (
                <>
                  <p style={{ fontSize: 26, fontWeight: 800, color: pv.fonte === 'USD' ? '#60a5fa' : '#f59e0b', letterSpacing: '-0.02em', lineHeight: 1 }}>{fmtBRL(pv.medio)}</p>
                  {pv.min > 0 && pv.max > 0 && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>Faixa: {fmtBRL(pv.min)} — {fmtBRL(pv.max)}</p>
                  )}
                  <p style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Fonte: <b style={{ color: pv.fonte === 'USD' ? '#60a5fa' : '#f59e0b', fontWeight: 700 }}>{pv.label}</b></p>
                </>
              ) : (
                <div style={{ marginTop: 2 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>Ainda sem preço de mercado para esta variante.</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', marginTop: 5, lineHeight: 1.45 }}>Se não aparecer em até 24h, entre em contato que iremos averiguar.</p>
                </div>
              )}
            </div>

            {/* NA SUA COLECAO — ordem: Quantidade, Condicoes, Variante, Valor */}
            <div style={card3}>
              <p style={ttl}>Na sua coleção</p>

              {/* Quantidade */}
              <div style={rowi}>
                <span style={kStyle}>Quantidade</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => alterarQuantidade(-1)} style={step}>−</button>
                  <span style={{ fontSize: 15, fontWeight: 800, minWidth: 20, textAlign: 'center' }}>{quantity}</span>
                  <button onClick={() => alterarQuantidade(1)} style={step}>+</button>
                </span>
              </div>

              {/* Condicoes (editor) */}
              <div style={{ marginBottom: 13 }}>
                <span style={{ ...kStyle, display: 'block', marginBottom: 8 }}>Condições</span>
                <CondicaoEditor
                  userCardId={card.id}
                  quantity={quantity}
                  condicoes={condicoes}
                  isPro={isPro}
                  onSaved={(novas: Record<string, number> | null) => { setCondicoes(novas); onCondicoesSaved(novas) }}
                />
              </div>

              {/* Variante (chips — salva ao trocar) */}
              <div style={{ ...rowi, alignItems: 'flex-start' }}>
                <span style={{ ...kStyle, marginTop: 5 }}>Variante</span>
                <span style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {variantes.map(v => (
                    <button key={v.key} onClick={() => selecionarVariante(v.key)} style={variante === v.key ? chipOn : chipBase}>{v.label}</button>
                  ))}
                </span>
              </div>

              {/* Valor total */}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 13, marginTop: 3, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Valor total ({quantity} cópia{quantity !== 1 ? 's' : ''})</span>
                <span style={{ fontSize: 19, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.02em' }}>{valorTotal > 0 ? fmtBRL(valorTotal) : '—'}</span>
              </div>

              {/* Salvar alteracoes (quantidade + variante) */}
              <button
                onClick={salvar}
                disabled={!dirty || saving}
                style={{
                  width: '100%', marginTop: 14, padding: '11px', borderRadius: 10, fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 700, cursor: dirty && !saving ? 'pointer' : 'default',
                  border: '1px solid ' + (flash ? 'rgba(34,197,94,0.4)' : dirty ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'),
                  background: flash ? 'rgba(34,197,94,0.15)' : dirty ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.03)',
                  color: flash ? '#22c55e' : dirty ? '#f59e0b' : 'rgba(255,255,255,0.35)',
                  transition: 'all .15s',
                }}
              >
                {saving ? 'Salvando…' : flash ? '✓ Alterações salvas' : dirty ? 'Salvar alterações' : 'Tudo salvo'}
              </button>
            </div>

            {/* STATUS */}
            <div style={card3}>
              <p style={ttl}>Status</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, flexWrap: 'wrap' }}>
                {anunciados === null ? (
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Carregando…</span>
                ) : anunciados > 0 ? (
                  <>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.28)' }}>● {anunciados} cópia{anunciados !== 1 ? 's' : ''} à venda</span>
                    <a href="/marketplace" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'underline', fontSize: 12 }}>ver no marketplace</a>
                  </>
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Não anunciada no marketplace.</span>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ACOES */}
        <div style={{ display: 'flex', gap: 10, padding: isMobile ? '0 18px 18px' : '0 26px 26px', flexShrink: 0 }}>
          <button onClick={onAnunciar} style={{ ...btn, flex: 1, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff' }}>Anunciar Carta</button>
          {cartaUrlId && (
            <a href={`/carta/${cartaUrlId}`} style={{ ...btn, background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', padding: '13px 16px' }}>Ver página</a>
          )}
          <button onClick={onRemove} style={{ ...btn, background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171', padding: '13px 16px' }}>Remover</button>
        </div>

      </div>
    </div>
  )
}
