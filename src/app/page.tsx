import Link from 'next/link'
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import HomeSearchBand from '@/components/ui/HomeSearchBand'
import { CardsPlanos, TabelaPlanos } from '@/components/ui/PlanosBlocos'
import { getServiceSupabase } from '@/lib/supabaseServer'
import HomeMotion from './HomeMotion'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Bynx - Quanto vale a sua colecao Pokemon? Preco em reais',
  description:
    'Monte a sua colecao Pokemon, veja o preco de cada carta em reais, acompanhe o mercado ao vivo e compre e venda no marketplace. Gratis pra comecar.',
  openGraph: {
    title: 'Bynx - Quanto vale a sua colecao Pokemon?',
    description:
      'A plataforma brasileira de colecao Pokemon TCG. Preco em reais, mercado ao vivo, Scan, marketplace e Pokedex.',
    url: 'https://bynx.gg',
    type: 'website',
  },
  alternates: { canonical: 'https://bynx.gg' },
}

// ---- assets ----
const IMG = (id: string) => `https://images.pokemontcg.io/${id}.png`
const PROD = 'https://d1i787aglh9bmb.cloudfront.net/assets/img'
const LOGO30 = `${PROD}/me-expansions/thirty/logo/ptbr/logo-no-video.png`

const HERO_FLOAT = ['ex8/107', 'ex6/108']
const HERO_MOCK = [
  { id: 'base1/4', p: 'R$ 249' }, { id: 'swsh7/215', p: 'R$ 189' }, { id: 'ex6/108', p: 'R$ 119' }, { id: 'svp/85', p: 'R$ 89' },
  { id: 'ecard2/149', p: 'R$ 320' }, { id: 'sm8/207', p: 'R$ 640' }, { id: 'ex6/104', p: 'R$ 140' }, { id: 'base4/4', p: 'R$ 210' },
]
const FALLBACK_MARQUEE = [
  'base1/4', 'swsh7/215', 'ex8/107', 'ex6/108', 'ecard2/149', 'sm8/207', 'svp/85',
  'base4/4', 'ecard3/H10', 'ex15/101', 'pop5/17', 'pl4/97', 'swsh7/189', 'dp7/103',
].map(IMG)

const FALLBACK_UP = [
  { name: 'Keldeo-GX', set_name: 'Unified Minds', image_small: IMG('sm11/219'), preco_atual: 83.07, pct: 76.8 },
  { name: 'Lugia-GX', set_name: 'Lost Thunder', image_small: IMG('sm8/207'), preco_atual: 640.32, pct: 72.6 },
  { name: 'Sigilyph', set_name: 'White Flare', image_small: IMG('rsv10pt5/121'), preco_atual: 72.95, pct: 71.8 },
  { name: 'Lilligant', set_name: 'Black Bolt', image_small: IMG('zsv10pt5/92'), preco_atual: 124.77, pct: 66.4 },
]
const FALLBACK_DOWN = [
  { name: 'Klinklang', set_name: 'Black Bolt', image_small: IMG('zsv10pt5/141'), preco_atual: 44.99, pct: -77.5 },
  { name: 'Snorlax', set_name: 'SV Promos', image_small: IMG('svp/51'), preco_atual: 182.98, pct: -73.8 },
  { name: 'Pinsir', set_name: 'Jungle', image_small: IMG('base2/9'), preco_atual: 95, pct: -71.3 },
  { name: 'Pikachu-EX', set_name: 'XY Promos', image_small: IMG('xyp/XY124'), preco_atual: 1039.46, pct: -70.1 },
]

const POKEDEX = [
  { img: 'neo4/107', dex: '006', name: 'Charizard', tp: 'Fogo', tc: '#f97316', cards: 329, faixa: 'R$ 1,99 a R$ 32.944' },
  { img: 'ex6/104', dex: '009', name: 'Blastoise', tp: 'Agua', tc: '#3b82f6', cards: 147, faixa: 'R$ 3,68 a R$ 14.000' },
  { img: 'svp/85', dex: '025', name: 'Pikachu', tp: 'Eletrico', tc: '#eab308', cards: 661, faixa: 'R$ 0,71 a R$ 40.000' },
  { img: 'ex6/108', dex: '094', name: 'Gengar', tp: 'Psiquico', tc: '#a855f7', cards: 171, faixa: 'R$ 0,50 a R$ 11.730' },
  { img: 'sm115/49', dex: '133', name: 'Eevee', tp: 'Incolor', tc: '#a8a29e', cards: 300, faixa: 'R$ 0,55 a R$ 9.500' },
  { img: 'ex7/104', dex: '143', name: 'Snorlax', tp: 'Incolor', tc: '#a8a29e', cards: 158, faixa: 'R$ 0,25 a R$ 3.824' },
  { img: 'neo4/109', dex: '150', name: 'Mewtwo', tp: 'Psiquico', tc: '#a855f7', cards: 278, faixa: 'R$ 1,42 a R$ 70.000' },
  { img: 'pop5/17', dex: '197', name: 'Umbreon', tp: 'Noturno', tc: '#64748b', cards: 160, faixa: 'R$ 2,90 a R$ 39.800' },
  { img: 'ex8/107', dex: '384', name: 'Rayquaza', tp: 'Dragao', tc: '#d97706', cards: 188, faixa: 'R$ 1,00 a R$ 40.000' },
]

const PRODUTOS = [
  { u: `${PROD}/me-expansions/thirty/products/pt-br/forest-packs-premium-binder-collection-large-up-2x.png`, l: 'Fichario Premium', t: '30 anos' },
  { u: `${PROD}/me-expansions/thirty/products/pt-br/forest-packs-booster-bundle-box-large-up-2x.png`, l: 'Booster Bundle', t: '30 anos' },
  { u: `${PROD}/me-expansions/me05/collections/pt-br/me05-etb-ptbr-2x.png`, l: 'Elite Trainer Box', t: 'selado' },
  { u: `${PROD}/me-expansions/me04/collections/pt-br/me04-booster-display-ptbr-2x.png`, l: 'Display de Boosters', t: 'selado' },
  { u: `${PROD}/me-expansions/me05/collections/pt-br/me05-booster-bundle-ptbr-2x.png`, l: 'Booster Bundle', t: 'selado' },
  { u: `${PROD}/me-expansions/me03/collections/pt-br/me03-build-battle-en-2x.png`, l: 'Build and Battle', t: 'selado' },
  { u: `${PROD}/sv-expansions/sv8dot5/collections/pt-br/sv8pt5-atb-ptbr-2x.png`, l: 'Trainer Box', t: 'selado' },
  { u: `${PROD}/me-expansions/me03/collections/pt-br/me03-etb-en-2x.png`, l: 'Elite Trainer Box', t: 'selado' },
  { u: `${PROD}/sv-expansions/sv3dot5/collections/pt-br/P8976_SV03pt5_3D_Booster_Bundle_Outer_Sleeve_PTBR-2x.png`, l: 'Booster Bundle', t: 'selado' },
  { u: `${PROD}/me-expansions/me02/collections/pt-br/me02-etb-ptbr-2x.png`, l: 'Elite Trainer Box', t: 'selado' },
  { u: `${PROD}/me-expansions/me04/collections/pt-br/me04-etb-ptbr-2x.png`, l: 'Elite Trainer Box', t: 'selado' },
  { u: `${PROD}/me-expansions/me02/collections/pt-br/me02-build-battle-ptbr-2x.png`, l: 'Build and Battle', t: 'selado' },
]
const ETB_LOJA = `${PROD}/me-expansions/me05/collections/pt-br/me05-etb-ptbr-2x.png`

const SIGNUP = '?auth=signup'

const FAQ: { q: string; a: string }[] = [
  { q: 'A Bynx e gratis mesmo?', a: 'E. Voce cria a conta, monta a sua colecao, ve o preco em reais e ja entra no marketplace sem pagar nada. O Pro (R$ 29,90/mes) libera o Scan, o historico de preco e os alertas.' },
  { q: 'De onde vem esse preco?', a: 'Do mercado brasileiro, em reais, nao e conversao de dolar. Minimo, medio e maximo por variante, atualizado todo dia. E o motivo da Bynx existir pra quem coleciona no Brasil.' },
  { q: 'Como funciona o Scan?', a: 'Voce aponta a camera na carta e ela entra na colecao com o nome, o set, a variante e o preco. Salva a vida de quem tem colecao grande. Fica no Pro.' },
  { q: 'Da pra vender minhas cartas?', a: 'Da. Voce anuncia no marketplace com preco em reais, o comprador fecha com pagamento e frete calculado pelo CEP, e o dinheiro cai na sua conta.' },
]

type Mover = { name: string; set_name: string; image_small: string; preco_atual: number; pct: number }

