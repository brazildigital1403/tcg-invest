import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import AgendarClient from './AgendarClient'
import { SV_CSS } from '@/components/servicos/css'
import { Garantias } from '@/components/servicos/Secoes'
import { servicoPorParam, MAX_CARTAS_POR_SOLICITACAO } from '@/lib/servicos'

// Orcamento pelas fotos, numa tela so, no mesmo molde das landings de servico:
// hero em faixa e, embaixo, o formulario com o resumo fixo na lateral (desktop)
// ou no fim (celular). Nunca indexa: e o passo do funil, nao pagina de busca.
// ?servico= pre-seleciona; ?qtd= volta preservado do login.

export const metadata: Metadata = {
  title: 'Pedir orçamento de restauração ou pré-grading',
  description: 'Mande as fotos da carta e receba o orçamento antes de qualquer envio.',
  robots: { index: false, follow: true },
}

const DEPOIS = [
  { t: 'Você recebe o orçamento', d: 'No seu e-mail e na sua conta, com o que dá para fazer em cada carta.' },
  { t: 'Aprova e envia', d: 'O endereço e o guia de embalagem aparecem só depois do aceite.' },
  { t: 'Acompanha cada etapa', d: 'Vídeo da chegada, fotos na bancada e rastreio de volta.' },
]

export default async function AgendarPage({ searchParams }: { searchParams: Promise<{ servico?: string; qtd?: string }> }) {
  const { servico, qtd } = await searchParams
  const n = Math.min(MAX_CARTAS_POR_SOLICITACAO, Math.max(1, Number.parseInt(qtd || '1', 10) || 1))
  return (
    <div className="sv-root">
      <style>{SV_CSS}</style>
      <PublicHeader />
      <main>
        <section className="sv-hero sv-hero-curto">
          <div className="bx-gutter sv-container sv-hero-grid">
            <div className="sv-hero-l">
              <span className="sv-badge">Orçamento grátis pelas fotos</span>
              <h1 className="sv-h1">Peça o orçamento <span>da sua carta</span></h1>
              <p className="sv-sub">Escolha o serviço, mande frente e verso de cada carta e receba o orçamento antes de qualquer envio. Nada é cobrado agora.</p>
              <Garantias itens={['Você só envia depois de aprovar o preço', 'Resposta na sua conta', 'Brasil todo pelo correio']} />
            </div>
            <div className="sv-hero-r">
              <div className="sv-card sv-depois">
                <span className="sv-eyebrow">O que acontece depois</span>
                <ol>
                  {DEPOIS.map((p, i) => (
                    <li key={p.t}><span className="sv-tl-n">{i + 1}</span><div><b>{p.t}</b><span>{p.d}</span></div></li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>
        <AgendarClient servicoInicial={servicoPorParam(servico)} qtdInicial={n} />
      </main>
      <PublicFooter />
    </div>
  )
}
