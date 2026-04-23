import { CSSProperties } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { supabase } from '@/lib/supabaseClient'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import GaleriaFotos from '@/components/lojas/GaleriaFotos'

// ─── Config ───────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Evento {
  titulo?: string
  data?: string
  descricao?: string
  link?: string
}

interface Loja {
  id: string
  slug: string
  nome: string | null
  descricao: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
  instagram: string | null
  facebook: string | null
  cidade: string | null
  estado: string | null
  endereco: string | null
  tipo: 'fisica' | 'online' | 'ambas' | null
  especialidades: string[] | null
  plano: 'basico' | 'pro' | 'premium' | null
  verificada: boolean | null
  logo_url: string | null
  fotos: string[] | null
  eventos: Evento[] | null
  meta_title: string | null
  meta_description: string | null
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  fisica: 'Loja física',
  online: 'Loja online',
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

// ─── Fetch da loja (helper reusado por generateMetadata e pela página) ────────

async function buscarLoja(slug: string): Promise<Loja | null> {
  const { data } = await supabase
    .from('lojas')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'ativa')
    .limit(1)
  return (data?.[0] as Loja) || null
}

// ─── SEO dinâmico ─────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const loja = await buscarLoja(slug)

  if (!loja) {
    return { title: 'Loja não encontrada', robots: { index: false, follow: false } }
  }

  const nome = loja.nome || 'Loja'
  const localizacao = [loja.cidade, loja.estado].filter(Boolean).join(', ')

  const title = loja.meta_title || `${nome}${localizacao ? ` — ${localizacao}` : ''}`
  const description =
    loja.meta_description ||
    loja.descricao ||
    `Loja de TCG${localizacao ? ` em ${localizacao}` : ''}. Confira produtos, contato e endereço no Guia de Lojas do Bynx.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: loja.logo_url ? [{ url: loja.logo_url, alt: nome }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatarWhatsAppLink(num: string | null, nomeLoja: string): string | null {
  if (!num) return null
  const digits = num.replace(/\D/g, '')
  if (digits.length < 10) return null
  const fullNumber = digits.startsWith('55') ? digits : `55${digits}`
  const msg = encodeURIComponent(`Olá! Vi sua loja "${nomeLoja}" no Bynx e tenho interesse em saber mais.`)
  return `https://wa.me/${fullNumber}?text=${msg}`
}

