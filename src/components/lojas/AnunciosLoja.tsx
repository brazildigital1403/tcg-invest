'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { manifestarInteresse } from '@/lib/marketplaceInteresse'
import { useAppModal } from '@/components/ui/useAppModal'

const BRAND = '#f59e0b'

const VARIANTE_LABEL: Record<string, string> = {
  normal: 'Normal',
  foil: 'Foil',
  promo: 'Promo',
  reverse: 'Reverse',
  pokeball: 'Pokeball',
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)

type Anuncio = {
  id: string
  card_name: string | null
  card_image: string | null
  price: number | null
  variante: string | null
  condicao: string | null
}

const S = {
  card: { background: '#0d0f14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 } as React.CSSProperties,
  sectionTitle: { fontSize: 13, fontWeight: 700 as const, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', margin: 0 } as React.CSSProperties,
  surface: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
  ctaPill: {
    display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700,
    background: 'rgba(245,158,11,0.12)', color: BRAND, border: '1px solid rgba(245,158,11,0.3)',
    padding: '7px 14px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  } as React.CSSProperties,
  btn: {
    display: 'block', width: '100%', textAlign: 'center' as const, background: BRAND, color: '#000',
    padding: '9px', borderRadius: 10, fontWeight: 700, fontSize: 12, textDecoration: 'none',
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  } as React.CSSProperties,
}

export default function AnunciosLoja({ ownerUserId }: { ownerUserId: string | null }) {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([])
  const [carregou, setCarregou] = useState(false)
  const [logado, setLogado] = useState<boolean | null>(null)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const { openSignup } = useAuthModal()
  const { showConfirm, showAlert } = useAppModal()

  // estado de login (inicial + ao vivo)
  useEffect(() => {
    let ativo = true
    supabase.auth.getUser().then(({ data }) => {
      if (!ativo) return
      setLogado(!!data.user); setViewerId(data.user?.id ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setLogado(!!sess?.user); setViewerId(sess?.user?.id ?? null)
    })
    return () => { ativo = false; sub.subscription.unsubscribe() }
  }, [])

  // anuncios do dono da loja
  useEffect(() => {
    if (!ownerUserId) { setCarregou(true); return }
    let ativo = true
    ;(async () => {
      const { data } = await supabase
        .from('marketplace')
        .select('id, card_name, card_image, price, variante, condicao')
        .eq('user_id', ownerUserId)
        .eq('status', 'disponivel')
        .order('created_at', { ascending: false })
      if (!ativo) return
      setAnuncios((data as Anuncio[]) || [])
      setCarregou(true)
    })()
    return () => { ativo = false }
  }, [ownerUserId])

  async function clicarInteresse(card: Anuncio) {
    const ok = await showConfirm({
      message: `Manifestar interesse em "${card.card_name}" por ${fmt(Number(card.price))}?`,
      confirmLabel: 'Sim, tenho interesse',
      description: 'A carta será reservada e você poderá conversar com o vendedor pela plataforma.',
    })
    if (!ok) return
    setEnviando(card.id)
    const sucesso = await manifestarInteresse(card.id)
    if (!sucesso) {
      setEnviando(null)
      await showAlert('Não foi possível manifestar interesse. A carta pode ter sido reservada por outra pessoa.', 'warning')
    }
    // em caso de sucesso, o helper ja redireciona pro /marketplace
  }

  // esconde a secao inteira se nao ha anuncios (evita bloco vazio)
  if (!carregou || anuncios.length === 0) return null

  const ehDono = !!viewerId && viewerId === ownerUserId

  return (
    <section style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 style={S.sectionTitle}>Anúncios disponíveis ({anuncios.length})</h2>
        {logado === false && (
          <button type="button" onClick={() => openSignup()} style={S.ctaPill}>
            Cadastre-se para falar com o vendedor &rarr;
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
        {anuncios.map((card) => (
          <div key={card.id} style={S.surface}>
            {card.card_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.card_image} alt={card.card_name || ''} style={{ width: '100%', display: 'block' }} />
            ) : (
              <div style={{ paddingBottom: '140%', background: 'rgba(255,255,255,0.04)' }} />
            )}
            <div style={{ padding: '12px 14px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{card.card_name}</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 100, color: 'rgba(255,255,255,0.5)' }}>
                  {VARIANTE_LABEL[card.variante || 'normal'] || 'Normal'}
                </span>
                <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 100, color: 'rgba(255,255,255,0.5)' }}>
                  {card.condicao || 'NM'}
                </span>
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: BRAND, letterSpacing: '-0.02em', marginBottom: (logado && !ehDono) ? 10 : 2 }}>{fmt(Number(card.price))}</p>
              {logado && !ehDono && (
                <button type="button" disabled={enviando === card.id} onClick={() => clicarInteresse(card)} style={{ ...S.btn, opacity: enviando === card.id ? 0.6 : 1 }}>
                  {enviando === card.id ? 'Abrindo...' : 'Tenho interesse'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
