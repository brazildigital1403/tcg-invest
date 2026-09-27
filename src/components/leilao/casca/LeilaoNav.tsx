'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ABAS_LEILOES, BASE_LEILOES, abaValida, urlHome } from '@/lib/leilao-urls'

/**
 * Nav do cabecalho no DESKTOP (>= 769px): as abas da home + "Para lojas". No
 * celular some e quem navega sao as abas da propria home (LeilaoAbas).
 *
 * Ilha de cliente porque o layout nao recebe searchParams: a aba ativa vem
 * da URL no aparelho. O cabecalho a envolve em <Suspense> (useSearchParams
 * sem Suspense derruba o prerender de pagina estatica, ex. meus-lances).
 * Fallback do Suspense = a mesma nav sem aba ativa.
 */
export function LeilaoNavLinks({ ativa }: { ativa: string | null }) {
  return (
    <nav aria-label="Bynx Leilões" className="lc-nav">
      {ABAS_LEILOES.map(a => (
        <Link
          key={a.chave}
          href={urlHome(a.chave)}
          prefetch={false}
          className="lc-nav-l"
          aria-current={a.chave === ativa ? 'page' : undefined}
        >
          {a.rotulo}
        </Link>
      ))}
      <Link href="/para-lojistas" prefetch={false} className="lc-nav-l">Para lojas</Link>
    </nav>
  )
}

export default function LeilaoNav() {
  const pathname = usePathname() || ''
  const params = useSearchParams()
  const ativa = pathname === BASE_LEILOES ? abaValida(params?.get('aba')) : null
  return <LeilaoNavLinks ativa={ativa} />
}
