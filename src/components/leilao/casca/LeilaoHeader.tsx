import { Suspense } from 'react'
import Link from 'next/link'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { urlHome } from '@/lib/leilao-urls'
import { buscarRodadasAoVivo } from '@/app/leiloes/_dados'
import SeloAoVivo from './SeloAoVivo'
import LeilaoConta from './LeilaoConta'

/**
 * Cabecalho do Bynx Leiloes (56px): logo | Leiloes, selo AO VIVO quando ha
 * rodada no ar, e a conta (Entrar ou avatar).
 *
 * O selo e um componente de servidor em <Suspense>: a leitura "existe rodada
 * no ar?" nao segura a primeira pintura da pagina. E uma consulta por indice
 * parcial (idx_leilao_rodadas_ao_vivo), deduplicada com a home por cache().
 * Falhou: sem selo, a pagina segue (o selo e complementar).
 */
async function SeloNoAr() {
  if (!LEILAO_ATIVO) return null
  let numero: number | null = null
  try {
    numero = (await buscarRodadasAoVivo())[0]?.numero ?? null
  } catch (e) {
    console.error('[leiloes/casca] selo ao vivo:', (e as Error)?.message)
  }
  return numero ? <SeloAoVivo numero={numero} /> : null
}

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
        <Suspense fallback={null}>
          <SeloNoAr />
        </Suspense>
        <LeilaoConta />
      </div>
    </header>
  )
}
