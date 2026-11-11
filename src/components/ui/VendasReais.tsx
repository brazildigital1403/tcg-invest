'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Painel "Vendas reais" do detalhe da carta (Colecao e Pokedex).
 *
 * ★ 11/11/2026, mockup aprovado pelo Du (artifact 4GDJm258TSsDhochRoWxw7).
 * Substitui a lista "Historico de vendas" de 7/15/30/60 dias. Mostra venda por
 * venda do Mercado Brasileiro: periodo, filtro de idioma e condicao com
 * contagem, media da copia da pessoa, grafico (um ponto por venda + linha da
 * media do mes) e a lista.
 *
 * Regras que vieram do dado real:
 * - A fonte que cobria quase todo o catalogo parou em 06/09; com o periodo
 *   vazio o painel mostra as ultimas vendas que existem (estado A), nunca
 *   "coletando desde hoje".
 * - Com menos de 5 vendas a media engana: o painel nao mostra media (estado B).
 *   Mesma licao do "valor de divulgacao e o menor preco" (25/08).
 * - A variante muda de nome conforme a fonte (Foil, Normal, Full-Art na mesma
 *   carta), por isso a "sua copia" casa por idioma e condicao, nao variante.
 */

interface Venda {
  data: string
  valor_cents: number
  idioma: string | null
  condicao: string | null
  variante: string | null
}

