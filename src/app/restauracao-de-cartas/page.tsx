import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import BeforeAfterSlider from '@/components/servicos/BeforeAfterSlider'
import GaleriaCasos from '@/components/servicos/GaleriaCasos'
import StickyCta from '@/components/servicos/StickyCta'
import {
  JsonLd, Faixa, Cabecalho, Garantias, ResolveNaoResolve, Custodia, ComoFunciona, NaoRegistrado, Precos,
  QuemFaz, VideoProcesso, FaqServico, CtaFinal, agendarHref,
} from '@/components/servicos/Secoes'
import { IconArrowRight } from '@/components/ui/Icons'
import { SV_CSS } from '@/components/servicos/css'
import { SERVICOS_PUBLICADO, CASOS, FAQ_RESTAURACAO, PRECOS, jsonLdServico } from '@/lib/servicos'

// Landing do servico de restauracao (fase 1). Orcamento pelas fotos, sem
// pagamento no site. Enquanto SERVICOS_PUBLICADO = false: noindex e nenhum
// link do site aponta pra ca.

const title = 'Restauração de carta Pokémon amassada ou empenada'
const description = 'Vinco, amassado, empeno e superfície levantada, sem tinta e sem cola. Vídeo da abertura do pacote e foto de entrada e saída. Orçamento grátis pelas fotos, envio de todo o Brasil.'
const url = 'https://bynx.gg/restauracao-de-cartas'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  robots: SERVICOS_PUBLICADO ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: { title: `${title} | Bynx`, description, url, siteName: 'Bynx', locale: 'pt_BR', type: 'website' },
  twitter: { card: 'summary_large_image', title: `${title} | Bynx`, description },
}

export default function RestauracaoPage() {
  const principal = CASOS[0]
  return (
    <div className="sv-root">
      <style>{SV_CSS}</style>
      <JsonLd data={jsonLdServico({
        path: '/restauracao-de-cartas',
        nome: 'Restauração de cartas Pokémon',
        descricao: description,
        tipo: 'Restauração de cartas colecionáveis',
        preco: PRECOS?.restauracao ?? null,
        faq: FAQ_RESTAURACAO,
        migalha: 'Restauração de cartas',
      })} />
      <PublicHeader />

      <main>
        <section className="sv-hero">
          <div className="bx-gutter sv-container sv-hero-grid">
            <div className="sv-hero-l">
              <span className="sv-badge">Orçamento grátis pelas fotos</span>
              <h1 className="sv-h1">Restauração de cartas Pokémon, <span>sem tinta e sem cola</span></h1>
              <p className="sv-sub">Vinco, amassado e carta ondulada tratados à mão, uma carta por vez. A abertura do seu pacote é filmada e cada etapa aparece na sua conta.</p>
              <div className="sv-ctas" id="sv-hero-cta">
                <a className="sv-cta" href={agendarHref('restauracao')}>Pedir orçamento pelas fotos <IconArrowRight size={18} strokeWidth={2.2} /></a>
                <a className="sv-ghost" href="#como-funciona">Ver como funciona</a>
              </div>
              <Garantias itens={['Você só envia depois de aprovar o preço', 'Chegada filmada', 'Brasil todo pelo correio']} />
            </div>
            <div className="sv-hero-r">
              <BeforeAfterSlider antes={principal?.antes ?? null} depois={principal?.depois ?? null} alt={principal?.carta ?? 'Carta restaurada'} priority />
            </div>
          </div>
        </section>

        <ResolveNaoResolve />

        {CASOS.length > 1 && (
          <Faixa id="casos">
            <Cabecalho eyebrow="Casos reais" titulo="Antes e depois de cartas reais" sub="Toque numa carta para comparar. Mesma luz, mesmo enquadramento, sem edição." />
            <GaleriaCasos casos={CASOS.slice(1)} />
          </Faixa>
        )}

        <Custodia />
        <ComoFunciona alt />
        <NaoRegistrado />
        <Precos destaque="restauracao" />
        <QuemFaz alt />
        <VideoProcesso />
        <FaqServico itens={FAQ_RESTAURACAO} />
        <CtaFinal servico="restauracao" outro={{ href: '/pre-grading', texto: 'Conhecer o pré-grading' }} />
      </main>

      <StickyCta href={agendarHref('restauracao')} rotulo="Pedir orçamento pelas fotos" />
      <PublicFooter />
    </div>
  )
}
