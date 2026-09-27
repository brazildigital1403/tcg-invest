import type { ReactNode } from 'react'
import LeilaoHeader from '@/components/leilao/casca/LeilaoHeader'
import LeilaoFooter from '@/components/leilao/casca/LeilaoFooter'
import { CSS_CASCA } from '@/components/leilao/casca/estilos'

/**
 * ★ EXCECAO APROVADA PELO DU EM 27/09/2026 a regra de UI da casa "nao usar
 * casca propria" (skill bynx-ui: tela de app/loja/compra envelopa em
 * AppLayout; casca so com logo faz o menu sumir).
 *
 * O Bynx Leiloes e uma FERRAMENTA com casca propria, no mesmo endereco
 * (bynx.gg/leiloes): cabecalho "logo | Leiloes" com selo AO VIVO e conta,
 * abas proprias na home, rodape enxuto, sem sidebar, sem bottom nav, sem sino
 * e sem patrimonio. A live e o centro da tela; o CTA de lance fica fixo no fim
 * da tela sem disputar espaco com a barra do app. Mesma marca, mesmos tokens
 * (--bx-* / --ac-*), mesma fonte; ambar->vermelho na ferramenta e roxo->rosa
 * (.bx-ctx-comprador) so no pagamento. Mockup aprovado:
 * leiloes-casca (27/09/2026).
 *
 * NAO "consertar" de volta para o AppLayout: a excecao e deliberada. Outra
 * area que quiser casca propria precisa de aprovacao propria do Du.
 *
 * Estrutura: cabecalho proprio, conteudo com o gutter padrao das paginas
 * publicas (.bx-gutter: 16px no celular, 24px no desktop) e rodape enxuto.
 * As paginas de /leiloes (e /leiloes/meus-lances) herdam esta casca.
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
