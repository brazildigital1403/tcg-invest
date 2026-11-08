'use client'

// Pecas comuns as frentes do Club que mostram datas (08/11/2026): abas
// Proximos/Calendario, navegacao de mes, grade do mes, folha e a linha com o
// bloco de data. Nasceram nos Aniversariantes e passaram a servir a Agenda.
// Cada frente decide o que vai dentro do dia (rosto, quadrado do tipo).

import { useEffect, useRef } from 'react'
import { MESES, type Dia } from '@/lib/pcc/datas'
import { Ico } from '../amigo-secreto/estilo'

export function Abas<T extends string>({ valor, opcoes, onTrocar }: {
  valor: T; opcoes: { id: T; rotulo: string }[]; onTrocar: (v: T) => void
}) {
  return (
    <div className="pc-abas" role="tablist">
      {opcoes.map(o => (
        <button key={o.id} type="button" role="tab" aria-selected={valor === o.id} className={valor === o.id ? 'on' : ''} onClick={() => onTrocar(o.id)}>{o.rotulo}</button>
      ))}
    </div>
  )
}

export function NavMes({ ano, mes, onTrocar }: { ano: number; mes: number; onTrocar: (delta: number) => void }) {
  return (
    <div className="pc-mes">
      <button type="button" className="as-ib" aria-label="Mês anterior" onClick={() => onTrocar(-1)}><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
      <strong>{MESES[mes - 1]} de {ano}</strong>
      <button type="button" className="as-ib" aria-label="Próximo mês" onClick={() => onTrocar(1)}><Ico n="chev" /></button>
    </div>
  )
}

/**
 * Grade do mes. `itensDoDia` devolve o que cai em cada dia; dia com item vira
 * botao. `marca` desenha o que aparece dentro do dia (no celular so ela; no
 * computador tambem o `nome`, embaixo).
 */
export function CalendarioMes<T>({ ano, mes, hoje, itensDoDia, marca, nome, rotulo, classeDia, onDia }: {
  ano: number; mes: number; hoje: Dia
  itensDoDia: (d: number) => T[]
  marca: (itens: T[]) => React.ReactNode
  nome: (itens: T[]) => string
  rotulo: (d: number, itens: T[]) => string
  classeDia?: (itens: T[]) => string
  onDia: (d: number) => void
}) {
  const inicio = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay()
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const ehHoje = (d: number) => hoje.ano === ano && hoje.mes === mes && hoje.dia === d
  return (
    <div className="pc-cal">
      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i} className="wd" aria-hidden="true">{d}</div>)}
      {Array.from({ length: inicio }, (_, i) => <div key={`v${i}`} />)}
      {Array.from({ length: total }, (_, i) => {
        const d = i + 1
        const itens = itensDoDia(d)
        if (itens.length === 0) return <div key={d} className={`pc-d${ehHoje(d) ? ' hoje' : ''}`}>{d}</div>
        const extra = classeDia ? classeDia(itens) : ''
        return (
          <button key={d} type="button" className={`pc-d tem${ehHoje(d) ? ' hoje' : ''}${extra ? ` ${extra}` : ''}`} aria-label={rotulo(d, itens)} onClick={() => onDia(d)}>
            {d}
            <span className="rs">{marca(itens)}{itens.length > 1 && <em>+{itens.length - 1}</em>}</span>
            <small className="nm">{nome(itens)}</small>
          </button>
        )
      })}
    </div>
  )
}

/** Bloco de data das linhas: dia grande e mes curto embaixo. */
export function BlocoData({ dia, mes }: { dia: string; mes: string }) {
  return <span className="pc-dt"><b>{dia}</b><i>{mes}</i></span>
}

/** Folha de baixo para cima no celular; janela centralizada no computador. */
export function Folha({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const antes = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; antes?.focus() }
  }, [onFechar])
  return (
    <div className="as-sheet-bg" onClick={onFechar}>
      <div ref={ref} tabIndex={-1} className="as-sheet" role="dialog" aria-modal="true" aria-label={titulo} onClick={e => e.stopPropagation()}>
        <div className="as-handle" />
        <div className="as-sh"><h3 className="as-h3">{titulo}</h3><button type="button" className="as-ib" aria-label="Fechar" onClick={onFechar}><Ico n="x" s={20} /></button></div>
        {children}
      </div>
    </div>
  )
}

export const CAL_CSS = `
.pc-abas{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--bx-border-2);border-radius:10px;overflow:hidden}
.pc-abas button{min-height:44px;background:transparent;border:0;color:var(--bx-text-2);font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s ease,color .15s ease}
.pc-abas button.on{background:var(--bx-surface-3);color:var(--bx-text);box-shadow:inset 0 -2px 0 var(--ac-1)}
.pc-col{display:none;flex-direction:column;gap:8px;min-width:0}
.pc-col.on{display:flex}
.pc-grade{display:flex;flex-direction:column;gap:12px;min-width:0}
.pc-linha{display:flex;align-items:center;gap:10px;min-height:64px;width:100%;padding:6px 0;background:transparent;border:0;border-bottom:1px solid var(--bx-border);color:var(--bx-text);font:inherit;text-align:left}
.pc-linha .as-btn{width:auto;flex:none}
.pc-linha .arr{color:var(--bx-text-3)}
.pc-dt{width:44px;flex:none;text-align:center;line-height:1.05;display:flex;flex-direction:column}
.pc-dt b{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums}
.pc-dt i{font-style:normal;font-size:11px;font-weight:800;color:var(--bx-text-2);text-transform:uppercase}
.pc-nm{flex:1;min-width:0;display:flex;flex-direction:column}
.pc-nm b{font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-nm small{font-size:12.5px;color:var(--bx-text-2)}
.pc-mes{display:flex;align-items:center;justify-content:space-between}
.pc-mes strong{font-size:15px;font-weight:700}
.pc-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.pc-cal .wd{font-size:11px;font-weight:800;color:var(--bx-text-3);text-align:center;padding:2px 0}
.pc-d{min-height:54px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 0 2px;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--bx-text-3);font:inherit;font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums;min-width:0}
.pc-d.tem{background:var(--bx-surface);border-color:var(--bx-border);color:var(--bx-text);cursor:pointer;transition:background .15s ease,transform .15s ease}
.pc-d.tem:hover{background:var(--bx-surface-2);transform:translateY(-2px)}
.pc-d.hoje{border:2px solid var(--ac-1);background:rgba(var(--ac-1-rgb),.10);color:var(--ac-1);font-weight:800}
.pc-d .rs{display:inline-flex;align-items:center;gap:1px}
.pc-d .rs em{font-style:normal;font-size:10px;color:var(--bx-text-2)}
.pc-d .nm{display:none}
.pc-vazio{padding:24px 0;border:1px dashed var(--bx-border-2);border-radius:12px}
@media (prefers-reduced-motion:reduce){.pc-d.tem:hover{transform:none}}
@media (min-width:1024px){
  .pc-abas{display:none}
  .pc-grade{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:24px;align-items:start}
  .pc-col{display:flex}
  .as-mob-cal{display:none}
  .pc-cal{gap:6px}
  .pc-d{min-height:88px;font-size:12px}
  .pc-d .nm{display:block;max-width:100%;padding:0 4px;font-size:11.5px;font-weight:500;color:var(--bx-text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
}
`
