import Link from 'next/link'
import { ABAS_LEILOES, urlHome, type AbaLeiloes } from '@/lib/leilao-urls'

/** Abas da home: links ?aba= (funcionam sem JS e podem ser compartilhados). */
export default function LeilaoAbas({ ativa }: { ativa: AbaLeiloes }) {
  return (
    <nav aria-label="Seções do Bynx Leilões" className="lc-abas">
      {ABAS_LEILOES.map(a => (
        <Link
          key={a.chave}
          href={urlHome(a.chave)}
          prefetch={false}
          className="lc-aba"
          aria-current={a.chave === ativa ? 'page' : undefined}
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  )
}
