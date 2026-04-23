import { CSSProperties } from 'react'
import Link from 'next/link'

// ─── Tipos (espelham src/app/lojas/page.tsx) ──────────────────────────────────

interface LojaCard {
  id: string
  slug: string
  nome: string
  descricao: string | null
  cidade: string
  estado: string
  tipo: 'fisica' | 'online' | 'ambas'
  especialidades: string[]
  plano: 'basico' | 'pro' | 'premium'
  verificada: boolean
  logo_url: string | null
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  fisica: 'Física',
  online: 'Online',
  ambas: 'Física + Online',
}

const ESPECIALIDADE_LABEL: Record<string, string> = {
  pokemon: 'Pokémon',
  magic: 'Magic',
  yugioh: 'Yu-Gi-Oh!',
  lorcana: 'Lorcana',
  digimon: 'Digimon',
  outros: 'Outros',
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function CardLoja({ loja }: { loja: LojaCard }) {
  const isPremium = loja.plano === 'premium'
  const isPro = loja.plano === 'pro'

  // Cor da inicial (fallback quando não tem logo): hash simples do nome
  const inicial = loja.nome.trim().charAt(0).toUpperCase() || '?'

  return (
    <Link href={`/lojas/${loja.slug}`} style={{ ...S.card, ...(isPremium ? S.cardPremium : {}) }}>
      {/* Badge de plano (só Premium/Pro) */}
      {isPremium && <div style={S.badgePremium}>Premium</div>}
      {isPro && <div style={S.badgePro}>Pro</div>}

      {/* Header: logo + nome + verificado */}
      <div style={S.headerRow}>
        {loja.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={loja.logo_url} alt={loja.nome} style={S.logo} />
        ) : (
          <div style={S.logoFallback}>{inicial}</div>
        )}
        <div style={S.nameBlock}>
          <div style={S.nameRow}>
            <h3 style={S.name}>{loja.nome}</h3>
            {loja.verificada && (
              <span style={S.verifiedBadge} title="Loja verificada pelo Bynx">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2.5 4.5L20 8l-4 4 1 6-5-2.5L7 18l1-6-4-4 5.5-1.5z" />
                </svg>
              </span>
            )}
          </div>
          <p style={S.location}>{loja.cidade}, {loja.estado}</p>
        </div>
      </div>

      {/* Descrição (se houver) */}
      {loja.descricao && (
        <p style={S.description}>{truncate(loja.descricao, 90)}</p>
      )}

      {/* Tipo */}
      <div style={S.metaRow}>
        <span style={S.typeChip}>{TIPO_LABEL[loja.tipo] || loja.tipo}</span>
      </div>

      {/* Especialidades */}
      {loja.especialidades.length > 0 && (
        <div style={S.chipsRow}>
          {loja.especialidades.slice(0, 4).map(esp => (
            <span key={esp} style={S.chip}>
              {ESPECIALIDADE_LABEL[esp] || capitalize(esp)}
            </span>
          ))}
          {loja.especialidades.length > 4 && (
            <span style={S.chip}>+{loja.especialidades.length - 4}</span>
          )}
        </div>
      )}
    </Link>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…'
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  card: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 20,
    textDecoration: 'none',
    color: 'inherit',
    transition: 'all 0.18s ease',
    overflow: 'hidden',
  },
  cardPremium: {
    border: '1px solid rgba(245,158,11,0.35)',
    background: 'linear-gradient(180deg, rgba(245,158,11,0.04), #0d0f14 40%)',
    boxShadow: '0 0 0 1px rgba(245,158,11,0.12), 0 8px 24px rgba(245,158,11,0.06)',
  },

  badgePremium: {
    position: 'absolute',
    top: 12,
    right: 12,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '4px 8px',
    borderRadius: 6,
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    color: '#000',
  },
  badgePro: {
    position: 'absolute',
    top: 12,
    right: 12,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '4px 8px',
    borderRadius: 6,
    background: 'rgba(245,158,11,0.15)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.25)',
  },

  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingRight: 60, // espaço pro badge de plano
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    objectFit: 'cover',
    background: 'rgba(255,255,255,0.05)',
    flexShrink: 0,
  },
  logoFallback: {
    width: 48,
    height: 48,
    borderRadius: 10,
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    color: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    fontWeight: 800,
    flexShrink: 0,
  },
  nameBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: '#f0f0f0',
  },
  verifiedBadge: {
    color: '#f59e0b',
    display: 'inline-flex',
    flexShrink: 0,
  },
  location: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    margin: 0,
  },

  description: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    margin: 0,
    lineHeight: 1.5,
  },

  metaRow: {
    display: 'flex',
    gap: 6,
  },
  typeChip: {
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 6,
    background: 'rgba(96,165,250,0.1)',
    color: '#60a5fa',
    border: '1px solid rgba(96,165,250,0.2)',
  },

  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 'auto',
  },
  chip: {
    fontSize: 11,
    fontWeight: 500,
    padding: '4px 10px',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.6)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
}