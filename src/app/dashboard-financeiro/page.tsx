'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getUserPlan } from '@/lib/isPro'
import { checkCardLimit, LIMITE_FREE } from '@/lib/checkCardLimit'
import { authFetch } from '@/lib/authFetch'
import PriceChart from '@/components/PriceChart'
import AppLayout from '@/components/ui/AppLayout'
import OnboardingModal from '@/components/ui/OnboardingModal'
import AddCardModal from '@/components/dashboard/AddCardModal'
import { IconSearch, IconDownload, IconTrendingUp, IconTrendingDown, IconScan, IconHistory, IconCollection, IconFire, IconWarning, IconWallet, IconMarketplace, IconLink, IconChart } from '@/components/ui/Icons'
import { useAppModal } from '@/components/ui/useAppModal'

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

const getCardVariation = async (cardName: string) => {
  try {
    const res = await authFetch(`/api/historico?name=${encodeURIComponent(cardName)}`)
    const data = await res.json()
    if (!data.history || data.history.length < 2) return 0
    const first = Number(data.history[0].preco_medio || data.history[0].normal || 0)
    const last = Number(data.history[data.history.length - 1].preco_medio || data.history[data.history.length - 1].normal || 0)
    if (!first) return 0
    return ((last - first) / first) * 100
  } catch { return 0 }
}

async function matchPokemonApiId(cardName: string, cardNumber?: string) {
  try {
    const cleanName = cardName.split('(')[0].trim().toLowerCase()
    const number = cardNumber || ''
    const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${cleanName}"${number ? ` number:${number}` : ''}`)
    const data = await res.json()
    if (data?.data?.length > 0) return { id: data.data[0].id, score: 1 }
    return { id: null, score: 0 }
  } catch { return { id: null, score: 0 } }
}

// ─── Design tokens ──────────────────────────────────────────────────────────

