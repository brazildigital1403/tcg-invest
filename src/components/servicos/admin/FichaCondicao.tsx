'use client'

// Ficha de condicao da carta (entrada e saida) no painel admin.
// Identificacao + frente/verso nos 4 pilares na escala textual + danos
// marcados. O servidor valida de novo (validarFicha); aqui so ajuda a
// preencher sem esquecer nada.

import { useState } from 'react'
import { ESCALA, PILARES, DANOS, IDENTIFICACAO, type FichaCondicao } from '@/lib/servicos'

const vazia = (): FichaCondicao => ({ identificacao: {}, frente: {}, verso: {}, danos_frente: [], danos_verso: [] })

export default function FichaCondicaoForm({ titulo, valor, ocupado, onSalvar }: {
  titulo: string
  valor: FichaCondicao | null
  ocupado: boolean
  onSalvar: (f: FichaCondicao) => Promise<boolean>
}) {
  const [f, setF] = useState<FichaCondicao>(() => valor || vazia())
  const [aberta, setAberta] = useState(!valor)
  const completa = PILARES.every(p => f.frente[p.id] && f.verso[p.id])

  function alternarDano(lado: 'danos_frente' | 'danos_verso', id: string) {
    setF(x => ({ ...x, [lado]: x[lado].includes(id) ? x[lado].filter(d => d !== id) : [...x[lado], id] }))
  }

  return (
    <div className={`fc${valor ? ' fc-ok' : ''}`}>
      <button type="button" className="fc-topo" onClick={() => setAberta(a => !a)} aria-expanded={aberta}>
        <b>{titulo}</b>
        <span>{valor ? 'preenchida' : 'pendente'}</span>
      </button>
      {aberta && (
        <div className="fc-corpo">
          <div className="fc-id">
            {IDENTIFICACAO.map(c => (
              <label key={c.k}><span>{c.rotulo}</span>
                <input className="ad-in" value={f.identificacao[c.k] || ''} maxLength={80}
                  onChange={e => setF(x => ({ ...x, identificacao: { ...x.identificacao, [c.k]: e.target.value } }))} />
              </label>
            ))}
          </div>
          <table className="fc-tab">
            <thead><tr><th></th><th>Frente</th><th>Verso</th></tr></thead>
            <tbody>
              {PILARES.map(p => (
                <tr key={p.id}>
                  <td>{p.rotulo}</td>
                  {(['frente', 'verso'] as const).map(lado => (
                    <td key={lado}>
                      <select className={`ad-in${!f[lado][p.id] ? ' fc-vazio' : ''}`} value={f[lado][p.id] || ''}
                        onChange={e => setF(x => ({ ...x, [lado]: { ...x[lado], [p.id]: e.target.value } }))}>
                        <option value="">—</option>
                        {ESCALA.map(e => <option key={e.id} value={e.id}>{e.rotulo}</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {(['danos_frente', 'danos_verso'] as const).map(lado => (
            <div key={lado} className="fc-danos">
              <span>{lado === 'danos_frente' ? 'Danos na frente' : 'Danos no verso'}</span>
              <div>
                {DANOS.map(d => (
                  <button key={d.id} type="button" className={`fc-chip${f[lado].includes(d.id) ? ' on' : ''}`} aria-pressed={f[lado].includes(d.id)} onClick={() => alternarDano(lado, d.id)}>{d.rotulo}</button>
                ))}
              </div>
            </div>
          ))}
          <textarea className="ad-in" rows={2} placeholder="Observação (opcional)" maxLength={1000} value={f.observacao || ''}
            onChange={e => setF(x => ({ ...x, observacao: e.target.value }))} />
          <button type="button" className="ad-bt ad-bt-pri" disabled={ocupado || !completa}
            onClick={async () => { if (await onSalvar(f)) setAberta(false) }}>
            {completa ? `Salvar ${titulo.toLowerCase()}` : 'Avalie os 4 pilares nos dois lados'}
          </button>
        </div>
      )}
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.fc{border-radius:10px;border:1px solid var(--bx-border);background:var(--bx-surface)}
.fc-ok{border-color:color-mix(in srgb,var(--bx-green) 30%,transparent)}
.fc-topo{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;min-height:44px;padding:0 12px;border:0;background:none;color:var(--bx-text);font:inherit;font-size:13.5px;cursor:pointer;text-align:left}
.fc-topo span{font-size:11.5px;font-weight:700;color:var(--bx-red)}
.fc-ok .fc-topo span{color:var(--bx-green)}
.fc-corpo{display:grid;gap:12px;padding:0 12px 12px}
.fc-id{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.fc-id label{display:grid;gap:4px;font-size:11.5px;font-weight:600;color:var(--bx-text-2)}
.fc-tab{width:100%;border-collapse:collapse;font-size:13px}
.fc-tab th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--bx-text-3);text-align:left;padding:4px}
.fc-tab td{padding:4px}
.fc-tab td:first-child{font-weight:600;white-space:nowrap}
.fc-vazio{border-color:color-mix(in srgb,var(--bx-red) 45%,transparent)}
.fc-danos{display:grid;gap:6px;font-size:12px;font-weight:600;color:var(--bx-text-2)}
.fc-danos > div{display:flex;flex-wrap:wrap;gap:6px}
.fc-chip{min-height:32px;padding:0 10px;border-radius:999px;border:1px solid var(--bx-border-2);background:var(--bx-bg);color:var(--bx-text-2);font:inherit;font-size:12.5px;cursor:pointer}
.fc-chip.on{border-color:color-mix(in srgb,var(--bx-red) 50%,transparent);background:color-mix(in srgb,var(--bx-red) 12%,transparent);color:var(--bx-text)}
`
