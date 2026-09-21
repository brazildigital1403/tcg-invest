import Image from 'next/image'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { PLAN_PRECOS } from '@/lib/plan'
import PlanosClient from './PlanosClient'

const BASE = 'https://bynx.gg'
const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
const MENSAL = PLAN_PRECOS.pro.mensal
const ANUAL = PLAN_PRECOS.pro_anual.anual
const PLUS = PLAN_PRECOS.plus.mensal
const MESES_GRATIS = Math.floor((MENSAL * 12 - ANUAL) / MENSAL)

/**
 * ★ O TITLE MIRA A BUSCA QUE EXISTE (20/09/2026). A primeira versao desta
 * pagina se chamava "quanto custa a Bynx" — e o autocomplete pt-BR devolve
 * VAZIO para isso. Ninguem procura o preco de uma marca que nao conhece.
 * O que tem volume, medido no autocomplete e nas buscas relacionadas, e
 * "aplicativo valor cartas pokemon", "aplicativo para escanear/catalogar
 * cartas pokemon" e "site para catalogar cartas pokemon" — e a palavra
 * "catalogar" nao aparecia uma vez na pagina.
 */
export const metadata = {
  title: 'Planos e preços — app para catalogar cartas Pokémon',
  description:
    `Catalogue sua coleção de Pokémon TCG escaneando as cartas com a câmera e veja quanto ela vale em reais. `
    + `Plano grátis para sempre, Plus por ${brl(PLUS)} e Pro por ${brl(MENSAL)} ao mês.`,
  alternates: { canonical: `${BASE}/planos` },
  openGraph: {
    title: 'Planos e preços — Bynx',
    description:
      `Catalogue escaneando com a câmera e veja quanto sua coleção vale em reais. Grátis para sempre, Plus ${brl(PLUS)}, Pro ${brl(MENSAL)}.`,
    url: `${BASE}/planos`,
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Planos e preços — Bynx',
    description: 'Catalogue escaneando com a câmera e veja quanto sua coleção vale em reais.',
  },
}

const CRUMBS = [
  { name: 'Início', href: '/' },
  { name: 'Planos', href: '/planos' },
]

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: CRUMBS.map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.name,
    item: `${BASE}${c.href === '/' ? '/' : c.href}`,
  })),
}

