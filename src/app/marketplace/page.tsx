'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { IconMarketplace, IconCheck, IconLocation, IconSearch, IconCollection, IconChat, IconBox, IconTag, IconStar, IconFire, IconShield, IconClock, IconBolt, IconFilter, IconArrowRight, IconCard, IconPlus } from '@/components/ui/Icons'
import { supabase } from '@/lib/supabaseClient'
import { dispararMarco } from '@/lib/marketplaceMarco'
import { authFetch } from '@/lib/authFetch'
import { GRADUADORAS, GRADUADORA_MAP, tierNome, notaCurta, isNotaTop } from '@/lib/graduadoras'
import { checkMarketplaceLimit, LIMITE_FREE_MKTPLACE } from '@/lib/checkCardLimit'
import { getUserPlan } from '@/lib/isPro'
import { trackFirstCardAdded } from '@/lib/analytics'
import UpgradeBanner from '@/components/ui/UpgradeBanner'
import AppLayout from '@/components/ui/AppLayout'
import { useAppModal } from '@/components/ui/useAppModal'
import AnunciarModal from '@/components/marketplace/AnunciarModal'
import ModalLimiteAnuncios from '@/components/ui/ModalLimiteAnuncios'
import NegociacoesTab from '@/components/marketplace/NegociacoesTab'
import MarketplaceFotosGaleria from '@/components/marketplace/MarketplaceFotosGaleria'

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

const CONDICAO_COR: Record<string, string> = {
  NM: '#22c55e', LP: '#84cc16', MP: '#f59e0b', HP: '#f97316', D: '#ef4444',
}

function tempoRelativo(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (isNaN(ms)) return ''
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'agora mesmo'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'há 1 dia'
  if (d < 7) return `há ${d} dias`
  const sem = Math.floor(d / 7)
  if (d < 30) return sem === 1 ? 'há 1 semana' : `há ${sem} semanas`
  const meses = Math.floor(d / 30)
  if (d < 365) return meses === 1 ? 'há 1 mês' : `há ${meses} meses`
  const anos = Math.floor(d / 365)
  return anos === 1 ? 'há 1 ano' : `há ${anos} anos`
}

const AVATAR_CORES = ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316']
function corDoNome(s: string | null | undefined): string {
  const str = s || '?'
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return AVATAR_CORES[h % AVATAR_CORES.length]
}
function iniciais(nome: string | null | undefined): string {
  const n = (nome || '').trim()
  if (!n) return '?'
  const p = n.split(/\s+/)
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

// Comparação de cidade (signup) — normaliza acentos/caixa pra "Perto de você"
const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const normCidade = (s: string | null | undefined) => stripAccents((s || '').toLowerCase().trim())
// Desconto vs mercado (fração 0..1). Sem mercado conhecido => -Infinity (nunca entra em ofertas)
const descontoDe = (c: any) => (c.preco_mercado > 0 && c.price > 0) ? (c.preco_mercado - c.price) / c.preco_mercado : -Infinity
const isNovo24 = (c: any) => !!c.created_at && (Date.now() - new Date(c.created_at).getTime()) < 24 * 60 * 60 * 1000

const VARIANTES = [
  { key: 'normal', label: 'Normal' },
  { key: 'foil',   label: 'Foil'   },
  { key: 'promo',  label: 'Promo'  },
  { key: 'reverse',label: 'Reverse Foil' },
]

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const SURFACE = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }

// Cabeçalho de seção (ícone + título + ação opcional "ver todas")
function SectionHead({ Icon, color, title, count, actionLabel, onAction }: {
  Icon: any; color: string; title: string; count?: number; actionLabel?: string; onAction?: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '26px 2px 14px', gap: 12 }}>
      <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.03em', margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
        <Icon size={19} color={color} /> {title}
        {typeof count === 'number' && count > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>· {count}</span>
        )}
      </h2>
      {actionLabel && onAction && (
        <button onClick={onAction} style={{ background: 'transparent', border: 'none', color: '#f59e0b', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {actionLabel} <IconArrowRight size={14} color="#f59e0b" />
        </button>
      )}
    </div>
  )
}

// ─── Componente de card de anúncio ────────────────────────────────────────────

