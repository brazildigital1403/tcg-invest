import type { Metadata } from 'next'
import Link from 'next/link'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import StickyCta from '@/components/servicos/StickyCta'
import {
  JsonLd, Faixa, Cabecalho, Garantias, FaqServico, CtaFinal, agendarHref, ShortsBancada,
} from '@/components/servicos/Secoes'
import { SV_CSS } from '@/components/servicos/css'
import {
  IconTarget, IconArrowRight, IconCamera, IconEye, IconHistory, IconTruck, IconShield, IconInstagram, IconYouTube,
} from '@/components/ui/Icons'
import { MockupLaudo, DiagramaDefeito, IlustracaoCustodia, IlustracaoBancada, type TipoDefeito, type TomDefeito } from '@/components/servicos/Mockups'
import {
  MedicaoCentralizacao, LeituraBancada, SlabsGraduadoras, SlabAberto, ReguaSeparador, CartaDentroDoLimite,
} from '@/components/servicos/MockupsPreGrading'
import RelatorioDemonstrativo from '@/components/servicos/RelatorioDemonstrativo'
import {
  SERVICOS_PUBLICADO, FAQ_PRE_GRADING_LANDING, PASSOS_PRE_GRADING, CUSTODIA_PRE_GRADING, SERVICOS, PRECOS, PRAZOS, LINKS, CIDADE,
  precoDoServico, brl, jsonLdServico,
} from '@/lib/servicos'

// Landing do pre-grading (fase 1). Mesmo esqueleto da restauracao, com o laudo
// no lugar do slider e o argumento em reais ("quanto a nota muda o preco").
// As secoes ilustradas (metodo, laudo, graduadoras, slab) vem de
// MockupsPreGrading. Custodia, passos, preco e "quem faz" tem variante local
// porque o texto do pre-grading difere (sem descanso, sem proposta de
// tratamento, prazo contado da chegada) e Secoes.tsx fica intacto.

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
        faq: FAQ_PRE_GRADING_LANDING,
        migalha: 'Pré-grading',
      })} />
      <PublicHeader />

      <main>
        <section className="sv-hero">
          <div className="bx-gutter sv-container sv-hero-grid">
            <div className="sv-hero-l">
              <span className="sv-badge">Orçamento grátis pelas fotos</span>
              <h1 className="sv-h1">Pré-grading: <span>descubra a nota antes de graduar</span></h1>
              <p className="sv-sub">Centralização medida, bordas, cantos e superfície vistos com lupa e luz rasante. Você recebe a faixa de nota provável, a graduadora certa para essa carta e o próximo passo.</p>
              <div className="sv-ctas" id="sv-hero-cta">
                <a className="sv-cta" href={agendarHref('pre_grading')}>Pedir orçamento pelas fotos <IconArrowRight size={18} strokeWidth={2.2} /></a>
                <a className="sv-ghost" href="#metodo">Ver como medimos</a>
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

        <Faixa id="metodo" alt>
          <Cabecalho
            eyebrow="O método"
            titulo="Régua, lupa e luz rasante. Nada no olho."
            sub="A mesma carta passa por quatro leituras, frente e verso. Cada uma vira uma linha do laudo."
          />
          <MedicaoCentralizacao />
          <div className="sv-g3" style={{ marginTop: 16 }}>
            <LeituraBancada tipo="cantos" />
            <LeituraBancada tipo="bordas" />
            <LeituraBancada tipo="superficie" />
          </div>
        </Faixa>

        <Faixa id="laudo">
          <Cabecalho
            eyebrow="O relatório"
            titulo="O que volta com a sua carta"
            sub="Cada carta volta com um relatório de bancada impresso: ficha de condição, laudo, fotos de entrada, valores e termos. Veja como ele é montado, página por página."
          />
          <RelatorioDemonstrativo exemplo="pre_grading" />
        </Faixa>

        {/* Centralizacao e resultado na graduadora abrem o carrossel no pre-grading. */}
        <ShortsBancada
          destaque={['p8qU2bMirkI', 'invoH6DVGCU', 'hpGch0jUrQQ']}
          sub="Como medimos a centralização, como a carta é preparada e o que a graduadora devolveu. Tudo gravado na bancada da Bynx."
        />

        <TresSaidas />

        <Faixa id="graduadoras">
          <Cabecalho eyebrow="Para onde mandar" titulo="Qual graduadora vale para a sua carta" sub="A carta sai preparada para qualquer uma. O laudo indica a que faz mais sentido." />
          <SlabsGraduadoras />
        </Faixa>

        <ComoFuncionaPreGrading />
        <CustodiaPreGrading />
        <PrecosPreGrading />

        <Faixa id="slab">
          <div className="mp-slabsec">
            <div className="mp-slabsec-txt">
              <div>
                <span className="sv-eyebrow">Serviço completo</span>
                <h2 className="sv-h2" style={{ margin: '12px 0 16px' }}>Carta em slab: quebra, restauração e regraduação</h2>
                <p className="sv-p">A carta tirou uma nota abaixo do que merecia por um vinco ou uma ondulação? O serviço completo quebra o slab com cuidado, trata o que dá para tratar, refaz o pré-grading e devolve a carta pronta para uma nova graduação.</p>
              </div>
              <div className="sv-card sv-feat">
                <span className="sv-ic sv-ic-lg"><IconTarget size={20} /></span>
                <b>Restauração + pré-grading</b>
                <span>O caminho inteiro até a graduadora, em uma entrega só.</span>
                <a className="sv-cta" href={agendarHref('completo')} style={{ marginTop: 6 }}>Pedir orçamento do completo</a>
              </div>
            </div>
            <div className="mp-slabsec-ilus"><SlabAberto /></div>
          </div>
        </Faixa>

        <QuemAvalia />
        <FaqServico itens={FAQ_PRE_GRADING_LANDING} />
        <CtaFinal servico="pre_grading" outro={{ href: '/restauracao-de-cartas', texto: 'Conhecer a restauração' }} />
      </main>

      <StickyCta href={agendarHref('pre_grading')} rotulo="Pedir orçamento pelas fotos" />
      <PublicFooter />
    </div>
  )
}

