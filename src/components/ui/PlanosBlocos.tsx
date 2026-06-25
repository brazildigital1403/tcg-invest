'use client'

import React from 'react'

export type PlanoTier = 'free' | 'plus' | 'pro' | 'pro_anual'

interface Props {
  onSelectPlan?: (tier: PlanoTier) => void
  loggedIn?: boolean
}

const C = {
  surf: '#0e1117', amber: '#f59e0b', red: '#ef4444',
  muted: 'rgba(255,255,255,0.45)', faint: 'rgba(255,255,255,0.28)',
  line: 'rgba(255,255,255,0.08)', txt: 'rgba(255,255,255,0.78)',
}

function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M3 8.5l3.5 3.5L13 5" stroke={C.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function Cross() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M5 5l6 6M11 5l-6 6" stroke="rgba(255,255,255,.3)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

type Feat = { t: React.ReactNode; ok?: boolean; pre?: boolean }
type Tier = {
  key: PlanoTier; nome: string; feat?: boolean; ribbon?: string; save?: string
  num: string; cents?: string; per?: string; note: string
  feats: Feat[]; cta: string; btn: 'ghost' | 'soft' | 'fill'
}

const TIERS: Tier[] = [
  {
    key: 'free', nome: 'Grátis', num: 'Grátis', note: 'para sempre',
    feats: [
      { t: <>Até <b>100 cartas</b></>, ok: true },
      { t: 'Perfil público', ok: true },
      { t: '3 anúncios no Marketplace', ok: true },
      { t: 'Pokédex básica · 1 pasta', ok: true },
      { t: 'Dashboard, Scan IA e Exportar', ok: false },
    ],
    cta: 'Começar grátis', btn: 'ghost',
  },
  {
    key: 'plus', nome: 'Plus', num: '14', cents: ',90', per: '/mês',
    note: 'para quem está crescendo a coleção',
    feats: [
      { t: 'Tudo do Grátis, e mais:', pre: true },
      { t: <>Até <b>500 cartas</b></>, ok: true },
      { t: 'Dashboard financeiro', ok: true },
      { t: 'Pokédex completa', ok: true },
      { t: 'Marketplace e pastas ilimitados', ok: true },
    ],
    cta: 'Assinar Plus', btn: 'soft',
  },
  {
    key: 'pro', nome: 'Pro', feat: true, ribbon: 'Mais popular',
    num: '29', cents: ',90', per: '/mês',
    note: 'o kit completo do colecionador-investidor',
    feats: [
      { t: 'Tudo do Plus, e mais:', pre: true },
      { t: <><b>Cartas ilimitadas</b></>, ok: true },
      { t: 'Scan com IA · 10 créditos/mês', ok: true },
      { t: 'Exportar CSV/PDF · Histórico de preços', ok: true },
      { t: 'Separadores liberados', ok: true },
    ],
    cta: 'Assinar Pro', btn: 'fill',
  },
  {
    key: 'pro_anual', nome: 'Pro Anual', save: 'Economize 30%',
    num: '249', per: '/ano', note: '≈ 20,75/mês · ~3 meses grátis',
    feats: [
      { t: 'Tudo do Pro, e mais:', pre: true },
      { t: <><b>Master Sets liberados</b></>, ok: true },
      { t: <>Scan com IA · <b>50 créditos/mês</b></>, ok: true },
      { t: 'Preço travado o ano todo', ok: true },
    ],
    cta: 'Assinar Anual', btn: 'soft',
  },
]

function btnStyle(kind: 'ghost' | 'soft' | 'fill'): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'center', padding: '12px',
    borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer',
    border: '1px solid transparent', fontFamily: 'inherit',
  }
  if (kind === 'ghost') return { ...base, background: 'rgba(255,255,255,0.05)', borderColor: C.line, color: 'rgba(255,255,255,0.7)' }
  if (kind === 'soft') return { ...base, background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)', color: C.amber }
  return { ...base, background: `linear-gradient(90deg,${C.amber},${C.red})`, color: '#1a1205' }
}

