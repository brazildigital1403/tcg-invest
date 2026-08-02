'use client'

import { CSSProperties, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IconClose, IconFilter } from '@/components/ui/Icons'
import { buildLojasUrl, FiltrosLojasState, OpcaoFiltro } from './lojasFiltros'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface FiltrosBaseProps {
  atual: FiltrosLojasState
  estados: OpcaoFiltro[]
  tipos: OpcaoFiltro[]
  especialidades: OpcaoFiltro[]
  totalLojas: number
}

// ─── Corpo compartilhado (sidebar desktop e gaveta mobile renderizam o mesmo) ──

function CorpoFiltros({
  atual, estados, tipos, especialidades, totalLojas, onSelect,
}: FiltrosBaseProps & { onSelect: (next: FiltrosLojasState) => void }) {
  const temFiltroAtivo = !!(atual.q || atual.estado || atual.tipo || atual.especialidade)

  return (
    <>
      <div style={S.group}>
        <h4 style={S.groupTitle}>Estado</h4>
        <div style={S.list}>
          <OpcaoRadio label="Todos" count={totalLojas} ativo={!atual.estado} onClick={() => onSelect({ ...atual, estado: '' })} />
          {estados.map(op => (
            <OpcaoRadio
              key={op.value} label={op.label} count={op.count} ativo={atual.estado === op.value}
              onClick={() => onSelect({ ...atual, estado: op.value })}
            />
          ))}
        </div>
      </div>

      <div style={S.group}>
        <h4 style={S.groupTitle}>Tipo de loja</h4>
        <div style={S.list}>
          <OpcaoRadio label="Todas" count={totalLojas} ativo={!atual.tipo} onClick={() => onSelect({ ...atual, tipo: '' })} />
          {tipos.map(op => (
            <OpcaoRadio
              key={op.value} label={op.label} count={op.count} ativo={atual.tipo === op.value}
              onClick={() => onSelect({ ...atual, tipo: op.value })}
            />
          ))}
        </div>
      </div>

      <div style={S.group}>
        <h4 style={S.groupTitle}>Jogo</h4>
        <div style={S.chipsWrap}>
          {especialidades.map(op => (
            <button
              key={op.value}
              type="button"
              onClick={() => onSelect({ ...atual, especialidade: atual.especialidade === op.value ? '' : op.value })}
              style={{ ...S.chip, ...(atual.especialidade === op.value ? S.chipActive : {}) }}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {temFiltroAtivo && (
        <Link href="/lojas" style={S.clearLink}>
          <IconClose size={11} color="var(--bx-text-3)" /> Limpar filtros
        </Link>
      )}
    </>
  )
}

function OpcaoRadio({ label, count, ativo, onClick }: { label: string; count: number; ativo: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ ...S.item, ...(ativo ? S.itemActive : {}) }}>
      <span style={S.itemLeft}>
        <span style={{ ...S.radio, ...(ativo ? S.radioActive : {}) }} />
        {label}
      </span>
      <span style={{ ...S.itemCount, ...(ativo ? S.itemCountActive : {}) }}>{count}</span>
    </button>
  )
}

// ─── Sidebar (desktop, sticky abaixo do header) ────────────────────────────────

export function FiltrosSidebar(props: FiltrosBaseProps) {
  const router = useRouter()
  function onSelect(next: FiltrosLojasState) { router.push(buildLojasUrl(next)) }

  return (
    <aside className="lojas-sidebar" style={S.sidebar}>
      <CorpoFiltros {...props} onSelect={onSelect} />
    </aside>
  )
}

// ─── Barra + gaveta (mobile: sidebar nao cabe em 375px) ────────────────────────

export function FiltrosGaveta(props: FiltrosBaseProps & { resultCount: number }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    document.body.style.overflow = aberto ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setAberto(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto])

  function onSelect(next: FiltrosLojasState) {
    setAberto(false)
    router.push(buildLojasUrl(next))
  }

  const { atual, resultCount } = props
  const ativosCount = (atual.q ? 1 : 0) + (atual.estado ? 1 : 0) + (atual.tipo ? 1 : 0) + (atual.especialidade ? 1 : 0)

  return (
    <>
      <div className="lojas-mfilter-bar" style={S.mbar}>
        <button type="button" style={S.mbarBtn} onClick={() => setAberto(true)}>
          <IconFilter size={15} />
          Filtros
          {ativosCount > 0 && <span style={S.countBadge}>{ativosCount}</span>}
        </button>
        <span style={S.mbarRes}>{resultCount} {resultCount === 1 ? 'loja' : 'lojas'}</span>
      </div>

      {aberto && (
        <div style={S.backdrop} onClick={() => setAberto(false)}>
          <div style={S.sheet} onClick={e => e.stopPropagation()}>
            <div style={S.sheetHandle} />
            <div style={S.sheetHead}>
              <b style={S.sheetTitle}>Filtros</b>
              <button type="button" style={S.sheetClose} onClick={() => setAberto(false)} aria-label="Fechar">
                <IconClose size={16} color="var(--bx-text-2)" />
              </button>
            </div>
            <CorpoFiltros {...props} onSelect={onSelect} />
          </div>
        </div>
      )}
    </>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  sidebar: {
    width: 240,
    flexShrink: 0,
    padding: '24px 20px 40px 0',
    position: 'sticky',
    top: 78,
    alignSelf: 'flex-start',
    borderRight: '1px solid var(--bx-border)',
    marginRight: 24,
  },

  group: { marginBottom: 24 },
  groupTitle: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'var(--bx-text-3)',
    margin: '0 0 10px',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 2 },

  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
    background: 'transparent',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: 'var(--bx-text-2)',
    fontSize: 13,
    padding: '8px 9px',
    borderRadius: 8,
    transition: 'background 0.15s ease, color 0.15s ease',
  },
  itemActive: {
    background: 'rgba(245,158,11,0.12)',
    color: 'var(--ac-1)',
    fontWeight: 700,
  },
  itemLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  radio: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: '1.5px solid var(--bx-border-2)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    border: '1.5px solid var(--ac-1)',
    background: 'var(--ac-grad)',
    boxShadow: '0 0 0 3px var(--bx-bg) inset',
  },
  itemCount: { fontSize: 11, color: 'var(--bx-text-faint)', fontVariantNumeric: 'tabular-nums' },
  itemCountActive: { color: 'var(--ac-1)', opacity: 0.75 },

  chipsWrap: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--bx-text-2)',
    background: 'var(--bx-surface-2)',
    border: '1px solid var(--bx-border)',
    borderRadius: 8,
    padding: '7px 11px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  chipActive: {
    background: 'rgba(245,158,11,0.15)',
    color: 'var(--ac-1)',
    border: '1px solid rgba(245,158,11,0.4)',
  },

  clearLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--bx-text-3)',
    textDecoration: 'none',
  },

  // ─── Mobile: barra sticky + gaveta ───
  mbar: {
    position: 'sticky',
    top: 62,
    zIndex: 40,
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    background: 'rgba(8,10,15,0.92)',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid var(--bx-border)',
  },
  mbarBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--bx-text)',
    background: 'var(--bx-surface-2)',
    border: '1px solid var(--bx-border-2)',
    borderRadius: 10,
    padding: '9px 13px',
    cursor: 'pointer',
  },
  countBadge: {
    background: 'var(--ac-grad)',
    color: 'var(--bx-brand-ink)',
    fontSize: 10.5,
    fontWeight: 900,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
  mbarRes: { fontSize: 12.5, color: 'var(--bx-text-3)', marginLeft: 'auto' },

  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 200,
  },
  sheet: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    background: 'var(--bx-bg-elev)',
    borderTop: '1px solid var(--bx-border-2)',
    borderRadius: '20px 20px 0 0',
    padding: '8px 20px 24px',
    zIndex: 201,
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 -20px 50px rgba(0,0,0,0.5)',
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 999, background: 'var(--bx-border-2)', margin: '6px auto 16px' },
  sheetHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { fontSize: 15, fontWeight: 800, color: 'var(--bx-text)' },
  sheetClose: { background: 'var(--bx-surface-2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' },
}
