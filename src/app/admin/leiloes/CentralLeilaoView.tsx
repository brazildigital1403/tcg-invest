'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { fmtBRL } from '@/lib/comissao'
import { formatarTempoRestante, horarioBrasilia } from '@/lib/leilao'
import { urlLote } from '@/lib/leilao-urls'
import type { CentralLeilao, LoteAdmin } from '@/lib/leilaoAdmin'

/**
 * Corpo da central do leilao. Cores do /admin, cravadas como no resto da area.
 * So leitura: toda acao aqui e um link para a tela que ja faz aquilo.
 * Numero sem leitura aparece como traco, nunca como zero.
 */

type Filtro = 'todos' | 'aberto' | 'pagar' | 'vendido' | 'fim'

const ESTADO: Record<string, { rotulo: string; cor: string; filtro: Filtro }> = {
  ativo: { rotulo: 'No ar', cor: '#ef4444', filtro: 'aberto' },
  agendado: { rotulo: 'Agendado', cor: '#60a5fa', filtro: 'aberto' },
  aguardando_pagamento: { rotulo: 'A pagar', cor: '#f59e0b', filtro: 'pagar' },
  vendido: { rotulo: 'Pago', cor: '#22c55e', filtro: 'vendido' },
  calote: { rotulo: 'Não pago', cor: '#ef4444', filtro: 'fim' },
  sem_lances: { rotulo: 'Sem lances', cor: 'rgba(255,255,255,0.68)', filtro: 'fim' },
  cancelado: { rotulo: 'Cancelado', cor: 'rgba(255,255,255,0.68)', filtro: 'fim' },
}

const FILTROS: Array<{ k: Filtro; rotulo: string }> = [
  { k: 'todos', rotulo: 'Todos' },
  { k: 'aberto', rotulo: 'Abertos' },
  { k: 'pagar', rotulo: 'A pagar' },
  { k: 'vendido', rotulo: 'Vendidos' },
  { k: 'fim', rotulo: 'Sem venda' },
]

const AVISO_TRAVADO_MS = 10 * 60_000

const n = (v: number | null) => (v == null ? '—' : String(v))
const brl = (cents: number | null) => (cents == null ? '—' : fmtBRL(cents))

/** "há 9 s", "há 4 min", "há 2 h". */
function ha(iso: string | null, agora: number): string {
  if (!iso) return 'sem registro'
  const s = Math.max(0, Math.round((agora - Date.parse(iso)) / 1000))
  if (s < 60) return `há ${s} s`
  if (s < 3600) return `há ${Math.round(s / 60)} min`
  if (s < 86400) return `há ${Math.round(s / 3600)} h`
  return `há ${Math.round(s / 86400)} d`
}

function prazoRotulo(iso: string | null, agora: number): { texto: string; atrasado: boolean } {
  if (!iso) return { texto: 'Sem prazo', atrasado: false }
  const dif = Date.parse(iso) - agora
  if (dif < 0) return { texto: `Venceu ${ha(iso, agora)}`, atrasado: true }
  return { texto: `Vence em ${formatarTempoRestante(dif)}`, atrasado: false }
}

function quandoLote(l: LoteAdmin, agora: number): string {
  if (!l.quando) return '—'
  if (l.status === 'ativo') {
    const dif = Date.parse(l.quando) - agora
    return dif > 0 ? formatarTempoRestante(dif) : 'Encerrando'
  }
  return horarioBrasilia(l.quando).replace(' (Brasília)', '').replace(/\/\d{4},/, ',')
}

