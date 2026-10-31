import Link from 'next/link'
import type { CSSProperties } from 'react'

/** Chamada para lojas no fim da rodada ("Quer fazer uma rodada como esta?"). */
export default function BlocoLojista() {
  return (
    <section aria-labelledby="bl-titulo" style={S.caixa}>
      <span style={S.rot}>Para lojas</span>
      <h2 id="bl-titulo" style={S.h2}>Quer fazer uma rodada como esta?</h2>
      <p style={S.p}>Você transmite, a Bynx cuida do lance e da cobrança.</p>
      <Link href="/para-lojistas" prefetch={false} className="bl-cta" style={S.cta}>
        Criar minha rodada
      </Link>
    </section>
  )
}

const S: Record<string, CSSProperties> = {
  caixa: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: 20, borderRadius: 18, marginTop: 8,
    border: '1px solid var(--bx-border)', background: 'radial-gradient(120% 90% at 0% 0%, rgba(var(--ac-1-rgb), 0.12), transparent 60%), var(--bx-bg-elev)',
  },
  rot: { fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bx-text-3)' },
  h2: { margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--bx-text)', lineHeight: 1.2 },
  p: { margin: 0, fontSize: 14, color: 'var(--bx-text-2)', lineHeight: 1.5 },
  cta: {
    marginTop: 10, minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 18px',
    borderRadius: 12, background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', fontSize: 14.5, fontWeight: 800, textDecoration: 'none',
  },
}
