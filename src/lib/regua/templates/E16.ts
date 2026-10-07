/**
 * E16 - Quer continuar recebendo? (sunset de quem parou de abrir).
 * Trilha Reativar/limpar. Mockup aprovado: _Regua/mockups/E16-sunset.
 *
 * Arte: nenhuma fixa. A pagina do fichario do hero leva as DUAS cartas da
 * pessoa que mais subiram: rota de imagem urlImagemPessoal('e16-fichario', token).
 *
 * ROTA /api/email/img/e16-fichario (a fazer em outra fase):
 *   dados: imagem das 2 cartas destaque (nº 1 e nº 2 em alta de R$ nos 30 dias).
 *          Cacheavel pelo PAR de card_id (nao depende de mais nada da pessoa).
 *   tamanho: 536x316 (render 2x = 1072x632), JPG, fundo #191b20 opaco, cantos
 *     arredondados no proprio HTML do e-mail (border-radius 16).
 *   layout: pagina de plastico do fichario na luz do fim de tarde. Lombada de
 *     metal com 3 argolas nos 8% da esquerda; dois bolsos inteiros centrados em
 *     30,4% e 76,1% da largura (as legendas do e-mail caem embaixo deles); a nº 1
 *     no bolso da esquerda com brilho ambar, a nº 2 no da direita. Com 1 carta so:
 *     bolso da direita vazio. Falhou a geracao: imagem da carta pura com borda #202227.
 *   referencia exata: mockups/E16-sunset/assets/fichario.html. ?exemplo=1 = Ana.
 *
 * De/para e % de cada carta ficam em TEXTO VIVO embaixo de cada bolso.
 */
