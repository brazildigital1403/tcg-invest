import { CSSProperties } from 'react'
import { unstable_cache } from 'next/cache'
import Link from 'next/link'
import { Metadata } from 'next'
import { supabase } from '@/lib/supabaseClient'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import CardLoja from '@/components/lojas/CardLoja'
import LojasDestaque from '@/components/lojas/LojasDestaque'
import { FiltrosSidebar, FiltrosGaveta } from '@/components/lojas/FiltrosGuia'
import HeroSearchLojas from '@/components/lojas/HeroSearchLojas'
import { IconClose } from '@/components/ui/Icons'
import {
  buildLojasUrl,
  TIPO_LABEL,
  TIPOS_ORDEM,
  ESPECIALIDADE_LABEL,
  ESPECIALIDADES_ORDEM,
} from '@/components/lojas/lojasFiltros'
import { ehColecionador, naturezaDoParam, NATUREZA_DESCRICAO } from '@/lib/naturezaLoja'

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
      .select('id, slug, nome, descricao, cidade, estado, tipo, especialidades, plano, verificada, logo_url, owner_user_id, natureza')
      .eq('status', 'ativa')
      // `oculta` = loja de teste: funciona, mas nao se acha. Ver a migration
      // 20260912180000_lojas_oculta.sql.
      .neq('oculta', true)
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
  // -v2: a query passou a filtrar `oculta`. Chave nova porque a entrada v1
  // ficaria servida com a loja oculta dentro ate o revalidate de 300s.
  // ★ v3 porque o select ganhou `natureza` (24/09/2026). Sem trocar a chave, a
  // entrada gravada pela v2 continuaria servida ate o revalidate -- sem o
  // campo, e toda loja cairia na aba errada.
  ['lojas-ativas-v3'],
  { revalidate: 300, tags: ['lojas'] },
)

interface SearchParams {
  q?: string
  estado?: string
  tipo?: string
  especialidade?: string
  quem?: string
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
    // Sem isto herdava o canonical da home do layout raiz (decisao do Du, 14/09).
    // Os filtros (?especialidade, ?estado) apontam pro guia, nao pra si mesmos.
    alternates: { canonical: 'https://bynx.gg/lojas' },
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
  /** 'loja' ou 'colecionador' -- ver src/lib/naturezaLoja.ts. */
  natureza: string | null
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
  // Aba/filtro "Quem vende". Qualquer valor diferente de `colecionadores` cai
  // em lojas, que e a aba padrao.
  const quemParam = typeof sp.quem === 'string' && sp.quem.trim().toLowerCase() === 'colecionadores'
    ? 'colecionadores' : ''
  const naturezaAtiva = naturezaDoParam(quemParam)

