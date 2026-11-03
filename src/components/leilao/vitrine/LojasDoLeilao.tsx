import Link from 'next/link'
import SeloVerificado from '@/components/ui/SeloVerificado'
import { rotuloAvaliacao, rotuloRodadas } from '@/lib/leilao-vitrine'
import type { LojaDoLeilao } from '@/app/leiloes/_dados'
import LogoLoja from './LogoLoja'

/** Abaixo disso, entra o card "Sua loja aqui". */
const MINIMO_SEM_CONVITE = 3

/**
 * "Lojas que fazem leilão": so dado real (n de rodadas e avaliacoes do
 * banco). Sem avaliacao = "Loja nova na Bynx". Lista vazia = quem chama nem
 * renderiza.
 */
export default function LojasDoLeilao({ lojas }: { lojas: LojaDoLeilao[] }) {
  return (
    <section className="vt-sec" aria-labelledby="vt-lojas-t">
      <div className="vt-sec-t">
        <h2 id="vt-lojas-t">Lojas que fazem leilão</h2>
      </div>
      <ul className="vt-lojas">
        {lojas.map(l => {
          const nome = l.nome ?? l.slug
          return (
            <li key={l.id}>
              <Link href={`/lojas/${encodeURIComponent(l.slug)}`} prefetch={false} className="vt-lojac">
                <LogoLoja nome={nome} logoUrl={l.logoUrl} />
                <span className="vt-lojac-nm">
                  {nome}
                  {l.verificada && (
                    <span className="vt-verif">
                      <SeloVerificado size={13} />
                      Verificada
                    </span>
                  )}
                </span>
                <span className="vt-lojac-st">
                  {rotuloRodadas(l.nRodadas)} · {rotuloAvaliacao(l.estrelas)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
