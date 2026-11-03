import { IconClock, IconLoja, IconPlus, IconShield, IconTruck } from '@/components/ui/Icons'
import { IconeBloco, Rotulo } from '@/components/leilao/kit'
import { PRAZO_PAGAMENTO_ARREMATE_HORAS, rotuloTaxaProtecao } from '@/lib/leilao-vitrine'
import { calcularArremate } from '@/lib/leilao-taxas'
import { formatarBRL } from '@/lib/leilao'

const H = PRAZO_PAGAMENTO_ARREMATE_HORAS

/**
 * "Como funciona" em 3 passos + perguntas frequentes em <details> (abre sem
 * JS). Prazo e taxa vem das libs (leilao-vitrine / leilao-taxas), nunca
 * digitados. Cada resposta so afirma o que o codigo faz hoje:
 * - lance rapido (chips) ou maximo, teto oculto (leilao_proxy), soft close;
 * - cadastro completo = CPF e CEP (raise cadastro_incompleto do dar_lance);
 * - so maiores de 18 (raise menor_de_idade do dar_lance, 20260928160000);
 * - aviso no sino e por e-mail ao vencer e no calote (leilao-avisos.ts);
 * - calote apos o prazo + carencia (tick), sem suspensao automatica.
 * Textos revistos no estudo de 03/11 contra /termos, secao 5.4.
 */
const PASSOS = [
  { titulo: 'Escolha a carta', texto: 'Veja a foto, quem vende e o Mercado Brasileiro.' },
  { titulo: 'Defina seu máximo', texto: 'A Bynx cobre os lances por você, até esse valor.' },
  { titulo: 'Pague se vencer', texto: `No cartão, em ${H} horas, com o total antes.` },
] as const

export function ComoFunciona() {
  return (
    <section aria-label="Passo a passo">
      <ol className="vt-passos">
        {PASSOS.map((p, i) => (
          <li key={p.titulo} className="vt-passo">
            <span className="vt-passo-n" aria-hidden>{`0${i + 1}`}</span>
            <div>
              <b>{p.titulo}</b>
              <span>{p.texto}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

const exemplo100 = calcularArremate(10_000)
const exemplo10 = calcularArremate(1_000)

const PERGUNTAS: ReadonlyArray<{ q: string; r: string }> = [
  {
    q: 'Como funciona o leilão?',
    r: 'A loja publica a carta com um prazo de 1 a 7 dias. Você acompanha os lances e pode cobrir até o fim. Lance nos últimos 2 minutos estende o fim em 2 minutos. Quem tiver o maior lance leva. A loja também pode fazer uma rodada ao vivo, com lotes curtos.',
  },
  {
    q: 'Dar lance custa alguma coisa?',
    r: 'Não. O lance não pede cartão e não reserva valor. Só paga quem vence.',
  },
  {
    q: 'Quem pode dar lance?',
    r: 'Quem tem 18 anos ou mais, com CPF e CEP no cadastro.',
  },
  {
    q: 'Posso cancelar um lance?',
    r: 'Não. O lance é compromisso de compra: quem tiver o maior lance no fim precisa pagar.',
  },
  {
    q: 'Quanto pago no total?',
    r: `Lance vencedor, taxa de proteção de ${rotuloTaxaProtecao()}, custo do cartão e frete. Em R$ 100,00, o total é ${formatarBRL(exemplo100.compradorPagaCents)} mais frete. Em R$ 10,00, é ${formatarBRL(exemplo10.compradorPagaCents)} mais frete. Cada carta é paga em separado.`,
  },
  {
    q: 'E se eu não pagar?',
    r: `Depois de ${H} horas, o arremate é cancelado e a loja é avisada. A Bynx pode restringir novos lances de quem deixa de pagar.`,
  },
  {
    q: 'E se a carta não chegar ou vier errada?',
    r: 'Abra uma ocorrência em Precisa de ajuda?, na tela do pedido, até 7 dias depois da entrega. Com a carta em mãos, envie fotos da frente, do verso e da embalagem. A loja tem 2 dias úteis para responder; sem resposta, o estorno sai sozinho. Se ela contestar, a Bynx decide em até 2 dias úteis.',
  },
  {
    q: 'Posso desistir depois de pagar?',
    r: 'Sim, até 7 dias depois de receber, sem justificativa. Antes do envio, o estorno é integral. Depois, a Bynx gera um código de postagem sem custo, e você tem 7 dias para postar. O estorno pode levar de 5 a 10 dias úteis na fatura.',
  },
  {
    q: 'Quem vende a carta?',
    r: 'A loja, que responde pela descrição, autenticidade, estado e envio. A Bynx oferece a ferramenta, processa o pagamento e media as ocorrências.',
  },
  {
    q: 'Como minha loja faz um leilão?',
    r: 'Pelo painel da loja na Bynx: em Leilões, você publica a carta e escolhe 1, 3, 5 ou 7 dias. A loja precisa estar com os recebimentos ativos e o endereço para devoluções cadastrado.',
  },
]

/** Garantias sem paragrafo: o detalhe de cada uma esta nas perguntas. */
export function BlocoProtecao() {
  return (
    <section className="vt-prot" aria-labelledby="vt-prot-t">
      <IconeBloco><IconShield size={38} /></IconeBloco>
      <div className="vt-prot-c">
        <Rotulo>Proteção Bynx</Rotulo>
        <h2 id="vt-prot-t" className="lk-sub">Você disputa a carta. A Proteção Bynx cobre o caminho.</h2>
        <ul>
          <li><IconClock size={16} />7 dias para abrir uma ocorrência</li>
          <li><IconTruck size={16} />Devolução sem custo de postagem</li>
          <li><IconLoja size={16} />Quem vende aparece</li>
        </ul>
      </div>
    </section>
  )
}

export function PerguntasFrequentes() {
  return (
    <section className="vt-sec" aria-labelledby="vt-faq-t">
      <div className="vt-sec-t">
        <h2 id="vt-faq-t" className="lk-sub">Ainda em dúvida?</h2>
      </div>
      <div className="vt-faq">
        {PERGUNTAS.map(p => (
          <details key={p.q}>
            <summary>
              {p.q}
              <IconPlus size={16} />
            </summary>
            <p>{p.r}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
