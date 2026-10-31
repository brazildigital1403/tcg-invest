import Image from 'next/image'
import Link from 'next/link'
import { tituloRodada, type RodadaPublica } from '@/lib/leilao-rodada'
import { urlHome, urlRodada } from '@/lib/leilao-urls'
import { horaCurtaBrasilia, type DiaDaSemana } from '@/lib/leilao-vitrine'
import type { LojaDoLote, ResumoRodada } from '@/app/leiloes/_dados'

const FMT_DIA_LONGO = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })

function rotuloAcessivel(dataISO: string): string {
  const [a, m, d] = dataISO.split('-').map(Number)
  return FMT_DIA_LONGO.format(new Date(Date.UTC(a, m - 1, d)))
}

/**
 * "Agenda da semana": 7 dias a partir de hoje (Brasilia), rodadas agendadas
 * e ao vivo, mosaico de ate 3 cartas dos lotes. Dia vazio = traco. Semana
 * vazia = quem chama nem renderiza.
 */
export default function AgendaSemana({
  dias,
  lojas,
  resumo,
}: {
  dias: DiaDaSemana<RodadaPublica>[]
  lojas: Map<string, LojaDoLote>
  resumo: Map<string, ResumoRodada>
}) {
  return (
    <section className="vt-sec" aria-labelledby="vt-semana-t" id="vt-semana">
      <div className="vt-sec-t">
        <h2 id="vt-semana-t">Agenda da semana</h2>
        <Link href={urlHome('agenda')} prefetch={false} className="vt-mais">Ver a agenda</Link>
      </div>
      <ol className="vt-semana" style={{ padding: 0 }}>
        {dias.map(d => (
          <li key={d.dataISO} className={d.hoje ? 'vt-dia vt-dia-hoje' : 'vt-dia'}>
            <div className="vt-dia-d" aria-hidden>
              {d.hoje ? 'HOJE' : d.rotulo}
              <b>{d.dia}</b>
            </div>
            <span className="vt-sr">{d.hoje ? `Hoje, ${rotuloAcessivel(d.dataISO)}` : rotuloAcessivel(d.dataISO)}</span>
            {d.itens.length === 0 ? (
              <>
                <span className="vt-dia-vazio" aria-hidden />
                <span className="vt-sr">Sem rodada</span>
              </>
            ) : (
              d.itens.map(r => {
                const loja = lojas.get(r.lojaId ?? '') ?? null
                const nome = loja ? loja.nome ?? loja.slug : tituloRodada(r)
                const res = resumo.get(r.id)
                const quando = r.status === 'ao_vivo' ? 'Ao vivo' : horaCurtaBrasilia(r.iniciaEm)
                return (
                  <Link key={r.id} href={urlRodada(r.numero)} prefetch={false} className="vt-rd">
                    {res && res.imagens.length > 0 && (
                      <span className="vt-mos" aria-hidden>
                        {res.imagens.map((src, i) => (
                          <Image key={src + i} src={src} alt="" width={30} height={42} sizes="30px" />
                        ))}
                      </span>
                    )}
                    <b>{quando} · {nome}</b>
                    {res && res.n > 0 && <span className="vt-rd-s">{res.n === 1 ? '1 lote' : `${res.n} lotes`}</span>}
                  </Link>
                )
              })
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
