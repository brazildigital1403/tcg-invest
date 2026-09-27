import type { ReactNode } from 'react'
import LeilaoHeader from '@/components/leilao/casca/LeilaoHeader'
import LeilaoFooter from '@/components/leilao/casca/LeilaoFooter'
import { CSS_CASCA } from '@/components/leilao/casca/estilos'

/**
 * Casca do Bynx Leiloes: cabecalho proprio, conteudo com o gutter padrao das
 * paginas publicas (.bx-gutter: 16px no celular, 24px no desktop) e rodape
 * enxuto. As paginas de /leiloes NAO usam o AppLayout.
 */
export default function LeiloesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lc-casca">
      <style>{CSS_CASCA}</style>
      <LeilaoHeader />
      <main className="lc-main bx-gutter">{children}</main>
      <LeilaoFooter />
    </div>
  )
}
