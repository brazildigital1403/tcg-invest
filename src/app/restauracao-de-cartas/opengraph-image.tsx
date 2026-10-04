import { imagemServico, OG_SIZE } from '@/components/servicos/ogServico'

export const alt = 'Restauração de cartas Pokémon na Bynx: conservação sem tinta, cola nem corte, com custódia filmada e relatório'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return imagemServico({
    linhas: ['Restauração', 'de cartas Pokémon,'],
    destaque: 'na bancada da Bynx',
    sub: 'Conservação sem tinta, cola nem corte, com relatório de chegada e saída',
    selos: ['Custódia filmada', 'Orçamento pelas fotos', 'Brasil todo'],
    url: 'bynx.gg/restauracao-de-cartas',
  })
}
