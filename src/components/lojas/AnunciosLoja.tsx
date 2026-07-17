'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { manifestarInteresse } from '@/lib/marketplaceInteresse'
import { useAppModal } from '@/components/ui/useAppModal'

const BRAND = '#f59e0b'

const VARIANTE_LABEL: Record<string, string> = {
  normal: 'Normal', foil: 'Foil', promo: 'Promo', reverse: 'Reverse', pokeball: 'Pokeball',
}

const TIPO_LABEL: Record<string, string> = {
  carta: 'Cartas', selado: 'Selados', pelucia: 'Pelúcias',
  funko: 'Funkos', fichario: 'Fichários', acessorio: 'Acessórios',
}
const TIPO_ICONE: Record<string, string> = {
  carta: '🃏', selado: '📦', pelucia: '🧸', funko: '🎎', fichario: '📁', acessorio: '🎁',
}
const ORDEM_TIPO = ['carta', 'selado', 'pelucia', 'funko', 'fichario', 'acessorio']

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)

/** Item unificado da vitrine: carta (marketplace) e produto (loja_produtos). */
type Item = {
  id: string
  tipo: string
  nome: string
  imagem: string | null
  preco: number
  /** Badges: carta -> variante/condicao · produto -> estoque */
  badges: string[]
  /** Carta usa o checkout do marketplace; produto passa ?tipo=produto. */
  href: string
  ehCarta: boolean
}

