import { IconLoja } from '@/components/ui/Icons'
import { Botao, IconeBloco, Rotulo } from '@/components/leilao/kit'

/** Chamada curta para lojas na vitrine. O detalhe fica em Como funciona. */
export default function ChamadaLojas() {
  return (
    <section className="vt-lojas-c">
      <IconeBloco tamanho="m"><IconLoja size={22} /></IconeBloco>
      <div>
        <Rotulo>Para lojas</Rotulo>
        <h2 className="lk-sub">Coloque suas cartas em leilão</h2>
      </div>
      <Botao tipo="sec" href="/para-lojistas">Quero vender</Botao>
    </section>
  )
}
