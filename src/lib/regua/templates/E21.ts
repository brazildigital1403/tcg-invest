/**
 * E21 - Halloween na Bynx: produtos para a sua colecao (out/2026).
 * Trilha Mercado. Editorial unico, sem desconto nem cupom: os precos sao os
 * dos anuncios no momento do disparo (motor/vitrineHalloween.ts monta a lista).
 *
 * So entra o que mostra "Comprar" no Mercado (anuncio de quem fecha venda
 * online + produto de loja com recebimento ativo e estoque). A Caixa para
 * Toploader sai da grade e vira o bloco de destaque.
 *
 * Arte: nenhuma gerada. Imagem oficial de cada carta e foto do produto.
 */
import { layoutRegua, URL_CANONICA } from '@/lib/email'
import type { CtxRegua, TemplateRegua } from '@/lib/regua/comum'
import { COR, FONT, attr, btnCompra, esc, linha, rs } from './ui-b'

export const CAMPANHA_E21 = 'halloween_marketplace_2026'
export const SLUG_CAIXA_E21 = 'caixa-para-toploader-bynx'

export type ItemE21 = {
  tipo: 'carta' | 'produto'
  nome: string
  /** "NM", "AGS 9.5", "Selado"... */
  detalhe: string
  /** Loja ou vendedor. */
  vendedor: string
  preco: number
  imagem: string | null
  /** Caminho no site: /anuncio/<slug> ou /produto/<slug>. */
  caminho: string
}

export type DadosE21 = {
  itens: ItemE21[]
  /** Caixa para Toploader com preco e estoque do momento; null = sem estoque (bloco sai). */
  caixa: ItemE21 | null
}

/** UTMs da campanha (pedido do Du): source email, medium crm. */
export function utmE21(caminho: string, conteudo: string): string {
  const url = new URL(caminho, URL_CANONICA)
  url.searchParams.set('utm_source', 'email')
  url.searchParams.set('utm_medium', 'crm')
  url.searchParams.set('utm_campaign', CAMPANHA_E21)
  url.searchParams.set('utm_content', conteudo)
  return url.toString()
}

const CSS = `@media only screen and (max-width:480px){
  .h1{font-size:28px!important;line-height:34px!important}
  .h2{font-size:21px!important;line-height:27px!important}
  .cel{padding:6px!important}
  .item{padding:10px!important}
  .preco{font-size:18px!important;line-height:24px!important}
  .btn{min-width:0!important}
  .hero-copy-cell{display:block!important;width:auto!important;padding:26px 20px 8px!important}
  .hero-art-cell{display:block!important;width:auto!important;padding:10px 20px 24px!important;text-align:center!important}
  .hero-title{font-size:32px!important;line-height:35px!important}
  .hero-card{width:106px!important;height:auto!important}
  .hero-lua{width:92px!important;height:92px!important}
}`

/** Arte do hero: anuncios fantasma da propria vitrine (so o que tem Comprar). */
const FANTASMAS = /gengar|gastly|haunter|darkrai|mimikyu|banette|dusknoir|chandelure/i

function heroCartas(itens: ItemE21[]): ItemE21[] {
  const cartas = itens.filter((i) => i.tipo === 'carta' && i.imagem)
  const vistos = new Set<string>()
  const tematicas = cartas.filter((i) => {
    const m = i.nome.match(FANTASMAS)?.[0].toLowerCase()
    if (!m || vistos.has(m)) return false
    vistos.add(m)
    return true
  })
  return (tematicas.length >= 2 ? tematicas : cartas).slice(0, 2)
}

/** "Mega Gengar ex (230/193)" -> "Mega Gengar ex". */
const semNumero = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, '')

/** Botao "Comprar" de largura cheia da celula (roxo->rosa, contexto do comprador). */
function btnItem(href: string): string {
  const h = attr(href)
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td align="center" bgcolor="#a855f7" style="border-radius:10px;background-color:#a855f7;background-image:linear-gradient(135deg,#a855f7,#ec4899);">
                <a href="${h}" target="_blank" style="display:block;height:44px;line-height:44px;${FONT}font-size:16px;font-weight:800;color:#f0f0f0;text-decoration:none;text-align:center;">Comprar</a>
              </td>
            </tr></table>`
}

function celula(it: ItemE21, i: number): string {
  const href = utmE21(it.caminho, `item-${i + 1}`)
  const larg = it.tipo === 'carta' ? 120 : 160
  const img = it.imagem
    ? `<a href="${attr(href)}" target="_blank" style="text-decoration:none;"><img src="${attr(it.imagem)}" width="${larg}" alt="${esc(`${it.nome}, ${it.detalhe}, vendido por ${it.vendedor}`)}" style="display:block;margin:0 auto;width:100%;max-width:${larg}px;height:auto;border:0;border-radius:8px;color:${COR.texto2};${FONT}font-size:14px;background-color:${COR.surface2};"/></a>`
    : ''
  return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.fundo}" style="background-color:${COR.fundo};border:1px solid ${COR.borda};border-radius:14px;"><tr><td class="item" valign="top" style="padding:14px;${FONT}">
            ${img}
            <p class="preco" style="margin:12px 0 2px;font-size:20px;line-height:26px;font-weight:800;color:${COR.texto};white-space:nowrap;">${rs(it.preco)}</p>
            <p style="margin:0;font-size:15px;line-height:21px;font-weight:700;color:${COR.texto};">${esc(it.nome)}</p>
            <p style="margin:2px 0 0;font-size:13px;line-height:19px;color:${COR.texto2};">${esc(it.detalhe)}</p>
            <p style="margin:2px 0 12px;font-size:13px;line-height:19px;color:${COR.texto2};">${esc(it.vendedor)}</p>
            ${btnItem(href)}
          </td></tr></table>`
}

