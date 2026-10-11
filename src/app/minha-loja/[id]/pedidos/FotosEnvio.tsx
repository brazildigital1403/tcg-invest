'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authFetch } from '@/lib/authFetch'
import { comprimirImagem } from '@/lib/comprimirImagem'
import { IconCamera, IconCheck } from '@/components/ui/Icons'
import { SLOTS_FOTO_ENVIO, VALOR_FOTO_ENVIO_CENTS, type SlotFotoEnvio } from '@/lib/leilao-reclamacao'

/**
 * Fotos da carta (frente e verso) antes de embalar um lote de LEILAO a partir
 * de VALOR_FOTO_ENVIO_CENTS. Cada foto sobe na hora em que e escolhida
 * (comprime para webp, URL assinada de /api/pedidos/[id]/envio-upload-url,
 * bucket privado) e o caminho volta por `onChange`; o "Confirmar envio" so
 * manda os caminhos. Quem confere tudo e marcarEnviado no servidor.
 */

const ROTULO: Record<SlotFotoEnvio, string> = { frente: 'Frente', verso: 'Verso' }

export default function FotosEnvio({ pedidoId, onChange }: { pedidoId: string; onChange: (paths: string[]) => void }) {
  const [paths, setPaths] = useState<Partial<Record<SlotFotoEnvio, string>>>({})
  const [subindo, setSubindo] = useState<SlotFotoEnvio | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function escolher(slot: SlotFotoEnvio, f: File) {
    setErro(null); setSubindo(slot)
    try {
      const arq = await comprimirImagem(f)
      const r = await authFetch(`/api/pedidos/${pedidoId}/envio-upload-url`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, mime: arq.type }),
      })
      const u = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(u.error || 'Não foi possível enviar a foto.')
      const { error } = await supabase.storage.from('reclamacoes').uploadToSignedUrl(u.path, u.token, arq, { contentType: arq.type })
      if (error) throw new Error('A foto não subiu. Confira sua conexão e tente de novo.')
      const novo = { ...paths, [slot]: u.path as string }
      setPaths(novo)
      onChange(SLOTS_FOTO_ENVIO.filter(s => novo[s]).map(s => novo[s]!))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSubindo(null)
    }
  }

  return (
    <div className="fe-wrap">
      <style>{CSS}</style>
      <div className="fe-lbl">Fotos da carta <span>(obrigatório)</span></div>
      <p className="fe-txt">Fotografe a carta antes de embalar. Se ela voltar em uma devolução, é com estas fotos que você prova que mandou a carta certa.</p>
      <div className="fe-grid">
        {SLOTS_FOTO_ENVIO.map(s => (
          <label key={s} className={`fe-slot${paths[s] ? ' fe-on' : ''}`}>
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden disabled={!!subindo}
              onChange={e => { const f = e.target.files?.[0]; if (f) escolher(s, f); e.target.value = '' }} />
            {paths[s] ? <IconCheck size={20} color="var(--bx-green)" /> : <IconCamera size={20} color="currentColor" />}
            <span>{subindo === s ? 'Enviando…' : ROTULO[s]}</span>
          </label>
        ))}
      </div>
      <div className="fe-mut">Obrigatório em lotes de leilão a partir de R$ {(VALOR_FOTO_ENVIO_CENTS / 100).toFixed(0)}.</div>
      {erro && <div className="fe-erro">{erro}</div>}
    </div>
  )
}

const CSS = `
.fe-wrap{display:grid;gap:8px;margin-bottom:10px}
.fe-lbl{font-size:12.5px;font-weight:700;color:var(--bx-text)}
.fe-lbl span{color:var(--bx-red);font-weight:600}
.fe-txt{margin:0;font-size:12.5px;line-height:1.5;color:var(--bx-text-2)}
.fe-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.fe-slot{min-height:96px;border-radius:10px;border:1px dashed rgba(var(--ac-1-rgb),.5);background:rgba(var(--ac-1-rgb),.06);color:var(--ac-1);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:700;cursor:pointer;transition:border-color .15s ease,background .15s ease}
.fe-on{border-style:solid;border-color:color-mix(in srgb,var(--bx-green) 45%,transparent);background:color-mix(in srgb,var(--bx-green) 6%,transparent);color:var(--bx-text-2)}
.fe-mut{font-size:12px;color:var(--bx-text-3)}
.fe-erro{font-size:12.5px;color:var(--bx-red)}
`