// ─── Secoes locais do pre-grading ────────────────────────────────────────────

const SAIDAS: { tipo: TipoDefeito | 'limpa'; tom: TomDefeito; t: string; d: string; link?: { href: string; texto: string } }[] = [
  {
    tipo: 'centralizacao', tom: 'bad', t: 'Guardar como está',
    d: 'Se a centralização passa do limite, é defeito de fábrica e não tem correção. O laudo diz isso antes de você pagar a taxa.',
  },
  {
    tipo: 'ondulada', tom: 'ok', t: 'Restaurar antes',
    d: 'Ondulação ou amassado sem fibra rompida derrubam a faixa e têm tratamento. A carta passa pela bancada e depois segue.',
    link: { href: '/restauracao-de-cartas', texto: 'Conhecer a restauração' },
  },
  {
    tipo: 'limpa', tom: 'ok', t: 'Graduar agora',
    d: 'Tudo dentro do limite: a carta segue para a graduadora indicada no laudo, já preparada.',
  },
]

function TresSaidas() {
  const sub = 'Taxa, frete e espera são os mesmos com a carta nota 7 ou nota 10.'
    + (PRECOS ? ` O pré-grading custa R$ ${brl(PRECOS.preGrading)} e diz antes se essa conta fecha.` : '')
  return (
    <Faixa id="saidas" alt>
      <Cabecalho eyebrow="Antes de pagar a taxa" titulo="A graduação custa caro para descobrir o que o laudo já diz" sub={sub} />
      <div className="mp-saidas">
        {SAIDAS.map(x => (
          <div key={x.t} className="sv-card mp-saida">
            <div className="mp-saida-top">
              {x.tipo === 'limpa'
                ? <CartaDentroDoLimite size={72} />
                : <DiagramaDefeito tipo={x.tipo} tom={x.tom} size={72} />}
              <b>{x.t}</b>
            </div>
            <p>{x.d}</p>
            {x.link && <Link className="sv-link" href={x.link.href}>{x.link.texto} <IconArrowRight size={15} /></Link>}
          </div>
        ))}
      </div>
    </Faixa>
  )
}

function ComoFuncionaPreGrading() {
  return (
    <Faixa id="como-funciona" alt>
      <ReguaSeparador />
      <Cabecalho eyebrow="Passo a passo" titulo="Como funciona" sub="Seis passos. Você aprova o preço antes de enviar, e a carta volta pronta para seguir para a graduadora." />
      <ol className="sv-tl">
        {PASSOS_PRE_GRADING.map((p, i) => (
          <li key={p.t}><span className="sv-tl-n">{i + 1}</span><div><b>{p.t}</b><span>{p.d}</span></div></li>
        ))}
      </ol>
    </Faixa>
  )
}

