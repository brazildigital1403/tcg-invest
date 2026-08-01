import { CSSProperties } from 'react'
import { unstable_cache } from 'next/cache'
import Link from 'next/link'
import { Metadata } from 'next'
import { supabase } from '@/lib/supabaseClient'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import CardLoja from '@/components/lojas/CardLoja'
import LojasDestaque from '@/components/lojas/LojasDestaque'
import FiltrosGuia from '@/components/lojas/FiltrosGuia'

// ─── Config ───────────────────────────────────────────────────────────────────

// A rota usa searchParams (filtros), entao renderiza dinamica de qualquer jeito
// — tirar o force-dynamic nao cachearia a PAGINA. Quem estava custando os
// ~1.056ms medidos em 28/07/2026 eram as duas idas ao banco em toda visita.
//
// Como sao 7 lojas ativas e 2 avaliacoes no total, buscar TUDO uma vez e
// filtrar em memoria sai mais barato que uma query por combinacao de filtro.
export const dynamic = 'force-dynamic'

/**
 * Lojas ativas + notas dos donos premium, em uma unica entrada de cache.
 *
 * Regra da casa: dentro de unstable_cache, falha NUNCA vira `return []` —
 * vazio viraria entrada valida e ficaria servido ate o revalidate. Sempre
 * `throw`, assim nada e gravado e a proxima request tenta de novo.
 */
const getLojasAtivas = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from('lojas')
      .select('id, slug, nome, descricao, cidade, estado, tipo, especialidades, plano, verificada, logo_url, owner_user_id')
      .eq('status', 'ativa')
      .limit(200)
    if (error) throw new Error(`[/lojas] falha ao buscar lojas: ${error.message}`)

    const lojas = (data || []) as LojaCard[]

    const ownerIds = lojas
      .filter((l) => l.plano === 'premium')
      .map((l) => l.owner_user_id)
      .filter(Boolean) as string[]

    let avaliacoes: { avaliado_id: string; estrelas: number | null }[] = []
    if (ownerIds.length > 0) {
      const r = await supabase
        .from('avaliacoes')
        .select('avaliado_id, estrelas')
        .in('avaliado_id', ownerIds)
      if (r.error) throw new Error(`[/lojas] falha ao buscar avaliacoes: ${r.error.message}`)
      avaliacoes = (r.data || []) as typeof avaliacoes
    }

    return { lojas, avaliacoes }
  },
  ['lojas-ativas-v1'],
  { revalidate: 300, tags: ['lojas'] },
)

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
  nome: string | null
  descricao: string | null
  cidade: string | null
  estado: string | null
  tipo: 'fisica' | 'online' | 'ambas' | null
  especialidades: string[] | null
  plano: 'basico' | 'pro' | 'premium' | null
  verificada: boolean | null
  logo_url: string | null
  owner_user_id: string | null
}

