'use client'

/**
 * src/app/metas/page.tsx
 *
 * Metas de colecao (#368) -- a lista, o primeiro contato e a criacao.
 * Redesenhada em 21/09/2026 a partir do mockup aprovado pelo Du (canvas
 * "Metas: nova experiencia"), depois de 6 frentes de analise (UX, UI, copy,
 * como funciona, simplificacao, mobile). O diagnostico comum: a tela nao
 * estava simples, estava MUDA -- numero sem frase, sem dizer o que e nem o que
 * fazer.
 *
 * - Primeiro contato: promessa, diferenciais, metas SUGERIDAS a partir da
 *   colecao da pessoa (um toque, e a meta ja nasce com progresso) e uma busca
 *   unica (Pokemon ou colecao, sem escolher o tipo antes).
 * - Idioma saiu da criacao: a meta nasce "qualquer idioma" e muda la dentro.
 * - A lista le o retrato gravado na ultima abertura de cada meta (recalcular
 *   aqui seria uma varredura por meta a cada visita).
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { IconTarget, IconSearch, IconCheck, IconPlus, IconCollection, IconCarrinho, IconPokeball, IconArrowRight } from '@/components/ui/Icons'
import { getUserPlan } from '@/lib/isPro'
import { track } from '@/lib/analytics'
import LequeCartas, { type CartaLeque } from '@/components/metas/LequeCartas'
import AnelMeta, { LegendaAnel } from '@/components/metas/AnelMeta'
import { lerCapa } from '@/components/metas/capaMeta'
import {
  brl, criarMeta, fraseLeitura, listarMetas, mensagemErroMeta, pct, rotuloIdioma, tituloMeta,
  type Meta, type MetaTipo,
} from '@/lib/metas'

type SetInfo = { id: string; name: string; name_pt: string | null; series: string | null; release_date: string | null }
type Sugestao = { tipo: MetaTipo; alvo: string; titulo: string; qtd: number; artes: CartaLeque[] }
type Resultado = { tipo: MetaTipo; alvo: string; rotulo: string; sub: string }

const bloco: React.CSSProperties = { background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 18 }
const heroBox: React.CSSProperties = {
  background: 'var(--bx-hero-wash), var(--bx-surface)', border: '1px solid rgba(var(--ac-1-rgb), 0.28)',
  borderRadius: 20, boxShadow: '0 18px 50px -22px rgba(var(--ac-1-rgb), 0.4)', overflow: 'hidden',
}
const kicker: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ac-1)' }
const pilula: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 700, padding: '6px 11px', borderRadius: 999, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', color: 'var(--bx-text-2)' }
const btnPrim: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, font: 'inherit', fontSize: 14, fontWeight: 800, minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', textDecoration: 'none' }

const PASSOS = [
  { Icon: IconTarget, titulo: 'Escolha o que completar', texto: 'Todas as cartas de um Pokémon, ou uma coleção inteira.' },
  { Icon: IconCollection, titulo: 'Veja onde você está', texto: 'A Bynx cruza com a sua coleção: quantas você tem, quanto valem e quanto falta em reais.' },
  { Icon: IconCarrinho, titulo: 'Complete pelo menor preço', texto: 'As que faltam e estão à venda na Bynx aparecem primeiro, e o sino avisa quando surgir uma nova.' },
]

export default function MetasPage() {
  const router = useRouter()
  const { openLogin } = useAuthModal()
  const [loaded, setLoaded] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [plano, setPlano] = useState('anonimo')
  const [metas, setMetas] = useState<Meta[]>([])
  const [sets, setSets] = useState<SetInfo[]>([])
  const [pokemons, setPokemons] = useState<string[]>([])
  const [sugestoes, setSugestoes] = useState<Sugestao[] | null>(null)
  const [capas, setCapas] = useState<Record<string, CartaLeque[]>>({})

  const [criando, setCriando] = useState(false)
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id ?? null
      if (!ativo) return
      setUserId(uid)
      if (!uid) { setLoaded(true); return }
      const [lista, p, s] = await Promise.all([
        listarMetas().catch(() => [] as Meta[]),
        getUserPlan(uid),
        supabase.from('pokemon_sets').select('id, name, name_pt, series, release_date').order('release_date', { ascending: false }),
      ])
      if (!ativo) return
      setMetas(lista)
      setPlano(p.plano)
      setSets((s.data || []) as SetInfo[])
      const c: Record<string, CartaLeque[]> = {}
      for (const m of lista) { const x = lerCapa(m.id); if (x) c[m.id] = x }
      setCapas(c)
      setCriando(lista.length === 0)
      setLoaded(true)
    })()
    return () => { ativo = false }
  }, [])

  const nomeDoSet = useMemo(() => {
    const m = new Map<string, SetInfo>()
    for (const s of sets) m.set(s.id, s)
    return m
  }, [sets])

  // Lista de Pokemon (cacheada no servidor) so quando o formulario abre.
  useEffect(() => {
    if (!criando || pokemons.length) return
    fetch('/api/pokedex').then(r => r.json()).then(j => {
      setPokemons((j.pokemons || []).map((p: { name: string }) => p.name).sort((a: string, b: string) => a.localeCompare(b)))
    }).catch(() => {})
  }, [criando, pokemons.length])

  // Metas sugeridas: agrupa a colecao da pessoa por colecao (set) e por
  // Pokemon. O set_id da propria linha de user_cards vem vazio em ~93% das
  // cartas (medido 21/09), entao o agrupamento sai do catalogo, pelo
  // /api/cards/lookup (chave primaria, em lotes de 100 -- sem varrer tabela).
  useEffect(() => {
    if (!criando || !userId || sugestoes !== null) return
    let ativo = true
    ;(async () => {
      const { data: uc } = await supabase.from('user_cards').select('pokemon_api_id, card_image').eq('user_id', userId).not('pokemon_api_id', 'is', null).limit(3000)
      const ids = [...new Set((uc || []).map(r => r.pokemon_api_id as string))]
      if (ids.length === 0) { if (ativo) setSugestoes([]); return }
      const cards: { id: string; set_id: string | null; set_name: string | null; base_pokemon_names: string[] | null; image_small: string | null; preco_min: number | null }[] =
        await fetch('/api/cards/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
          .then(r => r.json()).then(d => d.cards || []).catch(() => [])
      const porSet = new Map<string, { qtd: number; nome: string; artes: { image: string | null; nome: string; v: number }[] }>()
      const porPoke = new Map<string, { qtd: number; artes: { image: string | null; nome: string; v: number }[] }>()
      for (const c of cards) {
        const arte = { image: c.image_small, nome: c.set_name || '', v: Number(c.preco_min) || 0 }
        if (c.set_id && nomeDoSet.has(c.set_id)) {
          const g = porSet.get(c.set_id) || { qtd: 0, nome: c.set_name || c.set_id, artes: [] }
          g.qtd++; g.artes.push(arte); porSet.set(c.set_id, g)
        }
        for (const n of c.base_pokemon_names || []) {
          const g = porPoke.get(n) || { qtd: 0, artes: [] }
          g.qtd++; g.artes.push(arte); porPoke.set(n, g)
        }
      }
      const jaTem = new Set(metas.map(m => `${m.tipo}:${m.alvo}`))
      const topArtes = (xs: { image: string | null; nome: string; v: number }[]) =>
        xs.filter(x => x.image).sort((a, b) => b.v - a.v).slice(0, 3).map(x => ({ image: x.image, nome: x.nome, tem: true }))
      const sSets: Sugestao[] = [...porSet.entries()].filter(([id]) => !jaTem.has(`set:${id}`))
        .sort((a, b) => b[1].qtd - a[1].qtd).slice(0, 2)
        .map(([id, g]) => {
          const s = nomeDoSet.get(id)
          return { tipo: 'set', alvo: id, titulo: tituloMeta('set', id, s?.name_pt || s?.name || g.nome), qtd: g.qtd, artes: topArtes(g.artes) }
        })
      const sPoke: Sugestao[] = [...porPoke.entries()].filter(([n, g]) => g.qtd >= 2 && !jaTem.has(`pokemon:${n}`))
        .sort((a, b) => b[1].qtd - a[1].qtd).slice(0, 1)
        .map(([n, g]) => ({ tipo: 'pokemon', alvo: n, titulo: tituloMeta('pokemon', n), qtd: g.qtd, artes: topArtes(g.artes) }))
      if (ativo) setSugestoes([...sSets, ...sPoke].sort((a, b) => b.qtd - a.qtd))
    })()
    return () => { ativo = false }
  }, [criando, userId, sugestoes, nomeDoSet, metas])

  // Busca unica: Pokemon e colecao na mesma lista.
  const resultados = useMemo<Resultado[]>(() => {
    const q = busca.trim().toLowerCase()
    if (q.length < 2) return []
    const ps: Resultado[] = pokemons.filter(n => n.toLowerCase().includes(q)).slice(0, 5)
      .map(n => ({ tipo: 'pokemon', alvo: n, rotulo: tituloMeta('pokemon', n), sub: 'Pokémon · todas as coleções' }))
    const ss: Resultado[] = sets.filter(s => (s.name_pt || '').toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.id.toLowerCase() === q)
      .slice(0, 5)
      .map(s => ({ tipo: 'set', alvo: s.id, rotulo: tituloMeta('set', s.id, s.name_pt || s.name), sub: ['Coleção', s.series, s.release_date?.slice(0, 4)].filter(Boolean).join(' · ') }))
    return [...ps, ...ss]
  }, [busca, pokemons, sets])

  async function criar(tipo: MetaTipo, alvo: string, origem: 'sugestao' | 'busca') {
    setSalvando(`${tipo}:${alvo}`)
    setErro('')
    try {
      const id = await criarMeta(tipo, alvo, null)
      track({ name: 'meta_criada', properties: { tipo, alvo, idioma: null, plano, origem } })
      router.push(`/metas/${id}`)
    } catch (e) {
      setErro(mensagemErroMeta(e as { message?: string }))
      setSalvando(null)
    }
  }

  const completas = metas.filter(m => m.concluida_em).length
  const ativas = metas.length - completas
  // Destaque: a meta nao concluida mais perto de completar (com retrato).
  const destaque = useMemo(() => {
    const cand = metas.filter(m => !m.concluida_em && m.total)
    if (metas.length < 2 || cand.length === 0) return null
    return cand.sort((a, b) => (b.tenho! / b.total!) - (a.tenho! / a.total!))[0].id
  }, [metas])
  const ordenadas = useMemo(() => destaque ? [...metas].sort((a, b) => Number(b.id === destaque) - Number(a.id === destaque)) : metas, [metas, destaque])

  const nomeSetDe = (m: Meta) => { const s = nomeDoSet.get(m.alvo); return s?.name_pt || s?.name || null }
  const primeiroContato = loaded && !!userId && metas.length === 0

  return (
    <AppLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 0 60px' }}>
        <PageHeader
          trilha={[INICIO, { name: 'Coleção', href: '/minha-colecao' }, { name: 'Metas', href: '/metas' }]}
          titulo="Metas"
          descricao="Escolha o que você quer completar. A Bynx mostra o que falta, quanto custa e quem vende hoje."
          selo={
            <span style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--ac-1-rgb), 0.13)', border: '1px solid rgba(var(--ac-1-rgb), 0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <IconTarget size={17} color="var(--ac-1)" />
            </span>
          }
          stat={loaded && userId && metas.length > 0
            ? `${ativas} ${ativas === 1 ? 'meta ativa' : 'metas ativas'}${completas ? ` · ${completas} ${completas === 1 ? 'completa' : 'completas'}` : ''}`
            : undefined}
          acao={loaded && userId && metas.length > 0 && !criando ? (
            <button onClick={() => setCriando(true)} style={btnPrim}><IconPlus size={16} color="currentColor" />Nova meta</button>
          ) : undefined}
        />

        {!loaded && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 14 }} aria-busy="true">
            {[0, 1].map(i => <div key={i} className="bx-metas-esq" style={{ ...bloco, height: 250 }} />)}
          </div>
        )}

        {loaded && !userId && (
          <div style={{ ...bloco, padding: '34px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Entre para criar sua primeira meta</div>
            <p style={{ fontSize: 14, color: 'var(--bx-text-2)', margin: '0 0 18px', lineHeight: 1.55 }}>Escolha um Pokémon ou uma coleção e veja, carta por carta, o que falta, quanto custa e quem vende hoje. Grátis.</p>
            <button onClick={() => openLogin({ next: '/metas' })} style={btnPrim}>Entrar e criar meta</button>
          </div>
        )}

        {/* ── Primeiro contato: a promessa ─────────────────────────────── */}
        {primeiroContato && (
          <div className="bx-metas-hero" style={{ ...heroBox, marginBottom: 24 }}>
            <div className="bx-metas-hero-arte" style={{ background: 'var(--bx-hero-wash), var(--bx-surface-2)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '20px 16px 16px' }}>
              <LequeCartas tamanho="md" prioridade cartas={(sugestoes?.[0]?.artes.length ? [...sugestoes[0].artes, ...(sugestoes[1]?.artes || [])] : []).slice(0, 5).map((c, i) => ({ ...c, tem: i % 2 === 0 }))} />
            </div>
            <div style={{ padding: '22px 22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={kicker}>Metas de coleção</div>
              <h2 style={{ margin: 0, fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 900, letterSpacing: '-0.035em', lineHeight: 1.12 }}>
                Sua coleção sabe o que falta. <span className="bx-metas-grad">A Bynx sabe onde comprar.</span>
              </h2>
              <p style={{ margin: 0, fontSize: 15, color: 'var(--bx-text-2)', lineHeight: 1.6 }}>
                Escolha um Pokémon ou uma coleção. A Bynx cruza com as cartas que você já tem e mostra o que falta, quanto custa e quem está vendendo agora.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['Progresso em reais', 'À venda agora', 'Orçamento guiado', 'Aviso com preço máximo', 'Meta por idioma'].map(t => <span key={t} style={pilula}>{t}</span>)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bx-text-3)' }}>Liberado em todos os planos, inclusive no Grátis.</div>
            </div>
          </div>
        )}

        {/* ── Criar: sugestoes + busca unica ───────────────────────────── */}
        {loaded && userId && criando && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
            {(sugestoes === null || sugestoes.length > 0) && (
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>Comece pelo que você já tem</h2>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--bx-text-2)' }}>Sugestões montadas a partir da sua coleção. Um toque e a meta já nasce com o seu progresso.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
                  {sugestoes === null
                    ? [0, 1, 2].map(i => <div key={i} className="bx-metas-esq" style={{ ...bloco, height: 104 }} />)
                    : sugestoes.map(s => (
                      <div key={`${s.tipo}:${s.alvo}`} style={{ ...bloco, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                        <div style={{ width: 110, flexShrink: 0 }}><LequeCartas tamanho="sm" cartas={s.artes} /></div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 800 }}>{s.titulo}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--bx-text-2)', margin: '2px 0 10px' }}>
                            Você tem {s.qtd} {s.qtd === 1 ? 'carta' : 'cartas'} {s.tipo === 'set' ? 'desta coleção' : `de ${s.alvo}`}
                          </div>
                          <button onClick={() => criar(s.tipo, s.alvo, 'sugestao')} disabled={!!salvando} style={{ ...btnPrim, fontSize: 13, padding: '0 14px' }}>
                            <IconPlus size={14} color="currentColor" />{salvando === `${s.tipo}:${s.alvo}` ? 'Montando…' : 'Acompanhar'}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div style={{ ...bloco, padding: 18 }}>
              <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>
                {sugestoes && sugestoes.length > 0 ? 'Prefere escolher outra?' : 'O que você quer completar?'}
              </h2>
              <label style={{ position: 'relative', display: 'block' }}>
                <span style={{ position: 'absolute', left: 14, top: 15, pointerEvents: 'none' }}><IconSearch size={16} color="var(--bx-text-3)" /></span>
                <span className="bx-sr">Busque um Pokémon ou uma coleção</span>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Busque um Pokémon ou uma coleção"
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: 16, minHeight: 48, padding: '10px 14px 10px 40px', borderRadius: 12, border: '1px solid var(--bx-border-2)', background: 'var(--bx-bg-elev)', color: 'var(--bx-text)', outline: 'none' }} />
              </label>
              {busca.trim().length >= 2 && (
                <div style={{ marginTop: 8, border: '1px solid var(--bx-border)', borderRadius: 12, overflow: 'hidden' }}>
                  {resultados.length === 0 ? (
                    <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--bx-text-2)' }}>Nada com &ldquo;{busca.trim()}&rdquo;. Confira a grafia ou tente o nome em inglês.</div>
                  ) : resultados.map(r => (
                    <button key={`${r.tipo}:${r.alvo}`} onClick={() => criar(r.tipo, r.alvo, 'busca')} disabled={!!salvando}
                      className="bx-metas-res"
                      style={{ display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center', gap: 12, font: 'inherit', minHeight: 52, padding: '8px 14px', border: 'none', borderBottom: '1px solid var(--bx-border)', background: 'transparent', color: 'var(--bx-text)', cursor: 'pointer' }}>
                      <span style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(var(--ac-1-rgb), 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {r.tipo === 'pokemon' ? <IconPokeball size={16} color="var(--ac-1)" /> : <IconCollection size={16} color="var(--ac-1)" />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{r.rotulo}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--bx-text-3)' }}>{r.sub}</span>
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ac-1)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {salvando === `${r.tipo}:${r.alvo}` ? 'Montando…' : <>Criar <IconArrowRight size={14} color="var(--ac-1)" /></>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--bx-text-3)' }}>Vale carta de qualquer idioma. Dá para mudar depois, dentro da meta.</p>
              {erro && <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--bx-red)' }}>{erro}</p>}
              {metas.length > 0 && (
                <button onClick={() => { setCriando(false); setBusca(''); setErro('') }} style={{ marginTop: 12, font: 'inherit', fontSize: 14, minHeight: 44, padding: '0 16px', borderRadius: 12, border: '1px solid var(--bx-border)', background: 'transparent', color: 'var(--bx-text-2)', cursor: 'pointer' }}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Como funciona (so no primeiro contato) ───────────────────── */}
        {primeiroContato && (
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 800 }}>Como funciona</h2>
            <ol className="bx-metas-passos" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
              {PASSOS.map((p, i) => (
                <li key={p.titulo} style={{ ...bloco, padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(var(--ac-1-rgb), 0.12)', border: '1px solid rgba(var(--ac-1-rgb), 0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p.Icon size={18} color="var(--ac-1)" />
                  </span>
                  <span style={kicker}>Passo {i + 1}</span>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>{p.titulo}</span>
                  <span style={{ fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.55 }}>{p.texto}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* ── Lista ────────────────────────────────────────────────────── */}
        {loaded && userId && metas.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
              {ordenadas.map(m => {
                const temRetrato = m.total != null
                const r = { total: m.total || 0, tenho: m.tenho || 0, vt: Number(m.valor_total) || 0, vtenho: Number(m.valor_tenho) || 0, falta: Math.max(0, (Number(m.valor_total) || 0) - (Number(m.valor_tenho) || 0)) }
                const pc = pct(r.tenho, r.total), pv = pct(r.vtenho, r.vt)
                const idiomaTxt = rotuloIdioma(m.idioma)
                const largo = m.id === destaque
                const frase = temRetrato ? fraseLeitura(r, brl) : null
                return (
                  <Link key={m.id} href={`/metas/${m.id}`} prefetch={false} className={`bx-meta-card${largo ? ' bx-meta-card-largo' : ''}`}
                    style={{ ...bloco, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: largo ? 150 : 118, background: 'var(--bx-hero-wash), var(--bx-surface-2)', borderBottom: '1px solid var(--bx-border)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', overflow: 'hidden' }}>
                      <AnelMeta cartas={pc} valor={pv} tamanho={largo ? 96 : 60} />
                      {/* Centralizado na vertical. Antes ia com margem negativa para as cartas
                          "sairem" da vitrine; no celular ficavam baixas e cortadas (Du, 21/09). */}
                      {capas[m.id] && <div style={{ display: 'flex', alignItems: 'center' }}><LequeCartas tamanho={largo ? 'md' : 'sm'} cartas={capas[m.id]} /></div>}
                      {m.concluida_em && <span style={{ position: 'absolute', top: 10, right: 12, ...pilula, color: 'var(--bx-green)' }}><IconCheck size={12} color="var(--bx-green)" />&nbsp;Completa</span>}
                    </div>
                    <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {largo && <span style={{ ...pilula, alignSelf: 'flex-start', color: 'var(--bx-green)', borderColor: 'color-mix(in srgb, var(--bx-green) 35%, transparent)' }}>Mais perto de completar</span>}
                      <div style={{ fontSize: largo ? 19 : 16, fontWeight: 800, letterSpacing: '-0.01em' }}>{tituloMeta(m.tipo, m.alvo, nomeSetDe(m))}</div>
                      <div style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>{m.tipo === 'pokemon' ? 'Pokémon · todas as coleções' : 'Coleção'}{idiomaTxt ? ` · só em ${idiomaTxt.toLowerCase()}` : ''}</div>
                      {temRetrato ? (
                        <>
                          <div style={{ fontSize: 13.5 }}><b>{r.tenho} de {r.total} cartas</b>{r.falta > 0 && <> · faltam <b style={{ color: 'var(--ac-1)' }}>{brl(r.falta)}</b></>}</div>
                          {largo && frase && <div style={{ fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.5 }}><b style={{ color: 'var(--bx-text)' }}>{frase.forte}</b> {frase.resto}</div>}
                          <LegendaAnel cartas={pc} valor={pv} />
                        </>
                      ) : <div style={{ fontSize: 13, color: 'var(--bx-text-3)' }}>Toque para calcular seu progresso.</div>}
                    </div>
                  </Link>
                )
              })}
              {!criando && (
                <button onClick={() => { setCriando(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="bx-meta-nova"
                  style={{ font: 'inherit', minHeight: 220, borderRadius: 18, border: '1.5px dashed var(--bx-border-2)', background: 'transparent', color: 'var(--bx-text-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(var(--ac-1-rgb), 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconPlus size={20} color="var(--ac-1)" /></span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Nova meta</span>
                  <span style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>Um Pokémon ou uma coleção</span>
                </button>
              )}
            </div>
            <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--bx-text-3)' }}>Os números da lista são os da última vez que você abriu cada meta. Abrindo, a Bynx recalcula.</p>
          </>
        )}

        <style>{`
          .bx-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
          .bx-metas-grad { background: var(--ac-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
          .bx-metas-hero { display: grid; grid-template-columns: minmax(0, 1fr); }
          .bx-metas-hero-arte { min-height: 150px; }
          @media (min-width: 900px) {
            .bx-metas-hero { grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); }
            .bx-metas-hero-arte { order: 2; border-left: 1px solid var(--bx-border); align-items: center !important; }
          }
          @media (min-width: 720px) { .bx-meta-card-largo { grid-column: span 2; } }
          .bx-meta-card, .bx-meta-nova { transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease; }
          .bx-meta-card:hover { transform: translateY(-2px); background: var(--bx-surface-2) !important; border-color: var(--bx-border-2) !important; }
          .bx-meta-nova:hover { border-color: rgba(var(--ac-1-rgb), 0.5) !important; }
          .bx-metas-res { transition: background 0.15s ease; }
          .bx-metas-res:hover { background: var(--bx-surface-2) !important; }
          .bx-metas-esq { animation: bxMetasPulso 1.2s ease-in-out infinite alternate; }
          @keyframes bxMetasPulso { from { opacity: .55 } to { opacity: 1 } }
          @media (prefers-reduced-motion: reduce) {
            .bx-meta-card:hover { transform: none; }
            .bx-metas-esq { animation: none; opacity: .7; }
          }
        `}</style>
      </div>
    </AppLayout>
  )
}
