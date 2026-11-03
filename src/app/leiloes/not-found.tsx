import { Acoes, Botao, Selo, TelaEstado } from '@/components/leilao/kit'
import { IconWarning } from '@/components/ui/Icons'
import { urlHome } from '@/lib/leilao-urls'

/** Lote ou rodada que nao existe, dentro da casca do Bynx Leiloes. */
export default function LeilaoNaoEncontrado() {
  return (
    <TelaEstado
      tom="neutro" icone={<IconWarning size={38} />} selo={<Selo tom="neutro">Lote indisponível</Selo>}
      titulo="Este lote saiu do ar."
      texto="Ele pode ter sido removido, ou o link está errado."
      acoes={
        <Acoes>
          <Botao cheio href={urlHome()}>Ver leilões abertos</Botao>
          <Botao tipo="sec" cheio href={urlHome('resultados')}>Ver resultados</Botao>
        </Acoes>
      }
    />
  )
}