const ORDEM_PLANO: Record<string, number> = { premium: 0, pro: 1, basico: 2 }

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function LojasPage(
  { searchParams }: { searchParams: Promise<SearchParams> }
) {
  const sp = await searchParams

  // Normaliza searchParams (Next.js 16 pode trazer string[] ou string)
  const qParam             = typeof sp.q === 'string' ? sp.q.trim() : ''
  const estadoParam        = typeof sp.estado === 'string' ? sp.estado.trim().toUpperCase() : ''
  const tipoParam          = typeof sp.tipo === 'string' ? sp.tipo.trim() : ''
  const especialidadeParam = typeof sp.especialidade === 'string' ? sp.especialidade.trim() : ''

  // Uma leitura cacheada em vez de duas queries por visita. O catch fica aqui
  // FORA do unstable_cache de proposito: o throw la dentro impede o vazio de
  // ser gravado, e aqui a gente ainda consegue mostrar a caixa de erro em vez
  // de derrubar a pagina.
  let todas: LojaCard[] = []
  let avaliacoes: { avaliado_id: string; estrelas: number | null }[] = []
  let error: { message: string } | null = null
  try {
    const r = await getLojasAtivas()
    // A propria Bynx tem uma linha em `lojas` (plano premium, verificada) --
    // sem isso ela aparecia como "loja destaque" ao lado de lojista de
    // verdade, indistinguivel, o que parece autopromocao (auditoria 31/07/2026).
    // Este e o guia de lojas DE TERCEIROS, a Bynx nao e uma delas.
    todas = r.lojas.filter(l => l.slug !== 'bynx')
    avaliacoes = r.avaliacoes
  } catch (e: any) {
    console.error('[/lojas]', e?.message)
    error = { message: e?.message || 'falha ao carregar' }
  }

  // Filtro em memoria — 7 lojas ativas, nao compensa ir ao banco por combinacao.
  // `normalizar` tira acento pra busca por nome casar "Colecoes" com "Coleções".
  const normalizar = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const alvo = normalizar(qParam)

  const lojas: LojaCard[] = todas.filter((l) => {
    if (alvo && !normalizar(l.nome || '').includes(alvo)) return false
    if (estadoParam && (l.estado || '').toUpperCase() !== estadoParam) return false
    if (tipoParam && l.tipo !== tipoParam) return false
    if (especialidadeParam && !(l.especialidades || []).includes(especialidadeParam)) return false
    return true
  })

  // Ordenação: premium > pro > basico, depois verificadas primeiro
  lojas.sort((a, b) => {
    const diff = (ORDEM_PLANO[a.plano || ''] ?? 99) - (ORDEM_PLANO[b.plano || ''] ?? 99)
    if (diff !== 0) return diff
    if (a.verificada !== b.verificada) return a.verificada ? -1 : 1
    return 0
  })

  // Destaque Premium: separa as lojas premium + monta a nota do dono a partir
  // das avaliacoes que ja vieram no mesmo cache.
  const premiumLojas = lojas.filter(l => l.plano === 'premium')
  const ratingMap: Record<string, { media: number; total: number }> = {}
  const acc: Record<string, number[]> = {}
  for (const a of avaliacoes) {
    if (typeof a.estrelas !== 'number') continue
    if (!acc[a.avaliado_id]) acc[a.avaliado_id] = []
    acc[a.avaliado_id].push(a.estrelas)
  }
  for (const k in acc) {
    const arr = acc[k]
    ratingMap[k] = { media: arr.reduce((sum, v) => sum + v, 0) / arr.length, total: arr.length }
  }

  const totalResultados = lojas.length
  const temFiltro = !!(qParam || estadoParam || tipoParam || especialidadeParam)

  // So oferece filtro de Estado/Tipo que tem loja de verdade hoje -- calculado
  // sobre `todas` (nao filtrado), senao escolher um filtro escondia as outras
  // opcoes tambem disponiveis (auditoria 31/07/2026).
  const estadosDisponiveis = Array.from(
    new Set(todas.map(l => (l.estado || '').toUpperCase()).filter(Boolean))
  )
  const tiposDisponiveis = Array.from(
    new Set(todas.map(l => l.tipo).filter(Boolean) as string[])
  )

  return (
    <div style={S.page}>
      <PublicHeader />

      {/* Spacer pro header fixed */}
      <div style={{ height: 62 }} />

      {/* ─── Hero ───────────────────────────────────────────────── */}
      <section className="bx-gutter" style={S.hero}>
        <h1 style={S.heroTitle}>Guia de Lojas</h1>
        <p style={S.heroSubtitle}>
          Encontre lojas de TCG do Brasil. Físicas e online, com especialidade em Pokémon, Magic, Yu-Gi-Oh e mais.
        </p>
      </section>

      {/* Destaque Premium (so na visao padrao, sem filtro) */}
      {!temFiltro && <LojasDestaque lojas={premiumLojas} ratings={ratingMap} />}

      {/* ─── Filtros ────────────────────────────────────────────── */}
      <FiltrosGuia
        initialQ={qParam}
        initialEstado={estadoParam}
        initialTipo={tipoParam}
        initialEspecialidade={especialidadeParam}
        estadosDisponiveis={estadosDisponiveis}
        tiposDisponiveis={tiposDisponiveis}
      />

      {/* ─── Resultados ─────────────────────────────────────────── */}
      <section className="bx-gutter" style={S.resultsSection}>
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
      <section className="bx-gutter" style={S.ctaSection}>
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