type Periodo = '3m' | '6m' | '12m' | 'tudo'
const PERIODOS: { id: Periodo; rotulo: string; dias: number | null; texto: string }[] = [
  { id: '3m', rotulo: '3 meses', dias: 92, texto: 'nos últimos 3 meses' },
  { id: '6m', rotulo: '6 meses', dias: 183, texto: 'nos últimos 6 meses' },
  { id: '12m', rotulo: '12 meses', dias: 365, texto: 'nos últimos 12 meses' },
  { id: 'tudo', rotulo: 'Tudo', dias: null, texto: 'desde o início' },
]
const MINIMO_MEDIA = 5
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const tempo = (data: string) => new Date(data + 'T12:00:00Z').getTime()
const ddmm = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`
const meta = (v: Venda) => [v.idioma, v.condicao, v.variante].filter(Boolean).join(' · ')

export default function VendasReais({ cardId, suaCopia }: {
  cardId: string | null | undefined
  /** Idioma e condicao da copia da pessoa (ex.: PT, NM). Sem isso, a media vale para o filtro. */
  suaCopia?: { idioma: string; condicao: string } | null
}) {
  const [vendas, setVendas] = useState<Venda[] | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('3m')
  const [fIdioma, setFIdioma] = useState<string>('todos')
  const [fCond, setFCond] = useState<string>('todas')
  const [verTodas, setVerTodas] = useState(false)
  // Um relogio por montagem: Date.now() direto no render e impuro (regra do React).
  const [agora] = useState(() => Date.now())

  useEffect(() => {
    if (!cardId) return
    let ativo = true
    fetch(`/api/cards/${encodeURIComponent(cardId)}/historico-vendas`)
      .then(r => (r.ok ? r.json() : { vendas: [] }))
      .then(d => { if (ativo) setVendas(Array.isArray(d.vendas) ? d.vendas : []) })
      .catch(() => { if (ativo) setVendas([]) })
    // Trocar de carta remonta o painel (key={cardId} no modal): o estado zera sozinho.
    return () => { ativo = false }
  }, [cardId])

  const per = PERIODOS.find(p => p.id === periodo)!
  const noPeriodo = useMemo(() => {
    if (!vendas) return []
    if (per.dias == null) return vendas
    const desde = agora - per.dias * 86400000
    return vendas.filter(v => tempo(v.data) >= desde)
  }, [vendas, per.dias, agora])

  const contar = (campo: 'idioma' | 'condicao') => {
    const m = new Map<string, number>()
    noPeriodo.forEach(v => { const k = v[campo]; if (k) m.set(k, (m.get(k) || 0) + 1) })
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const idiomas = contar('idioma')
  const condicoes = contar('condicao')
  const filtradas = noPeriodo.filter(v =>
    (fIdioma === 'todos' || v.idioma === fIdioma) && (fCond === 'todas' || v.condicao === fCond))

  // ── Estilos (tokens; o acento herda o contexto) ─────────────────────────────
  const rotulo: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--bx-text-3)' }
  const chip = (on: boolean): React.CSSProperties => ({
    flexShrink: 0, minHeight: 36, padding: '0 12px', borderRadius: 999, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${on ? 'var(--ac-1)' : 'var(--bx-border-2)'}`, background: on ? 'rgba(var(--ac-1-rgb), 0.12)' : 'transparent',
    color: on ? 'var(--ac-1)' : 'var(--bx-text-2)', transition: 'background .15s ease, border-color .15s ease, color .15s ease',
  })
  const tile: React.CSSProperties = { padding: 12, borderRadius: 12, border: '1px solid var(--bx-border)', background: 'var(--bx-surface)', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }
  const nota: React.CSSProperties = { margin: 0, fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.5 }

  const cabecalho = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ac-1)' }}>Vendas reais</h3>
      <p style={nota}>Quanto esta carta foi vendida de verdade no Mercado Brasileiro, venda por venda.</p>
    </div>
  )

  if (!cardId) return null
  if (vendas == null) {
    return <section className="bx-vr">{cabecalho}<p style={{ ...nota, color: 'var(--bx-text-faint)' }}>Carregando…</p></section>
  }

  // Estado C: nenhuma venda registrada.
  if (vendas.length === 0) {
    return (
      <section className="bx-vr">
        {cabecalho}
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Ainda não temos vendas registradas desta carta.</p>
        <p style={nota}>O preço de referência acima continua valendo. Ele vem dos anúncios abertos no Mercado Brasileiro, não de vendas concluídas.</p>
        <Estilos />
      </section>
    )
  }

  const abas = (
    <div role="tablist" aria-label="Período" className="bx-vr-abas">
      {PERIODOS.map(p => (
        <button key={p.id} type="button" role="tab" aria-selected={periodo === p.id}
          onClick={() => { setPeriodo(p.id); setFIdioma('todos'); setFCond('todas'); setVerTodas(false) }}
          className={periodo === p.id ? 'bx-vr-aba on' : 'bx-vr-aba'}>{p.rotulo}</button>
      ))}
    </div>
  )

  // Estado A: o periodo veio vazio, mas ha vendas mais antigas.
  if (noPeriodo.length === 0) {
    return (
      <section className="bx-vr">
        {cabecalho}
        {abas}
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--bx-border)', background: 'var(--bx-surface)' }}>
          <p style={nota}>Nenhuma venda registrada {per.texto}. Por isso não mostramos média: estas são as últimas vendas que temos.</p>
        </div>
        <Lista vendas={vendas.slice(0, 5)} agora={agora} />
        {vendas.length > 5 && (
          <button type="button" className="bx-vr-link" onClick={() => setPeriodo('tudo')}>Ver todas as {vendas.length} vendas</button>
        )}
        <Estilos />
      </section>
    )
  }

  // Destaque: a copia da pessoa (idioma + condicao) ou, sem ela, o filtro.
  const baseMedia = suaCopia
    ? noPeriodo.filter(v => v.idioma === suaCopia.idioma && v.condicao === suaCopia.condicao)
    : filtradas
  const media = baseMedia.length >= MINIMO_MEDIA
    ? Math.round(baseMedia.reduce((s, v) => s + v.valor_cents, 0) / baseMedia.length)
    : null
  const tituloMedia = suaCopia ? `Sua cópia · ${suaCopia.idioma} · ${suaCopia.condicao}` : `Média · ${per.rotulo}`
  const ultima = filtradas[0]
  const mostradas = verTodas ? filtradas : filtradas.slice(0, 8)

  return (
    <section className="bx-vr">
      {cabecalho}
      {abas}

      {(idiomas.length > 1 || condicoes.length > 1) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {idiomas.length > 1 && <>
            <span style={rotulo}>Idioma</span>
            <div className="bx-vr-chips">
              <button type="button" aria-pressed={fIdioma === 'todos'} onClick={() => { setFIdioma('todos'); setVerTodas(false) }} style={chip(fIdioma === 'todos')}>Todos <span style={{ opacity: 0.7, fontWeight: 500 }}>{noPeriodo.length}</span></button>
              {idiomas.map(([k, n]) => (
                <button key={k} type="button" aria-pressed={fIdioma === k} onClick={() => { setFIdioma(k); setVerTodas(false) }} style={chip(fIdioma === k)}>{k} <span style={{ opacity: 0.7, fontWeight: 500 }}>{n}</span></button>
              ))}
            </div>
          </>}
          {condicoes.length > 1 && <>
            <span style={{ ...rotulo, marginTop: 4 }}>Condição</span>
            <div className="bx-vr-chips">
              <button type="button" aria-pressed={fCond === 'todas'} onClick={() => { setFCond('todas'); setVerTodas(false) }} style={chip(fCond === 'todas')}>Todas <span style={{ opacity: 0.7, fontWeight: 500 }}>{noPeriodo.length}</span></button>
              {condicoes.map(([k, n]) => (
                <button key={k} type="button" aria-pressed={fCond === k} onClick={() => { setFCond(k); setVerTodas(false) }} style={chip(fCond === k)}>{k} <span style={{ opacity: 0.7, fontWeight: 500 }}>{n}</span></button>
              ))}
            </div>
          </>}
        </div>
      )}

      <div className="bx-vr-tiles">
        <div className="bx-vr-destaque" style={{ ...tile, border: '1px solid rgba(var(--ac-1-rgb), 0.35)', background: 'rgba(var(--ac-1-rgb), 0.06)' }}>
          <span style={{ ...rotulo, color: 'var(--ac-1)' }}>{tituloMedia}</span>
          {media != null ? <>
            <span style={{ fontSize: 24, fontWeight: 800 }}>{brl(media)}</span>
            <span style={{ fontSize: 12, color: 'var(--bx-text-2)' }}>média de {baseMedia.length} vendas {per.texto}</span>
          </> : <>
            <span style={{ fontSize: 18, fontWeight: 800 }}>Poucas vendas para média</span>
            <span style={{ fontSize: 12, color: 'var(--bx-text-2)', lineHeight: 1.45 }}>
              {baseMedia.length === 0 ? `Nenhuma venda ${per.texto}` : `Só ${baseMedia.length} ${baseMedia.length === 1 ? 'venda' : 'vendas'} ${per.texto}`}. Com menos de {MINIMO_MEDIA}, a média engana: olhe as vendas uma a uma.
            </span>
          </>}
        </div>
        <div style={tile}>
          <span style={rotulo}>Vendas</span>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{filtradas.length}</span>
          <span style={{ fontSize: 12, color: 'var(--bx-text-2)' }}>{per.texto}</span>
        </div>
        <div style={tile}>
          <span style={rotulo}>Última</span>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{ultima ? brl(ultima.valor_cents) : '—'}</span>
          <span style={{ fontSize: 12, color: 'var(--bx-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ultima ? [ddmm(ultima.data), ultima.idioma, ultima.condicao].filter(Boolean).join(' · ') : 'sem venda no filtro'}</span>
        </div>
      </div>

      {filtradas.length >= 2 && <Grafico vendas={filtradas} dias={per.dias} agora={agora} />}

      {filtradas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={rotulo}>Últimas vendas</span>
          <Lista vendas={mostradas} agora={agora} />
          {filtradas.length > 8 && (
            <button type="button" className="bx-vr-link" onClick={() => setVerTodas(v => !v)}>
              {verTodas ? 'Mostrar menos' : `Ver as ${filtradas.length} vendas`}
            </button>
          )}
        </div>
      )}
      <Estilos />
    </section>
  )
}

