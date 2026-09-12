import type { CSSProperties } from 'react'
import { IconShield, IconCard } from '@/components/ui/Icons'
import BandeirasCartao from '@/components/ui/BandeirasCartao'

/**
 * Selos de confianca do pagamento + bandeiras aceitas.
 *
 * ★ POR QUE COMPONENTE E NAO UMA QUARTA COPIA (12/09/2026). Estes selos
 * existiam em TRES telas -- /carrinho, /checkout e a landing /para-lojistas --
 * cada uma com o seu proprio bloco de estilo. E faltavam justamente nas tres
 * paginas publicas onde o comprador DECIDE: vitrine da loja, /produto e
 * /anuncio. O Du apontou a ausencia; escrever a quarta copia era garantir que
 * um dia elas divergissem, que e o padrao que mais deu bug nesta operacao
 * (ver o selo de verificada, que tinha TRES desenhos diferentes).
 *
 * ★ O QUE ELE AFIRMA E VERDADE, conferido:
 *  - "Pagamento pela Stripe": o checkout cria a sessao na Stripe e o Connect
 *    faz o split (ver lib/comissao.ts e o webhook).
 *  - "cartao nao fica na Bynx": o repo nao tem campo de cartao em lugar nenhum;
 *    os dados vao direto pro Stripe Checkout, hospedado por eles.
 *  - LGPD: a Politica declara os subprocessadores na secao 4.
 *
 * `compacto` tira o selo de LGPD e reduz a escala -- serve pra bloco lateral
 * estreito, onde quatro selos quebram em duas linhas e viram ruido.
 */
export default function SelosPagamento({
  compacto = false,
  centralizado = false,
  style,
}: {
  compacto?: boolean
  centralizado?: boolean
  style?: CSSProperties
}) {
  const fonte = compacto ? 11 : 11.5
  const icone = compacto ? 13 : 16

  return (
    <div style={{ ...S.raiz, ...(centralizado ? S.centro : null), ...style }}>
      <div style={{ ...S.selos, ...(centralizado ? S.centro : null) }}>
        <span style={{ ...S.selo, fontSize: fonte }}>
          <IconShield size={icone} color="var(--bx-green)" />
          <b style={S.forte}>Conexão segura</b>{!compacto && ' SSL'}
        </span>
        <span style={{ ...S.selo, fontSize: fonte }}>
          <IconShield size={icone} color="var(--bx-green)" />
          Processado por <span style={S.stripe}>stripe</span>
        </span>
        <span style={{ ...S.selo, fontSize: fonte }}>
          <IconCard size={icone} color="var(--bx-green)" />
          {compacto ? <>Cartão não fica na Bynx</> : <>Não guardamos seu <b style={S.forte}>cartão</b></>}
        </span>
        {!compacto && (
          <span style={{ ...S.selo, fontSize: fonte }}>
            <IconShield size={icone} color="var(--bx-green)" />
            Dados protegidos <b style={S.forte}>LGPD</b>
          </span>
        )}
      </div>
      <div style={{ ...S.bandeiras, ...(centralizado ? S.centro : null) }}>
        <BandeirasCartao />
      </div>
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  raiz: { display: 'flex', flexDirection: 'column', gap: 9 },
  centro: { justifyContent: 'center', alignItems: 'center', textAlign: 'center' },
  selos: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '7px 16px' },
  // `--bx-green` e cor SEMANTICA (seguranca), nao acento de marca: ela NAO deve
  // herdar o contexto de jogo nem o roxo do comprador.
  selo: { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--bx-text-2)', lineHeight: 1.4 },
  forte: { color: 'var(--bx-text)', fontWeight: 500 },
  stripe: { fontWeight: 800, letterSpacing: '-0.02em', color: '#8b85ff' },
  bandeiras: { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
}
