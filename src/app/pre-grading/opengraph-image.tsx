import { imagemServico, OG_SIZE } from '@/components/servicos/ogServico'

export const alt = 'Pré-grading de cartas Pokémon na Bynx: centralização medida, laudo e faixa de nota provável antes de graduar'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return imagemServico({
    linhas: ['Pré-grading:', 'descubra a nota'],
    destaque: 'antes de graduar',
    sub: 'Centralização medida, cantos, bordas e superfície, com laudo impresso',
    selos: ['Régua e lupa', 'Faixa provável', 'Brasil todo'],
    url: 'bynx.gg/pre-grading',
  })
}
