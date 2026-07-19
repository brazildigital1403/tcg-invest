import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import { getServiceSupabase } from '@/lib/supabaseServer'
import ParaLojistasMotion from './ParaLojistasMotion'

// ─── SEO ──────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Crie sua loja Pokémon TCG e venda online — Bynx',
  description:
    'Monte sua vitrine de cartas e produtos, venda com checkout e frete calculado, e apareça pra colecionadores da sua cidade. Grátis pra começar na Bynx.',
  openGraph: {
    title: 'Crie sua loja Pokémon TCG e venda online — Bynx',
    description:
      'Vitrine de cartas e produtos, checkout com frete calculado e o cliente que a Bynx traz pra você. A plataforma brasileira 100% Pokémon TCG.',
    url: 'https://bynx.gg/para-lojistas',
    type: 'website',
  },
  alternates: { canonical: 'https://bynx.gg/para-lojistas' },
}

// ISR: a contagem de lojas e as cartas atualizam sozinhas (max ~10 min).
export const revalidate = 600

// ─── Conteudo (assets reais do catalogo) ──────────────────────────────────────

const IMG = (id: string) => `https://images.pokemontcg.io/${id}.png`

const HERO_FLOAT = [
  { c: 'f1', img: 'ex8/107', alt: 'Rayquaza' },
  { c: 'f2', img: 'base1/4', alt: 'Charizard Base Set' },
  { c: 'f3', img: 'swsh7/215', alt: 'Umbreon VMAX' },
  { c: 'f4', img: 'ex6/108', alt: 'Gengar ex' },
]
const STORE_MINI = ['ex6/104', 'ecard2/149', 'svp/85']
const VITRINE = [
  { img: 'base1/4', n: 'Charizard', cond: 'NM · Base Set', p: 'R$ 249,90' },
  { img: 'swsh7/215', n: 'Umbreon VMAX', cond: 'PSA 9', p: 'R$ 189,90' },
  { img: 'ex6/108', n: 'Gengar ex', cond: 'LP', p: 'R$ 119,90' },
]
const FALLBACK_MARQUEE = [
  'base1/4', 'swsh7/215', 'ex8/107', 'ex6/108', 'ecard2/149', 'ex6/104', 'svp/85',
  'base4/4', 'ecard3/H10', 'ex15/101', 'pop5/17', 'pl4/97', 'swsh7/189', 'dp7/103',
].map(IMG)

const PRODUTO = {
  img: 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/loja-fotos/produtos/cb58e63a-4aca-48c6-ac8e-2bbaa1165d18/ca88acf9-e970-4a60-91e1-88b8739c8538.webp',
  nome: 'Combo 18 Boosters · Escuridão Absoluta',
  tipo: 'Selado · em estoque',
  preco: 'R$ 247,99',
}
const REVIEW = { autor: 'Paulo', txt: 'Excelente vendedor. A carta chegou em perfeito estado!' }

const FAQ: { q: string; a: string }[] = [
  {
    q: 'O que é a Bynx pra lojistas?',
    a: 'A Bynx é a plataforma brasileira 100% focada em Pokémon TCG onde lojas criam uma vitrine de cartas e produtos, vendem com checkout e frete calculado, e são encontradas por colecionadores da sua cidade. Você monta sua loja online e a Bynx traz o cliente.',
  },
  {
    q: 'Consigo vender cartas online pela Bynx?',
    a: 'Sim. Você anuncia suas cartas e produtos, o cliente compra pelo checkout com cartão ou Pix, escolhe o frete pelo CEP e o dinheiro cai direto na sua conta via repasse automático. Disponível inclusive no plano Básico.',
  },
  {
    q: 'Preciso de CNPJ pra cadastrar minha loja?',
    a: 'Pra listar sua loja, não. Pra ativar recebimentos e vender com checkout, você cadastra seus dados (CPF ou CNPJ) direto no nosso parceiro de pagamento — a Bynx nunca vê seus dados bancários.',
  },
  {
    q: 'Quanto custa? Tem taxa por venda?',
    a: 'Cadastrar e vender é grátis no plano Básico. Pro custa R$ 39/mês e Premium R$ 89/mês, ampliando sua exposição. Nas vendas com checkout há uma taxa por transação, e o frete vai 100% pra você.',
  },
  {
    q: 'Como o cliente da minha cidade me encontra?',
    a: 'O colecionador filtra o guia de lojas por estado, cidade e especialidade. Sua loja aparece pra quem é da sua região e procura o que você vende, com endereço e link pro Google Maps.',
  },
  {
    q: 'Qual a diferença entre Pro e Premium?',
    a: 'Pro te tira do Básico: até 5 fotos, redes sociais, especialidades ilimitadas, badge e prioridade na lista. Premium adiciona 10 fotos, eventos e torneios, card maior, rotação no topo, analytics completo e SEO por loja.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim, sem fidelidade e sem multa. Você volta pro plano Básico e sua loja continua no ar.',
  },
]

const SIGNUP = '?auth=signup&next=/minha-loja/nova'
const CHECK = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M16.5 6.5L8 15l-4.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

