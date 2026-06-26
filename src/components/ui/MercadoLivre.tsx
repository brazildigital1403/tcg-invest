// Modulo de afiliado do Mercado Livre. Server component puro (sem 'use client'):
// renderiza um link de afiliado real (gerado no Linkbuilder oficial) com selo de
// divulgacao e rel="sponsored nofollow". Posicionamento: LACRADO + ACESSORIO
// (nao compete com o marketplace de singles da Bynx).
//
// variante="card"  -> rico, com tiles de categoria (usado no /set)
// variante="strip" -> faixa fina de acessorios (usado no /carta)

import type { CSSProperties, ReactNode } from 'react'
import MlGaleriaRail from './MlGaleriaRail'

const AMARELO = '#FFE600'
const ML_DARK = '#1a1a2e'

const REL = 'sponsored nofollow noopener noreferrer'

function CartIcon({ s = 13 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M3 4h2l2.2 11.2a1.5 1.5 0 001.5 1.2h8.6a1.5 1.5 0 001.5-1.2L21 7H6" stroke={ML_DARK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.5" cy="20" r="1.4" fill={ML_DARK} />
      <circle cx="18" cy="20" r="1.4" fill={ML_DARK} />
    </svg>
  )
}

const TILES: { label: string; icon: ReactNode }[] = [
  { label: 'Boxes & ETBs', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 8l8-4 8 4v8l-8 4-8-4V8z" stroke={AMARELO} strokeWidth="1.5" strokeLinejoin="round" /><path d="M4 8l8 4 8-4M12 12v8" stroke={AMARELO} strokeWidth="1.5" strokeLinejoin="round" /></svg>
  ) },
  { label: 'Sleeves', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="6" y="3" width="12" height="18" rx="1.5" stroke={AMARELO} strokeWidth="1.5" /><path d="M9 3v3h6V3" stroke={AMARELO} strokeWidth="1.5" /></svg>
  ) },
  { label: 'Fichários', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 4h13a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" stroke={AMARELO} strokeWidth="1.5" /><path d="M8 4v16M4 9h2M4 13h2" stroke={AMARELO} strokeWidth="1.5" /></svg>
  ) },
  { label: 'Blisters', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="12" rx="2" stroke={AMARELO} strokeWidth="1.5" /><path d="M9 6v12" stroke={AMARELO} strokeWidth="1.5" strokeDasharray="2 2" /></svg>
  ) },
]

type Produto = { titulo: string; preco: string; imagem: string; url: string }

type Props = {
  url: string
  variante: 'card' | 'strip'
  titulo?: string | null
  subtitulo?: string | null
  produtos?: Produto[]
}

export default function MercadoLivre({ url, variante, titulo, subtitulo, produtos }: Props) {
  if (!url) return null

  const ctaBase: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    background: AMARELO, color: ML_DARK, fontWeight: 800, fontSize: 13,
    borderRadius: 9, padding: '10px 16px', whiteSpace: 'nowrap', flexShrink: 0,
  }

  if (variante === 'strip') {
    const t = titulo || 'Proteja sua coleção'
    const s = subtitulo || 'Sleeves, toploaders e fichários no Mercado Livre'
    return (
      <div style={{ margin: '4px 0 28px' }}>
        <a
          href={url}
          target="_blank"
          rel={REL}
          style={{
            display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none',
            background: 'linear-gradient(90deg, rgba(255,230,0,0.06), rgba(255,230,0,0.02))',
            border: '1px solid rgba(255,230,0,0.22)', borderRadius: 12, padding: '14px 16px',
          }}
        >
          <span style={{ width: 38, height: 38, borderRadius: 9, background: AMARELO, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 8h16v11a1 1 0 01-1 1H5a1 1 0 01-1-1V8z" stroke={ML_DARK} strokeWidth="1.7" strokeLinejoin="round" /><path d="M8 8V6a4 4 0 018 0v2" stroke={ML_DARK} strokeWidth="1.7" /></svg>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#f5f5f5', marginBottom: 2 }}>{t}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{s}</span>
          </span>
          <span style={ctaBase}>Ver acessórios &rarr;</span>
        </a>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', margin: '6px 2px 0' }}>
          Publicidade
        </p>
      </div>
    )
  }

  // variante card
  const t = titulo || 'Garanta seus lacrados e acessórios'
  const s = subtitulo || 'Boxes, blisters e proteção pra sua coleção — os mais buscados, num clique.'

  // Galeria de produtos reais (foto + titulo + preco). Cada card linka pro produto
  // (v1: todos pro link da lista marcada; cookie de 30 dias atribui a compra).
  if (produtos && produtos.length > 0) {
    return (
      <div style={{ position: 'relative', overflow: 'hidden', background: '#0d0f14', border: '1px solid rgba(255,230,0,0.18)', borderRadius: 14, padding: 18, margin: '20px 0 28px' }}>
        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: AMARELO }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: ML_DARK, background: AMARELO, padding: '3px 9px', borderRadius: 100 }}>
            <CartIcon /> Mercado Livre
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Publicidade</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#f5f5f5', margin: '0 0 3px' }}>{t}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '0 0 14px' }}>{s}</div>

        <MlGaleriaRail produtos={produtos} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <a href={url} target="_blank" rel={REL} style={ctaBase}>Ver tudo no Mercado Livre &rarr;</a>
        </div>
      </div>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel={REL}
      style={{
        display: 'block', textDecoration: 'none', position: 'relative', overflow: 'hidden',
        background: '#0d0f14', border: '1px solid rgba(255,230,0,0.18)', borderRadius: 14,
        padding: 18, margin: '20px 0 28px',
      }}
    >
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: AMARELO }} />
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: ML_DARK, background: AMARELO, padding: '3px 9px', borderRadius: 100 }}>
          <CartIcon /> Mercado Livre
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Publicidade</span>
      </span>
      <span style={{ display: 'block', fontSize: 16, fontWeight: 800, color: '#f5f5f5', margin: '0 0 3px' }}>{t}</span>
      <span style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '0 0 14px' }}>{s}</span>

      <span style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {TILES.map((tile) => (
          <span key={tile.label} style={{ display: 'block', background: '#11141c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 8px', textAlign: 'center' }}>
            <span style={{ display: 'flex', justifyContent: 'center', marginBottom: 7 }}>{tile.icon}</span>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{tile.label}</span>
          </span>
        ))}
      </span>

      <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span style={ctaBase}>Ver no Mercado Livre &rarr;</span>
      </span>
    </a>
  )
}