  // Uma leitura cacheada em vez de duas queries por visita. O catch fica aqui
  // FORA do unstable_cache de proposito: o throw la dentro impede o vazio de
  // ser gravado, e aqui a gente ainda consegue mostrar a caixa de erro em vez
  // de derrubar a pagina.
  let todas: LojaCard[] = []
  let avaliacoes: { avaliado_id: string; estrelas: number | null }[] = []
  let error: { message: string } | null = null
  try {
    const r = await getLojasAtivas()
    // A propria Bynx tem uma linha em `lojas` (plano premium, verificada).
    // Decisao do Du (02/08/2026): ela entra na listagem normal, no meio das
    // lojas de terceiros -- so nao pode aparecer no carrossel de Destaque
    // (ve premiumLojas embaixo), que era o que parecia autopromocao
    // (auditoria 31/07/2026).
    todas = r.lojas
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

  // Separa as duas listas ANTES dos outros filtros: as contagens da aba e do
  // grupo "Quem vende" falam do acervo inteiro, nao do que sobrou do filtro.
  const contagemQuem = {
    lojas: todas.filter(l => !ehColecionador(l.natureza)).length,
    colecionadores: todas.filter(l => ehColecionador(l.natureza)).length,
  }

  const lojas: LojaCard[] = todas.filter((l) => {
    if (ehColecionador(l.natureza) !== (naturezaAtiva === 'colecionador')) return false
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
  // das avaliacoes que ja vieram no mesmo cache. Bynx fica de fora do
  // destaque de proposito (decisao do Du, 02/08/2026) -- ela aparece na
  // grade normal ali embaixo, igual a qualquer outra loja.
  // Carrossel de Destaque e da aba de LOJAS: e vitrine paga, e colecionador
  // nao assina Premium para aparecer la.
  const premiumLojas = naturezaAtiva === 'colecionador'
    ? []
    : lojas.filter(l => l.plano === 'premium' && l.slug !== 'bynx')
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

  // Quem ja aparece no carrossel de Destaque nao repete na grade logo abaixo
  // (achado do Du, 12/08/2026 -- Castle Games aparecia 2x: uma vez grande no
  // destaque, outra vez como card normal na grade). So se aplica quando o
  // destaque de fato renderiza (sem filtro ativo); com filtro, LojasDestaque
  // nem aparece, entao a grade mostra tudo normalmente.
  const idsDestaque = new Set(premiumLojas.map(l => l.id))
  const gridLojas = temFiltro ? lojas : lojas.filter(l => !idsDestaque.has(l.id))

  // Contagem por opcao (sobre `todas`, nao filtrado) -- so oferece filtro que
  // tem loja de verdade hoje, mas a opcao selecionada sempre aparece mesmo com
  // 0, senao escolher um filtro faz o proprio filtro sumir da lista embaixo
  // (auditoria 31/07/2026 -- regra que ja existia pra estado/tipo, agora
  // estendida pra especialidade tambem, que antes nao seguia o mesmo padrao).
  const estadoCounts: Record<string, number> = {}
  const tipoCounts: Record<string, number> = {}
  const espCounts: Record<string, number> = {}
  for (const l of todas) {
    const uf = (l.estado || '').toUpperCase()
    if (uf) estadoCounts[uf] = (estadoCounts[uf] || 0) + 1
    const tp = l.tipo || 'online'
    tipoCounts[tp] = (tipoCounts[tp] || 0) + 1
    for (const esp of (l.especialidades || [])) {
      espCounts[esp] = (espCounts[esp] || 0) + 1
    }
  }

  const estadosOpcoes = Object.keys(estadoCounts).sort()
    .filter(uf => estadoCounts[uf] > 0 || uf === estadoParam)
    .map(uf => ({ value: uf, label: uf, count: estadoCounts[uf] || 0 }))
  if (estadoParam && !estadosOpcoes.some(o => o.value === estadoParam)) {
    estadosOpcoes.push({ value: estadoParam, label: estadoParam, count: 0 })
  }

  const tiposOpcoes = TIPOS_ORDEM
    .filter(tp => (tipoCounts[tp] || 0) > 0 || tp === tipoParam)
    .map(tp => ({ value: tp, label: TIPO_LABEL[tp], count: tipoCounts[tp] || 0 }))

  const especialidadesOpcoes = ESPECIALIDADES_ORDEM
    .filter(esp => (espCounts[esp] || 0) > 0 || esp === especialidadeParam)
    .map(esp => ({ value: esp, label: ESPECIALIDADE_LABEL[esp], count: espCounts[esp] || 0 }))

  const atual = { q: qParam, estado: estadoParam, tipo: tipoParam, especialidade: especialidadeParam, quem: quemParam }

  // Pills removíveis acima do grid -- cada uma tira so o proprio filtro,
  // preservando os outros.
  const pills: { key: string; label: string; href: string }[] = []
  if (qParam) pills.push({ key: 'q', label: `"${qParam}"`, href: buildLojasUrl({ ...atual, q: '' }) })
  if (estadoParam) pills.push({ key: 'estado', label: estadoParam, href: buildLojasUrl({ ...atual, estado: '' }) })
  if (tipoParam) pills.push({ key: 'tipo', label: TIPO_LABEL[tipoParam] || tipoParam, href: buildLojasUrl({ ...atual, tipo: '' }) })
  if (especialidadeParam) pills.push({ key: 'especialidade', label: ESPECIALIDADE_LABEL[especialidadeParam] || especialidadeParam, href: buildLojasUrl({ ...atual, especialidade: '' }) })

  return (
    <div style={S.page}>
      <PublicHeader />

      {/* Spacer pro header fixed */}
      <div style={{ height: 62 }} />

      {/* ─── Hero (vitrine: busca e estatisticas ja aqui, sem rolar) ─── */}
      <section className="bx-gutter" style={S.hero}>
        <span style={S.heroEyebrow}>Guia de Lojas</span>
        <h1 style={S.heroTitle}>Encontre a loja certa pro seu hobby</h1>
        <p style={S.heroSubtitle}>
          Lojas de TCG do Brasil — físicas e online — com especialidade em Pokémon, Magic, Yu-Gi-Oh e mais.
        </p>
        <HeroSearchLojas atual={atual} />
        <div style={S.heroStats}>
          <div style={S.stat}>
            <b style={S.statNum}>{todas.length}</b>
            <span style={S.statLabel}>{todas.length === 1 ? 'Loja ativa' : 'Lojas ativas'}</span>
          </div>
          <div style={S.stat}>
            <b style={S.statNum}>{Object.keys(estadoCounts).length}</b>
            <span style={S.statLabel}>{Object.keys(estadoCounts).length === 1 ? 'Estado' : 'Estados'}</span>
          </div>
          <div style={S.stat}>
            <b style={S.statNum}>{Object.keys(espCounts).length}</b>
            <span style={S.statLabel}>{Object.keys(espCounts).length === 1 ? 'Jogo' : 'Jogos'}</span>
          </div>
        </div>
      </section>

      {/* ─── Filtros: barra sticky que abre gaveta (so aparece no mobile) ─── */}
      <FiltrosGaveta
        quem={contagemQuem}
        atual={atual}
        estados={estadosOpcoes}
        tipos={tiposOpcoes}
        especialidades={especialidadesOpcoes}
        totalLojas={todas.length}
        resultCount={totalResultados}
      />

      {/* ─── Corpo: sidebar de filtro (desktop) + resultados ─── */}
      <div className="bx-gutter" style={S.bodyWrap}>
        <FiltrosSidebar
          quem={contagemQuem}
          atual={atual}
          estados={estadosOpcoes}
          tipos={tiposOpcoes}
          especialidades={especialidadesOpcoes}
          totalLojas={todas.length}
        />

        <section style={S.content}>
          {error && (
            <div style={S.errorBox}>
              Erro ao carregar lojas. Tente recarregar a página.
            </div>
          )}

          {!error && (
            <>
              {/* ★ ABAS: a separacao principal entre loja e colecionador. Elas
                  escrevem no MESMO parametro que o grupo "Quem vende" da
                  lateral (`quem`), entao os dois nunca se contradizem. */}
              <div style={S.abas}>
                {([
                  { valor: '', label: 'Lojas', n: contagemQuem.lojas },
                  { valor: 'colecionadores', label: 'Colecionadores', n: contagemQuem.colecionadores },
                ] as const).map(aba => {
                  const ativa = quemParam === aba.valor
                  return (
                    <Link
                      key={aba.label}
                      href={buildLojasUrl({ ...atual, quem: aba.valor })}
                      aria-current={ativa ? 'page' : undefined}
                      style={{ ...S.aba, ...(ativa ? S.abaAtiva : {}) }}
                    >
                      {aba.label}
                      <span style={{ ...S.abaNum, ...(ativa ? S.abaNumAtiva : {}) }}>{aba.n}</span>
                    </Link>
                  )
                })}
              </div>
              <p style={S.abaNota}>{NATUREZA_DESCRICAO[naturezaAtiva]}</p>

              {pills.length > 0 && (
                <div style={S.pillsRow}>
                  {pills.map(p => (
                    <Link key={p.key} href={p.href} style={S.pill}>
                      {p.label}
                      <IconClose size={10} color="var(--ac-1)" />
                    </Link>
                  ))}
                </div>
              )}

              <p style={S.resultCount}>
                {totalResultados === 0
                  ? (temFiltro
                      ? 'Nenhum resultado para esses filtros.'
                      : naturezaAtiva === 'colecionador'
                        ? 'Nenhum colecionador cadastrado ainda.'
                        : 'Nenhuma loja cadastrada ainda.')
                  : naturezaAtiva === 'colecionador'
                    ? `${totalResultados} ${totalResultados === 1 ? 'colecionador encontrado' : 'colecionadores encontrados'}`
                    : `${totalResultados} ${totalResultados === 1 ? 'loja encontrada' : 'lojas encontradas'}`}
              </p>

              {/* Destaque Premium (so na visao padrao, sem filtro) */}
              {!temFiltro && <LojasDestaque lojas={premiumLojas} ratings={ratingMap} />}

              {gridLojas.length > 0 && (
                <div style={S.grid}>
                  {gridLojas.map(loja => (
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
      </div>

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
  abas: {
    display: 'flex', gap: 4,
    borderBottom: '1px solid var(--bx-border)',
    marginBottom: 14,
  },
  aba: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '11px 14px', minHeight: 44,
    fontSize: 13.5, fontWeight: 700, textDecoration: 'none',
    color: 'var(--bx-text-3)',
    borderBottom: '2px solid transparent', marginBottom: -1,
    transition: 'color 0.15s ease, border-color 0.15s ease',
  },
  abaAtiva: { color: 'var(--bx-text)', borderBottomColor: 'var(--ac-1)' },
  abaNum: {
    fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 999,
    background: 'var(--bx-surface-2)', color: 'var(--bx-text-3)',
    fontVariantNumeric: 'tabular-nums',
  },
  abaNumAtiva: { color: 'var(--ac-1)', background: 'rgba(245,158,11,0.12)' },
  abaNota: { fontSize: 12.5, color: 'var(--bx-text-3)', margin: '0 0 14px', maxWidth: '70ch' },

  page: {
    minHeight: '100vh',
    background: 'var(--bx-bg)',
    color: 'var(--bx-text)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },

  hero: {
    position: 'relative',
    maxWidth: 1200,
    margin: '0 auto',
    padding: '52px 24px 28px',
    textAlign: 'center',
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--bx-hero-wash)',
  },
  heroEyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--ac-1)',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.25)',
    padding: '5px 12px',
    borderRadius: 999,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 'clamp(36px, 5.5vw, 60px)',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    lineHeight: 1.05,
    margin: '0 auto 12px',
    maxWidth: 700,
    textWrap: 'balance',
    background: 'var(--ac-grad)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSubtitle: {
    fontSize: 'clamp(15px, 1.6vw, 18px)',
    color: 'var(--bx-text-2)',
    margin: '0 auto 24px',
    maxWidth: 580,
    lineHeight: 1.6,
  },
  heroStats: {
    display: 'flex',
    justifyContent: 'center',
    gap: 28,
    flexWrap: 'wrap',
  },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  statNum: { fontSize: 19, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--bx-text)' },
  statLabel: { fontSize: 11, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' },

  bodyWrap: {
    maxWidth: 1200,
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'flex-start',
    padding: '20px 0 48px',
  },
  content: { flex: 1, minWidth: 0 },

  pillsRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ac-1)',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.3)',
    borderRadius: 999,
    padding: '6px 8px 6px 12px',
    textDecoration: 'none',
  },

  resultCount: {
    fontSize: 13,
    color: 'var(--bx-text-3)',
    margin: '0 0 16px',
    fontWeight: 500,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 14,
  },
  errorBox: {
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 12,
    padding: 16,
    color: 'var(--bx-red)',
    fontSize: 14,
    textAlign: 'center',
  },
  clearFiltersLink: {
    display: 'inline-block',
    marginTop: 16,
    color: 'var(--ac-1)',
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