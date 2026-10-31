import Link from 'next/link'
import { tituloRodada, type RodadaPublica } from '@/lib/leilao-rodada'
import { urlHome, urlRodada } from '@/lib/leilao-urls'
import { horaCurtaBrasilia } from '@/lib/leilao-vitrine'
import type { LojaDoLote, ResumoRodada } from '@/app/leiloes/_dados'
import BotaoAgenda from './BotaoAgenda'
import ComecaEm from './ComecaEm'
import LogoLoja from './LogoLoja'

/** Card lateral "Hoje": rodadas agendadas para hoje (Brasilia), com "começa em" e .ics. */
export default function CardHoje({
  rodadas,
  lojas,
  resumo,
  renderizadoEm,
}: {
  rodadas: RodadaPublica[]
  lojas: Map<string, LojaDoLote>
  resumo: Map<string, ResumoRodada>
  renderizadoEm: string
}) {
  return (
    <section className="vt-hoje" aria-labelledby="vt-hoje-t">
      <div className="vt-sec-t">
        <h2 id="vt-hoje-t">Hoje</h2>
        <Link href={urlHome('agenda')} prefetch={false} className="vt-mais">Ver a agenda</Link>
      </div>
      <ul className="vt-hoje-lista">
        {rodadas.map(r => {
          const loja = lojas.get(r.lojaId ?? '') ?? null
          const nome = loja ? loja.nome ?? loja.slug : tituloRodada(r)
          const n = resumo.get(r.id)?.n
          return (
            <li key={r.id} className="vt-hoje-it">
              <span className="vt-hora vt-num">{horaCurtaBrasilia(r.iniciaEm)}</span>
              <LogoLoja nome={nome} logoUrl={loja?.logoUrl ?? null} pequeno />
              <div className="vt-hoje-txt">
                <Link href={urlRodada(r.numero)} prefetch={false} className="vt-hoje-t">{nome}</Link>
                <span className="vt-hoje-s">
                  {n ? `${n === 1 ? '1 lote' : `${n} lotes`} · ` : ''}
                  <ComecaEm iniciaEm={r.iniciaEm} renderizadoEm={renderizadoEm} />
                </span>
                {r.iniciaEm && (
                  <BotaoAgenda
                    numero={r.numero}
                    titulo={`${nome}: rodada ao vivo no Bynx Leilões`}
                    iniciaEm={r.iniciaEm}
                    descricao={r.descricao}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
