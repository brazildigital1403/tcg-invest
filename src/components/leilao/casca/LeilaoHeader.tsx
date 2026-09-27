import Link from 'next/link'
import { urlHome } from '@/lib/leilao-urls'
import SeloAoVivo from './SeloAoVivo'
import LeilaoConta from './LeilaoConta'

/**
 * Cabecalho do Bynx Leiloes (56px): logo | Leiloes, selo AO VIVO quando ha
 * rodada no ar, e a conta (Entrar ou avatar).
 *
 * O selo e ilha de cliente (consulta /api/leiloes/no-ar): o layout nao le o
 * banco, entao pagina estatica (ex. /leiloes/meus-lances) nao congela o selo
 * no build e a primeira pintura nao espera consulta nenhuma.
 */
export default function LeilaoHeader() {
  return (
    <header className="lc-topo">
      <div className="lc-topo-in bx-gutter">
        <Link href={urlHome()} prefetch={false} className="lc-marca" aria-label="Bynx Leilões, início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_BYNX.png" alt="Bynx" />
          <span className="lc-div" aria-hidden />
          <span className="lc-prod">Leilões</span>
        </Link>
        <span className="lc-sp" />
        <SeloAoVivo />
        <LeilaoConta />
      </div>
    </header>
  )
}
