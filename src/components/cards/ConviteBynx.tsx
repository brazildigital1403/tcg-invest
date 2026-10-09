import Link from 'next/link'
import { LIMITE_FREE } from '@/lib/checkCardLimit'

/**
 * O convite de cadastro da pagina publica da carta (Fase 2b do #490).
 *
 * UM convite so, depois de a pessoa ter lido tudo o que a pagina tinha a dizer
 * sobre a carta. Substitui dois que existiam: o PromoBanner (copy sorteada a
 * cada F5, com animacao) e o "Criar conta gratis" duplicado no rodape.
 *
 * Os numeros vem de `landing_stats` + contagem de usuarios, em cache global de
 * 1 h (ver page.tsx) -- nunca cravados: numero cravado na UI envelhece (a home
 * ja disse "70 mil cartas" com 54 mil no banco). O botao volta para a carta.
 */
export type StatsConvite = { cartas: number; colecionadores: number }

const fmtMil = (n: number) => `${Math.floor(n / 1000)} mil`
const fmtDezena = (n: number) => `${Math.floor(n / 10) * 10}+`

export default function ConviteBynx({ stats, next }: { stats: StatsConvite; next: string }) {
  return (
    <section
      aria-labelledby="convite-bynx"
      style={{
        margin: '8px 0 24px',
        padding: '22px 18px',
        borderRadius: 16,
        border: '1px solid rgba(var(--ac-1-rgb), 0.28)',
        background: 'var(--bx-hero-wash), var(--bx-surface)',
      }}
    >
      <h2 id="convite-bynx" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', margin: '0 0 8px', color: 'var(--bx-text)' }}>
        Sua coleção, em reais, no seu bolso.
      </h2>
      <p style={{ fontSize: 14, color: 'var(--bx-text-2)', lineHeight: 1.5, margin: '0 0 16px' }}>
        A Bynx guarda o que você tem, mostra quanto vale hoje e avisa quando o preço muda.
        Grátis até {LIMITE_FREE} cartas.
      </p>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, margin: '0 0 18px' }}>
        {/* dt antes de dd no HTML (semantica); o numero vem primeiro na tela via column-reverse. */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column-reverse' }}>
          <dt style={{ fontSize: 11.5, color: 'var(--bx-text-3)', marginTop: 2 }}>cartas catalogadas</dt>
          <dd style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--bx-text)' }}>{fmtMil(stats.cartas)}</dd>
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column-reverse' }}>
          <dt style={{ fontSize: 11.5, color: 'var(--bx-text-3)', marginTop: 2 }}>colecionadores</dt>
          <dd style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--bx-text)' }}>{fmtDezena(stats.colecionadores)}</dd>
        </div>
      </dl>
      <Link
        href={`/?auth=signup&next=${encodeURIComponent(next)}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 10,
          background: 'var(--bx-brand)', color: 'var(--bx-brand-ink)', fontWeight: 700, fontSize: 15,
          textDecoration: 'none', transition: 'transform 0.15s ease',
        }}
      >
        Criar conta grátis
      </Link>
    </section>
  )
}
