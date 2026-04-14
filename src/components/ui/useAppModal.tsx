'use client'

import { useState, useCallback, createContext, useContext, ReactNode } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ModalType = 'success' | 'error' | 'info' | 'warning'

interface AlertOptions { message: string; type?: ModalType }
interface PromptOptions { message: string; placeholder?: string; defaultValue?: string; multiline?: boolean }
interface ConfirmOptions { message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }

interface ModalState {
  open: boolean
  kind: 'alert' | 'prompt' | 'confirm' | null
  alertOpts?: AlertOptions
  promptOpts?: PromptOptions
  confirmOpts?: ConfirmOptions
  resolve?: (val: any) => void
}

interface ModalContextValue {
  showAlert: (message: string, type?: ModalType) => Promise<void>
  showPrompt: (opts: PromptOptions | string) => Promise<string | null>
  showConfirm: (opts: ConfirmOptions | string) => Promise<boolean>
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ModalContext = createContext<ModalContextValue | null>(null)

export function useAppModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useAppModal must be inside ModalProvider')
  return ctx
}

// ─── Cores por tipo ───────────────────────────────────────────────────────────

const typeConfig: Record<ModalType, { icon: string; color: string; bg: string; border: string }> = {
  success: { icon: '✓', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)' },
  error:   { icon: '✕', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' },
  warning: { icon: '⚠', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
  info:    { icon: 'ℹ', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.25)' },
}

// ─── Estilos base ─────────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed' as const, inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  box: {
    background: '#0f1117', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 460,
    fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0',
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  },
  title: { fontSize: 17, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' },
  msg: { fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 24 },
  input: {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, padding: '12px 14px', color: '#f0f0f0', fontSize: 14,
    outline: 'none', boxSizing: 'border-box' as const, marginBottom: 20,
    resize: 'vertical' as const, minHeight: 80,
  },
  inputSingle: {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, padding: '12px 14px', color: '#f0f0f0', fontSize: 14,
    outline: 'none', boxSizing: 'border-box' as const, marginBottom: 20,
  },
  btnRow: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  btnSecondary: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.6)', padding: '10px 20px', borderRadius: 10,
    fontSize: 14, cursor: 'pointer', fontWeight: 500,
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none',
    color: '#000', padding: '10px 24px', borderRadius: 10,
    fontSize: 14, cursor: 'pointer', fontWeight: 700,
  },
  btnDanger: {
    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#ef4444', padding: '10px 24px', borderRadius: 10,
    fontSize: 14, cursor: 'pointer', fontWeight: 700,
  },
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ModalState>({ open: false, kind: null })
  const [promptValue, setPromptValue] = useState('')

  const showAlert = useCallback((message: string, type: ModalType = 'info'): Promise<void> => {
    return new Promise(resolve => {
      setState({ open: true, kind: 'alert', alertOpts: { message, type }, resolve })
    })
  }, [])

  const showPrompt = useCallback((opts: PromptOptions | string): Promise<string | null> => {
    const o = typeof opts === 'string' ? { message: opts } : opts
    setPromptValue(o.defaultValue || '')
    return new Promise(resolve => {
      setState({ open: true, kind: 'prompt', promptOpts: o, resolve })
    })
  }, [])

  const showConfirm = useCallback((opts: ConfirmOptions | string): Promise<boolean> => {
    const o = typeof opts === 'string' ? { message: opts } : opts
    return new Promise(resolve => {
      setState({ open: true, kind: 'confirm', confirmOpts: o, resolve })
    })
  }, [])

  function close(val: any) {
    state.resolve?.(val)
    setState({ open: false, kind: null })
  }

  const value: ModalContextValue = { showAlert, showPrompt, showConfirm }

  return (
    <ModalContext.Provider value={value}>
      {children}

      {state.open && state.kind === 'alert' && (() => {
        const cfg = typeConfig[state.alertOpts?.type || 'info']
        return (
          <div style={S.overlay} onClick={() => close(undefined)}>
            <div style={{ ...S.box, background: cfg.bg, border: `1px solid ${cfg.border}` }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: cfg.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: cfg.color, fontWeight: 700, flexShrink: 0 }}>
                  {cfg.icon}
                </div>
                <p style={{ ...S.title, color: cfg.color, marginBottom: 0 }}>
                  {state.alertOpts?.type === 'success' ? 'Sucesso!' : state.alertOpts?.type === 'error' ? 'Erro' : state.alertOpts?.type === 'warning' ? 'Atenção' : 'Informação'}
                </p>
              </div>
              <p style={{ ...S.msg, marginBottom: 20 }}>{state.alertOpts?.message}</p>
              <div style={S.btnRow}>
                <button style={S.btnPrimary} onClick={() => close(undefined)}>OK</button>
              </div>
            </div>
          </div>
        )
      })()}

      {state.open && state.kind === 'prompt' && (
        <div style={S.overlay}>
          <div style={S.box} onClick={e => e.stopPropagation()}>
            <p style={S.title}>{state.promptOpts?.message}</p>
            {state.promptOpts?.multiline ? (
              <textarea
                autoFocus
                value={promptValue}
                onChange={e => setPromptValue(e.target.value)}
                placeholder={state.promptOpts?.placeholder || ''}
                style={S.input}
                onKeyDown={e => { if (e.key === 'Escape') close(null) }}
              />
            ) : (
              <input
                autoFocus
                type="text"
                value={promptValue}
                onChange={e => setPromptValue(e.target.value)}
                placeholder={state.promptOpts?.placeholder || ''}
                style={S.inputSingle}
                onKeyDown={e => { if (e.key === 'Enter') close(promptValue || null); if (e.key === 'Escape') close(null) }}
              />
            )}
            <div style={S.btnRow}>
              <button style={S.btnSecondary} onClick={() => close(null)}>Cancelar</button>
              <button style={S.btnPrimary} onClick={() => close(promptValue || null)}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {state.open && state.kind === 'confirm' && (
        <div style={S.overlay}>
          <div style={S.box} onClick={e => e.stopPropagation()}>
            <p style={S.title}>Confirmar ação</p>
            <p style={S.msg}>{state.confirmOpts?.message}</p>
            <div style={S.btnRow}>
              <button style={S.btnSecondary} onClick={() => close(false)}>
                {state.confirmOpts?.cancelLabel || 'Cancelar'}
              </button>
              <button style={state.confirmOpts?.danger ? S.btnDanger : S.btnPrimary} onClick={() => close(true)}>
                {state.confirmOpts?.confirmLabel || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  )
}