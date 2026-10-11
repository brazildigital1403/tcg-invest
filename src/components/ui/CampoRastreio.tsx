'use client'

import { useId } from 'react'
import { IconTruck, IconChevronDown, IconCheck } from '@/components/ui/Icons'
import { TRANSPORTADORAS, LISTA_TRANSPORTADORAS, validarRastreioEnvio, type Transportadora } from '@/lib/rastreio'

/**
 * Transportadora + codigo de rastreio, com a mesma validacao do servidor
 * (validarRastreioEnvio em lib/rastreio). Usado no envio da loja
 * (/minha-loja/[id]/pedidos) e da pessoa fisica (/vendas).
 *
 * O aviso de erro so aparece quando o codigo ja tem tamanho de codigo (13 nos
 * Correios, 8 nas demais): antes disso a pessoa ainda esta digitando.
 */

export interface ValorRastreio { transportadora: Transportadora; codigo: string }

export function rastreioValido(v: ValorRastreio): boolean {
  return validarRastreioEnvio(v.transportadora, v.codigo).ok
}

export default function CampoRastreio({ valor, onChange }: { valor: ValorRastreio; onChange: (v: ValorRastreio) => void }) {
  const id = useId()
  const r = validarRastreioEnvio(valor.transportadora, valor.codigo)
  const limpo = valor.codigo.replace(/[\s.-]/g, '')
  const mostrarErro = !r.ok && limpo.length >= (valor.transportadora === 'correios' ? 13 : 8)
  const placeholder = valor.transportadora === 'correios' ? 'AA123456789BR' : 'Cole o código da transportadora'

  return (
    <div className="cr">
      <style>{CSS}</style>
      <label className="cr-rot" htmlFor={`${id}-t`}>Transportadora</label>
      <div className="cr-sel">
        <select id={`${id}-t`} value={valor.transportadora}
          onChange={e => onChange({ ...valor, transportadora: e.target.value as Transportadora })}>
          {LISTA_TRANSPORTADORAS.map(t => <option key={t} value={t}>{TRANSPORTADORAS[t]}</option>)}
        </select>
        <IconChevronDown size={16} color="var(--bx-text-3)" />
      </div>
      <label className="cr-rot" htmlFor={`${id}-c`}>Código de rastreio</label>
      <div className={`cr-campo${mostrarErro ? ' cr-campo-erro' : ''}${r.ok ? ' cr-campo-ok' : ''}`}>
        <IconTruck size={17} color="var(--bx-text-3)" />
        <input id={`${id}-c`} value={valor.codigo} onChange={e => onChange({ ...valor, codigo: e.target.value.toUpperCase() })}
          placeholder={placeholder} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={40}
          aria-invalid={mostrarErro} aria-describedby={mostrarErro ? `${id}-e` : undefined} />
        {r.ok && <IconCheck size={16} color="var(--bx-green)" />}
      </div>
      {mostrarErro && !r.ok && <div id={`${id}-e`} className="cr-erro">{r.erro}</div>}
    </div>
  )
}

const CSS = `
.cr{display:grid;gap:6px}
.cr-rot{font-size:12.5px;font-weight:700;color:var(--bx-text-2)}
.cr-sel{position:relative;display:flex;align-items:center}
.cr-sel select{appearance:none;-webkit-appearance:none;width:100%;min-height:44px;padding:0 36px 0 12px;border-radius:10px;background:var(--bx-surface-2);border:1px solid var(--bx-border);color:var(--bx-text);font:inherit;font-size:16px;outline:none;cursor:pointer;transition:border-color .15s ease}
.cr-sel select:focus{border-color:var(--bx-border-2)}
.cr-sel svg{position:absolute;right:12px;pointer-events:none}
.cr-campo{display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:10px;background:var(--bx-surface-2);border:1px solid var(--bx-border);transition:border-color .15s ease}
.cr-campo:focus-within{border-color:var(--bx-border-2)}
.cr-campo-ok{border-color:color-mix(in srgb,var(--bx-green) 40%,transparent)}
.cr-campo-erro{border-color:color-mix(in srgb,var(--bx-amber) 50%,transparent)}
.cr-campo svg{flex-shrink:0}
.cr-campo input{flex:1;min-width:0;min-height:44px;background:transparent;border:none;outline:none;color:var(--bx-text);font:inherit;font-size:16px;letter-spacing:.04em}
.cr-erro{font-size:12.5px;line-height:1.45;color:var(--bx-amber)}
@media (prefers-reduced-motion:reduce){.cr-sel select,.cr-campo{transition:none}}
`