function Lista({ vendas, agora }: { vendas: Venda[]; agora: number }) {
  const ano = String(new Date(agora).getUTCFullYear())
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {vendas.map((v, i) => (
        <div key={i} className="bx-vr-linha">
          <span style={{ fontSize: 13, fontWeight: 700 }}>{ddmm(v.data)}{v.data.slice(0, 4) !== ano ? `/${v.data.slice(2, 4)}` : ''}</span>
          <span style={{ fontSize: 12, color: 'var(--bx-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta(v)}</span>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{brl(v.valor_cents)}</span>
        </div>
      ))}
    </div>
  )
}

function Grafico({ vendas, dias, agora }: { vendas: Venda[]; dias: number | null; agora: number }) {
  const caixa = useRef<HTMLDivElement | null>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const medir = () => setW(Math.floor(el.getBoundingClientRect().width))
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])

  const H = 170, ESQ = 44, DIR = 8, TOPO = 10, BASE = 10
  const inicio = dias != null ? agora - dias * 86400000 : Math.min(...vendas.map(v => tempo(v.data))) - 3 * 86400000
  const valores = vendas.map(v => v.valor_cents)
  let lo = Math.min(...valores), hi = Math.max(...valores)
  if (hi === lo) { lo = Math.max(0, lo - 100); hi = hi + 100 }
  const folga = (hi - lo) * 0.12
  lo = Math.max(0, lo - folga); hi = hi + folga
  const x = (t: number) => ESQ + ((t - inicio) / (agora - inicio)) * Math.max(1, w - ESQ - DIR)
  const y = (c: number) => TOPO + ((hi - c) / (hi - lo)) * (H - TOPO - BASE)

  // Media de cada mes, no ponto medio das vendas daquele mes.
  const porMes = new Map<string, { soma: number; n: number; ts: number }>()
  vendas.forEach(v => {
    const k = v.data.slice(0, 7)
    const a = porMes.get(k) || { soma: 0, n: 0, ts: 0 }
    a.soma += v.valor_cents; a.n += 1; a.ts += tempo(v.data)
    porMes.set(k, a)
  })
  const medias = [...porMes.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, a]) => ({ t: a.ts / a.n, c: a.soma / a.n }))
  const linha = medias.map(m => `${x(m.t).toFixed(1)},${y(m.c).toFixed(1)}`).join(' ')

  // Marcas em valores redondos (R$ 20, 40, 60), nunca R$ 19 / 62.
  const passos = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000]
  const passoY = passos.find(p => (hi - lo) / p <= 4) || passos[passos.length - 1]
  const ticks: number[] = []
  for (let c = Math.ceil(lo / passoY) * passoY; c <= hi; c += passoY) ticks.push(c)
  const rotulosMes: { t: number; r: string }[] = []
  const d0 = new Date(inicio)
  // O mes em que o periodo comeca, quando ainda sobra metade dele no grafico.
  if (d0.getUTCDate() <= 15) rotulosMes.push({ t: inicio, r: MESES[d0.getUTCMonth()] })
  const cur = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1))
  while (cur.getTime() <= agora) { rotulosMes.push({ t: cur.getTime(), r: MESES[cur.getUTCMonth()] }); cur.setUTCMonth(cur.getUTCMonth() + 1) }
  const passo = Math.max(1, Math.ceil(rotulosMes.length / 6))

  const minV = Math.min(...valores), maxV = Math.max(...valores)
  const resumo = `Gráfico com ${vendas.length} vendas, entre ${brl(minV)} e ${brl(maxV)}. ` +
    medias.length + (medias.length === 1 ? ' média mensal.' : ' médias mensais.')

  return (
    <figure style={{ margin: 0, padding: '12px 10px 10px', borderRadius: 12, border: '1px solid var(--bx-border)', background: 'var(--bx-surface)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div ref={caixa} style={{ width: '100%' }}>
        {w > 0 && (
          <svg width={w} height={H + 16} role="img" aria-label={resumo} style={{ display: 'block' }}>
            {ticks.map((c, i) => (
              <g key={i}>
                <line x1={ESQ} x2={w - DIR} y1={y(c)} y2={y(c)} stroke="var(--bx-border)" strokeDasharray="3 4" />
                <text x={0} y={y(c) + 4} fontSize={10} fill="var(--bx-text-3)">{brl(c).replace(',00', '')}</text>
              </g>
            ))}
            {medias.length >= 2 && <polyline points={linha} fill="none" stroke="var(--ac-1)" strokeWidth={2} strokeLinejoin="round" />}
            {vendas.map((v, i) => (
              <circle key={i} cx={x(tempo(v.data))} cy={y(v.valor_cents)} r={4} fill="rgba(var(--ac-1-rgb), 0.55)" stroke="var(--ac-1)" strokeWidth={1} />
            ))}
            {rotulosMes.filter((_, i) => i % passo === 0).map((m, i) => (
              <text key={i} x={Math.max(ESQ + 10, x(m.t))} y={H + 12} fontSize={11} fill="var(--bx-text-3)" textAnchor="middle">{m.r}</text>
            ))}
          </svg>
        )}
      </div>
      <figcaption style={{ fontSize: 12, color: 'var(--bx-text-2)' }}>Cada ponto é uma venda. A linha liga a média de cada mês.</figcaption>
    </figure>
  )
}

function Estilos() {
  return (
    <style>{`
      .bx-vr { padding: 16px 14px; border-radius: 16px; background: var(--bx-surface); border: 1px solid var(--bx-border); display: flex; flex-direction: column; gap: 14px; min-width: 0; }
      .bx-vr-abas { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; padding: 4px; border-radius: 12px; background: var(--bx-surface); border: 1px solid var(--bx-border); }
      .bx-vr-aba { min-height: 40px; border-radius: 9px; border: none; font: inherit; font-size: 13px; font-weight: 700; color: var(--bx-text-2); background: transparent; cursor: pointer; transition: background .15s ease, color .15s ease; }
      .bx-vr-aba:hover { color: var(--bx-text); }
      .bx-vr-aba.on { font-weight: 800; color: var(--bx-brand-ink); background: var(--ac-grad); }
      .bx-vr-chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
      .bx-vr-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .bx-vr-destaque { grid-column: 1 / -1; }
      .bx-vr-linha { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 44px; padding: 0 12px; border-radius: 10px; background: var(--bx-surface-2); }
      .bx-vr-link { align-self: flex-start; min-height: 44px; padding: 0; border: none; background: none; font: inherit; font-size: 13px; font-weight: 700; color: var(--ac-1); cursor: pointer; }
      @media (min-width: 900px) {
        .bx-vr-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .bx-vr-destaque { grid-column: auto; }
      }
      @media (prefers-reduced-motion: reduce) { .bx-vr-aba { transition: none; } }
    `}</style>
  )
}