const CUSTODIA_ICONES = [IconCamera, IconEye, IconHistory, IconTruck]

/** Sem a etapa de descanso. */
function CustodiaPreGrading() {
  return (
    <Faixa id="custodia">
      <Cabecalho
        eyebrow="Como a sua carta viaja e volta"
        titulo="Sua carta tem número, registro e testemunha."
        sub="Mandar uma carta de valor pelo correio exige confiança. Por isso cada etapa deixa prova, e a prova fica na sua conta."
      />
      <div className="sv-g4">
        {CUSTODIA_PRE_GRADING.map((c, i) => {
          const Ic = CUSTODIA_ICONES[i] || IconShield
          return (
            <div key={c.t} className="sv-card sv-card-hover sv-feat">
              <span className="sv-ic sv-ic-lg sv-ic-ok"><Ic size={20} /></span>
              <b>{c.t}</b>
              <span>{c.d}</span>
            </div>
          )
        })}
      </div>
      <div className="sv-custodia-midia">
        {LINKS.videoAbertura
          ? <video className="sv-clip" src={LINKS.videoAbertura} poster={LINKS.videoAberturaPoster || undefined} muted playsInline controls preload="none" />
          : <IlustracaoCustodia codigo="BX-R-0001" />}
      </div>
    </Faixa>
  )
}

/** Prazo do pre-grading conta da chegada; nos outros dois, da aprovacao da proposta. */
function PrecosPreGrading() {
  if (!PRECOS) return null
  const dias = PRAZOS.padraoDiasUteis
  return (
    <Faixa id="preco" alt>
      <Cabecalho eyebrow="Investimento e prazo" titulo="Preço por carta" sub="O orçamento pelas fotos é grátis. Frete de ida e volta por sua conta, com valor declarado nos Correios." />
      <div className="sv-g3">
        {[...SERVICOS].sort((a, b) => (a.id === 'pre_grading' ? -1 : b.id === 'pre_grading' ? 1 : 0)).map(s => {
          const v = precoDoServico(s.id)!
          const prazo = dias
            ? s.id === 'pre_grading'
              ? `${dias} dias úteis após a chegada da carta. `
              : `${dias} dias úteis após a aprovação da proposta de tratamento. `
            : ''
          return (
            <div key={s.id} className={`sv-plan${s.id === 'pre_grading' ? ' sv-plan-dest' : ''}`}>
              {s.id === 'completo' && <span className="sv-ribbon">Mais completo</span>}
              <span className="sv-plan-nome">{s.nome}</span>
              <span className="sv-plan-v">R$ {brl(v)} <small>por carta</small></span>
              <span className="sv-plan-d">{prazo}{s.descricao}</span>
            </div>
          )
        })}
      </div>
      {(PRECOS.desc10a20 != null || PRECOS.descAcima20 != null) && (
        <div className="sv-pills">
          {PRECOS.desc10a20 != null && <span className="sv-pill">{PRECOS.desc10a20}% de desconto de 10 a 20 cartas</span>}
          {PRECOS.descAcima20 != null && <span className="sv-pill">{PRECOS.descAcima20}% acima de 20 cartas</span>}
        </div>
      )}
    </Faixa>
  )
}

function QuemAvalia() {
  return (
    <Faixa id="quem-faz" alt>
      <div className="sv-g2">
        <div className="sv-quem-foto"><IlustracaoBancada /></div>
        <div>
          <span className="sv-eyebrow">Quem faz</span>
          <h2 className="sv-h2" style={{ margin: '12px 0 16px' }}>Uma bancada, as mesmas mãos em toda carta.</h2>
          <p className="sv-p">
            Quem avalia hoje é o Edu, fundador da Bynx{CIDADE ? `, em ${CIDADE}` : ''}. Começou tratando as próprias cartas, e cada uma que chega passa pela mesma bancada, com o mesmo cuidado. Atendemos o Brasil todo pelo correio.
          </p>
          <div className="sv-redes">
            <a className="sv-ghost" href={LINKS.instagram} target="_blank" rel="noopener"><IconInstagram size={18} /> Instagram</a>
            {LINKS.youtube && <a className="sv-ghost" href={LINKS.youtube} target="_blank" rel="noopener"><IconYouTube size={18} /> YouTube</a>}
          </div>
        </div>
      </div>
    </Faixa>
  )
}
