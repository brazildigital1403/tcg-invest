/**
 * E15 - Winback: sua colecao mudou desde que voce saiu.
 * Trilha Reativar/limpar. Mockup aprovado: _Regua/mockups/E15-winback.
 *
 * Arte:
 * - FIXA: /emails/regua/e15/mini-versos.png (duas cartas de costas com "?",
 *   na linha "Mais N cartas subiram").
 * - O destaque (a carta que mais subiu com as etiquetas de/para) virou HTML:
 *   imagem oficial da carta + duas etiquetas com os valores em TEXTO VIVO.
 * - A miniatura de cada carta que caiu e a imagem oficial da carta (URL).
 * - PESSOAL: o cartao-postal do hero (nome, cidade, variacao, selo com a
 *   carta destaque), pela rota de imagem: urlImagemPessoal('e15-postal', token).
 *
 * ROTA /api/email/img/e15-postal (a fazer em outra fase):
 *   dados: nome, cidade, uf, desde/ate ("07/09", "07/10"), variacao da colecao
 *          (+R$ 563,09), quantas subiram e quantas cairam, imagem da carta destaque (selo).
 *   tamanho: 600x590 (render 2x = 1200x1180), JPG, fundo #0d0f14 opaco.
 *   layout: cartao-postal inclinado. Topo: faixa ambar->vermelho "LEMBRANCAS da
 *     BYNX" com as letras recortadas por arte de carta. Corpo escuro: "Oi, <nome>!",
 *     "Sua colecao desde <desde>:", a variacao em verde grande, "3 cartas subiram"
 *     (seta verde) e "1 carta caiu" (seta vermelha); a direita o selo serrilhado com
 *     a carta destaque, carimbo circular "<desde> / <ate>" e "PARA <nome> / <cidade> /
 *     <UF> · Brasil". Ref.: mockups/E15-winback/assets/hero.html. ?exemplo=1 = Ana, BH.
 *
 * Todo numero da pessoa tambem vai em texto vivo (H1, destaque, lista, alt).
 */
