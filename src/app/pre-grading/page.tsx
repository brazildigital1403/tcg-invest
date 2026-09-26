import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import StickyCta from '@/components/servicos/StickyCta'
import {
  JsonLd, Faixa, Cabecalho, Garantias, Custodia, ComoFunciona, Precos, QuemFaz, FaqServico, CtaFinal, agendarHref,
} from '@/components/servicos/Secoes'
import { SV_CSS } from '@/components/servicos/css'
import { IconTarget, IconCheck, IconArrowRight } from '@/components/ui/Icons'
import { MockupLaudo } from '@/components/servicos/Mockups'
import {
  SERVICOS_PUBLICADO, FAQ_PRE_GRADING, LAUDO_ITENS, GRADUADORAS, PRECOS, brl, jsonLdServico,
} from '@/lib/servicos'

// Landing do pre-grading (fase 1). Mesmo esqueleto da restauracao, com o laudo
// no lugar do slider e o argumento em reais ("quanto a nota muda o preco").

const title = 'Pré-grading de cartas Pokémon: nota provável e laudo'
const description = 'Antes de pagar a graduação, saiba a nota provável: centralização medida, mapa de imperfeições e a graduadora certa (PSA, TAG, CGC, BGS ou GBA).'
const url = 'https://bynx.gg/pre-grading'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  robots: SERVICOS_PUBLICADO ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: { title: `${title} | Bynx`, description, url, siteName: 'Bynx', locale: 'pt_BR', type: 'website' },
  twitter: { card: 'summary_large_image', title: `${title} | Bynx`, description },
}

// Exemplo de "quanto a nota muda o preco". Valores fixos com data, sem consulta
// na landing. null ate o Du escolher a carta de referencia.
const EXEMPLO_NOTA: { carta: string; data: string; raw: number; nota9: number; nota10: number } | null = null

export default function PreGradingPage() {
  return (
    <div className="sv-root">
      <style>{SV_CSS}</style>
      <JsonLd data={jsonLdServico({
        path: '/pre-grading',
        nome: 'Pré-grading de cartas Pokémon',
        descricao: description,
        tipo: 'Avaliação de cartas antes da graduação',
        preco: PRECOS?.preGrading ?? null,
        faq: FAQ_PRE_GRADING,
        migalha: 'Pré-grading',
      })} />
      <PublicHeader />

      <main>
        <section className="sv-hero">
          <div className="bx-gutter sv-container sv-hero-grid">
            <div className="sv-hero-l">
              <span className="sv-badge">Orçamento grátis pelas fotos</span>
              <h1 className="sv-h1">Pré-grading: <span>descubra a nota antes de graduar</span></h1>
              <p className="sv-sub">Centralização medida, bordas, cantos e superfície vistos com lupa e luz rasante. Você recebe a nota provável, a graduadora certa para essa carta e quanto ela vale graduada no Mercado Brasileiro.</p>
              <div className="sv-ctas" id="sv-hero-cta">
                <a className="sv-cta" href={agendarHref('pre_grading')}>Pedir orçamento pelas fotos <IconArrowRight size={18} strokeWidth={2.2} /></a>
                <a className="sv-ghost" href="#laudo">Ver o que o laudo traz</a>
              </div>
              <Garantias itens={['Você só envia depois de aprovar o preço', 'PSA, TAG, CGC, BGS e GBA', 'Brasil todo pelo correio']} />
            </div>
            <div className="sv-hero-r">
              <MockupLaudo />
            </div>
          </div>
        </section>

        {EXEMPLO_NOTA && (
          <Faixa alt>
            <Cabecalho eyebrow="Em reais" titulo="Quanto a nota muda o preço" sub={`${EXEMPLO_NOTA.carta}, no Mercado Brasileiro, em ${EXEMPLO_NOTA.data}.`} />
            <div className="sv-g3">
              <div className="sv-card sv-feat"><span>Sem graduação</span><b className="sv-plan-v">R$ {brl(EXEMPLO_NOTA.raw)}</b></div>
              <div className="sv-card sv-feat"><span>Graduada 9</span><b className="sv-plan-v">R$ {brl(EXEMPLO_NOTA.nota9)}</b></div>
              <div className="sv-card sv-feat"><span>Graduada 10</span><b className="sv-plan-v">R$ {brl(EXEMPLO_NOTA.nota10)}</b></div>
            </div>
            {PRECOS && (
              <p className="sv-regra">Mandar para a graduadora uma carta que vai tirar 7 custa a taxa e o frete. O pré-grading custa R$ {brl(PRECOS.preGrading)}.</p>
            )}
          </Faixa>
        )}

        <Faixa id="laudo" alt>
          <Cabecalho eyebrow="O relatório" titulo="O que o laudo traz" sub="Um documento por carta, com a mesma régua que a graduadora vai usar." />
          <div className="sv-g3">
            {LAUDO_ITENS.map(i => (
              <div key={i.t} className="sv-card sv-card-hover sv-feat">
                <span className="sv-ic sv-ic-lg"><IconCheck size={18} strokeWidth={2} /></span>
                <b>{i.t}</b>
                <span>{i.d}</span>
              </div>
            ))}
          </div>
        </Faixa>

        <Faixa id="graduadoras">
          <Cabecalho eyebrow="Para onde mandar" titulo="Qual graduadora vale para a sua carta" sub="A carta sai preparada para qualquer uma. O laudo indica a que faz mais sentido." />
          <div className="sv-narrow sv-card" style={{ padding: 4 }}>
            <table className="sv-tabela">
              <thead><tr><th>Graduadora</th><th>Quando recomendamos</th></tr></thead>
              <tbody>
                {GRADUADORAS.map(g => <tr key={g.nome}><td>{g.nome}</td><td>{g.quando}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Faixa>

        <Faixa id="slab" alt>
          <div className="sv-g2">
            <div>
              <span className="sv-eyebrow">Serviço completo</span>
              <h2 className="sv-h2" style={{ margin: '12px 0 16px' }}>Carta em slab: quebra, restauração e regraduação</h2>
              <p className="sv-p">A carta tirou uma nota abaixo do que merecia por um vinco ou uma ondulação? O serviço completo quebra o slab com cuidado, trata o que dá para tratar, refaz o pré-grading e devolve a carta pronta para uma nova graduação.</p>
            </div>
            <div className="sv-card sv-feat">
              <span className="sv-ic sv-ic-lg"><IconTarget size={20} /></span>
              <b>Restauração + pré-grading</b>
              <span>O caminho inteiro até a graduadora, numa entrega só.</span>
              <a className="sv-cta" href={agendarHref('completo')} style={{ marginTop: 6 }}>Pedir orçamento do completo</a>
            </div>
          </div>
        </Faixa>

        <Custodia />
        <ComoFunciona alt />
        <Precos destaque="pre_grading" />
        <QuemFaz alt />
        <FaqServico itens={FAQ_PRE_GRADING} />
        <CtaFinal servico="pre_grading" outro={{ href: '/restauracao-de-cartas', texto: 'Conhecer a restauração' }} />
      </main>

      <StickyCta href={agendarHref('pre_grading')} rotulo="Pedir orçamento pelas fotos" />
      <PublicFooter />
    </div>
  )
}
