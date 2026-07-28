'use client'

/**
 * Modal do admin pra ABRIR uma conversa com um usuario.
 *
 * Nao e um "disparador de e-mail": por baixo cria um TICKET com a primeira
 * mensagem do lado admin. O usuario recebe o e-mail, responde em /suporte/[id],
 * e a resposta cai no painel de tickets. Um envio avulso mandaria a resposta
 * pra uma caixa que ninguem le.
 *
 * Serve dois pontos de entrada:
 *   - /admin/tickets  -> conversa nova, e-mail digitado na mao
 *   - /admin/lojas    -> ja vem com o dono e o nome da loja preenchidos
 *
 * Estilo segue o hex do resto do /admin (a area nao usa os tokens do app).
 */

import { useState, useEffect } from 'react'

interface Props {
  aberto: boolean
  onFechar: () => void
  /** Preenche o destinatario. Quando vem, o campo fica travado. */
  emailFixo?: string
  nomeFixo?: string
  assuntoInicial?: string
  mensagemInicial?: string
  /** Chamado depois de criar, com o id do ticket. */
  onCriado?: (ticketId: string) => void
}

const CARD = '#12141b'
const BORDA = 'rgba(255,255,255,0.1)'
const TEXTO = '#f0f0f0'
const MUTED = 'rgba(255,255,255,0.5)'
const AMBAR = '#f59e0b'

export default function NovaConversaModal({
  aberto, onFechar, emailFixo, nomeFixo, assuntoInicial, mensagemInicial, onCriado,
}: Props) {
  const [email, setEmail]       = useState(emailFixo || '')
  const [assunto, setAssunto]   = useState(assuntoInicial || '')
  const [mensagem, setMensagem] = useState(mensagemInicial || '')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro]         = useState<string | null>(null)
  const [ok, setOk]             = useState<string | null>(null)

  // Reabrir com outro destinatario tem que trocar os campos — sem isso o
  // modal guardaria o e-mail da loja anterior e a mensagem iria pro alvo errado.
  useEffect(() => {
    if (!aberto) return
    setEmail(emailFixo || '')
    setAssunto(assuntoInicial || '')
    setMensagem(mensagemInicial || '')
    setErro(null); setOk(null)
  }, [aberto, emailFixo, assuntoInicial, mensagemInicial])

  if (!aberto) return null

  const podeEnviar = email.trim().length > 3 && assunto.trim().length >= 3 && mensagem.trim().length >= 10

  async function enviar() {
    if (!podeEnviar || enviando) return
    setEnviando(true); setErro(null); setOk(null)
    try {
      const res = await fetch('/api/admin/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), subject: assunto.trim(), message: mensagem.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErro(d.error || 'Falha ao enviar'); return }

      // O e-mail pode falhar sem derrubar a conversa. Dizer "enviado" nos dois
      // casos esconderia justamente o caso que precisa de acao.
      setOk(d.emailEnviado
        ? `Conversa criada e e-mail enviado para ${d.para}.`
        : `Conversa criada, mas o E-MAIL NAO SAIU para ${d.para}. Ela aparece pro usuario no app; confira o log.`)
      setAssunto(''); setMensagem('')
      onCriado?.(d.ticketId)
    } catch (e: any) {
      setErro(e?.message || 'Erro de rede')
    } finally {
      setEnviando(false)
    }
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    background: '#0d0f14', border: `1px solid ${BORDA}`, color: TEXTO,
    fontSize: 13, fontFamily: 'inherit', outline: 'none',
  }
  const label: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase',
    letterSpacing: '0.06em', display: 'block', marginBottom: 6,
  }

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, background: CARD, border: `1px solid ${BORDA}`,
          borderRadius: 16, padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif",
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 800, color: TEXTO, letterSpacing: '-0.02em' }}>
          Falar com o usuário
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 12.5, color: MUTED, lineHeight: 1.6 }}>
          Abre uma conversa no suporte. A pessoa recebe por e-mail e responde dentro do app —
          a resposta volta pra esta tela de tickets.
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>E-mail do usuário</label>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            readOnly={!!emailFixo}
            placeholder="pessoa@email.com"
            style={{ ...input, opacity: emailFixo ? 0.6 : 1, cursor: emailFixo ? 'default' : 'text' }}
          />
          {nomeFixo && (
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: MUTED }}>{nomeFixo}</p>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Assunto</label>
          <input
            value={assunto}
            onChange={e => setAssunto(e.target.value.slice(0, 200))}
            placeholder="Ex: Informações para validar sua loja"
            style={input}
          />
        </div>

        <div style={{ marginBottom: 6 }}>
          <label style={label}>Mensagem</label>
          <textarea
            value={mensagem}
            onChange={e => setMensagem(e.target.value.slice(0, 10000))}
            rows={7}
            placeholder="Escreva como se estivesse respondendo um ticket."
            style={{ ...input, resize: 'vertical', lineHeight: 1.6 }}
          />
          <p style={{ margin: '6px 0 0', fontSize: 11, color: MUTED, textAlign: 'right' }}>
            {mensagem.trim().length} / 10.000 · mínimo 10
          </p>
        </div>

        {erro && (
          <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#ef4444', lineHeight: 1.5 }}>{erro}</p>
        )}
        {ok && (
          <p style={{ margin: '10px 0 0', fontSize: 12.5, color: ok.includes('NAO SAIU') ? '#f59e0b' : '#22c55e', lineHeight: 1.5 }}>
            {ok}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onFechar}
            style={{
              padding: '10px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700,
              background: 'transparent', border: `1px solid ${BORDA}`, color: MUTED,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Fechar
          </button>
          <button
            onClick={enviar}
            disabled={!podeEnviar || enviando}
            style={{
              padding: '10px 22px', borderRadius: 9, fontSize: 13, fontWeight: 800,
              background: podeEnviar && !enviando ? `linear-gradient(135deg,${AMBAR},#ef4444)` : 'rgba(255,255,255,0.07)',
              border: 'none', color: podeEnviar && !enviando ? '#000' : 'rgba(255,255,255,0.3)',
              cursor: podeEnviar && !enviando ? 'pointer' : 'default', fontFamily: 'inherit',
              transition: 'transform 0.15s ease',
            }}
          >
            {enviando ? 'Enviando...' : 'Enviar mensagem'}
          </button>
        </div>
      </div>
    </div>
  )
}
