import { CSSProperties } from 'react'
import Link from 'next/link'

/**
 * Footer público reusável. Espelha exatamente o footer da landing,
 * mas com "Fale conosco" linkando para /suporte (em vez do modal da landing).
 */
export default function PublicFooter() {
  return (
    <footer style={S.footer}>
      <div style={S.links}>
        <Link href="/suporte" style={S.link}>Fale conosco</Link>
        <span style={S.sep}>·</span>
        <Link href="/privacidade" style={S.link}>Privacidade</Link>
        <span style={S.sep}>·</span>
        <Link href="/termos" style={S.link}>Termos de uso</Link>
      </div>
      <p style={S.copy}>
        © 2026 <strong style={S.brand}>Bynx</strong> · Feito para colecionadores brasileiros de Pokémon TCG
      </p>
    </footer>
  )
}

// ─── Estilos (espelham o footer da landing) ───────────────────────────────────

const S: Record<string, CSSProperties> = {
  footer: {
    borderTop: '1px solid rgba(255,255,255,0.06)',
    padding: '40px 24px',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  link: {
    color: 'rgba(255,255,255,0.35)',
    textDecoration: 'none',
    fontSize: 13,
  },
  sep: {
    color: 'rgba(255,255,255,0.15)',
  },
  copy: {
    margin: 0,
  },
  brand: {
    color: 'rgba(255,255,255,0.45)',
  },
}