/**
 * E19 - Pre-grading: saiba a nota antes de mandar para a graduadora.
 * Trilha Novidades. Mockup aprovado: _Regua/mockups/E19-servicos-restauracao.
 *
 * Arte:
 * - FIXA: /emails/regua/e19/bancada-video.jpg (miniatura do video da bancada).
 * - PESSOAL: o hero e a carta da pessoa na bancada, com o nome no laudo:
 *   urlImagemPessoal('e19-bancada', token).
 *
 * ROTA /api/email/img/e19-bancada (a fazer em outra fase):
 *   dados: a carta mais valiosa NAO graduada da pessoa (imagem oficial e nome).
 *   tamanho: 600x360 (render 2x = 1200x720), JPG, fundo #0d0f14 opaco.
 *   layout: bancada escura. A carta a esquerda com regua milimetrada em cima e
 *     marcadores numerados 1 a 4 (centralizacao, bordas, superficie, cantos); lupa
 *     ampliando o canto inferior. A direita, o laudo: "LAUDO" + nome da carta, os 4
 *     itens com pontilhado e, embaixo, a caixa ambar->vermelho "Nota provavel ?".
 *   referencia exata: mockups/E19-servicos-restauracao/assets/hero.html.
 *   ?exemplo=1: Giratina V (Lost Origin 186), persona Marina.
 *
 * Preco, prazos e a restauracao vem de src/lib/servicos.ts (mesma fonte da
 * landing /pre-grading). A alta so entra se passar na regra do meta.json
 * (positiva em 7 dias, nao caindo de novo, nao e pico isolado); senao `alta: null`.
 */
