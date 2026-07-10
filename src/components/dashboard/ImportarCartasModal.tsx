'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Props {
  userId: string | null
  onClose: () => void
  onAdded: () => void
}

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const MUTED = 'rgba(255,255,255,0.4)'
const CAP = 32
const MAX_LINHAS = 40

type Linha = {
  ordem: number
  linha: string
  quantidade: number
  card_id: string | null
  card_name: string | null
  card_set: string | null
  card_number: string | null
  card_image: string | null
  status: string
}

const PLACEHOLDER = `2x Avalugg 024/086
Charizard ex 199/165
Pikachu VMAX 44/185`

function msgErro(status: string): string {
  if (status === 'sem_numero') return 'Falta o número. Ex: Avalugg 024/086'
  return 'Não encontrada — confira o número e o set'
}

export default function ImportarCartasModal({ userId, onClose, onAdded }: Props) {
  const [texto, setTexto] = useState('')
  const [analisando, setAnalisando] = useState(false)
  const [resultado, setResultado] = useState<Linha[] | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const [erroMsg, setErroMsg] = useState('')

  const linhasInput = texto.split('\n').map((l) => l.trim()).filter(Boolean)
  const okItems = (resultado || []).filter((r) => r.status === 'ok')
  const erroItems = (resultado || []).filter((r) => r.status !== 'ok')
  const totalOk = okItems.length
  const aAdicionar = Math.min(totalOk, CAP)
  const excedeu = totalOk > CAP

  async function analisar() {
    setErroMsg('')
    const linhas = linhasInput.slice(0, MAX_LINHAS)
    if (linhas.length === 0) {
      setErroMsg('Cole pelo menos uma carta.')
      return
    }
    setAnalisando(true)
    setResultado(null)
    try {
      const { data, error } = await supabase.rpc('analisar_import_lote', { linhas })
      if (error) throw error
      setResultado((data || []) as Linha[])
    } catch {
      setErroMsg('Não foi possível analisar. Tente de novo.')
    } finally {
      setAnalisando(false)
    }
  }

  async function adicionar() {
    if (!userId) {
      setErroMsg('Faça login para adicionar.')
      return
    }
    const items = okItems
      .slice(0, CAP)
      .map((r) => ({ card_id: r.card_id, quantidade: r.quantidade }))
    if (items.length === 0) return
    setAdicionando(true)
    setErroMsg('')
    try {
      const { data, error } = await supabase.rpc('importar_cartas_lote', { items })
      if (error) throw error
      if (data && (data as any).erro) throw new Error((data as any).erro)
      onAdded()
      onClose()
    } catch {
      setErroMsg('Não foi possível adicionar. Tente de novo.')
      setAdicionando(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#12141a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#f0f0f0' }}>
              Importar várias cartas
            </p>
            <p style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Uma carta por linha. Até {CAP} por vez.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: MUTED,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
          {!resultado ? (
            <>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={PLACEHOLDER}
                rows={6}
                autoFocus
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  color: '#f0f0f0',
                  fontSize: 14,
                  lineHeight: 1.7,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  resize: 'vertical',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(245,158,11,0.5)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
              <p style={{ fontSize: 12, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
                Formato: <span style={{ color: 'rgba(255,255,255,0.6)' }}>Nome + número/set</span> (ex:{' '}
                <span style={{ fontFamily: 'monospace' }}>Avalugg 024/086</span>). Sem o número, a linha não é
                reconhecida. Quantidade com <span style={{ fontFamily: 'monospace' }}>2x</span> no início.
              </p>
              {erroMsg && <p style={{ fontSize: 13, color: '#ef4444', marginTop: 10 }}>{erroMsg}</p>}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={chip('#22c55e')}>{totalOk} {totalOk === 1 ? 'pronta' : 'prontas'}</span>
                {erroItems.length > 0 && (
                  <span style={chip('#ef4444')}>{erroItems.length} com erro</span>
                )}
                {excedeu && <span style={chip('#f59e0b')}>máx {CAP} por vez</span>}
              </div>

              <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                {(resultado || []).map((r, i) => {
                  const ok = r.status === 'ok'
                  return (
                    <div
                      key={r.ordem}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 12px',
                        borderBottom: i < (resultado || []).length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        background: ok ? 'transparent' : 'rgba(239,68,68,0.06)',
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 39,
                          borderRadius: 4,
                          flexShrink: 0,
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {ok && r.card_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.card_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ color: MUTED, fontSize: 13 }}>?</span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {ok ? (
                          <>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#f0f0f0',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {r.card_name}
                            </div>
                            <div style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.card_set}
                              {r.card_number ? ` · ${r.card_number}` : ''}
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.linha}
                            </div>
                            <div style={{ fontSize: 12, color: '#ef4444' }}>{msgErro(r.status)}</div>
                          </>
                        )}
                      </div>
                      {ok && (
                        <span
                          style={{
                            fontSize: 12,
                            color: 'rgba(255,255,255,0.6)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 8,
                            padding: '2px 8px',
                            flexShrink: 0,
                          }}
                        >
                          {r.quantidade}x
                        </span>
                      )}
                      <span style={{ flexShrink: 0, display: 'flex', color: ok ? '#22c55e' : '#ef4444' }}>
                        {ok ? (
                          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 10l2.2 2.2 4.8-4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" /><path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>

              <p style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>
                Linhas com erro são ignoradas. Corrija o texto e analise de novo, se quiser.
              </p>
              {erroMsg && <p style={{ fontSize: 13, color: '#ef4444', marginTop: 8 }}>{erroMsg}</p>}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            flexShrink: 0,
          }}
        >
          {resultado && (
            <button
              onClick={() => {
                setResultado(null)
                setErroMsg('')
              }}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: MUTED,
                padding: '10px 18px',
                borderRadius: 10,
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Voltar
            </button>
          )}
          {!resultado ? (
            <button
              onClick={analisar}
              disabled={analisando || linhasInput.length === 0}
              style={{
                background: linhasInput.length > 0 ? BRAND : 'rgba(255,255,255,0.06)',
                border: 'none',
                color: linhasInput.length > 0 ? '#000' : MUTED,
                padding: '10px 22px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: linhasInput.length > 0 && !analisando ? 'pointer' : 'default',
                opacity: analisando ? 0.7 : 1,
              }}
            >
              {analisando ? 'Analisando...' : 'Analisar'}
            </button>
          ) : (
            <button
              onClick={adicionar}
              disabled={adicionando || aAdicionar === 0}
              style={{
                background: aAdicionar > 0 ? BRAND : 'rgba(255,255,255,0.06)',
                border: 'none',
                color: aAdicionar > 0 ? '#000' : MUTED,
                padding: '10px 22px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: aAdicionar > 0 && !adicionando ? 'pointer' : 'default',
                opacity: adicionando ? 0.7 : 1,
                boxShadow: aAdicionar > 0 ? '0 0 20px rgba(245,158,11,0.2)' : 'none',
              }}
            >
              {adicionando ? 'Adicionando...' : `Adicionar ${aAdicionar} carta${aAdicionar !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function chip(cor: string): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 8,
    background: `${cor}1a`,
    color: cor,
  }
}
