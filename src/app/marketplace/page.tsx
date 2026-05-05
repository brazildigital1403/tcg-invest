'use client'

import { useEffect, useState } from 'react'
import { IconMarketplace, IconWhatsApp, IconCheck, IconLocation, IconSearch, IconHistory, IconCollection, IconChat, IconBox, IconTag } from '@/components/ui/Icons'
import { supabase } from '@/lib/supabaseClient'
import { criarNotificacao } from '@/lib/notificacoes'
import { checkMarketplaceLimit, LIMITE_FREE_MKTPLACE } from '@/lib/checkCardLimit'
import { trackFirstCardAdded } from '@/lib/analytics'
import UpgradeBanner from '@/components/ui/UpgradeBanner'
import AppLayout from '@/components/ui/AppLayout'
import { useAppModal } from '@/components/ui/useAppModal'
import AnunciarModal from '@/components/marketplace/AnunciarModal'
import NegociacoesTab from '@/components/marketplace/NegociacoesTab'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  disponivel:     { label: 'Disponível',         color: '#22c55e', bg: 'rgba(34,197,94,0.1)'   },
  reservado:      { label: 'Reservado',           color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  em_negociacao:  { label: 'Em negociação',       color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  enviado:        { label: 'Enviado',             color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  concluido:      { label: 'Concluído',           color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
  cancelado:      { label: 'Cancelado',           color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
}

const CONDICAO_DESC: Record<string, string> = {
  NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played',
  HP: 'Heavily Played', D: 'Damaged',
}

const VARIANTES = [
  { key: 'normal', label: 'Normal' },
  { key: 'foil',   label: 'Foil'   },
  { key: 'promo',  label: 'Promo'  },
  { key: 'reverse',label: 'Reverse Foil' },
]

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const SURFACE = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }

// ─── Componente de card de anúncio ────────────────────────────────────────────

function AnuncioCard({ card, userId, userWhatsapp, onAction }: {
  card: any; userId: string | null; userWhatsapp: string | null; onAction: () => void
}) {
  const { showAlert, showConfirm } = useAppModal()
  const isMeu    = card.user_id === userId
  const isBuyer  = card.buyer_id === userId
  const st       = STATUS_CFG[card.status || 'disponivel'] || STATUS_CFG.disponivel
  const variante = VARIANTES.find(v => v.key === card.variante)?.label || 'Normal'

  async function handleInteresse() {
    if (!userId) { showAlert('Você precisa estar logado.', 'error'); return }
    if (isMeu)   { showAlert('Você não pode comprar sua própria carta.', 'warning'); return }

    // Verifica limite de negociações do comprador


    const ok = await showConfirm({
      message: `Deseja manifestar interesse em "${card.card_name}" por ${fmt(card.price)}?`,
      confirmLabel: 'Sim, tenho interesse',
      description: 'O WhatsApp do vendedor será exibido para você entrar em contato.',
    })
    if (!ok) return

    await supabase.from('marketplace')
      .update({ status: 'reservado', buyer_id: userId })
      .eq('id', card.id)

    // Notifica o vendedor
    const { data: buyerProfile } = await supabase.from('users').select('name').eq('id', userId).single()
    await criarNotificacao(
      card.user_id,
      'interesse',
      'Novo interesse na sua carta!',
      `${buyerProfile?.name || 'Um usuário'} demonstrou interesse em "${card.card_name}" por ${fmt(card.price)}.`,
      { marketplace_id: card.id, card_name: card.card_name }
    )

    // Mostra contato do vendedor
    const tel = card.seller_whatsapp?.replace(/\D/g, '')
    if (tel) {
      const msg = encodeURIComponent(`Olá! Vi seu anúncio no Bynx e tenho interesse na carta *${card.card_name}* por ${fmt(card.price)}. Podemos negociar?`)
      window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')
    } else {
      showAlert('Interesse registrado! O vendedor será notificado.', 'success')
    }
    onAction()
  }

  async function handleCancelar() {
    const ok = await showConfirm({ message: 'Cancelar este anúncio?', danger: true, confirmLabel: 'Cancelar anúncio' })
    if (!ok) return
    await supabase.from('marketplace').update({ status: 'cancelado', buyer_id: null }).eq('id', card.id)
    onAction()
  }

  async function handleConfirmarEnvio() {
    const ok = await showConfirm({ message: `Confirma que enviou a carta "${card.card_name}" para o comprador?`, confirmLabel: 'Sim, confirmei o envio' })
    if (!ok) return
    await supabase.from('marketplace').update({ status: 'enviado' }).eq('id', card.id)
    showAlert('Envio confirmado! Aguardando o comprador confirmar o recebimento.', 'success')
    onAction()
  }

  async function handleConfirmarRecebimento() {
    const ok = await showConfirm({ message: `Confirma que recebeu a carta "${card.card_name}"?`, confirmLabel: 'Sim, recebi a carta' })
    if (!ok) return

    // Transfere carta para coleção do comprador
    await supabase.from('user_cards').insert({
      user_id: userId,
      card_name: card.card_name,
      card_image: card.card_image,
      card_link: card.card_link || null,
      variante: card.variante || 'normal',
    })
    trackFirstCardAdded(userId)

    // Remove da coleção do vendedor
    await supabase.from('user_cards').delete()
      .eq('user_id', card.user_id)
      .eq('card_name', card.card_name)
      .limit(1)

    // Registra transação
    await supabase.from('transactions').insert({
      buyer_id: userId,
      seller_id: card.user_id,
      card_name: card.card_name,
      price: card.price,
    })

    // Conclui anúncio
    await supabase.from('marketplace').update({ status: 'concluido' }).eq('id', card.id)

    showAlert('Compra concluída! A carta foi adicionada à sua coleção.', 'success')
    onAction()
  }

  return (
    <div style={{
      ...SURFACE,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      opacity: card.status === 'cancelado' || card.status === 'concluido' ? 0.5 : 1,
    }}>
      {/* Imagem */}
      <div style={{ position: 'relative' }}>
        {card.card_image ? (
          <img src={card.card_image} alt={card.card_name} style={{ width: '100%', display: 'block' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('hidden') }}
          />
        ) : null}
        <div hidden={!!card.card_image} style={{ width: '100%', paddingBottom: '140%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: card.card_image ? 'absolute' : 'relative', inset: 0 }}>
          <span style={{ fontSize: 40 }}>🃏</span>
        </div>

        {/* Status badge */}
        <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: st.bg, color: st.color, backdropFilter: 'blur(4px)' }}>
          {st.label}
        </span>

        {/* Variante badge */}
        <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: 'rgba(0,0,0,0.6)', color: '#f0f0f0' }}>
          {variante}
        </span>

        {/* S29 UX v2: badges contextuais sobrepostos. Mostrados apenas em
            anúncios disponíveis (não distrai em status finais).
            - 💎 Bom preço: > 10% abaixo do preço médio de mercado
            - 🔥 Imperdível: > 25% abaixo do mercado
            - ⚡ Novo: criado nas últimas 24h
            Combina com `preco_mercado` enriched do canonical. */}
        {(card.status || 'disponivel') === 'disponivel' && (() => {
          const badges: Array<{ label: string; bg: string; color: string }> = []
          const isNovo = card.created_at && (Date.now() - new Date(card.created_at).getTime()) < 24 * 60 * 60 * 1000
          if (isNovo) badges.push({ label: '⚡ Novo', bg: 'rgba(96,165,250,0.85)', color: '#0a0e16' })

          if (card.preco_mercado > 0 && card.price > 0) {
            const desconto = (card.preco_mercado - card.price) / card.preco_mercado
            if (desconto >= 0.25) badges.push({ label: '🔥 Imperdível', bg: 'rgba(239,68,68,0.85)', color: '#fff' })
            else if (desconto >= 0.10) badges.push({ label: '💎 Bom preço', bg: 'rgba(34,197,94,0.85)', color: '#0a0e16' })
          }

          if (badges.length === 0) return null
          return (
            <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
              {badges.map((b, i) => (
                <span key={i} style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 6,
                  background: b.bg, color: b.color, backdropFilter: 'blur(4px)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                }}>{b.label}</span>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', marginBottom: 2 }}>{card.card_name}</p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              {CONDICAO_DESC[card.condicao] || card.condicao || 'NM'}
            </span>
            {card.seller_city && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>· {card.seller_city}</span>
            )}
          </div>
          {card.descricao && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4, lineHeight: 1.4 }}>{card.descricao}</p>
          )}
        </div>

        {/* Preço */}
        <div>
          <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: '#f59e0b' }}>
            {fmt(card.price)}
          </p>
          {/* S29 UX v2: comparação vs mercado se preço canonical disponível */}
          {card.preco_mercado > 0 && card.price > 0 && (() => {
            const diff = ((card.price - card.preco_mercado) / card.preco_mercado) * 100
            const cor = diff <= -10 ? '#22c55e' : diff >= 10 ? '#ef4444' : 'rgba(255,255,255,0.4)'
            const label = Math.abs(diff) < 1
              ? `≈ no preço de mercado`
              : diff < 0
                ? `${Math.abs(diff).toFixed(0)}% abaixo do mercado`
                : `${diff.toFixed(0)}% acima do mercado`
            return (
              <p style={{ fontSize: 10, color: cor, marginTop: 2, fontWeight: 600 }}>
                {label}
              </p>
            )
          })()}
        </div>

        {/* Ações por papel e status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>

          {/* Visitante: botão comprar */}
          {!isMeu && !isBuyer && card.status === 'disponivel' && (
            <button onClick={handleInteresse} style={{ background: BRAND, border: 'none', color: '#000', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Tenho interesse
            </button>
          )}

          {/* WhatsApp do vendedor — aparece após demonstrar interesse */}
          {isBuyer && card.seller_whatsapp && (card.status === 'reservado' || card.status === 'em_negociacao') && (
            <a
              href={`https://wa.me/55${card.seller_whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá! Tenho interesse na carta ${card.card_name} anunciada no Bynx por ${fmt(card.price)}.`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
            >
              WhatsApp
            </a>
          )}

          {/* Comprador: aguardando */}
          {isBuyer && card.status === 'reservado' && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>⏳ Aguardando vendedor</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Entre em contato pelo WhatsApp</p>
            </div>
          )}

          {/* Comprador: confirmar recebimento */}
          {isBuyer && card.status === 'enviado' && (
            <button onClick={handleConfirmarRecebimento} style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Confirmar recebimento
            </button>
          )}

          {/* Vendedor: confirmar envio */}
          {isMeu && (card.status === 'reservado' || card.status === 'em_negociacao') && (
            <button onClick={handleConfirmarEnvio} style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Confirmar envio
            </button>
          )}

          {/* Vendedor: cancelar */}
          {isMeu && !['concluido', 'cancelado', 'enviado'].includes(card.status) && (
            <button onClick={handleCancelar} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '8px', borderRadius: 10, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              Cancelar anúncio
            </button>
          )}

          {/* Tag "Seu anúncio" */}
          {isMeu && card.status === 'disponivel' && (
            <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Seu anúncio</p>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Marketplace() {
  const { showAlert, showConfirm, showPrompt } = useAppModal()
  const [tab, setTab] = useState<'vitrine' | 'meus' | 'negociacoes'>('vitrine')
  const [totalAnuncios, setTotalAnuncios] = useState(0)
  const [listings, setListings] = useState<any[]>([])
  const [userId, setUserId]     = useState<string | null>(null)
  const [userWhatsapp, setUserWhatsapp] = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [showAnunciarModal, setShowAnunciarModal] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroVariante, setFiltroVariante] = useState('')
  const [filtroCondicao, setFiltroCondicao] = useState('')
  const [showFiltrosAvancados, setShowFiltrosAvancados] = useState(false)
  const [busca, setBusca]       = useState('')
  const [ordenacao, setOrdenacao] = useState<'recente' | 'menor' | 'maior' | 'desconto'>('recente')

  async function loadData() {
    setLoading(true)
    const { data: authData } = await supabase.auth.getUser()
    const uid = authData.user?.id || null
    setUserId(uid)

    if (uid) {
      // S29: lê próprio whatsapp/city de users (RLS auth.uid()=id permite)
      const { data: profile } = await supabase.from('users').select('whatsapp, city').eq('id', uid).single()
      setUserWhatsapp(profile?.whatsapp || null)
    }

    // Busca anúncios — exclui anúncios moderados (removidos pelo admin)
    // RLS-safe: filtro client-side garante que mesmo se RLS falhar,
    // anúncios moderados não aparecem na vitrine pública.
    const { data } = await supabase
      .from('marketplace')
      .select('*')
      .is('removido_em', null)
      .order('created_at', { ascending: false })

    const listings = data || []

    // Busca dados dos vendedores separadamente
    // S29: lê de public_users (sellers são outros users — RLS bloqueia leitura
    // direta de users.* pra terceiros).
    const sellerIds = [...new Set(listings.map((c: any) => c.user_id).filter(Boolean))]
    let sellerMap: Record<string, any> = {}

    if (sellerIds.length > 0) {
      const { data: sellers } = await supabase
        .from('public_users')
        .select('id, name, whatsapp, city')
        .in('id', sellerIds)

      sellerMap = (sellers || []).reduce((acc: any, s: any) => {
        acc[s.id] = s
        return acc
      }, {})
    }

    // Enrich com dados de vendedor E comprador
    // S29: idem — buyers são outros users.
    const buyerIds = [...new Set(listings.map((c: any) => c.buyer_id).filter(Boolean))]
    let buyerMap: Record<string, any> = {}

    if (buyerIds.length > 0) {
      const { data: buyers } = await supabase
        .from('public_users')
        .select('id, name, whatsapp, city')
        .in('id', buyerIds)

      buyerMap = (buyers || []).reduce((acc: any, s: any) => {
        acc[s.id] = s
        return acc
      }, {})
    }

    // S29 UX v2: enrich com preço de mercado canonical pra calcular badges.
    // Faz match por card_name (legacy) — quando todas cartas tiverem
    // pokemon_api_id no marketplace, dá pra otimizar com .in('id', ids).
    const cardNames = [...new Set(listings.map((c: any) => c.card_name).filter(Boolean))]
    let priceMap: Record<string, number> = {}
    if (cardNames.length > 0) {
      const { data: pokemons } = await supabase
        .from('pokemon_cards')
        .select('name, preco_medio')
        .in('name', cardNames)
      priceMap = (pokemons || []).reduce((acc: any, p: any) => {
        // Mantém maior preco_medio se houver duplicatas (variantes)
        if (!acc[p.name] || (p.preco_medio || 0) > acc[p.name]) {
          acc[p.name] = p.preco_medio || 0
        }
        return acc
      }, {})
    }

    const enriched = listings.map((c: any) => ({
      ...c,
      seller_name: sellerMap[c.user_id]?.name,
      seller_whatsapp: sellerMap[c.user_id]?.whatsapp,
      seller_city: sellerMap[c.user_id]?.city,
      buyer_name: buyerMap[c.buyer_id]?.name,
      buyer_whatsapp: buyerMap[c.buyer_id]?.whatsapp,
      buyer_city: buyerMap[c.buyer_id]?.city,
      preco_mercado: priceMap[c.card_name] || 0,
    }))

    setListings(enriched)
    // Conta anúncios ativos do usuário
    if (authData.user) {
      const ativos = (data || []).filter((c: any) => c.user_id === authData.user!.id && !['cancelado','concluido'].includes(c.status || 'disponivel'))
      setTotalAnuncios(ativos.length)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function handleAnunciar() {
    if (!userId) { showAlert('Você precisa estar logado.', 'error'); return }
    const { bloqueado } = await checkMarketplaceLimit(userId)
    if (bloqueado) {
      showAlert(`Você atingiu o limite de ${LIMITE_FREE_MKTPLACE} anúncios. Acesse Minha Conta para fazer upgrade.`, 'warning')
      return
    }
    setShowAnunciarModal(true)
  }

  // ── Filtros ─────────────────────────────────────────────────────────────────

  const vitrine = listings.filter(c => {
    if (c.user_id === userId) return false // não mostra seus próprios na vitrine
    const status = c.status || 'disponivel' // trata null como disponivel
    // S29 UX v2: marketplace agora mostra TODOS os anúncios por default,
    // exceto os já concluídos/cancelados (que poluem a vitrine).
    if (['concluido', 'cancelado'].includes(status)) return false
    if (filtroStatus && status !== filtroStatus) return false
    if (filtroVariante && c.variante !== filtroVariante) return false
    if (filtroCondicao && c.condicao !== filtroCondicao) return false
    if (busca && !c.card_name.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    if (ordenacao === 'menor') return (a.price || 0) - (b.price || 0)
    if (ordenacao === 'maior') return (b.price || 0) - (a.price || 0)
    if (ordenacao === 'desconto') {
      // Maior desconto vs preço de mercado primeiro (cartas com mercado conhecido)
      const dA = a.preco_mercado > 0 ? (a.preco_mercado - (a.price || 0)) / a.preco_mercado : -1
      const dB = b.preco_mercado > 0 ? (b.preco_mercado - (b.price || 0)) / b.preco_mercado : -1
      return dB - dA
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const meusAnuncios = listings.filter(c => c.user_id === userId)

  const minhasNegociacoes = listings.filter(c =>
    c.buyer_id === userId && !['concluido', 'cancelado'].includes(c.status || 'disponivel')
  )

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }} className="mkt-header">
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Marketplace</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
              {(() => {
                // S29 UX v2: contador com breakdown legível
                const ativos = listings.filter(c =>
                  c.user_id !== userId && !['concluido', 'cancelado'].includes(c.status || 'disponivel')
                )
                const disp = ativos.filter(c => (c.status || 'disponivel') === 'disponivel').length
                const neg  = ativos.filter(c => ['reservado', 'em_negociacao', 'enviado'].includes(c.status || '')).length
                if (ativos.length === 0) return 'Nenhum anúncio ativo no momento'
                if (neg === 0) return `${disp} ${disp === 1 ? 'carta disponível' : 'cartas disponíveis'}`
                return `${disp} ${disp === 1 ? 'disponível' : 'disponíveis'} · ${neg} em negociação`
              })()}
            </p>
          </div>
          <button
            onClick={handleAnunciar}
            style={{ background: BRAND, border: 'none', color: '#000', padding: '12px 24px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 0 20px rgba(245,158,11,0.2)' }}
          >
            + Anunciar carta
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4 }}>
          {[
            { key: 'vitrine',      label: 'Vitrine',          count: vitrine.length },
            { key: 'meus',         label: 'Meus anúncios',    count: meusAnuncios.length },
            { key: 'negociacoes',  label: 'Negociações',      count: minhasNegociacoes.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
                background: tab === t.key ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: tab === t.key ? '#f0f0f0' : 'rgba(255,255,255,0.4)',
                fontWeight: tab === t.key ? 700 : 400,
                fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {t.label}
              {t.count > 0 && (
                <span style={{ background: tab === t.key ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.1)', color: tab === t.key ? '#f59e0b' : 'rgba(255,255,255,0.4)', fontSize: 11, padding: '1px 7px', borderRadius: 100, fontWeight: 700 }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── VITRINE ── */}
        {tab === 'vitrine' && (
          <>
            {/* S29 UX v2: filtros redesenhados.
                - Hero search ocupando largura total
                - Chips horizontais de status (visualmente claros)
                - Ordenação como dropdown único
                - Variante/Condição atrás de "+ Filtros" pra reduzir noise */}

            {/* Linha 1: Busca + Ordenação */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }} className="mkt-filtros-row1">
              <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                <IconSearch size={15} color="rgba(255,255,255,0.35)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  value={busca} onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar carta — ex: Charizard, Pikachu, Mewtwo..."
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 14px 11px 38px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.45)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                {busca && (
                  <button onClick={() => setBusca('')}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    aria-label="Limpar busca"
                  >×</button>
                )}
              </div>

              <select value={ordenacao} onChange={e => setOrdenacao(e.target.value as any)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 14px', color: 'rgba(255,255,255,0.85)', fontSize: 13, cursor: 'pointer', outline: 'none', fontFamily: 'inherit', minWidth: 200 }}
              >
                <option value="recente"  style={{ background: '#0d0f14' }}>Mais recentes primeiro</option>
                <option value="menor"    style={{ background: '#0d0f14' }}>Menor preço primeiro</option>
                <option value="maior"    style={{ background: '#0d0f14' }}>Maior preço primeiro</option>
                <option value="desconto" style={{ background: '#0d0f14' }}>Maior desconto vs mercado</option>
              </select>
            </div>

            {/* Linha 2: Chips de status + botão "+ Filtros" */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }} className="mkt-filtros-row2">
              {([
                ['',              'Todos'],
                ['disponivel',    'Disponíveis'],
                ['reservado',     'Em negociação'],
                ['em_negociacao', 'Em negociação avançada'],
                ['enviado',       'Em envio'],
              ] as const).filter(([key]) => {
                // Esconde chip "Em negociação avançada" se não houver itens
                if (key === 'em_negociacao') {
                  return listings.some(c => c.status === 'em_negociacao' && c.user_id !== userId)
                }
                if (key === 'enviado') {
                  return listings.some(c => c.status === 'enviado' && c.user_id !== userId)
                }
                return true
              }).map(([key, label]) => {
                const ativo = filtroStatus === key
                const count = key === ''
                  ? listings.filter(c => c.user_id !== userId && !['concluido','cancelado'].includes(c.status || 'disponivel')).length
                  : listings.filter(c => c.user_id !== userId && (c.status || 'disponivel') === key).length
                return (
                  <button key={key} onClick={() => setFiltroStatus(key)}
                    style={{
                      padding: '7px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 13, fontWeight: ativo ? 700 : 500,
                      background: ativo ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                      color: ativo ? '#f59e0b' : 'rgba(255,255,255,0.55)',
                      outline: ativo ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.07)',
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {label}
                    <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>{count}</span>
                  </button>
                )
              })}

              <button
                onClick={() => setShowFiltrosAvancados(v => !v)}
                style={{
                  marginLeft: 'auto',
                  padding: '7px 12px', borderRadius: 100, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12,
                  background: (filtroVariante || filtroCondicao) ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.04)',
                  color: (filtroVariante || filtroCondicao) ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                  outline: (filtroVariante || filtroCondicao) ? '1px solid rgba(96,165,250,0.35)' : '1px solid rgba(255,255,255,0.07)',
                  fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                {showFiltrosAvancados ? '−' : '+'} Filtros
                {(filtroVariante || filtroCondicao) && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(96,165,250,0.25)', color: '#60a5fa', padding: '1px 6px', borderRadius: 100 }}>
                    {[filtroVariante, filtroCondicao].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>

            {/* Filtros avançados — colapsáveis */}
            {showFiltrosAvancados && (
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12,
                padding: 14,
                marginBottom: 18,
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6, fontWeight: 600 }}>Variante</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[['', 'Todas'], ...VARIANTES.map(v => [v.key, v.label])].map(([key, label]) => {
                      const ativo = filtroVariante === key
                      return (
                        <button key={key} onClick={() => setFiltroVariante(key)}
                          style={{
                            padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            fontSize: 12, fontWeight: ativo ? 700 : 500,
                            background: ativo ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                            color: ativo ? '#f59e0b' : 'rgba(255,255,255,0.5)',
                            outline: ativo ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.06)',
                          }}
                        >{label}</button>
                      )
                    })}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6, fontWeight: 600 }}>Condição</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[['', 'Todas'], ...['NM','LP','MP','HP','D'].map(c => [c, c])].map(([key, label]) => {
                      const ativo = filtroCondicao === key
                      return (
                        <button key={key} onClick={() => setFiltroCondicao(key)}
                          style={{
                            padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            fontSize: 12, fontWeight: ativo ? 700 : 500,
                            background: ativo ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                            color: ativo ? '#f59e0b' : 'rgba(255,255,255,0.5)',
                            outline: ativo ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.06)',
                          }}
                        >{label}</button>
                      )
                    })}
                  </div>
                </div>
                {(filtroVariante || filtroCondicao) && (
                  <button onClick={() => { setFiltroVariante(''); setFiltroCondicao('') }}
                    style={{ alignSelf: 'flex-end', padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, background: 'rgba(239,68,68,0.08)', color: '#ef4444', outline: '1px solid rgba(239,68,68,0.2)', fontWeight: 600 }}
                  >
                    Limpar
                  </button>
                )}
              </div>
            )}

            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }} className="mkt-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, height: 320, animation: 'pulse 1.5s infinite' }} />
                ))}
              </div>
            ) : vitrine.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', color: 'rgba(255,255,255,0.3)' }}>
                <IconMarketplace size={40} color="rgba(255,255,255,0.15)" style={{marginBottom:16}} />
                <p style={{ fontSize: 15 }}>
                  {(busca || filtroStatus || filtroVariante || filtroCondicao)
                    ? 'Nenhum anúncio com esses filtros.'
                    : 'Nenhum anúncio disponível no momento.'}
                </p>
                <p style={{ fontSize: 13, marginTop: 8 }}>
                  {(busca || filtroStatus || filtroVariante || filtroCondicao)
                    ? <button onClick={() => { setBusca(''); setFiltroStatus(''); setFiltroVariante(''); setFiltroCondicao('') }}
                        style={{ background: 'transparent', border: 'none', color: '#f59e0b', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textDecoration: 'underline' }}
                      >Limpar filtros</button>
                    : 'Seja o primeiro a anunciar uma carta!'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }} className="mkt-grid">
                {vitrine.map(card => (
                  <AnuncioCard key={card.id} card={card} userId={userId} userWhatsapp={userWhatsapp} onAction={loadData} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── MEUS ANÚNCIOS ── */}
        {tab === 'meus' && (
          <>
            {meusAnuncios.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', color: 'rgba(255,255,255,0.3)' }}>
                <IconCollection size={40} color="rgba(255,255,255,0.15)" style={{marginBottom:16}} />
                <p style={{ fontSize: 15 }}>Você ainda não tem anúncios.</p>
                <p style={{ fontSize: 13, marginTop: 8 }}>Clique em "+ Anunciar carta" para começar.</p>
              </div>
            ) : (
              <>
                {/* Resumo por status */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                  {Object.entries(STATUS_CFG).map(([key, cfg]) => {
                    const count = meusAnuncios.filter(c => c.status === key).length
                    if (!count) return null
                    return (
                      <div key={key} style={{ background: cfg.bg, border: `1px solid ${cfg.color}33`, borderRadius: 10, padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: cfg.color }}>{count}</span>
                        <span style={{ fontSize: 12, color: cfg.color }}>{cfg.label}</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }} className="mkt-grid">
                  {meusAnuncios.map(card => (
                    <AnuncioCard key={card.id} card={card} userId={userId} userWhatsapp={userWhatsapp} onAction={loadData} />
                  ))}
                </div>

                {/* Banner upgrade após 3 anúncios */}
                {totalAnuncios >= LIMITE_FREE_MKTPLACE && (
                  <UpgradeBanner tipo="marketplace" />
                )}
              </>
            )}
          </>
        )}

        {/* ── NEGOCIAÇÕES ── */}
        {tab === 'negociacoes' && (
          <NegociacoesTab
            listings={listings}
            userId={userId}
            onAction={loadData}
          />
        )}

      </div>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }
        @media (max-width: 768px) {
          .mkt-header { flex-direction: column !important; align-items: flex-start !important; }
          .mkt-header button { width: 100% !important; }
          .mkt-tabs button { font-size: 11px !important; padding: 8px 6px !important; }
          .mkt-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
          .mkt-neg-row { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .mkt-neg-row .mkt-neg-actions { width: 100% !important; justify-content: flex-start !important; }
          .mkt-card-img { width: 70px !important; height: 98px !important; }
          .mkt-filtros-row1 { flex-direction: column !important; }
          .mkt-filtros-row1 select { width: 100% !important; }
          .mkt-filtros-row2 { gap: 6px !important; }
          .mkt-filtros-row2 button { font-size: 12px !important; padding: 6px 10px !important; }
        }
        @media (max-width: 400px) {
          .mkt-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {showAnunciarModal && userId && (
        <AnunciarModal
          userId={userId}
          onClose={() => setShowAnunciarModal(false)}
          onAdded={() => { setShowAnunciarModal(false); loadData() }}
        />
      )}
    </AppLayout>
  )
}