import { btnRegua, blocoPromocao, layoutRegua, utmRegua, URL_CANONICA } from '@/lib/email'
import { brl, urlArte, urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { PRAZOS, PRECOS } from '@/lib/servicos'
import { COR, FONT, attr, esc, linha, rs } from './ui-b'

export type DadosE19 = {
  carta: { nome: string; set: string }
  /** Menor preco hoje no Mercado Brasileiro. */
  preco: number
  /** Alta recente que passou na regra; null = assunto e ponte sem o trecho verde. */
  alta: { valor: number; dias: number } | null
}

const ID = 'e19'
const PRECO_PG = PRECOS?.preGrading ?? 80
const PRECO_REST = PRECOS?.restauracao ?? 165
const DIAS_LAUDO = PRAZOS.padraoDiasUteis ?? 5
const ORCAMENTO = PRAZOS.orcamento ?? '48 horas'

const CSS = `@media only screen and (max-width:480px){
  .topo{padding:14px 16px 10px!important}
  .h1{font-size:26px!important;line-height:31px!important}
  .h1-td{padding-top:18px!important}
  .cta-td{padding-top:18px!important}
  .h2{font-size:21px!important;line-height:27px!important}
  .vid-txt{padding-left:14px!important}
  .vid-img{width:104px!important}
  .vid-img img{width:104px!important}
  .preco{font-size:20px!important}
}`

function montar(d: DadosE19, ctx: CtxRegua) {
  const destino = `${URL_CANONICA}/pre-grading`
  const nome = esc(d.carta.nome)
  const assunto = d.alta
    ? `Seu ${d.carta.nome} subiu ${brl(d.alta.valor)}. Ele tira 10?`
    : `Seu ${d.carta.nome} tira 9 ou 10?`
  const preheader = `Antes de pagar graduadora, frete e meses de espera, saiba a faixa de nota provável. ${brl(PRECO_PG)} por carta.`
  const video = attr(`${utmRegua(destino, ID, 'video')}#videos`)

  const barra = (cor: string, grad = false) =>
    `<td width="13%" height="6" bgcolor="${cor}" style="height:6px;font-size:1px;line-height:6px;background-color:${cor};${grad ? 'background-image:linear-gradient(135deg,#f59e0b,#ef4444);' : ''}border-radius:999px;">&nbsp;</td>`
  const gap = `<td width="1.5%" style="font-size:1px;line-height:6px;">&nbsp;</td>`
  const etapas = [barra(COR.verde), barra(COR.verde), barra(COR.ambar, true), barra(COR.borda2), barra(COR.borda2), barra(COR.borda2), barra(COR.borda2)].join(gap)

  const conteudo = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="${COR.elevado}" style="background-color:${COR.elevado};">
        <a href="${attr(utmRegua(destino, ID, 'hero'))}" target="_blank" style="text-decoration:none;">
          <img src="${attr(urlImagemPessoal('e19-bancada', ctx.tokenImagem))}" width="600" height="360" alt="Seu ${nome} na bancada: régua milimetrada sobre a carta, lupa ampliando o canto e um laudo em branco. Nota provável ?" style="display:block;width:100%;max-width:600px;height:auto;border:0;color:${COR.texto};${FONT}font-size:16px;font-weight:700;line-height:24px;background-color:${COR.surface2};"/>
        </a>
      </td></tr>
    </table>
    ${linha(`
        <h1 class="h1" style="margin:0 0 14px;font-size:30px;line-height:36px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};">Seu ${nome} tira 9&nbsp;ou&nbsp;10?</h1>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.surface2}" style="background-color:${COR.surface2};border:1px solid ${COR.borda};border-radius:12px;">
          <tr>
            <td width="100%" valign="middle" style="padding:12px 0 0 16px;${FONT}">
              <p style="margin:0;font-size:16px;line-height:22px;font-weight:800;color:${COR.texto};">${nome} <span style="font-weight:400;color:${COR.texto2};">&middot; ${esc(d.carta.set)}</span></p>
            </td>
            <td align="right" valign="middle" style="padding:12px 16px 0 10px;${FONT}white-space:nowrap;">
              <p class="preco" style="margin:0;font-size:22px;line-height:26px;font-weight:800;color:${COR.texto};white-space:nowrap;">${rs(d.preco)}</p>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:8px 16px 12px;${FONT}">
              <p style="margin:0;font-size:15px;line-height:21px;color:${COR.texto2};">${d.alta ? `<strong style="color:${COR.verde};">+${rs(d.alta.valor)} em ${esc(d.alta.dias)} dias</strong> no Mercado Brasileiro. ` : ''}<span style="color:${COR.texto};">Antes de pagar a graduadora, saiba se vale a pena mandar.</span></p>
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0;font-size:16px;line-height:24px;color:${COR.texto2};">Graduar custa taxa, frete e meses de espera, e a nota pode voltar um 7. Na bancada da Bynx, nós medimos a carta antes e dizemos a <strong style="color:${COR.texto};">faixa provável</strong>.</p>`, '24px 32px 0', 'h1-td')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px cta-td" align="left" style="padding:20px 32px 0;">
        ${btnRegua('Descobrir a nota provável', utmRegua(destino, ID, 'cta'))}
        <p style="margin:10px 0 0;${FONT}font-size:14px;line-height:21px;color:${COR.texto2};"><strong style="color:${COR.texto};">${rs(PRECO_PG)} por carta</strong>, mais o frete de volta. O orçamento pelas fotos sai em até ${esc(ORCAMENTO)}, e você só envia a carta depois de aprovar.</p>
      </td></tr>
    </table>
    ${linha(`
        <h2 class="h2" style="margin:0 0 6px;font-size:22px;line-height:28px;font-weight:800;letter-spacing:-0.01em;color:${COR.texto};">Assim você acompanha a sua carta</h2>
        <p style="margin:0 0 14px;font-size:14px;line-height:21px;color:${COR.texto2};">Cada etapa deixa registro na sua conta: vídeo da abertura, fotos na entrada e na saída e número de custódia.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.surface2}" style="background-color:${COR.surface2};border:1px solid ${COR.borda};border-radius:16px;">
          <tr><td style="padding:14px 16px 0;${FONT}">
            <p style="margin:0;font-size:14px;line-height:20px;color:${COR.texto2};">Meus serviços &middot; exemplo</p>
            <p style="margin:2px 0 10px;font-size:16px;line-height:22px;color:${COR.texto2};">Pré-grading &middot; Etapa 3 de 7 &middot; <strong style="color:${COR.texto};">Chegada</strong></p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${etapas}</tr></table>
          </td></tr>
          <tr><td style="padding:12px 16px 14px;${FONT}">
            <p style="margin:0;font-size:16px;line-height:23px;color:${COR.texto2};"><strong style="color:${COR.texto};">Agora:</strong> a carta chegou. Abrimos o pacote em vídeo e estamos fotografando cada canto e borda na mesma luz.</p>
          </td></tr>
        </table>`, '36px 32px 0')}
    ${linha(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.surface2}" style="background-color:${COR.surface2};border:1px solid ${COR.borda};border-radius:16px;">
          <tr>
            <td class="vid-img" width="134" valign="top" style="padding:14px 0 14px 14px;">
              <a href="${video}" target="_blank" style="text-decoration:none;"><img src="${urlArte(ID, 'bancada-video.jpg')}" width="120" height="160" alt="Vídeo da bancada: mãos com cartas no toploader" style="display:block;width:120px;height:auto;border:0;border-radius:12px;color:${COR.texto2};${FONT}font-size:14px;line-height:20px;background-color:${COR.borda};"/></a>
            </td>
            <td class="vid-txt" valign="middle" style="padding:14px 18px;${FONT}">
              <p style="margin:0 0 6px;font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${COR.ambar};">Vídeo da bancada</p>
              <p style="margin:0 0 6px;font-size:18px;line-height:24px;font-weight:800;color:${COR.texto};">Como medimos a centralização</p>
              <p style="margin:0 0 10px;font-size:16px;line-height:23px;color:${COR.texto2};">O mesmo exame que a sua carta recebe.</p>
              <a href="${video}" target="_blank" style="font-size:16px;line-height:24px;font-weight:800;color:${COR.ambar};text-decoration:none;">Assistir ao vídeo &rarr;</a>
            </td>
          </tr>
        </table>`, '12px 32px 0')}
    ${linha(`
        <p style="margin:0;font-size:16px;line-height:24px;color:${COR.texto2};"><strong style="color:${COR.texto};">O laudo sai em ${esc(DIAS_LAUDO)} dias úteis</strong> depois que a carta chega, com a faixa provável (por exemplo, 8&nbsp;a&nbsp;9) e a graduadora indicada. A nota final é sempre da graduadora. Se o laudo disser que não vale mandar, os ${rs(PRECO_PG)} pagaram justamente essa resposta.</p>
        <p style="margin:8px 0 0;font-size:14px;line-height:21px;color:${COR.texto2};">Também restauramos cartas, a partir de ${rs(PRECO_REST)}, com orçamento pelas fotos.</p>`, '28px 32px 0')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" align="left" style="padding:24px 32px 8px;">
        ${btnRegua('Descobrir a nota provável', utmRegua(destino, ID, 'cta-fim'))}
      </td></tr>
    </table>`

  const html = layoutRegua({
    conteudo,
    campanha: ID,
    categoria: 'novidades',
    links: ctx.links,
    preheader,
    rotulo: 'Novo na Bynx · Serviços',
    assinatura: true,
    css: CSS,
    promocao: blocoPromocao('destaque', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E19: TemplateRegua<DadosE19> = {
  id: 'E19',
  nome: 'Pré-grading: saiba a nota antes de mandar para a graduadora',
  trilha: 'Novidades',
  categoria: 'novidades',
  // Persona de exemplo: Marina (PERSONAS.md). Giratina V, Lost Origin 186: R$ 1.299,90 de menor
  // preco em 07/10, +R$ 510,90 em 7 dias (altas_7d, base R$ 789,00). No envio, recalcular a alta.
  exemplo: {
    carta: { nome: 'Giratina V', set: 'Lost Origin' },
    preco: 1299.9,
    alta: { valor: 510.9, dias: 7 },
  },
  montar,
}
