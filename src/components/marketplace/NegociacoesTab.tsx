'use client'

import { useState } from 'react'
import { IconMarketplace, IconChat, IconBox, IconCheck, IconEye, IconLocation, IconWhatsApp, IconShield, IconTag } from '@/components/ui/Icons'
import { supabase } from '@/lib/supabaseClient'
import AvaliacaoModal from './AvaliacaoModal'
import { criarNotificacao } from '@/lib/notificacoes'
import { useAppModal } from '@/components/ui/useAppModal'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

const VARIANTE_LABEL: Record<string, string> = {
  normal: 'Normal', foil: 'Foil', promo: 'Promo', reverse: 'Reverse Foil',
}

// ─── Timeline de progresso ───────────────────────────────────────────────────

const STEPS_COMPRADOR = [
  { status: ['reservado'],                      label: 'Interesse demonstrado', icon: 'handshake' },
  { status: ['em_negociacao'],                  label: 'Em negociação',         icon: 'chat' },
  { status: ['enviado'],                        label: 'Carta enviada',         icon: 'box' },
  { status: ['concluido'],                      label: 'Recebido!',             icon: 'check' },
]

const STEPS_VENDEDOR = [
  { status: ['reservado'],                      label: 'Comprador interessado', icon: 'eye' },
  { status: ['em_negociacao'],                  label: 'Em negociação',         icon: 'chat' },
  { status: ['enviado'],                        label: 'Você enviou',           icon: 'box' },
  { status: ['concluido'],                      label: 'Venda concluída!',      icon: 'check' },
]

function Timeline({ steps, currentStatus }: { steps: typeof STEPS_COMPRADOR; currentStatus: string }) {
  const currentIdx = steps.findIndex(s => s.status.includes(currentStatus))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '16px 0' }}>
      {steps.map((step, i) => {
        const done    = i < currentIdx
        const active  = i === currentIdx
        const pending = i > currentIdx

        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            {/* Step */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: done ? 18 : active ? 20 : 16,
                background: done
                  ? 'rgba(34,197,94,0.15)'
                  : active
                  ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.15))'
                  : 'rgba(255,255,255,0.05)',
                border: done
                  ? '1.5px solid rgba(34,197,94,0.4)'
                  : active
                  ? '1.5px solid rgba(245,158,11,0.5)'
                  : '1.5px solid rgba(255,255,255,0.1)',
                transition: 'all 0.3s',
              }}>
                {done ? <svg width='16' height='16' viewBox='0 0 20 20' fill='none'><path d='M4 10l4.5 4.5L16 6' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/></svg> : step.icon === 'handshake' ? <svg width='16' height='16' viewBox='0 0 20 20' fill='none'><path d='M3 7l4 3 3-2 3 2 4-3' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'/><path d='M3 13l4-3 3 2 3-2 4 3' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'/></svg> : step.icon === 'chat' ? <svg width='16' height='16' viewBox='0 0 20 20' fill='none'><path d='M3 3h14v9H6l-4 3V3z' stroke='currentColor' strokeWidth='1.5' strokeLinejoin='round'/></svg> : step.icon === 'box' ? <svg width='16' height='16' viewBox='0 0 20 20' fill='none'><path d='M3 7l7-4 7 4v9l-7 4-7-4V7z' stroke='currentColor' strokeWidth='1.5' strokeLinejoin='round'/></svg> : step.icon === 'check' ? <svg width='16' height='16' viewBox='0 0 20 20' fill='none'><circle cx='10' cy='10' r='7' stroke='currentColor' strokeWidth='1.5'/><path d='M6.5 10l2.5 2.5 4-5' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'/></svg> : <svg width='16' height='16' viewBox='0 0 20 20' fill='none'><circle cx='10' cy='10' r='4.5' stroke='currentColor' strokeWidth='1.5'/><path d='M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z' stroke='currentColor' strokeWidth='1.5'/></svg>}
              </div>
              <p style={{
                fontSize: 11, textAlign: 'center', maxWidth: 64, lineHeight: 1.3,
                color: done ? '#22c55e' : active ? '#f59e0b' : 'rgba(255,255,255,0.25)',
                fontWeight: active ? 700 : 400,
              }}>
                {step.label}
              </p>
            </div>

            {/* Linha conectora */}
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: '0 4px', marginBottom: 20,
                background: done ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)',
                transition: 'background 0.3s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Card de negociação ───────────────────────────────────────────────────────

