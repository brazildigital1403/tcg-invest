'use client'

import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { lerParametro } from '@/lib/deepLink'
import { IconArrowDown, IconArrowUp, IconChevronDown } from '@/components/ui/Icons'
import { fmtDiaMes, fmtMesDesde, fmtPct, resumirHistorico, rotulo30, type PontoHistorico } from '@/lib/historicoCarta'

type Point = PontoHistorico

const fmtFull = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

const fmtCompact = (v: number) => {
  if (v >= 1000) return 'R$ ' + (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.', ',') + 'k'
  return 'R$ ' + Math.round(v)
}

const fmtDate = (s: string) => fmtDiaMes(String(s).slice(0, 10))

const RANGES = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '6m', days: 180 },
  { label: '1a', days: 365 },
]

/**
 * Historico de preco da carta.
 *
 * ★ 09/10/2026 (Fase 2b do #490): aceita os pontos ja buscados pelo SERVIDOR
 * (`pontos`). Com eles, o grafico, as duas frases derivadas e a tabela saem no
 * HTML -- antes tudo nascia num `useEffect`, e a pagina que o Google e os
 * modelos de IA leem nao tinha historico nenhum. Sem `pontos` (hub do
 * Pokemon), continua buscando no cliente como sempre.
 *
 * A copy antiga ("o historico passa a ser salvo todos os dias") era falsa: o
 * levantamento cobre ~90 cartas por dia. O que se diz agora e o que o dado
 * sustenta: quantos levantamentos houve e desde quando.
 *
 * `periodoDaUrl`: abre no periodo pedido em `?periodo=30d|90d|6m` (deep link do
 * e-mail E06B). Lido no cliente, como os outros deep links (src/lib/deepLink.ts).
 *
 * `rodape`: acao colada no bloco (a pagina da carta poe o "Acompanhar preco"
 * aqui, que e onde a pessoa acabou de ver o preco se mexer).
 */