import { btnRegua, blocoPromocao, layoutRegua, utmRegua, URL_CANONICA } from '@/lib/email'
import { brl, urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { COR, FONT, attr, comCss, esc, linha, logoAssinatura, pct, rs } from './ui-b'

export type CartaAltaE16 = {
  nome: string
  /** Menor preco 30 dias atras e hoje. */
  de: number
  para: number
}

export type DadosE16 = {
  nome: string
  nCartas: number
  valorHoje: number
  /** Variacao da colecao em 30 dias (R$). <= 0 = fallback sem "subiu". */
  variacao30d: number
  /** As 2 maiores altas em R$ (1 se so uma subiu). */
  destaques: CartaAltaE16[]
  /** Quantas cartas cairam no periodo (linha de saldo). */
  quedas: number
}

const ID = 'e16'
const DIAS_SUNSET = 14

const CSS = `@media only screen and (max-width:480px){
  .h1{font-size:28px!important;line-height:34px!important}
  .leg{padding-left:2px!important;padding-right:2px!important}
}`

const pctDe = (c: CartaAltaE16) => (c.de > 0 ? ((c.para - c.de) / c.de) * 100 : 0)

function primeiroNome(nome: string): string {
  return nome.length > 10 ? nome.split(/\s+/)[0] : nome
}

function montar(d: DadosE16, ctx: CtxRegua) {
  const ficha = `${URL_CANONICA}/minha-colecao`
  const subiu = d.variacao30d > 0
  const [c1] = d.destaques
  const nome = primeiroNome(d.nome)
  const pct1 = c1 ? pctDe(c1) : 0

  let assunto: string
  if (!subiu || !c1 || pct1 < 10) assunto = `${nome}, as suas ${d.nCartas} cartas valem ${brl(d.valorHoje)} hoje`
  else if (c1.nome.length > 18) assunto = `${nome}, +${Math.round(pct1)}% no seu ${c1.nome}`
  else assunto = `${nome}, o seu ${c1.nome} subiu ${Math.round(pct1)}%`
  const preheader = `As suas ${d.nCartas} cartas valem ${brl(d.valorHoje)} hoje. Um toque e seguimos de olho nelas.`

  const h1 = subiu
    ? `O seu fichário subiu ${rs(d.variacao30d)} em 30&nbsp;dias.`
    : `As suas ${esc(d.nCartas)} cartas valem ${rs(d.valorHoje)} hoje.`
  const apoio = subiu
    ? `<p style="margin:0;font-size:16px;line-height:24px;color:${COR.texto2};">${esc(nome)}, as suas ${esc(d.nCartas)} cartas valem <span style="color:${COR.texto};font-weight:700;white-space:nowrap;">${rs(d.valorHoje)}</span> hoje.</p>`
    : ''

  const legenda = (c: CartaAltaE16) => `
          <td class="leg" width="46%" align="center" valign="top" bgcolor="${COR.elevado}" style="width:46%;padding:10px 6px 0;background-color:${COR.elevado};${FONT}text-align:center;">
            <p style="margin:0;font-size:15px;line-height:20px;font-weight:800;color:${COR.texto};">${esc(c.nome)}</p>
            ${subiu
              ? `<p style="margin:2px 0 0;font-size:14px;line-height:20px;color:${COR.texto2};white-space:nowrap;"><span style="text-decoration:line-through;">${rs(c.de)}</span> &rarr; <span style="font-weight:800;color:${COR.texto};">${rs(c.para)}</span></p>
            <p style="margin:0;font-size:14px;line-height:20px;font-weight:800;color:${COR.verde};white-space:nowrap;">+${pct(pctDe(c))} em 30 dias</p>`
              : `<p style="margin:2px 0 0;font-size:14px;line-height:20px;color:${COR.texto2};white-space:nowrap;">hoje <span style="font-weight:800;color:${COR.texto};">${rs(c.para)}</span></p>`}
          </td>`
  const legendas = d.destaques.slice(0, 2)
  const somaMostrada = legendas.reduce((s, c) => s + (c.para - c.de), 0)
  const saldo = subiu && d.quedas > 0 && Math.abs(somaMostrada - d.variacao30d) > 0.004
    ? `<p style="margin:10px 0 0;${FONT}font-size:14px;line-height:20px;color:${COR.texto2};text-align:center;">Saldo das ${esc(d.nCartas)} cartas, já contando ${d.quedas === 1 ? 'a que caiu' : 'as que caíram'}.</p>`
    : ''
  const altHero = legendas.length === 2
    ? `Página do seu fichário na luz do fim de tarde: o ${esc(legendas[0].nome)} no bolso da esquerda, com brilho âmbar, e o ${esc(legendas[1].nome)} no bolso ao lado.`
    : `Página do seu fichário na luz do fim de tarde: o ${esc(legendas[0]?.nome ?? 'sua carta')} no bolso, com brilho âmbar.`

  const conteudo = `
    ${linha(`
        <h1 class="h1" style="margin:0 0 8px;font-size:32px;line-height:38px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};">${h1}</h1>
        ${apoio}`, '28px 32px 0')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" bgcolor="${COR.elevado}" style="padding:16px 32px 0;background-color:${COR.elevado};">
        <a href="${attr(utmRegua(ficha, ID, 'hero'))}" target="_blank" style="text-decoration:none;">
          <img src="${attr(urlImagemPessoal('e16-fichario', ctx.tokenImagem))}" width="536" height="316" alt="${altHero}" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:16px;color:${COR.texto};${FONT}font-size:14px;font-weight:700;line-height:20px;background-color:${COR.surface2};"/>
        </a>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="8%" bgcolor="${COR.elevado}" style="width:8%;font-size:1px;line-height:1px;background-color:${COR.elevado};">&nbsp;</td>
          ${legendas.map(legenda).join('')}
          ${legendas.length === 1 ? `<td width="46%" style="width:46%;">&nbsp;</td>` : ''}
        </tr></table>
        ${saldo}
      </td></tr>
    </table>
    ${linha(`<p style="margin:0;font-size:17px;line-height:24px;font-weight:700;color:${COR.texto};">Seguimos de olho nas suas cartas?</p>`, '18px 32px 0')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" align="left" style="padding:14px 32px 0;">
        ${btnRegua('Sim, ver o meu fichário', utmRegua(ficha, ID, 'cta'))}
        <p style="margin:10px 0 0;${FONT}font-size:14px;line-height:20px;color:${COR.texto2};">O toque já conta como sim. Lá estão as suas ${esc(d.nCartas)} cartas e o valor de hoje no Mercado Brasileiro.</p>
      </td></tr>
    </table>
    ${linha(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-top:1px solid ${COR.borda};padding-top:12px;${FONT}">
            <p style="margin:0;font-size:16px;line-height:24px;color:${COR.texto2};">Prefere menos? <a href="${attr(ctx.links?.preferencias ?? `${URL_CANONICA}/minha-conta`)}" target="_blank" style="display:inline-block;padding:10px 0;font-weight:700;color:${COR.texto};text-decoration:underline;">Escolher os temas</a></p>
          </td>
        </tr></table>`, '28px 32px 0')}
    ${linha(`
        ${logoAssinatura('0 0 14px')}
        <p style="margin:0;font-size:14px;line-height:20px;color:${COR.texto2};"><span style="font-weight:700;color:${COR.texto};">P.S.</span> Sem nenhum toque em ${DIAS_SUNSET} dias, a Bynx para de mandar novidades. Avisos de pedido e pagamento continuam.</p>`, '20px 32px 28px')}`

  const html = layoutRegua({
    conteudo,
    campanha: ID,
    categoria: 'novidades',
    links: ctx.links,
    preheader,
    // Logo da assinatura no conteudo: o P.S. aprovado vem DEPOIS dele.
    assinatura: false,
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  return { assunto, preheader, html: comCss(html, CSS) }
}

export const E16: TemplateRegua<DadosE16> = {
  id: 'E16',
  nome: 'Quer continuar recebendo? (sunset)',
  trilha: 'Reativar/limpar',
  categoria: 'novidades',
  // Persona de exemplo: Ana, 34, Belo Horizonte (a mesma do E15). Precos reais de 07/10.
  exemplo: {
    nome: 'Ana',
    nCartas: 4,
    valorHoje: 1854.39,
    variacao30d: 563.09,
    destaques: [
      { nome: 'Charizard G LV.X', de: 552.5, para: 989 },
      { nome: 'Lugia-GX', de: 399.9, para: 699.5 },
    ],
    quedas: 1,
  },
  montar,
}
