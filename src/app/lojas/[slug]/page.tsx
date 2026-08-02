import { CSSProperties } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { supabase } from '@/lib/supabaseClient'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import GaleriaFotos from '@/components/lojas/GaleriaFotos'
import TrackedLink from '@/components/lojas/TrackedLink'
import TrackViewLoja from '@/components/lojas/TrackViewLoja'
import AnunciosLoja from '@/components/lojas/AnunciosLoja'
import ReputacaoCard from '@/components/ui/ReputacaoCard'
import { IconLocation, IconInstagram, IconFacebook, IconGlobe, IconWhatsApp, IconPokeball } from '@/components/ui/Icons'

// ─── Config ───────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Evento {
  id: string
  titulo: string
  tipo: string
  data_inicio: string
  data_fim: string | null
  recorrencia: string
  recorrencia_fim: string | null
  local: string | null
  descricao: string | null
  link: string | null
  banner: string | null
  status: string
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
  capa_url: string | null
  fotos: string[] | null
  owner_user_id: string | null
  connect_charges_enabled: boolean | null
  // eventos: campo jsonb legado (dormente). Eventos agora vêm da tabela loja_eventos.
  meta_title: string | null
  meta_description: string | null
}

interface Rating {
  media: number
  total: number
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

/**
 * Nota media do dono da loja -- mesma query/logica do card de Destaque em
 * /lojas (avaliacoes.avaliado_id = owner_user_id). So pra pintar o selo
 * inline no cabecalho; falha aqui nao pode derrubar a pagina (best effort).
 */
async function buscarRating(ownerUserId: string | null): Promise<Rating | null> {
  if (!ownerUserId) return null
  const { data } = await supabase
    .from('avaliacoes')
    .select('estrelas')
    .eq('avaliado_id', ownerUserId)
  const estrelas = (data || [])
    .map((a: { estrelas: number | null }) => a.estrelas)
    .filter((n: number | null): n is number => typeof n === 'number')
  if (estrelas.length === 0) return null
  return { media: estrelas.reduce((s, v) => s + v, 0) / estrelas.length, total: estrelas.length }
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
    `Loja de TCG${localizacao ? ` em ${localizacao}` : ''}. Confira produtos, contato e endereço no Guia de Lojas da Bynx.`

  const imagemOg = loja.capa_url || loja.logo_url

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: imagemOg ? [{ url: imagemOg, alt: nome }] : [],
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
  const msg = encodeURIComponent(`Olá! Vi sua loja "${nomeLoja}" na Bynx e tenho interesse em saber mais.`)
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

const TIPO_LABELS: Record<string, string> = {
  torneio: 'Torneio',
  liga: 'Liga',
  pre_lancamento: 'Pré-lançamento',
  encontro: 'Encontro',
  outro: 'Evento',
}

function rotuloQuando(ev: Evento): string {
  const d = new Date(ev.data_inicio)
  if (isNaN(d.getTime())) return ''
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (!ev.recorrencia || ev.recorrencia === 'nenhuma') {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) + `, ${hora}`
  }
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'long' })
  if (ev.recorrencia === 'semanal') return `Toda ${dia}, ${hora}`
  if (ev.recorrencia === 'quinzenal') return `Quinzenal · ${dia}, ${hora}`
  if (ev.recorrencia === 'mensal') return `Mensal · dia ${d.getDate()}, ${hora}`
  return hora
}

