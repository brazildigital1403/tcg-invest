'use client'

/**
 * Pecas compartilhadas da grade de tique: portal, folha (bottom sheet no
 * celular, centralizada no desktop), estilos de botao e os dois icones que
 * o Icons.tsx nao tem (ajuste e cadeado).
 */

import { ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { IconClose } from '@/components/ui/Icons'

// Portal cai no body: a folha e o toast sao fixed e nao podem herdar o
// overflow/backdrop-filter do modal que monta a grade. Fora do AppLayout o
// body e Arial, por isso a fonte vai declarada em quem usa o portal.
export const FONTE = "'DM Sans', system-ui, sans-serif"
// Acima do AddCardModal (9998) e do ModalLimiteCartas.
export const Z_FOLHA = 10010
export const Z_TOAST = 10020

// Servidor e hidratacao devolvem false; o cliente, true. Sem setState em
// efeito, que o lint do React 19 proibe.
const semInscricao = () => () => {}
export function Portal({ children }: { children: ReactNode }) {
  const montado = useSyncExternalStore(semInscricao, () => true, () => false)
  if (!montado) return null
  return createPortal(children, document.body)
}

// ── Estilos reusados ─────────────────────────────────────────────────────────

export const btnPrim: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, font: 'inherit', fontSize: 14, fontWeight: 800, minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', textDecoration: 'none', whiteSpace: 'nowrap' }
export const btnSec: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, font: 'inherit', fontSize: 14, fontWeight: 700, minHeight: 44, padding: '0 16px', borderRadius: 12, border: '1px solid var(--bx-border)', cursor: 'pointer', background: 'var(--bx-surface-2)', color: 'var(--bx-text)', textDecoration: 'none', whiteSpace: 'nowrap' }
export const btnLink: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, font: 'inherit', fontSize: 13, fontWeight: 700, minHeight: 44, padding: '0 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'none', color: 'var(--ac-1)' }
export const btnIcone: React.CSSProperties = { width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 10, color: 'var(--bx-text-2)', flexShrink: 0, padding: 0 }
export const rotulo: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--bx-text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }
export const dica: React.CSSProperties = { fontSize: 12, color: 'var(--bx-text-3)', lineHeight: 1.45 }

// ── Icones que faltam no Icons.tsx (mesmo estilo: viewBox 20, traco 1.4) ──────

type IconProps = { size?: number; color?: string; strokeWidth?: number; style?: React.CSSProperties }

export function IconAjuste({ size = 20, color = 'currentColor', strokeWidth = 1.4, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style} aria-hidden="true">
      <path d="M3 6h14M3 14h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="8" cy="6" r="2" fill="var(--bx-bg-elev)" stroke={color} strokeWidth={strokeWidth} />
      <circle cx="12" cy="14" r="2" fill="var(--bx-bg-elev)" stroke={color} strokeWidth={strokeWidth} />
    </svg>
  )
}

export function IconCadeado({ size = 20, color = 'currentColor', strokeWidth = 1.4, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style} aria-hidden="true">
      <rect x="4" y="9" width="12" height="8" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <path d="M7 9V6.5a3 3 0 016 0V9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="10" cy="13" r="1" fill={color} />
    </svg>
  )
}

// ── Folha ────────────────────────────────────────────────────────────────────

