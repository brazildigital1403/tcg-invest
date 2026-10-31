import { IconCheck, IconClock, IconShield, IconTrendingUp } from '@/components/ui/Icons'

/**
 * Faixa de garantia. So afirmacao que o codigo sustenta:
 * - pagamento pelo checkout da Bynx, no cartao (rota /api/leiloes/[id]/checkout,
 *   pagina hospedada: a loja nao ve o cartao);
 * - selo so em loja com `lojas.verificada` e avaliacoes da RPC da casa;
 * - soft close do motor (`soft_close_seg`): lance no fim empurra o fim;
 * - referencia do Mercado Brasileiro no lance, so para carta sem graduacao.
 * Nada de "a loja so recebe depois da entrega": o repasse hoje e destination
 * charge, nao fica retido ate a entrega.
 */
const ITENS = [
  { Icone: IconShield, titulo: 'Compra protegida', texto: 'Você paga pela Bynx, no cartão. A loja não vê os dados do seu cartão.' },
  { Icone: IconCheck, titulo: 'Lojas verificadas', texto: 'Selo de verificação na loja e avaliações de quem já comprou.' },
  { Icone: IconClock, titulo: 'Lance justo', texto: 'Lance nos últimos segundos prorroga o lote. Ninguém leva no último segundo.' },
  { Icone: IconTrendingUp, titulo: 'Preço de referência', texto: 'Carta sem graduação mostra o menor preço do Mercado Brasileiro.' },
] as const

export default function FaixaGarantia() {
  return (
    <ul className="vt-garantia" aria-label="Por que comprar no Bynx Leilões">
      {ITENS.map(({ Icone, titulo, texto }) => (
        <li key={titulo}>
          <Icone size={20} strokeWidth={1.8} />
          <div>
            <b>{titulo}</b>
            <span>{texto}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
