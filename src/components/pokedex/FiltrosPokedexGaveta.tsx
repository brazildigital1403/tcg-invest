'use client'

// Gaveta de filtros da grade da Pokedex: sobe de baixo, como a do Mercado
// (src/app/marketplace/page.tsx). O filtro aplica na hora e o rodape mostra
// quantos Pokemon sobram; "Ver N Pokemon" so fecha. Cada opcao mostra a
// contagem com os outros filtros ligados, para ninguem cair num vazio.

import { useEffect } from 'react'
import { IconClose } from '@/components/ui/Icons'
import { TYPE_COLOR, TIPO_ESPECIE } from '@/lib/pokedexTextos'
import {
  REGIOES, TIPOS_JOGO, CATEGORIAS, EVOLUCOES, FAIXAS_CARTAS,
  type FiltrosPokedex,
} from '@/lib/pokedexFiltros'

export type ContagensFiltro = {
  regiao: Record<string, number>
  tipos: Record<string, number>
  categorias: Record<string, number>
  evolucao: Record<string, number>
  cartas: Record<string, number>
}

type Props = {
  aberto: boolean
  onFechar: () => void
  filtros: FiltrosPokedex
  onMudar: (f: FiltrosPokedex) => void
  contagens: ContagensFiltro
  total: number
}

const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(n)

