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
 *   - /admin/tickets  -> conversa nova, destinatario BUSCADO por nome ou e-mail
 *   - /admin/lojas    -> ja vem com o dono e o nome da loja preenchidos
 *
 * ★ O CAMPO ERA E-MAIL CRU E ISSO NAO FUNCIONAVA (01/10/2026, achado do Du ao
 * tentar falar com uma usuaria): ninguem sabe de cor o e-mail de 450 pessoas.
 * Ele digitou "barbara" e o campo esperava `barbara...@gmail.com` exato. Agora
 * o campo busca em `/api/admin/users?q=`, que JA procurava por nome, e-mail e
 * username com sanitizacao -- nao precisou de rota nova, so de usar a que
 * existia.
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

/** O minimo pra reconhecer a pessoa na lista sem poluir. */
type Achado = {
  id: string
  email: string
  name: string | null
  username: string | null
  city: string | null
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
  // O que a pessoa digitou no campo de busca, e o usuario ESCOLHIDO na lista.
  const [busca, setBusca]       = useState('')
  const [achados, setAchados]   = useState<Achado[]>([])
  const [buscando, setBuscando] = useState(false)
  const [escolhido, setEscolhido] = useState<Achado | null>(null)
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
    setBusca(''); setAchados([]); setEscolhido(null)
  }, [aberto, emailFixo, assuntoInicial, mensagemInicial])

  /**
   * Busca com 300ms de espera. Sem o debounce, cada tecla vira uma consulta
   * -- "barbara" dispararia sete. Menos de 2 caracteres nao busca: devolveria
   * meia base e nao ajudaria a achar ninguem.
   */
  useEffect(() => {
    if (emailFixo) return
    const termo = busca.trim()
    if (termo.length < 2) { setAchados([]); setBuscando(false); return }

    let vivo = true
    setBuscando(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/users?q=${encodeURIComponent(termo)}&perPage=8`)
        const d = await r.json().catch(() => ({}))
        if (!vivo) return
        setAchados(Array.isArray(d.users) ? d.users : [])
      } catch {
        if (vivo) setAchados([])
      } finally {
        if (vivo) setBuscando(false)
      }
    }, 300)

    return () => { vivo = false; clearTimeout(t) }
  }, [busca, emailFixo])

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

        <div style={{ marginBottom: 14, position: 'relative' }}>
          <label style={label}>Para quem</label>

          {emailFixo ? (
            /* Veio de fora (ex: /admin/lojas): destinatario travado, como antes. */
            <>
              <input value={email} readOnly style={{ ...input, opacity: 0.6, cursor: 'default' }} />
              {nomeFixo && <p style={{ margin: '6px 0 0', fontSize: 11.5, color: MUTED }}>{nomeFixo}</p>}
            </>
          ) : escolhido ? (
            /* Ja escolhido: mostra quem e, com a saida para trocar. */
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              borderRadius: 8, background: '#0d0f14', border: `1px solid ${AMBAR}55`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXTO }}>
                  {escolhido.name || escolhido.username || 'Sem nome'}
                </div>
                <div style={{ fontSize: 11.5, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {escolhido.email}{escolhido.city ? ` · ${escolhido.city}` : ''}
                </div>
              </div>
              <button
                onClick={() => { setEscolhido(null); setEmail(''); setBusca(''); setAchados([]) }}
                style={{
                  padding: '6px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 700,
                  background: 'transparent', border: `1px solid ${BORDA}`, color: MUTED,
                  cursor: 'pointer', fontFamily: 'inherit', flex: '0 0 auto',
                }}
              >
                Trocar
              </button>
            </div>
          ) : (
            <>
              <input
                value={busca}
                onChange={e => {
                  const v = e.target.value
                  setBusca(v)
                  // ★ E-mail completo digitado ou colado vale sozinho, sem
                  //   precisar escolher na lista: e o caminho de quem JA sabe
                  //   o endereco e so quer mandar.
                  setEmail(v.includes('@') && v.includes('.') ? v.trim() : '')
                }}
                placeholder="Nome, e-mail ou usuário — ex: barbara"
                autoComplete="off"
                style={input}
              />

              {busca.trim().length >= 2 && (
                <div style={{
                  marginTop: 6, borderRadius: 8, overflow: 'hidden',
                  border: `1px solid ${BORDA}`, background: '#0d0f14',
                  maxHeight: 232, overflowY: 'auto',
                }}>
                  {buscando && achados.length === 0 ? (
                    <div style={{ padding: '11px 12px', fontSize: 12, color: MUTED }}>Procurando…</div>
                  ) : achados.length === 0 ? (
                    <div style={{ padding: '11px 12px', fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
                      Ninguém com esse nome ou e-mail.
                      {email && <> Dá para enviar assim mesmo, porque <b style={{ color: TEXTO }}>{email}</b> é um e-mail válido.</>}
                    </div>
                  ) : (
                    achados.map(u => (
                      <button
                        key={u.id}
                        onClick={() => { setEscolhido(u); setEmail(u.email); setAchados([]) }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px',
                          background: 'transparent', border: 'none', borderBottom: `1px solid ${BORDA}`,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXTO }}>
                          {u.name || u.username || 'Sem nome'}
                        </div>
                        <div style={{ fontSize: 11.5, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.email}{u.city ? ` · ${u.city}` : ''}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
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
