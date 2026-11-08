'use client'

// Pecas da Agenda do Club (08/11/2026): casca da pagina, quadrado do tipo e a
// linha de evento das listas. Evento e quadrado arredondado com o icone do tipo;
// aniversario e circulo. A cor nao separa tipos (sem paleta nova): icone e texto.

import Link from 'next/link'
import { MESES_CURTOS, type Dia } from '@/lib/pcc/datas'
import { TIPOS, diasAte, linhaMeta, momento, parseDia, remarcadoRecente, type Evento } from '@/lib/pcc/agenda'
import { agendaEvento } from '@/lib/pcc/rotas'
import { AS_CSS, Ico, VoltarClub } from '../amigo-secreto/estilo'
import { BlocoData, CAL_CSS } from '../_comum/calendario'

export function Casca({ children, logado, onEntrar, voltar, rotuloVoltar, titulo }: {
  children: React.ReactNode; logado: boolean; onEntrar: () => void
  voltar: string; rotuloVoltar?: string; titulo: string
}) {
  return (
    <div className="as ag">
      <header className="as-top bx-gutter">
        <div className="as-wrap">
          <VoltarClub href={voltar} rotulo={rotuloVoltar} />
          <span className="t">{titulo}</span>
          {logado
            ? <Link href="/minha-conta" className="as-ib" aria-label="Minha conta"><Ico n="user" s={22} /></Link>
            : <button type="button" className="as-btn lnk sm" style={{ minHeight: 44, width: 'auto' }} onClick={onEntrar}>Entrar</button>}
        </div>
      </header>
      <main className="bx-gutter"><div className="as-wrap as-bd">{children}</div></main>
      <style>{AS_CSS + CAL_CSS + AG_CSS}</style>
    </div>
  )
}

export function TipoQuad({ e, tam = 40 }: { e: Pick<Evento, 'tipo' | 'status'>; tam?: number }) {
  const t = TIPOS[e.tipo]
  return (
    <span className={`ag-q${e.status === 'adiado' || e.status === 'cancelado' ? ' ap' : ''}`} style={{ width: tam, height: tam }} title={t.rotulo}>
      <Ico n={t.ico} s={Math.round(tam * 0.5)} />
    </span>
  )
}

/** Chip de estado do evento: Hoje, Agora, Adiado, Cancelado, Encerrado ou Nova data. */
export function ChipEstado({ e, hoje }: { e: Evento; hoje: Dia }) {
  if (e.status === 'rascunho') return <span className="as-chip">Rascunho</span>
  if (e.status === 'cancelado') return <span className="as-chip ag-chip-canc">Cancelado</span>
  if (e.status === 'adiado') return <span className="as-chip">Adiado</span>
  const m = momento(e, hoje)
  if (m === 'agora') return <span className="as-chip fill">Acontecendo agora</span>
  if (m === 'hoje') return <span className="as-chip fill">Hoje</span>
  if (m === 'passado') return <span className="as-chip">Encerrado</span>
  if (remarcadoRecente(e)) return <span className="as-chip wait">Nova data</span>
  return null
}

export function LinhaEvento({ e, hoje, comChip }: { e: Evento; hoje: Dia; comChip?: boolean }) {
  const ini = parseDia(e.inicio_data)
  const passou = momento(e, hoje) === 'passado'
  return (
    <Link href={agendaEvento(e.slug)} className={`pc-linha ag-linha${passou || e.status !== 'publicado' ? ' apagado' : ''}`}>
      <BlocoData dia={String(ini.dia).padStart(2, '0')} mes={MESES_CURTOS[ini.mes - 1]} />
      <TipoQuad e={e} />
      <span className="pc-nm">
        <b>{e.titulo}</b>
        {/* Com o chip ao lado, o estado ja aparece nele: a linha mostra data e lugar. */}
        <small>{e.status === 'cancelado' && !comChip ? 'Cancelado' : linhaMeta(e)}</small>
      </span>
      {comChip && <ChipEstado e={e} hoje={hoje} />}
      <Ico n="chev" className="arr" />
    </Link>
  )
}

/** Eventos que ainda nao terminaram, do mais proximo para o mais distante. */
export function proximos(eventos: Evento[], hoje: Dia): Evento[] {
  return eventos
    .filter(e => diasAte(e.fim_data, hoje) >= 0 && momento(e, hoje) !== 'passado')
    .sort((a, b) => a.inicio_data.localeCompare(b.inicio_data) || (a.hora_inicio || '').localeCompare(b.hora_inicio || ''))
}

export const AG_CSS = `
.ag-q{display:inline-flex;align-items:center;justify-content:center;flex:none;border-radius:10px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--ac-1)}
.ag-q.ap{border-style:dashed;color:var(--bx-text-3);background:transparent}
.pc-d .ag-q{border-radius:7px}
.pc-d.ap .ag-q{border-style:dashed;color:var(--bx-text-3);background:transparent}
.ag-linha{text-decoration:none;cursor:pointer;transition:background .15s ease}
.ag-linha:hover{background:var(--bx-surface)}
.ag-linha.apagado .pc-nm b{color:var(--bx-text-2)}
.ag-linha .as-chip{flex:none}
.ag-chip-canc{color:var(--bx-red);border-color:color-mix(in srgb,var(--bx-red) 30%,transparent);background:color-mix(in srgb,var(--bx-red) 8%,transparent)}
.ag-topo{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.ag-topo .as-btn{width:auto;flex:none}
.ag-sub{margin:4px 0 0}
.ag-hoje{align-items:stretch;text-align:left;gap:8px;padding:16px}
.ag-hoje .ag-hoje-l{display:flex;align-items:center;gap:10px}
.ag-hoje .at{font-size:20px;margin-top:2px;word-break:normal}
.ag-vazio{padding:24px 12px;border:1px dashed var(--bx-border-2);border-radius:12px;text-align:center;display:flex;flex-direction:column;gap:4px}
@media (prefers-reduced-motion:reduce){.ag-linha{transition:none}}
`
