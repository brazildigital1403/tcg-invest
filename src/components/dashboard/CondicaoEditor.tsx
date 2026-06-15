'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const CONDICOES = ['NM', 'LP', 'MP', 'HP'] as const
const CORES: Record<string, string> = { NM: '#22c55e', LP: '#60a5fa', MP: '#f59e0b', HP: '#ef4444' }

interface Props {
  userCardId: string
  quantity: number
  condicoes: Record<string, number> | null
  isPro: boolean
  onSaved?: (novas: Record<string, number> | null) => void
}

export default function CondicaoEditor({ userCardId, quantity, condicoes, isPro, onSaved }: Props) {
  const qtd = quantity || 1
  const keysAtuais = condicoes ? Object.keys(condicoes).filter(k => (condicoes[k] || 0) > 0) : []

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [single, setSingle] = useState<string>(keysAtuais.length === 1 ? keysAtuais[0] : '')
  const [splitOn, setSplitOn] = useState<boolean>(keysAtuais.length > 1)
  const [split, setSplit] = useState<Record<string, number>>(keysAtuais.length > 1 && condicoes ? { ...condicoes } : {})

  function open() {
    const k = condicoes ? Object.keys(condicoes).filter(c => (condicoes[c] || 0) > 0) : []
    setSingle(k.length === 1 ? k[0] : '')
    setSplitOn(k.length > 1)
    setSplit(k.length > 1 && condicoes ? { ...condicoes } : {})
    setEditing(true)
  }

  function bump(c: string, d: number) {
    setSplit(prev => {
      const cur = { ...prev }
      const next = Math.max(0, (cur[c] || 0) + d)
      if (next === 0) { delete cur[c] } else { cur[c] = next }
      return cur
    })
  }

  function toggleSplit() {
    const on = !splitOn
    if (on && Object.keys(split).length === 0) setSplit({ NM: qtd })
    setSplitOn(on)
  }

  const splitTotal = Object.values(split).reduce((a: number, n) => a + Number(n), 0)

  async function save() {
    let novas: Record<string, number> | null = null
    if (splitOn) {
      if (splitTotal !== qtd) return
      const entries = Object.entries(split).filter(([, v]) => Number(v) > 0)
      novas = entries.length ? entries.reduce((acc, [k, v]) => { acc[k] = Number(v); return acc }, {} as Record<string, number>) : null
    } else {
      novas = single ? { [single]: qtd } : null
    }
    setSaving(true)
    const { error } = await supabase.from('user_cards').update({ condicoes: novas }).eq('id', userCardId)
    setSaving(false)
    if (error) { console.error('[CondicaoEditor] update error:', error); return }
    onSaved?.(novas)
    setEditing(false)
  }

  // ── Chip (estado atual) ──
  if (!editing) {
    return (
      <button onClick={open} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {keysAtuais.length === 0 ? (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', border: '1px dashed rgba(255,255,255,0.18)', borderRadius: 6, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <svg width="9" height="9" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            definir condição
          </span>
        ) : (
          keysAtuais.map(k => (
            <span key={k} style={{ fontSize: 10, fontWeight: 700, color: CORES[k] || '#fff', background: (CORES[k] || '#ffffff') + '1a', borderRadius: 6, padding: '2px 7px' }}>
              {condicoes && condicoes[k] > 1 ? `${condicoes[k]} ` : ''}{k}
            </span>
          ))
        )}
      </button>
    )
  }

  // ── Editor inline ──
  const stepBtn: React.CSSProperties = { width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }
  const splitInvalido = splitOn && splitTotal !== qtd

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
        Condição{qtd > 1 ? ` · ${qtd} cópias` : ''}
      </p>

      {!splitOn && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {['', ...CONDICOES].map(c => {
            const active = single === c
            const cor = c ? CORES[c] : 'rgba(255,255,255,0.4)'
            return (
              <button key={c || 'na'} onClick={() => setSingle(c)}
                style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: `1px solid ${active ? cor : 'rgba(255,255,255,0.1)'}`, background: active ? cor + '1a' : 'transparent', color: active ? cor : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: active ? 700 : 400 }}>
                {c || '—'}
              </button>
            )
          })}
        </div>
      )}

      {qtd > 1 && isPro && (
        <>
          <button onClick={toggleSplit}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, color: splitOn ? '#f59e0b' : 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, border: `1px solid ${splitOn ? '#f59e0b' : 'rgba(255,255,255,0.25)'}`, background: splitOn ? 'rgba(245,158,11,0.15)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {splitOn && <svg width="8" height="8" viewBox="0 0 20 20" fill="none"><path d="M4 10l4.5 4.5L16 6" stroke="#f59e0b" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </span>
            Dividir por condição (cópia a cópia)
          </button>

          {splitOn && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {CONDICOES.map(c => {
                const nn = split[c] || 0
                return (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: CORES[c], background: CORES[c] + '1a', padding: '2px 7px', borderRadius: 5 }}>{c}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => bump(c, -1)} style={stepBtn}>−</button>
                      <span style={{ fontSize: 11, fontWeight: 700, minWidth: 14, textAlign: 'center', color: '#f0f0f0' }}>{nn}</span>
                      <button onClick={() => bump(c, 1)} style={stepBtn}>+</button>
                    </div>
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 5 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Distribuídas</span>
                <span style={{ color: splitTotal === qtd ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{splitTotal} / {qtd}</span>
              </div>
            </div>
          )}
        </>
      )}

      {qtd > 1 && !isPro && (
        <button onClick={() => { window.location.href = '/minha-conta' }}
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'flex-start', gap: 6, textAlign: 'left', fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><rect x="4" y="9" width="12" height="8" rx="1.5" stroke="#f59e0b" strokeWidth="1.5"/><path d="M7 9V6.5a3 3 0 016 0V9" stroke="#f59e0b" strokeWidth="1.5"/></svg>
          <span>Anote a condição de cada cópia (1 NM, 1 LP…) — <span style={{ color: '#f59e0b', fontWeight: 700 }}>recurso PRO</span></span>
        </button>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={save} disabled={saving || splitInvalido}
          style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: '6px', borderRadius: 7, border: 'none', background: splitInvalido ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #f59e0b, #ef4444)', color: splitInvalido ? 'rgba(255,255,255,0.3)' : '#000', cursor: splitInvalido ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? '...' : 'Salvar'}
        </button>
        <button onClick={() => setEditing(false)}
          style={{ fontSize: 11, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