export default function FiltrosPokedexGaveta({ aberto, onFechar, filtros, onMudar, contagens, total }: Props) {
  useEffect(() => {
    if (!aberto) return
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    return () => { document.body.style.overflow = antes; window.removeEventListener('keydown', esc) }
  }, [aberto, onFechar])

  if (!aberto) return null

  const alternar = (lista: string[], id: string) =>
    lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id]

  return (
    <div className="pkf-veu" onClick={onFechar}>
      <div className="pkf-gaveta" role="dialog" aria-modal="true" aria-label="Filtros da Pokédex" onClick={e => e.stopPropagation()}>
        <div className="pkf-alca" />
        <div className="pkf-topo">
          <strong>Filtros</strong>
          <button className="pkf-fechar" onClick={onFechar} aria-label="Fechar filtros"><IconClose size={20} /></button>
        </div>

        <div className="pkf-corpo">
          <Grupo titulo="Região" dica="uma por vez">
            <Chip ativo={!filtros.regiao} onClick={() => onMudar({ ...filtros, regiao: '' })}>Todas</Chip>
            {REGIOES.map(r => (
              <Chip key={r.id} ativo={filtros.regiao === r.id} n={contagens.regiao[r.id]}
                onClick={() => onMudar({ ...filtros, regiao: filtros.regiao === r.id ? '' : r.id })}>
                {r.nome}
              </Chip>
            ))}
          </Grupo>

          <Grupo titulo="Tipo" dica="pode marcar vários">
            {TIPOS_JOGO.map(t => {
              const cor = TYPE_COLOR[TIPO_ESPECIE[t].cor] || { bg: 'var(--bx-surface-2)', text: 'var(--bx-text-2)' }
              const ativo = filtros.tipos.includes(t)
              const n = contagens.tipos[t] || 0
              return (
                <button key={t} type="button" aria-pressed={ativo}
                  className={`pkf-chip pkf-tipo${ativo ? ' on' : ''}${!ativo && n === 0 ? ' vazio' : ''}`}
                  style={{ background: cor.bg, color: cor.text }}
                  onClick={() => onMudar({ ...filtros, tipos: alternar(filtros.tipos, t) })}>
                  {TIPO_ESPECIE[t].pt}<small>{fmtNum(n)}</small>
                </button>
              )
            })}
          </Grupo>

          <Grupo titulo="Categoria" dica="pode marcar várias">
            {CATEGORIAS.map(c => (
              <Chip key={c.id} ativo={filtros.categorias.includes(c.id)} n={contagens.categorias[c.id]}
                onClick={() => onMudar({ ...filtros, categorias: alternar(filtros.categorias, c.id) })}>
                {c.nome}
              </Chip>
            ))}
          </Grupo>

          <Grupo titulo="Evolução">
            {EVOLUCOES.map(e => (
              <Chip key={e.id} ativo={filtros.evolucao === e.id} n={contagens.evolucao[e.id]}
                onClick={() => onMudar({ ...filtros, evolucao: filtros.evolucao === e.id ? '' : e.id })}>
                {e.nome}
              </Chip>
            ))}
          </Grupo>

          <Grupo titulo="Cartas no catálogo">
            {FAIXAS_CARTAS.map(fx => (
              <Chip key={fx.id} ativo={filtros.cartas === fx.id} n={contagens.cartas[fx.id]}
                onClick={() => onMudar({ ...filtros, cartas: filtros.cartas === fx.id ? '' : fx.id })}>
                {fx.nome}
              </Chip>
            ))}
          </Grupo>
        </div>

        <div className="pkf-pe">
          <button className="pkf-limpar" onClick={() => onMudar({ regiao: '', tipos: [], categorias: [], evolucao: '', cartas: '' })}>
            Limpar
          </button>
          <button className="pkf-ver" onClick={onFechar}>
            {total === 0 ? 'Nenhum Pokémon' : `Ver ${fmtNum(total)} Pokémon`}
          </button>
        </div>
      </div>

      <style>{`
        .pkf-veu { position: fixed; inset: 0; z-index: 9998; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; justify-content: center; }
        .pkf-gaveta {
          width: 100%; max-width: 640px; max-height: 85vh; display: flex; flex-direction: column;
          background: var(--bx-bg-elev); border: 1px solid var(--bx-border-2); border-bottom: 0;
          border-radius: 20px 20px 0 0; box-shadow: var(--bx-shadow);
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        .pkf-alca { width: 36px; height: 4px; border-radius: 2px; background: var(--bx-border-2); margin: 10px auto 2px; }
        .pkf-topo { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px 6px 16px; }
        .pkf-topo strong { font-size: 16px; color: var(--bx-text); }
        .pkf-fechar { width: 44px; height: 44px; display: grid; place-items: center; background: none; border: 0; color: var(--bx-text-2); cursor: pointer; }
        .pkf-corpo { overflow-y: auto; padding: 4px 16px 16px; display: flex; flex-direction: column; gap: 20px; overscroll-behavior: contain; }
        .pkf-grupo h4 { margin: 0 0 8px; display: flex; justify-content: space-between; align-items: baseline; gap: 8px;
          font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--bx-text-3); }
        .pkf-grupo h4 span { text-transform: none; letter-spacing: 0; font-weight: 500; }
        .pkf-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .pkf-chip {
          min-height: 44px; display: inline-flex; align-items: center; gap: 6px; padding: 0 14px;
          border-radius: 100px; border: 1px solid var(--bx-border-2); background: var(--bx-surface-2);
          color: var(--bx-text-2); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
        }
        .pkf-chip small { font-size: 11px; font-weight: 500; opacity: 0.7; }
        .pkf-chip.on { border-color: rgba(var(--ac-1-rgb), 0.5); background: rgba(var(--ac-1-rgb), 0.14); color: var(--ac-1); }
        .pkf-tipo { border-color: transparent; }
        .pkf-tipo.on { border-color: currentColor; box-shadow: inset 0 0 0 1px currentColor; }
        .pkf-chip.vazio { opacity: 0.4; }
        .pkf-pe { display: flex; gap: 8px; padding: 12px 16px 16px; border-top: 1px solid var(--bx-border); }
        .pkf-limpar { min-height: 48px; padding: 0 18px; border-radius: 12px; border: 1px solid var(--bx-border-2);
          background: transparent; color: var(--bx-text-2); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
        .pkf-ver { flex: 1; min-height: 48px; border-radius: 12px; border: 0; background: var(--ac-grad);
          color: var(--bx-brand-ink); font: inherit; font-size: 14px; font-weight: 800; cursor: pointer; }
      `}</style>
    </div>
  )
}

function Grupo({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <div className="pkf-grupo">
      <h4>{titulo}{dica && <span>{dica}</span>}</h4>
      <div className="pkf-chips">{children}</div>
    </div>
  )
}

function Chip({ ativo, n, onClick, children }: { ativo: boolean; n?: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={ativo}
      className={`pkf-chip${ativo ? ' on' : ''}${!ativo && n === 0 ? ' vazio' : ''}`}
      onClick={onClick}>
      {children}{n !== undefined && <small>{fmtNum(n)}</small>}
    </button>
  )
}
