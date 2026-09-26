import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import StickyCta from '@/components/servicos/StickyCta'
import {
  JsonLd, Custodia, ComoFunciona, Precos, QuemFaz, FaqServico, CtaFinal, agendarHref,
} from '@/components/servicos/Secoes'
import { SV_CSS } from '@/components/servicos/css'
import { IconTarget, IconCheck } from '@/components/ui/Icons'
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

      <main className="bx-gutter">
        <div className="sv-wrap">
          <section className="sv-hero">
            <p className="sv-kicker">Restauração e pré-grading</p>
            <h1 className="sv-h1">Pré-grading: <span>descubra a nota antes de graduar</span></h1>
            <p className="sv-sub">Centralização medida, bordas, cantos e superfície vistos com lupa e luz rasante. Você recebe a nota provável, a graduadora certa para essa carta e quanto ela vale graduada no Mercado Brasileiro.</p>

            <div className="sv-laudo" aria-label="Exemplo de laudo de pré-grading">
              <div className="sv-laudo-top"><span>Laudo de pré-grading</span><span className="sv-exemplo">exemplo</span></div>
              <div className="sv-laudo-row"><span>Centralização frente</span><b>55/45</b></div>
              <div className="sv-laudo-row"><span>Centralização verso</span><b>60/40</b></div>
              <div className="sv-laudo-row"><span>Cantos</span><b>1 com desgaste leve</b></div>
              <div className="sv-laudo-row"><span>Superfície</span><b>Sem risco no holo</b></div>
              <div className="sv-laudo-row"><span>Faixa provável</span><b>8 a 9</b></div>
              <div className="sv-laudo-row"><span>Recomendação</span><b>Graduar como está</b></div>
            </div>

            <div style={{ marginTop: 18 }} id="sv-hero-cta">
              <a className="sv-cta" href={agendarHref('pre_grading')}>Pedir orçamento pelas fotos</a>
            </div>
            <p className="sv-small" style={{ textAlign: 'center' }}>Orçamento grátis. Você só envia a carta depois de aprovar o preço.</p>
          </section>

          {EXEMPLO_NOTA && (
            <section className="sv-sec">
              <h2 className="sv-h2">Quanto a nota muda o preço</h2>
              <p className="sv-p">{EXEMPLO_NOTA.carta}, no Mercado Brasileiro, em {EXEMPLO_NOTA.data}:</p>
              <div className="sv-card">
                <div className="sv-laudo-row"><span>Sem graduação</span><b>R$ {brl(EXEMPLO_NOTA.raw)}</b></div>
                <div className="sv-laudo-row"><span>Graduada 9</span><b>R$ {brl(EXEMPLO_NOTA.nota9)}</b></div>
                <div className="sv-laudo-row"><span>Graduada 10</span><b>R$ {brl(EXEMPLO_NOTA.nota10)}</b></div>
              </div>
              {PRECOS && (
                <p className="sv-p" style={{ marginTop: 14 }}>Mandar para a graduadora uma carta que vai tirar 7 custa a taxa e o frete. O pré-grading custa R$ {brl(PRECOS.preGrading)}.</p>
              )}
            </section>
          )}

          <section className="sv-sec" id="laudo">
            <h2 className="sv-h2">O que o laudo traz</h2>
            <p className="sv-p">Um documento por carta, com a mesma régua que a graduadora vai usar.</p>
            <div className="sv-card">
              <ul className="sv-list">
                {LAUDO_ITENS.map(i => (
                  <li key={i.t} className="sv-li"><span className="sv-ic"><IconCheck size={16} strokeWidth={2} /></span><div><b>{i.t}</b><span>{i.d}</span></div></li>
                ))}
              </ul>
            </div>
          </section>

          <section className="sv-sec" id="graduadoras">
            <h2 className="sv-h2">Qual graduadora vale para a sua carta</h2>
            <p className="sv-p">A carta sai preparada para qualquer uma. O laudo indica a que faz mais sentido.</p>
            <div className="sv-card" style={{ padding: 4 }}>
              <table className="sv-tabela">
                <thead><tr><th>Graduadora</th><th>Quando indico</th></tr></thead>
                <tbody>
                  {GRADUADORAS.map(g => <tr key={g.nome}><td>{g.nome}</td><td>{g.quando}</td></tr>)}
                </tbody>
              </table>
            </div>
          </section>

          <section className="sv-sec" id="slab">
            <div className="sv-card">
              <span className="sv-ic" style={{ marginBottom: 12 }}><IconTarget size={18} /></span>
              <h2 className="sv-h2">Carta em slab: quebra, restauração e regraduação</h2>
              <p className="sv-p" style={{ margin: 0 }}>A carta tirou uma nota abaixo do que merecia por um vinco ou uma ondulação? O serviço completo quebra o slab com cuidado, trata o que dá para tratar, refaz o pré-grading e devolve a carta pronta para uma nova graduação.</p>
              <a className="sv-link" href={agendarHref('completo')}>Pedir orçamento do serviço completo</a>
            </div>
          </section>

          <Custodia />
          <ComoFunciona />
          <Precos destaque="pre_grading" />
          <QuemFaz />
          <FaqServico itens={FAQ_PRE_GRADING} />
          <CtaFinal servico="pre_grading" outro={{ href: '/restauracao-de-cartas', texto: 'A carta tem vinco ou está ondulada? Veja a restauração' }} />
        </div>
      </main>

      <StickyCta href={agendarHref('pre_grading')} rotulo="Pedir orçamento pelas fotos" />
      <PublicFooter />
    </div>
  )
}