export default function PriceHistory({
  cardId,
  periodoDaUrl = false,
  pontos,
  rodape,
  precoSuspeito = false,
}: {
  cardId: string
  periodoDaUrl?: boolean
  pontos?: Point[]
  rodape?: ReactNode
  /**
   * Carta marcada pelo guard: a frase de variacao SOME. A RPC so filtra
   * levantamento acima de 8x da mediana, entao a oferta inflada de hoje pode
   * estar na serie -- e "subiu 566%" logo abaixo de "a referencia e a
   * mediana" seria a pagina contradizendo a si mesma. Minima, maxima e
   * contagem continuam: sao fatos dos levantamentos.
   */
  precoSuspeito?: boolean
}) {
  const [all, setAll] = useState<Point[]>(pontos ?? [])
  const [loaded, setLoaded] = useState(!!pontos)
  const [range, setRange] = useState(180)

  useEffect(() => {
    if (!periodoDaUrl) return
    const pedido = RANGES.find((r) => r.label === lerParametro('periodo'))
    if (pedido) setRange(pedido.days)
  }, [periodoDaUrl])

  useEffect(() => {
    if (pontos) return
    let active = true
    supabase.rpc('get_card_price_history', { p_id: cardId, p_days: 365 }).then(({ data }) => {
      if (!active) return
      setAll((data as Point[]) || [])
      setLoaded(true)
    })
    return () => { active = false }
  }, [cardId, pontos])

  const pts = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - range)
    const iso = cutoff.toISOString().slice(0, 10)
    return all.filter((p) => String(p.snapshot_date).slice(0, 10) >= iso && p.preco_medio != null)
  }, [all, range])

  const resumo = useMemo(() => resumirHistorico(all), [all])

  if (!loaded || all.length === 0) return null

  const showToggle = all.length > 1
  const single = pts.length <= 1

  const W = 600, H = 180, padL = 8, padR = 8, padT = 14, padB = 4
  const innerW = W - padL - padR, innerH = H - padT - padB
  const n = pts.length
  const mins = pts.map((p) => Number(p.preco_min != null ? p.preco_min : p.preco_medio))
  const maxs = pts.map((p) => Number(p.preco_max != null ? p.preco_max : p.preco_medio))
  let lo = mins.length ? Math.min.apply(null, mins) : 0
  let hi = maxs.length ? Math.max.apply(null, maxs) : 1
  if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1 }
  if (lo === hi) { lo = lo * 0.95; hi = hi * 1.05 || 1 }
  const span = hi - lo || 1
  const xOf = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const yOf = (v: number) => padT + innerH - ((v - lo) / span) * innerH

  const lineMedio = pts.map((p, i) => xOf(i) + ',' + yOf(Number(p.preco_medio))).join(' ')
  const bandTop = pts.map((p, i) => xOf(i) + ',' + yOf(Number(p.preco_max != null ? p.preco_max : p.preco_medio))).join(' ')
  const bandBot = pts.map((p, i) => xOf(n - 1 - i) + ',' + yOf(Number(pts[n - 1 - i].preco_min != null ? pts[n - 1 - i].preco_min : pts[n - 1 - i].preco_medio))).join(' ')
  const bandPath = n > 1 ? bandTop + ' ' + bandBot : ''

  // ─── As duas frases derivadas (sempre da serie inteira, nao do periodo) ───
  const v30 = !precoSuspeito && resumo?.variacao30 ? resumo.variacao30 : null
  const periodo30 = resumo ? rotulo30(resumo) : 'em 30 dias'
  const subiu = v30 ? v30.pct >= 1 : false
  const caiu = v30 ? v30.pct <= -1 : false
  const corVar = subiu ? 'var(--bx-green)' : caiu ? 'var(--bx-red)' : 'var(--bx-text-2)'

  return (
    <section
      aria-labelledby="historico-de-preco"
      style={{ background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 14, padding: '16px 18px', marginBottom: 24 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <h2 id="historico-de-preco" style={{ fontSize: 11, fontWeight: 700, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
          Histórico de preço
        </h2>
        {showToggle && (
          <div role="group" aria-label="Período" style={{ display: 'flex', gap: 4, background: 'var(--bx-surface-2)', borderRadius: 10, padding: 3 }}>
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setRange(r.days)}
                aria-pressed={range === r.days}
                style={{
                  fontSize: 12, fontWeight: 700, minHeight: 40, padding: '8px 12px', borderRadius: 8, border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: range === r.days ? 'rgba(var(--ac-1-rgb),0.18)' : 'transparent',
                  color: range === r.days ? 'var(--ac-1)' : 'var(--bx-text-3)',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {single ? (
        pts.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--bx-text-3)', textAlign: 'center', padding: '8px 0' }}>Sem registros nesse período.</p>
        ) : (
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <p style={{ fontSize: 26, fontWeight: 900, color: '#60a5fa', letterSpacing: '-0.02em' }}>{fmtFull(Number(pts[0].preco_medio))}</p>
            <p style={{ fontSize: 12, color: 'var(--bx-text-3)', marginTop: 6, lineHeight: 1.5 }}>
              Registrado em {fmtDate(pts[0].snapshot_date)}.{' '}
              {all.length === 1
                ? 'Um levantamento só por enquanto: a evolução aparece quando houver mais.'
                : 'Amplie o período para ver os outros levantamentos.'}
            </p>
          </div>
        )
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 180, display: 'block' }} aria-hidden="true">
            {[0, 0.5, 1].map((t) => {
              const y = padT + innerH - t * innerH
              return <line key={t} x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            })}
            {bandPath && <polygon points={bandPath} fill="rgba(96,165,250,0.10)" stroke="none" />}
            <polyline points={lineMedio} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => <circle key={i} cx={xOf(i)} cy={yOf(Number(p.preco_medio))} r="2.5" fill="#60a5fa" />)}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--bx-text-3)', marginTop: 4 }}>
            <span>{fmtDate(pts[0].snapshot_date)}</span>
            <span>{fmtCompact(lo)} - {fmtCompact(hi)}</span>
            <span>{fmtDate(pts[n - 1].snapshot_date)}</span>
          </div>
        </>
      )}

      {/* ★ O que o dado sustenta, em prosa: entra no HTML e e o que da pra
          citar. Frase 1 = variacao em 30 dias; frase 2 = minima, maxima e
          quantos levantamentos desde quando. Nada de "salvo todos os dias". */}
      {resumo && resumo.n > 1 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--bx-text-2)', margin: 0, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            {v30 ? (
              <>
                {(subiu || caiu) && (
                  <span style={{ flex: 'none', marginTop: 2, color: corVar }}>
                    {subiu ? <IconArrowUp size={14} color={corVar} /> : <IconArrowDown size={14} color={corVar} />}
                  </span>
                )}
                <span>
                  <b style={{ color: corVar, fontWeight: 700 }}>
                    {subiu ? `Subiu ${fmtPct(v30.pct)}` : caiu ? `Caiu ${fmtPct(v30.pct)}` : 'Estável'} {periodo30}
                  </b>
                  {subiu || caiu
                    ? ` (de ${fmtFull(v30.de)} para ${fmtFull(v30.para)}).`
                    : ` (${fmtFull(v30.para)}).`}
                </span>
              </>
            ) : precoSuspeito ? (
              <span>A oferta de hoje está sob revisão; a referência desta carta é a mediana dos levantamentos.</span>
            ) : (
              <span>Ainda não há 30 dias de histórico para comparar; o primeiro levantamento é de {fmtDate(resumo.primeiro)}.</span>
            )}
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--bx-text-2)', margin: 0 }}>
            Mínima <b style={{ color: 'var(--bx-text)', fontWeight: 600 }}>{fmtFull(resumo.minima.valor)}</b> em {fmtDate(resumo.minima.em)}
            {' · '}máxima <b style={{ color: 'var(--bx-text)', fontWeight: 600 }}>{fmtFull(resumo.maxima.valor)}</b> em {fmtDate(resumo.maxima.em)}
            {' · '}{resumo.n} levantamentos desde {fmtMesDesde(resumo.primeiro, resumo.ultimo.slice(0, 4))}.
          </p>
        </div>
      )}

      {all.length > 1 && (
        <details className="bx-details" style={{ marginTop: 10 }}>
          <summary style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--bx-text-2)' }}>
            <IconChevronDown size={14} color="currentColor" style={{ transition: 'transform 0.15s ease' }} />
            Ver os últimos levantamentos
          </summary>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: 'var(--bx-text-3)' }}>
                  <th style={{ textAlign: 'left', fontWeight: 600, padding: '4px 0' }}>Data</th>
                  <th style={{ textAlign: 'right', fontWeight: 600, padding: '4px 8px' }}>Mín</th>
                  <th style={{ textAlign: 'right', fontWeight: 600, padding: '4px 8px' }}>Médio</th>
                  <th style={{ textAlign: 'right', fontWeight: 600, padding: '4px 0' }}>Máx</th>
                </tr>
              </thead>
              <tbody>
                {all.slice(-6).reverse().map((p, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--bx-border)' }}>
                    <td style={{ textAlign: 'left', padding: '8px 0', color: 'var(--bx-text-2)' }}>{fmtDate(p.snapshot_date)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 8px', color: 'var(--bx-green)' }}>{p.preco_min != null ? fmtFull(Number(p.preco_min)) : '-'}</td>
                    <td style={{ textAlign: 'right', padding: '8px 8px', color: '#60a5fa', fontWeight: 700 }}>{p.preco_medio != null ? fmtFull(Number(p.preco_medio)) : '-'}</td>
                    <td style={{ textAlign: 'right', padding: '8px 0', color: 'var(--ac-1)' }}>{p.preco_max != null ? fmtFull(Number(p.preco_max)) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {rodape && <div style={{ marginTop: 14 }}>{rodape}</div>}
    </section>
  )
}
