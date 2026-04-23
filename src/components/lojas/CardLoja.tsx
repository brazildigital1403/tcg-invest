import { CSSProperties } from 'react'
import Link from 'next/link'
import { Metadata } from 'next'
import { supabase } from '@/lib/supabaseClient'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import CardLoja from '@/components/lojas/CardLoja'
import FiltrosGuia from '@/components/lojas/FiltrosGuia'

// ─── Config ───────────────────────────────────────────────────────────────────

export const revalidate = 60 // ISR: cache por 60s

interface SearchParams {
  q?: string
  estado?: string
  tipo?: string
  especialidade?: string
}

// ─── SEO dinâmico ─────────────────────────────────────────────────────────────

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<SearchParams> }
): Promise<Metadata> {
  const sp = await searchParams
  const partes: string[] = ['Guia de Lojas de TCG']
  if (sp.especialidade) partes[0] = `Lojas de ${capitalize(sp.especialidade)}`
  if (sp.estado) partes.push(`em ${sp.estado}`)

  const title = partes.join(' ')
  const description =
    'Encontre as melhores lojas de TCG do Brasil. Pokémon, Magic, Yu-Gi-Oh, Lorcana e mais. Lojas físicas e online.'

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface LojaCard {
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

const ORDEM_PLANO: Record<string, number> = { premium: 0, pro: 1, basico: 2 }

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function LojasPage(
  { searchParams }: { searchParams: Promise<SearchParams> }
) {
  const sp = await searchParams

  // Monta query
  let query = supabase
    .from('lojas')
    .select('id, slug, nome, descricao, cidade, estado, tipo, especialidades, plano, verificada, logo_url')
    .eq('status', 'ativa')
    .limit(200)

  if (sp.q?.trim())             query = query.ilike('nome', `%${sp.q.trim()}%`)
  if (sp.estado?.trim())        query = query.eq('estado', sp.estado.trim().toUpperCase())
  if (sp.tipo?.trim())          query = query.eq('tipo', sp.tipo.trim())
  if (sp.especialidade?.trim()) query = query.contains('especialidades', [sp.especialidade.trim()])

  const { data, error } = await query
  const lojas: LojaCard[] = (data || []) as LojaCard[]

  // Ordenação: premium > pro > basico, depois verificadas primeiro
  lojas.sort((a, b) => {
    const diff = (ORDEM_PLANO[a.plano] ?? 99) - (ORDEM_PLANO[b.plano] ?? 99)
    if (diff !== 0) return diff
    if (a.verificada !== b.verificada) return a.verificada ? -1 : 1
    return 0
  })

  const totalResultados = lojas.length
  const temFiltro = !!(sp.q || sp.estado || sp.tipo || sp.especialidade)

  return (
    <div style={S.page}>
      <PublicHeader />

      {/* Spacer pro header fixed (62px) */}
      <div style={{ height: 62 }} />

      {/* ─── Hero ───────────────────────────────────────────────── */}
      <section style={S.hero}>
        <h1 style={S.heroTitle}>Guia de Lojas</h1>
        <p style={S.heroSubtitle}>
          Encontre lojas de TCG do Brasil. Físicas e online, com especialidade em Pokémon, Magic, Yu-Gi-Oh e mais.
        </p>
      </section>

      {/* ─── Filtros ────────────────────────────────────────────── */}
      <FiltrosGuia
        initialQ={sp.q || ''}
        initialEstado={sp.estado || ''}
        initialTipo={sp.tipo || ''}
        initialEspecialidade={sp.especialidade || ''}
      />

      {/* ─── Resultados ─────────────────────────────────────────── */}
      <section style={S.resultsSection}>
        {error && (
          <div style={S.errorBox}>
            Erro ao carregar lojas. Tente recarregar a página.
          </div>
        )}

        {!error && (
          <>
            <p style={S.resultCount}>
              {totalResultados === 0
                ? (temFiltro ? 'Nenhuma loja encontrada para esses filtros.' : 'Nenhuma loja cadastrada ainda.')
                : `${totalResultados} ${totalResultados === 1 ? 'loja encontrada' : 'lojas encontradas'}`}
            </p>

            {totalResultados > 0 && (
              <div style={S.grid}>
                {lojas.map(loja => (
                  <CardLoja key={loja.id} loja={loja} />
                ))}
              </div>
            )}

            {totalResultados === 0 && temFiltro && (
              <Link href="/lojas" style={S.clearFiltersLink}>
                Limpar filtros
              </Link>
            )}
          </>
        )}
      </section>

      {/* ─── CTA Lojista ────────────────────────────────────────── */}
      <section style={S.ctaSection}>
        <div style={S.ctaBox}>
          <h2 style={S.ctaTitle}>Tem uma loja de TCG?</h2>
          <p style={S.ctaSubtitle}>
            Seja encontrado por milhares de colecionadores brasileiros. Comece grátis.
          </p>
          <Link href="/minha-loja" style={S.ctaButton}>
            Cadastrar minha loja →
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
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

  hero: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '64px 24px 32px',
    textAlign: 'center',
    width: '100%',
    boxSizing: 'border-box',
  },
  heroTitle: {
    fontSize: 44,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    margin: 0,
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    margin: '12px auto 0',
    maxWidth: 580,
    lineHeight: 1.6,
  },

  resultsSection: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '20px 24px 48px',
    width: '100%',
    boxSizing: 'border-box',
    flex: 1,
  },
  resultCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    margin: '0 0 20px',
    fontWeight: 500,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  errorBox: {
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 12,
    padding: 16,
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  clearFiltersLink: {
    display: 'inline-block',
    marginTop: 16,
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
  },

  ctaSection: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '24px 24px 64px',
    width: '100%',
    boxSizing: 'border-box',
  },
  ctaBox: {
    background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.08))',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: 20,
    padding: '40px 28px',
    textAlign: 'center',
  },
  ctaTitle: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    margin: 0,
    color: '#f0f0f0',
  },
  ctaSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    margin: '8px 0 24px',
    lineHeight: 1.5,
  },
  ctaButton: {
    display: 'inline-block',
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    color: '#000',
    fontSize: 14,
    fontWeight: 700,
    padding: '12px 28px',
    borderRadius: 10,
    textDecoration: 'none',
    letterSpacing: '-0.01em',
  },
}