export default function CentralLeilaoView({ dados }: { dados: CentralLeilao }) {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const agora = Date.parse(dados.agora)
  const { numeros: x, saude } = dados
  const rel = saude.relogio
  const parado = rel?.estado === 'parado'
  // O consumidor roda a cada minuto: aviso esperando ha 10 min e fila travada.
  const avisosTravados = !!saude.aviso_mais_antigo_em && agora - Date.parse(saude.aviso_mais_antigo_em) > AVISO_TRAVADO_MS

  const lotes = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return (dados.lotes ?? []).filter(l => {
      if (filtro !== 'todos' && ESTADO[l.status]?.filtro !== filtro) return false
      if (!q) return true
      return [l.card_name, l.card_numero, l.loja, l.rodada_numero ? `#${l.rodada_numero}` : 'prazo'].join(' ').toLowerCase().includes(q)
    })
  }, [dados.lotes, filtro, busca])

  const lojasProntas = (dados.lojas ?? []).filter(l => l.recebimento && l.endereco).length

  return (
    <div className="cl">
      <style>{CSS}</style>

      <div className="cl-topo">
        <h1>Leilões</h1>
        <div className="cl-saude">
          <span className={`cl-pill${!rel || rel.estado !== 'ok' ? ' cl-pill-m' : ''}`}>
            {!rel ? 'Relógio sem leitura'
              : rel.estado === 'nao_agendado' ? 'Relógio não agendado'
              : rel.estado === 'parado' ? `Relógio parado ${ha(rel.ultima_volta_em, agora)}`
              : `Relógio ${ha(rel.ultima_volta_em, agora)}`}
          </span>
          <span className={`cl-pill${saude.avisos_pendentes == null || avisosTravados || (saude.avisos_abandonados_30d ?? 0) > 0 ? ' cl-pill-m' : ''}`}>
            Avisos: {saude.avisos_pendentes == null ? 'sem leitura' : `${saude.avisos_pendentes} na fila`}
          </span>
          <span className={`cl-pill${saude.erros_24h == null || saude.erros_24h > 0 ? ' cl-pill-m' : ''}`}>
            Erros: {saude.erros_24h == null ? 'sem leitura' : `${saude.erros_24h} em 24h`}
          </span>
        </div>
      </div>

      {parado && (
        <div className="cl-alerta" role="alert">
          <b>O relógio do leilão parou {ha(rel?.ultima_volta_em ?? null, agora)}</b>
          Lote vencido só fecha quando alguém abre a página, e prazo de pagamento não vence. Confira o job leilao_tick no banco.
        </div>
      )}
      {dados.falhas.length > 0 && (
        <div className="cl-alerta cl-alerta-a" role="status">
          <b>Parte da tela ficou sem leitura</b>
          {dados.falhas.join(', ')}. O traço não significa zero.
        </div>
      )}

      <section className="cl-bloco">
        <div className="cl-bloco-t">
          <h2>Precisa de você{dados.fila ? ` · ${dados.fila.length}` : ''}</h2>
          <small>Quem vence primeiro fica em cima</small>
        </div>
        {!dados.fila ? (
          <p className="cl-vazio">Sem leitura da fila.</p>
        ) : dados.fila.length === 0 ? (
          <p className="cl-vazio">Nada depende de você agora.</p>
        ) : (
          <div className="cl-vez">
            {dados.fila.map(i => {
              const p = prazoRotulo(i.prazo, agora)
              return (
                <div key={i.chave}>
                  <span className={`cl-prazo${p.atrasado ? ' cl-prazo-r' : ''}`}>{p.texto}</span>
                  <span className="cl-vez-t"><b>{i.titulo}</b>{i.detalhe && <small>{i.detalhe}</small>}</span>
                  <Link href={i.href} prefetch={false}>{i.acao}</Link>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="cl-bloco">
        <div className="cl-bloco-t"><h2>Agora e últimos 30 dias</h2></div>
        <div className="cl-kpis">
          <Kpi rotulo="Abertos" valor={n(x.abertos)} meta={x.abertos == null ? '' : `${x.abertos_prazo} prazo · ${x.abertos_vivo} ao vivo · ${x.agendados} agendados`} />
          <Kpi rotulo="Lances" valor={n(x.lances_30d)} meta={x.lances_24h == null ? '' : `${x.lances_24h} em 24h`} />
          <Kpi rotulo="Arremates" valor={n(x.arremates_30d)} meta={brl(x.arremates_30d_cents)} />
          <Kpi rotulo="A pagar" valor={brl(x.a_pagar_cents)} meta={x.a_pagar == null ? '' : `${x.a_pagar} ${x.a_pagar === 1 ? 'lote' : 'lotes'}`} alerta={(x.a_pagar ?? 0) > 0 ? 'w' : undefined} />
          <Kpi rotulo="Envio atrasado" valor={n(x.envio_atrasado)} meta="pago e sem rastreio" alerta={(x.envio_atrasado ?? 0) > 0 ? 'r' : undefined} />
          <Kpi rotulo="Não pagos" valor={n(x.nao_pagos_30d)} meta={brl(x.nao_pagos_30d_cents)} alerta={(x.nao_pagos_30d ?? 0) > 0 ? 'r' : undefined} />
        </div>
      </section>

      <div className="cl-duas">
        <section className="cl-bloco">
          <div className="cl-bloco-t"><h2>Lotes e rodadas</h2><small>Fechados: os 200 mais recentes</small></div>
          <div className="cl-filtros">
            <input
              className="cl-busca" type="search" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Carta, loja ou rodada" aria-label="Buscar lote, loja ou rodada"
            />
            {FILTROS.map(f => (
              <button key={f.k} type="button" className="cl-chip" aria-pressed={filtro === f.k} onClick={() => setFiltro(f.k)}>{f.rotulo}</button>
            ))}
          </div>
          {!dados.lotes ? <p className="cl-vazio">Sem leitura dos lotes.</p> : lotes.length === 0 ? <p className="cl-vazio">Nenhum lote com esse filtro.</p> : (
            <div className="cl-tab cl-tab-lotes">
              <table>
                <thead><tr><th>Lote</th><th>Loja</th><th>Estado</th><th className="cl-num">Valor</th><th className="cl-num">Lances</th><th>Fim ou prazo</th></tr></thead>
                <tbody>
                  {lotes.map(l => {
                    const e = ESTADO[l.status]
                    return (
                      <tr key={l.id}>
                        <td>
                          <a href={urlLote(l.slug)} target="_blank" rel="noopener noreferrer"><b>{l.card_name}{l.card_numero ? ` ${l.card_numero}` : ''}</b></a>
                          {' · '}{l.rodada_numero ? `Rodada #${l.rodada_numero}` : 'Prazo'}
                        </td>
                        <td>{l.loja}</td>
                        <td><span className="cl-selo" style={{ '--c': e?.cor ?? 'rgba(255,255,255,0.68)' } as React.CSSProperties}>{e?.rotulo ?? l.status}</span></td>
                        <td className="cl-num">{fmtBRL(l.valor_cents)}</td>
                        <td className="cl-num">{l.n_lances}</td>
                        <td>{quandoLote(l, agora)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="cl-bloco">
          <div className="cl-bloco-t">
            <h2>Lojas aptas</h2>
            {dados.lojas && <small>{lojasProntas} de {dados.lojas.length} prontas</small>}
          </div>
          {!dados.lojas ? <p className="cl-vazio">Sem leitura das lojas.</p> : (
            <div className="cl-tab cl-tab-lojas">
              <table>
                <thead><tr><th>Loja</th><th>Recebimento</th><th>Endereço</th><th className="cl-num">Abertos</th></tr></thead>
                <tbody>
                  {dados.lojas.map(l => (
                    <tr key={l.id}>
                      <td><Link href={`/admin/lojas/${l.id}/editar`} prefetch={false}><b>{l.nome}</b></Link></td>
                      <td>{l.recebimento ? <span className="cl-ok">Ok</span> : <span className="cl-nao">Pendente</span>}</td>
                      <td>{l.endereco ? <span className="cl-ok">Ok</span> : <span className="cl-nao">Falta</span>}</td>
                      <td className="cl-num">{l.abertos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="cl-bloco">
        <div className="cl-bloco-t"><h2>Saúde do motor</h2><small>Atualiza a cada 30 s com a aba aberta</small></div>
        <div className="cl-motor">
          <div className={!rel || rel.estado !== 'ok' ? 'cl-motor-m' : undefined}>
            <b>{!rel ? 'Relógio sem leitura' : rel.estado === 'nao_agendado' ? 'Job não agendado' : `Última volta ${ha(rel.ultima_volta_em, agora)}`}</b>
            <span>Roda a cada 10 s{rel ? ` · ${rel.falhas_6h} ${rel.falhas_6h === 1 ? 'falha' : 'falhas'} em 6 h` : ''}</span>
          </div>
          <div className={avisosTravados || (saude.avisos_abandonados_30d ?? 0) > 0 ? 'cl-motor-m' : undefined}>
            <b>{n(saude.avisos_pendentes)} avisos na fila</b>
            <span>Mais antigo: {saude.aviso_mais_antigo_em ? ha(saude.aviso_mais_antigo_em, agora) : 'nenhum'} · {n(saude.avisos_abandonados_30d)} abandonados em 30 dias</span>
          </div>
          <div className={(saude.erros_24h ?? 0) > 0 ? 'cl-motor-m' : undefined}>
            <b>{n(saude.erros_24h)} erros do motor em 24 h</b>
            <span>{saude.ultimo_erro_em ? `Último ${ha(saude.ultimo_erro_em, agora)}` : 'Nenhum registrado'}</span>
          </div>
        </div>
      </section>
    </div>
  )
}

function Kpi({ rotulo, valor, meta, alerta }: { rotulo: string; valor: string; meta?: string; alerta?: 'w' | 'r' }) {
  return (
    <div className={`cl-kpi${alerta ? ` cl-kpi-${alerta}` : ''}`}>
      <span>{rotulo}</span>
      <b>{valor}</b>
      {meta && <small>{meta}</small>}
    </div>
  )
}

const CSS = `
.cl { display: flex; flex-direction: column; gap: 20px; min-width: 0; color: #f4f5f7; font-size: 14px; line-height: 1.45; }
.cl h1, .cl h2, .cl p { margin: 0; }
.cl-topo { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.cl-topo h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
.cl-saude { display: flex; flex-wrap: wrap; gap: 8px; }
.cl-pill { display: inline-flex; align-items: center; gap: 7px; min-height: 30px; padding: 3px 11px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.15); font-size: 12.5px; font-weight: 700; color: rgba(255,255,255,0.68); white-space: nowrap; font-variant-numeric: tabular-nums; }
.cl-pill::before { content: ""; width: 8px; height: 8px; border-radius: 999px; background: #22c55e; }
.cl-pill-m { color: #ef4444; border-color: rgba(239,68,68,0.5); background: rgba(239,68,68,0.08); }
.cl-pill-m::before { background: #ef4444; }
.cl-alerta { padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(239,68,68,0.5); background: rgba(239,68,68,0.09); color: rgba(255,255,255,0.68); }
.cl-alerta b { display: block; color: #f4f5f7; }
.cl-alerta-a { border-color: rgba(245,158,11,0.45); background: rgba(245,158,11,0.07); }
.cl-bloco { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.cl-bloco-t { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
.cl-bloco-t h2 { font-size: 15px; font-weight: 800; }
.cl-bloco-t small { font-size: 12px; color: rgba(255,255,255,0.45); }
.cl-vazio { padding: 14px; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; color: rgba(255,255,255,0.68); }
.cl-vez { display: flex; flex-direction: column; border: 1px solid rgba(245,158,11,0.35); border-radius: 14px; overflow: hidden; background: rgba(245,158,11,0.04); }
.cl-vez > div { display: grid; grid-template-columns: 124px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 10px 14px; }
.cl-vez > div + div { border-top: 1px solid rgba(255,255,255,0.08); }
.cl-prazo { font-size: 12px; font-weight: 800; font-variant-numeric: tabular-nums; color: #f59e0b; }
.cl-prazo-r { color: #ef4444; }
.cl-vez-t { min-width: 0; }
.cl-vez-t b { display: block; font-weight: 700; overflow-wrap: anywhere; }
.cl-vez-t small { display: block; font-size: 12.5px; color: rgba(255,255,255,0.68); }
.cl-vez a { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 12px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); color: #f4f5f7; font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; transition: background 0.15s ease; }
.cl-vez a:hover { background: rgba(255,255,255,0.1); }
.cl-kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
.cl-kpi { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 12px 14px; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; background: rgba(255,255,255,0.03); }
.cl-kpi span { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.68); }
.cl-kpi b { font-size: clamp(18px, 1.6vw, 22px); font-weight: 800; letter-spacing: -0.015em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.cl-kpi small { font-size: 11.5px; color: rgba(255,255,255,0.45); }
.cl-kpi-w b { color: #f59e0b; } .cl-kpi-r b { color: #ef4444; }
.cl-duas { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr); gap: 20px; align-items: start; }
.cl-filtros { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.cl-busca { flex: 1 1 180px; min-width: 0; min-height: 44px; padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.03); color: #f4f5f7; font: inherit; font-size: 16px; outline: none; }
.cl-busca:focus-visible, .cl-chip:focus-visible { outline: 2px solid #f59e0b; outline-offset: 2px; }
.cl-chip { min-height: 44px; padding: 0 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.08); background: transparent; color: rgba(255,255,255,0.68); font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; transition: background 0.15s ease, border-color 0.15s ease; }
.cl-chip:hover { background: rgba(255,255,255,0.06); }
.cl-chip[aria-pressed="true"] { border-color: #f59e0b; color: #f59e0b; background: rgba(245,158,11,0.1); }
.cl-tab { overflow-x: auto; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; }
.cl-tab table { width: 100%; border-collapse: collapse; font-size: 13px; }
.cl-tab th { text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: rgba(255,255,255,0.45); border-bottom: 1px solid rgba(255,255,255,0.08); white-space: nowrap; }
.cl-tab td { padding: 9px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.68); white-space: nowrap; font-variant-numeric: tabular-nums; }
.cl-tab tr:last-child td { border-bottom: 0; }
.cl-tab-lotes { max-height: 480px; overflow-y: auto; }
.cl-tab-lotes th { position: sticky; top: 0; z-index: 1; background: #101217; }
.cl-tab td b { color: #f4f5f7; font-weight: 700; }
.cl-tab a { color: inherit; text-decoration: none; }
.cl-tab a:hover b { text-decoration: underline; }
.cl-tab .cl-num { text-align: right; }
.cl-selo { display: inline-block; padding: 2px 8px; border-radius: 7px; font-size: 11px; font-weight: 800; color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); border: 1px solid color-mix(in srgb, var(--c) 38%, transparent); }
.cl-ok { color: #22c55e; font-weight: 700; } .cl-nao { color: #ef4444; font-weight: 700; }
.cl-motor { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.cl-motor > div { padding: 12px 14px; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; background: rgba(255,255,255,0.03); min-width: 0; }
.cl-motor b { display: block; font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; }
.cl-motor span { display: block; font-size: 12.5px; color: rgba(255,255,255,0.68); }
.cl-motor .cl-motor-m { border-color: rgba(239,68,68,0.5); }
.cl-motor .cl-motor-m b { color: #ef4444; }
@media (max-width: 1400px) { .cl-duas { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 1180px) { .cl-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 760px) {
  .cl-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cl-vez > div { grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .cl-vez a { width: 100%; }
  .cl-motor { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) { .cl-chip, .cl-vez a { transition: none; } }
`
