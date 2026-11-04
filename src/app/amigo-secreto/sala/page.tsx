import type { Metadata } from 'next'
import SalaClient from './SalaClient'

// A sala do Amigo Secreto (04/11/2026): uma URL so, o cartao de missao troca
// de estado conforme a fase (inscricoes, sorteado, entregas, encerrado) e as
// folhas sobem de baixo. Tudo client-side, pelas funcoes amigo_secreto_* com
// a sessao do proprio usuario. Fora do AppLayout e sem indexacao.

export const metadata: Metadata = {
  title: 'Sala do Amigo Secreto',
  robots: { index: false, follow: false },
}

export default function SalaPage() {
  return <SalaClient />
}
