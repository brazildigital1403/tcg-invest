'use client'

// Proposta de tratamento de uma carta no painel: um bloco por procedimento
// (problema, procedimento, objetivo, resultado esperado, risco, alternativa).
// Editavel enquanto a carta esta em "recebida"; depois vira leitura, com a
// decisao do cliente em cada linha.

import { useState } from 'react'
import { RISCOS } from '@/lib/servicos'
import { IconPlus, IconClose, IconCheck } from '@/components/ui/Icons'

export type Procedimento = {
  id?: string; problema: string; procedimento: string; objetivo: string | null; resultado_esperado: string | null
  risco: string; risco_descricao: string | null; alternativa: string; decisao?: string
}

const novo = (): Procedimento => ({ problema: '', procedimento: '', objetivo: '', resultado_esperado: '', risco: '', risco_descricao: '', alternativa: 'Não realizar a intervenção' })
const ROTULO_DECISAO: Record<string, string> = { pendente: 'Aguardando o cliente', aprovado: 'Aprovado', recusado: 'Recusado' }

export default function PropostaEditor({ procs, editavel, ocupado, onSalvar }: {
  procs: Procedimento[]
  editavel: boolean
  ocupado: boolean
  onSalvar: (lista: Procedimento[]) => Promise<boolean>
}) {
  const [lista, setLista] = useState<Procedimento[]>(() => (procs.length ? procs : editavel ? [novo()] : []))
  const [sujo, setSujo] = useState(false)

  if (!editavel) {
    if (!procs.length) return null
    return (
      <div className="pe">
        <b className="pe-h">Proposta de tratamento</b>
        {procs.map((p, i) => (
          <div key={p.id || i} className={`pe-lin pe-${p.decisao}`}>
            <div className="pe-lin-topo"><b>{i + 1}. {p.procedimento}</b><span>{ROTULO_DECISAO[p.decisao || 'pendente']}</span></div>
            <small>Problema: {p.problema} · {RISCOS.find(r => r.id === p.risco)?.rotulo}</small>
          </div>
        ))}
        <style>{CSS}</style>
      </div>
    )
  }

  const mudar = (i: number, k: keyof Procedimento, v: string) => { setSujo(true); setLista(l => l.map((p, j) => (j === i ? { ...p, [k]: v } : p))) }
  const ok = lista.length > 0 && lista.every(p => p.problema.trim() && p.procedimento.trim() && p.risco)

  return (
    <div className="pe">
      <b className="pe-h">Proposta de tratamento</b>
      {lista.map((p, i) => (
        <div key={i} className="pe-bloco">
          <div className="pe-lin-topo">
            <b>Procedimento {i + 1}</b>
            {lista.length > 1 && <button type="button" className="pe-x" onClick={() => { setSujo(true); setLista(l => l.filter((_, j) => j !== i)) }} aria-label="Remover procedimento"><IconClose size={14} /></button>}
          </div>
          <div className="pe-campos">
            <label><span>Problema encontrado</span><input className="ad-in" value={p.problema} onChange={e => mudar(i, 'problema', e.target.value)} placeholder="Vinco na diagonal do canto superior" maxLength={500} /></label>
            <label><span>Procedimento</span><input className="ad-in" value={p.procedimento} onChange={e => mudar(i, 'procedimento', e.target.value)} placeholder="O que será feito" maxLength={500} /></label>
            <label><span>Objetivo</span><input className="ad-in" value={p.objetivo || ''} onChange={e => mudar(i, 'objetivo', e.target.value)} placeholder="Reduzir o relevo do vinco" maxLength={500} /></label>
            <label><span>Resultado esperado</span><input className="ad-in" value={p.resultado_esperado || ''} onChange={e => mudar(i, 'resultado_esperado', e.target.value)} placeholder="Redução parcial, linha visível na luz rasante" maxLength={500} /></label>
            <label><span>Risco</span>
              <select className="ad-in" value={p.risco} onChange={e => mudar(i, 'risco', e.target.value)}>
                <option value="">—</option>
                {RISCOS.map(r => <option key={r.id} value={r.id}>{r.rotulo}</option>)}
              </select>
            </label>
            <label><span>O que pode acontecer</span><input className="ad-in" value={p.risco_descricao || ''} onChange={e => mudar(i, 'risco_descricao', e.target.value)} placeholder="Marca residual na fibra" maxLength={500} /></label>
            <label className="pe-largo"><span>Alternativa</span><input className="ad-in" value={p.alternativa} onChange={e => mudar(i, 'alternativa', e.target.value)} maxLength={500} /></label>
          </div>
        </div>
      ))}
      <div className="pe-acoes">
        <button type="button" className="ad-bt" onClick={() => { setSujo(true); setLista(l => [...l, novo()]) }} disabled={lista.length >= 10}><IconPlus size={14} /> Outro procedimento</button>
        <button type="button" className="ad-bt ad-bt-pri" disabled={ocupado || !ok || !sujo} onClick={async () => { if (await onSalvar(lista)) setSujo(false) }}>
          {!sujo && procs.length ? <><IconCheck size={14} /> Proposta salva</> : 'Salvar proposta desta carta'}
        </button>
      </div>
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.pe{display:grid;gap:10px}
.pe-h{font-size:13.5px}
.pe-bloco{display:grid;gap:8px;padding:12px;border-radius:10px;border:1px solid var(--bx-border);background:var(--bx-surface)}
.pe-lin-topo{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px}
.pe-campos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.pe-campos label{display:grid;gap:4px;font-size:11.5px;font-weight:600;color:var(--bx-text-2)}
.pe-largo{grid-column:1 / -1}
.pe-x{width:32px;height:32px;display:grid;place-items:center;border-radius:8px;border:1px solid var(--bx-border-2);background:transparent;color:var(--bx-text-2);cursor:pointer}
.pe-acoes{display:flex;flex-wrap:wrap;gap:8px}
.pe-lin{display:grid;gap:3px;padding:10px 12px;border-radius:10px;border:1px solid var(--bx-border);background:var(--bx-surface)}
.pe-lin small{font-size:12px;color:var(--bx-text-3)}
.pe-lin-topo span{font-size:11px;font-weight:800;color:var(--bx-blue)}
.pe-aprovado .pe-lin-topo span{color:var(--bx-green)}
.pe-recusado .pe-lin-topo span{color:var(--bx-red)}
@media (max-width:640px){ .pe-campos{grid-template-columns:1fr} }
`
