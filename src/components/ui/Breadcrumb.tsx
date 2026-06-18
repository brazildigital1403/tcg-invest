import Link from 'next/link'

type Crumb = { name: string; href: string }

const HomeIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
    aria-hidden="true"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

const Chevron = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
    aria-hidden="true"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

/**
 * Breadcrumb (Variante B "pill") — identidade Bynx no tema escuro.
 * Trilha clicavel + acessivel (nav/ol/aria-current). Os mesmos itens
 * alimentam o BreadcrumbList JSON-LD na page.tsx (visivel == structured data).
 */
export default function Breadcrumb({ items }: { items: Crumb[] }) {
  if (!items || items.length === 0) return null

  return (
    <nav aria-label="Trilha de navegação" style={{ marginBottom: 24 }}>
      <style>{`.bynx-crumb-link:hover{color:#f59e0b !important}`}</style>
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: '8px 16px',
          display: 'inline-flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 9,
          fontSize: 13,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 999,
          maxWidth: '100%',
        }}
      >
        {items.map((it, i) => {
          const isLast = i === items.length - 1
          const isHome = i === 0
          return (
            <li
              key={it.href + i}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 9, minWidth: 0 }}
            >
              {isLast ? (
                <span
                  aria-current="page"
                  style={{
                    color: '#fff',
                    fontWeight: 600,
                    borderBottom: '2px solid #f59e0b',
                    paddingBottom: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 220,
                  }}
                >
                  {isHome && (
                    <span style={{ color: '#f59e0b', display: 'inline-flex' }}>
                      <HomeIcon />
                    </span>
                  )}
                  {it.name}
                </span>
              ) : (
                <Link
                  href={it.href}
                  className="bynx-crumb-link"
                  style={{
                    color: isHome ? '#f59e0b' : 'rgba(255,255,255,0.55)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    whiteSpace: 'nowrap',
                    transition: 'color .15s',
                  }}
                >
                  {isHome && <HomeIcon />}
                  {it.name}
                </Link>
              )}
              {!isLast && (
                <span style={{ color: 'rgba(245,158,11,0.45)', display: 'inline-flex' }}>
                  <Chevron />
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
