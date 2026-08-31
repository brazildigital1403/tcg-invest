'use client'

import { useEffect, useRef, useState } from 'react'
import { IconPokeball, IconInk } from './Icons'
import type { Game } from '@/lib/game'
import { GAME_COOKIE } from '@/lib/game'

// Seletor de contexto de jogo (epico multi-jogo). Fica pronto aqui e e montado
// na AppLayout quando o catalogo Lorcana estiver servivel (F4). Enquanto so
// existe um jogo com catalogo, quem monta decide esconder ou mostrar.
//
// Troca de jogo = cookie bx_game + navegacao pra home do contexto. O acento
// visual de cada contexto vem da casca da rota (mesmo mecanismo da loja):
// /lorcana/* sobrescreve --ac-* pra teal->azul via .bx-game-lorcana.

const JOGOS: { id: Game; nome: string; sub: string; home: string; Icone: typeof IconPokeball; ac: string; acBg: string }[] = [
  { id: 'pokemon', nome: 'Pokémon', sub: 'colecao e mercado', home: '/', Icone: IconPokeball, ac: '#f59e0b', acBg: 'rgba(245,158,11,0.12)' },
  { id: 'lorcana', nome: 'Lorcana', sub: 'Bynx Lorcana', home: '/lorcana', Icone: IconInk, ac: '#2dd4bf', acBg: 'rgba(45,212,191,0.12)' },
]

export default function GameSwitcher({ game, compact = false }: { game: Game; compact?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const atual = JOGOS.find(j => j.id === game) ?? JOGOS[0]

  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  function trocar(j: (typeof JOGOS)[number]) {
    setAberto(false)
    if (j.id === game) return
    document.cookie = `${GAME_COOKIE}=${j.id}; path=/; max-age=31536000; samesite=lax`
    window.location.href = j.home
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label={`Jogo atual: ${atual.nome}. Trocar de jogo`}
        style={{
          display: 'flex', alignItems: 'center', gap: compact ? 6 : 9, cursor: 'pointer',
          padding: compact ? '5px 10px' : '8px 12px', borderRadius: 999,
          background: 'var(--bx-surface)', border: '1px solid var(--bx-border)',
          color: 'var(--bx-text)', font: 'inherit', width: compact ? 'auto' : '100%',
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bx-surface-2)'; e.currentTarget.style.borderColor = 'var(--bx-border-2)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bx-surface)'; e.currentTarget.style.borderColor = 'var(--bx-border)' }}
      >
        <span style={{
          width: compact ? 18 : 26, height: compact ? 18 : 26, borderRadius: 999, flex: 'none',
          display: 'grid', placeItems: 'center',
          background: 'rgba(var(--ac-1-rgb), 0.12)', color: 'var(--ac-1)',
        }}>
          <atual.Icone size={compact ? 11 : 15} strokeWidth={1.8} />
        </span>
        <span style={{ textAlign: 'left', lineHeight: 1.15 }}>
          <span style={{ fontSize: compact ? 12 : 13.5, fontWeight: 600 }}>{atual.nome}</span>
          {!compact && (
            <span style={{ display: 'block', fontSize: 10.5, color: 'var(--bx-text-3)' }}>trocar de jogo</span>
          )}
        </span>
        <svg width={compact ? 11 : 14} height={compact ? 11 : 14} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2} strokeLinecap="round"
          style={{ marginLeft: 'auto', color: 'var(--bx-text-3)', transition: 'transform 0.15s ease', transform: aberto ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {aberto && (
        <div role="listbox" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 230, zIndex: 60,
          background: 'var(--bx-bg-elev)', border: '1px solid var(--bx-border-2)', borderRadius: 12,
          boxShadow: 'var(--bx-shadow, 0 12px 32px rgba(0,0,0,0.5))', padding: 6,
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {JOGOS.map(j => {
            const sel = j.id === game
            return (
              <button
                key={j.id}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => trocar(j)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  padding: '9px 10px', borderRadius: 8, border: 'none', font: 'inherit',
                  background: sel ? 'var(--bx-surface-3)' : 'transparent',
                  color: 'var(--bx-text)', textAlign: 'left', width: '100%',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--bx-surface-2)' }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{
                  width: 26, height: 26, borderRadius: 999, flex: 'none',
                  display: 'grid', placeItems: 'center', background: j.acBg, color: j.ac,
                }}>
                  <j.Icone size={15} strokeWidth={1.8} />
                </span>
                <span style={{ lineHeight: 1.15, flex: 1 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{j.nome}</span>
                  <span style={{ display: 'block', fontSize: 10.5, color: 'var(--bx-text-3)' }}>{j.sub}</span>
                </span>
                {sel ? (
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={j.ac} strokeWidth={2.2} strokeLinecap="round">
                    <path d="M4 12l5 5L20 6" />
                  </svg>
                ) : (
                  <span style={{
                    fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--bx-text-3)',
                    border: '1px solid var(--bx-border)', borderRadius: 999, padding: '2px 7px',
                  }}>NOVO</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
