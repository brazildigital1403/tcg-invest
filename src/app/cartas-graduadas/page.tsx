import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import MonteSeuSlab from '@/components/colecionadores/MonteSeuSlab'
import SlabArte, { SLAB_ARTE_CSS } from '@/components/graduadas/SlabArte'
import { GRADUADORAS } from '@/lib/graduadoras'
import { buscarGraduadasAVenda } from '@/lib/graduadasAVenda'

/**
 * /cartas-graduadas — guia publico de cartas graduadas (13/09/2026, mockup v2
 * aprovado pelo Du).
 *
 * ★ POR QUE E UM GUIA E NAO UMA VITRINE. Na data havia 7 cartas graduadas nas
 * colecoes e 1 anuncio graduado a venda: uma pagina so de listagem seria rala
 * para o Google. O guia vale sozinho; os anuncios entram como complemento e o
 * bloco some quando nao ha nenhum.
 *
 * ★ A pagina conta pela imagem (pedido do Du: "esta muito texto"). O texto que
 * a busca precisa fica nos titulos, nas descricoes das imagens e no FAQ, que
 * e renderizado no HTML E vira FAQPage com o MESMO array -- corpo e rich
 * result nunca divergem.
 *
 * ★ Nada aqui afirma prazo, preco ou regra interna de graduadora. Nomes de
 * nivel, cores e a lista vem de lib/graduadoras. A quantidade de graduadoras
 * sai do array, nunca cravada.
 *
 * Arte oficial de Pokemon usa <img> como o hub /pokemon: o host nao esta no
 * remotePatterns, e liberar seria mexer em config por tres imagens.
 */

export const revalidate = 3600

const URL_PAGINA = 'https://bynx.gg/cartas-graduadas'
const CARTA = (id: string) => `https://images.pokemontcg.io/${id}.png`
const ARTE = (dex: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dex}.png`
const SIGNUP = '/cartas-graduadas?auth=signup&next=/minha-colecao'
const MARKETPLACE_GRADUADAS = '/marketplace?filtro=graduadas'

const TOTAL = GRADUADORAS.length
const BRASILEIRAS = GRADUADORAS.filter(g => g.pais === 'br')
const INTERNACIONAIS = GRADUADORAS.filter(g => g.pais === 'intl')

const TITULO = 'Cartas Pokémon graduadas: notas, graduadoras e valor'
const DESCRICAO = `O que significa PSA 10, Gem Mint e Black Label, as ${TOTAL} graduadoras aceitas na Bynx e como registrar a sua carta graduada com nota e subnotas.`

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRICAO,
  alternates: { canonical: URL_PAGINA },
  openGraph: {
    title: `${TITULO} | Bynx`,
    description: DESCRICAO,
    url: URL_PAGINA,
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITULO} | Bynx`,
    description: DESCRICAO,
  },
}

// ─── Conteudo ─────────────────────────────────────────────────────────────────

type Exemplo = { g: string; n: number; bl?: boolean; img: string; nome: string }

const HERO: (Exemplo & { cls: string })[] = [
  { cls: 'cg-h1s', g: 'psa', n: 10, img: 'sv3pt5/199', nome: 'Charizard ex · 151' },
  { cls: 'cg-h2s', g: 'bgs', n: 9.5, img: 'neo1/9', nome: 'Lugia · Neo Genesis' },
  { cls: 'cg-h3s', g: 'cgc', n: 10, img: 'swsh7/218', nome: 'Rayquaza VMAX · Evolving Skies' },
  { cls: 'cg-h4s', g: 'capy', n: 9, img: 'ex6/108', nome: 'Gengar ex · FireRed & LeafGreen' },
  { cls: 'cg-h5s', g: 'bgs', n: 10, bl: true, img: 'swsh7/215', nome: 'Umbreon VMAX · Evolving Skies' },
]

