/**
 * E18 - Black Friday do Mercado (vitrine remarcada, ate 23:59).
 * Trilha Mercado. Mockups aprovados: _Regua/mockups/E18-black-friday-mercado
 * (email.html = bloco pessoal A "Da sua meta"; email-c.html = C "Para a sua colecao").
 *
 * Arte: nenhuma fixa.
 * - Miniaturas da vitrine = imagem oficial de cada carta (URL; scrydex/pokemontcg/storage).
 * - Hero "Remarcadas": as 3 cartas da vitrine com a etiqueta de ontem riscada e a
 *   nova por cima. NAO tem dado pessoal (e igual para os 204), mas muda por EDICAO
 *   (cartas e precos do dia), entao vai pela rota de imagem, cacheavel por edicao:
 *   urlImagemPessoal('e18-remarcadas', token).
 *
 * ROTA /api/email/img/e18-remarcadas (a fazer em outra fase):
 *   dados: as 3 ofertas da edicao (imagem, preco, menor preco do Brasil ontem,
 *          rotulo curto da slab/condicao). Igual para todos: cachear pela edicao.
 *   tamanho: 600x400 (render 2x = 1200x800), JPG, fundo #0d0f14 opaco.
 *   layout: balcao com as 3 cartas. A 1a (chamariz) maior, em slab, com o rotulo
 *     "MEGA GENGAR ex / 230/193 AGS 10"; etiqueta branca de ontem riscada
 *     ("ONTEM R$ 1.600,00") e por cima a etiqueta nova ambar->vermelho, tinta
 *     #0a0a0a ("R$ 1.360,00" + "R$ 240,00 A MENOS"). As outras 2 em toploader,
 *     menores, cada uma com o riscado e o preco novo. Placa "REMARCADAS / ATE 23:59".
 *   referencia exata: mockups/E18-black-friday-mercado/assets/hero-etiqueta.html.
 *
 * Valores de exemplo = os do mockup (anuncios reais de 07/10). No envio, o menor
 * preco de referencia TEM de ser o Mercado Brasileiro da vespera (26/11).
 */
