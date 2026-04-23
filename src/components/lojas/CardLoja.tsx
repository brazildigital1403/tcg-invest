import { CSSProperties } from 'react'
import Link from 'next/link'

// ─── Tipos (permite nulls) ────────────────────────────────────────────────────

interface LojaCard {
  id: string
  slug: string
  nome: string | null
  descricao: string | null
  cidade: string | null
  estado: string | null
  tipo: 'fisica' | 'online' | 'ambas' | null
  especialidades: string[] | null
  plano: 'basico' | 'pro' | 'premium' | null
  verificada: boolean | null
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
  // Valores seguros
  const nome = loja.nome || 'Loja sem nome'
  const especialidades = loja.especialidades || []
  const cidade = loja.cidade || ''
  const estado = loja.estado || ''
  const tipo = loja.tipo || 'online'
  const plano = loja.plano || 'basico'

  const isPremium = plano === 'premium'
  const isPro = plano === 'pro'
  const inicial = nome.trim().charAt(0).toUpperCase() || '?'
  const localizacao = [cidade, estado].filter(Boolean).join(', ') || 'Brasil'

  return (
    <Link href={`/lojas/${loja.slug}`} style={{ ...S.card, ...(isPremium ? S.cardPremium : {}) }}>
      {isPremium && <div style={S.badgePremium}>Premium</div>}
      {isPro && <div style={S.badgePro}>Pro</div>}

      {/* Header: logo + nome + verificado */}
      <div style={S.headerRow}>
        {loja.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={loja.logo_url} alt={nome} style={S.logo} />
        ) : (
          <div style={S.logoFallback}>{inicial}</div>
        )}
        <div style={S.nameBlock}>
          <div style={S.nameRow}>
            <h3 style={S.name}>{nome}</h3>
            {loja.verificada && (
              <span style={S.verifiedBadge} title="Loja verificada pelo Bynx">
                {/* SVG inline (independe de Icons.tsx) */}
                <svg width="10" height="10" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4 10l4.5 4.5L16 6" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            )}
          </div>
          <p style={S.location}>{localizacao}</p>
        </div>
      </div>

      {/* Descrição */}
      {loja.descricao && (
        <p style={S.description}>{truncate(loja.descricao, 90)}</p>
      )}

      {/* Tipo + Especialidades */}
      <div style={S.chipsRow}>
        <span style={S.typeChip}>{TIPO_LABEL[tipo] || tipo}</span>
        {especialidades.slice(0, 3).map(esp => (
          <span key={esp} style={S.chip}>
            {ESPECIALIDADE_LABEL[esp] || capitalize(esp)}
          </span>
        ))}
        {especialidades.length > 3 && (
          <span style={S.chip}>+{especialidades.length - 3}</span>
        )}
      </div>
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
    paddingRight: 60,
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
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: 'rgba(245,158,11,0.15)',
    border: '1px solid rgba(245,158,11,0.3)',
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

  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 'auto',
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