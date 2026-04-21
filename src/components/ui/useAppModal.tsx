'use client'

import { useState, useCallback, createContext, useContext, ReactNode } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ModalType = 'success' | 'error' | 'info' | 'warning'

interface AlertOptions  { message: string; type?: ModalType }
interface PromptOptions { message: string; placeholder?: string; defaultValue?: string; multiline?: boolean; hint?: string; icon?: string }
interface ConfirmOptions { message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; description?: string }

interface ModalState {
  open: boolean
  kind: 'alert' | 'prompt' | 'confirm' | null
  alertOpts?: AlertOptions
  promptOpts?: PromptOptions
  confirmOpts?: ConfirmOptions
  resolve?: (val: any) => void
}

interface ModalContextValue {
  showAlert:   (message: string, type?: ModalType) => Promise<void>
  showPrompt:  (opts: PromptOptions | string)       => Promise<string | null>
  showConfirm: (opts: ConfirmOptions | string)      => Promise<boolean>
}

const ModalContext = createContext<ModalContextValue | null>(null)

export function useAppModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useAppModal must be inside ModalProvider')
  return ctx
}

// ─── Cores por tipo ───────────────────────────────────────────────────────────

const TYPE_CFG = {
  success: { icon: <svg width='16' height='16' viewBox='0 0 20 20' fill='none'><path d='M4 10l4.5 4.5L16 6' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round'/></svg>, color: '#22c55e', border: 'rgba(34,197,94,0.3)',  bg: 'rgba(34,197,94,0.06)'  },
  error:   { icon: <svg width='16' height='16' viewBox='0 0 20 20' fill='none'><path d='M5 5l10 10M15 5L5 15' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round'/></svg>, color: '#ef4444', border: 'rgba(239,68,68,0.3)',  bg: 'rgba(239,68,68,0.06)'  },
  warning: { icon: <svg width='16' height='16' viewBox='0 0 20 20' fill='none'><path d='M10 3L2 17h16L10 3z' stroke='currentColor' strokeWidth='1.4' strokeLinejoin='round'/><path d='M10 9v4' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round'/></svg>, color: '#f59e0b', border: 'rgba(245,158,11,0.3)', bg: 'rgba(245,158,11,0.06)' },
  info:    { icon: 'ℹ', color: '#60a5fa', border: 'rgba(96,165,250,0.3)', bg: 'rgba(96,165,250,0.06)' },
}

const TYPE_LABEL = { success: 'Sucesso!', error: 'Erro', warning: 'Atenção', info: 'Informação' }

// ─── Tokens ───────────────────────────────────────────────────────────────────

const BOX: React.CSSProperties = {
  background: '#0d0f14',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 20,
  width: '100%',
  maxWidth: 480,
  fontFamily: "'DM Sans', system-ui, sans-serif",
  color: '#f0f0f0',
  boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
  overflow: 'hidden',
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
}

const BTN_PRIMARY: React.CSSProperties = {
  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
  border: 'none', color: '#000',
  padding: '12px 28px', borderRadius: 12,
  fontSize: 14, cursor: 'pointer', fontWeight: 700,
  letterSpacing: '-0.01em',
}

const BTN_DANGER: React.CSSProperties = {
  background: 'rgba(239,68,68,0.12)',
  border: '1px solid rgba(239,68,68,0.35)',
  color: '#ef4444',
  padding: '12px 28px', borderRadius: 12,
  fontSize: 14, cursor: 'pointer', fontWeight: 700,
}

const BTN_SECONDARY: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.5)',
  padding: '12px 24px', borderRadius: 12,
  fontSize: 14, cursor: 'pointer', fontWeight: 500,
}

const INPUT_BASE: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12, padding: '14px 16px',
  color: '#f0f0f0', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  lineHeight: 1.5,
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ModalProvider({ children }: { children: ReactNode }) {
  const [state, setState]       = useState<ModalState>({ open: false, kind: null })
  const [promptVal, setPromptVal] = useState('')

  const showAlert = useCallback((message: string, type: ModalType = 'info'): Promise<void> =>
    new Promise(resolve => setState({ open: true, kind: 'alert', alertOpts: { message, type }, resolve }))
  , [])

  const showPrompt = useCallback((opts: PromptOptions | string): Promise<string | null> => {
    const o = typeof opts === 'string' ? { message: opts } : opts
    setPromptVal(o.defaultValue || '')
    return new Promise(resolve => setState({ open: true, kind: 'prompt', promptOpts: o, resolve }))
  }, [])

  const showConfirm = useCallback((opts: ConfirmOptions | string): Promise<boolean> => {
    const o = typeof opts === 'string' ? { message: opts } : opts
    return new Promise(resolve => setState({ open: true, kind: 'confirm', confirmOpts: o, resolve }))
  }, [])

  function close(val: any) {
    state.resolve?.(val)
    setState({ open: false, kind: null })
  }

  return (
    <ModalContext.Provider value={{ showAlert, showPrompt, showConfirm }}>
      {children}

      {/* ── ALERT ── */}
      {state.open && state.kind === 'alert' && (() => {
        const type = state.alertOpts?.type || 'info'
        const cfg  = TYPE_CFG[type]
        return (
          <div style={OVERLAY} onClick={() => close(undefined)}>
            <div style={{ ...BOX, border: `1px solid ${cfg.border}` }} onClick={e => e.stopPropagation()}>
              {/* topo colorido */}
              <div style={{ background: cfg.bg, padding: '24px 28px 20px', borderBottom: `1px solid ${cfg.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: cfg.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: cfg.color, fontWeight: 700, flexShrink: 0 }}>
                    {cfg.icon}
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: cfg.color, letterSpacing: '-0.02em' }}>
                    {TYPE_LABEL[type]}
                  </p>
                </div>
              </div>
              {/* body */}
              <div style={{ padding: '20px 28px 24px' }}>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: 24 }}>
                  {state.alertOpts?.message}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button style={BTN_PRIMARY} onClick={() => close(undefined)}>OK</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── PROMPT ── */}
      {state.open && state.kind === 'prompt' && (() => {
        const o = state.promptOpts!
        const isLink = o.placeholder?.includes('ligapokemon') || o.placeholder?.includes('http')
        return (
          <div style={OVERLAY}>
            <div style={BOX} onClick={e => e.stopPropagation()}>
              {/* header */}
              <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {o.icon || (isLink ? <svg width='16' height='16' viewBox='0 0 20 20' fill='none'><path d='M8 12.5l4-4a3.5 3.5 0 000-5l-.5-.5a3.5 3.5 0 00-5 5L8 9.5' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round'/><path d='M12 7.5l-4 4a3.5 3.5 0 000 5l.5.5a3.5 3.5 0 005-5L12 10.5' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round'/></svg> : <svg width='16' height='16' viewBox='0 0 20 20' fill='none'><path d='M4 14l8-8 3 3-8 8-4 1 1-4z' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round' strokeLinejoin='round'/></svg>)}
                </div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>{o.message}</p>
                  {o.hint && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{o.hint}</p>}
                </div>
              </div>

              {/* body */}
              <div style={{ padding: '20px 28px 24px' }}>
                {/* dica específica para links */}
                {isLink && (
                  <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{flexShrink:0}}><path d="M10 2a6 6 0 014.5 10l-1 1.5H6.5L5.5 12A6 6 0 0110 2z" stroke="rgba(245,158,11,0.8)" strokeWidth="1.3"/><path d="M7.5 16.5h5" stroke="rgba(245,158,11,0.6)" strokeWidth="1.3" strokeLinecap="round"/></svg>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                      Abra a carta na LigaPokemon, copie o link da barra de endereço e cole aqui.
                      Para várias cartas, cole uma por linha.
                    </p>
                  </div>
                )}

                {o.multiline ? (
                  <textarea
                    autoFocus
                    value={promptVal}
                    onChange={e => setPromptVal(e.target.value)}
                    placeholder={o.placeholder || ''}
                    rows={4}
                    style={{ ...INPUT_BASE, resize: 'vertical', minHeight: 100 }}
                    onKeyDown={e => { if (e.key === 'Escape') close(null) }}
                  />
                ) : (
                  <input
                    autoFocus
                    type="text"
                    value={promptVal}
                    onChange={e => setPromptVal(e.target.value)}
                    placeholder={o.placeholder || ''}
                    style={INPUT_BASE}
                    onKeyDown={e => {
                      if (e.key === 'Enter') close(promptVal || null)
                      if (e.key === 'Escape') close(null)
                    }}
                  />
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button style={BTN_SECONDARY} onClick={() => close(null)}>Cancelar</button>
                  <button style={BTN_PRIMARY} onClick={() => close(promptVal || null)}>
                    {isLink ? 'Importar →' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── CONFIRM ── */}
      {state.open && state.kind === 'confirm' && (() => {
        const o = state.confirmOpts!
        return (
          <div style={OVERLAY}>
            <div style={BOX} onClick={e => e.stopPropagation()}>
              {/* header */}
              <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: o.danger ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {o.danger ? <svg width='20' height='20' viewBox='0 0 20 20' fill='none'><path d='M10 3L2 17h16L10 3z' stroke='#ef4444' strokeWidth='1.4' strokeLinejoin='round'/><path d='M10 9v4' stroke='#ef4444' strokeWidth='1.4' strokeLinecap='round'/></svg> : <svg width='20' height='20' viewBox='0 0 20 20' fill='none'><circle cx='10' cy='10' r='7.5' stroke='rgba(255,255,255,0.5)' strokeWidth='1.4'/><path d='M10 9v5M10 7v1' stroke='rgba(255,255,255,0.5)' strokeWidth='1.4' strokeLinecap='round'/></svg>}
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>Confirmar ação</p>
              </div>

              {/* body */}
              <div style={{ padding: '20px 28px 24px' }}>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: o.description ? 8 : 24 }}>
                  {o.message}
                </p>
                {o.description && (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5, marginBottom: 24 }}>
                    {o.description}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button style={BTN_SECONDARY} onClick={() => close(false)}>
                    {o.cancelLabel || 'Cancelar'}
                  </button>
                  <button style={o.danger ? BTN_DANGER : BTN_PRIMARY} onClick={() => close(true)}>
                    {o.confirmLabel || 'Confirmar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </ModalContext.Provider>
  )
}