async function getData(): Promise<{ lojas: number; marquee: string[] }> {
  const sb = getServiceSupabase()
  let lojas = 5
  let marquee = FALLBACK_MARQUEE
  if (sb) {
    try {
      const [{ count }, { data }] = await Promise.all([
        sb.from('lojas').select('id', { count: 'exact', head: true }).eq('status', 'ativa'),
        sb.from('pokemon_cards').select('image_small')
          .ilike('image_small', 'https://images.pokemontcg.io/%')
          .gt('preco_medio', 0)
          .order('preco_medio', { ascending: false })
          .limit(22),
      ])
      if (typeof count === 'number' && count > 0) lojas = count
      const urls = (data || []).map(d => d.image_small).filter(Boolean) as string[]
      if (urls.length >= 8) marquee = urls
    } catch {
      // mantem fallback
    }
  }
  return { lojas, marquee }
}

// ─── JSON-LD (SEO + GEO) ──────────────────────────────────────────────────────

function jsonLd() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Bynx para Lojistas',
      serviceType: 'Plataforma de vendas para lojas de Pokémon TCG',
      provider: { '@type': 'Organization', name: 'Bynx', url: 'https://bynx.gg' },
      areaServed: { '@type': 'Country', name: 'Brasil' },
      url: 'https://bynx.gg/para-lojistas',
      description:
        'Crie sua loja Pokémon TCG na Bynx: vitrine de cartas e produtos, checkout com frete calculado e exposição pra colecionadores da sua cidade.',
      offers: [
        { '@type': 'Offer', name: 'Básico', price: '0', priceCurrency: 'BRL' },
        { '@type': 'Offer', name: 'Pro', price: '39', priceCurrency: 'BRL' },
        { '@type': 'Offer', name: 'Premium', price: '89', priceCurrency: 'BRL' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Bynx', item: 'https://bynx.gg' },
        { '@type': 'ListItem', position: 2, name: 'Para Lojistas', item: 'https://bynx.gg/para-lojistas' },
      ],
    },
  ]
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function ParaLojistasPage() {
  const { lojas, marquee } = await getData()

  return (
    <div className="pl-root">
      <style>{CSS}</style>
      <noscript><style>{'.pl-root .reveal{opacity:1!important;transform:none!important}'}</style></noscript>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }} />

      <PublicHeader />

      <main className="plmain">
        {/* HERO */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="reveal">
              <h1 className="h1">Sua loja Pokémon <span className="grad">completa, online</span>. E o cliente já vem decidido.</h1>
              <p className="lead">Vitrine de cartas e produtos, checkout com frete e o cliente que a Bynx traz pra você. <b>Você só fecha a venda.</b></p>
              <div className="ctas">
                <Link href={SIGNUP} className="btn-primary">Criar minha loja grátis</Link>
                <a href="#vende" className="btn-ghost">Ver como funciona →</a>
              </div>
              <div className="trust">
                <span className="ck">{CHECK}</span>
                <span><b>Grátis pra começar</b> · 14 dias de Pro no trial · sem cartão</span>
              </div>
            </div>

            <div className="reveal">
              <div className="stage">
                {HERO_FLOAT.map(c => (
                  <div key={c.c} className={`fcard ${c.c}`}>
                    <img src={IMG(c.img)} alt={c.alt} loading="eager" />
                  </div>
                ))}
                <div className="storecard">
                  <div className="sc-head">
                    <div className="sc-logo">M</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="sc-name">
                        Mestre dos Baralhos
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path d="M10 2l2.4 2.8 3.6-.4.4 3.6L19 10l-2.6 2 .4 3.6-3.6.4L10 19l-2.4-2.8-3.6.4-.4-3.6L1 10l2.6-2L3.2 4.4 6.8 4 10 1z" fill="var(--ac-1)" />
                          <path d="M6 10l2.5 2.5L14 7" stroke="#0d0f14" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="sc-meta">São Paulo, SP</div>
                    </div>
                    <span className="sc-badge">Premium</span>
                  </div>
                  <div className="sc-cards">
                    {STORE_MINI.map(id => (
                      <div key={id} className="mc"><img src={IMG(id)} alt="" loading="lazy" /></div>
                    ))}
                  </div>
                  <div className="sc-row"><span className="stars">★★★★★</span><span><b style={{ color: '#f0f0f0' }}>4,9</b> · compra verificada</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MARQUEE */}
        <div className="wrap">
          <div className="marquee reveal">
            <div className="track">
              {[...marquee, ...marquee].map((src, i) => (
                <div key={i} className="mq"><img src={src} alt="" loading="lazy" /></div>
              ))}
            </div>
          </div>
        </div>

        {/* METRICS */}
        <section className="metrics-sec">
          <div className="wrap">
            <div className="metrics reveal">
              <div className="metric"><div className="m-val" data-target="70000" data-suffix="+">70 mil+</div><div className="m-lab">Cartas Pokémon catalogadas</div></div>
              <div className="metric"><div className="m-val" data-target="249" data-suffix="">249</div><div className="m-lab">Coleções (sets) cobertas</div></div>
              <div className="metric"><div className="m-val" data-target="1025" data-suffix="">1.025</div><div className="m-lab">Pokémon no hub de busca</div></div>
              <div className="metric"><div className="m-val" data-target={String(lojas)} data-suffix="">{lojas}</div><div className="m-lab"><span className="m-live">lojas ativas agora</span></div></div>
            </div>
          </div>
        </section>

        {/* TRAZ CLIENTE */}
        <section id="traz" className="sec-dark">
          <div className="wrap">
            <div className="reveal">
              <span className="eyebrow">Marketing + Geolocalização</span>
              <h2 className="sec-title">Você para de brigar por tráfego. O cliente já chega decidido.</h2>
              <p className="sec-sub">Quem entra na Bynx já quer comprar carta. A gente faz o marketing e coloca a sua loja na frente de quem é da sua região.</p>
            </div>

            <div className="feat">
              <div className="reveal">
                <div className="kicker">Geolocalização</div>
                <h3>Quem é da sua cidade acha você primeiro</h3>
                <p>O colecionador filtra por estado, cidade e especialidade — e cai na sua loja, não numa de outro estado.</p>
              </div>
              <div className="reveal glass">
                <div className="mini-cap">busca: <b>&quot;carta pokémon são paulo&quot;</b></div>
                <div className="geo-hit">
                  <div className="geo-logo">M</div>
                  <div><div className="geo-n">Mestre dos Baralhos</div><div className="geo-m">São Paulo, SP · 4,9 ★</div></div>
                  <span className="geo-tag">SUA LOJA</span>
                </div>
                <div className="geo-miss">
                  <div className="geo-sq" />
                  <div><div className="geo-n">Loja de outro estado</div><div className="geo-m">longe do cliente</div></div>
                </div>
              </div>
            </div>

            <div className="feat rev">
              <div className="reveal">
                <div className="kicker">Marketing feito pra você</div>
                <h3>Até a IA já manda cliente pra Bynx</h3>
                <p>Colecionador pergunta ao ChatGPT &quot;onde compro carta Pokémon no Brasil&quot; — e a Bynx aparece. Você recebe o lead quente, sem gastar em anúncio.</p>
              </div>
              <div className="reveal glass">
                <div className="mini-cap">de onde o cliente vem</div>
                <div className="funnel">
                  <div className="fbar"><span className="fill" style={{ '--w': '100%' } as CSSProperties} /><span className="lab">Google · orgânico</span><span className="num">↑</span></div>
                  <div className="fbar"><span className="fill" style={{ '--w': '64%' } as CSSProperties} /><span className="lab">ChatGPT · busca por IA</span><span className="num">↑</span></div>
                  <div className="fbar"><span className="fill" style={{ '--w': '42%' } as CSSProperties} /><span className="lab">Guia de lojas · geo</span><span className="num">↑</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* VENDE */}
        <section id="vende">
          <div className="wrap">
            <div className="reveal">
              <span className="eyebrow">Vitrine + checkout + frete</span>
              <h2 className="sec-title">Sua vitrine vende sozinha — dentro da Bynx.</h2>
              <p className="sec-sub">Cartas e produtos com foto e preço em reais, compra com checkout, frete calculado e repasse direto pra sua conta.</p>
            </div>

            <div className="feat">
              <div className="reveal">
                <div className="kicker">Vitrine de cartas</div>
                <h3>Seu estoque de singles e graded, à venda</h3>
                <p>Anuncie carta por carta com condição, foto e preço em reais. Quem procura aquela carta específica acha a sua.</p>
              </div>
              <div className="reveal glass">
                <div className="mini-cap">Vitrine da loja</div>
                <div className="vgrid">
                  {VITRINE.map(v => (
                    <div key={v.img} className="vc">
                      <div className="img"><img src={IMG(v.img)} alt={v.n} loading="lazy" /></div>
                      <div className="b"><div className="n">{v.n}</div><div className="cond">{v.cond}</div><div className="p">{v.p}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="feat rev">
              <div className="reveal">
                <div className="kicker">Vitrine de produtos</div>
                <h3>Selado, pelúcia, funko, acessório — tudo junto</h3>
                <p>Cadastre o resto do catálogo com estoque e peso. Tudo vende pelo mesmo checkout.</p>
              </div>
              <div className="reveal glass">
                <div className="prod">
                  <img src={PRODUTO.img} alt={PRODUTO.nome} loading="lazy" />
                  <div style={{ flex: 1 }}>
                    <div className="pn">{PRODUTO.nome}</div>
                    <div className="pt">{PRODUTO.tipo}</div>
                    <div className="pp">{PRODUTO.preco}</div>
                  </div>
                </div>
                <div className="mini-cap" style={{ textAlign: 'center', marginTop: 10 }}>carta + selado no mesmo carrinho</div>
              </div>
            </div>

            <div className="feat">
              <div className="reveal">
                <div className="kicker">Checkout + recebimento</div>
                <h3>Frete calculado e dinheiro na sua conta</h3>
                <p>O cliente escolhe PAC/SEDEX pelo CEP. Você recebe via repasse automático — frete 100% seu.</p>
              </div>
              <div className="reveal glass">
                <div className="mini-cap">Checkout · frete pelo CEP</div>
                <div className="co-opt on"><span className="radio"><i /></span> Correios PAC · 5 dias <span className="pr">R$ 13,20</span></div>
                <div className="co-opt"><span className="radio"><i /></span> Correios SEDEX · 2 dias <span className="pr">R$ 14,15</span></div>
                <div style={{ marginTop: 8 }}>
                  <div className="co-line"><span>Produto</span><span>R$ 249,90</span></div>
                  <div className="co-line"><span>Frete (PAC)</span><span>R$ 13,20</span></div>
                  <div className="co-total"><span>Total</span><b>R$ 263,10</b></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CONTROLE */}
        <section id="controle" className="sec-dark">
          <div className="wrap">
            <div className="reveal">
              <span className="eyebrow">Analytics + Reputação</span>
              <h2 className="sec-title">Você no controle da sua loja.</h2>
            </div>

            <div className="feat">
              <div className="reveal">
                <div className="kicker">Analytics</div>
                <h3>Decida com dado, não com achismo</h3>
                <p>Visitas, contatos e vendas num funil claro. Dispositivo e variação por período.</p>
              </div>
              <div className="reveal glass">
                <div className="mini-cap">Últimos 30 dias</div>
                <div className="funnel">
                  <div className="fbar"><span className="fill" style={{ '--w': '100%' } as CSSProperties} /><span className="lab">Visitas</span><span className="num">1.284</span></div>
                  <div className="fbar"><span className="fill" style={{ '--w': '34%' } as CSSProperties} /><span className="lab">Contatos</span><span className="num">436</span></div>
                  <div className="fbar"><span className="fill" style={{ '--w': '12%' } as CSSProperties} /><span className="lab">Vendas</span><span className="num">152</span></div>
                </div>
              </div>
            </div>

            <div className="feat rev">
              <div className="reveal">
                <div className="kicker">Reputação verificada</div>
                <h3>Prova social que ninguém falsifica</h3>
                <p>Cada venda vira uma avaliação com selo <b style={{ color: '#22c55e' }}>compra verificada</b> — só quem comprou de verdade avalia.</p>
              </div>
              <div className="reveal glass">
                <div className="review">
                  <div className="rv-top">
                    <div className="rv-av">{REVIEW.autor.charAt(0)}</div>
                    <div><div className="rv-name">{REVIEW.autor}</div><div className="stars">★★★★★</div></div>
                    <span className="rv-verif">✓ Compra verificada</span>
                  </div>
                  <div className="rv-txt">&quot;{REVIEW.txt}&quot;</div>
                </div>
                <div className="mini-cap" style={{ textAlign: 'center', marginTop: 9, opacity: 0.7 }}>avaliação real de uma loja Bynx</div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARATIVO */}
        <section>
          <div className="wrap">
            <div className="reveal center">
              <span className="eyebrow">Por que a Bynx</span>
              <h2 className="sec-title center">Bynx vs. vender por conta própria</h2>
            </div>
            <div className="reveal">
              <table className="cmp">
                <thead><tr><th>&nbsp;</th><th>Insta / WhatsApp</th><th>Marketplace genérico</th><th className="byx">Bynx</th></tr></thead>
                <tbody>
                  {[
                    ['Público 100% Pokémon TCG', '—', '—', '✓'],
                    ['Cliente te acha por cidade', '—', 'difícil', '✓'],
                    ['Vitrine de cartas em R$', 'manual', 'genérica', '✓'],
                    ['Checkout + frete calculado', '—', '✓', '✓'],
                    ['Avaliação verificada', '—', '✓', '✓'],
                    ['Analytics da sua loja', '—', 'limitado', '✓'],
                    ['Custo pra começar', '—', 'taxas altas', 'R$ 0'],
                  ].map((r, i) => (
                    <tr key={i}>
                      <td className="fn">{r[0]}</td>
                      <td className={r[1] === '✓' ? 'yes' : 'no'}>{r[1]}</td>
                      <td className={r[2] === '✓' ? 'yes' : 'no'}>{r[2]}</td>
                      <td className="byx yes">{r[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* PLANOS */}
        <section id="planos" className="sec-dark">
          <div className="wrap">
            <div className="reveal center">
              <span className="eyebrow">Planos</span>
              <h2 className="sec-title center">Comece grátis. Cresça no seu ritmo.</h2>
              <p className="sec-sub center">Sem fidelidade, cancele quando quiser.</p>
            </div>
            <div className="plans">
              <div className="plan reveal">
                <div className="pl-name">Básico</div><div className="pl-tag">Pra existir e vender.</div>
                <div className="pl-price">Grátis</div><div className="pl-note">Para sempre</div>
                <ul className="pl-feats">
                  <li><span className="ck">{CHECK}</span>Listagem no guia de lojas</li>
                  <li><span className="ck">{CHECK}</span><b>Vitrine + vendas com checkout</b></li>
                  <li><span className="ck">{CHECK}</span>Página própria + WhatsApp</li>
                  <li><span className="ck">{CHECK}</span>Endereço + Google Maps</li>
                </ul>
                <Link href={SIGNUP} className="pl-cta">Começar grátis</Link>
              </div>
              <div className="plan hi reveal">
                <div className="badge-hi">Recomendado</div>
                <div className="pl-name" style={{ color: 'var(--ac-1)' }}>Pro</div><div className="pl-tag">Pra ser levado a sério.</div>
                <div className="pl-price">R$ 39<span>/mês</span></div><div className="pl-note">ou R$ 390/ano · 2 meses grátis</div>
                <ul className="pl-feats">
                  <li><span className="ck">{CHECK}</span><b>Tudo do Básico, e mais:</b></li>
                  <li><span className="ck">{CHECK}</span>Até <b>5 fotos</b> da loja</li>
                  <li><span className="ck">{CHECK}</span>Redes sociais + site</li>
                  <li><span className="ck">{CHECK}</span>Badge <b>Pro</b> + prioridade</li>
                </ul>
                <Link href={SIGNUP} className="pl-cta prim">Começar 14 dias grátis</Link>
              </div>
              <div className="plan pre reveal">
                <div className="pl-name" style={{ color: 'var(--ac-2)' }}>Premium</div><div className="pl-tag">Pra ser o topo.</div>
                <div className="pl-price">R$ 89<span>/mês</span></div><div className="pl-note">ou R$ 890/ano · 2 meses grátis</div>
                <ul className="pl-feats">
                  <li><span className="ck pre">{CHECK}</span><b>Tudo do Pro, e mais:</b></li>
                  <li><span className="ck pre">{CHECK}</span><b>10 fotos</b> + eventos/torneios</li>
                  <li><span className="ck pre">{CHECK}</span><b>Rotação no topo</b> + card maior</li>
                  <li><span className="ck pre">{CHECK}</span><b>Analytics</b> + SEO por loja</li>
                </ul>
                <Link href={SIGNUP} className="pl-cta">Começar 14 dias grátis</Link>
              </div>
            </div>
            <div className="sell-note reveal">💡 <b>Vender é de todo mundo.</b> Vitrine, checkout e frete liberados até no Básico. Os planos amplificam quem te <b>acha</b>.</div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="reveal center">
              <span className="eyebrow">Perguntas frequentes</span>
              <h2 className="sec-title center">Tudo que você precisa saber.</h2>
            </div>
            <div className="faq reveal">
              {FAQ.map((f, i) => (
                <details key={i} className="qa" open={i === 0}>
                  <summary>{f.q}<span className="plus" /></summary>
                  <div className="ans">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL */}
        <section className="final">
          <div className="wrap reveal">
            <h2>Sua loja Pokémon, no lugar onde o Brasil procura.</h2>
            <p>Monte a vitrine, ative os recebimentos e comece a vender.</p>
            <div className="ctas" style={{ justifyContent: 'center' }}>
              <Link href={SIGNUP} className="btn-primary">Criar minha loja grátis</Link>
              <Link href="/lojas" className="btn-ghost">Ver uma loja real →</Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
      <ParaLojistasMotion />
    </div>
  )
}

// ─── CSS (escopado em .pl-root) ───────────────────────────────────────────────

const CSS = `
.pl-root{background:#080a0f;color:#f0f0f0;font-family:var(--font-dm-sans,'DM Sans',system-ui,sans-serif);overflow-x:hidden}
.pl-root img{display:block}
.plmain{
  --ac-1:#60a5fa;--ac-2:#a855f7;--ac-1-rgb:96,165,250;--ac-2-rgb:168,85,247;
  --surface:rgba(255,255,255,.03);--surface-2:rgba(255,255,255,.05);
  --border:rgba(255,255,255,.08);--border-2:rgba(255,255,255,.14);
  --text-2:rgba(255,255,255,.60);--text-3:rgba(255,255,255,.42);--faint:rgba(255,255,255,.28);
  --card:#0d0f14;--green:#22c55e;--ac-grad:linear-gradient(135deg,#60a5fa,#a855f7);
}
.pl-root .wrap{max-width:1120px;margin:0 auto;padding:0 24px}
.pl-root .center{text-align:center;margin-left:auto;margin-right:auto}
.pl-root .center.sec-title,.pl-root .center .sec-title,.pl-root .center .sec-sub{margin-left:auto;margin-right:auto}
.pl-root .ck{display:inline-flex;color:var(--ac-1)}
.pl-root .reveal{opacity:0;transform:translateY(18px);transition:opacity .55s ease,transform .55s ease}
.pl-root .reveal.in{opacity:1;transform:none}
.pl-root section{padding:84px 0}
.pl-root .sec-dark{background:linear-gradient(180deg,rgba(255,255,255,.012),transparent)}
.pl-root .eyebrow{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ac-1);margin-bottom:12px}
.pl-root .sec-title{font-size:clamp(26px,4vw,40px);font-weight:800;letter-spacing:-.02em;line-height:1.12;max-width:680px}
.pl-root .sec-sub{font-size:16px;color:var(--text-2);margin-top:12px;max-width:600px}
.pl-root .kicker{font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px}
.pl-root .mini-cap{font-size:11.5px;color:var(--text-3);margin-bottom:10px}
.pl-root .mini-cap b{color:var(--text-2)}
.pl-root .glass{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px}

.pl-root .hero{padding:56px 0 40px;position:relative;overflow:hidden}
.pl-root .hero::before{content:"";position:absolute;inset:0;background:radial-gradient(760px 460px at 82% 14%,rgba(var(--ac-2-rgb),.18),transparent 60%),radial-gradient(680px 400px at 8% 40%,rgba(var(--ac-1-rgb),.12),transparent 55%);pointer-events:none;animation:plpulse 7s ease-in-out infinite}
@keyframes plpulse{0%,100%{opacity:.85}50%{opacity:1}}
.pl-root .hero-grid{display:grid;grid-template-columns:1.02fr .98fr;gap:40px;align-items:center;position:relative}
.pl-root .h1{font-size:clamp(33px,5.2vw,52px);font-weight:800;letter-spacing:-.03em;line-height:1.06}
.pl-root .h1 .grad{background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.pl-root .lead{font-size:clamp(15.5px,2vw,18px);color:var(--text-2);margin-top:18px;max-width:500px}
.pl-root .lead b{color:#f0f0f0}
.pl-root .ctas{display:flex;gap:12px;margin-top:26px;flex-wrap:wrap}
.pl-root .btn-primary{font-size:15px;font-weight:800;padding:14px 24px;border-radius:12px;background:var(--ac-grad);color:#0a0a0a;transition:transform .15s ease,box-shadow .15s ease;text-decoration:none}
.pl-root .btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(var(--ac-2-rgb),.4)}
.pl-root .btn-ghost{font-size:15px;font-weight:600;padding:14px 22px;border-radius:12px;background:var(--surface);border:1px solid var(--border-2);color:#f0f0f0;transition:background .15s ease,transform .15s ease;text-decoration:none}
.pl-root .btn-ghost:hover{background:var(--surface-2);transform:translateY(-2px)}
.pl-root .trust{display:flex;align-items:center;gap:9px;margin-top:20px;font-size:13px;color:var(--text-3)}
.pl-root .trust .ck{color:var(--green)}
.pl-root .trust b{color:#f0f0f0}

.pl-root .stage{position:relative;height:440px}
.pl-root .fcard{position:absolute;border-radius:11px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.08);will-change:transform}
.pl-root .fcard img{width:100%;height:100%;object-fit:cover}
.pl-root .f1{width:150px;top:8%;left:6%;--rot:-9deg;animation:plfloat 6s ease-in-out infinite}
.pl-root .f2{width:172px;top:2%;right:16%;--rot:7deg;animation:plfloat 7.2s ease-in-out infinite .6s;z-index:3}
.pl-root .f3{width:140px;bottom:6%;left:14%;--rot:6deg;animation:plfloat 6.6s ease-in-out infinite .9s;z-index:3}
.pl-root .f4{width:132px;bottom:12%;right:6%;--rot:-8deg;animation:plfloat 7.8s ease-in-out infinite .3s}
@keyframes plfloat{0%,100%{transform:translateY(0) rotate(var(--rot))}50%{transform:translateY(-16px) rotate(var(--rot))}}
.pl-root .storecard{position:absolute;left:50%;top:50%;transform:translate(-50%,-48%);width:280px;background:var(--card);border:1px solid var(--border-2);border-radius:18px;padding:14px;box-shadow:0 30px 80px rgba(0,0,0,.6);z-index:5}
.pl-root .storecard::before{content:"";position:absolute;inset:-1px;border-radius:18px;padding:1px;background:linear-gradient(135deg,rgba(var(--ac-1-rgb),.6),rgba(var(--ac-2-rgb),.6),transparent);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.pl-root .sc-head{display:flex;align-items:center;gap:9px;margin-bottom:11px}
.pl-root .sc-logo{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#1e3a8a,#7c3aed);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px}
.pl-root .sc-name{font-size:13.5px;font-weight:800;display:flex;align-items:center;gap:4px}
.pl-root .sc-meta{font-size:10.5px;color:var(--text-3);margin-top:1px}
.pl-root .sc-badge{margin-left:auto;font-size:9px;font-weight:800;padding:3px 8px;border-radius:999px;background:rgba(var(--ac-2-rgb),.16);color:var(--ac-2);border:1px solid rgba(var(--ac-2-rgb),.35)}
.pl-root .sc-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px}
.pl-root .sc-cards .mc{aspect-ratio:.72;border-radius:6px;overflow:hidden;border:1px solid var(--border)}
.pl-root .sc-cards .mc img{width:100%;height:100%;object-fit:cover}
.pl-root .sc-row{display:flex;align-items:center;gap:7px;font-size:10.5px;color:var(--text-2)}
.pl-root .stars{color:#fbbf24;letter-spacing:.5px}

.pl-root .marquee{overflow:hidden;position:relative;padding:6px 0;-webkit-mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.pl-root .track{display:flex;gap:14px;width:max-content;animation:plscroll 46s linear infinite}
.pl-root .marquee:hover .track{animation-play-state:paused}
@keyframes plscroll{to{transform:translateX(-50%)}}
.pl-root .track .mq{width:118px;flex-shrink:0;border-radius:9px;overflow:hidden;border:1px solid var(--border);box-shadow:0 10px 26px rgba(0,0,0,.4);transition:transform .2s ease}
.pl-root .track .mq:hover{transform:translateY(-6px) scale(1.04)}
.pl-root .track .mq img{width:100%;height:165px;object-fit:cover}

.pl-root .metrics-sec{padding:44px 0 30px}
.pl-root .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;text-align:center}
.pl-root .metric{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px 12px;transition:transform .15s ease,border-color .15s ease,background .15s ease}
.pl-root .metric:hover{transform:translateY(-2px);border-color:var(--border-2);background:var(--surface-2)}
.pl-root .m-val{font-size:clamp(23px,3.4vw,31px);font-weight:800;background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent;font-variant-numeric:tabular-nums}
.pl-root .m-lab{font-size:11.5px;color:var(--text-3);margin-top:6px;line-height:1.35}
.pl-root .m-live{display:inline-flex;align-items:center;gap:5px}
.pl-root .m-live::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--green);animation:plblip 2s infinite}
@keyframes plblip{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 7px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}

.pl-root .feat{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center;margin-top:42px}
.pl-root .feat.rev{direction:rtl}.pl-root .feat.rev>*{direction:ltr}
.pl-root .feat h3{font-size:22px;font-weight:800;letter-spacing:-.01em;margin-bottom:10px}
.pl-root .feat p{font-size:15px;color:var(--text-2)}

.pl-root .geo-hit{display:flex;align-items:center;gap:10px;background:rgba(var(--ac-2-rgb),.08);border:1px solid rgba(var(--ac-2-rgb),.35);border-radius:10px;padding:10px 12px;margin-bottom:8px}
.pl-root .geo-logo{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#1e3a8a,#7c3aed);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px}
.pl-root .geo-n{font-size:12.5px;font-weight:700}
.pl-root .geo-m{font-size:10.5px;color:var(--text-3)}
.pl-root .geo-tag{margin-left:auto;font-size:9px;font-weight:800;color:var(--ac-2)}
.pl-root .geo-miss{display:flex;align-items:center;gap:10px;opacity:.45;padding:8px 12px}
.pl-root .geo-sq{width:30px;height:30px;border-radius:8px;background:#1a2030}

.pl-root .funnel{display:flex;flex-direction:column;gap:9px}
.pl-root .fbar{position:relative;height:38px;border-radius:9px;background:var(--surface);border:1px solid var(--border);overflow:hidden;display:flex;align-items:center;padding:0 12px}
.pl-root .fbar .fill{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,rgba(var(--ac-1-rgb),.30),rgba(var(--ac-2-rgb),.30));transition:width 1.1s cubic-bezier(.22,.61,.36,1)}
.pl-root .reveal.in .fbar .fill{width:var(--w)}
.pl-root .fbar .lab{position:relative;font-size:12px;font-weight:700}
.pl-root .fbar .num{position:relative;margin-left:auto;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}

.pl-root .vgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.pl-root .vc{background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;transition:transform .15s ease,border-color .15s ease}
.pl-root .vc:hover{transform:translateY(-3px);border-color:rgba(var(--ac-1-rgb),.45)}
.pl-root .vc .img{aspect-ratio:.72;overflow:hidden}
.pl-root .vc .img img{width:100%;height:100%;object-fit:cover}
.pl-root .vc .b{padding:7px 8px}
.pl-root .vc .n{font-size:10.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-root .vc .p{font-size:11.5px;font-weight:800;color:var(--green);margin-top:2px}
.pl-root .vc .cond{font-size:8.5px;color:var(--text-3)}

.pl-root .prod{display:flex;gap:12px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:11px}
.pl-root .prod img{width:78px;height:78px;object-fit:cover;border-radius:9px;flex-shrink:0}
.pl-root .prod .pn{font-size:13px;font-weight:700;line-height:1.3}
.pl-root .prod .pt{font-size:10.5px;color:var(--text-3);margin-top:3px}
.pl-root .prod .pp{font-size:15px;font-weight:800;color:var(--green);margin-top:6px}

.pl-root .co-opt{display:flex;align-items:center;gap:9px;border:1px solid var(--border);border-radius:10px;padding:9px 11px;margin-bottom:7px;font-size:12.5px}
.pl-root .co-opt.on{border-color:rgba(var(--ac-2-rgb),.5);background:rgba(var(--ac-2-rgb),.08)}
.pl-root .radio{width:15px;height:15px;border-radius:50%;border:2px solid var(--faint);flex-shrink:0;display:flex;align-items:center;justify-content:center}
.pl-root .co-opt.on .radio{border-color:var(--ac-2)}
.pl-root .radio i{width:7px;height:7px;border-radius:50%;background:var(--ac-2);display:none}
.pl-root .co-opt.on .radio i{display:block}
.pl-root .co-opt .pr{margin-left:auto;font-weight:800}
.pl-root .co-line{display:flex;justify-content:space-between;font-size:12.5px;padding:6px 0;color:var(--text-2)}
.pl-root .co-total{display:flex;justify-content:space-between;font-size:14.5px;font-weight:800;border-top:1px solid var(--border);margin-top:4px;padding-top:9px}
.pl-root .co-total b{color:var(--green)}

.pl-root .review{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:15px}
.pl-root .rv-top{display:flex;align-items:center;gap:9px;margin-bottom:9px}
.pl-root .rv-av{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#a855f7);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px}
.pl-root .rv-name{font-size:13px;font-weight:700}
.pl-root .rv-verif{font-size:10px;font-weight:800;color:var(--green);background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.28);padding:3px 8px;border-radius:999px;margin-left:auto}
.pl-root .rv-txt{font-size:13.5px;color:#f0f0f0}

.pl-root .cmp{width:100%;border-collapse:separate;border-spacing:0;margin-top:40px;font-size:14px;border:1px solid var(--border);border-radius:14px;overflow:hidden}
.pl-root .cmp th,.pl-root .cmp td{padding:13px 16px;text-align:left;border-bottom:1px solid var(--border)}
.pl-root .cmp thead th{font-size:12.5px;color:var(--text-3);font-weight:700;background:var(--surface)}
.pl-root .cmp thead th.byx{background:rgba(var(--ac-2-rgb),.10);color:var(--ac-1)}
.pl-root .cmp td.byx{background:rgba(var(--ac-2-rgb),.05)}
.pl-root .cmp tr:last-child td{border-bottom:none}
.pl-root .cmp .fn{color:var(--text-2);font-weight:600}
.pl-root .yes{color:var(--green);font-weight:800}.pl-root .no{color:var(--faint)}

.pl-root .plans{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:44px;align-items:start}
.pl-root .plan{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:24px;position:relative;transition:transform .15s ease}
.pl-root .plan:hover{transform:translateY(-3px)}
.pl-root .plan.hi{border-color:rgba(var(--ac-1-rgb),.5);box-shadow:0 0 0 1px rgba(var(--ac-1-rgb),.2),0 20px 60px rgba(var(--ac-1-rgb),.12)}
.pl-root .plan.pre{border-color:rgba(var(--ac-2-rgb),.4)}
.pl-root .plan.pre .ck{color:var(--ac-2)}
.pl-root .badge-hi{position:absolute;top:-11px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:800;padding:5px 14px;border-radius:999px;background:var(--ac-grad);color:#0a0a0a}
.pl-root .pl-name{font-size:18px;font-weight:800}
.pl-root .pl-tag{font-size:12.5px;color:var(--text-3);margin-top:3px}
.pl-root .pl-price{font-size:33px;font-weight:800;margin:15px 0 3px}
.pl-root .pl-price span{font-size:15px;font-weight:600;color:var(--text-3)}
.pl-root .pl-note{font-size:11.5px;color:var(--text-3);margin-bottom:16px}
.pl-root .pl-feats{list-style:none;padding:0;margin:0 0 20px;display:flex;flex-direction:column;gap:8px}
.pl-root .pl-feats li{display:flex;gap:8px;font-size:13px;color:var(--text-2)}
.pl-root .pl-feats li b{color:#f0f0f0}
.pl-root .pl-cta{display:block;text-align:center;font-size:14px;font-weight:800;padding:12px;border-radius:11px;background:var(--surface);border:1px solid var(--border-2);color:#f0f0f0;transition:background .15s ease;text-decoration:none}
.pl-root .pl-cta:hover{background:var(--surface-2)}
.pl-root .pl-cta.prim{background:var(--ac-grad);color:#0a0a0a;border:none}
.pl-root .sell-note{text-align:center;font-size:13px;color:var(--text-2);margin-top:24px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;max-width:640px;margin-left:auto;margin-right:auto}
.pl-root .sell-note b{color:var(--ac-1)}

.pl-root .faq{max-width:800px;margin:38px auto 0}
.pl-root .qa{border-bottom:1px solid var(--border)}
.pl-root .qa summary{list-style:none;cursor:pointer;padding:17px 0;font-size:15.5px;font-weight:700;display:flex;justify-content:space-between;gap:16px;align-items:center}
.pl-root .qa summary::-webkit-details-marker{display:none}
.pl-root .qa summary .plus{flex-shrink:0;width:20px;height:20px;position:relative;transition:transform .2s ease}
.pl-root .qa[open] summary .plus{transform:rotate(45deg)}
.pl-root .qa summary .plus::before,.pl-root .qa summary .plus::after{content:"";position:absolute;background:var(--ac-1);left:50%;top:50%;transform:translate(-50%,-50%)}
.pl-root .qa summary .plus::before{width:12px;height:2px}
.pl-root .qa summary .plus::after{width:2px;height:12px}
.pl-root .qa .ans{font-size:14px;color:var(--text-2);padding:0 0 17px;max-width:700px}

.pl-root .final{background:radial-gradient(700px 300px at 50% 0%,rgba(var(--ac-2-rgb),.16),transparent 60%);border-top:1px solid var(--border);text-align:center}
.pl-root .final h2{font-size:clamp(28px,4.5vw,42px);font-weight:800;letter-spacing:-.02em;max-width:640px;margin:0 auto}
.pl-root .final p{font-size:16px;color:var(--text-2);margin:14px auto 28px;max-width:520px}
.pl-root .final .ctas{justify-content:center}

@media(max-width:900px){
  .pl-root .hero-grid{grid-template-columns:1fr;gap:20px}
  .pl-root .stage{height:360px}
  .pl-root .feat,.pl-root .feat.rev{grid-template-columns:1fr;gap:26px;direction:ltr}
  .pl-root .plans{grid-template-columns:1fr;max-width:420px;margin-left:auto;margin-right:auto}
}
@media(max-width:768px){
  .pl-root .wrap{padding:0 16px}
  .pl-root .ctas{flex-direction:column}
  .pl-root .ctas>a{text-align:center}
  .pl-root .metrics{grid-template-columns:1fr 1fr}
  .pl-root .cmp{font-size:12px}
  .pl-root .cmp th,.pl-root .cmp td{padding:10px 9px}
}
@media(prefers-reduced-motion:reduce){
  .pl-root *{animation:none!important}
  .pl-root .reveal{opacity:1;transform:none;transition:none}
  .pl-root .reveal.in .fbar .fill{transition:none}
}
`