const brl = (v: number) => `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
const pctFmt = (n: number) => `${n > 0 ? '+' : ''}${Number(n).toFixed(1).replace('.', ',')}%`

async function getData(): Promise<{ up: Mover[]; down: Mover[]; marquee: string[] }> {
  const sb = getServiceSupabase()
  let up = FALLBACK_UP as Mover[]
  let down = FALLBACK_DOWN as Mover[]
  let marquee = FALLBACK_MARQUEE
  if (sb) {
    try {
      const cols = 'name,set_name,image_small,preco_atual,pct'
      const [u, d, m] = await Promise.all([
        sb.from('mv_price_movers').select(cols).eq('window_days', 30).eq('direction', 'up')
          .ilike('image_small', 'https://images.pokemontcg.io/%').gte('preco_atual', 15)
          .order('pct', { ascending: false }).limit(4),
        sb.from('mv_price_movers').select(cols).eq('window_days', 30).eq('direction', 'down')
          .ilike('image_small', 'https://images.pokemontcg.io/%').gte('preco_atual', 15)
          .order('pct', { ascending: true }).limit(4),
        sb.from('pokemon_cards').select('image_small')
          .ilike('image_small', 'https://images.pokemontcg.io/%').gt('preco_medio', 0)
          .order('preco_medio', { ascending: false }).limit(18),
      ])
      if (u.data && u.data.length) up = u.data as Mover[]
      if (d.data && d.data.length) down = d.data as Mover[]
      const urls = (m.data || []).map(x => x.image_small).filter(Boolean) as string[]
      if (urls.length >= 8) marquee = urls
    } catch {
      // mantem fallback
    }
  }
  return { up, down, marquee }
}

function jsonLd() {
  return [
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'Bynx', url: 'https://bynx.gg',
      description: 'Plataforma brasileira de colecao Pokemon TCG com preco em reais, mercado ao vivo, Scan e marketplace.' },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Bynx', url: 'https://bynx.gg',
      potentialAction: { '@type': 'SearchAction', target: 'https://bynx.gg/busca?q={search_term_string}', 'query-input': 'required name=search_term_string' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ]
}

// ---- icones outline (sem emoji) ----
const IcArrow = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>)
const IcCheck = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M5 12l4.5 4.5L19 7" /></svg>)
const IcWallet = () => (<svg className="ico" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><circle cx="17" cy="14" r="1.2" /></svg>)
const IcBell = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>)
const IcUp = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" /></svg>)
const IcDown = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M3 7l6 6 4-4 8 8" /><path d="M17 17h4v-4" /></svg>)
const IcScan = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M4 8V6a2 2 0 0 1 2-2h2" /><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M20 16v2a2 2 0 0 1-2 2h-2" /><path d="M8 20H6a2 2 0 0 1-2-2v-2" /><rect x="8.5" y="9.5" width="7" height="5" rx="1" /></svg>)
const IcChart = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 15l3-4 3 2 4-6" /></svg>)
const IcHistory = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /><path d="M12 8v4l3 2" /></svg>)
const IcBag = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M6 7h12l-1 13H7z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg>)
const IcBall = () => (<svg className="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h6" /><path d="M15 12h6" /><circle cx="12" cy="12" r="2.5" /></svg>)
const IcPin = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>)
const IcStar = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M12 3l2.6 5.8 6.4.6-4.8 4.2 1.4 6.2L12 17l-5.6 2.9 1.4-6.2L3 9.4l6.4-.6z" /></svg>)
const IcShield = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" /></svg>)
const IcCard = () => (<svg className="ico" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M8 9h8" /><path d="M8 13h5" /></svg>)
const IcStore = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M4 9l1-5h14l1 5" /><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" /><path d="M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" /></svg>)
const IcPlus = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M12 5v14" /><path d="M5 12h14" /></svg>)
const IcVerif = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M12 3l2 2.3 3-.3.3 3L20 12l-1.7 1.7.3 3-3 .3L12 20l-2-2.3-3 .3-.3-3L5 12l2.3-2-.3-3 3 .3z" /><path d="M9.3 12l2 2 3.4-3.5" stroke="#0d0f14" strokeWidth={1.6} /></svg>)
const IcClose = () => (<svg className="ico" viewBox="0 0 24 24"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>)

export default async function HomePage() {
  const { up, down, marquee } = await getData()
  const marqueeAll = [...marquee, ...marquee]

  return (
    <div className="hm-root">
      <style>{CSS}</style>
      <noscript><style>{'.hm-root .reveal{opacity:1!important;transform:none!important}'}</style></noscript>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }} />

      <PublicHeader />

      <main className="hmmain">
        {/* HERO */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="reveal">
              <h1 className="h1">Quanto vale a sua <span className="grad">colecao Pokemon?</span></h1>
              <p className="lead">Sabe aquela caixa com as suas cartas? Ela tem um valor de mercado. A gente te mostra qual, <b>carta por carta, em reais</b>.</p>
              <div className="ctas">
                <Link href={SIGNUP} className="btn-primary">Ver minha colecao <IcArrow /></Link>
                <a href="#live" className="btn-ghost">Ver o mercado ao vivo</a>
              </div>
              <div className="hero-trust">
                <span><span className="dot-g" /> Gratis pra comecar</span><span>·</span>
                <span><b>70 mil+</b> cartas com preco</span><span>·</span><span>sem cartao</span>
              </div>
            </div>
            <div className="reveal">
              <div className="stage">
                {HERO_FLOAT.map((id, i) => (<div key={id} className={`fcard fc${i + 1}`}><img src={IMG(id)} alt="" /></div>))}
                <div className="appmock">
                  <div className="am-top"><span className="am-logo">BYNX</span><span className="am-bell"><IcBell /></span></div>
                  <div className="am-patr">
                    <div className="am-plabel"><IcWallet /> Patrimonio da colecao</div>
                    <div className="am-pval" data-money="12509">R$ 0</div>
                    <div className="am-ptrend"><IcUp /> R$ 842 este mes · +7,2%</div>
                  </div>
                  <div className="am-grid">
                    {HERO_MOCK.map(c => (<div key={c.id} className="am-cc"><img src={IMG(c.id)} alt="" /><span className="pz">{c.p}</span></div>))}
                  </div>
                  <div className="am-scan"><IcScan /> Escanear carta</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SEARCH BAND (componente real) */}
        <div className="wrap"><div className="reveal"><HomeSearchBand /></div></div>

        {/* LIVE DASHBOARD */}
        <section id="live">
          <div className="wrap">
            <div className="live-head reveal">
              <div>
                <span className="eyebrow"><IcChart /> Dados ao vivo, em reais</span>
                <h2 className="sec-title">O mercado de carta se mexe todo dia. A gente mostra pra onde.</h2>
              </div>
              <span className="live-badge"><span className="d" /> atualizado agora</span>
            </div>
            <div className="board reveal">
              <div className="bcol up">
                <div className="bcol-head"><IcUp /> Maiores altas · 30 dias</div>
                {up.map((m, i) => (
                  <div key={i} className="mrow">
                    <img src={m.image_small} alt="" />
                    <div style={{ minWidth: 0 }}><div className="nm">{m.name}</div><div className="st">{m.set_name}</div></div>
                    <div className="rt"><div className="pr">{brl(m.preco_atual)}</div><div className="pc">{pctFmt(m.pct)}</div></div>
                  </div>
                ))}
              </div>
              <div className="bcol down">
                <div className="bcol-head"><IcDown /> Maiores quedas · 30 dias</div>
                {down.map((m, i) => (
                  <div key={i} className="mrow">
                    <img src={m.image_small} alt="" />
                    <div style={{ minWidth: 0 }}><div className="nm">{m.name}</div><div className="st">{m.set_name}</div></div>
                    <div className="rt"><div className="pr">{brl(m.preco_atual)}</div><div className="pc">{pctFmt(m.pct)}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="live-note">Preco medio de mercado, atualizado todo dia. A sua carta ta aqui dentro.</div>
          </div>
        </section>

        {/* MARQUEE (clicavel -> lightbox) */}
        <div className="wrap"><div className="marquee reveal"><div className="track">
          {marqueeAll.map((src, i) => (<div key={i} className="mq"><img src={src} alt="" loading="lazy" /></div>))}
        </div></div></div>

        {/* SCAN */}
        <section id="scan" className="sec-dark">
          <div className="wrap scan">
            <div className="reveal">
              <span className="eyebrow"><IcScan /> Scan · recurso do Pro</span>
              <h2 className="sec-title">Aponta a camera. A carta entra sozinha.</h2>
              <p className="sec-sub">Colecao grande da preguica de digitar uma por uma. Aponta a camera na carta e ela entra na sua colecao com o nome, a variante e o preco.</p>
              <div className="ctas"><Link href={SIGNUP} className="btn-primary">Ver o Pro <IcArrow /></Link></div>
            </div>
            <div className="reveal">
              <div className="scanner">
                <div className="cam">
                  <span className="corner c-tl" /><span className="corner c-tr" /><span className="corner c-bl" /><span className="corner c-br" />
                  <img className="card-in-cam" src={IMG('base1/4')} alt="carta na camera" />
                  <div className="scanline" />
                </div>
                <div className="toast">
                  <span className="tk"><IcCheck /></span>
                  <span className="tt">Charizard · Base Set · Holo</span>
                  <span className="tp">R$ 249,90</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* METRICS */}
        <section style={{ padding: '48px 0 34px' }}>
          <div className="wrap">
            <div className="metrics reveal">
              <div className="metric"><div className="m-val" data-target="70000" data-suffix="+">70 mil+</div><div className="m-lab">Cartas com preco em reais</div></div>
              <div className="metric"><div className="m-val" data-target="249">249</div><div className="m-lab">Colecoes catalogadas</div></div>
              <div className="metric"><div className="m-val" data-target="1025">1.025</div><div className="m-lab">Pokemon no hub</div></div>
              <div className="metric"><div className="m-val" data-money="125" data-kmi="1">R$ 0</div><div className="m-lab">Em colecoes acompanhadas</div></div>
            </div>
          </div>
        </section>

        {/* HOW */}
        <section>
          <div className="wrap">
            <div className="reveal center"><span className="eyebrow">Como funciona</span><h2 className="sec-title center">Tres passos e voce ja sabe quanto tem.</h2></div>
            <div className="steps">
              <div className="step reveal">
                <div className="step-vis">
                  <div className="sv-row"><img src={IMG('base1/4')} alt="" />Charizard · Base Set<span className="add"><IcPlus /></span></div>
                  <div className="sv-row"><img src={IMG('swsh7/215')} alt="" />Umbreon VMAX<span className="add"><IcPlus /></span></div>
                </div>
                <div className="step-body"><div className="n">01</div><h3>Coloque suas cartas</h3><p>Busca pelo nome ou aponta a camera. A carta certa entra na colecao.</p></div>
              </div>
              <div className="step reveal">
                <div className="step-vis">
                  <div className="sv-var"><span>Normal</span><b>R$ 89,90</b></div>
                  <div className="sv-var hl"><span>Holo</span><b>R$ 249,90</b></div>
                  <div className="sv-var"><span>Reverse</span><b>R$ 134,90</b></div>
                </div>
                <div className="step-body"><div className="n">02</div><h3>Veja o valor em reais</h3><p>Cada variante com o seu preco. Minimo, medio e maximo do mercado.</p></div>
              </div>
              <div className="step reveal">
                <div className="step-vis">
                  <div className="sv-spark"><i style={{ height: '22%' }} /><i style={{ height: '34%' }} /><i style={{ height: '30%' }} /><i style={{ height: '48%' }} /><i style={{ height: '62%' }} /><i style={{ height: '58%' }} /><i style={{ height: '82%' }} /><i style={{ height: '100%' }} /></div>
                  <span className="sv-up"><IcUp /> +7,2% em 30 dias</span>
                </div>
                <div className="step-body"><div className="n">03</div><h3>Decida na hora certa</h3><p>Subiu ou caiu? Voce tem o numero na frente antes de trocar, vender ou comprar.</p></div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="sec-dark">
          <div className="wrap">
            <div className="reveal center"><span className="eyebrow">Recursos</span><h2 className="sec-title center">Tudo em um so lugar.</h2><p className="sec-sub center">Feito por quem coleciona, pra quem coleciona.</p></div>
            <div className="feats">
              <div className="fcell reveal"><div className="fic"><IcWallet /></div><h3>Preco por variante</h3><p>Normal, Holo, Reverse, Foil e Promo. Cada um com o seu preco em reais.</p></div>
              <div className="fcell reveal"><div className="fic"><IcHistory /></div><h3>Historico de preco</h3><p>O grafico da carta nos ultimos meses. Voce ve a curva antes de fechar negocio.</p></div>
              <div className="fcell reveal"><div className="fic"><IcScan /></div><h3>Scan</h3><p>Aponta a camera e a carta entra sozinha. Sem digitar, sem catar link.</p></div>
              <div className="fcell reveal"><div className="fic"><IcBag /></div><h3>Marketplace</h3><p>Compra e vende com colecionador de todo o Brasil. Pagamento e frete por dentro.</p></div>
              <div className="fcell reveal"><div className="fic"><IcBall /></div><h3>Pokedex e hub</h3><p>1.025 Pokemon, cada carta com o preco, cada colecao reunida.</p></div>
              <div className="fcell reveal"><div className="fic"><IcPin /></div><h3>Guia de lojas</h3><p>Lojas de TCG de verdade perto de voce, com endereco e especialidade.</p></div>
            </div>
            <div className="reveal" style={{ textAlign: 'center', marginTop: 34 }}>
              <a href="https://bynx.gg/colecionadores" className="btn-primary">Ver tudo pra colecionador <IcArrow /></a>
            </div>
          </div>
        </section>

        {/* MARKETPLACE */}
        <section id="mkt" className="mkt">
          <div className="wrap mkt-grid">
            <div className="reveal">
              <span className="eyebrow"><IcBag /> Marketplace</span>
              <h2 className="sec-title">A carta que sobra pra voce e a que falta pra outro.</h2>
              <p className="sec-sub">Anuncia o que nao usa, acha o que falta no seu Master Set, e fecha negocio com colecionador de todo o Brasil, com pagamento e frete por dentro da Bynx.</p>
              <div className="mkt-badges">
                <span className="mkt-badge"><IcShield /> Pagamento seguro</span>
                <span className="mkt-badge"><IcBag /> Frete calculado pelo CEP</span>
                <span className="mkt-badge"><IcStar /> Avaliacao verificada</span>
              </div>
              <div className="ctas"><Link href={SIGNUP} className="btn-primary">Entrar no marketplace <IcArrow /></Link></div>
            </div>
            <div className="reveal">
              <div className="storefront">
                <div className="sf-store">
                  <div className="sf-logo">T</div>
                  <div style={{ minWidth: 0 }}><div className="sf-nm">TCG House <span className="sf-verif"><IcVerif /></span></div><div className="sf-meta"><IcPin /> Sao Paulo, SP</div></div>
                  <div className="sf-star"><IcStar /> 4,9</div>
                </div>
                <div className="sf-cards">
                  <div className="sf-c"><div className="img"><img src={IMG('base1/4')} alt="" /></div><div className="b"><div className="n">Charizard</div><div className="p">R$ 249,90</div></div></div>
                  <div className="sf-c"><div className="img"><img src={IMG('swsh7/215')} alt="" /></div><div className="b"><div className="n">Umbreon VMAX</div><div className="p">R$ 189,90</div></div></div>
                  <div className="sf-c prod"><div className="img"><img src={ETB_LOJA} alt="Elite Trainer Box" /></div><div className="b"><div className="n">Elite Trainer Box</div><div className="p">R$ 299,90</div></div></div>
                </div>
                <div className="sf-checkout">
                  <div className="sf-line"><span>Umbreon VMAX</span><span>R$ 189,90</span></div>
                  <div className="sf-line"><span>Frete (PAC, 5 dias)</span><span>R$ 13,20</span></div>
                  <div className="sf-line tot"><span>Total</span><b>R$ 203,10</b></div>
                  <div className="sf-pay"><IcShield /> Pagar com seguranca</div>
                </div>
              </div>
            </div>
          </div>
          <div className="wrap" style={{ marginTop: 46 }}>
            <div className="reveal" style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--text-2)', marginBottom: 18 }}>Nao e so carta. Selado, sleeve, fichario e Elite Trainer Box tambem vendem aqui.</div>
            <div className="marquee reveal"><div className="prodtrack">
              {[...PRODUTOS, ...PRODUTOS].map((p, i) => (<div key={i} className="prodtile"><img loading="lazy" src={p.u} alt={p.l} /><div className="pt-lab">{p.l}</div><div className="pt-tag">{p.t}</div></div>))}
            </div></div>
          </div>
        </section>

        {/* POKEDEX */}
        <section className="sec-dark">
          <div className="wrap">
            <div className="reveal center">
              <span className="eyebrow"><IcBall /> Pokedex e precos</span>
              <h2 className="sec-title center">Todo Pokemon tem uma historia. E um preco.</h2>
              <p className="sec-sub center">Busca qualquer um dos 1.025 e ve todas as cartas dele, de toda colecao, com o valor de cada uma.</p>
            </div>
            <div className="pokedex reveal">
              <img className="pkx-logo" src={LOGO30} alt="30 anos de Pokemon" />
              <div className="pkx-head">
                <span className="pkx-lens" />
                <span className="pkx-lights"><i /><i /><i /></span>
                <span className="pkx-title">POKEDEX NACIONAL · 1.025 registros</span>
              </div>
              <div className="pkx-screen">
                <div className="pkx-grid">
                  {POKEDEX.map(p => (
                    <div key={p.dex} className="pkx-entry" style={{ ['--tc']: p.tc } as CSSProperties}>
                      <img src={IMG(p.img)} alt="" />
                      <div className="pkx-e-info">
                        <div className="pkx-e-top"><span className="pkx-dex">No {p.dex}</span><span className="pkx-type">{p.tp}</span></div>
                        <div className="pkx-e-name">{p.name}</div>
                        <div className="pkx-e-meta">{p.cards} cartas</div>
                        <div className="pkx-e-price"><b>{p.faixa}</b></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="reveal" style={{ textAlign: 'center', marginTop: 34 }}>
              <a href="https://bynx.gg/pokedex-pokemon-tcg" className="btn-primary">Explorar a Pokedex <IcArrow /></a>
            </div>
          </div>
        </section>

        {/* PRICING (componentes reais) */}
        <section id="planos">
          <div className="wrap">
            <div className="reveal center">
              <span className="eyebrow">Planos</span>
              <h2 className="sec-title center">Comece de graca. Assine quando fizer sentido.</h2>
              <p className="sec-sub center">Sem cartao pra comecar, cancela quando quiser.</p>
            </div>
            <div className="reveal" style={{ marginTop: 40 }}><CardsPlanos ctaHref={SIGNUP} /></div>
            <div className="reveal" style={{ marginTop: 20 }}><TabelaPlanos ctaHref={SIGNUP} /></div>
          </div>
        </section>

        {/* LOJISTA */}
        <section className="lojista-sec sec-dark">
          <div className="wrap">
            <div className="reveal center">
              <span className="eyebrow"><IcStore /> Para lojistas</span>
              <h2 className="sec-title center">Tem loja de card? Ela fica muito maior aqui.</h2>
              <p className="sec-sub center">Monta a vitrine, vende com checkout e frete, e aparece pra colecionador da sua cidade. O cliente ja chega decidido.</p>
            </div>
            <div className="feat" style={{ marginTop: 46 }}>
              <div className="reveal">
                <div className="lj-benefits">
                  <div className="lj-b"><div className="bic"><IcCard /></div><div><b>Vitrine de cartas e produtos</b><span>seu estoque em reais, com foto de verdade</span></div></div>
                  <div className="lj-b"><div className="bic"><IcBag /></div><div><b>Checkout e frete calculado</b><span>o dinheiro cai direto na sua conta</span></div></div>
                  <div className="lj-b"><div className="bic"><IcPin /></div><div><b>Achada por cidade</b><span>quem e da sua regiao te encontra primeiro</span></div></div>
                  <div className="lj-b"><div className="bic"><IcStar /></div><div><b>Avaliacao verificada</b><span>reputacao que ninguem falsifica</span></div></div>
                </div>
                <div className="ctas"><a href="https://bynx.gg/para-lojistas" className="btn-primary">Criar minha loja <IcArrow /></a></div>
              </div>
              <div className="reveal">
                <div className="storefront">
                  <div className="sf-store">
                    <div className="sf-logo">B</div>
                    <div style={{ minWidth: 0 }}><div className="sf-nm">Bynx Cards <span className="sf-verif"><IcVerif /></span></div><div className="sf-meta"><IcPin /> Curitiba, PR</div></div>
                    <div className="sf-star"><IcStar /> 5,0</div>
                  </div>
                  <div className="sf-cards">
                    <div className="sf-c"><div className="img"><img src={IMG('base1/4')} alt="" /></div><div className="b"><div className="n">Charizard</div><div className="p">R$ 249,90</div></div></div>
                    <div className="sf-c"><div className="img"><img src={IMG('swsh7/215')} alt="" /></div><div className="b"><div className="n">Umbreon VMAX</div><div className="p">R$ 189,90</div></div></div>
                    <div className="sf-c prod"><div className="img"><img src={ETB_LOJA} alt="Elite Trainer Box" /></div><div className="b"><div className="n">Elite Trainer Box</div><div className="p">R$ 289,90</div></div></div>
                  </div>
                  <div className="sf-checkout">
                    <div className="sf-line"><span>Venda · Umbreon VMAX</span><span>R$ 189,90</span></div>
                    <div className="sf-line"><span>Taxa Bynx</span><span>menos R$ 13,00</span></div>
                    <div className="sf-line tot"><span>Voce recebe</span><b>R$ 176,90</b></div>
                    <div className="sf-pay"><IcWallet /> Repassado pra sua conta</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <div className="wrap">
            <div className="reveal center"><span className="eyebrow">Ainda em duvida?</span><h2 className="sec-title center">O que todo mundo pergunta.</h2></div>
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
            <h2>A sua colecao vale mais do que voce imagina.</h2>
            <p>Cria a conta de graca e ve o valor da sua colecao ainda hoje.</p>
            <div className="ctas">
              <Link href={SIGNUP} className="btn-primary">Criar conta gratis <IcArrow /></Link>
              <a href="#live" className="btn-ghost">Ver o mercado ao vivo</a>
            </div>
          </div>

          {/* lightbox */}
          <div className="cardmodal" id="hm-cardmodal" aria-hidden="true">
            <div className="cm-backdrop" data-close />
            <div className="cm-inner">
              <button className="cm-close" data-close aria-label="Fechar"><IcClose /></button>
              <img id="hm-cmimg" alt="Carta ampliada" />
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
      <HomeMotion />
    </div>
  )
}

const CSS = `.hm-root{background:#080a0f;color:#f0f0f0;font-family:var(--font-dm-sans,'DM Sans',system-ui,sans-serif);overflow-x:hidden}
.hm-root img{display:block}
.hm-root svg{display:block}
.hmmain{
    --bg:#080a0f;--card:#0d0f14;
    --surface:rgba(255,255,255,.03);--surface-2:rgba(255,255,255,.05);
    --border:rgba(255,255,255,.08);--border-2:rgba(255,255,255,.14);
    --text:#f0f0f0;--text-2:rgba(255,255,255,.60);--text-3:rgba(255,255,255,.42);--faint:rgba(255,255,255,.28);
    --ac-1:#f59e0b;--ac-2:#ef4444;--ac-grad:linear-gradient(135deg,#f59e0b,#ef4444);
    --ac-1-rgb:245,158,11;--ac-2-rgb:239,68,68;--green:#22c55e;--red:#f87171;
  }.hm-root *{box-sizing:border-box;margin:0;padding:0}.hm-root html{scroll-behavior:smooth}.hm-root body{background:var(--bg);color:var(--text);font-family:'DM Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.55;overflow-x:hidden}.hm-root a{color:inherit;text-decoration:none}.hm-root img{display:block}.hm-root svg{display:block}.hm-root .wrap{max-width:1120px;margin:0 auto;padding:0 24px}@media(max-width:768px){.hm-root .wrap{padding:0 16px}}.hm-root .ico{width:1em;height:1em;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}.hm-root .nav-links a:hover{color:var(--text)}.hm-root .nav-cta:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(var(--ac-2-rgb),.35)}@media(max-width:820px){}.hm-root .reveal{opacity:0;transform:translateY(18px);transition:opacity .55s ease,transform .55s ease}.hm-root .reveal.in{opacity:1;transform:none}.hm-root section{padding:78px 0}.hm-root .eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ac-1);margin-bottom:12px}.hm-root .eyebrow .ico{width:15px;height:15px}.hm-root .sec-title{font-size:clamp(26px,4vw,40px);font-weight:800;letter-spacing:-.02em;line-height:1.12;max-width:660px}.hm-root .sec-sub{font-size:16px;color:var(--text-2);margin-top:12px;max-width:600px}.hm-root .center{text-align:center;margin-left:auto;margin-right:auto}.hm-root .center .sec-title,.hm-root .center .sec-sub,.hm-root .center .eyebrow{margin-left:auto;margin-right:auto}.hm-root .sec-dark{background:linear-gradient(180deg,rgba(255,255,255,.012),transparent)}.hm-root .btn-primary{display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:800;padding:14px 26px;border-radius:12px;background:var(--ac-grad);color:#0a0a0a;transition:transform .15s ease,box-shadow .15s ease}.hm-root .btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(var(--ac-2-rgb),.4)}.hm-root .btn-primary .ico{width:17px;height:17px;stroke-width:2.2}.hm-root .btn-ghost{display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:600;padding:14px 22px;border-radius:12px;background:var(--surface);border:1px solid var(--border-2);color:var(--text);transition:background .15s ease,transform .15s ease}.hm-root .btn-ghost:hover{background:var(--surface-2);transform:translateY(-2px)}.hm-root .ctas{display:flex;gap:12px;margin-top:26px;flex-wrap:wrap}@media(max-width:768px){.hm-root .ctas{flex-direction:column}.hm-root .ctas>a{justify-content:center}}.hm-root /* HERO */
  .hero{padding:52px 0 40px;position:relative;overflow:hidden}.hm-root .hero::before{content:"";position:absolute;inset:0;background:radial-gradient(720px 440px at 78% 18%,rgba(var(--ac-2-rgb),.16),transparent 60%),radial-gradient(640px 380px at 10% 30%,rgba(var(--ac-1-rgb),.14),transparent 55%);pointer-events:none;animation:hmpulse 7s ease-in-out infinite}@keyframes hmpulse{0%,100%{opacity:.85}50%{opacity:1}}.hm-root .hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center;position:relative}@media(max-width:920px){.hm-root .hero-grid{grid-template-columns:1fr;gap:32px}}.hm-root .pill{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:var(--ac-1);background:rgba(var(--ac-1-rgb),.10);border:1px solid rgba(var(--ac-1-rgb),.28);padding:6px 13px;border-radius:999px;margin-bottom:20px}.hm-root .pill .ico{width:15px;height:15px}.hm-root .h1{font-size:clamp(34px,5.4vw,56px);font-weight:800;letter-spacing:-.03em;line-height:1.04}.hm-root .h1 .grad{background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}.hm-root .lead{font-size:clamp(15.5px,2vw,18px);color:var(--text-2);margin-top:18px;max-width:490px}.hm-root .lead b{color:var(--text)}.hm-root .hero-trust{display:flex;align-items:center;gap:14px;margin-top:22px;font-size:12.5px;color:var(--text-3);flex-wrap:wrap}.hm-root .hero-trust span{display:inline-flex;align-items:center;gap:6px}.hm-root .hero-trust b{color:var(--text)}.hm-root .dot-g{width:7px;height:7px;border-radius:50%;background:var(--green)}.hm-root .stage{position:relative}.hm-root .appmock{position:relative;z-index:4;background:var(--card);border:1px solid var(--border-2);border-radius:20px;padding:16px;box-shadow:0 40px 100px rgba(0,0,0,.6)}.hm-root .appmock::before{content:"";position:absolute;inset:-1px;border-radius:20px;padding:1px;background:linear-gradient(135deg,rgba(var(--ac-1-rgb),.5),rgba(var(--ac-2-rgb),.5),transparent);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}.hm-root .am-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.hm-root .am-logo{font-weight:900;letter-spacing:.12em;font-size:13px;background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}.hm-root .am-bell{width:26px;height:26px;border-radius:8px;background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--text-2)}.hm-root .am-bell .ico{width:15px;height:15px}.hm-root .am-patr{background:linear-gradient(135deg,rgba(var(--ac-1-rgb),.10),rgba(var(--ac-2-rgb),.08));border:1px solid var(--border);border-radius:14px;padding:15px;margin-bottom:12px}.hm-root .am-plabel{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-3);letter-spacing:.04em;text-transform:uppercase;font-weight:700}.hm-root .am-plabel .ico{width:13px;height:13px;color:var(--ac-1)}.hm-root .am-pval{font-size:34px;font-weight:800;letter-spacing:-.02em;margin-top:4px;font-variant-numeric:tabular-nums}.hm-root .am-ptrend{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--green);margin-top:4px}.hm-root .am-ptrend .ico{width:14px;height:14px}.hm-root .am-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:12px}.hm-root .am-cc{aspect-ratio:.72;border-radius:7px;overflow:hidden;border:1px solid var(--border);position:relative}.hm-root .am-cc img{width:100%;height:100%;object-fit:cover}.hm-root .am-cc .pz{position:absolute;left:0;right:0;bottom:0;font-size:8px;font-weight:800;text-align:center;padding:2px;background:linear-gradient(transparent,rgba(0,0,0,.85));color:#fff}.hm-root .am-scan{display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;font-weight:800;padding:11px;border-radius:11px;background:var(--ac-grad);color:#0a0a0a}.hm-root .am-scan .ico{width:16px;height:16px;stroke-width:2.2}.hm-root .fcard{position:absolute;border-radius:11px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.08);z-index:2}.hm-root .fcard img{width:100%;height:100%;object-fit:cover}.hm-root .fc1{width:112px;top:-26px;left:-40px;--rot:-11deg;animation:hmfloat 6.4s ease-in-out infinite}.hm-root .fc2{width:104px;bottom:-30px;right:-34px;--rot:10deg;animation:hmfloat 7.4s ease-in-out infinite .7s}@keyframes hmfloat{0%,100%{transform:translateY(0) rotate(var(--rot))}50%{transform:translateY(-15px) rotate(var(--rot))}}@media(max-width:920px){.hm-root .fc1{left:-14px}.hm-root .fc2{right:-10px}}.hm-root /* SEARCH BAND */
  .searchband{background:var(--card);border:1px solid var(--border-2);border-radius:16px;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.35)}.hm-root /* LIVE DASHBOARD (movers) */
  .live-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}.hm-root .live-badge{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:var(--green);background:rgba(34,197,94,.10);border:1px solid rgba(34,197,94,.28);padding:6px 12px;border-radius:999px}.hm-root .live-badge .d{width:7px;height:7px;border-radius:50%;background:var(--green);animation:hmblip 1.8s infinite}@keyframes hmblip{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 7px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}.hm-root .board{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:26px}@media(max-width:820px){.hm-root .board{grid-template-columns:1fr}}.hm-root .bcol{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px}.hm-root .bcol-head{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;margin-bottom:12px}.hm-root .bcol-head .ico{width:17px;height:17px}.hm-root .bcol.up .bcol-head{color:var(--green)}.hm-root .bcol.down .bcol-head{color:var(--red)}.hm-root .mrow{display:flex;align-items:center;gap:11px;padding:9px 0;border-top:1px solid var(--border)}.hm-root .mrow:first-of-type{border-top:0}.hm-root .mrow img{width:34px;height:47px;object-fit:cover;border-radius:5px;flex-shrink:0;border:1px solid var(--border)}.hm-root .mrow .nm{font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hm-root .mrow .st{font-size:10px;color:var(--text-3)}.hm-root .mrow .rt{margin-left:auto;text-align:right;flex-shrink:0}.hm-root .mrow .pr{font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums}.hm-root .mrow .pc{font-size:11px;font-weight:800}.hm-root .up .pc{color:var(--green)}.hm-root .down .pc{color:var(--red)}.hm-root .live-note{text-align:center;font-size:11.5px;color:var(--faint);margin-top:16px}.hm-root /* SCAN */
  .scan{display:grid;grid-template-columns:.9fr 1.1fr;gap:44px;align-items:center}@media(max-width:920px){.hm-root .scan{grid-template-columns:1fr;gap:28px}}.hm-root .scanner{position:relative;background:var(--card);border:1px solid var(--border-2);border-radius:18px;padding:16px;box-shadow:0 30px 70px rgba(0,0,0,.5)}.hm-root .cam{position:relative;border-radius:13px;overflow:hidden;background:#05070b;aspect-ratio:16/11;display:flex;align-items:center;justify-content:center}.hm-root .cam .card-in-cam{width:118px;border-radius:8px;box-shadow:0 12px 34px rgba(0,0,0,.6);transform:rotate(-4deg)}.hm-root .cam .corner{position:absolute;width:26px;height:26px;border:3px solid rgba(var(--ac-1-rgb),.9)}.hm-root .cam .c-tl{top:14px;left:14px;border-right:0;border-bottom:0;border-radius:6px 0 0 0}.hm-root .cam .c-tr{top:14px;right:14px;border-left:0;border-bottom:0;border-radius:0 6px 0 0}.hm-root .cam .c-bl{bottom:14px;left:14px;border-right:0;border-top:0;border-radius:0 0 0 6px}.hm-root .cam .c-br{bottom:14px;right:14px;border-left:0;border-top:0;border-radius:0 0 6px 0}.hm-root .cam .scanline{position:absolute;left:8%;right:8%;height:3px;background:linear-gradient(90deg,transparent,var(--ac-1),transparent);box-shadow:0 0 16px 3px rgba(var(--ac-1-rgb),.7);animation:hmsweep 2.6s ease-in-out infinite}@keyframes hmsweep{0%{top:16%;opacity:0}12%{opacity:1}88%{opacity:1}100%{top:84%;opacity:0}}.hm-root .toast{display:flex;align-items:center;gap:10px;margin-top:12px;background:rgba(34,197,94,.10);border:1px solid rgba(34,197,94,.3);border-radius:11px;padding:10px 12px;animation:hmpop 2.6s ease-in-out infinite}@keyframes hmpop{0%,40%{opacity:0;transform:translateY(6px)}55%,92%{opacity:1;transform:none}100%{opacity:0}}.hm-root .toast .tk{width:22px;height:22px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;color:#04140a;flex-shrink:0}.hm-root .toast .tk .ico{width:13px;height:13px;stroke-width:2.6}.hm-root .toast .tt{font-size:12.5px;font-weight:700}.hm-root .toast .tp{margin-left:auto;font-size:13px;font-weight:800;color:var(--green)}.hm-root /* metrics */
  .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;text-align:center}@media(max-width:768px){.hm-root .metrics{grid-template-columns:1fr 1fr}}.hm-root .metric{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px 12px;transition:transform .15s ease,border-color .15s ease}.hm-root .metric:hover{transform:translateY(-2px);border-color:var(--border-2)}.hm-root .m-val{font-size:clamp(23px,3.4vw,31px);font-weight:800;background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent;font-variant-numeric:tabular-nums}.hm-root .m-lab{font-size:11.5px;color:var(--text-3);margin-top:6px;line-height:1.35}.hm-root /* marquee */
  .marquee{overflow:hidden;position:relative;padding:6px 0;-webkit-mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}.hm-root .track{display:flex;gap:13px;width:max-content;animation:hmscroll 48s linear infinite}.hm-root .marquee:hover .track{animation-play-state:paused}@keyframes hmscroll{to{transform:translateX(-50%)}}.hm-root .track .mq{width:100px;flex-shrink:0;border-radius:8px;overflow:hidden;border:1px solid var(--border);box-shadow:0 10px 24px rgba(0,0,0,.4);transition:transform .2s ease}.hm-root .track .mq:hover{transform:translateY(-6px) scale(1.05)}.hm-root .track .mq img{width:100%;height:140px;object-fit:cover}.hm-root /* steps */
  .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:44px}@media(max-width:768px){.hm-root .steps{grid-template-columns:1fr}}.hm-root .step{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;transition:transform .15s ease,border-color .15s ease}.hm-root .step:hover{transform:translateY(-3px);border-color:rgba(var(--ac-1-rgb),.4)}.hm-root .step .n{font-size:12px;font-weight:800;color:var(--ac-1);letter-spacing:.1em}.hm-root .step h3{font-size:18px;font-weight:800;margin:10px 0 7px}.hm-root .step p{font-size:13.5px;color:var(--text-2)}.hm-root /* features */
  .feats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:44px}@media(max-width:900px){.hm-root .feats{grid-template-columns:1fr 1fr}}@media(max-width:600px){.hm-root .feats{grid-template-columns:1fr}}.hm-root .fcell{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px;transition:transform .15s ease,border-color .15s ease}.hm-root .fcell:hover{transform:translateY(-3px);border-color:var(--border-2)}.hm-root .fic{width:42px;height:42px;border-radius:11px;background:rgba(var(--ac-1-rgb),.12);border:1px solid rgba(var(--ac-1-rgb),.25);display:flex;align-items:center;justify-content:center;color:var(--ac-1);margin-bottom:13px}.hm-root .fic .ico{width:21px;height:21px}.hm-root .fcell h3{font-size:16px;font-weight:800;margin-bottom:6px}.hm-root .fcell p{font-size:13px;color:var(--text-2)}.hm-root /* MARKETPLACE showcase */
  .mkt{position:relative;overflow:hidden}.hm-root .mkt::before{content:"";position:absolute;inset:0;background:radial-gradient(680px 380px at 85% 30%,rgba(var(--ac-2-rgb),.12),transparent 60%);pointer-events:none}.hm-root .mkt-grid{display:grid;grid-template-columns:1fr 1.15fr;gap:44px;align-items:center;position:relative}@media(max-width:960px){.hm-root .mkt-grid{grid-template-columns:1fr;gap:30px}}.hm-root .mkt-badges{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.hm-root .mkt-badge{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:var(--text-2);background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:7px 13px}.hm-root .mkt-badge .ico{width:15px;height:15px;color:var(--ac-1)}.hm-root .storefront{background:var(--card);border:1px solid var(--border-2);border-radius:20px;padding:16px;box-shadow:0 40px 100px rgba(0,0,0,.55);position:relative}.hm-root .storefront::before{content:"";position:absolute;inset:-1px;border-radius:20px;padding:1px;background:linear-gradient(135deg,rgba(var(--ac-1-rgb),.45),rgba(var(--ac-2-rgb),.45),transparent);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}.hm-root .sf-store{display:flex;align-items:center;gap:11px;padding-bottom:13px;border-bottom:1px solid var(--border);margin-bottom:13px}.hm-root .sf-logo{width:42px;height:42px;border-radius:11px;background:linear-gradient(135deg,#7c2d12,#b91c1c);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px}.hm-root .sf-nm{font-size:14px;font-weight:800;display:flex;align-items:center;gap:5px}.hm-root .sf-verif{color:var(--ac-1)}.hm-root .sf-verif .ico{width:14px;height:14px}.hm-root .sf-meta{font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:5px;margin-top:2px}.hm-root .sf-meta .ico{width:12px;height:12px}.hm-root .sf-star{margin-left:auto;display:flex;align-items:center;gap:4px;font-size:12px;font-weight:800}.hm-root .sf-star .ico{width:14px;height:14px;color:#fbbf24;fill:#fbbf24}.hm-root .sf-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:13px}.hm-root .sf-c{background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden}.hm-root .sf-c .img{aspect-ratio:.72;overflow:hidden}.hm-root .sf-c .img img{width:100%;height:100%;object-fit:cover}.hm-root .sf-c .b{padding:6px 7px}.hm-root .sf-c .n{font-size:9.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hm-root .sf-c .p{font-size:11px;font-weight:800;color:var(--green);margin-top:1px}.hm-root .sf-checkout{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px}.hm-root .sf-line{display:flex;justify-content:space-between;font-size:12px;color:var(--text-2);padding:3px 0}.hm-root .sf-line.tot{font-size:14px;font-weight:800;color:var(--text);border-top:1px solid var(--border);margin-top:6px;padding-top:9px}.hm-root .sf-line.tot b{color:var(--green)}.hm-root .sf-pay{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:11px;font-size:13px;font-weight:800;padding:11px;border-radius:11px;background:var(--ac-grad);color:#0a0a0a}.hm-root .sf-pay .ico{width:16px;height:16px;stroke-width:2.2}.hm-root /* split showcase */
  .feat{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}.hm-root .feat.rev{direction:rtl}.hm-root .feat.rev>*{direction:ltr}@media(max-width:900px){.hm-root .feat,.hm-root .feat.rev{grid-template-columns:1fr;gap:26px;direction:ltr}}.hm-root .feat h3{font-size:22px;font-weight:800;letter-spacing:-.01em;margin-bottom:10px}.hm-root .feat p{font-size:15px;color:var(--text-2);margin-bottom:8px}.hm-root .glass{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px}.hm-root .mini-cap{font-size:11.5px;color:var(--text-3);margin-bottom:10px}.hm-root .pk-search{display:flex;align-items:center;gap:9px;background:var(--surface);border:1px solid var(--border-2);border-radius:11px;padding:11px 14px;font-size:13px;color:var(--text-2)}.hm-root .pk-search .ico{width:16px;height:16px;color:var(--text-3)}.hm-root .pk-res{display:flex;align-items:center;gap:11px;margin-top:11px;background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:11px}.hm-root .pk-res img{width:44px;height:60px;object-fit:cover;border-radius:6px}.hm-root .pk-chip{font-size:10px;font-weight:700;padding:3px 8px;border-radius:999px;background:rgba(var(--ac-1-rgb),.12);color:var(--ac-1);border:1px solid rgba(var(--ac-1-rgb),.25);white-space:nowrap}.hm-root /* pricing */
  .plans{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:44px;max-width:760px;margin-left:auto;margin-right:auto;align-items:start}@media(max-width:768px){.hm-root .plans{grid-template-columns:1fr;max-width:420px}}.hm-root .plan{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:26px;position:relative;transition:transform .15s ease}.hm-root .plan:hover{transform:translateY(-3px)}.hm-root .plan.hi{border-color:rgba(var(--ac-1-rgb),.5);box-shadow:0 0 0 1px rgba(var(--ac-1-rgb),.2),0 20px 60px rgba(var(--ac-1-rgb),.12)}.hm-root .badge-hi{position:absolute;top:-11px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:800;padding:5px 14px;border-radius:999px;background:var(--ac-grad);color:#0a0a0a}.hm-root .pl-name{font-size:19px;font-weight:800}.hm-root .pl-tag{font-size:12.5px;color:var(--text-3);margin-top:3px}.hm-root .pl-price{font-size:34px;font-weight:800;margin:15px 0 3px}.hm-root .pl-price span{font-size:15px;font-weight:600;color:var(--text-3)}.hm-root .pl-note{font-size:11.5px;color:var(--text-3);margin-bottom:18px}.hm-root .pl-feats{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:22px}.hm-root .pl-feats li{display:flex;gap:8px;font-size:13.5px;color:var(--text-2)}.hm-root .pl-feats li b{color:var(--text)}.hm-root .pl-feats li .ico{width:16px;height:16px;color:var(--ac-1);flex-shrink:0;margin-top:2px;stroke-width:2.4}.hm-root .pl-cta{display:block;text-align:center;font-size:14px;font-weight:800;padding:13px;border-radius:11px;background:var(--surface);border:1px solid var(--border-2);color:var(--text);transition:background .15s ease}.hm-root .pl-cta:hover{background:var(--surface-2)}.hm-root .pl-cta.prim{background:var(--ac-grad);color:#0a0a0a;border:none}.hm-root .pl-more{text-align:center;font-size:12.5px;color:var(--text-3);margin-top:16px}.hm-root /* faq */
  .faq{max-width:800px;margin:38px auto 0}.hm-root .qa{border-bottom:1px solid var(--border)}.hm-root .qa summary{list-style:none;cursor:pointer;padding:17px 0;font-size:15.5px;font-weight:700;display:flex;justify-content:space-between;gap:16px;align-items:center}.hm-root .qa summary::-webkit-details-marker{display:none}.hm-root .qa summary .plus{flex-shrink:0;width:20px;height:20px;position:relative;transition:transform .2s ease}.hm-root .qa[open] summary .plus{transform:rotate(45deg)}.hm-root .qa summary .plus::before,.hm-root .qa summary .plus::after{content:"";position:absolute;background:var(--ac-1);left:50%;top:50%;transform:translate(-50%,-50%)}.hm-root .qa summary .plus::before{width:12px;height:2px}.hm-root .qa summary .plus::after{width:2px;height:12px}.hm-root .qa .ans{font-size:14px;color:var(--text-2);padding:0 0 17px;max-width:700px}.hm-root .final{background:radial-gradient(720px 320px at 50% 0%,rgba(var(--ac-2-rgb),.16),transparent 60%);border-top:1px solid var(--border);text-align:center}.hm-root .final h2{font-size:clamp(30px,4.6vw,48px);font-weight:800;letter-spacing:-.03em;max-width:660px;margin:0 auto}.hm-root .final p{font-size:16px;color:var(--text-2);margin:14px auto 28px;max-width:520px}.hm-root .final .ctas{justify-content:center}.hm-root footer{border-top:1px solid var(--border);padding:32px 0;text-align:center;font-size:12.5px;color:var(--text-3)}.hm-root /* how visual */
  .steps{grid-template-columns:repeat(3,1fr)}.hm-root .step{padding:0;overflow:hidden;display:flex;flex-direction:column}.hm-root .step-vis{height:150px;background:linear-gradient(180deg,rgba(var(--ac-1-rgb),.06),transparent);border-bottom:1px solid var(--border);padding:16px;display:flex;flex-direction:column;justify-content:center;gap:8px}.hm-root .step-body{padding:20px}.hm-root .sv-row{display:flex;align-items:center;gap:9px;background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:8px 10px;font-size:11.5px}.hm-root .sv-row img{width:22px;height:30px;object-fit:cover;border-radius:4px}.hm-root .sv-row .add{margin-left:auto;width:20px;height:20px;border-radius:6px;background:var(--ac-grad);color:#0a0a0a;display:flex;align-items:center;justify-content:center;font-weight:900}.hm-root .sv-row .add .ico{width:12px;height:12px;stroke-width:3}.hm-root .sv-var{display:flex;justify-content:space-between;font-size:11px;padding:4px 2px;color:var(--text-2)}.hm-root .sv-var b{color:var(--green);font-weight:800}.hm-root .sv-var.hl{color:var(--text)}.hm-root .sv-spark{display:flex;align-items:flex-end;gap:4px;height:56px}.hm-root .sv-spark i{flex:1;background:linear-gradient(180deg,var(--ac-1),rgba(var(--ac-2-rgb),.5));border-radius:3px 3px 0 0;display:block}.hm-root .sv-up{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;color:var(--green);margin-top:6px}.hm-root .sv-up .ico{width:14px;height:14px}.hm-root /* pokedex grid */
  .poke-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:44px}@media(max-width:820px){.hm-root .poke-grid{grid-template-columns:1fr 1fr}}@media(max-width:520px){.hm-root .poke-grid{grid-template-columns:1fr}}.hm-root .poke{position:relative;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px;display:flex;gap:13px;align-items:center;overflow:hidden;transition:transform .15s ease,border-color .15s ease}.hm-root .poke:hover{transform:translateY(-3px)}.hm-root .poke::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--tc)}.hm-root .poke::after{content:"";position:absolute;right:-40px;top:-40px;width:130px;height:130px;border-radius:50%;background:radial-gradient(circle,var(--tc),transparent 70%);opacity:.16;pointer-events:none}.hm-root .poke img{width:60px;height:84px;object-fit:cover;border-radius:8px;flex-shrink:0;box-shadow:0 8px 22px rgba(0,0,0,.5);position:relative}.hm-root .poke-info{min-width:0;position:relative;z-index:1}.hm-root .poke-name{font-size:15px;font-weight:800;display:flex;align-items:center;gap:7px}.hm-root .poke-dex{font-size:11px;color:var(--text-3);font-weight:700}.hm-root .poke-type{display:inline-block;font-size:10px;font-weight:800;padding:2px 9px;border-radius:999px;color:#0a0a0a;background:var(--tc);margin-top:5px}.hm-root .poke-meta{font-size:11px;color:var(--text-2);margin-top:7px}.hm-root .poke-price{font-size:12.5px;font-weight:800;margin-top:2px}.hm-root .poke-price b{background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}.hm-root /* plans 4 + tabela */
  .plans4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:44px;align-items:start}@media(max-width:960px){.hm-root .plans4{grid-template-columns:1fr 1fr}}@media(max-width:560px){.hm-root .plans4{grid-template-columns:1fr;max-width:400px;margin-left:auto;margin-right:auto}}.hm-root .p4{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;position:relative;transition:transform .15s ease}.hm-root .p4:hover{transform:translateY(-3px)}.hm-root .p4.hi{border-color:rgba(var(--ac-1-rgb),.5);box-shadow:0 0 0 1px rgba(var(--ac-1-rgb),.2),0 18px 50px rgba(var(--ac-1-rgb),.12)}.hm-root .p4-rib{position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:800;padding:4px 12px;border-radius:999px;background:var(--ac-grad);color:#0a0a0a;white-space:nowrap}.hm-root .p4-save{font-size:10px;font-weight:800;color:var(--green);background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.28);border-radius:999px;padding:2px 8px;display:inline-block;margin-bottom:6px}.hm-root .p4-name{font-size:15px;font-weight:800}.hm-root .p4-price{font-size:26px;font-weight:800;margin:8px 0 2px}.hm-root .p4-price span{font-size:13px;font-weight:600;color:var(--text-3)}.hm-root .p4-note{font-size:10.5px;color:var(--text-3);min-height:26px;margin-bottom:12px}.hm-root .p4-feats{list-style:none;display:flex;flex-direction:column;gap:7px;margin-bottom:16px}.hm-root .p4-feats li{display:flex;gap:7px;font-size:12px;color:var(--text-2)}.hm-root .p4-feats li b{color:var(--text)}.hm-root .p4-feats li .ico{width:14px;height:14px;color:var(--ac-1);flex-shrink:0;margin-top:2px;stroke-width:2.6}.hm-root .p4-feats li.pre{color:var(--text-3);font-weight:700}.hm-root .p4-cta{display:block;text-align:center;font-size:13px;font-weight:800;padding:11px;border-radius:10px;background:var(--surface);border:1px solid var(--border-2);color:var(--text);transition:background .15s ease}.hm-root .p4-cta.prim{background:var(--ac-grad);color:#0a0a0a;border:none}.hm-root .cmp{width:100%;border-collapse:separate;border-spacing:0;margin-top:20px;font-size:13px;border:1px solid var(--border);border-radius:14px;overflow:hidden}.hm-root .cmp th,.hm-root .cmp td{padding:11px 12px;text-align:center;border-bottom:1px solid var(--border)}.hm-root .cmp th:first-child,.hm-root .cmp td:first-child{text-align:left;color:var(--text-2);font-weight:600}.hm-root .cmp thead th{font-size:12px;font-weight:800;background:var(--surface)}.hm-root .cmp thead th.hl{background:rgba(var(--ac-1-rgb),.08);color:var(--ac-1)}.hm-root .cmp td.hl{background:rgba(var(--ac-1-rgb),.05)}.hm-root .cmp tr:last-child td{border-bottom:none}.hm-root .cmp .yes{color:var(--green);font-weight:800}.hm-root .cmp .no{color:var(--faint)}@media(max-width:680px){.hm-root .cmp{font-size:11px}.hm-root .cmp th,.hm-root .cmp td{padding:8px 6px}}.hm-root /* lojista band */
  .lojista{background:linear-gradient(135deg,rgba(96,165,250,.10),rgba(168,85,247,.10));border:1px solid rgba(168,85,247,.25);border-radius:20px;padding:28px 30px;display:flex;align-items:center;gap:24px}@media(max-width:768px){.hm-root .lojista{flex-direction:column;text-align:center;gap:16px}}.hm-root .lojista .lj-ic{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#60a5fa,#a855f7);display:flex;align-items:center;justify-content:center;color:#0a0a0a;flex-shrink:0}.hm-root .lojista .lj-ic .ico{width:26px;height:26px;stroke-width:2}.hm-root .lojista h3{font-size:20px;font-weight:800;letter-spacing:-.01em}.hm-root .lojista p{font-size:14px;color:var(--text-2);margin-top:4px}.hm-root .lojista .lj-cta{margin-left:auto;font-size:14px;font-weight:800;padding:13px 22px;border-radius:12px;background:linear-gradient(135deg,#60a5fa,#a855f7);color:#0a0a0a;white-space:nowrap;display:inline-flex;align-items:center;gap:8px}.hm-root .lojista .lj-cta .ico{width:16px;height:16px;stroke-width:2.4}@media(max-width:768px){.hm-root .lojista .lj-cta{margin-left:0}}.hm-root /* features enhance */
  .fic{background:linear-gradient(135deg,rgba(var(--ac-1-rgb),.18),rgba(var(--ac-2-rgb),.10))}.hm-root .fcell{position:relative;overflow:hidden}.hm-root .fcell::after{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:var(--ac-grad);opacity:0;transition:opacity .2s ease}.hm-root .fcell:hover{border-color:rgba(var(--ac-1-rgb),.45)}.hm-root .fcell:hover::after{opacity:1}.hm-root /* POKEDEX device */
  .pokedex{background:linear-gradient(160deg,#e11d2b,#a91320);border:1px solid rgba(0,0,0,.35);border-radius:22px;padding:14px 14px 16px;box-shadow:0 40px 90px rgba(220,38,38,.16),inset 0 1px 0 rgba(255,255,255,.18);margin-top:40px}.hm-root .pkx-head{display:flex;align-items:center;gap:12px;padding:6px 6px 14px}.hm-root .pkx-lens{width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#bfdbfe,#1d4ed8 72%);border:3px solid #f1f5f9;box-shadow:0 0 16px rgba(59,130,246,.7);flex-shrink:0;position:relative}.hm-root .pkx-lens::after{content:"";position:absolute;top:5px;left:6px;width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.9)}.hm-root .pkx-lights{display:flex;gap:6px}.hm-root .pkx-lights i{width:9px;height:9px;border-radius:50%;box-shadow:inset 0 0 2px rgba(0,0,0,.4)}.hm-root .pkx-lights i:nth-child(1){background:#f87171}.hm-root .pkx-lights i:nth-child(2){background:#fbbf24}.hm-root .pkx-lights i:nth-child(3){background:#34d399}.hm-root .pkx-title{font-size:12px;font-weight:800;letter-spacing:.08em;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.35)}.hm-root .pkx-live{margin-left:auto;font-size:10.5px;font-weight:800;color:#fff;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.28);padding:4px 10px;border-radius:999px}@media(max-width:560px){.hm-root .pkx-title{font-size:10px}.hm-root .pkx-live{display:none}}.hm-root .pkx-screen{background:#0a0c11;border-radius:14px;padding:13px;border:1px solid rgba(0,0,0,.5);box-shadow:inset 0 2px 16px rgba(0,0,0,.65)}.hm-root .pkx-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}@media(max-width:820px){.hm-root .pkx-grid{grid-template-columns:1fr 1fr}}@media(max-width:520px){.hm-root .pkx-grid{grid-template-columns:1fr}}.hm-root .pkx-entry{position:relative;display:flex;gap:11px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:10px;overflow:hidden;transition:transform .15s ease,border-color .15s ease}.hm-root .pkx-entry:hover{transform:translateY(-2px);border-color:var(--tc)}.hm-root .pkx-entry::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--tc)}.hm-root .pkx-entry img{width:44px;height:61px;object-fit:cover;border-radius:6px;flex-shrink:0;box-shadow:0 6px 16px rgba(0,0,0,.5)}.hm-root .pkx-e-info{min-width:0}.hm-root .pkx-e-top{display:flex;align-items:center;gap:7px;margin-bottom:2px}.hm-root .pkx-dex{font-size:10px;font-weight:800;color:var(--text-3);letter-spacing:.03em}.hm-root .pkx-type{font-size:9px;font-weight:800;padding:1px 8px;border-radius:999px;color:#0a0a0a;background:var(--tc)}.hm-root .pkx-e-name{font-size:14px;font-weight:800}.hm-root .pkx-e-meta{font-size:10.5px;color:var(--text-3);margin-top:1px}.hm-root .pkx-e-price{font-size:11.5px;font-weight:800;margin-top:3px}.hm-root .pkx-e-price b{background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}.hm-root /* LOJISTA full section */
  .lojista-sec{--ac-1:#60a5fa;--ac-2:#a855f7;--ac-1-rgb:96,165,250;--ac-2-rgb:168,85,247;--ac-grad:linear-gradient(135deg,#60a5fa,#a855f7);position:relative;overflow:hidden}.hm-root .lojista-sec::before{content:"";position:absolute;inset:0;background:radial-gradient(720px 420px at 82% 16%,rgba(var(--ac-2-rgb),.15),transparent 60%),radial-gradient(600px 360px at 12% 74%,rgba(var(--ac-1-rgb),.13),transparent 55%);pointer-events:none}.hm-root .lojista-sec>.wrap{position:relative}.hm-root .lj-benefits{display:flex;flex-direction:column;gap:15px;margin:24px 0 8px}.hm-root .lj-b{display:flex;gap:12px;align-items:flex-start}.hm-root .lj-b .bic{width:40px;height:40px;border-radius:11px;background:rgba(var(--ac-1-rgb),.14);border:1px solid rgba(var(--ac-1-rgb),.30);display:flex;align-items:center;justify-content:center;color:var(--ac-1);flex-shrink:0}.hm-root .lj-b .bic .ico{width:20px;height:20px}.hm-root .lj-b b{font-size:14.5px;font-weight:800;display:block}.hm-root .lj-b span{font-size:12.5px;color:var(--text-3)}.hm-root /* pokedex 30 anos + produtos */
  .pokedex{position:relative}.hm-root .pkx-logo{position:absolute;top:-16px;right:16px;height:46px;width:auto;z-index:3;filter:drop-shadow(0 5px 12px rgba(0,0,0,.55))}@media(max-width:560px){.hm-root .pkx-logo{height:34px;top:-12px;right:12px}}.hm-root .sf-c.prod .img{background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center}.hm-root .sf-c.prod .img img{object-fit:contain;padding:7px;width:100%;height:100%}.hm-root .prodtrack{display:flex;gap:16px;width:max-content;animation:hmscroll 42s linear infinite}.hm-root .marquee:hover .prodtrack{animation-play-state:paused}.hm-root .prodtile{width:158px;flex-shrink:0;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:10px;transition:transform .2s ease}.hm-root .prodtile:hover{transform:translateY(-6px);border-color:var(--border-2)}.hm-root .prodtile img{width:100%;height:148px;object-fit:contain}.hm-root .prodtile .pt-lab{font-size:11.5px;font-weight:700;text-align:center;margin-top:8px}.hm-root .prodtile .pt-tag{font-size:9.5px;color:var(--text-3);text-align:center;margin-top:1px}.hm-root /* card lightbox */
  .track .mq{cursor:pointer}.hm-root .cardmodal{position:fixed;inset:0;z-index:100;display:none;align-items:center;justify-content:center;padding:24px}.hm-root .cardmodal.open{display:flex}.hm-root .cm-backdrop{position:absolute;inset:0;background:rgba(4,6,10,.84);backdrop-filter:blur(6px);animation:hmcmfade .2s ease}@keyframes hmcmfade{from{opacity:0}to{opacity:1}}.hm-root .cm-inner{position:relative;z-index:1;animation:hmcmpop .25s cubic-bezier(.22,.61,.36,1)}@keyframes hmcmpop{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}.hm-root .cm-inner img{max-width:min(90vw,420px);max-height:86vh;border-radius:16px;box-shadow:0 40px 120px rgba(0,0,0,.75);display:block}.hm-root .cm-close{position:absolute;top:-14px;right:-14px;width:38px;height:38px;border-radius:50%;background:var(--card);border:1px solid var(--border-2);color:var(--text);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.5)}.hm-root .cm-close .ico{width:18px;height:18px;stroke-width:2.4}@media(prefers-reduced-motion:reduce){.hm-root *{animation:none!important}.hm-root .reveal{opacity:1;transform:none;transition:none}}`
