'use client'

import { CSSProperties, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

// ─── Constantes ───────────────────────────────────────────────────────────────

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const TIPOS = [
  { value: '', label: 'Todas' },
  { value: 'fisica', label: 'Física' },
  { value: 'online', label: 'Online' },
  { value: 'ambas', label: 'Física + Online' },
]

const ESPECIALIDADES = [
  { value: '', label: 'Todos os jogos' },
  { value: 'pokemon', label: 'Pokémon' },
  { value: 'magic', label: 'Magic' },
  { value: 'yugioh', label: 'Yu-Gi-Oh!' },
  { value: 'lorcana', label: 'Lorcana' },
  { value: 'digimon', label: 'Digimon' },
  { value: 'outros', label: 'Outros' },
]

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  initialQ: string
  initialEstado: string
  initialTipo: string
  initialEspecialidade: string
}

export default function FiltrosGuia({
  initialQ,
  initialEstado,
  initialTipo,
  initialEspecialidade,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [q, setQ] = useState(initialQ)
  const [estado, setEstado] = useState(initialEstado)
  const [tipo, setTipo] = useState(initialTipo)
  const [especialidade, setEspecialidade] = useState(initialEspecialidade)

  function aplicar(overrides: Partial<Props> = {}) {
    const finalQ             = overrides.initialQ ?? q
    const finalEstado        = overrides.initialEstado ?? estado
    const finalTipo          = overrides.initialTipo ?? tipo
    const finalEspecialidade = overrides.initialEspecialidade ?? especialidade

    const params = new URLSearchParams()
    if (finalQ.trim())             params.set('q', finalQ.trim())
    if (finalEstado.trim())        params.set('estado', finalEstado.trim())
    if (finalTipo.trim())          params.set('tipo', finalTipo.trim())
    if (finalEspecialidade.trim()) params.set('especialidade', finalEspecialidade.trim())

    const queryString = params.toString()
    startTransition(() => {
      router.push(queryString ? `/lojas?${queryString}` : '/lojas')
    })
  }

  function onSelectTipo(valor: string) {
    setTipo(valor)
    aplicar({ initialTipo: valor })
  }

  function onSelectEspecialidade(valor: string) {
    setEspecialidade(valor)
    aplicar({ initialEspecialidade: valor })
  }

  function limpar() {
    setQ('')
    setEstado('')
    setTipo('')
    setEspecialidade('')
    startTransition(() => router.push('/lojas'))
  }

  const temFiltroAtivo = q || estado || tipo || especialidade

  return (
    <section style={S.wrap}>
      {/* Linha 1: busca + estado + botão */}
      <div style={S.topRow}>
        <div style={S.searchBlock}>
          <label style={S.label}>Buscar loja</label>
          <div style={S.searchWrap}>
            <span style={S.searchIcon}>
              {/* SVG inline (evita cross-boundary server→client import) */}
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="9" cy="9" r="5.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4"/>
                <path d="M13 13l3.5 3.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </span>
            <input
              type="text"
              placeholder="Nome da loja..."
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') aplicar() }}
              style={S.searchInput}
              disabled={pending}
            />
          </div>
        </div>

        <div style={S.estadoBlock}>
          <label style={S.label}>Estado</label>
          <select
            value={estado}
            onChange={e => {
              setEstado(e.target.value)
              aplicar({ initialEstado: e.target.value })
            }}
            style={S.select}
            disabled={pending}
          >
            <option value="">Todos</option>
            {UFS.map(uf => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
        </div>

        <div style={S.actionBlock}>
          <button
            type="button"
            onClick={() => aplicar()}
            style={S.searchBtn}
            disabled={pending}
          >
            {pending ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Linha 2: chips de tipo */}
      <div style={S.chipsBlock}>
        <span style={S.chipsLabel}>Tipo</span>
        <div style={S.chipsList}>
          {TIPOS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => onSelectTipo(t.value)}
              style={{
                ...S.chip,
                ...(tipo === t.value ? S.chipActive : {}),
              }}
              disabled={pending}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Linha 3: chips de especialidade */}
      <div style={S.chipsBlock}>
        <span style={S.chipsLabel}>Jogo</span>
        <div style={S.chipsList}>
          {ESPECIALIDADES.map(e => (
            <button
              key={e.value}
              type="button"
              onClick={() => onSelectEspecialidade(e.value)}
              style={{
                ...S.chip,
                ...(especialidade === e.value ? S.chipActive : {}),
              }}
              disabled={pending}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Limpar filtros */}
      {temFiltroAtivo && (
        <button type="button" onClick={limpar} style={S.clearBtn} disabled={pending}>
          ✕ Limpar filtros
        </button>
      )}
    </section>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  wrap: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    width: '100%',
    boxSizing: 'border-box',
  },

  topRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 140px auto',
    gap: 12,
    alignItems: 'end',
  },

  searchBlock: { display: 'flex', flexDirection: 'column' },
  estadoBlock: { display: 'flex', flexDirection: 'column' },
  actionBlock: { display: 'flex', flexDirection: 'column' },

  label: {
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: 5,
    display: 'block',
  },

  searchWrap: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  searchInput: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '12px 14px 12px 40px',
    color: '#f0f0f0',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },

  select: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '12px 14px',
    color: '#f0f0f0',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
    cursor: 'pointer',
    appearance: 'none',
  },

  searchBtn: {
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    border: 'none',
    color: '#000',
    fontSize: 13,
    fontWeight: 700,
    padding: '12px 22px',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },

  chipsBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  chipsLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    minWidth: 38,
  },
  chipsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    fontSize: 12,
    fontWeight: 600,
    padding: '7px 14px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.65)',
    border: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.12s ease',
  },
  chipActive: {
    background: 'rgba(245,158,11,0.15)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.35)',
  },

  clearBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
    alignSelf: 'flex-start',
  },
}