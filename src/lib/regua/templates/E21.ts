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
}`

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
      <td class="px" align="left" style="padding:18px 32px 0;${FONT}font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${COR.texto2};">Halloween na Bynx</td>
      <td class="px" align="right" style="padding:18px 32px 0;${FONT}font-size:14px;line-height:20px;"><a href="${attr(mercado('topo'))}" target="_blank" style="${link}white-space:nowrap;">Ver Marketplace</a></td>
    </tr></table>`

  const hero = linha(`
        <h1 class="h1" style="margin:0 0 10px;font-size:34px;line-height:40px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};">Halloween na Bynx</h1>
        <p style="margin:0 0 12px;font-size:20px;line-height:28px;font-weight:700;color:${COR.ambar};">Produtos para quem leva a coleção a sério.</p>
        <p style="margin:0 0 22px;font-size:16px;line-height:25px;color:${COR.texto2};">Cartas, produtos selados e acessórios com opção de compra no Marketplace, selecionados para você encontrar o próximo item da sua coleção.</p>
        ${btnCompra('Explorar produtos', mercado('hero'), { largura: 300 })}`, '24px 32px 0')

  const n = d.itens.length
  const secao = `
    ${linha(`
        <p style="margin:0 0 2px;font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${COR.ambar};">${n} ${n === 1 ? 'item' : 'itens'} à venda agora</p>
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
