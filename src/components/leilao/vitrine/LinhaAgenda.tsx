import Image from 'next/image'
import Link from 'next/link'
import BotaoAgenda from '@/components/leilao/vitrine/BotaoAgenda'
import LogoLoja from '@/components/leilao/vitrine/LogoLoja'
import { tituloRodada, type RodadaPublica } from '@/lib/leilao-rodada'
import { urlRodada } from '@/lib/leilao-urls'
import { horaCurtaBrasilia } from '@/lib/leilao-vitrine'
import type { LojaDoLote, ResumoRodada } from '@/app/leiloes/_dados'

/** Rodada agendada com as cartas na tela: e o que faz a pessoa voltar no horario. */
export default function LinhaAgenda({
  rodada,
  loja,
  resumo,
}: {
  rodada: RodadaPublica
  loja: LojaDoLote | null
  resumo: ResumoRodada | null
}) {
  const nome = loja ? loja.nome ?? loja.slug : tituloRodada(rodada)
  const n = resumo?.n ?? 0
  return (
    <div className="vt-ag">
      <Link href={urlRodada(rodada.numero)} prefetch={false} className="vt-ag-l">
        <span className="vt-ag-h">
          <b>{horaCurtaBrasilia(rodada.iniciaEm)}</b>
        </span>
        <span className="vt-ag-c">
          <span className="vt-ag-loja">
            <LogoLoja nome={nome} logoUrl={loja?.logoUrl ?? null} />
            <span>
              <b>{nome}</b>
              <small>{n === 1 ? '1 lote' : `${n} lotes`}</small>
            </span>
          </span>
          {!!resumo?.imagens.length && (
            <span className="vt-ag-mos">
              {resumo.imagens.map(src => <Image key={src} src={src} alt="" width={128} height={179} sizes="48px" />)}
            </span>
          )}
        </span>
      </Link>
      {rodada.iniciaEm && (
        <BotaoAgenda numero={rodada.numero} titulo={`${nome}: rodada ao vivo`} iniciaEm={rodada.iniciaEm} variante="icone" />
      )}
    </div>
  )
}