// Eventos publicados da loja (tabela loja_eventos; RLS permite leitura anônima
// só de status='publicado'). Mantém recorrentes em andamento + pontuais futuros.
async function buscarEventos(lojaId: string): Promise<Evento[]> {
  const { data } = await supabase
    .from('loja_eventos')
    .select('*')
    .eq('loja_id', lojaId)
    .eq('status', 'publicado')
    .order('data_inicio', { ascending: true })

  const linhas = (data as Evento[]) || []
  const agora = Date.now()
  const inicioHoje = new Date()
  inicioHoje.setHours(0, 0, 0, 0)

  const relevantes = linhas.filter((e) => {
    if (e.recorrencia && e.recorrencia !== 'nenhuma') {
      return !e.recorrencia_fim || new Date(e.recorrencia_fim).getTime() >= agora
    }
    const fim = e.data_fim || e.data_inicio
    return new Date(fim).getTime() >= inicioHoje.getTime()
  })

  relevantes.sort((a, b) => {
    const ra = a.recorrencia && a.recorrencia !== 'nenhuma' ? 0 : 1
    const rb = b.recorrencia && b.recorrencia !== 'nenhuma' ? 0 : 1
    if (ra !== rb) return ra - rb
    return new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime()
  })

  return relevantes
}

function Estrelas({ media }: { media: number }) {
  const cheias = Math.round(media)
  return (
    <span style={{ color: 'var(--ac-1)', letterSpacing: 1, fontSize: 13 }} aria-hidden="true">
      {'★'.repeat(cheias)}
      <span style={{ color: 'var(--bx-text-faint)' }}>{'★'.repeat(5 - cheias)}</span>
    </span>
  )
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
  const eventos        = await buscarEventos(loja.id)
  const rating         = await buscarRating(loja.owner_user_id)
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

  const temSobre      = !!loja.descricao
  const temContato    = !!(instagramUrl || facebookUrl || websiteUrl)
  const temEndereco   = !!loja.endereco && (tipo === 'fisica' || tipo === 'ambas')
  const temFotos      = fotosVisiveis.length > 0 && (isPremium || isPro)
  const temAvaliacoes = !!rating
  const temEventos    = isPremium && eventos.length > 0

  // Nav rápida sticky -- só entra pra secao que realmente vai renderizar,
  // senao o link cai num alvo vazio.
  const quicknav: { id: string; label: string }[] = []
  if (temSobre)      quicknav.push({ id: 'sobre', label: 'Sobre' })
  if (temContato)    quicknav.push({ id: 'onde-encontrar', label: 'Onde encontrar' })
  if (temEndereco)   quicknav.push({ id: 'endereco', label: 'Endereço' })
  if (temFotos)      quicknav.push({ id: 'fotos', label: 'Fotos' })
  if (temAvaliacoes) quicknav.push({ id: 'avaliacoes', label: 'Avaliações' })
  if (temEventos)    quicknav.push({ id: 'eventos', label: 'Eventos' })

  return (
    <div style={S.page}>
      <PublicHeader />
      <TrackViewLoja lojaId={loja.id} ownerUserId={loja.owner_user_id} />
      <div style={{ height: 62 }} />

      <div className="bx-gutter" style={S.breadcrumb}>
        <Link href="/lojas" style={S.breadcrumbLink}>Guia de Lojas</Link>
        <span style={S.breadcrumbSep}>/</span>
        <span style={S.breadcrumbAtual}>{nome}</span>
      </div>

      {/* ─── Capa ───────────────────────────────────────────────── */}
      <section className="loja-cover" style={S.cover}>
        {loja.capa_url ? (
          <div style={{ ...S.coverImg, backgroundImage: `url(${loja.capa_url})` }} />
        ) : (
          <div style={S.coverFallback}>
            <IconPokeball size={340} color="var(--ac-1)" strokeWidth={0.6} style={S.coverPokeball} />
          </div>
        )}
        <div style={S.coverFade} />
      </section>

      {/* ─── Identidade (sobrepõe a capa) ──────────────────────── */}
      <div className="bx-gutter" style={S.headerblock}>
        <div className="loja-hb-row">
          {loja.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={loja.logo_url} alt={nome} className="loja-logo" style={S.logo} />
          ) : (
            <div className="loja-logo loja-logo-fb" style={S.logoFallback}>{inicial}</div>
          )}

          <div className="loja-hb-actions" style={S.hbActions}>
            {instagramUrl && (
              <TrackedLink lojaId={loja.id} tipo="instagram" href={instagramUrl} target="_blank" rel="noopener noreferrer" style={S.iconBtn} title="Instagram">
                <IconInstagram size={17} color="var(--bx-text-2)" />
              </TrackedLink>
            )}
            {websiteUrl && (
              <TrackedLink lojaId={loja.id} tipo="website" href={websiteUrl} target="_blank" rel="noopener noreferrer" style={S.iconBtn} title="Site">
                <IconGlobe size={17} color="var(--bx-text-2)" />
              </TrackedLink>
            )}
            {whatsappLink && (
              <TrackedLink lojaId={loja.id} tipo="whatsapp" href={whatsappLink} target="_blank" rel="noopener noreferrer" style={S.waBtn}>
                <IconWhatsApp size={16} color="var(--bx-brand-ink)" style={{ marginRight: 8 }} />
                Falar no WhatsApp
              </TrackedLink>
            )}
          </div>
        </div>

        <div style={S.hbInfo}>
          <div style={S.nameRow}>
            <h1 style={S.heroName}>{nome}</h1>
            {loja.verificada && (
              <span style={S.verifiedBadge} title="Loja verificada pela Bynx">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4 10l4.5 4.5L16 6" stroke="#1877F2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            )}
            {isPremium && <span style={S.planoPremium}>Premium</span>}
            {isPro && <span style={S.planoPro}>Pro</span>}
          </div>

          <div style={S.metaRow}>
            {rating ? (
              <span style={S.ratingPill}>
                <Estrelas media={rating.media} /> {rating.media.toFixed(1).replace('.', ',')}
                <span style={S.ratingCount}>({rating.total})</span>
              </span>
            ) : (
              <span style={S.novoBadge}>Novo na Bynx</span>
            )}
            {localizacao && (
              <span style={S.heroLocation}>
                <IconLocation size={13} style={{ display: 'inline-block', verticalAlign: -2, marginRight: 4 }} />
                {localizacao}
              </span>
            )}
          </div>

          <div style={S.chipsRow}>
            <span style={S.typeChip}>{TIPO_LABEL[tipo] || tipo}</span>
            {especialidades.map(esp => (
              <span key={esp} style={S.chip}>
                {ESPECIALIDADE_LABEL[esp] || capitalize(esp)}
              </span>
            ))}
          </div>

          <div className="loja-mobile-actions" style={S.mobileActions}>
            {whatsappLink && (
              <TrackedLink lojaId={loja.id} tipo="whatsapp" href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ ...S.waBtn, flex: 1, justifyContent: 'center' }}>
                <IconWhatsApp size={16} color="var(--bx-brand-ink)" style={{ marginRight: 8 }} />
                Falar no WhatsApp
              </TrackedLink>
            )}
            {instagramUrl && (
              <TrackedLink lojaId={loja.id} tipo="instagram" href={instagramUrl} target="_blank" rel="noopener noreferrer" style={S.iconBtn} title="Instagram">
                <IconInstagram size={17} color="var(--bx-text-2)" />
              </TrackedLink>
            )}
            {websiteUrl && (
              <TrackedLink lojaId={loja.id} tipo="website" href={websiteUrl} target="_blank" rel="noopener noreferrer" style={S.iconBtn} title="Site">
                <IconGlobe size={17} color="var(--bx-text-2)" />
              </TrackedLink>
            )}
          </div>
        </div>
      </div>

      {/* ─── Nav rápida ─────────────────────────────────────────── */}
      {quicknav.length > 1 && (
        <nav className="bx-gutter loja-quicknav" style={S.quicknav}>
          {quicknav.map(item => (
            <a key={item.id} href={`#${item.id}`} style={S.quicknavLink}>{item.label}</a>
          ))}
        </nav>
      )}

      <main style={S.main}>
        {/* ─── Sobre + Onde encontrar ─────────────────────────── */}
        {(temSobre || temContato) && (
          <div className={temSobre && temContato ? 'loja-cols' : undefined}>
            {temSobre && (
              <section id="sobre" style={S.card}>
                <h2 style={S.sectionTitle}>Sobre a loja</h2>
                <p style={S.descricao}>{loja.descricao}</p>
              </section>
            )}
            {temContato && (
              <section id="onde-encontrar" style={S.card}>
                <h2 style={S.sectionTitle}>Onde encontrar</h2>
                <div style={S.socialGrid}>
                  {instagramUrl && (
                    <TrackedLink lojaId={loja.id} tipo="instagram" href={instagramUrl} target="_blank" rel="noopener noreferrer" style={S.socialLink}>
                      <IconInstagram size={18} />
                      <span>Instagram</span>
                    </TrackedLink>
                  )}
                  {facebookUrl && (
                    <TrackedLink lojaId={loja.id} tipo="facebook" href={facebookUrl} target="_blank" rel="noopener noreferrer" style={S.socialLink}>
                      <IconFacebook size={18} />
                      <span>Facebook</span>
                    </TrackedLink>
                  )}
                  {websiteUrl && (
                    <TrackedLink lojaId={loja.id} tipo="website" href={websiteUrl} target="_blank" rel="noopener noreferrer" style={S.socialLink}>
                      <IconGlobe size={18} />
                      <span>Website</span>
                    </TrackedLink>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ─── Endereço físico ───────────────────────────────── */}
        {temEndereco && (
          <section id="endereco" style={S.card}>
            <h2 style={S.sectionTitle}>Endereço</h2>
            <p style={S.endereco}>{loja.endereco}</p>
            {localizacao && <p style={S.enderecoCidade}>{localizacao}</p>}
            {mapsUrl && (
              <TrackedLink lojaId={loja.id} tipo="maps" href={mapsUrl} target="_blank" rel="noopener noreferrer" style={S.mapsLink}>
                Abrir no Google Maps →
              </TrackedLink>
            )}
          </section>
        )}

        {/* ─── Fotos (Pro/Premium) — com lightbox ───────────── */}
        {temFotos && (
          <section id="fotos" style={S.card}>
            <h2 style={S.sectionTitle}>Fotos</h2>
            <GaleriaFotos fotos={fotosVisiveis} nomeLoja={nome} />
          </section>
        )}

        {/* Anuncios do dono (marketplace) */}
        <AnunciosLoja ownerUserId={loja.owner_user_id} lojaId={loja.id} podeVender={!!loja.connect_charges_enabled} />

        {temAvaliacoes && (
          <div id="avaliacoes" style={S.scrollAnchor}>
            <ReputacaoCard userId={loja.owner_user_id as string} titulo="Avaliações da loja" esconderSeVazio />
          </div>
        )}

        {/* ─── Eventos (Premium only) ────────────────────────── */}
        {temEventos && (
          <section id="eventos" style={S.card}>
            <h2 style={S.sectionTitle}>Eventos e torneios</h2>
            <div style={S.eventosList}>
              {eventos.map((evento) => (
                <div key={evento.id} style={S.eventoCard}>
                  {evento.banner && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={evento.banner} alt="" style={S.eventoBanner} />
                  )}
                  <span style={S.eventoTipo}>{TIPO_LABELS[evento.tipo] || 'Evento'}</span>
                  {evento.titulo && <h3 style={S.eventoTitulo}>{evento.titulo}</h3>}
                  <p style={S.eventoData}>{rotuloQuando(evento)}</p>
                  {evento.local && <p style={S.eventoLocal}><IconLocation size={12} style={{ display: 'inline-block', verticalAlign: -2, marginRight: 3 }} />{evento.local}</p>}
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
    background: 'var(--bx-bg)',
    color: 'var(--bx-text)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },

  breadcrumb: {
    maxWidth: 1000,
    margin: '14px auto 0',
    fontSize: 12.5,
    color: 'var(--bx-text-3)',
  },
  breadcrumbLink: { color: 'var(--bx-text-3)', textDecoration: 'none' },
  breadcrumbSep: { margin: '0 6px' },
  breadcrumbAtual: { color: 'var(--bx-text-2)', fontWeight: 600 },

  // ─── Capa ─── (altura varia por breakpoint: classe .loja-cover no globals.css)
  cover: {
    position: 'relative',
    marginTop: 12,
    overflow: 'hidden',
    background: 'var(--bx-surface)',
  },
  coverImg: {
    position: 'absolute',
    inset: 0,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  },
  coverFallback: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(120% 140% at 8% 15%, rgba(245,158,11,0.16), transparent 55%),' +
      'radial-gradient(120% 140% at 95% 100%, rgba(239,68,68,0.14), transparent 55%),' +
      'var(--bx-surface)',
    overflow: 'hidden',
  },
  coverPokeball: {
    position: 'absolute',
    right: -40,
    top: '50%',
    transform: 'translateY(-50%)',
    opacity: 0.06,
  },
  coverFade: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, transparent 35%, var(--bx-bg) 100%)',
  },

  // ─── Identidade ───
  headerblock: {
    maxWidth: 1000,
    margin: '0 auto',
    position: 'relative',
    zIndex: 2,
  },
  // hbRow: display/align-items/gap/margin-top vivem na classe .loja-hb-row
  // (margin-top e align-items mudam no mobile) -- sem inline aqui de proposito.

  // logo/logoFallback: width/height/border-radius/border/font-size vivem nas
  // classes .loja-logo/.loja-logo-fb (tamanho muda no mobile).
  logo: {
    objectFit: 'cover',
    background: 'var(--bx-surface-2)',
    flexShrink: 0,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  logoFallback: {
    background: 'var(--ac-grad)',
    color: 'var(--bx-brand-ink)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    flexShrink: 0,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  hbActions: {
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
    paddingBottom: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: 'var(--bx-surface-2)',
    border: '1px solid var(--bx-border-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  waBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--ac-grad)',
    color: 'var(--bx-brand-ink)',
    fontSize: 14,
    fontWeight: 800,
    height: 38,
    padding: '0 20px',
    borderRadius: 10,
    textDecoration: 'none',
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
  },

  hbInfo: {
    padding: '14px 0 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 9,
  },
  heroName: {
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    margin: 0,
    color: 'var(--bx-text)',
  },
  verifiedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'rgba(24,119,242,0.15)',
    border: '1px solid rgba(24,119,242,0.3)',
    flexShrink: 0,
  },
  planoPremium: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '4px 8px',
    borderRadius: 6,
    background: 'var(--ac-grad)',
    color: 'var(--bx-brand-ink)',
  },
  planoPro: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '4px 8px',
    borderRadius: 6,
    background: 'rgba(245,158,11,0.15)',
    color: 'var(--ac-1)',
    border: '1px solid rgba(245,158,11,0.25)',
  },

  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
    marginTop: 8,
    fontSize: 13.5,
  },
  ratingPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontWeight: 700,
    color: 'var(--bx-text)',
  },
  ratingCount: { color: 'var(--bx-text-3)', fontWeight: 500 },
  novoBadge: {
    fontSize: 11,
    fontWeight: 700,
    background: 'rgba(96,165,250,0.12)',
    color: 'var(--bx-blue)',
    border: '1px solid rgba(96,165,250,0.25)',
    padding: '3px 9px',
    borderRadius: 100,
  },
  heroLocation: {
    display: 'inline-flex',
    alignItems: 'center',
    color: 'var(--bx-text-3)',
  },

  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  typeChip: {
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 6,
    background: 'rgba(96,165,250,0.1)',
    color: 'var(--bx-blue)',
    border: '1px solid rgba(96,165,250,0.2)',
  },
  chip: {
    fontSize: 11,
    fontWeight: 500,
    padding: '4px 10px',
    borderRadius: 6,
    background: 'var(--bx-surface-2)',
    color: 'var(--bx-text-2)',
    border: '1px solid var(--bx-border)',
  },

  // display vive na classe .loja-mobile-actions (flex so no mobile)
  mobileActions: {
    gap: 8,
    marginTop: 16,
  },

  // ─── Nav rápida ───
  quicknav: {
    position: 'sticky',
    top: 62,
    zIndex: 20,
    display: 'flex',
    gap: 22,
    padding: '12px 24px',
    background: 'rgba(8,10,15,0.92)',
    backdropFilter: 'blur(8px)',
    borderTop: '1px solid var(--bx-border)',
    borderBottom: '1px solid var(--bx-border)',
    fontSize: 13,
    fontWeight: 600,
    maxWidth: 1000,
    margin: '0 auto',
    boxSizing: 'border-box',
    overflowX: 'auto',
  },
  quicknavLink: {
    color: 'var(--bx-text-3)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },

  main: {
    maxWidth: 1000,
    margin: '0 auto',
    padding: '24px 24px 48px',
    width: '100%',
    boxSizing: 'border-box',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  // cols: display/grid-template-columns/gap vivem na classe .loja-cols
  // (1 coluna no mobile) -- sem inline aqui de proposito.
  scrollAnchor: {
    scrollMarginTop: 120,
  },

  card: {
    background: 'var(--bx-surface)',
    border: '1px solid var(--bx-border)',
    borderRadius: 16,
    padding: 22,
    scrollMarginTop: 120,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--bx-text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    margin: '0 0 14px',
  },

  descricao: {
    fontSize: 14.5,
    color: 'var(--bx-text-2)',
    lineHeight: 1.7,
    margin: 0,
    whiteSpace: 'pre-line',
  },

  socialGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  socialLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'var(--bx-surface-2)',
    border: '1px solid var(--bx-border)',
    borderRadius: 10,
    padding: '11px 14px',
    color: 'var(--bx-text-2)',
    textDecoration: 'none',
    fontSize: 13.5,
    fontWeight: 600,
    transition: 'all 0.15s ease',
  },

  endereco: {
    fontSize: 15,
    color: 'var(--bx-text-2)',
    margin: 0,
    lineHeight: 1.5,
  },
  enderecoCidade: {
    fontSize: 14,
    color: 'var(--bx-text-3)',
    margin: '4px 0 0',
  },
  mapsLink: {
    display: 'inline-block',
    marginTop: 12,
    color: 'var(--ac-1)',
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
    background: 'var(--bx-surface-2)',
    border: '1px solid var(--bx-border)',
    borderRadius: 10,
    padding: '14px 16px',
  },
  eventoTitulo: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--bx-text)',
    margin: '0 0 4px',
  },
  eventoData: {
    fontSize: 12,
    color: 'var(--ac-1)',
    fontWeight: 600,
    margin: '0 0 6px',
  },
  eventoDescricao: {
    fontSize: 13,
    color: 'var(--bx-text-2)',
    lineHeight: 1.5,
    margin: 0,
  },
  eventoLink: {
    display: 'inline-block',
    marginTop: 8,
    fontSize: 13,
    color: 'var(--ac-1)',
    fontWeight: 600,
    textDecoration: 'none',
  },
  eventoBanner: {
    width: '100%',
    maxHeight: 160,
    objectFit: 'cover',
    borderRadius: 8,
    marginBottom: 10,
    display: 'block',
  },
  eventoTipo: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ac-1)',
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.3)',
    padding: '2px 8px',
    borderRadius: 100,
    marginBottom: 6,
  },
  eventoLocal: {
    fontSize: 12,
    color: 'var(--bx-text-2)',
    margin: '0 0 6px',
  },

  backWrap: {
    marginTop: 8,
  },
  backLink: {
    color: 'var(--bx-text-3)',
    fontSize: 14,
    textDecoration: 'none',
    fontWeight: 500,
  },
}
