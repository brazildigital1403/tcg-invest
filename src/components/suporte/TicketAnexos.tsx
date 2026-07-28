'use client'

/**
 * Anexos de um ticket — mesma peca nas duas pontas (usuario e admin).
 *
 * O arquivo vive em bucket PRIVADO. Por isso aqui nunca ha `src` ou `href`
 * apontando pro storage: pra abrir, pede-se um link ASSINADO de 5 minutos a
 * /api/tickets/[id]/anexos/[anexoId], que so responde depois de conferir quem
 * pediu. Esse fluxo existe porque na verificacao de loja isso carrega RG/CNH.
 *
 * O `fetcher` vem de fora porque as duas pontas se autenticam diferente:
 * usuario manda Bearer (authFetch), admin usa cookie (fetch normal).
 */

import { useEffect, useRef, useState } from 'react'

interface Anexo {
  id: string
  nome: string
  mime: string
  tamanho: number
  enviado_por: 'user' | 'admin'
  created_at: string
}

interface Props {
  ticketId: string
  fetcher: (url: string, init?: RequestInit) => Promise<Response>
  /** Rotulo de quem esta usando, so pra copy. */
  lado: 'user' | 'admin'
}

const BORDA = 'rgba(255,255,255,0.1)'
const MUTED = 'rgba(255,255,255,0.5)'
const TEXTO = '#f0f0f0'

const MIMES_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
const TAMANHO_MAX = 10 * 1024 * 1024

const kb = (n: number) => n < 1024 * 1024
  ? `${Math.round(n / 1024)} KB`
  : `${(n / 1024 / 1024).toFixed(1)} MB`

export default function TicketAnexos({ ticketId, fetcher, lado }: Props) {
  const [anexos, setAnexos]   = useState<Anexo[] | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro]       = useState<string | null>(null)
  const [abrindo, setAbrindo] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function carregar() {
    try {
      const r = await fetcher(`/api/tickets/${ticketId}/anexos`)
      if (!r.ok) { setAnexos([]); return }
      const d = await r.json()
      setAnexos(d.anexos || [])
    } catch { setAnexos([]) }
  }
  useEffect(() => { carregar() /* eslint-disable-next-line */ }, [ticketId])

  async function enviar(files: FileList | null) {
    if (!files?.length) return
    setErro(null)
    for (const file of Array.from(files)) {
      // Valida no cliente pra dar erro imediato; a rota valida de novo, porque
      // checagem de cliente nao e checagem.
      if (!MIMES_OK.includes(file.type)) {
        setErro(`"${file.name}": tipo não aceito. Envie imagem (JPG, PNG, WEBP) ou PDF.`)
        continue
      }
      if (file.size > TAMANHO_MAX) {
        setErro(`"${file.name}": ${kb(file.size)} — o limite é 10 MB.`)
        continue
      }
      setEnviando(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        const r = await fetcher(`/api/tickets/${ticketId}/anexos`, { method: 'POST', body: fd })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) { setErro(d.error || `Falha ao enviar "${file.name}"`); continue }
        setAnexos(a => [...(a || []), d.anexo])
      } catch (e: any) {
        setErro(e?.message || 'Erro de rede')
      } finally {
        setEnviando(false)
      }
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  async function abrir(a: Anexo) {
    setAbrindo(a.id); setErro(null)
    try {
      const r = await fetcher(`/api/tickets/${ticketId}/anexos/${a.id}`)
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.url) { setErro(d.error || 'Não consegui abrir o arquivo'); return }
      window.open(d.url, '_blank', 'noopener,noreferrer')
    } catch { setErro('Erro ao abrir') } finally { setAbrindo(null) }
  }

  async function remover(a: Anexo) {
    if (!confirm(`Remover "${a.nome}"?`)) return
    try {
      const r = await fetcher(`/api/tickets/${ticketId}/anexos/${a.id}`, { method: 'DELETE' })
      if (r.ok) setAnexos(x => (x || []).filter(y => y.id !== a.id))
      else setErro('Falha ao remover')
    } catch { setErro('Erro de rede') }
  }

  const btn: React.CSSProperties = {
    padding: '8px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 700,
    background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDA}`,
    color: TEXTO, cursor: 'pointer', fontFamily: 'inherit',
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: anexos?.length ? 10 : 0 }}>
        <button style={{ ...btn, opacity: enviando ? 0.5 : 1 }} disabled={enviando}
          onClick={() => inputRef.current?.click()}>
          {enviando ? 'Enviando...' : 'Anexar arquivo'}
        </button>
        <span style={{ fontSize: 11.5, color: MUTED }}>
          Imagem ou PDF, até 10 MB {lado === 'user' ? '· fica visível só para você e a equipe' : ''}
        </span>
        <input
          ref={inputRef} type="file" multiple accept={MIMES_OK.join(',')}
          onChange={e => enviar(e.target.files)} style={{ display: 'none' }}
        />
      </div>

      {erro && (
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#ef4444', lineHeight: 1.5 }}>{erro}</p>
      )}

      {anexos && anexos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {anexos.map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDA}`,
              borderRadius: 9, padding: '9px 12px',
            }}>
              <span style={{ fontSize: 13, color: TEXTO, flex: 1, minWidth: 130, wordBreak: 'break-word' }}>
                {a.nome}
              </span>
              <span style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>
                {kb(a.tamanho)} · {a.enviado_por === 'admin' ? 'equipe' : 'você'}
              </span>
              <button onClick={() => abrir(a)} disabled={abrindo === a.id}
                style={{ ...btn, padding: '5px 11px', fontSize: 12 }}>
                {abrindo === a.id ? 'abrindo...' : 'Abrir'}
              </button>
              <button onClick={() => remover(a)}
                style={{ ...btn, padding: '5px 11px', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