function NegociacaoCard({ card, role, onAction, userId }: {
  card: any
  role: 'comprador' | 'vendedor'
  onAction: () => void
  userId: string
}) {
  const { showConfirm, showAlert } = useAppModal()
  const [showAvaliacao, setShowAvaliacao] = useState(false)
  const status = card.status || 'reservado'
  const steps  = role === 'comprador' ? STEPS_COMPRADOR : STEPS_VENDEDOR

  const whatsapp = role === 'comprador' ? card.seller_whatsapp : card.buyer_whatsapp
  const nomeContato = role === 'comprador' ? card.seller_name : card.buyer_name
  const cidadeContato = role === 'comprador' ? card.seller_city : card.buyer_city

  function abrirWhatsApp() {
    if (!whatsapp) return
    const tel = whatsapp.replace(/\D/g, '')
    const msg = role === 'comprador'
      ? `Olá! Tenho interesse na carta *${card.card_name}* por ${fmt(card.price)} anunciada no TCG Manager.`
      : `Olá! Você demonstrou interesse na minha carta *${card.card_name}* por ${fmt(card.price)} no TCG Manager.`
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  async function handleConfirmarEnvio() {
    const ok = await showConfirm({
      message: `Confirma que enviou "${card.card_name}" para ${nomeContato}?`,
      confirmLabel: 'Sim, confirmei o envio',
      description: 'O comprador será notificado para confirmar o recebimento.',
    })
    if (!ok) return
    await supabase.from('marketplace').update({ status: 'enviado' }).eq('id', card.id)

    // Notifica o comprador
    if (card.buyer_id) {
      await criarNotificacao(
        card.buyer_id,
        'enviado',
        'Sua carta foi enviada!',
        `${nomeContato || 'O vendedor'} confirmou o envio de "${card.card_name}". Confirme o recebimento quando chegar.`,
        { marketplace_id: card.id, card_name: card.card_name }
      )
    }

    showAlert('Envio confirmado! Aguardando o comprador confirmar o recebimento.', 'success')
    onAction()
  }

  async function handleConfirmarRecebimento() {
    const ok = await showConfirm({
      message: `Confirma que recebeu "${card.card_name}"?`,
      confirmLabel: 'Sim, recebi a carta!',
      description: 'A carta será adicionada à sua coleção e a venda será concluída.',
    })
    if (!ok) return

    const { data: authData } = await supabase.auth.getUser()
    const uid = authData.user?.id
    if (!uid) return

    // Transfere carta para coleção do comprador
    await supabase.from('user_cards').insert({
      user_id: uid, card_name: card.card_name,
      card_image: card.card_image || null, card_link: card.card_link || null,
      variante: card.variante || 'normal',
    })

    // Remove da coleção do vendedor
    await supabase.from('user_cards')
      .delete().eq('user_id', card.user_id).eq('card_name', card.card_name).limit(1)

    // Registra transação
    await supabase.from('transactions').insert({
      buyer_id: uid, seller_id: card.user_id,
      card_name: card.card_name, price: card.price,
    })

    // Conclui anúncio
    await supabase.from('marketplace').update({ status: 'concluido' }).eq('id', card.id)

    // Notifica o vendedor
    await criarNotificacao(
      card.user_id,
      'recebido',
      'Venda concluída!',
      `O comprador confirmou o recebimento de "${card.card_name}". Negociação concluída com sucesso!`,
      { marketplace_id: card.id, card_name: card.card_name }
    )

    showAlert('Compra concluída! A carta foi adicionada à sua coleção.', 'success')
    onAction()
    // Abre modal de avaliação
    setTimeout(() => setShowAvaliacao(true), 800)
  }

  async function handleCancelar() {
    const ok = await showConfirm({
      message: 'Deseja cancelar esta negociação?',
      danger: true, confirmLabel: 'Cancelar negociação',
      description: 'O anúncio voltará para a vitrine como disponível.',
    })
    if (!ok) return
    await supabase.from('marketplace').update({ status: 'disponivel', buyer_id: null }).eq('id', card.id)
    onAction()
  }

  return (
    <>
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: status === 'enviado'
        ? '1px solid rgba(96,165,250,0.3)'
        : status === 'concluido'
        ? '1px solid rgba(34,197,94,0.3)'
        : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, overflow: 'hidden',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      {/* Imagem + info lado a lado */}
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Imagem */}
        <div style={{ width: 100, flexShrink: 0 }}>
          {card.card_image
            ? <img src={card.card_image} alt={card.card_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <div style={{ width: '100%', height: 120, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🃏</div>
          }
        </div>

        {/* Info */}
        <div style={{ flex: 1, padding: '14px 16px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, letterSpacing: '-0.01em' }}>{card.card_name}</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 100, color: 'rgba(255,255,255,0.5)' }}>
              {VARIANTE_LABEL[card.variante] || 'Normal'}
            </span>
            <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 100, color: 'rgba(255,255,255,0.5)' }}>
              {card.condicao || 'NM'}
            </span>
          </div>
          <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: '#f59e0b', marginBottom: 6 }}>
            {fmt(card.price)}
          </p>

          {/* Contato */}
          {(nomeContato || whatsapp) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#000', flexShrink: 0 }}>
                {nomeContato?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#f0f0f0' }}>
                  {role === 'comprador' ? 'Vendedor: ' : 'Comprador: '}
                  {nomeContato || 'Usuário'}
                </p>
                {cidadeContato && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', display:'flex', alignItems:'center', gap:3 }}><svg width='16' height='16' viewBox='0 0 20 20' fill='none'><path d='M10 2a5 5 0 015 5c0 3.5-5 11-5 11S5 10.5 5 7a5 5 0 015-5z' stroke='currentColor' strokeWidth='1.3'/><circle cx='10' cy='7' r='2' stroke='currentColor' strokeWidth='1.3'/></svg> {cidadeContato}</p>}
              </div>
              {whatsapp && (
                <button onClick={abrirWhatsApp}
                  style={{ marginLeft: 'auto', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <IconWhatsApp size={14} color="currentColor" />
                  <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>WhatsApp</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ padding: '0 16px' }}>
        <Timeline steps={steps} currentStatus={status} />
      </div>

      {/* Ações por papel + status */}
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* COMPRADOR: aguardando vendedor aceitar */}
        {role === 'comprador' && status === 'reservado' && (
          <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginBottom: 3, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M5 2h10M5 18h10M6 2v4l4 4-4 4v4M14 2v4l-4 4 4 4v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Aguardando o vendedor confirmar o envio
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Entre em contato pelo WhatsApp para combinar os detalhes</p>
          </div>
        )}

        {/* COMPRADOR: carta enviada, confirmar recebimento */}
        {role === 'comprador' && status === 'enviado' && (
          <button onClick={handleConfirmarRecebimento}
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', color: '#000', padding: '13px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" style={{marginRight:4}}><path d="M4 10l4.5 4.5L16 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>Confirmar que recebi a carta
          </button>
        )}

        {/* VENDEDOR: confirmar envio */}
        {role === 'vendedor' && status === 'reservado' && (
          <>
            <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#60a5fa', display:'flex', alignItems:'center', gap:4 }}><IconChat size={12} color='currentColor' />Combine a entrega pelo WhatsApp antes de confirmar o envio</p>
            </div>
            <button onClick={handleConfirmarEnvio}
              style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.35)', color: '#60a5fa', padding: '12px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}>
              <IconBox size={14} color="currentColor" />Confirmar que enviei a carta
            </button>
          </>
        )}

        {/* VENDEDOR: aguardando comprador confirmar */}
        {role === 'vendedor' && status === 'enviado' && (
          <div style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#a855f7', fontWeight: 600, marginBottom: 3, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><IconBox size={14} color="currentColor" /> Carta enviada!</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Aguardando o comprador confirmar o recebimento</p>
          </div>
        )}

        {/* Concluído — ambos */}
        {status === 'concluido' && (
          <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#22c55e', fontWeight: 700, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><svg width="14" height="14" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3"/><path d="M6.5 10l2.5 2.5 4-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>Negociação concluída!</p>
          </div>
        )}

        {/* Cancelar — só quando ainda dá */}
        {!['enviado', 'concluido', 'cancelado'].includes(status) && (
          <button onClick={handleCancelar}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', textAlign: 'center', fontFamily: 'inherit' }}>
            Cancelar negociação
          </button>
        )}
      </div>
    </div>

    {/* Modal de avaliação */}
    {showAvaliacao && (
      <AvaliacaoModal
        card={card}
        userId={userId}
        role={role}
        onClose={() => setShowAvaliacao(false)}
      />
    )}
    </>
  )
}

// ─── Tab principal ────────────────────────────────────────────────────────────

export default function NegociacoesTab({ listings, userId, onAction }: {
  listings: any[]
  userId: string | null
  onAction: () => void
}) {
  if (!userId) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', color: 'rgba(255,255,255,0.3)' }}>
      <IconShield size={40} color="rgba(255,255,255,0.15)" style={{marginBottom:12}} />
      <p>Faça login para ver suas negociações.</p>
    </div>
  )

  // Separa por papel
  const comoComprador = listings.filter(c =>
    c.buyer_id === userId &&
    !['cancelado', 'concluido'].includes(c.status || 'reservado')
  )

  const comoVendedor = listings.filter(c =>
    c.user_id === userId &&
    c.buyer_id &&
    !['cancelado', 'disponivel'].includes(c.status || 'reservado')
  )

  // Histórico (concluídas/canceladas)
  const historico = listings.filter(c =>
    (c.buyer_id === userId || c.user_id === userId) &&
    ['concluido', 'cancelado'].includes(c.status || '')
  )

  const vazio = comoComprador.length === 0 && comoVendedor.length === 0

  if (vazio && historico.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', color: 'rgba(255,255,255,0.3)' }}>
      <svg width="40" height="40" viewBox="0 0 20 20" fill="none" style={{marginBottom:16, opacity:0.15}}><path d="M3 7l4 3 3-2 3 2 4-3" stroke="white" strokeWidth="1.3" strokeLinecap="round"/><path d="M3 13l4-3 3 2 3-2 4 3" stroke="white" strokeWidth="1.3" strokeLinecap="round"/></svg>
      <p style={{ fontSize: 15 }}>Nenhuma negociação ativa.</p>
      <p style={{ fontSize: 13, marginTop: 8, color: 'rgba(255,255,255,0.2)' }}>
        Demonstre interesse em cartas na Vitrine para iniciar uma negociação.
      </p>
    </div>
  )

  const Section = ({ title, items, role }: { title: string; items: any[]; role: 'comprador' | 'vendedor' }) => (
    items.length === 0 ? null : (
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {title}
          </p>
          <span style={{ fontSize: 11, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '2px 8px', borderRadius: 100, fontWeight: 700 }}>
            {items.length}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {items.map(card => (
            <NegociacaoCard key={card.id} card={card} role={role} onAction={onAction} userId={userId || ''} />
          ))}
        </div>
      </div>
    )
  )

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Section title="Como comprador — cartas que você quer adquirir" items={comoComprador} role="comprador" />
      <Section title="Como vendedor — cartas que você está vendendo"  items={comoVendedor} role="vendedor"  />

      {/* Histórico */}
      {historico.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Histórico ({historico.length})
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14, opacity: 0.5 }}>
            {historico.map(card => (
              <NegociacaoCard
                key={card.id}
                card={card}
                role={card.buyer_id === userId ? 'comprador' : 'vendedor'}
                onAction={onAction}
                userId={userId || ''}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}