const S = {
  card: { background: '#0d0f14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 } as React.CSSProperties,
  sectionTitle: { fontSize: 13, fontWeight: 700 as const, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', margin: 0 } as React.CSSProperties,
  surface: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const } as React.CSSProperties,
  ctaPill: {
    display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700,
    background: 'rgba(245,158,11,0.12)', color: BRAND, border: '1px solid rgba(245,158,11,0.3)',
    padding: '7px 14px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  } as React.CSSProperties,
  btnComprar: { background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: '#fff', border: 'none' },
  btn: {
    display: 'block', width: '100%', textAlign: 'center' as const, background: BRAND, color: '#000',
    padding: '9px', borderRadius: 10, fontWeight: 700, fontSize: 12, textDecoration: 'none',
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  } as React.CSSProperties,
  filtros: { display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 14 } as React.CSSProperties,
  chip: {
    fontSize: 11.5, fontWeight: 600, padding: '6px 12px', borderRadius: 100,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontFamily: 'inherit',
  } as React.CSSProperties,
  chipOn: { background: 'rgba(245,158,11,0.14)', borderColor: 'rgba(245,158,11,0.35)', color: BRAND } as React.CSSProperties,
  badge: { fontSize: 10, background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 100, color: 'rgba(255,255,255,0.5)' } as React.CSSProperties,
}

/**
 * Vitrine da loja: CARTAS (marketplace) + PRODUTOS (loja_produtos) no MESMO
 * grid, com filtro por tipo. O comprador nao deveria precisar saber que sao
 * duas tabelas — pra ele e tudo "coisa que essa loja vende".
 *
 * `podeVender` = a loja tem recebimentos ativos no Stripe Connect:
 *   - true  -> botao "Comprar" (checkout na hora)
 *   - false -> "Tenho interesse" nas cartas (reserva + chat). Produto sem
 *              Connect nao aparece: nao ha como negociar um selado no chat de
 *              carta, e prometer sem poder cobrar seria pior.
 */
export default function AnunciosLoja({
  ownerUserId,
  lojaId,
  podeVender = false,
}: {
  ownerUserId: string | null
  lojaId?: string | null
  podeVender?: boolean
}) {
  const [cartas, setCartas] = useState<Item[]>([])
  const [produtos, setProdutos] = useState<Item[]>([])
  const [carregou, setCarregou] = useState(false)
  const [logado, setLogado] = useState<boolean | null>(null)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<string>('tudo')
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

  // cartas do dono da loja
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
      setCartas(
        (data || []).map(c => ({
          id: c.id,
          tipo: 'carta',
          nome: c.card_name || '',
          imagem: c.card_image,
          preco: Number(c.price) || 0,
          badges: [VARIANTE_LABEL[c.variante || 'normal'] || 'Normal', c.condicao || 'NM'],
          href: `/checkout/${c.id}`,
          ehCarta: true,
        }))
      )
      setCarregou(true)
    })()
    return () => { ativo = false }
  }, [ownerUserId])

  // produtos da loja (RLS ja filtra ativo + estoque > 0)
  useEffect(() => {
    if (!lojaId || !podeVender) return
    let ativo = true
    ;(async () => {
      const { data } = await supabase
        .from('loja_produtos')
        .select('id, tipo, nome, preco_cents, estoque, fotos')
        .eq('loja_id', lojaId)
        .order('created_at', { ascending: false })
      if (!ativo) return
      setProdutos(
        (data || []).map(p => ({
          id: p.id,
          tipo: p.tipo,
          nome: p.nome,
          imagem: Array.isArray(p.fotos) && p.fotos.length ? p.fotos[0] : null,
          preco: (p.preco_cents || 0) / 100,
          badges: [p.estoque > 1 ? `${p.estoque} em estoque` : 'Última unidade'],
          href: `/checkout/${p.id}?tipo=produto`,
          ehCarta: false,
        }))
      )
    })()
    return () => { ativo = false }
  }, [lojaId, podeVender])

  const todos = useMemo(() => [...cartas, ...produtos], [cartas, produtos])

  // so mostra chip de tipo que existe (loja sem pelucia nao vê "Pelúcias")
  const tipos = useMemo(() => {
    const set = new Set(todos.map(i => i.tipo))
    return ORDEM_TIPO.filter(t => set.has(t))
  }, [todos])

  const visiveis = useMemo(
    () => (filtro === 'tudo' ? todos : todos.filter(i => i.tipo === filtro)),
    [todos, filtro]
  )

  async function clicarInteresse(item: Item) {
    const ok = await showConfirm({
      message: `Manifestar interesse em "${item.nome}" por ${fmt(item.preco)}?`,
      confirmLabel: 'Sim, tenho interesse',
      description: 'A carta será reservada e você poderá conversar com o vendedor pela plataforma.',
    })
    if (!ok) return
    setEnviando(item.id)
    const sucesso = await manifestarInteresse(item.id)
    if (!sucesso) {
      setEnviando(null)
      await showAlert('Não foi possível manifestar interesse. A carta pode ter sido reservada por outra pessoa.', 'warning')
    }
  }

  // esconde a secao inteira se nao ha nada (evita bloco vazio)
  if (!carregou || todos.length === 0) return null

  const ehDono = !!viewerId && viewerId === ownerUserId

  return (
    <section style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 style={S.sectionTitle}>À venda nesta loja ({todos.length})</h2>
        {logado === false && (
          <button type="button" onClick={() => openSignup()} style={S.ctaPill}>
            Cadastre-se para comprar &rarr;
          </button>
        )}
      </div>

      {tipos.length > 1 && (
        <div style={S.filtros}>
          <button type="button" onClick={() => setFiltro('tudo')} style={{ ...S.chip, ...(filtro === 'tudo' ? S.chipOn : {}) }}>
            Tudo ({todos.length})
          </button>
          {tipos.map(t => {
            const n = todos.filter(i => i.tipo === t).length
            return (
              <button key={t} type="button" onClick={() => setFiltro(t)} style={{ ...S.chip, ...(filtro === t ? S.chipOn : {}) }}>
                {TIPO_ICONE[t]} {TIPO_LABEL[t]} ({n})
              </button>
            )
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
        {visiveis.map(item => (
          <div key={item.id} style={S.surface}>
            {item.imagem ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imagem}
                alt={item.nome}
                style={{ width: '100%', display: 'block', aspectRatio: item.ehCarta ? undefined : '1 / 1', objectFit: item.ehCarta ? undefined : 'cover' }}
              />
            ) : (
              <div style={{ paddingBottom: '140%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 26, opacity: 0.4 }}>{TIPO_ICONE[item.tipo]}</span>
              </div>
            )}
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{item.nome}</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {!item.ehCarta && <span style={{ ...S.badge, color: BRAND }}>{TIPO_ICONE[item.tipo]} {TIPO_LABEL[item.tipo]?.replace(/s$/, '')}</span>}
                {item.badges.map((b, i) => <span key={i} style={S.badge}>{b}</span>)}
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: BRAND, letterSpacing: '-0.02em', marginBottom: (logado && !ehDono) ? 10 : 2, marginTop: 'auto' }}>
                {fmt(item.preco)}
              </p>
              {logado && !ehDono && (
                podeVender ? (
                  <a href={item.href} style={{ ...S.btn, ...S.btnComprar, textDecoration: 'none' }}>Comprar</a>
                ) : item.ehCarta ? (
                  <button type="button" disabled={enviando === item.id} onClick={() => clicarInteresse(item)} style={{ ...S.btn, opacity: enviando === item.id ? 0.6 : 1 }}>
                    {enviando === item.id ? 'Abrindo...' : 'Tenho interesse'}
                  </button>
                ) : null
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
