'use client'

// Codigo de rastreio clicavel + copiar. Correios abre o rastreio oficial com o
// codigo preenchido; outros formatos vao para o 17TRACK (ver linkRastreio).

import { useState } from 'react'
import { linkRastreio } from '@/lib/servicos'
import { IconTruck, IconCheck } from '@/components/ui/Icons'

export default function Rastreio({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false)
  const { href, onde } = linkRastreio(codigo)
  return (
    <span className="rz">
      <style>{CSS}</style>
      <a className="rz-link" href={href} target="_blank" rel="noopener" title={`Rastrear em ${onde}`}>
        <IconTruck size={15} /> <b>{codigo}</b> <small>rastrear em {onde}</small>
      </a>
      <button
        type="button"
        className="rz-copiar"
        onClick={() => navigator.clipboard?.writeText(codigo).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1600) }).catch(() => {})}
        aria-label="Copiar código de rastreio"
      >
        {copiado ? <><IconCheck size={13} /> Copiado</> : 'Copiar'}
      </button>
    </span>
  )
}

const CSS = `
.rz{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px}
.rz-link{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 12px;border-radius:10px;border:1px solid rgba(var(--ac-1-rgb),.45);background:rgba(var(--ac-1-rgb),.08);color:var(--bx-text);text-decoration:none;font-size:14px;transition:background .15s ease}
.rz-link:hover{background:rgba(var(--ac-1-rgb),.16)}
.rz-link svg{color:var(--ac-1)}
.rz-link b{font-variant-numeric:tabular-nums;letter-spacing:.03em}
.rz-link small{font-size:12px;color:var(--bx-text-2)}
.rz-copiar{display:inline-flex;align-items:center;gap:4px;min-height:40px;padding:0 12px;border-radius:10px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text-2);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
`
