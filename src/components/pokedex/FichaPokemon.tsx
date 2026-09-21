'use client'

import { useEffect, useMemo, useState } from 'react'
import AnelMeta from '@/components/metas/AnelMeta'
import { CAMPO_VALOR } from '@/lib/calcPatrimonio'
import { TYPE_COLOR, TIPO_ESPECIE, buscarFichaEspecie, normalizarNome, tipoTcgPt, type FichaEspecie } from '@/lib/pokedexTextos'

/**
 * Cabecalho da pagina do Pokemon na Pokedex (mockup "Pokedex: nova
 * experiencia", aprovado em 21/09/2026). Era um titulo de 24px com o tipo em
 * ingles; vira uma ficha: arte grande, numero, geracao, os dois tipos em
 * portugues, a cadeia de evolucao (clicavel) e, ao lado, a colecao da pessoa
 * daquele Pokemon com o atalho para virar Meta.
 */
type PokemonLista = { name: string; dexId: number; generation: string; sprite?: string; types?: string[] }
type Carta = { id: string; preco_min?: number | null; preco_medio?: number | null; preco_max?: number | null }

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v >= 100 ? 0 : 2 })
const valorCarta = (c: Carta) => {
  const f = CAMPO_VALOR === 'min' ? c.preco_min : CAMPO_VALOR === 'max' ? c.preco_max : c.preco_medio
  return Number(f) > 0 ? Number(f) : 0
}