export function Folha({ titulo, subtitulo, onFechar, children, rodape, largura = 480 }: {
  titulo: string
  subtitulo?: string
  onFechar: () => void
  children: ReactNode
  /** Fica fixo embaixo, fora da rolagem do corpo. */
  rodape?: ReactNode
  /** Largura maxima no desktop. */
  largura?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onFechar() } }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Foco entra na folha e volta para quem a abriu ao fechar.
    const antes = document.activeElement as HTMLElement | null
    const alvo = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-fechar])')
    ;(alvo || ref.current)?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; antes?.focus() }
  }, [onFechar])

  return (
    <Portal>
      <div className="bx-tq-scrim" onClick={onFechar} style={{ position: 'fixed', inset: 0, zIndex: Z_FOLHA, background: 'var(--bx-scrim)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: FONTE, color: 'var(--bx-text)' }}>
        <div
          ref={ref}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          className="bx-tq-folha"
          onClick={e => e.stopPropagation()}
          style={{ ['--bx-tq-w' as string]: `${largura}px`, width: '100%', background: 'var(--bx-bg-elev)', border: '1px solid var(--bx-border-2)', boxShadow: 'var(--bx-shadow)', display: 'flex', flexDirection: 'column', outline: 'none', maxHeight: '92dvh' }}
        >
          <div className="bx-tq-alca" aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--bx-border-2)', margin: '8px auto 0' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '8px 8px 4px 16px' }}>
            <div style={{ minWidth: 0, paddingTop: 8 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.25 }}>{titulo}</h3>
              {subtitulo && <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.4 }}>{subtitulo}</p>}
            </div>
            <button type="button" data-fechar onClick={onFechar} aria-label="Fechar" style={btnIcone}><IconClose size={18} color="var(--bx-text-2)" /></button>
          </div>
          <div style={{ padding: '6px 16px 16px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
            {children}
          </div>
          {rodape && (
            <div className="bx-tq-folha-pe" style={{ padding: '12px 16px', borderTop: '1px solid var(--bx-border)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
              {rodape}
            </div>
          )}
        </div>
      </div>
      <style>{`
        .bx-tq-folha { border-radius: 18px 18px 0 0; animation: bxTqSobe 0.2s ease; padding-bottom: env(safe-area-inset-bottom, 0px); }
        @keyframes bxTqSobe { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (min-width: 640px) {
          .bx-tq-scrim { align-items: center; padding: 24px; }
          .bx-tq-folha { border-radius: 18px; max-width: var(--bx-tq-w, 480px); max-height: 86vh !important; padding-bottom: 0; }
          .bx-tq-alca { display: none; }
        }
        @media (prefers-reduced-motion: reduce) { .bx-tq-folha { animation: none; } }
      `}</style>
    </Portal>
  )
}

// ── Pecas de formulario das folhas ───────────────────────────────────────────

/** Segmentos lado a lado (variante). `riscado` = nao existe no catalogo. */
export function Segmentos({ opcoes, valor, onChange, rotuloGrupo }: {
  opcoes: { key: string; label: string; riscado?: boolean }[]
  valor: string
  onChange: (k: string) => void
  rotuloGrupo: string
}) {
  return (
    <div role="radiogroup" aria-label={rotuloGrupo} style={{ display: 'flex', border: '1px solid var(--bx-border-2)', borderRadius: 12, overflow: 'hidden' }}>
      {opcoes.map((o, i) => {
        const on = o.key === valor
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-disabled={o.riscado || undefined}
            title={o.riscado ? 'Esta carta não existe nessa variante' : undefined}
            onClick={() => { if (!o.riscado) onChange(o.key) }}
            style={{ flex: 1, minHeight: 44, font: 'inherit', fontSize: 13, fontWeight: 600, border: 'none', borderRight: i < opcoes.length - 1 ? '1px solid var(--bx-border)' : 'none', cursor: o.riscado ? 'not-allowed' : 'pointer', background: on ? 'rgba(var(--ac-1-rgb), 0.14)' : 'transparent', color: o.riscado ? 'var(--bx-text-faint)' : on ? 'var(--bx-text)' : 'var(--bx-text-2)', textDecoration: o.riscado ? 'line-through' : 'none', transition: 'background 0.15s ease, color 0.15s ease' }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Chips de idioma (44 px) com "Outro" abrindo um select para os raros. */
export function ChipsIdioma({ valor, onChange, principais, outros }: {
  valor: string
  onChange: (k: string) => void
  principais: string[]
  outros: { key: string; label: string }[]
}) {
  const ehOutro = !principais.includes(valor)
  const [abrirOutro, setAbrirOutro] = useState(ehOutro)
  const chip = (on: boolean): React.CSSProperties => ({ minHeight: 44, padding: '0 14px', borderRadius: 999, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1px solid ${on ? 'rgba(var(--ac-1-rgb), 0.5)' : 'var(--bx-border-2)'}`, background: on ? 'rgba(var(--ac-1-rgb), 0.12)' : 'var(--bx-surface)', color: on ? 'var(--bx-text)' : 'var(--bx-text-2)', transition: 'background 0.15s ease, border-color 0.15s ease' })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div role="radiogroup" aria-label="Idioma" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {principais.map(k => (
          <button key={k} type="button" role="radio" aria-checked={valor === k} onClick={() => { setAbrirOutro(false); onChange(k) }} style={chip(valor === k)}>{k.toUpperCase()}</button>
        ))}
        <button type="button" role="radio" aria-checked={ehOutro} onClick={() => setAbrirOutro(true)} style={chip(ehOutro)}>{ehOutro ? valor.toUpperCase() : 'Outro'}</button>
      </div>
      {abrirOutro && (
        <select
          aria-label="Outro idioma"
          value={ehOutro ? valor : ''}
          onChange={e => { if (e.target.value) onChange(e.target.value) }}
          style={{ font: 'inherit', fontSize: 16, minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1px solid var(--bx-border-2)', background: 'var(--bx-surface)', color: 'var(--bx-text)' }}
        >
          <option value="">Escolha o idioma</option>
          {outros.map(o => <option key={o.key} value={o.key}>{o.label} ({o.key.toUpperCase()})</option>)}
        </select>
      )}
    </div>
  )
}

/** Mais / menos com alvo de 44 px. */
export function Contador({ valor, onChange, min = 1, max = 99, rotuloGrupo }: { valor: number; onChange: (n: number) => void; min?: number; max?: number; rotuloGrupo: string }) {
  const b: React.CSSProperties = { minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--bx-text)', cursor: 'pointer', font: 'inherit', fontSize: 18, fontWeight: 700 }
  return (
    <div role="group" aria-label={rotuloGrupo} style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--bx-border-2)', borderRadius: 12, overflow: 'hidden' }}>
      <button type="button" aria-label="Menos uma" onClick={() => onChange(Math.max(min, valor - 1))} disabled={valor <= min} style={{ ...b, opacity: valor <= min ? 0.35 : 1, cursor: valor <= min ? 'default' : 'pointer' }}>−</button>
      <span aria-live="polite" style={{ minWidth: 56, textAlign: 'center', fontSize: 15, fontWeight: 800, borderLeft: '1px solid var(--bx-border)', borderRight: '1px solid var(--bx-border)', alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{valor}</span>
      <button type="button" aria-label="Mais uma" onClick={() => onChange(Math.min(max, valor + 1))} disabled={valor >= max} style={{ ...b, opacity: valor >= max ? 0.35 : 1 }}>+</button>
    </div>
  )
}

/** Pilula ambar "Holo · EN" / "x3". */
export function Pilula({ texto, style }: { texto: string; style?: React.CSSProperties }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 800, letterSpacing: '0.02em', padding: '2px 7px', borderRadius: 999, background: 'rgba(var(--ac-1-rgb), 0.16)', color: 'var(--ac-1)', border: '1px solid rgba(var(--ac-1-rgb), 0.4)', whiteSpace: 'nowrap', ...style }}>{texto}</span>
  )
}
