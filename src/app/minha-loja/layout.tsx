'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Loja = { id: string; slug: string | null; nome: string; logo_url: string | null; status: string | null }

const LOJA_GRAD = 'linear-gradient(135deg, #60a5fa, #a855f7)'
const APP_HREF = '/minha-colecao'

// ─── Ícones inline (stroke=currentColor -> herda a cor do elemento; sem var() em atributo SVG) ───
type IcoP = { size?: number }
const Ico = ({ size = 18, children }: IcoP & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>{children}</svg>
)
const IcoVisao = (p: IcoP) => <Ico {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Ico>
const IcoVitrine = (p: IcoP) => <Ico {...p}><path d="M3 9l1.5-5h15L21 9" /><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" /><path d="M3 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 3 0" /></Ico>
const IcoAnalytics = (p: IcoP) => <Ico {...p}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-4" /><path d="M13 16V8" /><path d="M18 16v-7" /></Ico>
const IcoPlano = (p: IcoP) => <Ico {...p}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /><path d="M6 14.5h4" /></Ico>
const IcoExternal = (p: IcoP) => <Ico {...p}><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" /></Ico>
const IcoLojas = (p: IcoP) => <Ico {...p}><rect x="4" y="9" width="16" height="11" rx="1.5" /><path d="M4 9l1-4h14l1 4" /><path d="M9 20v-5h6v5" /></Ico>
const IcoSuporte = (p: IcoP) => <Ico {...p}><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /></Ico>
const IcoBack = (p: IcoP) => <Ico {...p}><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></Ico>
const IcoChevron = (p: IcoP) => <Ico {...p}><path d="M6 9l6 6 6-6" /></Ico>
const IcoPlus = (p: IcoP) => <Ico {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Ico>

type NavDef = { key: string; label: string; href: string; Icon: (p: IcoP) => React.ReactElement; external?: boolean }

export default function MinhaLojaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const router = useRouter()
  const [lojas, setLojas] = useState<Loja[]>([])
  const [carregou, setCarregou] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement | null>(null)

  // Contexto da rota
  const seg = useMemo(() => pathname.split('/').filter(Boolean), [pathname])
  const isNova = seg[1] === 'nova'
  const activeId = seg[1] && seg[1] !== 'nova' ? seg[1] : null
  const isPlano = seg[2] === 'plano'
  const isHub = pathname === '/minha-loja'
  const activeLoja = useMemo(() => lojas.find((l) => l.id === activeId) || null, [lojas, activeId])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (alive) setCarregou(true); return }
        const { data } = await supabase
          .from('lojas')
          .select('id, slug, nome, logo_url, status')
          .eq('owner_user_id', user.id)
          .order('created_at', { ascending: true })
        if (alive) { setLojas((data as Loja[]) || []); setCarregou(true) }
      } catch { if (alive) setCarregou(true) }
    })()
    return () => { alive = false }
  }, [])

  // Fecha o seletor ao clicar fora
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setSwitcherOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Nav por loja (opera na loja ativa). Some na /nova e quando ainda nao ha loja selecionada.
  const navLoja: NavDef[] = useMemo(() => {
    if (!activeLoja) return []
    const base = `/minha-loja/${activeLoja.id}`
    const items: NavDef[] = [
      { key: 'visao', label: 'Visão geral', href: base, Icon: IcoVisao },
      { key: 'plano', label: 'Plano & cobrança', href: `${base}/plano`, Icon: IcoPlano },
    ]
    if (activeLoja.slug) items.push({ key: 'vitrine', label: 'Ver vitrine pública', href: `/lojas/${activeLoja.slug}`, Icon: IcoExternal, external: true })
    return items
  }, [activeLoja])

  const isActive = (it: NavDef) => {
    if (it.external) return false
    if (it.key === 'visao') return !!activeId && !isPlano
    if (it.key === 'plano') return isPlano
    return false
  }

  function selecionarLoja(l: Loja) {
    setSwitcherOpen(false)
    router.push(`/minha-loja/${l.id}`)
  }

  const minimal = isNova || (carregou && lojas.length === 0)

  // ─── Sidebar ─────────────────────────────────────────────
  const Sidebar = (
    <aside style={S.side}>
      <div style={S.brand}>
        <img src="/logo_BYNX.png" alt="Bynx" style={S.logo} />
        <span style={S.badge}>Painel da Loja</span>
      </div>

      {!minimal && (
        <div ref={switcherRef} style={{ position: 'relative', margin: '6px 4px 10px' }}>
          <button style={S.switcher} onClick={() => setSwitcherOpen((v) => !v)}>
            <span style={S.swAv}>{(activeLoja?.nome || 'L').charAt(0).toUpperCase()}</span>
            <span style={S.swName}>{activeLoja?.nome || 'Minhas lojas'}</span>
            <span style={{ color: 'var(--bx-text-3)', display: 'flex' }}><IcoChevron size={15} /></span>
          </button>
          {switcherOpen && (
            <div style={S.swMenu}>
              {lojas.map((l) => (
                <button key={l.id} style={{ ...S.swItem, ...(l.id === activeId ? S.swItemOn : null) }} onClick={() => selecionarLoja(l)}>
                  <span style={S.swAvSm}>{l.nome.charAt(0).toUpperCase()}</span>
                  <span style={S.swItemName}>{l.nome}</span>
                </button>
              ))}
              <Link href="/minha-loja/nova" style={S.swNova} onClick={() => setSwitcherOpen(false)}>
                <IcoPlus size={15} /> Cadastrar outra loja
              </Link>
            </div>
          )}
        </div>
      )}

      <nav style={S.nav}>
        {!minimal && navLoja.map((it) =>
          it.external ? (
            <a key={it.key} href={it.href} target="_blank" rel="noopener noreferrer" style={S.ni}>
              <span style={S.niIco}><it.Icon size={17} /></span>{it.label}
            </a>
          ) : (
            <Link key={it.key} href={it.href} style={{ ...S.ni, ...(isActive(it) ? S.niOn : null) }}>
              <span style={S.niIco}><it.Icon size={17} /></span>{it.label}
            </Link>
          )
        )}

        {!minimal && <div style={S.divider} />}

        <Link href="/minha-loja" style={{ ...S.ni, ...(isHub ? S.niOn : null) }}>
          <span style={S.niIco}><IcoLojas size={17} /></span>{lojas.length > 1 ? 'Todas as minhas lojas' : 'Minhas lojas'}
        </Link>
        <Link href="/suporte" style={S.ni}>
          <span style={S.niIco}><IcoSuporte size={17} /></span>Suporte
        </Link>

        <Link href={APP_HREF} style={{ ...S.ni, ...S.back }}>
          <span style={S.niIco}><IcoBack size={17} /></span>Voltar ao app
        </Link>
      </nav>
    </aside>
  )

  return (
    <div style={S.root}>
      <style>{`
        .lj-shell { display: grid; grid-template-columns: 250px 1fr; min-height: 100vh; }
        .lj-side { display: flex; }
        .lj-topbar { display: none; }
        @media (max-width: 860px) {
          .lj-shell { grid-template-columns: 1fr; }
          .lj-side { display: none !important; }
          .lj-topbar { display: flex !important; }
          .lj-content { padding: 16px 16px 96px !important; }
        }
      `}</style>

      <div className="lj-shell">
        <div className="lj-side">{Sidebar}</div>

        {/* Top bar mobile */}
        <div className="lj-topbar" style={S.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 24, width: 'auto', display: 'block' }} />
            <span style={{ ...S.badge, fontSize: 9 }}>Painel da Loja</span>
          </div>
          <Link href={APP_HREF} style={S.topBack}><IcoBack size={15} /> App</Link>
        </div>

        <main className="lj-content" style={S.content}>{children}</main>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  root: { background: 'var(--bx-bg)', color: 'var(--bx-text)', minHeight: '100vh' },

  side: { width: '100%', borderRight: '1px solid var(--bx-border)', background: '#0a0c11', display: 'flex', flexDirection: 'column', padding: '18px 14px', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' },
  brand: { display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px 16px' },
  logo: { height: 26, width: 'auto', display: 'block' },
  badge: { fontSize: 9.5, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: '#fff', background: LOJA_GRAD, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap' },

  switcher: { width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '10px 11px', border: '1px solid var(--bx-border-2)', borderRadius: 11, background: 'var(--bx-surface-2)', color: 'var(--bx-text)', cursor: 'pointer', textAlign: 'left' },
  swAv: { width: 26, height: 26, borderRadius: 7, background: LOJA_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#fff', flexShrink: 0 },
  swName: { fontSize: 13, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  swMenu: { position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--bx-bg-elev)', border: '1px solid var(--bx-border-2)', borderRadius: 12, padding: 6, zIndex: 30, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' },
  swItem: { width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9, background: 'transparent', border: 0, color: 'var(--bx-text-2)', cursor: 'pointer', textAlign: 'left' },
  swItemOn: { background: 'rgba(96,165,250,0.12)', color: '#fff' },
  swItemName: { fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  swAvSm: { width: 22, height: 22, borderRadius: 6, background: 'var(--bx-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, color: 'var(--bx-text)', flexShrink: 0 },
  swNova: { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', marginTop: 4, borderTop: '1px solid var(--bx-border)', color: '#60a5fa', fontSize: 12.5, fontWeight: 700, textDecoration: 'none' },

  nav: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  ni: { display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 10, color: 'var(--bx-text-2)', fontSize: 13.5, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' },
  niOn: { background: 'rgba(96,165,250,0.12)', color: '#fff', boxShadow: 'inset 2px 0 0 #60a5fa' },
  niIco: { width: 17, height: 17, flex: '0 0 17px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, background: 'var(--bx-border)', margin: '12px 4px' },
  back: { marginTop: 'auto', color: 'var(--bx-text-2)' },

  topbar: { alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--bx-border)', background: '#0a0c11', position: 'sticky', top: 0, zIndex: 20 },
  topBack: { display: 'flex', alignItems: 'center', gap: 6, color: 'var(--bx-text)', fontSize: 13, fontWeight: 700, textDecoration: 'none', background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', padding: '7px 12px', borderRadius: 9 },

  content: { padding: '26px 30px 60px', maxWidth: 1120, width: '100%', margin: '0 auto', minWidth: 0 },
}
