'use client'

// Fila do servico de bancada (restauracao / pre-grading).
// Segmenta por DE QUEM E A VEZ, como os tickets: "Com a Bynx" e o que espera
// acao sua (orcar, receber, tratar, enviar); "Com o cliente" e orcamento
// enviado ou carta a caminho. Datas sempre em horario de Brasilia.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { STATUS_SERVICO, turnoServico, SERVICOS, brl, numeroServico, fmtDataHoraBRT } from '@/lib/servicos'
import { IconClock, IconCheck, IconImage } from '@/components/ui/Icons'

type Linha = {
  id: string
  numero: number
  servico: string
  prazo: string
  status: string
  valor_declarado_cents: number
  total_cents: number | null
  created_at: string
  updated_at: string
  cartas: number
  fotos_completas: boolean
  user_name: string | null
  user_email: string | null
}

type Seg = 'bynx' | 'cliente' | 'fim' | 'tudo'
const SEGS: { k: Seg; l: string }[] = [
  { k: 'bynx', l: 'Com a Bynx' },
  { k: 'cliente', l: 'Com o cliente' },
  { k: 'fim', l: 'Encerrados' },
  { k: 'tudo', l: 'Tudo' },
]

const nomeServico = (id: string) => SERVICOS.find(s => s.id === id)?.nome || id

export default function AdminServicosPage() {
  const [rows, setRows] = useState<Linha[] | null>(null)
  const [erro, setErro] = useState(false)
  const [seg, setSeg] = useState<Seg>('bynx')

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/servicos', { cache: 'no-store' })
      if (!r.ok) { setErro(true); return }
      const d = await r.json()
      setErro(false)
      setRows(d.solicitacoes || [])
    } catch { setErro(true) }
  }, [])
  // Todo setState de load() acontece depois do await do fetch; o lint nao enxerga isso.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const visiveis = (rows || []).filter(r => seg === 'tudo' || turnoServico(r.status) === seg)

  return (
    <div className="as-wrap">
      <style>{CSS}</style>
      <h1 className="as-h1">Serviços de bancada</h1>
      <p className="as-sub">Pedidos de restauração e pré-grading, do mais recente ao mais antigo. Horários de Brasília.</p>

      <div className="as-segs">
        {SEGS.map(s => {
          const n = rows ? (s.k === 'tudo' ? rows.length : rows.filter(r => turnoServico(r.status) === s.k).length) : null
          return (
            <button key={s.k} type="button" className={`as-seg${seg === s.k ? ' as-seg-on' : ''}${s.k === 'bynx' ? ' as-seg-bynx' : ''}`} onClick={() => setSeg(s.k)}>
              {s.l}{n !== null && <b>{n}</b>}
            </button>
          )
        })}
      </div>

      {erro ? (
        <div className="as-vazio as-vazio-erro">
          <p>Não deu para carregar os pedidos.</p>
          <button type="button" className="as-bt" onClick={load}>Tentar de novo</button>
        </div>
      ) : !rows ? (
        <p className="as-carregando">Carregando...</p>
      ) : visiveis.length === 0 ? (
        <div className={`as-vazio${seg === 'bynx' ? ' as-vazio-ok' : ''}`}>
          {seg === 'bynx' && <IconCheck size={20} />}
          <p>{seg === 'bynx' ? 'Nada esperando você agora.' : 'Nenhum pedido neste grupo.'}</p>
        </div>
      ) : (
        <div className="as-lista">
          {visiveis.map(r => {
            const vez = turnoServico(r.status)
            const semFotos = r.status === 'aguardando_orcamento' && !r.fotos_completas
            return (
              <Link key={r.id} href={`/admin/servicos/${r.id}`} className={`as-item${vez === 'bynx' ? ' as-item-bynx' : ''}${vez === 'fim' ? ' as-item-fim' : ''}`}>
                <span className="as-num">{numeroServico(r.numero)}</span>
                <div className="as-meio">
                  <b>{r.user_name || r.user_email || 'Cliente'}</b>
                  <span>{nomeServico(r.servico)} · {r.cartas} {r.cartas === 1 ? 'carta' : 'cartas'} · declarado R$ {brl(r.valor_declarado_cents / 100)}{r.prazo === 'expresso' ? ' · expresso' : ''}</span>
                </div>
                <div className="as-dir">
                  <span className={`as-pill as-pill-${vez}`}>{vez === 'bynx' && <IconClock size={11} />}{STATUS_SERVICO[r.status] || r.status}</span>
                  {semFotos && <span className="as-aviso"><IconImage size={11} /> fotos incompletas</span>}
                  <small>{fmtDataHoraBRT.format(new Date(r.updated_at))}</small>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

const CSS = `
.as-wrap{padding:32px 24px;max-width:1100px;margin:0 auto;font-family:var(--font-dm-sans),system-ui,sans-serif;color:var(--bx-text)}
.as-h1{font-size:26px;font-weight:800;letter-spacing:-0.03em;margin:0 0 6px}
.as-sub{font-size:13px;color:var(--bx-text-3);margin:0 0 20px}
.as-segs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px}
.as-seg{display:flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--bx-border);background:transparent;color:var(--bx-text-2);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.as-seg b{opacity:.65}
.as-seg-on{background:var(--bx-surface-2);border-color:var(--bx-border-2);color:var(--bx-text)}
.as-seg-bynx.as-seg-on{background:rgba(var(--ac-1-rgb),.12);border-color:rgba(var(--ac-1-rgb),.45);color:var(--ac-1)}
.as-lista{display:grid;gap:8px}
.as-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px 18px;border-radius:12px;border:1px solid var(--bx-border);background:var(--bx-surface);color:inherit;text-decoration:none;transition:background .15s ease,border-color .15s ease}
.as-item:hover{background:var(--bx-surface-2)}
.as-item-bynx{border-left:2px solid var(--ac-1)}
.as-item-fim{opacity:.7}
.as-num{font-weight:800;font-size:14px;font-variant-numeric:tabular-nums;color:var(--bx-text-2)}
.as-meio{min-width:0}
.as-meio b{display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.as-meio span{display:block;font-size:12px;color:var(--bx-text-3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.as-dir{display:flex;flex-direction:column;align-items:flex-end;gap:4px;text-align:right}
.as-dir small{font-size:11px;color:var(--bx-text-3);font-variant-numeric:tabular-nums}
.as-pill{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;padding:4px 9px;border-radius:999px;white-space:nowrap}
.as-pill-bynx{color:var(--ac-1);background:rgba(var(--ac-1-rgb),.12)}
.as-pill-cliente{color:var(--bx-blue);background:color-mix(in srgb,var(--bx-blue) 12%,transparent)}
.as-pill-fim{color:var(--bx-text-3);background:var(--bx-surface-2)}
.as-aviso{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;color:var(--bx-red)}
.as-vazio{display:flex;flex-direction:column;align-items:center;gap:10px;padding:40px 20px;border-radius:14px;border:1px dashed var(--bx-border-2);text-align:center;color:var(--bx-text-3);font-size:14px}
.as-vazio p{margin:0}
.as-vazio-ok{color:var(--bx-green);border-color:color-mix(in srgb,var(--bx-green) 30%,transparent)}
.as-vazio-erro{color:var(--bx-red)}
.as-carregando{text-align:center;color:var(--bx-text-3);font-size:13px;padding:40px 0}
.as-bt{min-height:36px;padding:0 14px;border-radius:8px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
@media (max-width:640px){
  .as-wrap{padding:20px 16px}
  .as-item{grid-template-columns:minmax(0,1fr) auto;padding:12px 14px}
  .as-num{grid-column:1 / -1}
}
`