function grade(itens: ItemE21[]): string {
  const linhas: string[] = []
  for (let i = 0; i < itens.length; i += 2) {
    const a = itens[i]
    const b = itens[i + 1]
    linhas.push(`<tr>
        <td class="cel" width="50%" valign="top" style="width:50%;padding:6px;">${celula(a, i)}</td>
        <td class="cel" width="50%" valign="top" style="width:50%;padding:6px;">${b ? celula(b, i + 1) : '&nbsp;'}</td>
      </tr>`)
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;">${linhas.join('')}</table>`
}

function montar(d: DadosE21, ctx: CtxRegua) {
  const assunto = 'Halloween na Bynx: produtos para sua coleção'
  const preheader = 'Cartas, boxes e a Caixa para Toploader com os preços atuais do Marketplace.'
  const mercado = (c: string) => utmE21('/marketplace', c)
  const link = `color:${COR.ambar};text-decoration:none;font-weight:700;`

  const topo = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td class="px" align="left" style="padding:18px 32px 0;${FONT}font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${COR.texto2};">Noite de Halloween</td>
      <td class="px" align="right" style="padding:18px 32px 0;${FONT}font-size:14px;line-height:20px;"><a href="${attr(mercado('topo'))}" target="_blank" style="${link}white-space:nowrap;">Ver Marketplace</a></td>
    </tr></table>`

  const arte = heroCartas(d.itens)
  const nomes = arte.map((a) => esc(semNumero(a.nome)))
  const chamada = nomes.length === 2 ? `${nomes[0]}, ${nomes[1]} e os próximos achados` : 'Os próximos achados'
  const cartaHero = (a: ItemE21, i: number) => `<a href="${attr(utmE21(a.caminho, `hero-carta-${i + 1}`))}" target="_blank" style="text-decoration:none;"><img class="hero-card" src="${attr(a.imagem!)}" width="118" alt="${esc(`${a.nome}, à venda por ${a.vendedor}`)}" style="display:inline-block;width:118px;height:auto;border:2px solid ${i === 0 ? COR.borda2 : COR.ambar};border-radius:10px;${i ? 'margin-left:8px;' : ''}color:${COR.texto2};${FONT}font-size:12px;background-color:${COR.surface2};"/></a>`

  const hero = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.elevado}" style="background-color:${COR.elevado};background-image:radial-gradient(circle at 84% 20%,rgba(245,158,11,.16),transparent 34%);"><tr>
      <td class="hero-copy-cell" width="58%" valign="middle" style="padding:28px 12px 28px 32px;${FONT}">
        <p style="margin:0 0 10px;font-size:12px;line-height:18px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${COR.ambar};">Pitch Black &middot; Halloween na Bynx</p>
        <h1 class="hero-title" style="margin:0 0 12px;font-size:36px;line-height:40px;font-weight:800;letter-spacing:-0.03em;color:${COR.texto};">O lado mais sombrio da sua coleção.</h1>
        <p style="margin:0 0 18px;font-size:16px;line-height:24px;color:${COR.texto2};">A noite caiu. ${chamada} já estão esperando no Marketplace.</p>
        <p style="margin:0 0 22px;"><span style="display:inline-block;border:1px solid ${COR.borda2};border-radius:999px;padding:8px 12px;font-size:12px;line-height:14px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:${COR.texto2};">Catálogo real &middot; preços atuais</span></p>
        ${btnCompra('Entrar no Marketplace', mercado('hero'), { largura: 300 })}
      </td>
      <td class="hero-art-cell" width="42%" valign="middle" align="center" style="padding:28px 24px 28px 8px;${FONT}">
        <!--[if !mso]><!-->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td class="hero-lua" width="104" height="104" bgcolor="${COR.ambar}" style="width:104px;height:104px;border-radius:52px;background-color:${COR.ambar};background-image:linear-gradient(135deg,#f59e0b,#ef4444);font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
        <!--<![endif]-->
        ${arte.length ? `<p style="margin:18px 0 0;white-space:nowrap;">${arte.map(cartaHero).join('')}</p>` : ''}
      </td>
    </tr></table>`

  const n = d.itens.length
  const secao = `
    ${linha(`
        <p style="margin:0 0 2px;font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${COR.ambar};">Picks de Pitch Black &middot; ${n} ${n === 1 ? 'item' : 'itens'} à venda agora</p>
        <p class="h2" style="margin:0 0 6px;font-size:24px;line-height:30px;font-weight:800;color:${COR.texto};">Produtos com opção de comprar</p>
        <p style="margin:0;font-size:14px;line-height:20px;color:${COR.texto2};">Preço de cada anúncio no momento do envio. Pagamento com cartão dentro da Bynx e frete calculado pelo seu CEP.</p>`, '36px 32px 8px')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="px" style="padding:4px 26px 0;">${grade(d.itens)}</td></tr></table>`

  const c = d.caixa
  const caixa = c ? linha(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.fundo}" style="background-color:${COR.fundo};border:1px solid ${COR.ambar};border-radius:16px;"><tr><td style="padding:22px;${FONT}">
          <p style="margin:0 0 4px;font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${COR.ambar};">Exclusivo Bynx</p>
          <p class="h2" style="margin:0 0 14px;font-size:24px;line-height:30px;font-weight:800;color:${COR.texto};">A caixa que protege o que você coleciona.</p>
          ${c.imagem ? `<a href="${attr(utmE21(c.caminho, 'caixa-imagem'))}" target="_blank" style="text-decoration:none;"><img src="${attr(c.imagem)}" width="320" alt="Caixa para Toploader Bynx, para até 100 toploaders, com travas laranja" style="display:block;margin:0 auto 16px;width:100%;max-width:320px;height:auto;border:0;border-radius:12px;color:${COR.texto2};${FONT}font-size:14px;background-color:${COR.surface2};"/></a>` : ''}
          <p style="margin:0 0 4px;font-size:16px;line-height:25px;color:${COR.texto};">Guarda até 100 toploaders.</p>
          <p style="margin:0 0 4px;font-size:16px;line-height:25px;color:${COR.texto};">Estrutura rígida com travas laranja.</p>
          <p style="margin:0 0 4px;font-size:16px;line-height:25px;color:${COR.texto};">Divisória interna e acabamento texturizado.</p>
          <p style="margin:0 0 14px;font-size:14px;line-height:21px;color:${COR.texto2};">Não comporta cartas graduadas (slabs).</p>
          <p style="margin:0 0 16px;font-size:24px;line-height:30px;font-weight:800;color:${COR.texto};white-space:nowrap;">${rs(c.preco)}</p>
          ${btnCompra('Conhecer a caixa', utmE21(c.caminho, 'caixa'), { largura: 280 })}
        </td></tr></table>`, '32px 32px 0') : ''

  const links = linha(`
        <p style="margin:0;padding-top:20px;border-top:1px solid ${COR.borda};font-size:14px;line-height:22px;color:${COR.texto2};text-align:center;">
          <a href="${attr(mercado('rodape'))}" target="_blank" style="${link}">Marketplace</a>
          &nbsp;&middot;&nbsp;
          <a href="${attr(utmE21('/privacidade', 'rodape'))}" target="_blank" style="${link}">Privacidade</a>
          &nbsp;&middot;&nbsp;
          <a href="${attr(utmE21('/termos', 'rodape'))}" target="_blank" style="${link}">Termos</a>
        </p>`, '32px 32px 24px')

  const html = layoutRegua({
    conteudo: topo + hero + secao + caixa + links,
    campanha: CAMPANHA_E21,
    categoria: 'mercado',
    links: ctx.links,
    preheader,
    css: CSS,
  })
  return { assunto, preheader, html }
}

export const E21: TemplateRegua<DadosE21> = {
  id: 'E21',
  nome: 'Halloween na Bynx: produtos',
  trilha: 'Mercado',
  categoria: 'mercado',
  // Exemplo com anuncios reais de 27/10; no disparo a lista vem do banco na hora.
  exemplo: {
    itens: [
      { tipo: 'produto', nome: 'Elite Trainer Box - Pitch Black', detalhe: 'Selado', vendedor: 'Mais Que Geek', preco: 349.9, imagem: null, caminho: '/produto/elite-trainer-box-pitch-black-mais-que-geek' },
      { tipo: 'carta', nome: 'Mega Gengar ex (230/193)', detalhe: 'NM', vendedor: 'Mais Que Geek', preco: 499.9, imagem: 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/card-images/M2-Mega-Gengar-ex--230-193-.jpg', caminho: '/anuncio/mega-gengar-ex-230-193-mais-que-geek' },
      { tipo: 'carta', nome: 'Gastly (080/071)', detalhe: 'NM', vendedor: 'Mais Que Geek', preco: 399.9, imagem: 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/card-images/SV5K-Gastly--080-071-.jpg', caminho: '/anuncio/gastly-080-071-mais-que-geek' },
    ],
    caixa: { tipo: 'produto', nome: 'Caixa para Toploader', detalhe: 'Acessório', vendedor: 'Bynx', preco: 120, imagem: null, caminho: `/produto/${SLUG_CAIXA_E21}` },
  },
  montar,
}
