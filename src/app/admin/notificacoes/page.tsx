'use client'

import { useState } from 'react'

const GOLD = '#f59e0b'
const NOVIDADE = '#a78bfa'
const MUTED = 'rgba(255,255,255,0.45)'

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: MUTED,
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em',
}
const INPUT: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: '10px 12px', color: '#f0f0f0', fontSize: 14,
  fontFamily: 'inherit', outline: 'none',
}

function tabStyle(ativo: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
    background: ativo ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
    color: ativo ? GOLD : 'rgba(255,255,255,0.6)',
    border: `1px solid ${ativo ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`,
  }
}

export default function AdminNotificacoesPage() {
  const [alvo, setAlvo] = useState<'todos' | 'usuario'>('todos')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const podeEnviar =
    title.trim().length > 0 &&
    message.trim().length > 0 &&
    !sending &&
    (alvo === 'todos' || email.trim().length > 0)

  async function enviar() {
    setSending(true)
    setResult(null)
    try {
      const r = await fetch('/api/admin/notificacoes/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          link: link.trim(),
          ...(alvo === 'usuario' ? { email: email.trim() } : {}),
        }),
      })
      const j = await r.json()
      if (!r.ok) {
        setResult({ ok: false, text: j?.error || 'Erro ao enviar.' })
      } else {
        setResult({ ok: true, text: `Enviado para ${j.enviados} usuario(s).` })
        setTitle(''); setMessage(''); setLink(''); setEmail('')
      }
    } catch {
      setResult({ ok: false, text: 'Erro de rede.' })
    } finally {
      setSending(false)
      setConfirming(false)
    }
  }

  function onClickEnviar() {
    if (!podeEnviar) return
    // So o broadcast pra TODOS pede confirmacao (acao ampla). Usuario unico envia direto.
    if (alvo === 'todos') setConfirming(true)
    else enviar()
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: 760, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: '#f0f0f0' }}>
        Avisos
      </h1>
      <p style={{ color: MUTED, fontSize: 13, margin: '0 0 24px' }}>
        Envie um aviso para <b style={{ color: '#f0f0f0' }}>todos os usuarios</b> ou para <b style={{ color: '#f0f0f0' }}>um usuario especifico</b>. Aparece no sino.
      </p>

      {/* Formulario */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
        {/* Destinatario */}
        <div style={{ marginBottom: 16 }}>
          <label style={LABEL}>Destinatario</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setAlvo('todos')} style={tabStyle(alvo === 'todos')}>Todos os usuarios</button>
            <button onClick={() => setAlvo('usuario')} style={tabStyle(alvo === 'usuario')}>Um usuario especifico</button>
          </div>
        </div>

        {alvo === 'usuario' && (
          <div style={{ marginBottom: 16 }}>
            <label style={LABEL}>E-mail do usuario</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              placeholder="usuario@email.com" style={INPUT} />
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
              A notificacao vai so pra esse usuario.
            </p>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={LABEL}>Titulo</label>
          <input value={title} maxLength={120} onChange={e => setTitle(e.target.value)}
            placeholder="Novidade: cartas graduadas chegaram!" style={INPUT} />
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4, textAlign: 'right' }}>{title.length}/120</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={LABEL}>Mensagem</label>
          <textarea value={message} maxLength={500} onChange={e => setMessage(e.target.value)}
            placeholder="Agora voce pode marcar suas cartas como graduadas (PSA, BGS, CGC e mais) e anuncia-las no marketplace."
            rows={4} style={{ ...INPUT, resize: 'vertical', lineHeight: 1.5 }} />
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4, textAlign: 'right' }}>{message.length}/500</p>
        </div>

        <div>
          <label style={LABEL}>Link (opcional)</label>
          <input value={link} onChange={e => setLink(e.target.value)}
            placeholder="/marketplace" style={INPUT} />
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            Ao clicar na notificacao, o usuario vai para esse link. Ex.: <code>/marketplace</code>
          </p>
        </div>
      </div>

      {/* Preview */}
      <div style={{ marginBottom: 20 }}>
        <p style={LABEL}>Previa (como aparece no sino)</p>
        <div style={{ background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', maxWidth: 360 }}>
          <div style={{ padding: '12px 16px', background: NOVIDADE + '12' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: NOVIDADE, flexShrink: 0, marginTop: 6 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: NOVIDADE, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {title.trim() || 'Titulo do aviso'}
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                  {message.trim() || 'A mensagem aparece aqui.'}
                </p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>agora</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resultado */}
      {result && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: result.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${result.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: result.ok ? '#22c55e' : '#ef4444',
        }}>
          {result.ok ? '\u2713 ' : ''}{result.text}
        </div>
      )}

      {/* Acao */}
      {!confirming ? (
        <button onClick={onClickEnviar} disabled={!podeEnviar}
          style={{
            background: podeEnviar ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'rgba(255,255,255,0.06)',
            color: podeEnviar ? '#000' : 'rgba(255,255,255,0.3)',
            border: 'none', borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 700,
            cursor: podeEnviar ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
          }}>
          {alvo === 'todos' ? 'Enviar para todos' : 'Enviar para o usuario'}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#f0f0f0', fontWeight: 600 }}>
            Isso envia para <b>TODOS</b> os usuarios. Confirmar?
          </span>
          <button onClick={enviar} disabled={sending}
            style={{ background: GOLD, color: '#000', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: sending ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {sending ? 'Enviando...' : 'Sim, enviar'}
          </button>
          <button onClick={() => setConfirming(false)} disabled={sending}
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
