'use client'

// Checklist do protocolo fotografico: um espaco por foto obrigatoria (frente,
// verso, cada canto, cada borda, angulo). O que ja subiu aparece como
// miniatura; o que falta e um botao de upload daquele slot exato, entao a
// foto ja entra com tipo + posicao certos.

import type { SlotFoto } from '@/lib/servicos'
import { IconUpload, IconCheck } from '@/components/ui/Icons'

type MidiaSlot = { id: string; tipo: string; posicao: string | null; url: string | null }

export default function ChecklistFotos({ titulo, slots, midias, ocupado, onFile }: {
  titulo: string
  slots: SlotFoto[]
  midias: MidiaSlot[]
  ocupado: string
  onFile: (slot: SlotFoto, f: File) => void
}) {
  const achar = (s: SlotFoto) => midias.find(m => m.tipo === s.tipo && (m.posicao || '') === s.posicao)
  const feitas = slots.filter(achar).length

  return (
    <div className="cf">
      <div className="cf-topo">
        <b>{titulo}</b>
        <span className={feitas === slots.length ? 'cf-ok' : ''}>{feitas === slots.length ? <><IconCheck size={12} /> completo</> : `${feitas} de ${slots.length}`}</span>
      </div>
      <div className="cf-grade">
        {slots.map(s => {
          const m = achar(s)
          const chave = `midia-${s.tipo}-${s.posicao}`
          return m?.url ? (
            <a key={chave} className="cf-slot cf-slot-ok" href={m.url} target="_blank" rel="noopener" title={s.rotulo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={s.rotulo} loading="lazy" />
              <small>{s.rotulo}</small>
            </a>
          ) : (
            <label key={chave} className={`cf-slot${ocupado === chave ? ' cf-slot-ocupado' : ''}`}>
              <input type="file" accept="image/*" disabled={!!ocupado} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(s, f); e.target.value = '' }} />
              <IconUpload size={15} />
              <small>{ocupado === chave ? 'Enviando...' : s.rotulo}</small>
            </label>
          )
        })}
      </div>
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.cf{display:grid;gap:8px}
.cf-topo{display:flex;justify-content:space-between;align-items:center;font-size:13.5px}
.cf-topo span{font-size:11.5px;font-weight:700;color:var(--bx-red);display:inline-flex;align-items:center;gap:4px}
.cf-topo span.cf-ok{color:var(--bx-green)}
.cf-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px}
.cf-slot{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;aspect-ratio:5/7;padding:6px;border-radius:9px;border:1.5px dashed var(--bx-border-2);background:var(--bx-bg);color:var(--bx-text-2);text-align:center;cursor:pointer;overflow:hidden;text-decoration:none}
.cf-slot:hover{border-color:rgba(var(--ac-1-rgb),.6)}
.cf-slot input{position:absolute;inset:0;opacity:0;cursor:pointer}
.cf-slot small{font-size:10.5px;line-height:1.25}
.cf-slot-ok{border-style:solid;border-color:color-mix(in srgb,var(--bx-green) 40%,transparent);padding:0;justify-content:flex-end}
.cf-slot-ok img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cf-slot-ok small{position:relative;width:100%;padding:3px 4px;background:rgba(8,10,15,.78);color:#fff}
.cf-slot-ocupado{opacity:.6;cursor:progress}
`
