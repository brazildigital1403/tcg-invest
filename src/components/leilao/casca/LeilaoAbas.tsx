import AbasChips from '@/components/leilao/kit/AbasChips'
import { ABAS_LEILOES, urlHome, type AbaLeiloes } from '@/lib/leilao-urls'

/** Abas da home: links ?aba= (funcionam sem JS); o chip ativo fica sempre visivel. */
export default function LeilaoAbas({ ativa }: { ativa: AbaLeiloes }) {
  return (
    <div className="lc-abas">
      <AbasChips
        rotulo="Seções do Bynx Leilões"
        ativa={ativa}
        itens={ABAS_LEILOES.map(a => ({ chave: a.chave, rotulo: a.rotulo, href: urlHome(a.chave) }))}
      />
    </div>
  )
}
