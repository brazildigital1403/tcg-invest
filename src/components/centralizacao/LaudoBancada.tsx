'use client'

// Aba "Laudo" do medidor (so pelo pedido): o resto do laudo do item na mesma
// tela da medicao. A centralizacao vem da medida; a graduadora vem sugerida
// pela melhor faixa da escada, mas quem decide e o admin; a faixa provavel e
// escrita a mao e so ganha um aviso se passar do que a centralizacao permite.

import { CAMPOS_LAUDO, GRADUADORAS, lerFaixaNota } from '@/lib/servicos'
import { escadasDeCentralizacao, avisoFaixa } from '@/lib/centralizacao/graduadoras'
import type { Medida } from '@/lib/centralizacao/medida'
import { IconWarning } from '@/components/ui/Icons'

export type CamposLaudo = Record<string, string>

/** Campos que a aba edita (a centralizacao vem da medicao). */
export const CAMPOS_ABA = CAMPOS_LAUDO.filter(c => !c.k.startsWith('centralizacao_'))

export default function LaudoBancada({ valor, onChange, centralizacao, frente, verso }: {
  valor: CamposLaudo
  onChange: (v: CamposLaudo) => void
  /** Texto que vai para o laudo em cada face (medida nova ou a ja gravada). */
  centralizacao: { frente: string | null; verso: string | null }
  frente: Medida | null
  verso: Medida | null
}) {
  const r = escadasDeCentralizacao(frente, verso)
  const sugerida = r.melhores[0] ?? null
  const escolhida = r.escadas.find(e => e.graduadora === valor.graduadora)
  const faixa = lerFaixaNota(valor.faixa_nota)
  const aviso = avisoFaixa(escolhida, faixa?.max ?? null)
  const faixaInvalida = !!valor.faixa_nota?.trim() && !faixa
  const set = (k: string, v: string) => onChange({ ...valor, [k]: v })

  return (
    <div className="lb">
      <style>{CSS}</style>
      <div className="lb-cab">
        <h2>Laudo do item</h2>
        <p>O que estiver vazio continua vazio. Para liberar o Pronta: faixa provável, graduadora e centralização da frente e do verso.</p>
      </div>

      <div className="lb-centro">
        <span className="lb-h">Centralização (da medição)</span>
        <div className="lb-dl">
          <span>Frente</span><b>{centralizacao.frente || 'Sem medida'}</b>
          <span>Verso</span><b>{centralizacao.verso || 'Sem medida'}</b>
        </div>
      </div>

      {CAMPOS_ABA.map(c => {
        if (c.k === 'graduadora') {
          return (
            <label key={c.k} className="lb-campo">
              <span>{c.rotulo}</span>
              <select className="lb-in" value={valor.graduadora || ''} onChange={ev => set('graduadora', ev.target.value)}>
                <option value="">Escolha</option>
                {GRADUADORAS.map(g => <option key={g.nome} value={g.nome}>{g.nome}</option>)}
              </select>
              {sugerida && valor.graduadora !== sugerida && (
                <button type="button" className="lb-sug" onClick={() => set('graduadora', sugerida)}>
                  Melhor faixa pela centralização: {sugerida}. Usar
                </button>
              )}
              {escolhida && <small>{escolhida.quando}</small>}
            </label>
          )
        }
        if (c.k === 'caderno') {
          return (
            <label key={c.k} className="lb-campo lb-largo">
              <span>{c.rotulo}</span>
              <textarea className="lb-in" rows={3} placeholder={c.ex} value={valor[c.k] || ''} onChange={ev => set(c.k, ev.target.value)} />
            </label>
          )
        }
        return (
          <label key={c.k} className="lb-campo">
            <span>{c.rotulo}</span>
            <input className="lb-in" placeholder={c.k === 'faixa_nota' ? '8 a 9 ou 8,5 a 9' : c.ex} value={valor[c.k] || ''} onChange={ev => set(c.k, ev.target.value)} />
            {c.k === 'faixa_nota' && faixaInvalida && <small className="lb-erro">Use um intervalo, como 8 a 9, com o menor primeiro. Nota única não vale.</small>}
            {c.k === 'faixa_nota' && aviso && <small className="lb-aviso"><IconWarning size={13} /> {aviso}</small>}
          </label>
        )
      })}
    </div>
  )
}

const CSS = `
.lb{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 14px;padding:16px;align-content:start;width:100%}
.lb-cab{grid-column:1 / -1}
.lb-cab h2{margin:0;font-size:18px;font-weight:800;letter-spacing:-0.02em}
.lb-cab p{margin:4px 0 0;font-size:12.5px;color:var(--bx-text-3);line-height:1.5}
.lb-centro{grid-column:1 / -1;display:grid;gap:6px;padding:12px;border-radius:10px;border:1px solid var(--bx-border);background:var(--bx-surface)}
.lb-h{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.lb-dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;font-size:13px;color:var(--bx-text-2)}
.lb-dl b{color:var(--bx-text);font-variant-numeric:tabular-nums}
.lb-campo{display:grid;gap:5px;font-size:12px;color:var(--bx-text-2)}
.lb-campo small{font-size:11.5px;color:var(--bx-text-3);line-height:1.4}
.lb-largo{grid-column:1 / -1}
.lb-in{width:100%;box-sizing:border-box;min-height:42px;padding:9px 11px;border-radius:10px;border:1px solid var(--bx-border-2);background:var(--bx-bg);color:var(--bx-text);font:inherit;font-size:14px;transition:border-color .15s ease}
.lb-in:focus{outline:none;border-color:rgba(var(--ac-1-rgb),.6)}
textarea.lb-in{resize:vertical}
.lb-sug{justify-self:start;min-height:32px;padding:0 10px;border-radius:999px;border:1px solid rgba(var(--ac-1-rgb),.45);background:rgba(var(--ac-1-rgb),.1);color:var(--bx-text);font:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:background .15s ease}
.lb-sug:hover{background:rgba(var(--ac-1-rgb),.18)}
small.lb-erro{color:var(--bx-red)}
small.lb-aviso{display:flex;gap:6px;align-items:flex-start;color:var(--bx-text);padding:8px 10px;border-radius:8px;background:color-mix(in srgb,var(--bx-amber) 10%,transparent);border:1px solid color-mix(in srgb,var(--bx-amber) 35%,transparent)}
small.lb-aviso svg{flex:none;margin-top:1px;color:var(--bx-amber)}
@media (max-width:700px){.lb{grid-template-columns:minmax(0,1fr);padding:14px}}
`