const FAIXA: Exemplo[] = [
  { g: 'psa', n: 10, img: 'base1/4', nome: 'Charizard · Base Set' },
  { g: 'mgs', n: 9, img: 'base1/2', nome: 'Blastoise · Base Set' },
  { g: 'bgs', n: 10, bl: true, img: 'swsh12pt5/160', nome: 'Pikachu · Crown Zenith' },
  { g: 'ace', n: 9.5, img: 'base1/10', nome: 'Mewtwo · Base Set' },
  { g: 'tag', n: 8, img: 'neo1/9', nome: 'Lugia · Neo Genesis' },
  { g: 'gba', n: 10, img: 'swsh4/188', nome: 'Pikachu VMAX · Vivid Voltage' },
  { g: 'cgc', n: 9.5, img: 'sv4pt5/234', nome: 'Charizard ex · Paldean Fates' },
  { g: 'tbn', n: 9, img: 'ex6/108', nome: 'Gengar ex · FireRed & LeafGreen' },
  { g: 'ags', n: 10, img: 'swsh7/218', nome: 'Rayquaza VMAX · Evolving Skies' },
  { g: 'capy', n: 9.5, img: 'swsh7/215', nome: 'Umbreon VMAX · Evolving Skies' },
]

const REGUA: [number, string][] = [
  [10, 'nota máxima'],
  [9.5, 'quase perfeita'],
  [9, 'detalhe mínimo'],
  [8, 'entre Near Mint e Mint'],
  [7, 'desgaste leve'],
  [5, 'uso visível'],
]

const FAQ: { q: string; a: string }[] = [
  { q: 'O que significa PSA 10?', a: 'É a nota máxima da PSA. Na Bynx, uma carta PSA 10 aparece como Gem Mint, com brilho na moldura.' },
  { q: 'O que é uma carta graduada?', a: 'É uma carta avaliada por uma empresa especializada, que recebeu uma nota pelo estado de conservação e voltou lacrada em um estojo de acrílico, o slab, com etiqueta e número de certificado.' },
  { q: 'Qual a diferença entre Gem Mint e Pristine?', a: 'Na Bynx, a nota 10 da BGS, da CGC e da AGS aparece como Pristine; nas outras graduadoras, como Gem Mint.' },
  { q: 'O que é Black Label?', a: 'É a etiqueta preta e dourada da BGS para a carta com nota máxima e as quatro subnotas perfeitas.' },
  { q: 'O que são subnotas?', a: 'São as notas separadas de centro, cantos, bordas e superfície que algumas graduadoras dão além da nota geral.' },
  { q: 'Existem graduadoras brasileiras de cartas Pokémon?', a: `Sim. A Bynx aceita ${BRASILEIRAS.length}: ${BRASILEIRAS.map(g => g.curto).join(', ').replace(/, ([^,]*)$/, ' e $1')}.` },
  { q: 'Como cadastrar uma carta graduada na Bynx?', a: 'Ao adicionar a carta à coleção, marque que ela é graduada e escolha a graduadora, a nota, as subnotas, o certificado e o valor da peça.' },
  { q: 'O valor da graduada acompanha o preço da carta crua?', a: 'Não. Carta graduada é outro mercado, então você informa o valor da sua peça.' },
]

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── Pagina ───────────────────────────────────────────────────────────────────