import { btnRegua, blocoPromocao, layoutRegua, utmRegua, URL_CANONICA } from '@/lib/email'
import { brl, urlArte, urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { COR, FONT, ajustarRodape, attr, comCss, esc, linha, pct, rs } from './ui-b'

export type CartaVariacaoE15 = {
  nome: string
  set: string
  /** Imagem oficial (images.pokemontcg.io, images.scrydex.com ou storage da Bynx). */
  imagem: string
  /** Menor preco no inicio da janela. */
  de: number
  /** Menor preco hoje. */
  para: number
}

export type DadosE15 = {
  nome: string
  cidade: string
  uf: string
  /** Inicio e fim da janela de 30 dias, "07/09" e "07/10". */
  desde: string
  ate: string
  /** Valor da colecao no inicio da janela e hoje (menor preco, Mercado Brasileiro). */
  valorInicio: number
  valorHoje: number
  subiram: number
  cairam: number
  /** A carta que mais subiu em R$. */
  destaque: CartaVariacaoE15
  /** Cartas que cairam: aparecem uma a uma, sem esconder. */
  quedas: CartaVariacaoE15[]
  /** As outras altas, somadas (os nomes ficam para o clique). */
  outrasAltas: { quantidade: number; soma: number }
}

const ID = 'e15'
const CATEGORIA = 'novidades' as const

const CSS = `@media only screen and (max-width:480px){
  .h2{font-size:20px!important;line-height:26px!important}
  .bloco{padding-left:14px!important;padding-right:14px!important}
  .selo{width:54px!important}
  .selo-td{width:64px!important}
  .e15-carta-td{width:112px!important;padding:16px 0 12px 14px!important}
  .e15-carta{width:104px!important}
  .e15-tags{padding:16px 14px 12px 12px!important}
  .e15-tag-px{padding:8px 12px!important}
  .e15-tag-v1{font-size:18px!important;line-height:22px!important}
  .e15-tag-v2{font-size:24px!important;line-height:28px!important}
}`

const variacao = (c: CartaVariacaoE15) => c.para - c.de
const pctVar = (c: CartaVariacaoE15) => (c.de > 0 ? ((c.para - c.de) / c.de) * 100 : 0)
const sinal = (v: number) => (v >= 0 ? `+${rs(v)}` : `&minus;${rs(-v)}`)

function montar(d: DadosE15, ctx: CtxRegua) {
  const pasta = `${URL_CANONICA}/minha-colecao`
  const total = d.valorHoje - d.valorInicio
  const dz = d.destaque
  const temOutras = d.outrasAltas.quantidade > 0
  const assunto = `${d.nome}, sua coleção subiu ${brl(total)} sem você`
  const preheader = `Só o ${dz.nome} somou ${brl(variacao(dz))} em 30 dias.${temOutras ? ' E ele não subiu sozinho.' : ''}`
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

  const destaque = `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.surface2}" style="background-color:${COR.surface2};border:1px solid ${COR.borda};border-radius:16px;">
          <tr><td style="padding:0;">
            <a href="${attr(utmRegua(pasta, ID, 'destaque'))}" target="_blank" style="text-decoration:none;display:block;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td class="e15-carta-td" width="150" valign="middle" style="width:150px;padding:20px 0 16px 24px;">
                <img class="e15-carta" src="${attr(dz.imagem)}" width="140" alt="${esc(dz.nome)}" style="display:block;width:140px;height:auto;border:0;border-radius:8px;color:${COR.texto2};${FONT}font-size:14px;background-color:${COR.borda};"/>
              </td>
              <td class="e15-tags" valign="middle" style="padding:20px 24px 16px 20px;${FONT}">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.borda2}" style="background-color:${COR.borda2};border-radius:10px;"><tr>
                  <td class="e15-tag-px" style="padding:10px 16px;${FONT}">
                    <p style="margin:0;font-size:14px;line-height:18px;font-weight:800;color:${COR.texto2};">${esc(d.desde)}</p>
                    <p class="e15-tag-v1" style="margin:0;font-size:22px;line-height:26px;font-weight:800;color:${COR.texto2};white-space:nowrap;">${rs(dz.de)}</p>
                  </td>
                </tr></table>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.texto}" style="margin-top:10px;background-color:${COR.texto};border-radius:10px;"><tr>
                  <td class="e15-tag-px" style="padding:10px 16px;${FONT}">
                    <p style="margin:0;font-size:14px;line-height:18px;font-weight:800;letter-spacing:0.06em;color:${COR.tinta};">HOJE</p>
                    <p class="e15-tag-v2" style="margin:0;font-size:30px;line-height:34px;font-weight:800;letter-spacing:-0.02em;color:${COR.tinta};white-space:nowrap;">${rs(dz.para)}</p>
                  </td>
                </tr></table>
              </td>
            </tr></table>
            </a>
          </td></tr>
          <tr><td class="bloco" style="padding:4px 20px 18px;${FONT}">
            <p style="margin:0 0 4px;font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${COR.ambar};">A carta que mais subiu</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td valign="top" style="${FONT}">
                <p style="margin:0;font-size:18px;line-height:24px;font-weight:800;color:${COR.texto};">${esc(dz.nome)}</p>
                <p style="margin:0;font-size:14px;line-height:20px;color:${COR.texto2};">${esc(dz.set)}</p>
              </td>
              <td align="right" valign="top" style="padding-left:8px;white-space:nowrap;${FONT}">
                <p style="margin:0;font-size:18px;line-height:24px;font-weight:800;color:${COR.verde};">${sinal(variacao(dz))}</p>
                <p style="margin:2px 0 0;font-size:14px;line-height:20px;font-weight:800;color:${COR.verde};">&#9650; ${pct(pctVar(dz))}</p>
              </td>
            </tr></table>
          </td></tr>
        </table>`

  const linhaQueda = (c: CartaVariacaoE15, primeira: boolean) => `
          <tr><td class="bloco" style="padding:14px 18px;${primeira ? '' : `border-top:1px solid ${COR.borda};`}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td class="selo-td" width="72" valign="middle" style="width:72px;"><img class="selo" src="${attr(c.imagem)}" width="60" alt="Carta ${esc(c.nome)}" style="display:block;width:60px;height:auto;border:0;border-radius:4px;color:${COR.texto2};${FONT}font-size:14px;background-color:${COR.surface2};"/></td>
              <td valign="middle" style="${FONT}">
                <p style="margin:0;font-size:16px;line-height:22px;font-weight:800;color:${COR.texto};">${esc(c.nome)}</p>
                <p style="margin:0 0 2px;font-size:14px;line-height:20px;color:${COR.texto2};">${esc(c.set)}</p>
                <p style="margin:0;font-size:14px;line-height:20px;color:${COR.texto2};">${esc(d.desde)}: <span style="white-space:nowrap;">${rs(c.de)}</span><br/>hoje: <span style="color:${COR.texto};font-weight:800;white-space:nowrap;">${rs(c.para)}</span></p>
              </td>
              <td align="right" valign="middle" style="padding-left:8px;white-space:nowrap;${FONT}">
                <p style="margin:0;font-size:16px;line-height:22px;font-weight:800;color:${COR.vermelho};">${sinal(variacao(c))}</p>
                <p style="margin:2px 0 0;font-size:14px;line-height:20px;font-weight:800;color:${COR.vermelho};">&#9660; ${pct(Math.abs(pctVar(c)))}</p>
              </td>
            </tr></table>
          </td></tr>`

  const linhaOutras = (primeira: boolean) => `
          <tr><td class="bloco" style="padding:14px 18px;${primeira ? '' : `border-top:1px solid ${COR.borda};`}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td class="selo-td" width="72" valign="middle" style="width:72px;"><img class="selo" src="${urlArte(ID, 'mini-versos.png')}" width="60" height="70" alt="Duas cartas viradas para baixo" style="display:block;width:60px;height:auto;border:0;color:${COR.texto2};${FONT}font-size:14px;background-color:${COR.surface2};"/></td>
              <td valign="middle" style="${FONT}">
                <p style="margin:0;font-size:16px;line-height:22px;font-weight:800;color:${COR.texto};">Mais ${plural(d.outrasAltas.quantidade, 'carta subiu', 'cartas subiram')}</p>
                <a href="${attr(utmRegua(pasta, ID, 'descobrir'))}" target="_blank" style="display:inline-block;padding:12px 0;margin:-10px 0 -12px;font-size:14px;line-height:20px;font-weight:800;color:${COR.ambar};text-decoration:underline;">${d.outrasAltas.quantidade === 1 ? 'Descobrir qual' : 'Descobrir quais'} &rarr;</a>
              </td>
              <td align="right" valign="middle" style="padding-left:8px;white-space:nowrap;${FONT}">
                <p style="margin:0;font-size:16px;line-height:22px;font-weight:800;color:${COR.verde};">${sinal(d.outrasAltas.soma)}</p>
                <p style="margin:2px 0 0;font-size:14px;line-height:20px;font-weight:800;color:${COR.verde};">&#9650; ${d.outrasAltas.quantidade === 1 ? 'em 30 dias' : 'somadas'}</p>
              </td>
            </tr></table>
          </td></tr>`

  const linhasResto = [
    ...d.quedas.map((c, i) => linhaQueda(c, i === 0)),
    ...(temOutras ? [linhaOutras(d.quedas.length === 0)] : []),
  ].join('')

  const conteudo = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="${COR.elevado}" style="background-color:${COR.elevado};">
        <a href="${attr(utmRegua(pasta, ID, 'hero'))}" target="_blank" style="text-decoration:none;">
          <img src="${attr(urlImagemPessoal('e15-postal', ctx.tokenImagem))}" width="600" height="590" alt="Cartão-postal da Bynx para ${esc(d.nome)}, em ${esc(d.cidade)}: desde ${esc(d.desde)} sua coleção ficou ${rs(total)} mais valiosa. ${plural(d.subiram, 'carta subiu', 'cartas subiram')} e ${plural(d.cairam, 'caiu', 'caíram')}. Selo com o ${esc(dz.nome)}." style="display:block;width:100%;max-width:600px;height:auto;border:0;color:${COR.texto};${FONT}font-size:16px;font-weight:700;line-height:24px;background-color:${COR.elevado};"/>
        </a>
      </td></tr>
    </table>
    ${linha(`
        <h1 class="h1" style="margin:0 0 10px;font-size:30px;line-height:36px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};">Seu fichário trabalhou sozinho.</h1>
        <p style="margin:0;font-size:16px;line-height:25px;color:${COR.texto2};">Em 30 dias, só o ${esc(dz.nome)} somou <span style="color:${COR.verde};font-weight:800;white-space:nowrap;">${rs(variacao(dz))}</span>.${temOutras ? ` <strong style="color:${COR.texto};">E ele não subiu sozinho.</strong>` : ''}</p>`, '20px 32px 0')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" align="left" style="padding:22px 32px 0;">
        ${btnRegua('Ver minha pasta', utmRegua(pasta, ID, 'cta'))}
        <p style="margin:12px 0 0;${FONT}font-size:14px;line-height:21px;color:${COR.texto2};">Quer vender alguma? Agora pessoa física também anuncia no Mercado e recebe pela Bynx, sem abrir loja.</p>
      </td></tr>
    </table>
    ${linha(destaque, '28px 32px 0')}
    ${linhasResto ? linha(`
        <h2 class="h2" style="margin:0 0 4px;font-size:22px;line-height:28px;font-weight:800;color:${COR.texto};">O resto da pasta</h2>
        <p style="margin:0 0 12px;font-size:14px;line-height:20px;color:${COR.texto2};">Menor preço do Mercado Brasileiro, de ${esc(d.desde)} a ${esc(d.ate)}.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.surface2}" style="background-color:${COR.surface2};border:1px solid ${COR.borda};border-radius:16px;">
          ${linhasResto}
        </table>`, '32px 32px 0') : ''}
    ${linha(`<p style="margin:0;font-size:16px;line-height:25px;color:${COR.texto2};">Enquanto você estava fora, nós seguimos atualizando o preço de cada carta da sua pasta. Ela está do jeito que você deixou, só que valendo mais.</p>`, '28px 32px 0')}`

  const html = layoutRegua({
    conteudo,
    campanha: ID,
    categoria: CATEGORIA,
    links: ctx.links,
    preheader,
    rotulo: 'Sua coleção · 30 dias',
    assinatura: true,
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  const rodape = ajustarRodape(html, CATEGORIA, { depois: ['Este cartão chega no máximo 3 vezes. Se você voltar, ele para.'] })
  return { assunto, preheader, html: comCss(rodape, CSS) }
}

export const E15: TemplateRegua<DadosE15> = {
  id: 'E15',
  nome: 'Winback: sua coleção mudou desde que você saiu',
  trilha: 'Reativar/limpar',
  categoria: CATEGORIA,
  // Persona de exemplo: Ana, 34, Belo Horizonte (PERSONAS.md secao 4). 4 cartas, precos reais
  // do pacote de 07/10 (altas_30d / quedas_30d): R$ 1.291,30 -> R$ 1.854,39.
  exemplo: {
    nome: 'Ana',
    cidade: 'Belo Horizonte',
    uf: 'MG',
    desde: '07/09',
    ate: '07/10',
    valorInicio: 1291.3,
    valorHoje: 1854.39,
    subiram: 3,
    cairam: 1,
    destaque: { nome: 'Charizard G LV.X', set: 'DP Black Star Promos', imagem: 'https://images.pokemontcg.io/dpp/DP45.png', de: 552.5, para: 989 },
    quedas: [{ nome: 'Ralts', set: 'Scarlet & Violet', imagem: 'https://images.pokemontcg.io/sv1/211.png', de: 299, para: 95.99 }],
    outrasAltas: { quantidade: 2, soma: 329.6 },
  },
  montar,
}