export function CardsPlanos({ onSelectPlan, loggedIn }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(232px, 1fr))', gap: 14, textAlign: 'left' }}>
      {TIERS.map(t => {
        const ctaLabel = loggedIn && t.key === 'free' ? 'Voltar à coleção' : t.cta
        return (
          <div key={t.key} style={{
            position: 'relative', background: t.feat ? `linear-gradient(180deg,rgba(245,158,11,.07),rgba(14,17,23,.6))` : C.surf,
            border: `1px solid ${t.feat ? 'rgba(245,158,11,.5)' : C.line}`, borderRadius: 18,
            padding: '24px 20px 22px', display: 'flex', flexDirection: 'column',
            boxShadow: t.feat ? '0 0 0 1px rgba(245,158,11,.25),0 18px 50px -20px rgba(245,158,11,.35)' : 'none',
          }}>
            {t.ribbon && (
              <div style={{
                position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                background: `linear-gradient(90deg,${C.amber},${C.red})`, color: '#1a1205',
                fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
                padding: '5px 12px', borderRadius: 100, whiteSpace: 'nowrap',
              }}>{t.ribbon}</div>
            )}
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: t.feat ? C.amber : C.muted, marginBottom: 12 }}>{t.nome}</div>
            {t.save && (
              <span style={{ display: 'inline-block', alignSelf: 'flex-start', fontSize: 10.5, fontWeight: 800, color: '#34d399', background: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.25)', padding: '2px 8px', borderRadius: 100, marginBottom: 6 }}>{t.save}</span>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
              <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1 }}>{t.num}</span>
              {t.cents && <span style={{ fontSize: 18, fontWeight: 800 }}>{t.cents}</span>}
              {t.per && <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>{t.per}</span>}
            </div>
            <div style={{ fontSize: 11, color: C.faint, minHeight: 15, marginBottom: 18 }}>{t.note}</div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9, flex: 1, marginBottom: 20, padding: 0, margin: '0 0 20px' }}>
              {t.feats.map((f, i) => f.pre ? (
                <li key={i} style={{ color: C.muted, fontSize: 12, fontWeight: 600 }}>{f.t}</li>
              ) : (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, lineHeight: 1.35, color: f.ok ? C.txt : C.faint }}>
                  {f.ok ? <Check /> : <Cross />}<span>{f.t}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => onSelectPlan?.(t.key)} style={btnStyle(t.btn)}>{ctaLabel}</button>
          </div>
        )
      })}
    </div>
  )
}

type Row = { label: string; vals: [React.ReactNode, React.ReactNode, React.ReactNode, React.ReactNode] }
const yes = <span style={{ color: '#34d399', fontWeight: 700 }}>✓</span>
const no = <span style={{ color: C.faint }}>—</span>
const val = (x: React.ReactNode) => <span style={{ fontWeight: 700 }}>{x}</span>

const ROWS: Row[] = [
  { label: 'Cartas na coleção', vals: [val('100'), val('500'), val('Ilimitadas'), val('Ilimitadas')] },
  { label: 'Pastas', vals: [val('1'), yes, yes, yes] },
  { label: 'Marketplace', vals: [val('3 anúncios'), yes, yes, yes] },
  { label: 'Perfil público', vals: [yes, yes, yes, yes] },
  { label: 'Dashboard financeiro', vals: [no, yes, yes, yes] },
  { label: 'Pokédex', vals: ['básica', val('completa'), val('completa'), val('completa')] },
  { label: 'Exportar CSV/PDF', vals: [no, no, yes, yes] },
  { label: 'Histórico de preços', vals: [no, no, yes, yes] },
  { label: 'Scan com IA', vals: [no, no, val('10/mês'), val('50/mês')] },
  { label: 'Separadores de Fichário', vals: ['avulso', 'avulso', val('liberado'), val('liberado')] },
  { label: 'Master Sets', vals: ['avulso', 'avulso', 'avulso', val('todos liberados')] },
]
const COLS: { key: PlanoTier; nome: string; preco: string; btn: 'ghost' | 'soft' | 'fill'; cta: string }[] = [
  { key: 'free', nome: 'Grátis', preco: 'Grátis', btn: 'ghost', cta: 'Começar' },
  { key: 'plus', nome: 'Plus', preco: '14,90/mês', btn: 'soft', cta: 'Plus' },
  { key: 'pro', nome: 'Pro', preco: '29,90/mês', btn: 'fill', cta: 'Pro' },
  { key: 'pro_anual', nome: 'Anual', preco: '249/ano', btn: 'soft', cta: 'Anual' },
]

export function TabelaPlanos({ onSelectPlan }: Props) {
  const featCol = 2 // Pro
  const cell: React.CSSProperties = { padding: '13px 14px', textAlign: 'center', fontSize: 13, borderBottom: `1px solid ${C.line}` }
  const featBg = 'rgba(245,158,11,.06)'
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', background: C.surf, border: `1px solid ${C.line}`, borderRadius: 18, overflow: 'hidden' }}>
        <thead>
          <tr>
            <th style={{ ...cell, background: '#11151c' }}></th>
            {COLS.map((c, i) => (
              <th key={c.key} style={{ ...cell, background: i === featCol ? featBg : '#11151c' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: i === featCol ? C.amber : '#fff' }}>{c.nome}</div>
                <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginTop: 2 }}>{c.preco}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r, ri) => (
            <tr key={ri}>
              <td style={{ ...cell, textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 12.5 }}>{r.label}</td>
              {r.vals.map((v, ci) => (
                <td key={ci} style={{ ...cell, background: ci === featCol ? featBg : 'transparent' }}>{v}</td>
              ))}
            </tr>
          ))}
          <tr>
            <td style={{ ...cell, borderBottom: 'none' }}></td>
            {COLS.map((c, i) => (
              <td key={c.key} style={{ ...cell, borderBottom: 'none', background: i === featCol ? featBg : 'transparent' }}>
                <button onClick={() => onSelectPlan?.(c.key)} style={{ ...btnStyle(c.btn), fontSize: 12, padding: '9px' }}>{c.cta}</button>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