export default async function CartasGraduadasPage() {
  const aVenda = await buscarGraduadasAVenda(8)

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: TITULO,
      description: DESCRICAO,
      url: URL_PAGINA,
      inLanguage: 'pt-BR',
      isPartOf: { '@type': 'WebSite', name: 'Bynx', url: 'https://bynx.gg' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://bynx.gg/' },
        { '@type': 'ListItem', position: 2, name: 'Cartas graduadas', item: URL_PAGINA },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Graduadoras de cartas aceitas na Bynx',
      numberOfItems: TOTAL,
      itemListElement: GRADUADORAS.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.nome })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]

  return (
    <div className="cg">
      <style>{SLAB_ARTE_CSS + CSS}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PublicHeader />

      <main>
        {/* ─── HERO ───────────────────────────────────── */}
        <section className="cg-hero">
          <div className="bx-gutter cg-wrap cg-hero-grid">
            <div>
              <nav className="cg-trilha" aria-label="Trilha">
                <Link href="/">Início</Link><span aria-hidden="true">›</span><span>Cartas graduadas</span>
              </nav>
              <span className="cg-eyebrow"><i />Guia do colecionador</span>
              <h1 className="cg-h1">Cartas Pokémon <span className="cg-grad">graduadas</span></h1>
              <p className="cg-um">Notas, subnotas, Black Label e as graduadoras que a sua coleção aceita.</p>
              <div className="cg-chips">
                <span className="cg-chip"><i>{TOTAL}</i>graduadoras</span>
                <span className="cg-chip"><i>BR</i>{BRASILEIRAS.length} brasileiras</span>
                <span className="cg-chip"><i>BL</i>Black Label</span>
              </div>
              <div className="cg-ctas">
                <Link href={SIGNUP} className="cg-btn cg-btn-p">Cadastrar minha graduada</Link>
                <Link href={MARKETPLACE_GRADUADAS} prefetch={false} className="cg-btn cg-btn-g">Graduadas à venda</Link>
              </div>
            </div>
            <div className="cg-palco" aria-label="Exemplos de cartas graduadas">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="cg-arte" src={ARTE(6)} alt="" width={475} height={475} fetchPriority="high" referrerPolicy="no-referrer" />
              {HERO.map((s, i) => (
                <div key={s.cls} className={`cg-flut ${s.cls}`}>
                  <SlabArte graduadora={s.g} nota={s.n} blackLabel={s.bl} img={CARTA(s.img)} nome={s.nome}
                    sizes="(max-width: 560px) 150px, 230px" priority={i === 0} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FAIXA ROLANDO ─────────────────────────── */}
        <div className="cg-faixa" aria-hidden="true">
          <div className="cg-trilho">
            {[...FAIXA, ...FAIXA].map((s, i) => (
              <div key={i} className="cg-faixa-item">
                <SlabArte graduadora={s.g} nota={s.n} blackLabel={s.bl} img={CARTA(s.img)} nome={s.nome}
                  sizes="130px" mostrarNome={false} altVazio />
              </div>
            ))}
          </div>
        </div>

        {/* ─── O QUE E ───────────────────────────────── */}
        <section className="cg-sec">
          <div className="bx-gutter cg-wrap cg-duas">
            <div>
              <span className="cg-eyebrow"><i />O que é</span>
              <h2 className="cg-h2">Uma carta avaliada, <span className="cg-grad">lacrada e com nota</span></h2>
              <ol className="cg-anat-lista">
                <li><b>1</b><span><strong>Etiqueta</strong> da graduadora</span></li>
                <li><b>2</b><span><strong>Nota</strong> de 1 a 10 e o nível</span></li>
                <li><b>3</b><span><strong>Carta lacrada</strong> no acrílico</span></li>
                <li><b>4</b><span><strong>Certificado</strong> único da peça</span></li>
              </ol>
            </div>
            <div className="cg-anat">
              <div className="cg-anat-slab">
                <SlabArte graduadora="psa" nota={10} img={CARTA('sv4pt5/234')} nome="Charizard ex · Paldean Fates" sizes="300px" />
              </div>
              <span className="cg-pino" style={{ left: '6%', top: '9%' }}>1</span>
              <span className="cg-pino" style={{ right: '6%', top: '9%' }}>2</span>
              <span className="cg-pino" style={{ left: '4%', top: '55%' }}>3</span>
              <span className="cg-pino" style={{ right: '4%', bottom: '10%' }}>4</span>
            </div>
          </div>
        </section>

        {/* ─── NOTAS ─────────────────────────────────── */}
        <section className="cg-sec cg-centro" id="notas">
          <div className="bx-gutter cg-wrap">
            <span className="cg-eyebrow"><i />Notas</span>
            <h2 className="cg-h2">Do <span className="cg-grad">Gem Mint</span> ao Played</h2>
            <p className="cg-um">Cada faixa de nota ganha um nome, o mesmo da moldura na sua coleção.</p>
            <div className="cg-regua">
              {REGUA.map(([n, t], i) => (
                <div key={n} className="cg-degrau" style={{ ['--o' as string]: String(1 - i * 0.15), ['--y' as string]: `${Math.max(0, 22 - i * 7)}px` }}>
                  <div className="cg-degrau-slab">
                    <SlabArte graduadora="psa" nota={n} img={CARTA('base1/58')} nome="Pikachu · Base Set" sizes="150px" mostrarNome={false} altVazio={i > 0} />
                  </div>
                  <span className="cg-barra" />
                  <small>{t}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── SUBNOTAS ──────────────────────────────── */}
        <section className="cg-sec cg-centro" id="subnotas">
          <div className="bx-gutter cg-wrap">
            <span className="cg-eyebrow"><i />Subnotas</span>
            <h2 className="cg-h2">Quatro olhares <span className="cg-grad">sobre a mesma carta</span></h2>
            <div className="cg-subs">
              <div className="cg-sub-lado cg-sub-e">
                <div className="cg-sub-item" style={{ ['--c' as string]: '#fbbf24' }}><i><span /></i><div><b>Centro</b><small>arte alinhada nas margens</small></div></div>
                <div className="cg-sub-item" style={{ ['--c' as string]: '#60a5fa' }}><i><span className="o" /></i><div><b>Cantos</b><small>pontas vivas ou gastas</small></div></div>
              </div>
              <div className="cg-lupa">
                <Image src={CARTA('base1/58')} width={245} height={342} sizes="300px"
                  alt="Pikachu do Base Set com as áreas de centro, cantos, bordas e superfície marcadas" />
                <span className="z-centro" />
                <span className="z-canto" style={{ left: -6, top: -6 }} /><span className="z-canto" style={{ right: -6, top: -6 }} />
                <span className="z-canto" style={{ left: -6, bottom: -6 }} /><span className="z-canto" style={{ right: -6, bottom: -6 }} />
                <span className="z-borda" /><span className="z-borda d" />
                <span className="z-sup" />
              </div>
              <div className="cg-sub-lado">
                <div className="cg-sub-item" style={{ ['--c' as string]: '#34d399' }}><i><span className="l" /></i><div><b>Bordas</b><small>lascas nas laterais</small></div></div>
                <div className="cg-sub-item" style={{ ['--c' as string]: '#f472b6' }}><i><span className="s" /></i><div><b>Superfície</b><small>riscos e brilho</small></div></div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── GRADUADORAS ───────────────────────────── */}
        <section className="cg-sec cg-centro" id="graduadoras">
          <div className="bx-gutter cg-wrap">
            <span className="cg-eyebrow"><i />Graduadoras</span>
            <h2 className="cg-h2">As <span className="cg-grad">{TOTAL} graduadoras</span> aceitas</h2>
            <div className="cg-muro">
              <div className="cg-muro-rot">Internacionais</div>
              {INTERNACIONAIS.map(g => (
                <div key={g.slug} className="cg-etq" style={{ ['--g' as string]: g.cor }} title={g.nome}>
                  <span>Internacional</span><b>{g.curto}</b>
                </div>
              ))}
              <div className="cg-muro-rot">Brasileiras</div>
              {BRASILEIRAS.map(g => (
                <div key={g.slug} className="cg-etq" style={{ ['--g' as string]: g.cor }} title={g.nome}>
                  <span>Brasil</span><b>{g.curto}</b>
                </div>
              ))}
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cg-pika" src={ARTE(25)} alt="" width={210} height={210} loading="lazy" referrerPolicy="no-referrer" />
        </section>

        {/* ─── BLACK LABEL ───────────────────────────── */}
        <section className="cg-sec cg-bl" id="black-label">
          <div className="bx-gutter cg-wrap cg-duas">
            <div>
              <span className="cg-eyebrow cg-eyebrow-ouro"><i />Black Label</span>
              <h2 className="cg-h2">A etiqueta <span className="cg-ouro">preta e dourada</span></h2>
              <p className="cg-um">Na BGS, nota máxima com as quatro subnotas perfeitas. Na sua coleção, moldura própria.</p>
            </div>
            <div className="cg-bl-palco">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="cg-bl-arte" src={ARTE(197)} alt="" width={420} height={420} loading="lazy" referrerPolicy="no-referrer" />
              <div className="cg-bl-slab">
                <SlabArte graduadora="bgs" nota={10} blackLabel img={CARTA('swsh7/215')} nome="Umbreon VMAX · Evolving Skies" sizes="270px" />
              </div>
            </div>
          </div>
        </section>

        {/* ─── CRUA X GRADUADA ───────────────────────── */}
        <section className="cg-sec cg-centro">
          <div className="bx-gutter cg-wrap">
            <span className="cg-eyebrow"><i />Valor</span>
            <h2 className="cg-h2">A mesma carta, <span className="cg-grad">dois mercados</span></h2>
            <div className="cg-cxg">
              <div className="cg-cxg-lado">
                <Image className="cg-crua" src={CARTA('swsh7/218')} width={245} height={342} sizes="190px" alt="Rayquaza VMAX de Evolving Skies, carta crua" />
                <span className="cg-tag cg-tag-m">Preço de mercado em R$</span>
              </div>
              <span className="cg-seta" aria-hidden="true">→</span>
              <div className="cg-cxg-lado">
                <div className="cg-cxg-slab">
                  <SlabArte graduadora="cgc" nota={9.5} img={CARTA('swsh7/218')} nome="Rayquaza VMAX · Evolving Skies" sizes="230px" />
                </div>
                <span className="cg-tag cg-tag-v">Valor da sua peça</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── MONTE O SEU SLAB ──────────────────────── */}
        <section className="cg-sec" id="monte">
          <div className="bx-gutter cg-wrap">
            <MonteSeuSlab />
          </div>
        </section>

        {/* ─── A VENDA ───────────────────────────────── */}
        {aVenda.length > 0 && (
          <section className="cg-sec cg-centro" id="a-venda">
            <div className="bx-gutter cg-wrap">
              <span className="cg-eyebrow"><i />Marketplace</span>
              <h2 className="cg-h2">Graduadas <span className="cg-grad">à venda agora</span></h2>
              <div className="cg-venda">
                {aVenda.map(a => (
                  <Link key={a.id} href={a.slug ? `/anuncio/${a.slug}` : MARKETPLACE_GRADUADAS} prefetch={false} className="cg-vcard">
                    <SlabArte graduadora={a.graduadora} nota={Number(a.nota) || 0} blackLabel={!!a.black_label}
                      img={a.card_image as string} nome={a.card_name} sizes="200px" mostrarNome={false} />
                    <span className="cg-vnome">{a.card_name}</span>
                    <span className="cg-vpreco">{fmtBRL(Number(a.price))}</span>
                  </Link>
                ))}
              </div>
              <Link href={MARKETPLACE_GRADUADAS} prefetch={false} className="cg-btn cg-btn-g" style={{ marginTop: 26 }}>
                Ver todas no Marketplace
              </Link>
            </div>
          </section>
        )}

        {/* ─── FAQ ───────────────────────────────────── */}
        <section className="cg-sec cg-centro" id="perguntas">
          <div className="bx-gutter cg-wrap">
            <span className="cg-eyebrow"><i />Perguntas</span>
            <h2 className="cg-h2">Perguntas frequentes</h2>
            <div className="cg-faq">
              {FAQ.map((f, i) => (
                <details key={f.q} open={i === 0}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

// ─── CSS (escopado em .cg) ────────────────────────────────────────────────────

const CSS = `
.cg{background:var(--bx-bg);color:var(--bx-text);font-family:var(--font-dm-sans,'DM Sans',system-ui,sans-serif);overflow-x:hidden}
.cg-wrap{max-width:1160px;margin:0 auto}
.cg-sec{position:relative;padding:88px 0;border-top:1px solid var(--bx-border);overflow:hidden;scroll-margin-top:64px}
.cg-centro{text-align:center}
.cg-centro .cg-um{margin-left:auto;margin-right:auto}
.cg-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ac-1);margin-bottom:12px}
.cg-eyebrow i{width:6px;height:6px;border-radius:50%;background:var(--ac-1);box-shadow:0 0 10px var(--ac-1)}
.cg-h1{font-size:clamp(40px,6vw,72px);font-weight:900;letter-spacing:-.045em;line-height:.98;margin:0;text-wrap:balance}
.cg-h2{font-size:clamp(28px,3.6vw,42px);font-weight:900;letter-spacing:-.035em;line-height:1.06;margin:0;text-wrap:balance}
.cg-grad{background:var(--bx-brand);-webkit-background-clip:text;background-clip:text;color:transparent}
.cg-um{font-size:16.5px;color:var(--bx-text-2);margin:12px 0 0;max-width:52ch;line-height:1.6}
.cg-btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 22px;border-radius:13px;font-weight:800;font-size:15px;text-decoration:none;transition:transform .15s ease,box-shadow .15s ease}
.cg-btn:hover{transform:translateY(-2px)}
.cg-btn-p{background:var(--bx-brand);color:var(--bx-brand-ink)}
.cg-btn-p:hover{box-shadow:0 12px 30px rgba(239,68,68,.35)}
.cg-btn-g{border:1px solid var(--bx-border-2);color:var(--bx-text);background:var(--bx-surface)}
.cg a:focus-visible,.cg summary:focus-visible{outline:2px solid var(--ac-1);outline-offset:2px}

/* hero */
.cg-hero{position:relative;overflow:hidden}
.cg-hero::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(640px 460px at 76% 45%,rgba(var(--ac-1-rgb),.20),transparent 62%),radial-gradient(520px 360px at 100% 100%,rgba(239,68,68,.14),transparent 60%)}
.cg-hero-grid{position:relative;display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);gap:20px;align-items:center;min-height:620px;padding-top:20px;padding-bottom:20px}
.cg-trilha{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--bx-text-3);margin-bottom:22px}
.cg-trilha a{color:var(--bx-text-2);text-decoration:none;min-height:36px;display:inline-flex;align-items:center}
.cg-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
.cg-chip{display:inline-flex;align-items:center;gap:8px;padding:7px 12px 7px 8px;border-radius:99px;background:var(--bx-surface);border:1px solid var(--bx-border-2);font-size:13px;font-weight:700}
.cg-chip i{min-width:24px;height:22px;padding:0 4px;border-radius:7px;display:flex;align-items:center;justify-content:center;background:rgba(var(--ac-1-rgb),.14);color:var(--ac-1);font-style:normal;font-size:11px;font-weight:900}
.cg-ctas{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px}
.cg-palco{position:relative;height:560px}
.cg-arte{position:absolute;width:390px;height:auto;right:40px;top:10px;opacity:.9;filter:drop-shadow(0 0 40px rgba(var(--ac-1-rgb),.45));animation:cg-flutua 7s ease-in-out infinite}
.cg-flut{position:absolute;animation:cg-flutua 6s ease-in-out infinite}
.cg-h1s{left:14%;top:23%;width:230px;z-index:4;--r:-4deg;animation-delay:.2s}
.cg-h2s{left:0;top:4%;width:170px;z-index:2;--r:-12deg;animation-delay:.9s}
.cg-h3s{right:6%;top:36%;width:190px;z-index:3;--r:9deg;animation-delay:.5s}
.cg-h4s{left:46%;top:58%;width:160px;z-index:5;--r:5deg;animation-delay:1.3s}
.cg-h5s{right:2%;top:0;width:140px;z-index:1;--r:14deg;animation-delay:1.8s}
@keyframes cg-flutua{0%,100%{transform:translateY(0) rotate(var(--r,0deg))}50%{transform:translateY(-14px) rotate(var(--r,0deg))}}

/* faixa */
.cg-faixa{padding:26px 0;border-top:1px solid var(--bx-border);background:rgba(255,255,255,.015);overflow:hidden;-webkit-mask:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);mask:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}
.cg-trilho{display:flex;gap:18px;width:max-content;animation:cg-rola 60s linear infinite}
.cg-faixa-item{width:130px;flex:none}
.cg-faixa-item .sa{padding:6px}
.cg-faixa-item .sa-lab{min-height:36px;padding:4px 7px}
.cg-faixa-item .sa-nota{font-size:17px}
.cg-faixa-item .sa-sig{font-size:11px}
@keyframes cg-rola{to{transform:translateX(-50%)}}

/* o que e */
.cg-duas{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:30px;align-items:center}
.cg-anat-lista{list-style:none;padding:0;margin:24px 0 0;display:grid;gap:14px}
.cg-anat-lista li{display:flex;gap:12px;align-items:center;font-size:15.5px;color:var(--bx-text-2)}
.cg-anat-lista b,.cg-pino{flex:none;width:30px;height:30px;border-radius:50%;background:var(--bx-brand);color:var(--bx-brand-ink);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900}
.cg-anat-lista strong{color:var(--bx-text)}
.cg-anat{position:relative;display:flex;justify-content:center;padding:24px 0}
.cg-anat-slab{width:300px}
.cg-anat-slab .sa-nota{font-size:34px}
.cg-anat-slab .sa-sig{font-size:17px}
.cg-anat-slab .sa-nome{font-size:11px;max-width:170px}
.cg-anat-slab .sa-lab{min-height:62px}
.cg-pino{position:absolute;box-shadow:0 0 0 6px rgba(var(--ac-1-rgb),.18)}

/* notas */
.cg-regua{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;margin-top:40px;align-items:end}
.cg-degrau{display:flex;flex-direction:column;align-items:center;gap:10px}
.cg-degrau-slab{width:100%;transform:translateY(calc(-1 * var(--y)))}
.cg-degrau .sa{padding:6px}
.cg-degrau .sa-lab{min-height:40px;padding:5px 7px}
.cg-degrau .sa-nota{font-size:19px}
.cg-degrau .sa-sig{font-size:11px}
.cg-degrau .sa-tier{font-size:7px}
.cg-barra{width:100%;height:6px;border-radius:9px;background:var(--bx-brand);opacity:var(--o)}
.cg-degrau small{font-size:12.5px;color:var(--bx-text-3);line-height:1.3}

/* subnotas */
.cg-subs{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:26px;align-items:center;margin-top:36px}
.cg-lupa{position:relative;width:300px;border-radius:14px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.6)}
.cg-lupa img{display:block;width:100%;height:auto}
.z-centro{position:absolute;inset:11% 9% 45% 9%;border:2px dashed #fbbf24;border-radius:6px}
.z-canto{position:absolute;width:34px;height:34px;border:3px solid #60a5fa;border-radius:50%}
.z-borda{position:absolute;left:0;top:18%;bottom:18%;width:5px;background:#34d399;box-shadow:0 0 12px #34d399}
.z-borda.d{left:auto;right:0}
.z-sup{position:absolute;inset:0;background:linear-gradient(120deg,transparent 35%,rgba(244,114,182,.35) 50%,transparent 65%)}
.cg-sub-lado{display:grid;gap:18px;text-align:left}
.cg-sub-item{display:flex;gap:12px;align-items:center}
.cg-sub-item i{flex:none;width:44px;height:44px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--c) 16%,transparent);border:1px solid color-mix(in srgb,var(--c) 45%,transparent)}
.cg-sub-item i span{display:block;border:2px dashed var(--c);width:20px;height:22px;border-radius:3px}
.cg-sub-item i span.o{border:3px solid var(--c);border-radius:50%;width:20px;height:20px}
.cg-sub-item i span.l{border:none;width:5px;height:24px;background:var(--c);border-radius:3px}
.cg-sub-item i span.s{border:none;width:24px;height:24px;background:linear-gradient(120deg,transparent 30%,var(--c) 50%,transparent 70%);border-radius:4px}
.cg-sub-item b{display:block;font-size:16px}
.cg-sub-item small{font-size:13px;color:var(--bx-text-3)}
.cg-sub-e{text-align:right}
.cg-sub-e .cg-sub-item{flex-direction:row-reverse}

/* graduadoras */
.cg-muro{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-top:36px;position:relative;z-index:1}
.cg-muro-rot{grid-column:1/-1;display:flex;align-items:center;gap:10px;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--bx-text-3);margin-top:8px;text-align:left}
.cg-muro-rot::after{content:"";flex:1;height:1px;background:var(--bx-border)}
.cg-etq{position:relative;border-radius:14px;padding:16px 14px;background:var(--g);color:#fff;min-height:96px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;box-shadow:0 18px 40px -12px var(--g);overflow:hidden;transition:transform .15s ease}
.cg-etq:hover{transform:translateY(-3px)}
.cg-etq::after{content:"";position:absolute;inset:0;background:linear-gradient(160deg,rgba(255,255,255,.22),transparent 45%)}
.cg-etq b{font-size:24px;font-weight:900;letter-spacing:.02em;position:relative}
.cg-etq span{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.9;position:relative}
.cg-pika{position:absolute;width:210px;height:auto;right:-10px;bottom:-24px;opacity:.9;filter:drop-shadow(0 0 30px rgba(250,204,21,.35))}

/* black label */
.cg-bl{background:radial-gradient(600px 360px at 70% 55%,rgba(232,200,120,.18),transparent 65%),#050505}
.cg-eyebrow-ouro{color:#e8c878}
.cg-eyebrow-ouro i{background:#e8c878;box-shadow:0 0 10px #e8c878}
.cg-ouro{background:linear-gradient(135deg,#f5dc9b,#b8913e);-webkit-background-clip:text;background-clip:text;color:transparent}
.cg-bl-palco{position:relative;display:flex;justify-content:center;align-items:center;height:470px}
.cg-bl-arte{position:absolute;width:420px;height:auto;opacity:.28;filter:grayscale(1) brightness(1.6)}
.cg-bl-slab{position:relative;width:270px}
.cg-bl-slab .sa-nota{font-size:34px}
.cg-bl-slab .sa-sig{font-size:16px}

/* crua x graduada */
.cg-cxg{display:flex;align-items:center;justify-content:center;gap:34px;margin-top:36px;flex-wrap:wrap}
.cg-cxg-lado{display:flex;flex-direction:column;align-items:center;gap:14px}
.cg-crua{width:190px;height:auto;border-radius:10px;box-shadow:0 20px 50px rgba(0,0,0,.55)}
.cg-cxg-slab{width:230px}
.cg-tag{font-size:13px;font-weight:800;padding:7px 14px;border-radius:99px}
.cg-tag-m{background:rgba(34,197,94,.12);color:var(--bx-green);border:1px solid rgba(34,197,94,.3)}
.cg-tag-v{background:rgba(var(--ac-1-rgb),.12);color:var(--ac-1);border:1px solid rgba(var(--ac-1-rgb),.35)}
.cg-seta{font-size:40px;color:var(--bx-text-3)}

/* a venda */
.cg-venda{display:flex;gap:16px;margin-top:30px;justify-content:center;flex-wrap:wrap}
.cg-vcard{width:210px;display:flex;flex-direction:column;gap:4px;background:var(--bx-bg-elev);border:1px solid var(--bx-border);border-radius:16px;padding:12px;text-decoration:none;color:var(--bx-text);text-align:left;transition:transform .15s ease,border-color .15s ease}
.cg-vcard:hover{transform:translateY(-3px);border-color:var(--bx-border-2)}
.cg-vnome{font-size:14px;font-weight:700;margin-top:8px}
.cg-vpreco{font-size:18px;font-weight:900;color:var(--bx-green)}

/* faq */
.cg-faq{max-width:760px;margin:30px auto 0;text-align:left}
.cg-faq details{border-bottom:1px solid var(--bx-border)}
.cg-faq summary{font-weight:700;font-size:16px;cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:12px;align-items:center;min-height:56px}
.cg-faq summary::after{content:"+";color:var(--ac-1);font-weight:900;font-size:20px;transition:transform .2s ease}
.cg-faq details[open] summary::after{transform:rotate(45deg)}
.cg-faq summary::-webkit-details-marker{display:none}
.cg-faq p{margin:0 0 16px;font-size:14.5px;color:var(--bx-text-2);line-height:1.6}

@media(max-width:900px){
  .cg-hero-grid,.cg-duas{grid-template-columns:minmax(0,1fr)}
  .cg-hero-grid{min-height:0;padding-top:28px}
  .cg-palco{height:440px}
  .cg-arte{width:300px;right:0}
  .cg-h1s{width:180px}.cg-h2s{width:130px}.cg-h3s{width:150px}.cg-h4s{width:125px}.cg-h5s{width:110px}
  .cg-regua{grid-template-columns:repeat(3,minmax(0,1fr));row-gap:36px}
  .cg-subs{grid-template-columns:minmax(0,1fr);justify-items:center}
  .cg-sub-e{text-align:left}
  .cg-sub-e .cg-sub-item{flex-direction:row}
  .cg-muro{grid-template-columns:repeat(2,minmax(0,1fr))}
  .cg-pika{display:none}
  .cg-sec{padding:64px 0}
}
@media(max-width:560px){
  .cg-palco{height:360px}
  .cg-h1s{width:150px}.cg-h2s{width:110px}.cg-h3s{width:120px}.cg-h4s{width:105px}.cg-h5s{display:none}
  .cg-palco .sa-nome{display:none}
  .cg-anat-slab{width:230px}
  .cg-pino{display:none}
  .cg-lupa{width:240px}
  .cg-seta{transform:rotate(90deg)}
  .cg-bl-palco{height:380px}
  .cg-bl-arte{width:300px}
  .cg-bl-slab{width:220px}
  .cg-vcard{width:calc(50% - 8px)}
}
@media(prefers-reduced-motion:reduce){
  .cg *{animation:none!important;transition:none!important}
}
`