const SURFACE = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }
const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ ...SURFACE, padding: '16px 20px', textAlign: 'center' }}>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: color || '#f0f0f0' }}>{value}</p>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>{children}</p>
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div style={{ ...SURFACE, padding: '12px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.4 }}>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>{label}</p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>—</p>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DashboardFinanceiro() {
  const { showAlert, showPrompt } = useAppModal()
  const [stats, setStats] = useState({ totalCompras: 0, totalVendas: 0, quantidade: 0, valorColecao: 0 })
  const [transactions, setTransactions] = useState<any[]>([])
  const [rankingWithVariation, setRankingWithVariation] = useState<any[]>([])
  const [priceHistory, setPriceHistory] = useState<any[]>([])
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [selectedCardPrice, setSelectedCardPrice] = useState<any>(null)
  const [cardImage, setCardImage] = useState<string | null>(null)
  const [userCards, setUserCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isPro, setIsPro] = useState(false)
  const [isTrial, setIsTrial] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [openAddModal, setOpenAddModal] = useState(false)
  const [updatingPrice, setUpdatingPrice] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importingMsg, setImportingMsg] = useState('')
  const [cardSortOrder, setCardSortOrder] = useState<'alpha' | 'recent'>('alpha')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importLinks, setImportLinks] = useState('')
  const MAX_LINKS = 20
  const SECS_PER_CARD = 6
  const [importingTotal, setImportingTotal] = useState(0)

  const LOADING_MSGS = [
    'Procurando a carta...',
    'Buscando preços de mercado...',
    'Varrendo o mercado TCG...',
    'Consultando preços das cartas...',
    'Calculando o valor do patrimônio...',
    'Analisando variações de mercado...',
    'Consultando fontes de preços...',
    'Analisando Normal, Foil e Promo...',
  ]

  // ── Importar por link ───────────────────────────────────────────────────

  function handleAddByLink() {
    setImportLinks('')
    setShowImportModal(true)
  }

  async function handleImportSubmit() {
    const links = importLinks.split('\n').map((l: string) => l.trim()).filter(Boolean)
    if (!links.length) return
    if (links.length > MAX_LINKS) {
      showAlert(`Máximo de ${MAX_LINKS} cartas por lote.`, 'warning')
      return
    }
    setShowImportModal(false)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { showAlert('Você precisa estar logado.', 'error'); return }
    let success = 0, fail = 0
    setImportingTotal(links.length)
    setImporting(true)
    setImportingMsg(LOADING_MSGS[Math.floor(Math.random() * LOADING_MSGS.length)])
    const msgInterval = setInterval(() => {
      setImportingMsg(LOADING_MSGS[Math.floor(Math.random() * LOADING_MSGS.length)])
    }, 3000)
    for (const url of links) {
      try {
        const res = await authFetch(`/api/preco-puppeteer?url=${encodeURIComponent(url)}`)
        const data = await res.json()
        if (!data?.card_name) { fail++; continue }
        const match = await matchPokemonApiId(data.card_name, data.card_number)
        if (!isPro) {
          const { bloqueado } = await checkCardLimit(userData.user.id)
          if (bloqueado) {
            clearInterval(msgInterval)
            setImporting(false)
            showAlert(`Você atingiu o limite de ${LIMITE_FREE} cartas do plano gratuito. Acesse Minha Conta para fazer upgrade.`, 'warning')
            if (success > 0) window.location.reload()
            return
          }
        }

        const { error: insertError } = await supabase.from('user_cards').insert({
          user_id: userData.user.id, pokemon_api_id: match.id,
          card_name: data.card_name, card_id: data.card_number,
          card_image: data.card_image, card_link: data.link,
          rarity: data.rarity || null, matched_score: match.score,
        })
        if (insertError) { fail++; continue }
        const v = data.variantes || {}
        await supabase.from('card_prices').upsert({
          card_name: data.card_name,
          preco_min: data.preco_min || 0, preco_medio: data.preco_medio || 0,
          preco_max: data.preco_max || 0, preco_normal: data.preco_normal || 0,
          preco_foil: data.preco_foil || 0,
          preco_foil_min: v.foil?.min || null, preco_foil_medio: v.foil?.medio || null, preco_foil_max: v.foil?.max || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'card_name' })
        success++
      } catch { fail++ }
    }
    clearInterval(msgInterval)
    setImporting(false)
    showAlert(`Importação concluída! ✓ ${success} carta(s)${fail > 0 ? ` · ${fail} falha(s)` : ''}`, success > 0 ? 'success' : 'error')
    window.location.reload()
  }

  // ── Atualizar preço da carta ────────────────────────────────────────────

  async function handleUpdatePrice() {
    if (!selectedCard) return
    setUpdatingPrice(true)
    try {
      const found = userCards.find(c => c.card_name === selectedCard)

      // Se não tem link, pede pro usuário colar
      let link = found?.card_link
      if (!link) {
        setUpdatingPrice(false)
        const input = await showPrompt({
          message: `Cole o link da LigaPokemon para "${selectedCard}":`,
          placeholder: 'https://www.ligapokemon.com.br/... ou https://lig.ae/...',
        })
        if (!input) return
        link = input
        setUpdatingPrice(true)
      }

      const res = await authFetch(`/api/preco-puppeteer?url=${encodeURIComponent(link)}`)
      const apiData = await res.json()

      if (apiData?.card_name) {
        const v = apiData.variantes || {}
        const n = v.normal || {}
        const f = v.foil || {}
        const p = v.promo || {}
        const r = v.reverse || {}
        const pb = v.pokeball || {}

        // Atualiza preço exibido
        setSelectedCardPrice({
          preco_min: n.min || 0,
          preco_medio: n.medio || 0,
          preco_max: n.max || 0
        })

        // Salva todas as variantes no banco
        await supabase.from('card_prices').upsert({
          card_name: selectedCard,
          preco_min: n.min || 0, preco_medio: n.medio || 0, preco_max: n.max || 0,
          preco_normal: n.medio || 0, preco_foil: f.medio || 0,
          preco_foil_min: f.min || null, preco_foil_medio: f.medio || null, preco_foil_max: f.max || null,
          preco_promo_min: p.min || null, preco_promo_medio: p.medio || null, preco_promo_max: p.max || null,
          preco_reverse_min: r.min || null, preco_reverse_medio: r.medio || null, preco_reverse_max: r.max || null,
          preco_pokeball_min: pb.min || null, preco_pokeball_medio: pb.medio || null, preco_pokeball_max: pb.max || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'card_name' })

        // Salva histórico
        await supabase.from('card_price_history').insert({
          card_name: selectedCard,
          preco_min: n.min || null, preco_medio: n.medio || null, preco_max: n.max || null,
          preco_normal: n.medio || null, preco_foil: f.medio || null,
          recorded_at: new Date().toISOString(),
        })

        // Atualiza link se foi digitado agora
        if (!found?.card_link && link) {
          await supabase.from('user_cards').update({ card_link: link }).eq('card_name', selectedCard)
        }

        showAlert('Preço atualizado com sucesso!', 'success')
      } else {
        showAlert(apiData?.error || 'Erro ao atualizar preço.', 'error')
      }
    } catch { showAlert('Erro ao atualizar preço.', 'error') }
    setUpdatingPrice(false)
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

        const { isPro: pro, isTrial: trial } = await getUserPlan(uid)
        setIsPro(pro || trial)
        setIsTrial(trial)  // trial já indica trial, independente de isPro
        const { data: txns } = await supabase
          .from('transactions')
          .select('*')
          .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
          .order('created_at', { ascending: false })
          .limit(10)
        // Enrich com nomes dos usuários
        const userIds = [...new Set([
          ...(txns || []).map(t => t.buyer_id),
          ...(txns || []).map(t => t.seller_id),
        ].filter(Boolean))]
        let usersMap: Record<string, any> = {}
        if (userIds.length > 0) {
          const { data: usersData } = await supabase.from('users').select('id, name, city').in('id', userIds)
          usersMap = (usersData || []).reduce((acc: any, u: any) => { acc[u.id] = u; return acc }, {})
        }
        const txnsEnriched = (txns || []).map(t => ({
          ...t,
          buyer_name: usersMap[t.buyer_id]?.name || 'Comprador',
          seller_name: usersMap[t.seller_id]?.name || 'Vendedor',
          buyer_city: usersMap[t.buyer_id]?.city || '',
          seller_city: usersMap[t.seller_id]?.city || '',
        }))
        setTransactions(txnsEnriched)
        const compras = (txns || []).filter(t => t.buyer_id === uid).reduce((a, t) => a + Number(t.price), 0)
        const vendas = (txns || []).filter(t => t.seller_id === uid).reduce((a, t) => a + Number(t.price), 0)
        const { data: cards } = await supabase.from('user_cards').select('*').eq('user_id', uid)
        setUserCards(cards || [])
        let valorTotal = 0
        const cardNames = (cards || []).map(c => c.card_name?.trim()).filter(Boolean)
        if (cardNames.length > 0) {
          const { data: prices } = await supabase
            .from('card_prices').select('*').in('card_name', cardNames)
          const priceMap: any = {}
          ;(prices || []).forEach(p => { priceMap[p.card_name?.trim()] = p })
          if (prices && prices.length > 0) {
            const enriched = await Promise.all(prices.map(async p => {
              // Pega a variante salva do user_cards para esta carta
              const card = (cards || []).find(c => c.card_name?.trim() === p.card_name?.trim())
              const variante = card?.variante || 'normal'
              // Calcula o preço correto para a variante
              const precoVariante =
                variante === 'foil'     ? (p.preco_foil_medio || p.preco_medio || 0)
                : variante === 'promo'   ? (p.preco_promo_medio || p.preco_medio || 0)
                : variante === 'reverse' ? (p.preco_reverse_medio || p.preco_medio || 0)
                : variante === 'pokeball' ? (p.preco_pokeball_medio || p.preco_medio || 0)
                : (p.preco_medio || 0)
              return {
                ...p,
                variante,
                precoVariante: Number(precoVariante),
                variation: await getCardVariation(p.card_name)
              }
            }))
            // Ordena pelo preço da variante correta
            enriched.sort((a, b) => b.precoVariante - a.precoVariante)
            setRankingWithVariation(enriched)
          }
          const CAMPOS: Record<string, string> = {
            normal: 'preco_medio', foil: 'preco_foil_medio', promo: 'preco_promo_medio',
            reverse: 'preco_reverse_medio', pokeball: 'preco_pokeball_medio',
          }
          for (const card of cards || []) {
            const p = priceMap[card.card_name?.trim()]
            if (!p) continue
            const qty = card.quantity || 1
            let v = card.variante || 'normal'
            if (!Number(p[CAMPOS[v]] || 0)) {
              v = Object.keys(CAMPOS).find(k => Number(p[CAMPOS[k]] || 0) > 0) || 'normal'
            }
            valorTotal += Number(p[CAMPOS[v]] || 0) * qty
          }
        }
        setStats({ totalCompras: compras, totalVendas: vendas, quantidade: cards?.length || 0, valorColecao: valorTotal })

        // Onboarding — aparece sempre que entrar, até completar todos os passos
        const completo = localStorage.getItem(`ob-complete-${uid}`)
        if (!completo) {
          setShowOnboarding(true)
        }

        // Busca nome do usuário
        const { data: profile } = await supabase.from('users').select('name').eq('id', uid).single()
        if (profile?.name) setUserName(profile.name)
        if (cards && cards.length > 0) {
          setSelectedCard(cards[0].card_name)
        }
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    loadData()
  }, [])

  useEffect(() => {
    if (!selectedCard) return
    async function loadHistory() {
      const res = await authFetch(`/api/historico?name=${encodeURIComponent(selectedCard!)}`)
      const data = await res.json()
      setPriceHistory(data.history || [])
      try {
        const { data: priceData } = await supabase.from('card_prices').select('*').eq('card_name', selectedCard).single()
        setSelectedCardPrice(priceData)
      } catch { setSelectedCardPrice(null) }
    }
    loadHistory()
  }, [selectedCard])

  useEffect(() => {
    if (!selectedCard) return
    async function fetchImage() {
      const { data: dbCard } = await supabase.from('card_prices').select('image_url, card_image').eq('card_name', selectedCard).single()
      if (dbCard?.image_url) { setCardImage(dbCard.image_url); return }
      const found = userCards.find(c => c.card_name === selectedCard)
      if (found?.card_image) { setCardImage(found.card_image); return }
      setCardImage(null)
    }
    fetchImage()
  }, [selectedCard, userCards])

  const saldo = stats.totalVendas - stats.totalCompras
  const variation = getVariation(priceHistory)

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'rgba(255,255,255,0.3)', flexDirection: 'column', gap: 12 }}>
        <IconChart size={32} color="rgba(255,255,255,0.2)" />
        <p style={{ fontSize: 14 }}>Carregando dashboard...</p>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      {/* Loading overlay para importação */}
      {importing && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
        }}>
          {/* Pokébola animada */}
          <div style={{ animation: 'spin 1.2s linear infinite', width: 72, height: 72 }}>
            <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
              <circle cx="36" cy="36" r="34" fill="#fff" stroke="#222" strokeWidth="3"/>
              <path d="M2 36 Q2 2 36 2 Q70 2 70 36Z" fill="#e53e3e"/>
              <rect x="2" y="33" width="68" height="6" fill="#222"/>
              <circle cx="36" cy="36" r="10" fill="#fff" stroke="#222" strokeWidth="3"/>
              <circle cx="36" cy="36" r="5" fill="#f0f0f0" stroke="#888" strokeWidth="1.5"/>
            </svg>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 20, padding: '28px 40px', maxWidth: 420, textAlign: 'center',
          }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b', marginBottom: 12 }}>
              Importando carta(s)...
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
              {importingMsg}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 16 }}>
              {(() => {
                const secs = importingTotal * SECS_PER_CARD
                const timeStr = secs >= 60
                  ? `~${Math.floor(secs / 60)}min${secs % 60 > 0 ? ` ${secs % 60}s` : ''}`
                  : secs > 0 ? `~${secs}s` : ''
                return `Aguarde${timeStr ? `, estimado ${timeStr}` : ''}`
              })()}
            </p>
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Modal de importação por link */}
      {showImportModal && (() => {
        const lines = importLinks.split('\n').map((l: string) => l.trim()).filter(Boolean)
        const count = lines.length
        const overLimit = count > MAX_LINKS
        const secs = count * SECS_PER_CARD
        const timeStr = secs >= 60
          ? `~${Math.floor(secs / 60)}min${secs % 60 > 0 ? ` ${secs % 60}s` : ''}`
          : `~${secs}s`
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9997,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
            <div style={{
              background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 20, padding: 28, width: '100%', maxWidth: 520,
              display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IconLink size={22} color="rgba(245,158,11,0.8)" />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' }}>
                  Importar cartas por link
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                Cole os links da LigaPokemon, um por linha. Aceita links completos ou curtos (lig.ae).
              </p>
              <textarea
                autoFocus
                value={importLinks}
                onChange={e => setImportLinks(e.target.value)}
                rows={6}
                placeholder={'https://www.ligapokemon.com.br/...\nhttps://lig.ae/c2/...\nhttps://lig.ae/c2/...'}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${overLimit ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: 10, padding: '12px 14px',
                  color: '#fff', fontSize: 13, lineHeight: 1.6,
                  resize: 'vertical', outline: 'none', fontFamily: 'monospace',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: overLimit ? '#ef4444' : count > 0 ? '#f59e0b' : 'rgba(255,255,255,0.35)',
                }}>
                  {count === 0 ? 'Nenhum link colado ainda'
                    : overLimit ? `⚠ ${count}/${MAX_LINKS} links — limite excedido!`
                    : `${count}/${MAX_LINKS} carta${count > 1 ? 's' : ''}`}
                </span>
                {count > 0 && !overLimit && (
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                    ⏱ Tempo estimado: <strong style={{ color: '#fff' }}>{timeStr}</strong>
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowImportModal(false)} style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10, padding: '10px 20px', color: '#fff',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>Cancelar</button>
                <button onClick={handleImportSubmit} disabled={count === 0 || overLimit} style={{
                  background: count === 0 || overLimit ? '#555' : 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  border: 'none', borderRadius: 10, padding: '10px 24px',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: count === 0 || overLimit ? 'not-allowed' : 'pointer',
                  opacity: count === 0 || overLimit ? 0.6 : 1,
                }}>
                  Importar {count > 0 && !overLimit ? `${count} carta${count > 1 ? 's' : ''} →` : '→'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      <style>{`
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
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Patrimônio total da coleção
              </p>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 100, letterSpacing: '0.08em',
                background: isTrial ? 'rgba(96,165,250,0.12)' : isPro ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${isTrial ? 'rgba(96,165,250,0.35)' : isPro ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.12)'}`,
                color: isTrial ? '#60a5fa' : isPro ? '#f59e0b' : 'rgba(255,255,255,0.5)',
              }}>
                {isPro && !isTrial ? 'PRO ✦' : isTrial ? 'TRIAL ✦' : 'FREE'}
              </span>
            </div>
            <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.04em', background: BRAND, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 16 }}>
              {fmt(stats.valorColecao)}
            </h1>
            <div style={{ display: 'flex', gap: 28 }}>
              <div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>Saldo</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: saldo >= 0 ? '#22c55e' : '#ef4444' }}>{saldo >= 0 ? '+' : ''}{fmt(saldo)}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>Performance</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: variation >= 0 ? '#22c55e' : '#ef4444' }}>{pct(variation)}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>Cartas</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0' }}>{stats.quantidade}</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200 }} className="dash-hero-btns">
            <button onClick={handleAddByLink} style={{ background: BRAND, border: 'none', color: '#000', padding: '13px 20px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 0 24px rgba(245,158,11,0.25)' }}>
              + Importar por link
            </button>
            {userId && (
              <button onClick={() => setOpenAddModal(true)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '12px 20px', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Buscar na API
              </button>
            )}
            {isPro && userId && (
              <button
                onClick={() => { window.location.href = `/api/export/csv?userId=${userId}` }}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', padding: '12px 20px', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 3v10M6 9l4 4 4-4M4 17h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Exportar CSV
              </button>
            )}
          </div>
        </div>

        {/* ── 4 CHIPS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }} className="dash-chips">
          <StatChip label="Total cartas" value={String(stats.quantidade)} />
          <StatChip label="Total compras" value={fmt(stats.totalCompras)} color="#ef4444" />
          <StatChip label="Total vendas" value={fmt(stats.totalVendas)} color="#22c55e" />
          <StatChip label="Saldo" value={fmt(saldo)} color={saldo >= 0 ? '#22c55e' : '#ef4444'} />
        </div>

        {/* ── 2 COLUNAS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 20, alignItems: 'start' }} className="dash-2col">

          {/* COLUNA ESQUERDA — Gráfico */}
          <div>

            {/* Seletor de carta + gráfico */}
            <div style={{ ...SURFACE, padding: 24, marginBottom: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <SectionTitle><IconTrendingUp size={14} color="rgba(255,255,255,0.5)" />Histórico de preço</SectionTitle>

                {/* Filtros de ordenação */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 10 }}>
                  {(['alpha', 'recent'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setCardSortOrder(opt)}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', border: 'none',
                        background: cardSortOrder === opt ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
                        color: cardSortOrder === opt ? '#f59e0b' : 'rgba(255,255,255,0.4)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {opt === 'alpha' ? '↑ Alfabética' : '↓ Mais recente'}
                    </button>
                  ))}
                </div>

                {/* Label */}
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Selecione sua carta
                </p>

                {/* Lista de cartas — uma por linha */}
                <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
                  {userCards.length === 0 && (
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Nenhuma carta na coleção</p>
                  )}
                  {[...userCards]
                    .sort((a, b) => cardSortOrder === 'alpha'
                      ? a.card_name.localeCompare(b.card_name)
                      : new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
                    )
                    .map(c => {
                      const isSelected = selectedCard === c.card_name
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
                          onClick={() => setSelectedCard(c.card_name)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                            border: isSelected ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.06)',
                            background: isSelected ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
                            transition: 'all 0.15s', textAlign: 'left',
                          }}
                        >
                          {/* Coluna esquerda: Nome + Número + Badge variante */}
                          <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                            <p style={{
                              fontSize: 13, fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? '#f0f0f0' : 'rgba(255,255,255,0.75)',
                              marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {cardBaseName}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {cardNum && (
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>#{cardNum}</span>
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
                                style={{ width: 36, height: 50, objectFit: 'cover', borderRadius: 5, display: 'block', border: isSelected ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.1)' }}
                              />
                            ) : (
                              <div style={{ width: 36, height: 50, borderRadius: 5, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🃏</div>
                            )}
                            {isSelected && (
                              <div style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', border: '2px solid #0f1117' }} />
                            )}
                          </div>
                        </button>
                      )
                  })}
                </div>
              </div>

              {/* Carta selecionada */}
              {selectedCard && (
                <div style={{ marginBottom: 16, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                  {/* Linha superior: imagem + nome + preços */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    {cardImage ? (
                      <img src={cardImage} alt={selectedCard} style={{ width: 44, height: 60, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 44, height: 60, background: 'rgba(255,255,255,0.05)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🃏</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedCard}</p>
                      {selectedCardPrice ? (() => {
                        // Usa a variante salva no user_cards para esta carta
                        const cardVariante = userCards.find(c => c.card_name === selectedCard)?.variante || 'normal'
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
                            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>
                              Variante: <strong style={{ color: '#f59e0b' }}>{variantLabel[cardVariante] || cardVariante}</strong>
                            </p>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                              <div><p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Mín</p><p style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{fmt(precos.min)}</p></div>
                              <div><p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Médio</p><p style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>{fmt(precos.medio)}</p></div>
                              <div><p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Máx</p><p style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>{fmt(precos.max)}</p></div>
                            </div>
                          </>
                        )
                      })() : (
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Sem dados — clique em Atualizar</p>
                      )}
                    </div>
                  </div>
                  {/* Botão atualizar sempre em linha cheia */}
                  <button
                    onClick={handleUpdatePrice}
                    disabled={updatingPrice}
                    style={{ width: '100%', background: BRAND, border: 'none', color: '#000', padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: updatingPrice ? 0.6 : 1 }}
                  >
                    {updatingPrice ? '⏳ Atualizando...' : '↻ Atualizar preço'}
                  </button>
                </div>
              )}

              {/* Gráfico histórico */}
              {priceHistory.length > 0 ? (
                <PriceChart data={priceHistory.map(d => ({ date: d.date || d.created_at || '', normal: d.preco_medio || d.normal || 0, foil: d.preco_foil || d.foil || null }))} />
              ) : (
                <div style={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60, opacity: 0.15 }}>
                    {[40, 55, 45, 70, 60, 80, 65, 90, 75, 85].map((h, i) => (
                      <div key={i} style={{ width: 16, height: h, background: '#f59e0b', borderRadius: '3px 3px 0 0' }} />
                    ))}
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Histórico aparece após atualizar o preço</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Clique em "Atualizar" na carta selecionada</p>
                </div>
              )}
            </div>

            {/* Últimas transações */}
            <div style={{ ...SURFACE, padding: 24 }}>
              <SectionTitle><IconHistory size={14} color="rgba(255,255,255,0.5)" />Últimas transações</SectionTitle>
              {transactions.length === 0 ? (
                <>
                  <EmptyRow label="Nenhuma transação ainda" />
                  <EmptyRow label="Venda uma carta no Marketplace" />
                  <EmptyRow label="para ver seu histórico aqui" />
                </>
              ) : (
                transactions.slice(0, 8).map(t => {
                  const isCompra = t.buyer_id === userId
                  const contato  = isCompra ? t.seller_name : t.buyer_name
                  const cidade   = isCompra ? t.seller_city : t.buyer_city
                  const data     = t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                      {/* Ícone */}
                      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                        background: isCompra ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                        border: `1px solid ${isCompra ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
                      }}>
                        {isCompra ? <IconMarketplace size={14} color="currentColor" /> : <IconWallet size={14} color="currentColor" />}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#f0f0f0', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.card_name}
                        </p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                          {isCompra ? 'Compra de' : 'Venda para'} {contato}{cidade ? ` · ${cidade}` : ''}{data ? ` · ${data}` : ''}
                        </p>
                      </div>
                      {/* Valor */}
                      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: isCompra ? '#ef4444' : '#22c55e' }}>
                          {isCompra ? '-' : '+'}{fmt(Number(t.price))}
                        </p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                          {isCompra ? 'compra' : 'venda'}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

          </div>

          {/* COLUNA DIREITA — Rankings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Cartas mais valiosas */}
            <div style={{ ...SURFACE, padding: 24 }}>
              <SectionTitle><IconCollection size={14} color="rgba(255,255,255,0.5)" />Cartas mais valiosas</SectionTitle>
              {rankingWithVariation.length === 0 ? (
                <>
                  {['Adicione cartas para ver o ranking', 'Importe pelo link da LigaPokemon', 'Atualize os preços para calcular'].map(l => (
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
                  return (
                    <div key={r.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? '#f59e0b' : 'rgba(255,255,255,0.2)', minWidth: 20, flexShrink: 0 }}>#{i + 1}</span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, color: '#f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.card_name}</p>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: `${vColor}18`, color: vColor, border: `1px solid ${vColor}40` }}>{vLabel}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0' }}>{fmt(price)}</p>
                        {r.variation !== 0 && (
                          <p style={{ fontSize: 10, color: r.variation >= 0 ? '#22c55e' : '#ef4444' }}>
                            {r.variation >= 0 ? '+' : ''}{r.variation.toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Oportunidades */}
            <div style={{ ...SURFACE, padding: 24 }}>
              <SectionTitle><IconFire size={14} color="rgba(255,255,255,0.5)" />Oportunidades de compra</SectionTitle>
              {rankingWithVariation.filter(r => r.variation > 10).length === 0 ? (
                <>
                  <EmptyRow label="Carta valorizando +10% no período" />
                  <EmptyRow label="Carta abaixo do preço médio" />
                </>
              ) : (
                rankingWithVariation.filter(r => r.variation > 10).slice(0, 3).map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <p style={{ fontSize: 13, color: '#f0f0f0' }}>{r.card_name}</p>
                    <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>+{r.variation.toFixed(0)}%</span>
                  </div>
                ))
              )}
            </div>

            {/* Alertas */}
            <div style={{ ...SURFACE, padding: 24 }}>
              <SectionTitle><IconWarning size={14} color="rgba(255,255,255,0.5)" />Alertas de mercado</SectionTitle>
              {rankingWithVariation.filter(r => r.variation < -10).length === 0 ? (
                <>
                  <EmptyRow label="Carta em queda -10% no período" />
                  <EmptyRow label="Carta acima do preço médio" />
                </>
              ) : (
                rankingWithVariation.filter(r => r.variation < -10).slice(0, 3).map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <p style={{ fontSize: 13, color: '#f0f0f0' }}>{r.card_name}</p>
                    <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>{r.variation.toFixed(0)}%</span>
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