'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { IconWarning } from '@/components/ui/Icons'

type Metrics = {
  tickets: { open: number; in_progress: number; resolved: number; last7: number }
  users:   { total: number; new7d: number; pro: number; trial: number }
  cards:   { total: number; catalogValue: number; registeredValue: number }
  topCards: { card_name: string; variante: string | null; preco_medio: number; owner_name: string; owner_username: string | null }[]
  topCollectors: { name: string; username: string | null; total_cartas: number }[]
}

type Serie = { d: string; v: number }[]
type Dashboard = {
  period: number
  headline: {
    faturamento: { valor: number; valorAnterior: number; trendPct: number; serie: Serie }
    novosUsuarios: { valor: number; valorAnterior: number; trendPct: number; serie: Serie }
    gmv: { valor: number; valorAnterior: number; trendPct: number; serie: Serie }
    ticketsPrecisandoResposta: number
  }
  alertas: {
    ticketsPrecisandoResposta: number
    contasAVencer: number
    lojasPendentes: number
    lojasConnectPendente: number
    cardRequestsPendentes: number
  }
  receitaDespesa6m: { mes: string; receita: number; despesa: number }[]
}

const fmtBRL = (n: number) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AdminDashboard() {
  const [m, setM] = useState<Metrics | null>(null)
  const [error, setError] = useState(false)
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [dashError, setDashError] = useState(false)
  const [period, setPeriod] = useState<7 | 30 | 90>(30)

  function load() {
    setError(false)
    fetch('/api/admin/metrics')
      .then(async r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(setM)
      .catch(() => setError(true))
  }

  function loadDash(p: number) {
    setDashError(false)
    fetch(`/api/admin/dashboard?period=${p}`)
      .then(async r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(setDash)
      .catch(() => setDashError(true))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { loadDash(period) }, [period])

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: '#f0f0f0' }}>
            Visão geral
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            Métricas atualizadas em tempo real.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 100, padding: 3 }}>
          {([7, 30, 90] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 13px', borderRadius: 100, border: 'none',
                background: period === p ? 'rgba(245,158,11,0.15)' : 'transparent',
                color: period === p ? '#f59e0b' : 'rgba(255,255,255,0.4)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {dashError ? (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444',
          padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span>Erro ao carregar o cockpit.</span>
          <button onClick={() => loadDash(period)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', fontWeight: 700, fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>Tentar de novo</button>
        </div>
      ) : (
        <>
          {/* ── Headline: 4 metricas com tendencia ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
            <HeadlineCard label="Faturamento do período" value={dash ? fmtBRL(dash.headline.faturamento.valor) : undefined} trendPct={dash?.headline.faturamento.trendPct} serie={dash?.headline.faturamento.serie} color="#22c55e" fmt={fmtBRL} />
            <HeadlineCard label={`Novos usuários (${period}d)`} value={dash?.headline.novosUsuarios.valor} trendPct={dash?.headline.novosUsuarios.trendPct} serie={dash?.headline.novosUsuarios.serie} color="#f59e0b" fmt={fmtNum} />
            <HeadlineCard label="GMV marketplace" value={dash ? fmtBRL(dash.headline.gmv.valor) : undefined} trendPct={dash?.headline.gmv.trendPct} serie={dash?.headline.gmv.serie} color="#60a5fa" fmt={fmtBRL} />
            <HeadlineCard label="Tickets precisando resposta" value={dash?.headline.ticketsPrecisandoResposta} color="#ef4444" nota="agora — fila, não tendência" href="/admin/tickets" />
          </div>

          {/* ── Alertas ── */}
          <AlertBox alertas={dash?.alertas} />

          {/* ── Gráficos ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 8 }}>
            <ChartCard title={`Crescimento de usuários (${period}d)`}>
              <LineChart serie={dash?.headline.novosUsuarios.serie} color="#f59e0b" acumulado label="Usuários" fmt={fmtNum} />
            </ChartCard>
            <ChartCard title="Receita x Despesa (6 meses)">
              <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>● Receita</span>
                <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>● Despesa</span>
              </div>
              <ReceitaDespesaChart rows={dash?.receitaDespesa6m} />
            </ChartCard>
          </div>
        </>
      )}

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          color: '#ef4444',
          padding: '12px 16px',
          borderRadius: 10,
          fontSize: 13,
          marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span>Erro ao carregar métricas.</span>
          <button onClick={load} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', fontWeight: 700, fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>Tentar de novo</button>
        </div>
      )}

      {/* ── Tickets ── */}
      <SectionTitle>Tickets</SectionTitle>
      <Grid>
        <Card label="Abertos"       value={m?.tickets.open}        color="#f59e0b" href="/admin/tickets?status=open" />
        <Card label="Em andamento"  value={m?.tickets.in_progress} color="#60a5fa" href="/admin/tickets?status=in_progress" />
        <Card label="Resolvidos"    value={m?.tickets.resolved}    color="#22c55e" href="/admin/tickets?status=resolved" />
        <Card label="Novos (7d)"    value={m?.tickets.last7}       color="#a78bfa" />
      </Grid>

      {/* ── Usuários ── */}
      <SectionTitle>Usuários</SectionTitle>
      <Grid>
        <Card label="Total"         value={m?.users.total} color="#f0f0f0" />
        <Card label="Novos (7d)"    value={m?.users.new7d} color="#22c55e" />
        <Card label="Plano Pro"     value={m?.users.pro}   color="#f59e0b" />
        <Card label="Trial ativo"   value={m?.users.trial} color="#60a5fa" />
      </Grid>

      {/* ── Conteúdo ── */}
      <SectionTitle>Conteúdo</SectionTitle>
      <Grid>
        <Card label="Cartas cadastradas"           value={m?.cards.total?.toLocaleString('pt-BR')} color="#f59e0b" />
        <Card label="Valor das cartas cadastradas"  value={m ? fmtBRL(m.cards.registeredValue) : undefined} color="#22c55e" />
        <Card label="Valor do catálogo"             value={m ? fmtBRL(m.cards.catalogValue) : undefined} color="#60a5fa" />
      </Grid>

      {/* Top 10 lado a lado no desktop, empilhado no mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, alignItems: 'start' }}>
        <div>
          <SectionTitle>Top 10 cartas mais valiosas (por dono)</SectionTitle>
          <RankList
            rows={m?.topCards?.map((c, i) => ({
              rank: i + 1,
              main: c.card_name + (c.variante && c.variante !== 'normal' ? ` · ${c.variante}` : ''),
              sub: c.owner_username ? `@${c.owner_username} · ${c.owner_name}` : c.owner_name,
              href: c.owner_username ? `/perfil/${c.owner_username}` : undefined,
              right: fmtBRL(c.preco_medio),
              rightColor: '#22c55e',
            }))}
          />
        </div>
        <div>
          <SectionTitle>Top 10 colecionadores (por nº de cartas)</SectionTitle>
          <RankList
            rows={m?.topCollectors?.map((c, i) => ({
              rank: i + 1,
              main: c.name,
              sub: c.username ? `@${c.username}` : '—',
              href: c.username ? `/perfil/${c.username}` : undefined,
              right: `${Number(c.total_cartas).toLocaleString('pt-BR')} cartas`,
              rightColor: '#f59e0b',
            }))}
          />
        </div>
      </div>

      <div style={{ marginTop: 32, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href="/admin/tickets" style={btnPrimary}>Gerenciar tickets</Link>
      </div>

    </div>
  )
}

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 11, fontWeight: 800,
      textTransform: 'uppercase', letterSpacing: '0.1em',
      color: 'rgba(255,255,255,0.4)',
      margin: '28px 0 12px', paddingLeft: 2,
    }}>{children}</h2>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 12,
    }}>
      {children}
    </div>
  )
}

function Card({ label, value, color, href }: { label: string; value: any; color: string; href?: string }) {
  const inner = (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '18px 20px',
      transition: 'border-color .15s, background .15s',
      cursor: href ? 'pointer' : 'default',
      height: '100%',
    }}
    onMouseEnter={href ? (e) => {
      e.currentTarget.style.borderColor = `${color}55`
      e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
    } : undefined}
    onMouseLeave={href ? (e) => {
      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
      e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
    } : undefined}
    >
      <p style={{
        fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.09em',
        color: 'rgba(255,255,255,0.4)',
        margin: '0 0 10px',
      }}>{label}</p>
      <p style={{
        fontSize: 28, fontWeight: 800,
        letterSpacing: '-0.03em',
        color,
        margin: 0, lineHeight: 1,
      }}>{value ?? '—'}</p>
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner
}

type RankRowData = { rank: number; main: string; sub: string; right: string; rightColor: string; href?: string }

function RankList({ rows }: { rows?: RankRowData[] }) {
  const wrap = (txt: string) => (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{txt}</div>
  )
  if (!rows) return wrap('Carregando…')
  if (rows.length === 0) return wrap('Sem dados ainda.')

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
      {rows.map((r, i) => {
        const inner = (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.35)', width: 22, flexShrink: 0 }}>{r.rank}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, color: '#f0f0f0', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.main}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>{r.sub}</p>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: r.rightColor, flexShrink: 0 }}>{r.right}</span>
          </div>
        )
        return r.href
          ? <Link key={i} href={r.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>
          : <div key={i}>{inner}</div>
      })}
    </div>
  )
}

// ─── Cockpit: headline, alertas, gráficos ────────────────────────────────────

// Converte um ponto de mouse (coordenadas de tela) pra coordenadas locais do
// viewBox do SVG -- funciona mesmo quando o SVG renderiza em tamanho diferente
// do viewBox (width:'100%' etc), o que offsetX/clientX sozinhos nao resolvem.
function svgPointFromEvent(e: React.MouseEvent<SVGSVGElement>) {
  const svg = e.currentTarget
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const loc = pt.matrixTransform(ctm.inverse())
  return { x: loc.x, y: loc.y }
}

const fmtDiaCurto = (d: string) => {
  const [, mm, dd] = d.split('-')
  return dd && mm ? `${dd}/${mm}` : d
}

const fmtNum = (v: number) => Math.round(v).toLocaleString('pt-BR')

// Tooltip generico em SVG puro (sem overlay HTML) -- se posiciona dentro do
// viewBox e vira de lado sozinho pra nao vazar pra fora nas bordas.
function ChartTooltip({ x, y, W, title, rows }: {
  x: number; y: number; W: number; title: string; rows: { label: string; color: string }[]
}) {
  const boxW = Math.max(96, ...rows.map(r => r.label.length * 5.6)) + 20
  const boxH = 22 + rows.length * 15
  const flip = x + 12 + boxW > W
  const boxX = flip ? x - 12 - boxW : x + 12
  const boxY = Math.max(2, y - boxH / 2)
  return (
    <g pointerEvents="none">
      <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={7} fill="#12141a" stroke="rgba(255,255,255,0.14)" />
      <text x={boxX + 10} y={boxY + 15} fill="rgba(255,255,255,0.5)" fontSize="9.5" fontWeight="700">{title}</text>
      {rows.map((r, i) => (
        <text key={i} x={boxX + 10} y={boxY + 15 + (i + 1) * 15} fill={r.color} fontSize="11" fontWeight="700">{r.label}</text>
      ))}
    </g>
  )
}

function HeadlineCard({ label, value, trendPct, serie, color, nota, href, fmt }: {
  label: string; value: string | number | undefined; trendPct?: number; serie?: Serie; color: string; nota?: string; href?: string
  fmt?: (v: number) => string
}) {
  const inner = (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: '16px 18px', position: 'relative', height: '100%',
      cursor: href ? 'pointer' : 'default',
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', margin: '0 0 8px' }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color, margin: '0 0 4px' }}>{value ?? '—'}</p>
      {trendPct !== undefined ? (
        <span style={{ fontSize: 11, fontWeight: 700, color: trendPct > 0 ? '#22c55e' : trendPct < 0 ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>
          {trendPct > 0 ? '↑' : trendPct < 0 ? '↓' : '·'} {Math.abs(trendPct)}% vs. período anterior
        </span>
      ) : nota ? (
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{nota}</span>
      ) : null}
      {serie && serie.length > 1 && <MiniSparkline serie={serie} color={color} fmt={fmt || fmtNum} />}
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link> : inner
}

function MiniSparkline({ serie, color, fmt }: { serie: Serie; color: string; fmt: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...serie.map(p => p.v))
  const W = 70, H = 24
  const stepX = serie.length > 1 ? W / (serie.length - 1) : 0
  const path = serie.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${H - (p.v / max) * H}`).join(' ')

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const { x } = svgPointFromEvent(e)
    const idx = stepX > 0 ? Math.round(x / stepX) : 0
    setHover(Math.min(serie.length - 1, Math.max(0, idx)))
  }

  return (
    <svg
      width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ position: 'absolute', right: 14, bottom: 14, opacity: hover !== null ? 0.9 : 0.5, overflow: 'visible', cursor: 'crosshair' }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <rect x={0} y={0} width={W} height={H} fill="transparent" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" />
      {hover !== null && (
        <>
          <circle cx={hover * stepX} cy={H - (serie[hover].v / max) * H} r={2.5} fill={color} stroke="#080a0f" strokeWidth={1} />
          <ChartTooltip
            x={hover * stepX} y={H - (serie[hover].v / max) * H} W={W}
            title={fmtDiaCurto(serie[hover].d)}
            rows={[{ label: fmt(serie[hover].v), color }]}
          />
        </>
      )}
    </svg>
  )
}

function AlertBox({ alertas }: { alertas?: Dashboard['alertas'] }) {
  if (!alertas) {
    return (
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px', marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
        Carregando…
      </div>
    )
  }
  const itens = [
    { n: alertas.ticketsPrecisandoResposta, txt: 'tickets aguardando sua resposta', href: '/admin/tickets' },
    { n: alertas.contasAVencer, txt: 'contas a vencer nos próximos 3 dias', href: '/admin/financeiro' },
    { n: alertas.lojasPendentes, txt: 'lojas aguardando aprovação', href: '/admin/lojas?status=pendente' },
    { n: alertas.lojasConnectPendente, txt: 'lojas com Connect pendente ou restrito', href: '/admin/lojas' },
    { n: alertas.cardRequestsPendentes, txt: 'pedidos de carta ainda sem resposta', href: '/admin/card-requests' },
  ].filter(i => i.n > 0)

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
      <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ef4444', margin: '0 0 12px' }}>
        <IconWarning size={13} color="#ef4444" />Precisa de atenção agora
      </p>
      {itens.length === 0 ? (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Tudo em dia.</p>
      ) : (
        itens.map((i, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)', fontSize: 13 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{i.n} {i.txt}</span>
            <Link href={i.href} style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>ver →</Link>
          </div>
        ))
      )}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px' }}>
      <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', margin: '0 0 14px' }}>{title}</h3>
      {children}
    </div>
  )
}

// Serie diaria de contagem -> linha acumulada (crescimento), ou linha direta
// (valor por dia) se acumulado=false.
function LineChart({ serie, color, acumulado, label, fmt }: {
  serie?: Serie; color: string; acumulado?: boolean; label: string; fmt: (v: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  if (!serie) return <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '40px 0', textAlign: 'center' }}>Carregando…</p>
  if (serie.every(p => p.v === 0)) return <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '40px 0', textAlign: 'center' }}>Sem dados no período.</p>

  const valores = acumulado
    ? serie.reduce((acc: number[], p) => { acc.push((acc[acc.length - 1] || 0) + p.v); return acc }, [])
    : serie.map(p => p.v)

  const W = 400, H = 160, padX = 10, padY = 16
  const innerW = W - padX * 2, innerH = H - padY * 2
  const max = Math.max(1, ...valores)
  const stepX = valores.length > 1 ? innerW / (valores.length - 1) : 0
  const path = valores.map((v, i) => `${i === 0 ? 'M' : 'L'} ${padX + i * stepX} ${padY + innerH - (v / max) * innerH}`).join(' ')

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const { x } = svgPointFromEvent(e)
    const idx = stepX > 0 ? Math.round((x - padX) / stepX) : 0
    setHover(Math.min(valores.length - 1, Math.max(0, idx)))
  }

  const hx = hover !== null ? padX + hover * stepX : 0
  const hy = hover !== null ? padY + innerH - (valores[hover] / max) * innerH : 0

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', cursor: 'crosshair' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <rect x={0} y={0} width={W} height={H} fill="transparent" />
      <line x1={padX} y1={padY + innerH} x2={W - padX} y2={padY + innerH} stroke="rgba(255,255,255,0.08)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      {hover !== null && (
        <>
          <line x1={hx} y1={padY} x2={hx} y2={padY + innerH} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
          <circle cx={hx} cy={hy} r={3.5} fill={color} stroke="#080a0f" strokeWidth={1.5} />
          <ChartTooltip x={hx} y={hy} W={W} title={fmtDiaCurto(serie[hover].d)} rows={[{ label: `${label}: ${fmt(valores[hover])}`, color }]} />
        </>
      )}
    </svg>
  )
}

function ReceitaDespesaChart({ rows }: { rows?: Dashboard['receitaDespesa6m'] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (!rows) return <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '40px 0', textAlign: 'center' }}>Carregando…</p>
  const max = Math.max(1, ...rows.map(r => Math.max(r.receita, r.despesa)))
  const W = 400, H = 140, padX = 30, padY = 16
  const innerW = W - padX * 2, innerH = H - padY * 2 - 16
  const stepX = rows.length > 1 ? innerW / (rows.length - 1) : 0
  const pathReceita = rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${padX + i * stepX} ${padY + innerH - (r.receita / max) * innerH}`).join(' ')
  const pathDespesa = rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${padX + i * stepX} ${padY + innerH - (r.despesa / max) * innerH}`).join(' ')
  const fmtMes = (m: string) => {
    const [, mm] = m.split('-')
    return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][Number(mm) - 1] || m
  }

  const total = rows.length

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const { x } = svgPointFromEvent(e)
    const idx = stepX > 0 ? Math.round((x - padX) / stepX) : 0
    setHover(Math.min(total - 1, Math.max(0, idx)))
  }

  const hx = hover !== null ? padX + hover * stepX : 0

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', cursor: 'crosshair' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <rect x={0} y={0} width={W} height={H} fill="transparent" />
      <line x1={padX} y1={padY + innerH} x2={W - padX} y2={padY + innerH} stroke="rgba(255,255,255,0.08)" />
      <path d={pathReceita} fill="none" stroke="#22c55e" strokeWidth="2" />
      <path d={pathDespesa} fill="none" stroke="#ef4444" strokeWidth="2" />
      {rows.map((r, i) => (
        <text key={i} x={padX + i * stepX} y={H - 4} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">{fmtMes(r.mes)}</text>
      ))}
      {hover !== null && (
        <>
          <line x1={hx} y1={padY} x2={hx} y2={padY + innerH} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
          <circle cx={hx} cy={padY + innerH - (rows[hover].receita / max) * innerH} r={3.5} fill="#22c55e" stroke="#080a0f" strokeWidth={1.5} />
          <circle cx={hx} cy={padY + innerH - (rows[hover].despesa / max) * innerH} r={3.5} fill="#ef4444" stroke="#080a0f" strokeWidth={1.5} />
          <ChartTooltip
            x={hx} y={padY + innerH - (Math.max(rows[hover].receita, rows[hover].despesa) / max) * innerH} W={W}
            title={fmtMes(rows[hover].mes)}
            rows={[
              { label: `Receita: ${fmtBRL(rows[hover].receita)}`, color: '#22c55e' },
              { label: `Despesa: ${fmtBRL(rows[hover].despesa)}`, color: '#ef4444' },
            ]}
          />
        </>
      )}
    </svg>
  )
}

const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
  color: '#000',
  padding: '10px 20px',
  borderRadius: 10,
  fontWeight: 800,
  textDecoration: 'none',
  fontSize: 13,
}