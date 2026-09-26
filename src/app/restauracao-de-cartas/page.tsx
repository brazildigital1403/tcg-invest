import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import BeforeAfterSlider from '@/components/servicos/BeforeAfterSlider'
import GaleriaCasos from '@/components/servicos/GaleriaCasos'
import StickyCta from '@/components/servicos/StickyCta'
import {
  JsonLd, ResolveNaoResolve, Custodia, ComoFunciona, NaoRegistrado, Precos, QuemFaz, VideoProcesso,
  FaqServico, CtaFinal, agendarHref,
} from '@/components/servicos/Secoes'
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

      <main className="bx-gutter">
        <div className="sv-wrap">
          <section className="sv-hero">
            <p className="sv-kicker">Restauração e pré-grading</p>
            <h1 className="sv-h1">Restauração de cartas Pokémon, <span>sem tinta e sem cola</span></h1>
            <p className="sv-sub">Vinco, amassado e carta ondulada tratados à mão, uma carta por vez. A abertura do seu pacote é filmada e cada etapa aparece na sua conta.</p>
            <BeforeAfterSlider antes={principal?.antes ?? null} depois={principal?.depois ?? null} alt={principal?.carta ?? 'Carta restaurada'} priority />
            <div style={{ marginTop: 18 }} id="sv-hero-cta">
              <a className="sv-cta" href={agendarHref('restauracao')}>Pedir orçamento pelas fotos</a>
            </div>
            <p className="sv-small" style={{ textAlign: 'center' }}>Orçamento grátis. Você só envia a carta depois de aprovar o preço.</p>
            <a className="sv-link" href="#como-funciona" style={{ width: '100%', justifyContent: 'center' }}>Ver como funciona</a>
          </section>

          <ResolveNaoResolve />

          {CASOS.length > 1 && (
            <section className="sv-sec" id="casos">
              <h2 className="sv-h2">Antes e depois de cartas reais</h2>
              <p className="sv-p">Toque numa carta para comparar. Mesma luz, mesmo enquadramento, sem edição.</p>
              <GaleriaCasos casos={CASOS.slice(1)} />
            </section>
          )}

          <Custodia />
          <ComoFunciona />
          <NaoRegistrado />
          <Precos destaque="restauracao" />
          <QuemFaz />
          <VideoProcesso />
          <FaqServico itens={FAQ_RESTAURACAO} />
          <CtaFinal servico="restauracao" outro={{ href: '/pre-grading', texto: 'Quer saber a nota antes? Conheça o pré-grading' }} />
        </div>
      </main>

      <StickyCta href={agendarHref('restauracao')} rotulo="Pedir orçamento pelas fotos" />
      <PublicFooter />
    </div>
  )
}
