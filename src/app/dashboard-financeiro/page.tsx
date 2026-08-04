'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { getUserPlan } from '@/lib/isPro'
import { ENFORCEMENT_ATIVO } from '@/lib/checkCardLimit'
import PriceChart from '@/components/PriceChart'
import AppLayout from '@/components/ui/AppLayout'
import OnboardingModal from '@/components/ui/OnboardingModal'
import AddCardModal from '@/components/dashboard/AddCardModal'
import { IconTrendingUp, IconHistory, IconCollection, IconFire, IconWarning, IconWallet, IconMarketplace, IconChart, IconCard, IconSearch, IconArrowRight } from '@/components/ui/Icons'
import { useAppModal } from '@/components/ui/useAppModal'
import { GRADUADORA_MAP, notaCurta } from '@/lib/graduadoras'

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

const getVariation = (history: any[]) => {
  if (!history || history.length < 2) return 0
  const first = Number(history[0].preco_medio || history[0].normal || 0)
  const last = Number(history[history.length - 1].preco_medio || history[history.length - 1].normal || 0)
  if (!first) return 0
  return ((last - first) / first) * 100
}

// ─── Design tokens ──────────────────────────────────────────────────────────

const SURFACE = { background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 16 }
const BRAND = 'var(--ac-grad)'

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ ...SURFACE, padding: '16px 20px', textAlign: 'center' }}>
      <p style={{ fontSize: 11, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: color || 'var(--bx-text)' }}>{value}</p>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>{children}</p>
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div style={{ ...SURFACE, padding: '12px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.4 }}>
      <p style={{ fontSize: 13, color: 'var(--bx-text-2)', fontStyle: 'italic' }}>{label}</p>
      <p style={{ fontSize: 13, color: 'var(--bx-text-3)' }}>—</p>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DashboardFinanceiro() {
  const { showAlert } = useAppModal()
  const [stats, setStats] = useState({ totalCompras: 0, totalVendas: 0, quantidade: 0, valorColecao: 0 })
  const [transactions, setTransactions] = useState<any[]>([])
  const [rankingWithVariation, setRankingWithVariation] = useState<any[]>([])
  const [priceHistory, setPriceHistory] = useState<any[]>([])
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [selectedCardPrice, setSelectedCardPrice] = useState<any>(null)
  const [cardImage, setCardImage] = useState<string | null>(null)
  const [userCards, setUserCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isPro, setIsPro] = useState(false)
  const [isTrial, setIsTrial] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [openAddModal, setOpenAddModal] = useState(false)
  const [cardSortOrder, setCardSortOrder] = useState<'alpha' | 'recent'>('alpha')
  const [cardSearch, setCardSearch] = useState('')
  const historicoRef = useRef<HTMLDivElement>(null)

  function selecionarNoHistorico(userCardId: string) {
    setSelectedCardId(userCardId)
    historicoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Load data ───────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const { data: userData } = await supabase.auth.getUser()
        if (!userData.user) { window.location.href = '/login'; return }
        const uid = userData.user.id
        setUserId(uid)

        const { isPro: pro, isTrial: trial, caps } = await getUserPlan(uid)
        if (ENFORCEMENT_ATIVO && !caps.podeDashboard) { window.location.href = '/minha-colecao'; return }
        setIsPro(pro || trial)
        setIsTrial(trial) // trial já indica trial, independente de isPro
        // Historico de compra/venda -- le de `pedidos` (marketplace real), nao
        // mais de `transactions` (tabela abandonada, 0 linhas -- essa secao
        // ficava sempre vazia pra todo mundo). Mesma regra de "venda de
        // verdade" que o painel da loja ja usa: fora aguardando_pagamento e
        // reembolsado (auditoria 03/08/2026).
        const { data: pedidos } = await supabase
          .from('pedidos')
          .select('id, item_nome, item_imagem, comprador_user_id, vendedor_user_id, total_comprador_cents, liquido_loja_cents, status, created_at')
          .or(`comprador_user_id.eq.${uid},vendedor_user_id.eq.${uid}`)
          .in('status', ['pago', 'enviado', 'entregue'])
          .order('created_at', { ascending: false })
          .limit(200)
        // Enrich com nomes dos usuários
        const userIds = [...new Set([
          ...(pedidos || []).map(t => t.comprador_user_id),
          ...(pedidos || []).map(t => t.vendedor_user_id),
        ].filter(Boolean))]
        let usersMap: Record<string, any> = {}
        if (userIds.length > 0) {
          // S29: lê de public_users (campos públicos) em vez de users.
          const { data: usersData } = await supabase.from('public_users').select('id, name, city').in('id', userIds)
          usersMap = (usersData || []).reduce((acc: any, u: any) => { acc[u.id] = u; return acc }, {})
        }
        const pedidosEnriched = (pedidos || []).map(t => ({
          ...t,
          buyer_id: t.comprador_user_id,
          seller_id: t.vendedor_user_id,
          card_name: t.item_nome,
          buyer_name: usersMap[t.comprador_user_id]?.name || 'Comprador',
          seller_name: usersMap[t.vendedor_user_id]?.name || 'Vendedor',
          buyer_city: usersMap[t.comprador_user_id]?.city || '',
          seller_city: usersMap[t.vendedor_user_id]?.city || '',
        }))
        setTransactions(pedidosEnriched)
        const compras = (pedidos || []).filter(t => t.comprador_user_id === uid).reduce((a, t) => a + Number(t.total_comprador_cents || 0) / 100, 0)
        const vendas = (pedidos || []).filter(t => t.vendedor_user_id === uid).reduce((a, t) => a + Number(t.liquido_loja_cents || 0) / 100, 0)
        const { data: cards } = await supabase.from('user_cards').select('*').eq('user_id', uid)
        setUserCards(cards || [])

        // ── Busca câmbio para estimativas USD/EUR ──────────────────────────
        let exchangeRate = { usd: 6.0, eur: 6.5 }
        try {
          const er = await fetch('/api/exchange-rate').then(r => r.json())
          exchangeRate = { usd: er.usd || 6.0, eur: er.eur || 6.5 }
        } catch {}



        const priceById: any = {}
        const priceByLink: any = {}

        // 1. Lookup por pokemon_api_id (mais preciso)
        const apiIds = [...new Set((cards || []).map((c: any) => c.pokemon_api_id).filter(Boolean))]
        if (apiIds.length > 0) {
          const byId = await fetch('/api/cards/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: apiIds }) }).then((r) => r.json()).then((d) => d.cards || []).catch(() => [])
          ;(byId || []).forEach((p: any) => { priceById[p.id] = p })
        }

        // 2. Lookup por liga_link
        const allLinks = [...new Set((cards || []).map((c: any) => c.card_link).filter(Boolean))]
        if (allLinks.length > 0) {
          const byLink = await fetch('/api/cards/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ liga_links: allLinks }) }).then((r) => r.json()).then((d) => d.cards || []).catch(() => [])
          ;(byLink || []).forEach((p: any) => { if (p.liga_link) priceByLink[p.liga_link] = p })
        }

        // 3. Fallback por nome (chunk de 50)
        const priceByName: any = {}
        const legacy = (cards || []).filter((c: any) => !c.pokemon_api_id && !c.card_link)
        if (legacy.length > 0) {
          const cleanEN = (n: string) => { const s = (n||'').replace(/\s*\([^)]*\)\s*$/,'').trim(); return s.includes(' / ')?(s.split(' / ').pop()?.trim()||s):s }
          const cleanPT = (n: string) => { const s = (n||'').replace(/\s*\([^)]*\)\s*$/,'').trim(); return s.includes(' / ')?(s.split(' / ')[0]?.trim()||s):s }
          const names = [...new Set(legacy.flatMap((c: any) => [cleanEN(c.card_name), cleanPT(c.card_name)].filter(Boolean)))].slice(0, 50)
          if (names.length > 0) {
            const byName = await fetch('/api/cards/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ names }) }).then((r) => r.json()).then((d) => d.cards || []).catch(() => [])
            ;(byName || []).forEach((p: any) => { if (!priceByName[p.name?.trim()]) priceByName[p.name?.trim()] = p })
          }
          const cleanEN2 = (n: string) => { const s = (n||'').replace(/\s*\([^)]*\)\s*$/,'').trim(); return s.includes(' / ')?(s.split(' / ').pop()?.trim()||s):s }
          const cleanPT2 = (n: string) => { const s = (n||'').replace(/\s*\([^)]*\)\s*$/,'').trim(); return s.includes(' / ')?(s.split(' / ')[0]?.trim()||s):s }
          legacy.forEach((c: any) => {
            const p = priceByName[cleanEN2(c.card_name)] || priceByName[cleanPT2(c.card_name)]
            if (p) priceByLink[`legacy:${c.id}`] = p
          })
        }

        const getP = (c: any) => {
          if (c.pokemon_api_id && priceById[c.pokemon_api_id]) return priceById[c.pokemon_api_id]
          if (c.card_link && priceByLink[c.card_link]) return priceByLink[c.card_link]
          return priceByLink[`legacy:${c.id}`] || null
        }

        // Melhor preço por variante (BRL > USD > EUR)
        const getBestVal = (p: any, variante: string): number => {
          if (!p) return 0
          const CAMPOS: any = { normal: 'preco_medio', foil: 'preco_foil_medio', promo: 'preco_promo_medio', reverse: 'preco_reverse_medio', pokeball: 'preco_pokeball_medio' }
          const brl = parseFloat(p[CAMPOS[variante]] || p.preco_medio || 0)
          if (brl > 0) return brl
          const usd = Math.max(parseFloat(p.price_usd_holofoil || 0), parseFloat(p.price_usd_normal || 0))
          if (usd > 0) return usd * exchangeRate.usd
          const eur = Math.max(parseFloat(p.price_eur_holofoil || 0), parseFloat(p.price_eur_normal || 0))
          if (eur > 0) return eur * exchangeRate.eur
          return 0
        }

        let valorTotal = 0
        const enrichedCards: any[] = []

        for (const card of cards || []) {
          // Carta graduada: o preco de mercado da carta CRUA nao serve -- o
          // valor e o que o dono declarou pro slab (mesma regra do
          // CardItem.tsx). Sem isso o patrimonio contava a Bianca's Devotion
          // PSA 10 do Du a R$37,22 em vez de R$1.553,10 (auditoria 03/08/2026).
          const isGraduada = !!(card.graduada && Number(card.valor_graduada) > 0)
          const p = getP(card)
          const variante = card.variante || 'normal'
          const val = isGraduada ? Number(card.valor_graduada) : getBestVal(p, variante)
          const qty = card.quantity || 1
          valorTotal += val * qty
          if (isGraduada || (p && val > 0)) {
            enrichedCards.push({
              ...(p || {}), card_name: card.card_name, variante, precoVariante: val, variation: 0,
              graduada: isGraduada, graduadora: card.graduadora || null, nota: card.nota || null, blackLabel: !!card.black_label,
              userCardId: card.id,
            })
          }
        }

        // ── Variação por carta — 1 QUERY BATCH em price_history (em vez de N chamadas /api/historico) ──
        // Janela fixa de 30 dias -- sem isso cada carta era medida desde o seu
        // 1o registro (uma com dias de historico, outra com meses), o que
        // tornava "Oportunidades"/"Alertas" incomparaveis entre cartas
        // (achado de auditoria 04/08/2026).
        const rankIds = [...new Set(enrichedCards.map((c: any) => c.id).filter(Boolean))]
        const variationById: Record<string, number> = {}
        if (rankIds.length > 0) {
          const desde30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          const { data: hist } = await supabase
            .from('price_history')
            .select('card_id, preco_medio, preco_normal, recorded_at')
            .in('card_id', rankIds)
            .gte('recorded_at', desde30d)
            .order('recorded_at', { ascending: true })
          const byCard: Record<string, any[]> = {}
          for (const h of hist || []) {
            if (!h.card_id) continue
            if (!byCard[h.card_id]) byCard[h.card_id] = []
            byCard[h.card_id].push(h)
          }
          for (const cid of Object.keys(byCard)) {
            const rows = byCard[cid]
            if (rows.length < 2) continue
            const first = Number(rows[0].preco_medio || rows[0].preco_normal || 0)
            const last = Number(rows[rows.length - 1].preco_medio || rows[rows.length - 1].preco_normal || 0)
            if (first > 0) variationById[cid] = ((last - first) / first) * 100
          }
        }
        const withVariation = enrichedCards.map((c: any) => ({ ...c, variation: variationById[c.id] || 0 }))
        withVariation.sort((a, b) => b.precoVariante - a.precoVariante)
        setRankingWithVariation(withVariation)
        setStats({ totalCompras: compras, totalVendas: vendas, quantidade: cards?.length || 0, valorColecao: valorTotal })

        // Onboarding — aparece sempre que entrar, até completar todos os passos
        const completo = localStorage.getItem(`ob-complete-${uid}`)
        if (!completo) {
          setShowOnboarding(true)
        }

        if (cards && cards.length > 0) {
          // Ordem alfabetica pra bater com a ordem visual da lista (que abre
          // em 'alpha' por padrao) -- senao a carta pre-selecionada podia
          // cair fora da area visivel do seletor sem nenhum scroll ate ela.
          const primeiraDaLista = [...cards].sort((a, b) => a.card_name.localeCompare(b.card_name))[0]
          setSelectedCardId(primeiraDaLista.id)
        }
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    loadData()
  }, [])

  useEffect(() => {
    if (!selectedCardId) return
    async function loadHistory() {
      // 1. Pegar o user_card específico da coleção
      const userCard = userCards.find(c => c.id === selectedCardId)
      if (!userCard) return

      // 2. Buscar preço/dados via pokemon_api_id (match preciso, não por nome)
      const apiId = userCard.pokemon_api_id
      if (apiId) {
        const prices = await fetch('/api/cards/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [apiId], full: true }),
        }).then((r) => r.json()).then((d) => (d.cards && d.cards[0]) || null).catch(() => null)
        setSelectedCardPrice(prices ? { ...prices, card_name: prices.name } : null)

        // 3. Histórico real via price_history (tabela nova com trigger)
        const { data: history } = await supabase
          .from('price_history')
          .select('preco_normal, preco_medio, preco_foil, preco_max, recorded_at')
          .eq('card_id', apiId)
          .order('recorded_at', { ascending: true })
          .limit(90)

        setPriceHistory((history || []).map(h => ({
          date: new Date(h.recorded_at).toISOString().split('T')[0],
          preco_medio: h.preco_medio,
          normal: h.preco_normal,
          foil: h.preco_foil,
        })))
      } else {
        // Fallback pra cards legacy sem pokemon_api_id
        setSelectedCardPrice(null)
        setPriceHistory([])
      }
    }
    loadHistory()
  }, [selectedCardId, userCards])

  useEffect(() => {
    if (!selectedCardId) return
    const found = userCards.find(c => c.id === selectedCardId)
    setCardImage(found?.card_image || null)
  }, [selectedCardId, userCards])

  const saldo = stats.totalVendas - stats.totalCompras
  const variation = getVariation(priceHistory)
  const cardsFiltradas = [...userCards]
    .filter(c => c.card_name.toLowerCase().includes(cardSearch.trim().toLowerCase()))
    .sort((a, b) => cardSortOrder === 'alpha'
      ? a.card_name.localeCompare(b.card_name)
      : new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--bx-text-3)', flexDirection: 'column', gap: 12 }}>
        <IconChart size={32} color="var(--bx-text-faint)" />
        <p style={{ fontSize: 14 }}>Carregando dashboard...</p>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <style>{`
        .dash-clickable-row { transition: background 0.15s ease; border-radius: 8px; }
        .dash-clickable-row:hover { background: var(--bx-surface-2); }
        @media (max-width: 768px) {
          .dash-hero { flex-direction: column !important; padding: 20px 16px !important; }
          .dash-hero h1 { font-size: 32px !important; }
          .dash-hero-btns { flex-direction: column !important; min-width: unset !important; width: 100% !important; }
          .dash-hero-btns button { width: 100% !important; }
          .dash-2col { grid-template-columns: 1fr !important; }
          .dash-surface { padding: 16px !important; }
          .dash-chips { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-oport-row { flex-direction: column !important; gap: 8px !important; }
          .dash-oport-val { text-align: left !important; }
        }
      `}</style>
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 1200, margin: '0 auto' }}>

        {/* ── HERO ── */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.06))',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 20, padding: '28px 32px', marginBottom: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20
        }} className="dash-hero">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <p style={{ fontSize: 11, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Patrimônio total da coleção
              </p>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 100, letterSpacing: '0.08em',
                background: isTrial ? 'rgba(96,165,250,0.12)' : isPro ? 'rgba(245,158,11,0.15)' : 'var(--bx-surface-2)',
                border: `1px solid ${isTrial ? 'rgba(96,165,250,0.35)' : isPro ? 'rgba(245,158,11,0.4)' : 'var(--bx-border-2)'}`,
                color: isTrial ? 'var(--bx-blue)' : isPro ? 'var(--ac-1)' : 'var(--bx-text-3)',
              }}>
                {isPro && !isTrial ? 'PRO ✦' : isTrial ? 'TRIAL ✦' : 'FREE'}
              </span>
            </div>
            <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.04em', background: BRAND, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 16 }}>
              {fmt(stats.valorColecao)}
            </h1>
            <div style={{ display: 'flex', gap: 28 }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--bx-text-3)', marginBottom: 3 }}>Saldo</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: saldo >= 0 ? 'var(--bx-green)' : 'var(--bx-red)' }}>{saldo >= 0 ? '+' : ''}{fmt(saldo)}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--bx-text-3)', marginBottom: 3 }}>Cartas</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--bx-text)' }}>{stats.quantidade}</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200 }} className="dash-hero-btns">
            {userId && (
              <button onClick={() => setOpenAddModal(true)} style={{ background: BRAND, border: 'none', color: 'var(--bx-brand-ink)', padding: '13px 20px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 0 24px rgba(245,158,11,0.25)' }}>
                Adicionar carta
              </button>
            )}
          </div>
        </div>

        {/* ── CHIPS ── */}
        {/* Era 4 (Total cartas / Total compras / Total vendas / Saldo) --
            "Total cartas" e "Saldo" ja aparecem no hero, redundante. Fica so
            o que e informacao nova (achado 03/08/2026). */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }} className="dash-chips">
          <StatChip label="Total compras" value={fmt(stats.totalCompras)} color="var(--bx-red)" />
          <StatChip label="Total vendas" value={fmt(stats.totalVendas)} color="var(--bx-green)" />
        </div>

        {/* ── 2 COLUNAS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 20, alignItems: 'start' }} className="dash-2col">

          {/* COLUNA ESQUERDA — Gráfico */}
          <div>

            {/* Seletor de carta + gráfico */}
            <div ref={historicoRef} style={{ ...SURFACE, padding: 24, marginBottom: 16 }} className="dash-surface">
              <div style={{ marginBottom: 16 }}>
                <SectionTitle><IconTrendingUp size={14} color="var(--bx-text-3)" />Histórico de preço</SectionTitle>

                {/* Busca por nome */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', borderRadius: 10, padding: '9px 12px', marginTop: 12, marginBottom: 10 }}>
                  <IconSearch size={14} color="var(--bx-text-3)" style={{ flexShrink: 0 }} />
                  <input
                    value={cardSearch}
                    onChange={e => setCardSearch(e.target.value)}
                    placeholder="Buscar carta na coleção..."
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--bx-text)', fontFamily: 'inherit' }}
                  />
                </div>

                {/* Filtros de ordenação */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {(['alpha', 'recent'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setCardSortOrder(opt)}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: '8px 14px', minHeight: 40, borderRadius: 20, cursor: 'pointer', border: 'none',
                        background: cardSortOrder === opt ? 'rgba(var(--ac-1-rgb), 0.2)' : 'var(--bx-surface-2)',
                        color: cardSortOrder === opt ? 'var(--ac-1)' : 'var(--bx-text-3)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {opt === 'alpha' ? '↑ Alfabética' : '↓ Mais recente'}
                    </button>
                  ))}
                </div>

                {/* Label */}
                <p style={{ fontSize: 11, color: 'var(--bx-text-3)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Selecione sua carta
                </p>

                {/* Lista de cartas — uma por linha */}
                <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
                  {userCards.length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--bx-text-3)' }}>Nenhuma carta na coleção</p>
                  )}
                  {userCards.length > 0 && cardsFiltradas.length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--bx-text-3)' }}>Nenhuma carta encontrada</p>
                  )}
                  {cardsFiltradas.map(c => {
                      const isSelected = selectedCardId === c.id
                      const varLabels: Record<string, string> = { normal: 'Normal', foil: 'Foil', promo: 'Promo', reverse: 'Reverse Foil', pokeball: 'Pokeball Foil' }
                      const vLabel = varLabels[c.variante || 'normal'] || 'Normal'
                      const varColors: Record<string, string> = { normal: '#60a5fa', foil: '#f59e0b', promo: '#a78bfa', reverse: '#34d399', pokeball: '#fb923c' }
                      const vColor = varColors[c.variante || 'normal'] || '#60a5fa'
                      // Extrai número da carta do nome (ex: "Charizard (4/102)" → "4/102")
                      const numMatch = c.card_name.match(/\(([^)]+)\)/)
                      const cardNum = numMatch?.[1] || ''
                      const cardBaseName = c.card_name.replace(/\s*\([^)]*\)/, '').trim()
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCardId(c.id)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                            border: isSelected ? '1px solid rgba(var(--ac-1-rgb), 0.4)' : '1px solid var(--bx-surface-2)',
                            background: isSelected ? 'rgba(var(--ac-1-rgb), 0.08)' : 'var(--bx-surface)',
                            transition: 'all 0.15s', textAlign: 'left',
                          }}
                        >
                          {/* Coluna esquerda: Nome + Número + Badge variante */}
                          <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                            <p style={{
                              fontSize: 13, fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? 'var(--bx-text)' : 'var(--bx-text-2)',
                              marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {cardBaseName}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {cardNum && (
                                <span style={{ fontSize: 11, color: 'var(--bx-text-3)' }}>#{cardNum}</span>
                              )}
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                                background: `${vColor}18`, color: vColor, border: `1px solid ${vColor}40`,
                              }}>{vLabel}</span>
                            </div>
                          </div>

                          {/* Coluna direita: Imagem da carta */}
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            {c.card_image ? (
                              <img
                                src={c.card_image}
                                alt={c.card_name}
                                style={{ width: 36, height: 50, objectFit: 'cover', borderRadius: 5, display: 'block', border: isSelected ? '1px solid rgba(var(--ac-1-rgb), 0.5)' : '1px solid var(--bx-border-2)' }}
                              />
                            ) : (
                              <div style={{ width: 36, height: 50, borderRadius: 5, background: 'var(--bx-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconCard size={16} color="var(--bx-text-3)" /></div>
                            )}
                            {isSelected && (
                              <div style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%', background: 'var(--ac-1)', border: '2px solid var(--bx-bg)' }} />
                            )}
                          </div>
                        </button>
                      )
                    })}
                </div>
              </div>

              {/* Carta selecionada */}
              {selectedCardId && (() => {
                const selectedUserCard = userCards.find(c => c.id === selectedCardId)
                if (!selectedUserCard) return null
                return (
                  <div style={{ marginBottom: 16, padding: '14px 16px', background: 'var(--bx-surface)', borderRadius: 12 }}>
                    {/* Linha superior: imagem + nome + preços */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      {cardImage ? (
                        <img src={cardImage} alt={selectedUserCard.card_name} style={{ width: 44, height: 60, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 44, height: 60, background: 'var(--bx-surface-2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconCard size={18} color="var(--bx-text-3)" /></div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedUserCard.card_name}</p>
                        {selectedCardPrice ? (() => {
                          // Usa a variante salva no user_cards para esta carta
                          const cardVariante = selectedUserCard.variante || 'normal'
                          const variantLabel: Record<string, string> = { normal: 'Normal', foil: 'Foil', promo: 'Promo', reverse: 'Reverse Foil', pokeball: 'Pokeball Foil' }
                          const precos = cardVariante === 'foil'
                            ? { min: selectedCardPrice.preco_foil_min, medio: selectedCardPrice.preco_foil_medio, max: selectedCardPrice.preco_foil_max }
                            : cardVariante === 'promo'
                            ? { min: selectedCardPrice.preco_promo_min, medio: selectedCardPrice.preco_promo_medio, max: selectedCardPrice.preco_promo_max }
                            : cardVariante === 'reverse'
                            ? { min: selectedCardPrice.preco_reverse_min, medio: selectedCardPrice.preco_reverse_medio, max: selectedCardPrice.preco_reverse_max }
                            : cardVariante === 'pokeball'
                            ? { min: selectedCardPrice.preco_pokeball_min, medio: selectedCardPrice.preco_pokeball_medio, max: selectedCardPrice.preco_pokeball_max }
                            : { min: selectedCardPrice.preco_min, medio: selectedCardPrice.preco_medio, max: selectedCardPrice.preco_max }
                          return (
                            <>
                              <p style={{ fontSize: 10, color: 'var(--bx-text-3)', marginBottom: 4 }}>
                                Variante: <strong style={{ color: 'var(--ac-1)' }}>{variantLabel[cardVariante] || cardVariante}</strong>
                              </p>
                              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                <div><p style={{ fontSize: 10, color: 'var(--bx-text-3)' }}>Mín</p><p style={{ fontSize: 13, fontWeight: 700, color: 'var(--bx-green)' }}>{fmt(precos.min)}</p></div>
                                <div><p style={{ fontSize: 10, color: 'var(--bx-text-3)' }}>Médio</p><p style={{ fontSize: 13, fontWeight: 700, color: 'var(--bx-blue)' }}>{fmt(precos.medio)}</p></div>
                                <div><p style={{ fontSize: 10, color: 'var(--bx-text-3)' }}>Máx</p><p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ac-1)' }}>{fmt(precos.max)}</p></div>
                              </div>
                            </>
                          )
                        })() : (
                          <p style={{ fontSize: 12, color: 'var(--bx-text-3)', fontStyle: 'italic' }}>Sem dados de preço disponíveis</p>
                        )}
                      </div>
                    </div>
                    {priceHistory.length >= 2 && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
                        color: variation >= 0 ? 'var(--bx-green)' : 'var(--bx-red)',
                        background: variation >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        border: `1px solid ${variation >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                        padding: '3px 9px', borderRadius: 100,
                      }}>
                        {pct(variation)} — performance desta carta
                      </span>
                    )}
                  </div>
                )
              })()}

              {/* Gráfico histórico */}
              {priceHistory.length > 0 ? (
                <PriceChart data={priceHistory.map(d => ({ date: d.date || d.created_at || '', normal: d.preco_medio || d.normal || 0, foil: d.preco_foil || d.foil || null }))} />
              ) : (
                <div style={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60, opacity: 0.15 }}>
                    {[40, 55, 45, 70, 60, 80, 65, 90, 75, 85].map((h, i) => (
                      <div key={i} style={{ width: 16, height: h, background: 'var(--ac-1)', borderRadius: '3px 3px 0 0' }} />
                    ))}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--bx-text-3)' }}>Histórico ainda sendo coletado</p>
                  <p style={{ fontSize: 11, color: 'var(--bx-text-faint)' }}>Dados aparecem em até 24h após o primeiro scan diário</p>
                </div>
              )}
            </div>

            {/* Últimas transações */}
            <div style={{ ...SURFACE, padding: 24 }} className="dash-surface">
              <SectionTitle><IconHistory size={14} color="var(--bx-text-3)" />Últimas transações</SectionTitle>
              {transactions.length === 0 ? (
                <>
                  <EmptyRow label="Nenhuma transação ainda" />
                  <EmptyRow label="Venda uma carta no Mercado" />
                  <EmptyRow label="para ver seu histórico aqui" />
                </>
              ) : (
                transactions.slice(0, 8).map(t => {
                  const isCompra = t.buyer_id === userId
                  const contato = isCompra ? t.seller_name : t.buyer_name
                  const cidade = isCompra ? t.seller_city : t.buyer_city
                  const valor = isCompra ? Number(t.total_comprador_cents || 0) / 100 : Number(t.liquido_loja_cents || 0) / 100
                  const data = t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''
                  return (
                    <Link key={t.id} href={`/pedido/${t.id}`} className="dash-clickable-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '1px solid var(--bx-border)', overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}>
                      {/* Ícone */}
                      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                        background: isCompra ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                        border: `1px solid ${isCompra ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
                      }}>
                        {isCompra ? <IconMarketplace size={14} color="currentColor" /> : <IconWallet size={14} color="currentColor" />}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--bx-text)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.card_name}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--bx-text-3)' }}>
                          {isCompra ? 'Compra de' : 'Venda para'} {contato}{cidade ? ` · ${cidade}` : ''}{data ? ` · ${data}` : ''}
                        </p>
                      </div>
                      {/* Valor */}
                      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: isCompra ? 'var(--bx-red)' : 'var(--bx-green)' }}>
                          {isCompra ? '-' : '+'}{fmt(valor)}
                        </p>
                        <p style={{ fontSize: 10, color: 'var(--bx-text-3)' }}>
                          {isCompra ? 'compra' : 'venda'}{!isCompra ? ' · líquido' : ''}
                        </p>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>

          </div>

          {/* COLUNA DIREITA — Rankings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Cartas mais valiosas */}
            <div style={{ ...SURFACE, padding: 24 }} className="dash-surface">
              <SectionTitle><IconCollection size={14} color="var(--bx-text-3)" />Cartas mais valiosas</SectionTitle>
              {rankingWithVariation.length === 0 ? (
                <>
                  {['Adicione cartas para ver o ranking', 'Busque cartas pelo nome', 'Os preços aparecem automaticamente'].map(l => (
                    <EmptyRow key={l} label={l} />
                  ))}
                </>
              ) : (
                rankingWithVariation.slice(0, 8).map((r, i) => {
                  const price = r.precoVariante || 0
                  const varLabels: Record<string, string> = { normal: 'Normal', foil: 'Foil', promo: 'Promo', reverse: 'Reverse Foil', pokeball: 'Pokeball' }
                  const varColors: Record<string, string> = { normal: '#60a5fa', foil: '#f59e0b', promo: '#a78bfa', reverse: '#34d399', pokeball: '#fb923c' }
                  const vLabel = varLabels[r.variante || 'normal'] || 'Normal'
                  const vColor = varColors[r.variante || 'normal'] || '#60a5fa'
                  const gradMeta = r.graduada ? GRADUADORA_MAP[r.graduadora || ''] : null
                  return (
                    <button
                      key={r.id || i}
                      onClick={() => r.userCardId && selecionarNoHistorico(r.userCardId)}
                      className="dash-clickable-row"
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '10px 4px', borderBottom: '1px solid var(--bx-border)', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: r.userCardId ? 'pointer' : 'default', textAlign: 'left', font: 'inherit' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? 'var(--ac-1)' : 'var(--bx-text-faint)', minWidth: 20, flexShrink: 0 }}>#{i + 1}</span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, color: 'var(--bx-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.card_name}
                            {gradMeta && (
                              <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 6, background: `${gradMeta.cor}26`, color: gradMeta.cor, border: `1px solid ${gradMeta.cor}4d`, marginLeft: 6 }}>
                                {gradMeta.curto} {notaCurta(r.nota, r.blackLabel)}
                              </span>
                            )}
                          </p>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: `${vColor}18`, color: vColor, border: `1px solid ${vColor}40` }}>{vLabel}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--bx-text)' }}>{fmt(price)}</p>
                          {r.variation !== 0 && (
                            <p style={{ fontSize: 10, color: r.variation >= 0 ? 'var(--bx-green)' : 'var(--bx-red)' }}>
                              {r.variation >= 0 ? '+' : ''}{r.variation.toFixed(1)}%
                            </p>
                          )}
                        </div>
                        {r.userCardId && <IconArrowRight size={14} color="var(--bx-text-faint)" />}
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Oportunidades */}
            <div style={{ ...SURFACE, padding: 24 }} className="dash-surface">
              <SectionTitle>
                <IconFire size={14} color="var(--bx-text-3)" />Oportunidades de compra
                <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, color: 'var(--bx-text-faint)', textTransform: 'none', letterSpacing: 0, background: 'var(--bx-surface-2)', padding: '2px 8px', borderRadius: 100 }}>30 dias</span>
              </SectionTitle>
              {rankingWithVariation.filter(r => r.variation > 10).length === 0 ? (
                <>
                  <EmptyRow label="Carta valorizando +10% em 30 dias" />
                  <EmptyRow label="Carta abaixo do preço médio" />
                </>
              ) : (
                rankingWithVariation.filter(r => r.variation > 10).slice(0, 3).map((r, i) => (
                  <div key={i} className="dash-oport-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--bx-border)' }}>
                    <p style={{ fontSize: 13, color: 'var(--bx-text)' }}>{r.card_name}</p>
                    <span className="dash-oport-val" style={{ fontSize: 11, color: 'var(--bx-green)', fontWeight: 700 }}>+{r.variation.toFixed(0)}%</span>
                  </div>
                ))
              )}
            </div>

            {/* Alertas */}
            <div style={{ ...SURFACE, padding: 24 }} className="dash-surface">
              <SectionTitle>
                <IconWarning size={14} color="var(--bx-text-3)" />Alertas de mercado
                <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, color: 'var(--bx-text-faint)', textTransform: 'none', letterSpacing: 0, background: 'var(--bx-surface-2)', padding: '2px 8px', borderRadius: 100 }}>30 dias</span>
              </SectionTitle>
              {rankingWithVariation.filter(r => r.variation < -10).length === 0 ? (
                <>
                  <EmptyRow label="Carta em queda -10% em 30 dias" />
                  <EmptyRow label="Carta acima do preço médio" />
                </>
              ) : (
                rankingWithVariation.filter(r => r.variation < -10).slice(0, 3).map((r, i) => (
                  <div key={i} className="dash-oport-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--bx-border)' }}>
                    <p style={{ fontSize: 13, color: 'var(--bx-text)' }}>{r.card_name}</p>
                    <span className="dash-oport-val" style={{ fontSize: 11, color: 'var(--bx-red)', fontWeight: 700 }}>{r.variation.toFixed(0)}%</span>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>

      </div>

      {openAddModal && (
        <AddCardModal userId={userId} onClose={() => setOpenAddModal(false)} onAdded={() => window.location.reload()} />
      )}
      {showOnboarding && (
        <OnboardingModal
          userId={userId || ''}
          onClose={() => setShowOnboarding(false)}
          onAllDone={() => setShowOnboarding(false)}
        />
      )}
    </AppLayout>
  )
}