/**
 * ★ RESOLVIDO EM 20/09/2026 (decisao do Du): o Scan esta no Plus (100 SCANS/mes, nao cartas) e no
 * Pro (ilimitado). Antes desta data a pergunta faltava aqui de proposito,
 * porque a home dizia "recurso do Pro", a /scan-ia dizia "sem assinatura" e a
 * /colecionadores dizia "Pro com creditos mensais" — tres versoes no ar ao
 * mesmo tempo. Os pacotes avulsos viraram COMPLEMENTO para quem estoura a
 * cota, que e o que o codigo ja fazia (o avulso so e consumido depois da cota).
 *
 * ★ Sobre o FAQPage abaixo: o Google DESATIVOU o rich result de FAQ em
 * 07/05/2026 e tirou a doc em 15/06. O schema fica porque continua sendo dado
 * estruturado valido (e o Bing ainda usa), mas nao espere snippet por ele. O
 * valor real destas perguntas e o texto na pagina, para quem le.
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: 'Quanto custa para catalogar minha coleção de Pokémon?',
    a: `Começa em zero. O plano grátis não expira e catalaga até 100 cartas. O Plus custa ${brl(PLUS)} por mês `
      + `e vai até 500 cartas, com 100 scans por mês. O Pro custa ${brl(MENSAL)} por mês, não tem limite de cartas nem de scans. `
      + `No anual o Pro sai por ${brl(ANUAL)}, equivalente a ${brl(ANUAL / 12)} por mês — cerca de ${MESES_GRATIS} meses grátis.`,
  },
  {
    q: 'Dá para usar de graça?',
    a: 'Dá. O plano grátis não expira, traz a Pokédex completa e permite catalogar até 100 cartas, manter uma pasta do fichário, '
      + 'publicar 3 anúncios no Mercado e ter perfil público. O catálogo de cartas e os preços em reais '
      + 'podem ser consultados sem nem criar conta.',
  },
  {
    q: 'Preciso de cartão de crédito para começar?',
    a: 'Não. A conta é criada sem cartão e você começa com 7 dias de acesso Pro incluídos. '
      + 'O cartão só é pedido se você decidir assinar.',
  },
  {
    q: 'O que acontece quando os 7 dias de Pro terminam?',
    a: 'Nada é apagado. Sua coleção, seu fichário e seus anúncios continuam lá. O que deixa de funcionar '
      + 'são os recursos pagos. Você volta para o plano grátis automaticamente, sem cobrança nenhuma.',
  },
  {
    q: 'Como funciona o Scan com IA?',
    a: 'Você aponta a câmera para a carta e a Bynx identifica nome, número, coleção e variante, e já traz o '
      + 'preço em reais. Serve para catalogar uma carta ou uma página inteira do fichário sem digitar nada.',
  },
  {
    q: 'O Scan com IA está em qual plano?',
    a: 'O Plus inclui 100 scans por mês e o Pro não tem limite. O plano grátis não tem Scan, mas toda conta '
      + 'nova começa com 7 dias de acesso Pro, então dá para experimentar antes de decidir.',
  },
  {
    // ★ O limite e por SCAN (uma foto), nao por carta: a rota scan-cards debita
    //   UMA vez por requisicao, antes do reconhecimento, e uma foto com varias
    //   cartas gera um debito so. Uma versao anterior da copy dizia "100 cartas
    //   por mes" -- errado, e subvendia o plano.
    q: '100 scans são 100 cartas?',
    a: 'Não, costumam ser mais. Cada scan é uma foto, e uma foto pode ter várias cartas: se você fotografar '
      + 'cinco cartas de uma vez, a Bynx identifica as cartas da imagem e conta um scan só.',
  },
  {
    q: 'E se eu passar dos 100 scans do Plus?',
    a: 'Você pode comprar um pacote avulso de scans, que não expira e só é usado depois que a cota do mês '
      + 'acaba. Se estourar a cota com frequência, o Pro sai mais barato que comprar pacote todo mês.',
  },
  {
    q: 'Quais formas de pagamento a Bynx aceita?',
    a: 'Hoje a assinatura é cobrada apenas no cartão de crédito, processada pela Stripe. '
      + 'Ainda não aceitamos Pix nem boleto para assinatura.',
  },
  {
    q: 'O preço aumenta na renovação?',
    a: 'Não. O valor que você assina hoje é o mesmo que continua sendo cobrado depois. '
      + 'A Bynx não trabalha com preço promocional de primeiro ano.',
  },
  {
    q: 'Como faço para cancelar?',
    a: 'Em Minha Conta existe o botão "Gerenciar assinatura", que abre o portal da Stripe. '
      + 'Por lá você cancela, troca o cartão ou vê suas faturas. O cancelamento vale no fim do período '
      + 'já pago, sem multa e sem fidelidade.',
  },
  {
    q: 'Os preços das cartas são em reais?',
    a: 'São. A Bynx trabalha com preços do mercado brasileiro, em reais, e não com conversão de dólar. '
      + 'Quando existe referência internacional, ela aparece separada e identificada.',
  },
  {
    q: 'Tenho uma loja de cards. Serve para mim?',
    a: 'O plano de lojista é outro, com vitrine, checkout e frete calculado. A página para lojistas '
      + 'tem os valores e o que cada plano de loja inclui.',
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

// Carta usada na demonstracao do Scan. CDN publico, o mesmo helper da home.
const CARTA_DEMO = 'https://images.pokemontcg.io/base1/4.png'

type Linha = { label: string; vals: [string, string, string, string] }
const BLOCOS: { titulo: string; linhas: Linha[] }[] = [
  {
    titulo: 'Coleção',
    // ★ Limite escrito por extenso na celula, nao um "sim" generico: e a
    //   diferenca entre "tem" e "tem quanto", e foi apontada como a mudanca de
    //   maior retorno na tabela.
    linhas: [
      { label: 'Cartas na coleção', vals: ['100', '500', 'Ilimitadas', 'Ilimitadas'] },
      { label: 'Pastas do fichário', vals: ['1 pasta', 'Ilimitadas', 'Ilimitadas', 'Ilimitadas'] },
      { label: 'Anúncios no Mercado', vals: ['3 anúncios', 'Ilimitados', 'Ilimitados', 'Ilimitados'] },
      { label: 'Perfil público', vals: ['Sim', 'Sim', 'Sim', 'Sim'] },
    ],
  },
  {
    titulo: 'Preço e acompanhamento',
    linhas: [
      { label: 'Preços em reais', vals: ['Sim', 'Sim', 'Sim', 'Sim'] },
      { label: 'Quanto sua coleção vale', vals: ['—', 'Sim', 'Sim', 'Sim'] },
      { label: 'Pokédex completa', vals: ['Sim', 'Sim', 'Sim', 'Sim'] },
      { label: 'Histórico de preço', vals: ['—', '—', 'Sim', 'Sim'] },
      { label: 'Exportar CSV e PDF', vals: ['—', '—', 'Sim', 'Sim'] },
    ],
  },
  {
    titulo: 'Scan e impressão',
    linhas: [
      { label: 'Scan com IA', vals: ['—', '100 scans/mês', 'Ilimitado', 'Ilimitado'] },
      { label: 'Separadores de fichário', vals: ['Avulso', 'Avulso', 'Liberados', 'Liberados'] },
      { label: 'Master Sets', vals: ['Avulso', 'Avulso', 'Avulso', 'Todos'] },
      { label: 'Páginas Lendárias', vals: ['Avulso', 'Avulso', 'Avulso', 'Todas'] },
    ],
  },
]

function Celula({ v }: { v: string }) {
  if (v === '—') return <span style={{ color: 'var(--bx-text-faint)' }}>—</span>
  if (v === 'Sim') return <span style={{ color: 'var(--bx-green)', fontWeight: 700 }}>Sim</span>
  return <span style={{ fontWeight: 700 }}>{v}</span>
}

export default function PlanosPage() {
  return (
    <div style={{ background: 'var(--bx-bg)', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", color: 'var(--bx-text)' }}>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <PublicHeader />

      <div className="bx-gutter" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 100px' }}>

        <Breadcrumb items={CRUMBS} />

        {/* ── Hero ── */}
        <div style={{ textAlign: 'center', marginBottom: 46 }}>
          <p style={S.eyebrow}>Planos</p>
          <h1 style={S.h1}>Catalogue sua coleção<br />sem digitar carta por carta.</h1>
          <p style={S.lede}>
            Aponte a câmera e a carta entra com nome, variante e preço em reais do mercado
            brasileiro. Comece de graça e assine quando fizer sentido.
          </p>
        </div>

        {/* ── Demonstração do Scan ──
            A pagina nao tinha uma imagem, e o produto e visual. Nenhum app
            brasileiro do nicho mostra o scan: PokeLens e Zukan tem scanner e
            nao publicaram um print dele. */}
        <section style={{ marginBottom: 56 }}>
          <div className="bx-scan-grid">
            <div style={S.step}>
              <div style={S.stepN}>1</div>
              <h2 style={S.stepH}>Você fotografa</h2>
              <p style={S.stepP}>Uma carta, ou a página inteira do fichário.</p>
              <div style={S.shot}>
                <Image src={CARTA_DEMO} alt="Carta de Pokémon sendo fotografada" width={180} height={251} sizes="180px" style={S.shotImg} />
              </div>
            </div>

            <div style={S.step}>
              <div style={S.stepN}>2</div>
              <h2 style={S.stepH}>A Bynx reconhece</h2>
              <p style={S.stepP}>Nome, número, coleção e variante, sem você digitar nada.</p>
              <div style={S.shot}>
                <Image src={CARTA_DEMO} alt="Carta identificada pelo reconhecimento de imagem" width={180} height={251} sizes="180px" style={S.shotImg} />
                <div style={S.recog} />
                <div style={S.tagline}><b style={{ color: 'var(--bx-text)' }}>Charizard 4/102</b><span style={S.ok}>reconhecida</span></div>
              </div>
            </div>

            <div style={S.step}>
              <div style={S.stepN}>3</div>
              <h2 style={S.stepH}>Entra na coleção</h2>
              <p style={S.stepP}>Com o preço em reais e o valor total atualizado sozinho.</p>
              <div style={S.shot}>
                <Image src={CARTA_DEMO} alt="Carta adicionada à coleção com o preço em reais" width={180} height={251} sizes="180px" style={S.shotImg} />
                <div style={S.tagline}><b style={{ color: 'var(--bx-text)' }}>Sua coleção</b><span style={S.ok}>atualizada</span></div>
              </div>
            </div>
          </div>
          <p style={S.ilustra}>Ilustração do funcionamento do Scan com IA, disponível nos planos Plus e Pro.</p>
        </section>

        {/* ── Planos ── */}
        <section style={{ marginBottom: 64 }}>
          <PlanosClient />
        </section>

        {/* ── Trial ── */}
        <section style={{ marginBottom: 64 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={S.secT}>Os 7 dias de Pro, sem pegadinha</h2>
            <p style={S.secS}>Toda conta nova começa com o Pro liberado. Não pedimos cartão para isso.</p>
          </div>
          <div className="bx-tl">
            <div style={S.tlS}>
              <p style={S.tlD}>Hoje</p>
              <h3 style={S.tlH}>Você cria a conta</h3>
              <p style={S.tlP}>Pro completo liberado. Nenhum cartão pedido.</p>
            </div>
            <div style={S.tlS}>
              <p style={S.tlD}>Dia 5</p>
              <h3 style={S.tlH}>Avisamos por e-mail</h3>
              <p style={S.tlP}>Antes do fim, para nada te pegar de surpresa.</p>
            </div>
            <div style={{ ...S.tlS, background: 'rgba(34,197,94,0.05)' }}>
              <p style={{ ...S.tlD, color: 'var(--bx-green)' }}>Dia 7</p>
              <h3 style={S.tlH}>Vira Grátis sozinho</h3>
              <p style={S.tlP}>Nada é apagado e nada é cobrado. Sua coleção continua sua.</p>
            </div>
          </div>
        </section>

        {/* ── Comparativo ── */}
        <section style={{ marginBottom: 64 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={S.secT}>Comparativo completo</h2>
            <p style={S.secS}>Por área, para achar rápido o que importa para você.</p>
          </div>

          {BLOCOS.map(bloco => (
            <div key={bloco.titulo} style={S.tblock}>
              <div style={S.tblockH}>{bloco.titulo}</div>
              <div className="bx-trow bx-trow-head">
                <div />
                <div>Grátis</div><div>Plus</div><div>Pro</div><div>Anual</div>
              </div>
              {bloco.linhas.map(l => (
                <div key={l.label} className="bx-trow">
                  <div>{l.label}</div>
                  {l.vals.map((v, i) => <div key={i}><Celula v={v} /></div>)}
                </div>
              ))}
            </div>
          ))}
        </section>

        {/* ── FAQ ── */}
        <section style={{ marginBottom: 56 }}>
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <h2 style={S.secT}>Perguntas frequentes</h2>
            <p style={S.secS}>O que as pessoas costumam perguntar antes de assinar.</p>
          </div>
          <div style={S.faqWrap}>
            {FAQ.map(f => (
              <div key={f.q} style={S.fq}>
                <h3 style={S.fqQ}>{f.q}</h3>
                <p style={S.fqA}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA final ── */}
        <section>
          <div style={S.final}>
            <h2 style={S.finalH}>Comece pelos 7 dias de Pro</h2>
            <p style={S.finalP}>
              Sem cartão, sem fidelidade. Se não fizer sentido, você não faz nada
              e a conta vira Grátis sozinha.
            </p>
            <a href="/?auth=signup&next=%2Fminha-colecao" style={S.finalBtn} className="bx-planos-cta">
              Criar conta grátis
            </a>
            <div style={S.trust} className="bx-trust">
              <span>Cancele quando quiser</span>
              <span>Sem fidelidade</span>
              <span>O preço não muda na renovação</span>
            </div>
          </div>
        </section>

        <p style={S.lojista}>
          Tem loja de card? O plano de lojista é outro —{' '}
          <a href="/para-lojistas" style={{ color: 'var(--ac-1)', textDecoration: 'none', fontWeight: 600 }}>
            veja a página para lojistas
          </a>.
        </p>

      </div>

      <PublicFooter />

      <style>{`
        .bx-scan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
        .bx-tl { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
                 border: 1px solid var(--bx-border); border-radius: 16px; overflow: hidden; }
        .bx-tl > div { border-right: 1px solid var(--bx-border); }
        .bx-tl > div:last-child { border-right: none; }
        .bx-trow { display: grid; grid-template-columns: minmax(0,1.6fr) repeat(4, minmax(0,1fr));
                   border-top: 1px solid var(--bx-border); font-size: 13px; }
        .bx-trow > div { padding: 12px 8px; text-align: center; min-width: 0; }
        .bx-trow > div:first-child { text-align: left; padding-left: 18px; color: var(--bx-text-3);
                                     font-weight: 600; font-size: 12.5px; }
        .bx-trow-head > div { font-weight: 800; color: var(--bx-text); font-size: 11.5px;
                              text-transform: uppercase; letter-spacing: .05em; border-top: none; }
        .bx-trust span { font-size: 11.5px; color: var(--bx-text-3); }
        .bx-planos-cta { transition: transform .15s ease, box-shadow .15s ease; }
        .bx-planos-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 28px -14px rgba(var(--ac-1-rgb), .9); }
        @media (prefers-reduced-motion: reduce) {
          .bx-planos-cta { transition: none; }
          .bx-planos-cta:hover { transform: none; }
        }
        @media (max-width: 640px) {
          .bx-trow { font-size: 11.5px; }
          .bx-trow > div { padding: 10px 3px; }
          .bx-trow > div:first-child { padding-left: 12px; font-size: 11.5px; }
          .bx-tl > div { border-right: none; border-bottom: 1px solid var(--bx-border); }
          .bx-tl > div:last-child { border-bottom: none; }
        }
      `}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  eyebrow: { fontSize: 11, fontWeight: 800, color: 'var(--ac-1)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 },
  h1: { fontSize: 34, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.13, marginBottom: 14 },
  lede: { fontSize: 16, color: 'var(--bx-text-2)', lineHeight: 1.62, maxWidth: 600, margin: '0 auto' },

  step: { background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 16, padding: 18, minWidth: 0 },
  stepN: {
    width: 26, height: 26, borderRadius: '50%', background: 'rgba(var(--ac-1-rgb),0.14)',
    border: '1px solid rgba(var(--ac-1-rgb),0.35)', color: 'var(--ac-1)', fontSize: 12, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  stepH: { fontSize: 14, fontWeight: 700, margin: '0 0 5px' },
  stepP: { fontSize: 12.5, color: 'var(--bx-text-3)', lineHeight: 1.55, margin: 0, minHeight: 38 },
  shot: {
    marginTop: 12, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--bx-border)',
    background: 'var(--bx-bg-elev)', aspectRatio: '1 / 1', display: 'flex',
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  shotImg: { width: '72%', height: 'auto', borderRadius: 6, display: 'block' },
  recog: { position: 'absolute', inset: 0, border: '2px solid var(--ac-1)', borderRadius: 12, boxShadow: 'inset 0 0 40px rgba(var(--ac-1-rgb),0.22)' },
  tagline: {
    position: 'absolute', bottom: 8, left: 8, right: 8, background: 'rgba(8,10,15,0.9)',
    border: '1px solid var(--bx-border)', borderRadius: 8, padding: '7px 9px', fontSize: 11,
    display: 'flex', justifyContent: 'space-between', gap: 8,
  },
  ok: { color: 'var(--bx-green)', fontWeight: 800 },
  ilustra: { fontSize: 11.5, color: 'var(--bx-text-faint)', textAlign: 'center', marginTop: 12 },

  secT: { fontSize: 23, fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 8px' },
  secS: { fontSize: 14, color: 'var(--bx-text-3)', margin: 0, lineHeight: 1.6 },

  tlS: { padding: '20px 18px', minWidth: 0 },
  tlD: { fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ac-1)', margin: '0 0 7px' },
  tlH: { fontSize: 14, fontWeight: 700, margin: '0 0 5px' },
  tlP: { fontSize: 12.5, color: 'var(--bx-text-3)', lineHeight: 1.55, margin: 0 },

  tblock: { background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  tblockH: {
    padding: '13px 18px', background: 'var(--bx-surface-2)', fontSize: 11.5, fontWeight: 800,
    letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--bx-text-3)',
  },

  faqWrap: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 780, margin: '0 auto' },
  fq: { background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 14, padding: '18px 20px' },
  fqQ: { fontSize: 15, fontWeight: 700, marginBottom: 7, color: 'var(--bx-text)' },
  fqA: { fontSize: 14, color: 'var(--bx-text-2)', lineHeight: 1.65, margin: 0 },

  final: {
    background: 'linear-gradient(180deg, rgba(var(--ac-1-rgb),0.07), transparent)',
    border: '1px solid rgba(var(--ac-1-rgb),0.22)', borderRadius: 20, padding: '40px 28px', textAlign: 'center',
  },
  finalH: { fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 10px' },
  finalP: { fontSize: 14, color: 'var(--bx-text-2)', margin: '0 0 20px', lineHeight: 1.6 },
  finalBtn: {
    minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 24px', borderRadius: 12, background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)',
    fontWeight: 800, fontSize: 14, textDecoration: 'none',
  },
  trust: { display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 },

  lojista: { marginTop: 40, textAlign: 'center', fontSize: 13, color: 'var(--bx-text-3)', lineHeight: 1.7 },
}
