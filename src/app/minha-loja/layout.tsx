'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import WorldSwitcher from '@/components/ui/WorldSwitcher'

type Loja = { id: string; slug: string | null; nome: string; logo_url: string | null; status: string | null }

const LOJA_GRAD = 'linear-gradient(135deg, #60a5fa, #a855f7)'
const APP_HREF = '/minha-colecao'
const lojaAccent: React.CSSProperties = {
  ['--ac-1' as any]: '#60a5fa',
  ['--ac-2' as any]: '#a855f7',
  ['--ac-1-rgb' as any]: '96, 165, 250',
  ['--ac-2-rgb' as any]: '168, 85, 247',
  ['--ac-grad' as any]: 'linear-gradient(135deg, #60a5fa, #a855f7)',
}

// ─── Ícones inline (stroke=currentColor -> herda a cor do elemento; sem var() em atributo SVG) ───
type IcoP = { size?: number }
const Ico = ({ size = 18, children }: IcoP & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>{children}</svg>
)
const IcoVisao = (p: IcoP) => <Ico {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Ico>
const IcoAnalytics = (p: IcoP) => <Ico {...p}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-4" /><path d="M13 16V8" /><path d="M18 16v-7" /></Ico>
const IcoPlano = (p: IcoP) => <Ico {...p}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /><path d="M6 14.5h4" /></Ico>
const IcoExternal = (p: IcoP) => <Ico {...p}><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" /></Ico>
const IcoLojas = (p: IcoP) => <Ico {...p}><rect x="4" y="9" width="16" height="11" rx="1.5" /><path d="M4 9l1-4h14l1 4" /><path d="M9 20v-5h6v5" /></Ico>
const IcoSuporte = (p: IcoP) => <Ico {...p}><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /></Ico>
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

  const seg = useMemo(() => pathname.split('/').filter(Boolean), [pathname])
  const isNova = seg[1] === 'nova'
  const activeId = seg[1] && seg[1] !== 'nova' ? seg[1] : null
  const isPlano = seg[2] === 'plano'
  const isVitrine = seg[2] === 'vitrine'
  const isAnalytics = seg[2] === 'analytics'
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

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setSwitcherOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Nav por loja (opera na loja ativa) + Minhas lojas + Suporte
  const navLoja: NavDef[] = useMemo(() => {
    const items: NavDef[] = []
    if (activeLoja) {
      const base = `/minha-loja/${activeLoja.id}`
      items.push({ key: 'visao', label: 'Visão geral', href: base, Icon: IcoVisao })
      items.push({ key: 'minhavitrine', label: 'Minha vitrine', href: `${base}/vitrine`, Icon: IcoLojas })
      items.push({ key: 'analytics', label: 'Analytics', href: `${base}/analytics`, Icon: IcoAnalytics })
      items.push({ key: 'plano', label: 'Plano & cobrança', href: `${base}/plano`, Icon: IcoPlano })
      if (activeLoja.slug) items.push({ key: 'verpublica', label: 'Ver vitrine pública', href: `/lojas/${activeLoja.slug}`, Icon: IcoExternal, external: true })
    }
    return items
  }, [activeLoja])

  const isActive = (it: NavDef) => {
    if (it.external) return false
    if (it.key === 'visao') return !!activeId && !isPlano && !isVitrine && !isAnalytics
    if (it.key === 'minhavitrine') return isVitrine
    if (it.key === 'analytics') return isAnalytics
    if (it.key === 'plano') return isPlano
    return false
  }

  function selecionarLoja(l: Loja) {
    setSwitcherOpen(false)
    router.push(`/minha-loja/${l.id}`)
  }

  const minimal = isNova || (carregou && lojas.length === 0)

  // Itens completos pra nav mobile (per-loja + Minhas lojas)
  const lojasLabel = lojas.length > 1 ? 'Todas as lojas' : 'Minhas lojas'

  // ─── Sidebar (desktop) ─────────────────────────────────────────────
  const Sidebar = (
    <aside style={S.side}>
      <div style={S.brand}>
        <img src="/logo_BYNX.png" alt="Bynx" style={S.logo} />
        <span style={S.badge}>Painel da Loja</span>
      </div>

      {/* Switcher de mundo — topo, fora do menu */}
      <div style={{ padding: '2px 4px 12px' }}><WorldSwitcher current="loja" temLoja /></div>

      {!minimal && (
        <div ref={switcherRef} style={{ position: 'relative', margin: '0 4px 10px' }}>
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
        {navLoja.map((it) =>
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

        {navLoja.length > 0 && <div style={S.divider} />}

        <Link href="/minha-loja" style={{ ...S.ni, ...(isHub ? S.niOn : null) }}>
          <span style={S.niIco}><IcoLojas size={17} /></span>{lojasLabel}
        </Link>
        <Link href="/suporte" style={S.ni}>
          <span style={S.niIco}><IcoSuporte size={17} /></span>Suporte
        </Link>
      </nav>
    </aside>
  )

  // ─── Nav mobile (linha rolável de abas) ──────────────────────────────
  const MobileTabs = (
    <div className="lj-mobnav" style={S.mobnav}>
      {navLoja.map((it) =>
        it.external ? (
          <a key={it.key} href={it.href} target="_blank" rel="noopener noreferrer" style={S.mtab}>
            <it.Icon size={15} /> {it.label}
          </a>
        ) : (
          <Link key={it.key} href={it.href} style={{ ...S.mtab, ...(isActive(it) ? S.mtabOn : null) }}>
            <it.Icon size={15} /> {it.label}
          </Link>
        )
      )}
      <Link href="/minha-loja" style={{ ...S.mtab, ...(isHub ? S.mtabOn : null) }}><IcoLojas size={15} /> {lojasLabel}</Link>
      <Link href="/suporte" style={S.mtab}><IcoSuporte size={15} /> Suporte</Link>
    </div>
  )

  return (
    <div style={{ ...S.root, ...lojaAccent }}>
      <style>{`
        .lj-shell { display: grid; grid-template-columns: 250px 1fr; min-height: 100vh; }
        .lj-side { display: flex; }
        .lj-mobhead { display: none; }
        .lj-mobtop { display: none; }
        .lj-mobnav { display: none; }
        @media (max-width: 860px) {
          .lj-shell { grid-template-columns: 1fr; }
          .lj-side { display: none !important; }
          .lj-mobhead { display: block !important; position: sticky; top: 0; z-index: 21; }
          .lj-mobtop { display: flex !important; }
          .lj-mobnav { display: flex !important; }
          .lj-content { padding: 14px 16px 96px !important; }
        }
        .lj-mobnav::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="lj-shell">
        <div className="lj-side">{Sidebar}</div>

        <div className="lj-mobhead">
        {/* Top bar mobile: logo + switcher de mundo */}
        <div className="lj-mobtop" style={S.mobtop}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 22, width: 'auto', display: 'block' }} />
            <span style={{ ...S.badge, fontSize: 8.5, padding: '3px 7px' }}>Painel da Loja</span>
          </div>
          <WorldSwitcher current="loja" temLoja compact />
        </div>

        {/* Nav mobile (faltava!) */}
        {!minimal && MobileTabs}
        </div>

        <main className="lj-content" style={S.content}>{children}</main>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  root: { background: 'var(--bx-bg)', color: 'var(--bx-text)', minHeight: '100vh' },

  side: { width: '100%', borderRight: '1px solid var(--bx-border)', background: '#0a0c11', display: 'flex', flexDirection: 'column', padding: '18px 14px', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' },
  brand: { display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px 14px' },
  logo: { height: 26, width: 'auto', display: 'block' },
  badge: { fontSize: 9.5, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: '#fff', background: LOJA_GRAD, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap' },

  // switcher de mundo
  worldSeg: { display: 'flex', gap: 3, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', borderRadius: 999, padding: 3 },
  worldSegCompact: { padding: 2 },
  worldTab: { flex: 1, textAlign: 'center', padding: '7px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: 'var(--bx-text-2)', textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer' },
  worldTabOn: { background: LOJA_GRAD, color: '#fff' },

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

  mobtop: { alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: '1px solid var(--bx-border)', background: '#0a0c11' },
  mobnav: { gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--bx-border)', background: '#0a0c11', overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] },
  mtab: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: 'var(--bx-text-2)', background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 },
  mtabOn: { background: 'rgba(96,165,250,0.14)', color: '#fff', borderColor: 'rgba(96,165,250,0.3)' },

  content: { padding: '26px 30px 60px', maxWidth: 1120, width: '100%', margin: '0 auto', minWidth: 0 },
}
