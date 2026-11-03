import { IconPlus } from '@/components/ui/Icons'
import { PRAZO_PAGAMENTO_ARREMATE_HORAS, rotuloTaxaProtecao } from '@/lib/leilao-vitrine'
import { calcularArremate } from '@/lib/leilao-taxas'
import { DURACOES_LOTE } from '@/lib/leilao-painel'
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
  { titulo: 'Escolha a carta', texto: `A loja abre uma carta por vez, por ${DURACOES_LOTE[0]} a ${DURACOES_LOTE[DURACOES_LOTE.length - 1]} segundos. Dar lance é grátis e não pede cartão.` },
  { titulo: 'Dê seu lance', texto: 'Informe até quanto aceita pagar: a Bynx cobre os outros lances por você, só até esse limite. Se vencer, você se compromete a pagar.' },
  { titulo: `Pague em ${H} horas`, texto: 'No cartão, com taxa de proteção, custo do cartão e frete mostrados antes. Só paga quem vence.' },
] as const

export function ComoFunciona() {
  return (
    <section className="vt-sec" aria-labelledby="vt-como-t">
      <div className="vt-sec-t">
        <h2 id="vt-como-t">Como funciona</h2>
      </div>
      <ol className="vt-passos">
        {PASSOS.map((p, i) => (
          <li key={p.titulo} className="vt-passo">
            <span className="vt-passo-n" aria-hidden>{i + 1}</span>
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
    q: 'O que é leilão ao vivo?',
    r: 'A loja coloca cartas em disputa, uma por vez, no horário marcado. Ela pode transmitir em vídeo, mas o lance é dado na Bynx. Vale o relógio da tela, não o vídeo.',
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
    r: 'Pelo painel da loja na Bynx: em Leilões, você monta a rodada com os lotes e agenda o horário. A loja precisa estar com os recebimentos ativos e o endereço para devoluções cadastrado.',
  },
]

export function PerguntasFrequentes() {
  return (
    <section className="vt-sec" aria-labelledby="vt-faq-t">
      <div className="vt-sec-t">
        <h2 id="vt-faq-t">Perguntas frequentes</h2>
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
