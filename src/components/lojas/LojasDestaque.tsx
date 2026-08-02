import Link from 'next/link'

// ─── Tipos ──────────────────────────────────────────────────────────────────
type LojaDestaque = {
  id: string
  slug: string
  nome: string | null
  cidade: string | null
  estado: string | null
  especialidades: string[] | null
  verificada: boolean | null
  logo_url: string | null
  owner_user_id: string | null
}
type Rating = { media: number; total: number }

const ESP_LABEL: Record<string, string> = {
  pokemon: 'Pokémon', magic: 'Magic', yugioh: 'Yu-Gi-Oh', onepiece: 'One Piece',
  digimon: 'Digimon', lorcana: 'Lorcana', graduadas: 'Graduadas', singles: 'Singles',
  selados: 'Selados', acessorios: 'Acessórios',
}
const espLabel = (e: string) => ESP_LABEL[e] || (e.charAt(0).toUpperCase() + e.slice(1))

// ─── Estrelas ───────────────────────────────────────────────────────────────
function Estrelas({ media }: { media: number }) {
  const cheias = Math.round(media)
  return (
    <span style={{ color: '#f59e0b', letterSpacing: 1, fontSize: 14 }} aria-hidden="true">
      {'★'.repeat(cheias)}
      <span style={{ color: 'rgba(255,255,255,0.18)' }}>{'★'.repeat(5 - cheias)}</span>
    </span>
  )
}

// ─── Card de destaque ───────────────────────────────────────────────────────
function CardDestaque({ loja, rating }: { loja: LojaDestaque; rating?: Rating }) {
  const nome = loja.nome || 'Loja'
  const inicial = nome.trim().charAt(0).toUpperCase() || '?'
  const local = [loja.cidade, loja.estado].filter(Boolean).join(', ') || 'Brasil'
  const esps = (loja.especialidades || []).slice(0, 2)
  const temRating = !!rating && rating.total > 0

  return (
    <Link href={`/lojas/${loja.slug}`} style={S.card}>
      <div style={S.ribbon}>Destaque</div>

      <div style={S.head}>
        {loja.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={loja.logo_url} alt={nome} style={S.logo} />
        ) : (
          <div style={S.logoFallback}>{inicial}</div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={S.nameRow}>
            <span style={S.name}>{nome}</span>
            {loja.verificada && (
              <span style={S.verif} title="Loja verificada pela Bynx">
                <svg width="9" height="9" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4 10l4.5 4.5L16 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </div>
          <div style={S.loc}>
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
              <path d="M10 2c3.3 0 6 2.7 6 6 0 4-6 10-6 10S4 12 4 8c0-3.3 2.7-6 6-6z" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" />
              <circle cx="10" cy="8" r="2" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" />
            </svg>
            {local}
          </div>
        </div>
      </div>

      <div style={S.ratingRow}>
        {temRating ? (
          <>
            <Estrelas media={rating!.media} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>{rating!.media.toFixed(1).replace('.', ',')}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>({rating!.total})</span>
          </>
        ) : (
          <span style={S.novoBadge}>Novo na Bynx</span>
        )}
      </div>

      <div style={S.chips}>
        {esps.length > 0 ? (
          esps.map(e => <span key={e} style={S.chip}>{espLabel(e)}</span>)
        ) : (
          <span style={{ ...S.chip, opacity: 0.6 }}>TCG</span>
        )}
      </div>

      <span style={S.cta}>Ver loja →</span>
    </Link>
  )
}

// ─── Seção ──────────────────────────────────────────────────────────────────
export default function LojasDestaque({ lojas, ratings }: { lojas: LojaDestaque[]; ratings: Record<string, Rating> }) {
  if (!lojas || lojas.length === 0) return null

  return (
    <section style={S.section}>
      <div style={S.secHead}>
        <span style={{ color: 'var(--ac-1)', fontSize: 15, lineHeight: 1 }} aria-hidden="true">★</span>
        <h2 style={S.secTitle}>Lojas em destaque</h2>
        <span style={S.secSub}>selo Premium</span>
      </div>

      <div style={S.track}>
        {lojas.map(loja => (
          <CardDestaque key={loja.id} loja={loja} rating={ratings[loja.owner_user_id || '']} />
        ))}
      </div>
    </section>
  )
}

// ─── Estilos ────────────────────────────────────────────────────────────────
// Encolhido pra caber ao lado do grid (redesign 01/08/2026): era carrossel
// full-bleed antes dos filtros, agora entra na mesma dobra da lista de lojas.
const S: Record<string, React.CSSProperties> = {
  section: { padding: '0 0 24px', width: '100%', boxSizing: 'border-box' },
  secHead: { display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px' },
  secTitle: { fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em', margin: 0, color: 'var(--bx-text)' },
  secSub: { fontSize: 11.5, color: 'var(--bx-text-3)', marginLeft: 2 },

  track: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 },

  card: {
    position: 'relative', minWidth: 0,
    background: 'linear-gradient(180deg, rgba(245,158,11,0.07), var(--bx-bg-elev) 42%)',
    border: '1px solid rgba(245,158,11,0.4)', borderRadius: 14, padding: 16,
    boxShadow: '0 0 0 1px rgba(245,158,11,0.15), 0 10px 40px -8px rgba(245,158,11,0.18)',
    textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column',
  },
  ribbon: {
    position: 'absolute', top: 0, right: 0, background: 'var(--ac-grad)',
    color: 'var(--bx-brand-ink)', fontSize: 9, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase',
    padding: '4px 10px 4px 12px', borderRadius: '0 14px 0 10px',
  },
  head: { display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 },
  logo: { width: 46, height: 46, borderRadius: 11, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(245,158,11,0.2)' },
  logoFallback: {
    width: 46, height: 46, borderRadius: 11, background: 'var(--bx-surface-3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800,
    color: 'var(--ac-1)', flexShrink: 0, border: '1px solid rgba(245,158,11,0.2)',
  },
  nameRow: { display: 'flex', alignItems: 'center', gap: 6 },
  name: { fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--bx-text)' },
  verif: { width: 15, height: 15, borderRadius: '50%', background: '#1877F2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  loc: { fontSize: 12, color: 'var(--bx-text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 },

  ratingRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 11, minHeight: 20 },
  novoBadge: { fontSize: 11, fontWeight: 700, background: 'rgba(96,165,250,0.12)', color: 'var(--bx-blue)', border: '1px solid rgba(96,165,250,0.25)', padding: '3px 9px', borderRadius: 100 },

  chips: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, minHeight: 22 },
  chip: { fontSize: 11, fontWeight: 600, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.22)', color: '#f5c164', padding: '4px 9px', borderRadius: 100, whiteSpace: 'nowrap' },

  cta: { marginTop: 'auto', display: 'block', textAlign: 'center', background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', fontWeight: 800, fontSize: 13, padding: 10, borderRadius: 10 },
}
