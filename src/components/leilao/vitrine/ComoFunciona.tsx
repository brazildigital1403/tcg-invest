import { IconPlus } from '@/components/ui/Icons'
import { PRAZO_PAGAMENTO_ARREMATE_HORAS, rotuloTaxaProtecao } from '@/lib/leilao-vitrine'

const H = PRAZO_PAGAMENTO_ARREMATE_HORAS

/**
 * "Como funciona" em 3 passos + perguntas frequentes em <details> (abre sem
 * JS). Prazo e taxa vem das libs (leilao-vitrine / leilao-taxas), nunca
 * digitados. Cada resposta so afirma o que o codigo faz hoje:
 * - lance rapido (chips) ou maximo, teto oculto (leilao_proxy), soft close;
 * - cadastro completo = CPF e CEP (raise cadastro_incompleto do dar_lance);
 * - aviso no sino e por e-mail ao vencer e no calote (leilao-avisos.ts);
 * - calote apos o prazo + carencia (tick), sem suspensao automatica.
 * "E se a carta nao chegar?" fica de fora ate o Du decidir a politica.
 */
const PASSOS = [
  { titulo: 'Entre na rodada', texto: 'Assista à live da loja e acompanhe cada lote na tela.' },
  { titulo: 'Dê seu lance', texto: 'Escolha um lance rápido ou defina um máximo, e a Bynx cobre os lances por você até ele.' },
  { titulo: 'Pague protegido', texto: `No cartão, pela Bynx, em até ${H} horas. A loja não vê os dados do seu cartão.` },
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

const PERGUNTAS: ReadonlyArray<{ q: string; r: string }> = [
  {
    q: 'Como eu dou lance?',
    r: 'Entre na rodada ao vivo com a sua conta Bynx, com CPF e CEP no cadastro. Escolha um lance rápido ou defina o máximo que aceita pagar: a Bynx cobre os lances por você até esse valor e ninguém vê o seu máximo. Lance nos últimos segundos prorroga o fim do lote.',
  },
  {
    q: 'É seguro comprar em leilão?',
    r: `O pagamento é feito pela Bynx, no cartão, e a loja não vê os dados do seu cartão. Cada lote mostra a loja, com selo quando ela é verificada. Antes de pagar, você confere a taxa de proteção de ${rotuloTaxaProtecao()} e o frete.`,
  },
  {
    q: 'Como eu pago o que arrematei?',
    r: `Quem vence o lote recebe o aviso no sino e por e-mail e tem ${H} horas para pagar no cartão, pela Bynx. O arremate fica em Meus lances, em Arremates a pagar.`,
  },
  {
    q: 'O que acontece se eu não pagar?',
    r: `Sem o pagamento em até ${H} horas, o arremate é cancelado. Você e a loja recebem o aviso por e-mail.`,
  },
  {
    q: 'Como minha loja faz um leilão?',
    r: 'Pelo painel da loja na Bynx: você monta a rodada com os lotes, agenda o horário e coloca o link da transmissão. Quem arremata paga pela Bynx, no cartão. O passo a passo está em Para lojistas.',
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
