'use client'

/**
 * src/app/metas/page.tsx
 *
 * Metas de colecao (#368): a lista e a criacao. Cada meta mostra o retrato
 * gravado na ultima abertura (tenho/total, valor) -- recalcular aqui custaria
 * uma varredura por meta a cada visita. O numero fresco sai ao abrir a meta.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { IconTarget, IconSearch, IconCheck } from '@/components/ui/Icons'
import { getUserPlan } from '@/lib/isPro'
import { track } from '@/lib/analytics'
import {
  IDIOMAS_META, brl, criarMeta, listarMetas, mensagemErroMeta, pct, rotuloIdioma, tituloMeta,
  type Meta, type MetaTipo,
} from '@/lib/metas'

type SetInfo = { id: string; name: string; name_pt: string | null; series: string | null; release_date: string | null }

const card: React.CSSProperties = {
  background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 14,
}

function Barra({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--bx-text-2)' }}>
      <span style={{ width: 44 }}>{rotulo}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--bx-surface-3)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, valor)}%`, height: '100%', background: 'var(--ac-grad)', transition: 'width 0.2s ease' }} />
      </div>
      <span style={{ width: 36, textAlign: 'right', fontWeight: 700, color: 'var(--bx-text)' }}>{valor}%</span>
    </div>
  )
}

export default function MetasPage() {
  const router = useRouter()
  const { openLogin } = useAuthModal()
  const [loaded, setLoaded] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [plano, setPlano] = useState('anonimo')
  const [metas, setMetas] = useState<Meta[]>([])
  const [sets, setSets] = useState<SetInfo[]>([])
  const [pokemons, setPokemons] = useState<string[]>([])

  // formulario de nova meta
  const [criando, setCriando] = useState(false)
  const [tipo, setTipo] = useState<MetaTipo>('pokemon')
  const [busca, setBusca] = useState('')
  const [alvo, setAlvo] = useState<{ valor: string; rotulo: string } | null>(null)
  const [idioma, setIdioma] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
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
      setCriando(lista.length === 0)
      setLoaded(true)
    })()
    return () => { ativo = false }
  }, [])

  // A lista de Pokemon so e buscada quando o formulario abre (e cacheada no servidor).
  useEffect(() => {
    if (!criando || pokemons.length) return
    fetch('/api/pokedex').then(r => r.json()).then(j => {
      setPokemons((j.pokemons || []).map((p: any) => p.name).sort((a: string, b: string) => a.localeCompare(b)))
    }).catch(() => {})
  }, [criando, pokemons.length])

  const nomeDoSet = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of sets) m.set(s.id, s.name_pt || s.name)
    return m
  }, [sets])

  const sugestoes = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (q.length < 2) return []
    if (tipo === 'pokemon') {
      return pokemons.filter(n => n.toLowerCase().includes(q)).slice(0, 8).map(n => ({ valor: n, rotulo: n, sub: '' }))
    }
    return sets
      .filter(s => (s.name_pt || '').toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.id.toLowerCase() === q)
      .slice(0, 8)
      .map(s => ({ valor: s.id, rotulo: s.name_pt || s.name, sub: [s.series, s.release_date?.slice(0, 4)].filter(Boolean).join(' · ') }))
  }, [busca, tipo, pokemons, sets])

  async function salvar() {
    if (!alvo) return
    setSalvando(true)
    setErro('')
    try {
      const id = await criarMeta(tipo, alvo.valor, idioma)
      track({ name: 'meta_criada', properties: { tipo, alvo: alvo.valor, idioma, plano } })
      router.push(`/metas/${id}`)
    } catch (e: any) {
      setErro(mensagemErroMeta(e))
      setSalvando(false)
    }
  }

  function trocarTipo(t: MetaTipo) {
    setTipo(t); setBusca(''); setAlvo(null); setErro('')
  }

  const chip = (ativo: boolean): React.CSSProperties => ({
    font: 'inherit', fontSize: 14, fontWeight: 600, minHeight: 44, padding: '0 16px', borderRadius: 999, cursor: 'pointer',
    border: `1px solid ${ativo ? 'var(--ac-1)' : 'var(--bx-border)'}`,
    background: ativo ? 'rgba(var(--ac-1-rgb), 0.12)' : 'var(--bx-surface)',
    color: ativo ? 'var(--ac-1)' : 'var(--bx-text-2)',
    transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  })

  return (
    <AppLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 0 60px' }}>
        <PageHeader
          trilha={[INICIO, { name: 'Coleção', href: '/minha-colecao' }, { name: 'Metas', href: '/metas' }]}
          titulo="Metas"
          descricao="Escolha o que quer completar e veja o que falta, quanto custa e o que já tem."
          selo={
            <span style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--ac-1-rgb), 0.13)', border: '1px solid rgba(var(--ac-1-rgb), 0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <IconTarget size={17} color="var(--ac-1)" />
            </span>
          }
          stat={loaded && userId && metas.length > 0 ? `${metas.length} ${metas.length === 1 ? 'meta' : 'metas'}` : undefined}
          acao={loaded && userId && !criando ? (
            <button onClick={() => setCriando(true)} style={{ font: 'inherit', fontSize: 14, fontWeight: 700, minHeight: 44, padding: '0 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)' }}>
              Nova meta
            </button>
          ) : undefined}
        />

        {!loaded && <div style={{ color: 'var(--bx-text-2)', fontSize: 15, padding: '40px 0' }}>Carregando…</div>}

        {loaded && !userId && (
          <div style={{ ...card, padding: '34px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Entre para criar suas metas</div>
            <p style={{ fontSize: 14, color: 'var(--bx-text-2)', margin: '0 0 18px' }}>Escolha um Pokémon ou uma coleção e acompanhe o que falta para completar.</p>
            <button onClick={() => openLogin({ next: '/metas' })} style={{ font: 'inherit', fontSize: 14, fontWeight: 700, minHeight: 44, padding: '0 22px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)' }}>
              Entrar
            </button>
          </div>
        )}

        {loaded && userId && criando && (
          <div style={{ ...card, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Nova meta</div>
            <p style={{ fontSize: 13, color: 'var(--bx-text-2)', margin: '0 0 16px' }}>Colecione do seu jeito.</p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <button style={chip(tipo === 'pokemon')} onClick={() => trocarTipo('pokemon')}>Por Pokémon</button>
              <button style={chip(tipo === 'set')} onClick={() => trocarTipo('set')}>Por coleção</button>
            </div>

            <div style={{ position: 'relative', marginBottom: 16 }}>
              <span style={{ position: 'absolute', left: 14, top: 14, pointerEvents: 'none' }}><IconSearch size={16} color="var(--bx-text-3)" /></span>
              <input
                value={alvo ? alvo.rotulo : busca}
                onChange={e => { setAlvo(null); setBusca(e.target.value) }}
                placeholder={tipo === 'pokemon' ? 'Qual Pokémon? Ex.: Charizard' : 'Qual coleção? Ex.: 151'}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 16, minHeight: 44, padding: '10px 14px 10px 38px', borderRadius: 10, border: '1px solid var(--bx-border)', background: 'var(--bx-bg-elev)', color: 'var(--bx-text)', outline: 'none' }}
              />
              {!alvo && sugestoes.length > 0 && (
                <div style={{ marginTop: 6, ...card, borderRadius: 10, overflow: 'hidden' }}>
                  {sugestoes.map(s => (
                    <button key={s.valor} onClick={() => { setAlvo({ valor: s.valor, rotulo: s.rotulo }); setBusca('') }}
                      style={{ display: 'flex', width: '100%', textAlign: 'left', justifyContent: 'space-between', alignItems: 'center', gap: 10, font: 'inherit', fontSize: 14, minHeight: 44, padding: '8px 14px', border: 'none', borderBottom: '1px solid var(--bx-border)', background: 'transparent', color: 'var(--bx-text)', cursor: 'pointer' }}>
                      <span>{s.rotulo}</span>
                      {s.sub && <span style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>{s.sub}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Em que idioma você coleciona?</div>
            <p style={{ fontSize: 12, color: 'var(--bx-text-3)', margin: '0 0 10px' }}>A meta só conta a carta no idioma que você escolher.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
              {IDIOMAS_META.map(i => (
                <button key={i.label} style={chip(idioma === i.key)} onClick={() => setIdioma(i.key)}>{i.label}</button>
              ))}
            </div>

            {erro && <p style={{ fontSize: 13, color: 'var(--bx-red)', margin: '0 0 12px' }}>{erro}</p>}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={salvar} disabled={!alvo || salvando}
                style={{ font: 'inherit', fontSize: 14, fontWeight: 700, minHeight: 44, padding: '0 22px', borderRadius: 10, border: 'none', cursor: alvo ? 'pointer' : 'default', background: alvo ? 'var(--ac-grad)' : 'var(--bx-surface-3)', color: alvo ? 'var(--bx-brand-ink)' : 'var(--bx-text-3)' }}>
                {salvando ? 'Criando…' : 'Criar meta'}
              </button>
              {metas.length > 0 && (
                <button onClick={() => setCriando(false)} style={{ font: 'inherit', fontSize: 14, minHeight: 44, padding: '0 18px', borderRadius: 10, border: '1px solid var(--bx-border)', background: 'transparent', color: 'var(--bx-text-2)', cursor: 'pointer' }}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}

        {loaded && userId && metas.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
            {metas.map(m => {
              const temRetrato = m.total != null
              const pc = pct(m.tenho || 0, m.total || 0)
              const pv = pct(Number(m.valor_tenho) || 0, Number(m.valor_total) || 0)
              const falta = Math.max(0, (Number(m.valor_total) || 0) - (Number(m.valor_tenho) || 0))
              const idiomaTxt = rotuloIdioma(m.idioma)
              return (
                <Link key={m.id} href={`/metas/${m.id}`} className="bx-meta-card" style={{ ...card, padding: 16, textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tituloMeta(m, nomeDoSet.get(m.alvo))}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>
                        {m.tipo === 'pokemon' ? 'Por Pokémon' : 'Por coleção'}{idiomaTxt ? ` · só em ${idiomaTxt.toLowerCase()}` : ''}
                      </div>
                    </div>
                    {m.concluida_em && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', color: 'var(--bx-green)' }}>
                        <IconCheck size={12} color="var(--bx-green)" /> Completa
                      </span>
                    )}
                  </div>
                  {temRetrato ? (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--bx-text-2)' }}>
                        Você tem <strong style={{ color: 'var(--bx-text)' }}>{m.tenho}</strong> de {m.total}
                        {falta > 0 && <> · faltam <strong style={{ color: 'var(--bx-text)' }}>{brl(falta)}</strong></>}
                      </div>
                      <Barra valor={pc} rotulo="Cartas" />
                      <Barra valor={pv} rotulo="Valor" />
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--bx-text-3)' }}>Abra para calcular o progresso.</div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
        <style>{`
          .bx-meta-card { transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease; }
          .bx-meta-card:hover { transform: translateY(-2px); background: var(--bx-surface-2) !important; border-color: var(--bx-border-2) !important; }
          @media (prefers-reduced-motion: reduce) { .bx-meta-card:hover { transform: none; } }
        `}</style>
      </div>
    </AppLayout>
  )
}
