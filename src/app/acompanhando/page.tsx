'use client'

/**
 * src/app/acompanhando/page.tsx
 *
 * Página da watchlist (Fase 1). Lista as cartas que o usuário acompanha,
 * com preço atual e variação de ~7 dias. Fica no grupo "Minha Coleção".
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/ui/AppLayout'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { IconBell, IconClose } from '@/components/ui/Icons'

type Item = {
  card_id: string
  name: string
  set_name: string | null
  image_small: string | null
  preco_medio: number | null
  pct: number | null
}

const brl = (v: number) =>
  `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

const pctFmt = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')}%`

function cleanName(raw: string | null): string {
  if (!raw) return ''
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/\s*\(\d+\/\d+\)\s*$/, '')
    .trim()
}

export default function AcompanhandoPage() {
  const { openLogin } = useAuthModal()
  const [loaded, setLoaded] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id ?? null
      if (!active) return
      setUserId(uid)
      if (!uid) {
        setLoaded(true)
        return
      }

      const { data, error } = await supabase.rpc('get_watchlist')
      if (!active) return
      if (error) {
        setItems([])
        setLoaded(true)
        return
      }

      const built: Item[] = (data || []).map((r: any) => ({
        card_id: r.card_id,
        name: cleanName(r.name),
        set_name: r.set_name,
        image_small: r.image_small,
        preco_medio: r.preco_medio != null ? Number(r.preco_medio) : null,
        pct: r.pct != null ? Number(r.pct) : null,
      }))

      if (active) { setItems(built); setLoaded(true) }
    })()
    return () => { active = false }
  }, [])

  async function remover(cardId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!userId) return
    setItems((prev) => prev.filter((i) => i.card_id !== cardId))
    await supabase.from('watchlist').delete().eq('user_id', userId).eq('card_id', cardId)
  }

  return (
    <AppLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 18px 60px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.13)', border: '1px solid rgba(245,158,11,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flex: '0 0 auto' }}>
            <IconBell size={22} color="#f59e0b" />
          </span>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>Acompanhando</h1>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              {loaded && userId ? `${items.length} ${items.length === 1 ? 'carta que você acompanha' : 'cartas que você acompanha'}` : 'Acompanhe o preço das cartas que te interessam'}
            </div>
          </div>
        </div>

        {!loaded && (
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, padding: '40px 0' }}>Carregando…</div>
        )}

        {loaded && !userId && (
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '34px 26px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Entre para acompanhar preços</div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: '0 0 18px' }}>Crie sua conta gratuita e receba alertas quando o preço de uma carta variar.</p>
            <button onClick={() => openLogin({ next: '/acompanhando' })} style={{ font: 'inherit', fontSize: 14, fontWeight: 700, padding: '11px 22px', borderRadius: 11, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#000' }}>
              Entrar
            </button>
          </div>
        )}

        {loaded && userId && items.length === 0 && (
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '40px 26px', textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🔔</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Você ainda não acompanha nenhuma carta</div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: '0 0 18px' }}>Abra qualquer carta e toque em <strong style={{ color: '#f59e0b' }}>Acompanhar preço</strong> para vê-la aqui.</p>
            <Link href="/pokedex" style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', textDecoration: 'none' }}>Explorar cartas →</Link>
          </div>
        )}

        {loaded && userId && items.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
            {items.map((it) => (
              <Link key={it.card_id} href={`/carta/${it.card_id}`} style={{ position: 'relative', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ position: 'relative', background: '#0c0f17', height: 178, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                  {it.image_small && <img src={it.image_small} alt={it.name} loading="lazy" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: 6 }} />}
                  <button onClick={(e) => remover(it.card_id, e)} title="Deixar de acompanhar" style={{ position: 'absolute', top: 7, left: 7, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                    <IconClose size={13} color="rgba(255,255,255,0.8)" />
                  </button>
                  {it.pct != null && (
                    <span style={{ position: 'absolute', top: 7, right: 7, fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 20, color: '#fff', background: it.pct > 0 ? '#16a34a' : '#dc2626' }}>
                      {pctFmt(it.pct)}
                    </span>
                  )}
                </div>
                <div style={{ padding: '9px 12px 13px' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '1px 0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.set_name || ''}</div>
                  {it.preco_medio != null && <div style={{ fontSize: 15, fontWeight: 800, color: '#f59e0b' }}>{brl(it.preco_medio)}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </AppLayout>
  )
}