import { blocoPromocao, layoutRegua, utmRegua, URL_CANONICA } from '@/lib/email'
import { brl, urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { COR, FONT, attr, btnCompra, esc, linha, rs } from './ui-b'

export type OfertaE18 = {
  /** "Mega Gengar ex" */
  nome: string
  /** Nome com a graduacao, para o H1: "Mega Gengar ex AGS 10". */
  rotulo: string
  /** "230/193" */
  numero: string
  /** "AGS 10 · JP" ou "NM · PT" */
  detalhe: string
  imagem: string
  preco: number
  /** Menor preco do Brasil na vespera (Mercado Brasileiro). */
  menorOntem: number
  /** Slug do anuncio (/anuncio/<slug>). */
  slug: string
}

export type PessoalE18 =
  /** A) cartas da vitrine em uma Meta ativa (nomes iguais aos de `ofertas`). */
  | { tipo: 'meta'; set: string; cartas: string[]; nenhumaDaMeta: boolean }
  /** B) Pokemon da vitrine na Pokedex ou com aviso no sino. */
  | { tipo: 'acompanha'; pokemon: string; oferta: number }
  /** C) sem vinculo: a mais barata vira "a N+1a carta da sua colecao". */
  | { tipo: 'colecao'; nCartas: number }

export type DadosE18 = {
  nome: string
  /** "26/11" (vespera, base do menor preco). */
  dataOntem: string
  /** "Sexta, 27/11" (faixa do topo, so no desktop). */
  dataHoje: string
  /** As ofertas da vitrine; a primeira e o chamariz. */
  ofertas: OfertaE18[]
  pessoal: PessoalE18
}

const ID = 'e18'

const CSS = `@media only screen and (max-width:480px){
  .faixa{padding:10px 12px!important;letter-spacing:0.05em!important}
  .abre{padding-top:16px!important}
  .h1{font-size:25px!important;line-height:31px!important;margin-bottom:0!important}
  .h2{font-size:21px!important;line-height:27px!important}
  .so-desk{display:none!important;max-height:0!important;overflow:hidden!important}
  .btn{min-width:0!important}
  .bloco-btn{padding-top:14px!important}
  .pess-wrap{padding-top:8px!important}
  .pess{border:0!important;border-left:3px solid #f59e0b!important;border-radius:0!important}
  .pess-td{padding:0 0 0 12px!important}
  .cel{padding:10px!important}
  .por{font-size:22px!important;line-height:28px!important}
}`

const ORDINAIS = ['primeira', 'segunda', 'terceira', 'quarta', 'quinta', 'sexta', 'sétima', 'oitava', 'nona', 'décima']
const ordinal = (n: number) => ORDINAIS[n - 1] ?? `${n}ª`
const NUMERAIS = ['', 'a primeira', 'as duas primeiras', 'as três primeiras', 'as quatro primeiras']
const eco = (o: OfertaE18) => Math.max(0, o.menorOntem - o.preco)
const verde = (t: string) => `<b style="color:${COR.verde};white-space:nowrap;">${t}</b>`

function listaB(nomes: string[]): string {
  const b = nomes.map((n) => `<b>${esc(n)}</b>`)
  return b.length <= 1 ? b.join('') : `${b.slice(0, -1).join(', ')} e ${b[b.length - 1]}`
}

function montar(d: DadosE18, ctx: CtxRegua) {
  const vitrine = `${URL_CANONICA}/marketplace?oferta=black-friday`
  const [chamariz] = d.ofertas
  const n = d.ofertas.length
  const assunto = `Black Friday: ${brl(eco(chamariz))} a menos no ${chamariz.nome}`
  const preheader = `${brl(chamariz.preco)} contra ${brl(chamariz.menorOntem)} do menor preço do Brasil ontem.${n > 1 ? ` E mais ${n - 1} ${n - 1 === 1 ? 'carta' : 'cartas'}, até 23:59.` : ' Até 23:59.'}`
  const ctaLabel = `Ver as ${n} ofertas de Black Friday`

  // Bloco pessoal + quais cartas da vitrine ganham tag/borda ambar.
  const destaque = new Map<number, string>()
  let rotulo: string
  let texto: string
  const p = d.pessoal
  if (p.tipo === 'meta') {
    const idx = d.ofertas.map((o, i) => (p.cartas.includes(o.nome) ? i : -1)).filter((i) => i >= 0)
    idx.forEach((i) => destaque.set(i, 'Da sua meta'))
    const soma = idx.reduce((s, i) => s + eco(d.ofertas[i]), 0)
    const nomes = idx.map((i) => d.ofertas[i].nome)
    rotulo = `Da sua meta ${esc(p.set)}`
    texto = `${esc(d.nome)}, ${listaB(nomes)} ${nomes.length === 1 ? 'está' : 'estão'} aqui com ${verde(`${rs(soma)} a menos`)}. ${p.nenhumaDaMeta ? `${nomes.length === 1 ? 'Seria' : 'Seriam'} ${NUMERAIS[nomes.length] ?? `as ${nomes.length} primeiras`} da sua ${esc(p.set)}.` : `${nomes.length === 1 ? 'Entra' : 'Entram'} na sua ${esc(p.set)}.`}`
  } else if (p.tipo === 'acompanha') {
    const o = d.ofertas[p.oferta] ?? chamariz
    rotulo = 'Você acompanha'
    texto = `Você acompanha o <b>${esc(p.pokemon)}</b> no sino. Ele está aqui com ${verde(`${rs(eco(o))} a menos`)} que o menor preço do Brasil ontem.`
  } else {
    let i = 0
    d.ofertas.forEach((o, k) => { if (o.preco < d.ofertas[i].preco) i = k })
    const o = d.ofertas[i]
    destaque.set(i, n === 3 ? 'A mais barata das três' : 'A mais barata')
    rotulo = 'Para a sua coleção'
    texto = `A ${ordinal(p.nCartas + 1)} carta da sua coleção pode custar <b style="white-space:nowrap;">${rs(o.preco)}</b>: o <b>${esc(o.nome)}</b> ${esc(o.numero)}, com ${verde(`${rs(eco(o))} a menos`)}.`
  }

  const cartaVitrine = (o: OfertaE18, i: number) => {
    const tag = destaque.get(i)
    return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.elevado}" style="margin-top:${i === 0 ? 0 : 12}px;background-color:${COR.elevado};border:1px solid ${tag ? COR.ambar : COR.borda};border-radius:16px;"><tr><td class="cel" style="padding:12px;${FONT}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="96" valign="top" style="width:96px;">
              <a href="${attr(utmRegua(`${URL_CANONICA}/anuncio/${encodeURIComponent(o.slug)}`, ID, 'vitrine'))}" target="_blank"><img src="${attr(o.imagem)}" width="96" height="134" alt="${esc(o.nome)} ${esc(o.numero)}, ${esc(o.detalhe)}" style="display:block;width:96px;height:134px;border:0;border-radius:6px;color:${COR.texto2};${FONT}font-size:14px;background-color:${COR.borda};"/></a>
            </td>
            <td valign="top" style="padding-left:14px;${FONT}">
              ${tag ? `<p style="margin:0 0 4px;font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${COR.ambar};">${esc(tag)}</p>` : ''}
              <p style="margin:0;font-size:18px;line-height:24px;font-weight:800;color:${COR.texto};">${esc(o.nome)}</p>
              <p style="margin:0;font-size:14px;line-height:20px;color:${COR.texto2};">${esc(o.numero)} &middot; ${esc(o.detalhe)}</p>
              <p class="por" style="margin:8px 0 0;font-size:24px;line-height:30px;font-weight:800;color:${COR.texto};white-space:nowrap;">${rs(o.preco)}</p>
              <p style="margin:0;font-size:14px;line-height:20px;font-weight:700;color:${COR.verde};"><span style="white-space:nowrap;">${rs(eco(o))}</span> a menos que o menor preço do Brasil ontem</p>
            </td>
          </tr></table>
        </td></tr></table>`
  }
  const total = d.ofertas.reduce((s, o) => s + eco(o), 0)
  const juntas = n === 3 ? 'As três juntas' : n === 2 ? 'As duas juntas' : `As ${n} juntas`

  const conteudo = `
    <table role="presentation" class="so-desk" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td class="faixa tinta" align="center" bgcolor="${COR.ambar}" style="padding:12px 16px;background-color:${COR.ambar};background-image:linear-gradient(135deg,#f59e0b,#ef4444);${FONT}font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${COR.tinta};"><span style="white-space:nowrap;">Black Friday do Mercado</span> &middot; <span style="white-space:nowrap;">${esc(d.dataHoje)}</span></td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="${COR.elevado}" style="background-color:${COR.elevado};">
        <a href="${attr(utmRegua(vitrine, ID, 'hero'))}" target="_blank" style="text-decoration:none;">
          <img src="${attr(urlImagemPessoal('e18-remarcadas', ctx.tokenImagem))}" width="600" alt="${esc(`${n === 3 ? 'Três' : n} cartas remarcadas até 23:59: `)}${d.ofertas.map((o) => `${esc(o.rotulo)} de ${rs(o.menorOntem)}${o === chamariz ? ' (menor preço do Brasil ontem)' : ''} por ${rs(o.preco)}`).join(', ')}." style="display:block;width:100%;max-width:600px;height:auto;border:0;color:${COR.texto};${FONT}font-size:16px;font-weight:700;line-height:24px;background-color:${COR.elevado};"/>
        </a>
      </td></tr>
    </table>
    ${linha(`
        <h1 class="h1" style="margin:0 0 8px;font-size:30px;line-height:36px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};">${esc(chamariz.rotulo)} com ${rs(eco(chamariz))} a&nbsp;menos.</h1>
        <p class="so-desk" style="margin:0;font-size:16px;line-height:24px;font-weight:700;color:${COR.texto};">${rs(chamariz.preco)} na Black Friday da Bynx, contra ${rs(chamariz.menorOntem)} do menor preço do Brasil ontem.</p>`, '28px 32px 0', 'abre')}
    ${linha(`
        <table role="presentation" class="pess" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.elevado}" style="background-color:${COR.elevado};border:1px solid ${COR.ambar};border-radius:12px;"><tr><td class="pess-td" style="padding:12px 16px 13px;${FONT}">
          <p style="margin:0 0 4px;font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${COR.ambar};">${rotulo}</p>
          <p style="margin:0;font-size:16px;line-height:24px;color:${COR.texto};">${texto}</p>
        </td></tr></table>`, '18px 32px 0', 'pess-wrap')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px bloco-btn" align="left" style="padding:22px 32px 0;">
        ${btnCompra(ctaLabel, utmRegua(vitrine, ID, 'cta'), { largura: 420 })}
        <p style="margin:10px 0 0;${FONT}font-size:14px;line-height:20px;color:${COR.texto2};">Frete calculado na hora pelo seu CEP &middot; pagamento com cartão dentro da Bynx &middot; rastreio na sua conta</p>
      </td></tr>
    </table>
    ${linha(`
        <p style="margin:0 0 2px;font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${COR.ambar};">Hoje na vitrine</p>
        <p class="h2" style="margin:0;font-size:22px;line-height:28px;font-weight:800;color:${COR.texto};">Quanto você economiza em cada&nbsp;uma</p>
        <p style="margin:4px 0 14px;font-size:14px;line-height:20px;color:${COR.texto2};">Cada uma é o único anúncio dela na Bynx hoje: se alguém comprar antes, sai da vitrine.</p>
        ${d.ofertas.map(cartaVitrine).join('')}
        <p style="margin:14px 0 0;font-size:16px;line-height:24px;font-weight:800;color:${COR.texto};">${juntas}: <span style="color:${COR.verde};white-space:nowrap;">${rs(total)} a menos.</span></p>
        <p style="margin:6px 0 0;font-size:14px;line-height:20px;color:${COR.texto2};">Menor preço do Brasil ontem é o Mercado Brasileiro da Bynx em ${esc(d.dataOntem)}, antes da Black Friday: o anúncio mais barato da mesma carta no país naquele dia.</p>`, '36px 32px 0')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" align="center" style="padding:28px 32px 0;">
        ${btnCompra(ctaLabel, utmRegua(vitrine, ID, 'cta-fim'), { largura: 420 })}
        <p style="margin:10px 0 0;${FONT}font-size:14px;line-height:20px;color:${COR.texto2};">Termina hoje às 23:59 (horário de Brasília)</p>
      </td></tr>
    </table>
    ${linha(`<p style="margin:0;padding-top:20px;border-top:1px solid ${COR.borda};font-size:16px;line-height:25px;color:${COR.texto2};">A regra da vitrine: lojas e vendedores só entram com oferta pelo menos 15% abaixo do menor preço do Brasil de ontem, ${esc(d.dataOntem)}, e com no mínimo R$&nbsp;30,00 de diferença. Achou alguma fora da regra? Responda este e-mail e nós tiramos do ar.</p>`, '32px 32px 0')}`

  const html = layoutRegua({
    conteudo,
    campanha: ID,
    categoria: 'mercado',
    links: ctx.links,
    preheader,
    assinatura: true,
    css: CSS,
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

const OFERTAS_EXEMPLO: OfertaE18[] = [
  { nome: 'Mega Gengar ex', rotulo: 'Mega Gengar ex AGS 10', numero: '230/193', detalhe: 'AGS 10 · JP', imagem: 'https://images.scrydex.com/pokemon/m2a_ja-230/large', preco: 1360, menorOntem: 1600, slug: 'mega-gengar-ex-230-193-ags10' },
  { nome: 'Arctibax', rotulo: 'Arctibax', numero: '209/193', detalhe: 'NM · PT', imagem: 'https://images.pokemontcg.io/sv2/209.png', preco: 179.9, menorOntem: 225, slug: 'arctibax-209-193' },
  { nome: 'Tinkatuff', rotulo: 'Tinkatuff', numero: '217/193', detalhe: 'NM · PT', imagem: 'https://images.pokemontcg.io/sv2/217.png', preco: 94.9, menorOntem: 125, slug: 'tinkatuff-217-193' },
]

export const E18: TemplateRegua<DadosE18> = {
  id: 'E18',
  nome: 'Black Friday do Mercado',
  trilha: 'Mercado',
  categoria: 'mercado',
  // Persona de exemplo: Marina (PERSONAS.md secao 2), meta Paldea Evolved em 0. Valores de EXEMPLO
  // (anuncios reais de 07/10); no envio a referencia e o Mercado Brasileiro de 26/11.
  exemplo: {
    nome: 'Marina',
    dataOntem: '26/11',
    dataHoje: 'Sexta, 27/11',
    ofertas: OFERTAS_EXEMPLO,
    pessoal: { tipo: 'meta', set: 'Paldea Evolved', cartas: ['Arctibax', 'Tinkatuff'], nenhumaDaMeta: true },
  },
  montar,
}

/** Variantes do bloco pessoal para a pre-visualizacao (C = mockup email-c.html, N = 0 cartas). */
export const EXEMPLOS_EXTRAS: Record<string, DadosE18> = {
  c: { nome: 'Marina', dataOntem: '26/11', dataHoje: 'Sexta, 27/11', ofertas: OFERTAS_EXEMPLO, pessoal: { tipo: 'colecao', nCartas: 0 } },
  b: { nome: 'Marina', dataOntem: '26/11', dataHoje: 'Sexta, 27/11', ofertas: OFERTAS_EXEMPLO, pessoal: { tipo: 'acompanha', pokemon: 'Gengar', oferta: 0 } },
}