export default function FichaPokemon({ pokemon, pokemons, cartas, ownedCardIds, logado, onAbrirPokemon, onCriarMeta, criandoMeta }: {
  pokemon: PokemonLista
  pokemons: PokemonLista[]
  cartas: Carta[]
  ownedCardIds: Set<string>
  logado: boolean
  onAbrirPokemon: (p: PokemonLista) => void
  onCriarMeta: () => void
  criandoMeta: boolean
}) {
  const [ficha, setFicha] = useState<FichaEspecie | null>(null)
  useEffect(() => {
    let ativo = true
    buscarFichaEspecie(pokemon.dexId).then(f => { if (ativo) setFicha(f) })
    return () => { ativo = false }
  }, [pokemon.dexId])

  // Slug da PokeAPI -> Pokemon da nossa lista (sprite e clique).
  const porNome = useMemo(() => {
    const m = new Map<string, PokemonLista>()
    for (const p of pokemons) m.set(normalizarNome(p.name), p)
    return m
  }, [pokemons])
  const evolucao = (ficha?.evolucao || []).map(s => porNome.get(normalizarNome(s))).filter((p): p is PokemonLista => !!p)

  const resumo = useMemo(() => {
    const tem = cartas.filter(c => ownedCardIds.has(c.id))
    const vt = cartas.reduce((s, c) => s + valorCarta(c), 0)
    const vtenho = tem.reduce((s, c) => s + valorCarta(c), 0)
    return { tenho: tem.length, total: cartas.length, vtenho, pc: cartas.length ? Math.round((tem.length / cartas.length) * 100) : 0, pv: vt ? Math.round((vtenho / vt) * 100) : 0 }
  }, [cartas, ownedCardIds])

  const tipos = ficha?.tipos?.length
    ? ficha.tipos.map(t => ({ rotulo: TIPO_ESPECIE[t]?.pt || t, cor: TYPE_COLOR[TIPO_ESPECIE[t]?.cor || ''] }))
    : (pokemon.types || []).map(t => ({ rotulo: tipoTcgPt(t), cor: TYPE_COLOR[t] }))

  return (
    <div className="bx-ficha">
      <div className="bx-ficha-arte">
        <span className="bx-ficha-brilho" aria-hidden="true" style={{ background: `radial-gradient(circle, ${(tipos[0]?.cor?.text || '#f59e0b')}44, transparent 65%)` }} />
        {pokemon.sprite && (
          // Sprite de fonte externa (mesma da grade da Pokedex), fora do otimizador de proposito.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pokemon.sprite} alt={pokemon.name} className="bx-ficha-sprite" referrerPolicy="no-referrer" />
        )}
      </div>

      <div className="bx-ficha-info">
        <div className="bx-ficha-kicker">
          {pokemon.dexId > 0 ? `#${String(pokemon.dexId).padStart(4, '0')}` : ''}{pokemon.generation && pokemon.generation !== '?' ? ` · Geração ${pokemon.generation}` : ''}
        </div>
        <h1 className="bx-ficha-nome">{pokemon.name}</h1>
        <div className="bx-ficha-tipos">
          {tipos.map(t => (
            <span key={t.rotulo} style={{ background: t.cor?.bg || 'var(--bx-surface-2)', color: t.cor?.text || 'var(--bx-text)', border: `1px solid ${(t.cor?.text || '#888')}55` }}>{t.rotulo}</span>
          ))}
          <span className="bx-ficha-neutro">{cartas.length} {cartas.length === 1 ? 'carta' : 'cartas'} no catálogo</span>
        </div>
        {ficha?.texto && <p className="bx-ficha-texto">{ficha.texto}</p>}
        {evolucao.length > 1 && (
          <div className="bx-ficha-evo" aria-label="Cadeia de evolução">
            {evolucao.map((p, i) => {
              const atual = p.name === pokemon.name
              return (
                <span key={p.name} style={{ display: 'contents' }}>
                  {i > 0 && <span className="bx-ficha-seta" aria-hidden="true">›</span>}
                  <button type="button" onClick={() => !atual && onAbrirPokemon(p)} disabled={atual} aria-current={atual ? 'true' : undefined}
                    className={`bx-ficha-evo-item${atual ? ' bx-ficha-evo-atual' : ''}`}>
                    {p.sprite && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.sprite} alt="" referrerPolicy="no-referrer" loading="lazy" />
                    )}
                    <span>{p.name}</span>
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {logado && cartas.length > 0 && (
        <div className="bx-ficha-colecao">
          <div className="bx-ficha-k">Sua coleção de {pokemon.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <AnelMeta cartas={resumo.pc} valor={resumo.pv} tamanho={76} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 900 }}>{resumo.tenho} <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--bx-text-2)' }}>de {resumo.total} cartas</span></div>
              <div style={{ fontSize: 13, color: 'var(--bx-text-2)' }}>Suas cartas valem <b style={{ color: 'var(--bx-text)' }}>{brl(resumo.vtenho)}</b></div>
            </div>
          </div>
          <button type="button" onClick={onCriarMeta} disabled={criandoMeta} className="bx-ficha-meta">
            {criandoMeta ? 'Montando a meta…' : 'Transformar em meta'}
          </button>
          <div style={{ fontSize: 11.5, color: 'var(--bx-text-3)', lineHeight: 1.45 }}>Acompanhe o que falta, quanto custa e o que está à venda.</div>
        </div>
      )}

      <style>{`
        .bx-ficha { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; align-items: center; padding: 20px 16px; border-radius: 22px; background: var(--bx-hero-wash), var(--bx-surface); border: 1px solid var(--bx-border-2); overflow: hidden; margin-bottom: 18px; }
        @media (min-width: 900px) { .bx-ficha { grid-template-columns: 240px minmax(0, 1fr) 290px; gap: 28px; padding: 26px 30px; } }
        .bx-ficha-arte { position: relative; display: flex; justify-content: center; }
        .bx-ficha-brilho { position: absolute; width: 220px; height: 220px; border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; }
        .bx-ficha-sprite { position: relative; width: 170px; height: 170px; object-fit: contain; animation: bxFichaFlutua 6s ease-in-out infinite alternate; }
        @media (min-width: 900px) { .bx-ficha-sprite { width: 210px; height: 210px; } }
        .bx-ficha-info { display: flex; flex-direction: column; gap: 10px; min-width: 0; text-align: center; align-items: center; }
        @media (min-width: 900px) { .bx-ficha-info { text-align: left; align-items: flex-start; } }
        .bx-ficha-kicker { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--bx-text-3); }
        .bx-ficha-nome { margin: 0; font-size: clamp(32px, 5vw, 46px); font-weight: 900; letter-spacing: -0.04em; line-height: 1; color: var(--bx-text); }
        .bx-ficha-tipos { display: flex; gap: 6px; flex-wrap: wrap; justify-content: inherit; }
        .bx-ficha-tipos span { font-size: 12px; font-weight: 800; padding: 5px 12px; border-radius: 999px; }
        .bx-ficha-tipos .bx-ficha-neutro { font-weight: 700; background: var(--bx-surface-2); color: var(--bx-text-2); border: 1px solid var(--bx-border); }
        .bx-ficha-texto { margin: 0; font-size: 14px; color: var(--bx-text-2); line-height: 1.6; max-width: 480px; }
        .bx-ficha-evo { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: inherit; margin-top: 2px; }
        .bx-ficha-seta { color: var(--bx-text-3); }
        .bx-ficha-evo-item { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 56px; min-height: 44px; padding: 4px; border: 1px solid transparent; border-radius: 12px; background: none; cursor: pointer; font: inherit; color: var(--bx-text-3); transition: background .15s ease, border-color .15s ease, color .15s ease; }
        .bx-ficha-evo-item img { width: 46px; height: 46px; object-fit: contain; opacity: .6; transition: opacity .15s ease; }
        .bx-ficha-evo-item span { font-size: 11px; font-weight: 600; }
        .bx-ficha-evo-item:hover:not(:disabled) { background: var(--bx-surface-2); border-color: var(--bx-border); color: var(--bx-text); }
        .bx-ficha-evo-item:hover:not(:disabled) img { opacity: 1; }
        .bx-ficha-evo-atual { cursor: default; color: var(--bx-text); border-color: rgba(var(--ac-1-rgb), .35); background: rgba(var(--ac-1-rgb), .08); }
        .bx-ficha-evo-atual img { opacity: 1; }
        .bx-ficha-evo-atual span { font-weight: 800; }
        .bx-ficha-colecao { display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 16px; background: var(--bx-bg-elev); border: 1px solid var(--bx-border); }
        .bx-ficha-k { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--ac-1); }
        .bx-ficha-meta { font: inherit; font-size: 14px; font-weight: 800; min-height: 44px; border: none; border-radius: 12px; cursor: pointer; background: var(--ac-grad); color: var(--bx-brand-ink); transition: transform .15s ease, box-shadow .15s ease; }
        .bx-ficha-meta:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 28px -14px rgba(var(--ac-1-rgb), .9); }
        @keyframes bxFichaFlutua { from { transform: translateY(0) } to { transform: translateY(-8px) } }
        @media (prefers-reduced-motion: reduce) { .bx-ficha-sprite { animation: none; } .bx-ficha-meta:hover { transform: none; } }
      `}</style>
    </div>
  )
}