function normalizarUrlSocial(url: string | null): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatarData(d?: string): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return d
  }
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function LojaPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const loja = await buscarLoja(slug)

  if (!loja) notFound()

  // Valores seguros (null checks defensivos)
  const nome           = loja.nome || 'Loja sem nome'
  const especialidades = loja.especialidades || []
  const fotos          = loja.fotos || []
  const eventos        = loja.eventos || []
  const cidade         = loja.cidade || ''
  const estado         = loja.estado || ''
  const tipo           = loja.tipo || 'online'
  const plano          = loja.plano || 'basico'
  const isPremium      = plano === 'premium'
  const isPro          = plano === 'pro'

  const inicial      = nome.trim().charAt(0).toUpperCase() || '?'
  const localizacao  = [cidade, estado].filter(Boolean).join(', ')
  const whatsappLink = formatarWhatsAppLink(loja.whatsapp, nome)
  const instagramUrl = normalizarUrlSocial(loja.instagram)
  const facebookUrl  = normalizarUrlSocial(loja.facebook)
  const websiteUrl   = normalizarUrlSocial(loja.website)
  const mapsUrl      = loja.endereco
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loja.endereco}, ${cidade}, ${estado}`)}`
    : null

  // Limite de fotos por plano
  const fotosVisiveis = fotos.slice(0, isPremium ? 10 : 5)

  return (
    <div style={S.page}>
      <PublicHeader />
      <div style={{ height: 62 }} />

      {/* ─── Hero da loja ─────────────────────────────────────── */}
      <section style={{ ...S.heroWrap, ...(isPremium ? S.heroWrapPremium : {}) }}>
        <div style={S.heroInner}>
          {/* Logo */}
          {loja.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={loja.logo_url} alt={nome} style={S.heroLogo} />
          ) : (
            <div style={S.heroLogoFallback}>{inicial}</div>
          )}

          <div style={S.heroInfo}>
            <div style={S.nameRow}>
              <h1 style={S.heroName}>{nome}</h1>
              {loja.verificada && (
                <span style={S.verifiedBadge} title="Loja verificada pelo Bynx">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M4 10l4.5 4.5L16 6" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              )}
              {isPremium && <span style={S.planoPremium}>Premium</span>}
              {isPro && <span style={S.planoPro}>Pro</span>}
            </div>

            {localizacao && (
              <p style={S.heroLocation}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ marginRight: 4, verticalAlign: -2 }}>
                  <path d="M10 18s-6-5-6-10a6 6 0 1112 0c0 5-6 10-6 10z" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinejoin="round"/>
                  <circle cx="10" cy="8" r="2" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4"/>
                </svg>
                {localizacao}
              </p>
            )}

            <div style={S.chipsRow}>
              <span style={S.typeChip}>{TIPO_LABEL[tipo] || tipo}</span>
              {especialidades.map(esp => (
                <span key={esp} style={S.chip}>
                  {ESPECIALIDADE_LABEL[esp] || capitalize(esp)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main style={S.main}>
        {/* ─── CTA WhatsApp ───────────────────────────────────── */}
        {whatsappLink && (
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={S.waBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ marginRight: 8 }}>
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.26-1.38c1.45.79 3.08 1.21 4.75 1.21h.03c5.46 0 9.91-4.45 9.91-9.92 0-2.65-1.03-5.14-2.9-7.01A9.85 9.85 0 0012.04 2zm0 18.14h-.03c-1.49 0-2.96-.4-4.24-1.16l-.3-.18-3.14.82.84-3.05-.2-.32a8.22 8.22 0 01-1.26-4.34c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.83 2.41a8.2 8.2 0 012.41 5.82c0 4.55-3.7 8.23-8.22 8.23z"/>
              <path d="M16.56 14.29c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.79.97-.15.17-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.41-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.57.12.17 1.76 2.68 4.26 3.76.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.17-.48-.29z"/>
            </svg>
            Falar no WhatsApp
          </a>
        )}

        {/* ─── Descrição ──────────────────────────────────────── */}
        {loja.descricao && (
          <section style={S.card}>
            <h2 style={S.sectionTitle}>Sobre a loja</h2>
            <p style={S.descricao}>{loja.descricao}</p>
          </section>
        )}

        {/* ─── Contatos / Redes sociais ──────────────────────── */}
        {(instagramUrl || facebookUrl || websiteUrl) && (
          <section style={S.card}>
            <h2 style={S.sectionTitle}>Onde encontrar</h2>
            <div style={S.socialGrid}>
              {instagramUrl && (
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" style={S.socialLink}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <rect x="3" y="3" width="14" height="14" rx="4" stroke="currentColor" strokeWidth="1.4"/>
                    <circle cx="10" cy="10" r="3.2" stroke="currentColor" strokeWidth="1.4"/>
                    <circle cx="14.2" cy="5.8" r="0.8" fill="currentColor"/>
                  </svg>
                  <span>Instagram</span>
                </a>
              )}
              {facebookUrl && (
                <a href={facebookUrl} target="_blank" rel="noopener noreferrer" style={S.socialLink}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M12 7V5.3C12 4.6 12.2 4 13 4h1.5V1.5h-2C10.5 1.5 9 3 9 5v2H7v3h2v8h3v-8h2.2l.3-3H12z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                  </svg>
                  <span>Facebook</span>
                </a>
              )}
              {websiteUrl && (
                <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={S.socialLink}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M3 10h14M10 3c2 2.5 3 5 3 7s-1 4.5-3 7c-2-2.5-3-5-3-7s1-4.5 3-7z" stroke="currentColor" strokeWidth="1.4"/>
                  </svg>
                  <span>Website</span>
                </a>
              )}
            </div>
          </section>
        )}

        {/* ─── Endereço físico ───────────────────────────────── */}
        {loja.endereco && (tipo === 'fisica' || tipo === 'ambas') && (
          <section style={S.card}>
            <h2 style={S.sectionTitle}>Endereço</h2>
            <p style={S.endereco}>{loja.endereco}</p>
            {localizacao && <p style={S.enderecoCidade}>{localizacao}</p>}
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={S.mapsLink}>
                Abrir no Google Maps →
              </a>
            )}
          </section>
        )}

        {/* ─── Fotos (Pro/Premium) — com lightbox ───────────── */}
        {fotosVisiveis.length > 0 && (isPremium || isPro) && (
          <section style={S.card}>
            <h2 style={S.sectionTitle}>Fotos</h2>
            <GaleriaFotos fotos={fotosVisiveis} nomeLoja={nome} />
          </section>
        )}

        {/* ─── Eventos (Premium only) ────────────────────────── */}
        {isPremium && eventos.length > 0 && (
          <section style={S.card}>
            <h2 style={S.sectionTitle}>Eventos e torneios</h2>
            <div style={S.eventosList}>
              {eventos.map((evento, i) => (
                <div key={i} style={S.eventoCard}>
                  {evento.titulo && <h3 style={S.eventoTitulo}>{evento.titulo}</h3>}
                  {evento.data && <p style={S.eventoData}>{formatarData(evento.data)}</p>}
                  {evento.descricao && <p style={S.eventoDescricao}>{evento.descricao}</p>}
                  {evento.link && (
                    <a href={normalizarUrlSocial(evento.link) || '#'} target="_blank" rel="noopener noreferrer" style={S.eventoLink}>
                      Saber mais →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Voltar ───────────────────────────────────────── */}
        <div style={S.backWrap}>
          <Link href="/lojas" style={S.backLink}>
            ← Voltar para o Guia de Lojas
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#080a0f',
    color: '#f0f0f0',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },

  heroWrap: {
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    padding: '48px 24px 40px',
  },
  heroWrapPremium: {
    background: 'linear-gradient(180deg, rgba(245,158,11,0.06), rgba(8,10,15,0) 60%)',
  },
  heroInner: {
    maxWidth: 900,
    margin: '0 auto',
    display: 'flex',
    gap: 24,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  heroLogo: {
    width: 96,
    height: 96,
    borderRadius: 18,
    objectFit: 'cover',
    background: 'rgba(255,255,255,0.05)',
    flexShrink: 0,
  },
  heroLogoFallback: {
    width: 96,
    height: 96,
    borderRadius: 18,
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    color: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 44,
    fontWeight: 800,
    flexShrink: 0,
  },
  heroInfo: {
    flex: 1,
    minWidth: 260,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroName: {
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    margin: 0,
    color: '#f0f0f0',
  },
  verifiedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'rgba(245,158,11,0.15)',
    border: '1px solid rgba(245,158,11,0.3)',
    flexShrink: 0,
  },
  planoPremium: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '4px 8px',
    borderRadius: 6,
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    color: '#000',
  },
  planoPro: {
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
  heroLocation: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    margin: 0,
  },

  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
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

  main: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '32px 24px 48px',
    width: '100%',
    boxSizing: 'border-box',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },

  waBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    color: '#000',
    fontSize: 15,
    fontWeight: 700,
    padding: '14px 28px',
    borderRadius: 12,
    textDecoration: 'none',
    letterSpacing: '-0.01em',
  },

  card: {
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    margin: '0 0 14px',
  },

  descricao: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.7,
    margin: 0,
    whiteSpace: 'pre-line',
  },

  socialGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 10,
  },
  socialLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '12px 14px',
    color: 'rgba(255,255,255,0.75)',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.12s ease',
  },

  endereco: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    margin: 0,
    lineHeight: 1.5,
  },
  enderecoCidade: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    margin: '4px 0 0',
  },
  mapsLink: {
    display: 'inline-block',
    marginTop: 12,
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
  },

  eventosList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  eventoCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: '14px 16px',
  },
  eventoTitulo: {
    fontSize: 15,
    fontWeight: 700,
    color: '#f0f0f0',
    margin: '0 0 4px',
  },
  eventoData: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: 600,
    margin: '0 0 6px',
  },
  eventoDescricao: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.5,
    margin: 0,
  },
  eventoLink: {
    display: 'inline-block',
    marginTop: 8,
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: 600,
    textDecoration: 'none',
  },

  backWrap: {
    marginTop: 8,
  },
  backLink: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textDecoration: 'none',
    fontWeight: 500,
  },
}