function AnuncioCard({ card, userId, userWhatsapp, onAction }: {
  card: any; userId: string | null; userWhatsapp: string | null; onAction: () => void
}) {
  const { showAlert, showConfirm } = useAppModal()
  const router = useRouter()
  const isMeu    = card.user_id === userId
  const isBuyer  = card.buyer_id === userId
  const st       = STATUS_CFG[card.status || 'disponivel'] || STATUS_CFG.disponivel
  const variante = VARIANTES.find(v => v.key === card.variante)?.label || 'Normal'
  const grad = card.graduada && card.graduadora ? GRADUADORA_MAP[card.graduadora] : null

  async function contatarVendedor(jaRegistrouInteresse: boolean) {
    try {
      const resp = await authFetch(`/api/marketplace/${card.id}/contato`)
      const dados = await resp.json().catch(() => ({}))
      if (resp.ok && dados.whatsapp) {
        const msg = encodeURIComponent(`Olá! Tenho interesse na carta *${card.card_name}* anunciada no Bynx por ${fmt(card.price)}. Podemos negociar?`)
        window.open(`https://wa.me/55${dados.whatsapp}?text=${msg}`, '_blank')
        return
      }
    } catch { /* cai no fallback abaixo */ }
    if (jaRegistrouInteresse) {
      showAlert('Interesse registrado! O vendedor será notificado.', 'success')
    } else {
      showAlert('Não foi possível abrir o contato agora. Tente novamente.', 'warning')
    }
  }

  async function handleInteresse() {
    if (!userId) { showAlert('Você precisa estar logado.', 'error'); return }
    if (isMeu)   { showAlert('Você não pode comprar sua própria carta.', 'warning'); return }

    // Verifica limite de negociações do comprador


    const ok = await showConfirm({
      message: `Deseja manifestar interesse em "${card.card_name}" por ${fmt(card.price)}?`,
      confirmLabel: 'Sim, tenho interesse',
      description: 'Você poderá conversar com o vendedor aqui pela plataforma.',
    })
    if (!ok) return

    await supabase.from('marketplace')
      .update({ status: 'reservado', buyer_id: userId })
      .eq('id', card.id)

    await dispararMarco(card.id, 'interesse')

    router.push(`/marketplace?conversa=${card.id}`)
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
      ...(grad ? { boxShadow: `inset 0 0 0 2px ${grad.cor}, inset 0 0 0 5px rgba(255,255,255,0.06)${isNotaTop(card.nota, card.black_label) ? `, 0 0 26px -3px ${grad.cor}` : ''}` } : {}),
      opacity: card.status === 'cancelado' || card.status === 'concluido' ? 0.5 : 1,
    }}>
      {/* Imagem */}
      <div style={{ position: 'relative' }}>
        {grad && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', background: card.black_label ? '#0a0a0a' : grad.cor }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: card.black_label ? '#e8c878' : '#fff', letterSpacing: '0.03em' }}>{grad.curto}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: card.black_label ? '#e8c878' : '#fff' }}>{notaCurta(card.nota, card.black_label)}</span>
          </div>
        )}
        {card.fotos && card.fotos.length ? (
          <MarketplaceFotosGaleria fotos={card.fotos} cardName={card.card_name} />
        ) : card.card_image ? (
          <img src={card.card_image} alt={card.card_name} style={{ width: '100%', display: 'block' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('hidden') }}
          />
        ) : null}
        <div hidden={!!card.card_image} style={{ width: '100%', paddingBottom: '140%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: card.card_image ? 'absolute' : 'relative', inset: 0 }}>
          <IconCard size={40} color="rgba(255,255,255,0.2)" />
        </div>

        {/* Status badge */}
        <span style={{ position: 'absolute', top: grad ? 30 : 8, left: 8, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: st.bg, color: st.color, backdropFilter: 'blur(4px)' }}>
          {st.label}
        </span>

        {/* Variante badge */}
        <span style={{ position: 'absolute', top: grad ? 30 : 8, right: 8, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: 'rgba(0,0,0,0.6)', color: '#f0f0f0' }}>
          {variante}
        </span>

        {/* Badges contextuais sobrepostos — só em anúncios disponíveis.
            Novo: criado nas últimas 24h · Imperdível: >25% abaixo · Bom preço: >10% abaixo.
            Todos com ícone outline (zero emoji). */}
        {(card.status || 'disponivel') === 'disponivel' && (() => {
          const badges: Array<{ Icon: any; label: string; bg: string; color: string }> = []
          const isNovo = card.created_at && (Date.now() - new Date(card.created_at).getTime()) < 24 * 60 * 60 * 1000
          if (isNovo) badges.push({ Icon: IconBolt, label: 'Novo', bg: 'rgba(96,165,250,0.85)', color: '#0a0e16' })

          if (card.preco_mercado > 0 && card.price > 0) {
            const desconto = (card.preco_mercado - card.price) / card.preco_mercado
            if (desconto >= 0.25) badges.push({ Icon: IconFire, label: 'Imperdível', bg: 'rgba(239,68,68,0.85)', color: '#fff' })
            else if (desconto >= 0.10) badges.push({ Icon: IconTag, label: 'Bom preço', bg: 'rgba(34,197,94,0.85)', color: '#0a0e16' })
          }

          if (badges.length === 0) return null
          return (
            <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
              {badges.map((b, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 6,
                  background: b.bg, color: b.color, backdropFilter: 'blur(4px)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                }}><b.Icon size={11} color={b.color} />{b.label}</span>
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
            {grad ? (
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.02em', color: card.black_label ? '#e8c878' : '#fff', background: card.black_label ? '#0a0a0a' : grad.cor, border: card.black_label ? '1px solid #c8a04b' : 'none', padding: '2px 8px', borderRadius: 6, display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                {grad.curto} {notaCurta(card.nota, card.black_label)}<span style={{ fontWeight: 700, opacity: 0.85, fontSize: 9, textTransform: 'uppercase' }}>{tierNome(card.graduadora, card.nota, card.black_label)}</span>
              </span>
            ) : (() => {
              const cond = String(card.condicao || 'NM').toUpperCase()
              const cor = CONDICAO_COR[cond] || 'rgba(255,255,255,0.5)'
              return (
                <span title={CONDICAO_DESC[cond] || cond} style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.02em', color: cor, background: cor + '1f', border: '1px solid ' + cor + '55', padding: '2px 7px', borderRadius: 6 }}>
                  {cond}
                </span>
              )
            })()}
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
          {/* comparação vs mercado se preço canonical disponível */}
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

        {/* Vendedor */}
        <a href={`/perfil/${card.user_id}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 9, paddingTop: 11, borderTop: '1px solid rgba(255,255,255,0.07)', textDecoration: 'none' }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', background: corDoNome(card.seller_name || card.user_id) }}>
            {iniciais(card.seller_name)}
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#e8e8e8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {card.seller_name || 'Vendedor'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
              {card.seller_city && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <IconLocation size={11} color="rgba(255,255,255,0.4)" />{card.seller_city}
                </span>
              )}
              {card.seller_city && card.created_at && <span style={{ opacity: 0.5 }}>·</span>}
              {card.created_at && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <IconClock size={11} color="rgba(255,255,255,0.4)" />{tempoRelativo(card.created_at)}
                </span>
              )}
            </span>
          </span>
        </a>

        {/* Ações por papel e status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>

          {/* Visitante: botão comprar */}
          {!isMeu && !isBuyer && card.status === 'disponivel' && (
            <button onClick={handleInteresse} style={{ background: BRAND, border: 'none', color: '#000', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Tenho interesse
            </button>
          )}

          {/* Abrir conversa (chat on-platform) — comprador ou vendedor */}
          {(isBuyer || isMeu) && ['reservado', 'em_negociacao', 'enviado'].includes(card.status) && (
            <button
              type="button"
              onClick={() => router.push(`/marketplace?conversa=${card.id}`)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: '#f59e0b', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <svg viewBox="0 0 20 20" width="15" height="15" fill="none"><path d="M3 3h14v9H6l-4 3V3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
              Abrir conversa
            </button>
          )}

          {/* Comprador: aguardando */}
          {isBuyer && card.status === 'reservado' && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                <IconClock size={13} color="#f59e0b" /> Aguardando vendedor
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Combine os detalhes na conversa</p>
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

// ─── Hero editorial (1 card · a mais valiosa à venda) ──────────────────────────

function HeroEditorial({ card, userId, onAction }: { card: any; userId: string | null; onAction: () => void }) {
  const { showAlert, showConfirm } = useAppModal()
  const router = useRouter()
  const grad = card.graduada && card.graduadora ? GRADUADORA_MAP[card.graduadora] : null
  const isMeu = card.user_id === userId

  async function interesse() {
    if (!userId) { showAlert('Você precisa estar logado.', 'error'); return }
    if (isMeu)   { showAlert('Você não pode comprar sua própria carta.', 'warning'); return }
    const ok = await showConfirm({
      message: `Deseja manifestar interesse em "${card.card_name}" por ${fmt(card.price)}?`,
      confirmLabel: 'Sim, tenho interesse',
      description: 'Você poderá conversar com o vendedor aqui pela plataforma.',
    })
    if (!ok) return
    await supabase.from('marketplace').update({ status: 'reservado', buyer_id: userId }).eq('id', card.id)
    await dispararMarco(card.id, 'interesse')
    router.push(`/marketplace?conversa=${card.id}`)
  }

  return (
    <div className="mkt-hero" style={{
      display: 'flex', gap: 28, alignItems: 'center',
      background: 'radial-gradient(140% 120% at 12% 30%, rgba(245,158,11,0.07), transparent 60%), rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '24px 28px',
      position: 'relative', overflow: 'hidden', marginBottom: 6,
    }}>
      {/* Arte */}
      <div className="mkt-hero-art" style={{ flex: '0 0 190px', position: 'relative', maxWidth: 190 }}>
        <span style={{ position: 'absolute', top: 12, left: -2, zIndex: 6, display: 'inline-flex', alignItems: 'center', gap: 6, background: BRAND, color: '#0a0a0a', fontSize: 11, fontWeight: 800, letterSpacing: '0.03em', padding: '5px 12px 5px 10px', borderRadius: '0 8px 8px 0' }}>
          <IconStar size={13} color="#0a0a0a" /> MAIS VALIOSA
        </span>
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
          {grad && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', background: card.black_label ? '#0a0a0a' : grad.cor }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: card.black_label ? '#e8c878' : '#fff' }}>{grad.curto}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: card.black_label ? '#e8c878' : '#fff' }}>{notaCurta(card.nota, card.black_label)}</span>
            </div>
          )}
          {card.fotos && card.fotos.length ? (
            <MarketplaceFotosGaleria fotos={card.fotos} cardName={card.card_name} />
          ) : card.card_image ? (
            <img src={card.card_image} alt={card.card_name} style={{ width: '100%', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', paddingBottom: '140%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <IconCard size={40} color="rgba(255,255,255,0.2)" />
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#f59e0b', fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
          <IconStar size={14} color="#f59e0b" /> Destaque do marketplace
        </span>
        <h2 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.035em', margin: '0 0 12px', lineHeight: 1.05 }}>{card.card_name}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {grad ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: card.black_label ? '#e8c878' : '#fff', background: card.black_label ? '#0a0a0a' : grad.cor, border: card.black_label ? '1px solid #c8a04b' : 'none', padding: '3px 10px', borderRadius: 7 }}>
              <IconShield size={13} color={card.black_label ? '#e8c878' : '#fff'} /> {grad.curto} {notaCurta(card.nota, card.black_label)}
              <span style={{ opacity: 0.85, fontSize: 9, textTransform: 'uppercase' }}>{tierNome(card.graduadora, card.nota, card.black_label)}</span>
            </span>
          ) : (() => {
            const cond = String(card.condicao || 'NM').toUpperCase()
            const cor = CONDICAO_COR[cond] || 'rgba(255,255,255,0.5)'
            return <span style={{ fontSize: 11, fontWeight: 800, color: cor, background: cor + '1f', border: '1px solid ' + cor + '55', padding: '3px 10px', borderRadius: 7 }}>{cond}</span>
          })()}
        </div>
        <p style={{ fontSize: 31, fontWeight: 900, letterSpacing: '-0.03em', color: '#f59e0b', margin: '12px 0 2px' }}>{fmt(card.price)}</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)', fontWeight: 600 }}>A carta mais valiosa à venda agora na Bynx.</p>

        <a href={`/perfil/${card.user_id}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginTop: 14, textDecoration: 'none' }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', background: corDoNome(card.seller_name || card.user_id) }}>{iniciais(card.seller_name)}</span>
          <span>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#e8e8e8' }}>{card.seller_name || 'Vendedor'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.42)' }}>
              {card.seller_city && (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><IconLocation size={11} color="rgba(255,255,255,0.42)" />{card.seller_city}</span>)}
              {card.seller_city && card.created_at && <span style={{ opacity: 0.5 }}>·</span>}
              {card.created_at && (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><IconClock size={11} color="rgba(255,255,255,0.42)" />{tempoRelativo(card.created_at)}</span>)}
            </span>
          </span>
        </a>

        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          {!isMeu && card.status === 'disponivel' ? (
            <button onClick={interesse} style={{ background: BRAND, border: 'none', color: '#0a0a0a', padding: '11px 20px', borderRadius: 11, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Tenho interesse</button>
          ) : null}
          <a href={`/perfil/${card.user_id}`} target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.14)', color: '#f0f0f0', padding: '11px 18px', borderRadius: 11, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none' }}>
            Ver vendedor <IconArrowRight size={16} color="#f0f0f0" />
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
//
// S29 UX v3 — REGRA 24: useSearchParams em Next.js 16+ pode quebrar build
// estático sem Suspense. Por isso o componente real (MarketplaceInner)
// roda dentro de um Suspense boundary no default export.

function MarketplaceInner() {
  const { showAlert, showConfirm, showPrompt } = useAppModal()

  // S29 UX v5: solução definitiva pra bug do F5 reset.
  // Em vez de depender de useSearchParams (que tinha bug de re-render
  // após router.replace em Next.js 16), usamos window.history.replaceState
  // direto pra atualizar a URL silenciosamente, e useState pra UI.
  // - Init lê da URL (F5 mantém aba)
  // - setTab atualiza state E url
  // - back/forward do navegador funciona via popstate listener
  const [tab, setTabState] = useState<'vitrine' | 'meus' | 'negociacoes'>(() => {
    if (typeof window === 'undefined') return 'vitrine'
    const t = new URL(window.location.href).searchParams.get('tab')
    return (t === 'meus' || t === 'negociacoes') ? t : 'vitrine'
  })

  // Listener pra back/forward do navegador
  useEffect(() => {
    function handlePopState() {
      const t = new URL(window.location.href).searchParams.get('tab')
      setTabState((t === 'meus' || t === 'negociacoes') ? t : 'vitrine')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function setTab(novoTab: 'vitrine' | 'meus' | 'negociacoes') {
    setTabState(novoTab)
    // Atualiza URL silenciosamente sem trigger do router Next.js
    const url = new URL(window.location.href)
    if (novoTab === 'vitrine') {
      url.searchParams.delete('tab')
    } else {
      url.searchParams.set('tab', novoTab)
    }
    window.history.replaceState({}, '', url.toString())
  }

  const [totalAnuncios, setTotalAnuncios] = useState(0)
  const [listings, setListings] = useState<any[]>([])
  const [userId, setUserId]     = useState<string | null>(null)
  const [userWhatsapp, setUserWhatsapp] = useState<string | null>(null)
  const [userCity, setUserCity] = useState<string | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [limiteAnuncios, setLimiteAnuncios] = useState<number>(LIMITE_FREE_MKTPLACE)
  const [loading, setLoading]   = useState(true)
  const [showAnunciarModal, setShowAnunciarModal] = useState(false)
  const [showLimiteAnuncios, setShowLimiteAnuncios] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroVariante, setFiltroVariante] = useState('')
  const [filtroCondicao, setFiltroCondicao] = useState('')
  const [filtroGraduadora, setFiltroGraduadora] = useState('')
  const [showFiltrosAvancados, setShowFiltrosAvancados] = useState(false)
  const [busca, setBusca]       = useState('')
  const [ordenacao, setOrdenacao] = useState<'recente' | 'menor' | 'maior' | 'desconto'>('recente')
  // Lentes de descoberta da barra principal (eixo separado dos filtros avançados)
  const [discovery, setDiscovery] = useState<'' | 'ofertas' | 'bompreco' | 'graduadas' | 'novidades' | 'perto'>('')

  const mesmaCidade = (c: any) => !!userCity && !!c.seller_city && normCidade(c.seller_city) === normCidade(userCity)

  async function loadData() {
    setLoading(true)
    const { data: authData } = await supabase.auth.getUser()
    const uid = authData.user?.id || null
    setUserId(uid)

    if (uid) {
      // S29: lê próprio whatsapp/city de users (RLS auth.uid()=id permite)
      const { data: profile } = await supabase.from('users').select('whatsapp, city').eq('id', uid).single()
      setUserWhatsapp(profile?.whatsapp || null)
      setUserCity(profile?.city || null)

      // S29: detecta se user é Pro/trial pra esconder banners de upgrade.
      // getUserPlan considera is_pro + pro_expira_em + trial_expires_at.
      const planInfo = await getUserPlan(uid)
      setIsPro(planInfo.isPro)
      setLimiteAnuncios(planInfo.caps.limiteAnuncios)
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
        .select('id, name, city')
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
        .select('id, name, city')
        .in('id', buyerIds)

      buyerMap = (buyers || []).reduce((acc: any, s: any) => {
        acc[s.id] = s
        return acc
      }, {})
    }

    // S29 UX v2: enrich com preço de mercado canonical pra calcular badges.
    //
    // BUG ANTERIOR: o `.in('name', cardNames)` pedia match EXATO. Mas no
    // marketplace o card_name vem como "Charmander (017/034)" enquanto em
    // pokemon_cards vem só "Charmander" — então quase nenhum match acontecia
    // e os badges nunca apareciam.
    //
    // FIX: extrai o nome-base removendo o sufixo "(NNN/NNN)" antes do match.
    const stripCardNumber = (name: string) =>
      name.replace(/\s*\([^)]*\)\s*$/, '').trim()

    const baseNames = [...new Set(
      listings.map((c: any) => c.card_name ? stripCardNumber(c.card_name) : null).filter(Boolean)
    )]
    let priceMap: Record<string, number> = {}
    if (baseNames.length > 0) {
      const pokemons = await fetch('/api/cards/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: baseNames }),
      }).then((r) => r.json()).then((d) => d.cards || []).catch(() => [])
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
      preco_mercado: c.card_name ? (priceMap[stripCardNumber(c.card_name)] || 0) : 0,
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
      setShowLimiteAnuncios(true)
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
    if (filtroGraduadora && c.graduadora !== filtroGraduadora) return false
    if (busca && !c.card_name.toLowerCase().includes(busca.toLowerCase())) return false
    // Lentes de descoberta (chips da barra principal)
    if (discovery === 'ofertas' && descontoDe(c) < 0.15) return false
    if (discovery === 'bompreco') { const d = descontoDe(c); if (!(d >= 0.05 && d < 0.15)) return false }
    if (discovery === 'graduadas' && !c.graduada) return false
    if (discovery === 'novidades' && !isNovo24(c)) return false
    if (discovery === 'perto' && !mesmaCidade(c)) return false
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

  // ── Curadoria da vitrine (hero · trio · trilhos) ─────────────────────────────
  // Pool base = anúncios de OUTROS users, status disponível (compráveis).
  const disponiveis = useMemo(
    () => listings.filter(c => c.user_id !== userId && (c.status || 'disponivel') === 'disponivel'),
    [listings, userId]
  )

  // 1) Hero editorial = a mais valiosa à venda.
  const hero = useMemo(() => {
    if (disponiveis.length === 0) return null
    return [...disponiveis].sort((a, b) => (b.price || 0) - (a.price || 0))[0]
  }, [disponiveis])

  // 2) Trio pódio: centro = maior valor · esquerda = maior oferta · direita = mais nova.
  const trio = useMemo(() => {
    const pool = disponiveis.filter(c => !hero || c.id !== hero.id)
    if (pool.length < 3) return [] as Array<{ c: any; top: boolean }>
    const center = [...pool].sort((a, b) => (b.price || 0) - (a.price || 0))[0]
    const rest1 = pool.filter(c => c.id !== center.id)
    const left = [...rest1].sort((a, b) => descontoDe(b) - descontoDe(a))[0]
    const rest2 = rest1.filter(c => c.id !== left.id)
    const right = [...rest2].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    if (!center || !left || !right) return []
    const ids = new Set([center.id, left.id, right.id])
    if (ids.size !== 3) return []
    return [{ c: left, top: false }, { c: center, top: true }, { c: right, top: false }]
  }, [disponiveis, hero])

  const heroTrioIds = useMemo(
    () => new Set<string>([hero?.id, ...trio.map(t => t.c.id)].filter(Boolean) as string[]),
    [hero, trio]
  )

  // 3) Trilhos (excluem o que já está em hero/trio pra não repetir).
  const railOfertas = useMemo(
    () => disponiveis.filter(c => !heroTrioIds.has(c.id) && descontoDe(c) >= 0.15)
      .sort((a, b) => descontoDe(b) - descontoDe(a)).slice(0, 12),
    [disponiveis, heroTrioIds]
  )
  const railGrads = useMemo(
    () => disponiveis.filter(c => !heroTrioIds.has(c.id) && c.graduada)
      .sort((a, b) => (b.price || 0) - (a.price || 0)).slice(0, 12),
    [disponiveis, heroTrioIds]
  )

  // Modo editorial: só no estado "limpo" (sem busca/filtros/lente). Quando o
  // user busca ou aplica um filtro/lente, cai direto na grade de resultados.
  const semFiltro = !busca && !filtroStatus && !filtroVariante && !filtroCondicao && !filtroGraduadora
  const editorialMode = discovery === '' && semFiltro && !loading
  const gridCards = editorialMode ? vitrine.filter(c => !heroTrioIds.has(c.id)) : vitrine

  // Contadores das lentes de descoberta
  const baseAtivos = listings.filter(c => c.user_id !== userId && !['concluido', 'cancelado'].includes(c.status || 'disponivel'))
  const countTodos = baseAtivos.length
  const countOfertas = baseAtivos.filter(c => descontoDe(c) >= 0.15).length
  const countBom = baseAtivos.filter(c => { const d = descontoDe(c); return d >= 0.05 && d < 0.15 }).length
  const countGrad = baseAtivos.filter(c => c.graduada).length
  const countNovi = baseAtivos.filter(c => isNovo24(c)).length
  const countPerto = userCity ? baseAtivos.filter(c => mesmaCidade(c)).length : 0

  const discoveryChips: Array<{ key: typeof discovery; label: string; Icon: any | null; count: number; show: boolean }> = [
    { key: '',          label: 'Todos',         Icon: null,          count: countTodos,   show: true },
    { key: 'ofertas',   label: 'Ofertas',       Icon: IconFire,      count: countOfertas, show: countOfertas > 0 },
    { key: 'bompreco',  label: 'Bom preço',     Icon: IconTag,       count: countBom,     show: countBom > 0 },
    { key: 'graduadas', label: 'Graduadas',     Icon: IconStar,      count: countGrad,    show: countGrad > 0 },
    { key: 'novidades', label: 'Novidades',     Icon: IconBolt,      count: countNovi,    show: countNovi > 0 },
    { key: 'perto',     label: 'Perto de você', Icon: IconLocation,  count: countPerto,   show: !!userCity && countPerto > 0 },
  ]

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
            style={{ background: BRAND, border: 'none', color: '#000', padding: '12px 24px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 0 20px rgba(245,158,11,0.2)', display: 'inline-flex', alignItems: 'center', gap: 7 }}
          >
            <IconPlus size={16} color="#000" /> Anunciar carta
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4 }} className="mkt-tabs">
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
            {/* HERO editorial + TRIO pódio — só no modo editorial (estado limpo) */}
            {editorialMode && hero && (
              <HeroEditorial card={hero} userId={userId} onAction={loadData} />
            )}

            {editorialMode && trio.length === 3 && (
              <>
                <SectionHead Icon={IconStar} color="#f59e0b" title="Em destaque hoje" />
                <div className="mkt-trio" style={{ display: 'grid', gridTemplateColumns: '1fr 1.12fr 1fr', gap: 16, alignItems: 'center', marginBottom: 6 }}>
                  {trio.map(({ c, top }) => (
                    <div key={c.id} style={{ position: 'relative', transform: top ? 'translateY(-6px)' : 'none' }}>
                      {top && (
                        <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', zIndex: 6, display: 'inline-flex', alignItems: 'center', gap: 5, background: BRAND, color: '#0a0a0a', fontSize: 10, fontWeight: 900, letterSpacing: '0.04em', padding: '3px 11px', borderRadius: 100, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(245,158,11,0.35)' }}>
                          <IconStar size={11} color="#0a0a0a" /> TOP DO DIA
                        </span>
                      )}
                      <div style={{ borderRadius: 16, ...(top ? { boxShadow: '0 0 0 2px rgba(245,158,11,0.55)' } : {}) }}>
                        <AnuncioCard card={c} userId={userId} userWhatsapp={userWhatsapp} onAction={loadData} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Barra de descoberta: busca + Filtros + ordenação */}
            <div style={{ display: 'flex', gap: 10, marginTop: editorialMode ? 26 : 0, marginBottom: 12, flexWrap: 'wrap' }} className="mkt-filtros-row1">
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

              <button
                onClick={() => setShowFiltrosAvancados(v => !v)}
                style={{
                  padding: '11px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  background: (filtroStatus || filtroVariante || filtroCondicao || filtroGraduadora) ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.05)',
                  color: (filtroStatus || filtroVariante || filtroCondicao || filtroGraduadora) ? '#60a5fa' : 'rgba(255,255,255,0.8)',
                  outline: (filtroStatus || filtroVariante || filtroCondicao || filtroGraduadora) ? '1px solid rgba(96,165,250,0.35)' : '1px solid rgba(255,255,255,0.1)',
                  display: 'inline-flex', alignItems: 'center', gap: 7, transition: 'all 0.15s',
                }}
              >
                <IconFilter size={15} color={(filtroStatus || filtroVariante || filtroCondicao || filtroGraduadora) ? '#60a5fa' : 'rgba(255,255,255,0.8)'} /> Filtros
                {(filtroStatus || filtroVariante || filtroCondicao || filtroGraduadora) && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(96,165,250,0.25)', color: '#60a5fa', padding: '1px 6px', borderRadius: 100 }}>
                    {[filtroStatus, filtroVariante, filtroCondicao, filtroGraduadora].filter(Boolean).length}
                  </span>
                )}
              </button>

              <select value={ordenacao} onChange={e => setOrdenacao(e.target.value as any)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 14px', color: 'rgba(255,255,255,0.85)', fontSize: 13, cursor: 'pointer', outline: 'none', fontFamily: 'inherit', minWidth: 200 }}
              >
                <option value="recente"  style={{ background: '#0d0f14' }}>Mais recentes primeiro</option>
                <option value="menor"    style={{ background: '#0d0f14' }}>Menor preço primeiro</option>
                <option value="maior"    style={{ background: '#0d0f14' }}>Maior preço primeiro</option>
                <option value="desconto" style={{ background: '#0d0f14' }}>Maior desconto vs mercado</option>
              </select>
            </div>

            {/* Chips de descoberta */}
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }} className="mkt-chips">
              {discoveryChips.filter(ch => ch.show).map(ch => {
                const ativo = discovery === ch.key
                return (
                  <button key={ch.key || 'todos'} onClick={() => setDiscovery(ch.key)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '8px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 13, fontWeight: ativo ? 700 : 600,
                      background: ativo ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)',
                      color: ativo ? '#fde9c4' : 'rgba(255,255,255,0.6)',
                      outline: ativo ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.07)',
                      transition: 'all 0.15s', whiteSpace: 'nowrap',
                    }}
                  >
                    {ch.Icon && <ch.Icon size={15} color={ativo ? '#fde9c4' : 'rgba(255,255,255,0.6)'} />}
                    {ch.label}
                    <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>{ch.count}</span>
                  </button>
                )
              })}
            </div>

            {/* Filtros avançados — colapsáveis (status, variante, condição, graduadora) */}
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
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6, fontWeight: 600 }}>Status</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {([
                      ['', 'Todos'],
                      ['disponivel', 'Disponíveis'],
                      ['reservado', 'Em negociação'],
                      ['em_negociacao', 'Em negociação avançada'],
                      ['enviado', 'Em envio'],
                    ] as const).filter(([key]) => {
                      if (key === 'em_negociacao') return listings.some(c => c.status === 'em_negociacao' && c.user_id !== userId)
                      if (key === 'enviado') return listings.some(c => c.status === 'enviado' && c.user_id !== userId)
                      return true
                    }).map(([key, label]) => {
                      const ativo = filtroStatus === key
                      return (
                        <button key={key} onClick={() => setFiltroStatus(key)}
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
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6, fontWeight: 600 }}>Graduadora</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {([['', 'Todas'] as [string, string], ...GRADUADORAS.map(g => [g.slug, g.curto] as [string, string])]).map(([key, label]) => {
                      const ativo = filtroGraduadora === key
                      return (
                        <button key={key} onClick={() => setFiltroGraduadora(key)}
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
                {(filtroStatus || filtroVariante || filtroCondicao || filtroGraduadora) && (
                  <button onClick={() => { setFiltroStatus(''); setFiltroVariante(''); setFiltroCondicao(''); setFiltroGraduadora('') }}
                    style={{ alignSelf: 'flex-end', padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, background: 'rgba(239,68,68,0.08)', color: '#ef4444', outline: '1px solid rgba(239,68,68,0.2)', fontWeight: 600 }}
                  >
                    Limpar
                  </button>
                )}
              </div>
            )}

            {/* Trilhos editoriais — só no modo limpo e com volume suficiente (>= 4) */}
            {editorialMode && railOfertas.length >= 4 && (
              <>
                <SectionHead Icon={IconFire} color="#f87171" title="Ofertas imperdíveis" count={railOfertas.length} actionLabel="ver todas" onAction={() => setDiscovery('ofertas')} />
                <div className="mkt-track" style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '2px 2px 14px' }}>
                  {railOfertas.map(card => (
                    <div key={card.id} style={{ flex: '0 0 188px' }}>
                      <AnuncioCard card={card} userId={userId} userWhatsapp={userWhatsapp} onAction={loadData} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {editorialMode && railGrads.length >= 4 && (
              <>
                <SectionHead Icon={IconStar} color="#fbbf24" title="Graduadas em destaque" count={railGrads.length} actionLabel="ver todas" onAction={() => setDiscovery('graduadas')} />
                <div className="mkt-track" style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '2px 2px 14px' }}>
                  {railGrads.map(card => (
                    <div key={card.id} style={{ flex: '0 0 188px' }}>
                      <AnuncioCard card={card} userId={userId} userWhatsapp={userWhatsapp} onAction={loadData} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Grade completa */}
            {editorialMode && gridCards.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '26px 2px 14px', gap: 12 }}>
                <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>Todos os anúncios</h2>
                <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>{gridCards.length} {gridCards.length === 1 ? 'resultado' : 'resultados'}</span>
              </div>
            )}

            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }} className="mkt-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, height: 320, animation: 'pulse 1.5s infinite' }} />
                ))}
              </div>
            ) : gridCards.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', color: 'rgba(255,255,255,0.3)' }}>
                <IconMarketplace size={40} color="rgba(255,255,255,0.15)" style={{marginBottom:16}} />
                <p style={{ fontSize: 15 }}>
                  {(busca || filtroStatus || filtroVariante || filtroCondicao || filtroGraduadora || discovery)
                    ? 'Nenhum anúncio com esses filtros.'
                    : 'Nenhum anúncio disponível no momento.'}
                </p>
                <p style={{ fontSize: 13, marginTop: 8 }}>
                  {(busca || filtroStatus || filtroVariante || filtroCondicao || filtroGraduadora || discovery)
                    ? <button onClick={() => { setBusca(''); setFiltroStatus(''); setFiltroVariante(''); setFiltroCondicao(''); setFiltroGraduadora(''); setDiscovery('') }}
                        style={{ background: 'transparent', border: 'none', color: '#f59e0b', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textDecoration: 'underline' }}
                      >Limpar filtros</button>
                    : 'Seja o primeiro a anunciar uma carta!'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }} className="mkt-grid">
                {gridCards.map(card => (
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
                <p style={{ fontSize: 13, marginTop: 8 }}>Clique em "Anunciar carta" para começar.</p>
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

                {/* Banner upgrade após 3 anúncios — apenas pra users free */}
                {limiteAnuncios !== Infinity && totalAnuncios >= limiteAnuncios && (
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
        .mkt-track::-webkit-scrollbar { height: 8px }
        .mkt-track::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 100px }
        @media (max-width: 768px) {
          .mkt-header { flex-direction: column !important; align-items: flex-start !important; }
          .mkt-header button { width: 100% !important; justify-content: center !important; }
          .mkt-tabs button { font-size: 11px !important; padding: 8px 6px !important; }
          .mkt-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
          .mkt-neg-row { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .mkt-neg-row .mkt-neg-actions { width: 100% !important; justify-content: flex-start !important; }
          .mkt-card-img { width: 70px !important; height: 98px !important; }
          .mkt-filtros-row1 { flex-direction: column !important; }
          .mkt-filtros-row1 select, .mkt-filtros-row1 > button { width: 100% !important; justify-content: center !important; }
          .mkt-chips { gap: 6px !important; }
          .mkt-chips button { font-size: 12px !important; padding: 7px 11px !important; }
          .mkt-hero { flex-direction: column !important; align-items: stretch !important; gap: 18px !important; padding: 18px !important; }
          .mkt-hero-art { flex: none !important; max-width: 150px !important; margin: 0 auto !important; }
          .mkt-trio { grid-template-columns: 1fr !important; }
          .mkt-trio > div { transform: none !important; }
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
      {showLimiteAnuncios && (
        <ModalLimiteAnuncios
          onClose={() => setShowLimiteAnuncios(false)}
          onUpgrade={() => { window.location.href = '/minha-conta' }}
        />
      )}
    </AppLayout>
  )
}

// S29 UX v5: removido o wrapper Suspense da v3/v4 porque agora não usamos
// useSearchParams (REGRA 24 não se aplica a window.history direto).
// MarketplaceInner virou o default export.

export default function Marketplace() {
  return <MarketplaceInner />
}
