/**
 * E11 - O que chegou: Metas (fechar a 151, a Mew ex que falta).
 * Trilha Novidades. Mockup aprovado: _Regua/mockups/E11-o-que-chegou.
 *
 * Arte:
 * - FIXA: /emails/regua/e11/folha-mew.jpg (a folha do fichario com o bolso da
 *   Mew ex vazio e a etiqueta FALTA ESTA; e a metade esquerda do hero
 *   aprovado, sem o cartao da meta) e os icones icone-meta.png / icone-sino.png.
 * - O cartao da meta (metade direita do hero) virou HTML: o preco da Mew ex
 *   muda por edicao e vai em TEXTO VIVO, junto com o teto de exemplo do aviso.
 * Sem dado pessoal: o E11 e igual para todo o segmento; so o preco do dia muda.
 */
import { btnRegua, blocoPromocao, layoutRegua, utmRegua, URL_CANONICA } from '@/lib/email'
import { brl, urlArte, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { COR, FONT, attr, linha, rs } from './ui-b'

export type DadosE11 = {
  /** Menor preco da Mew ex 151 (sv3pt5/151) no Mercado Brasileiro no dia do envio. */
  precoMewHoje: number
  /** Teto de EXEMPLO do aviso de preco (abaixo do preco de hoje). */
  tetoAviso: number
}

const ID = 'e11'
const TOTAL_151 = 207

const CSS = `@media only screen and (max-width:480px){
  .topo{padding:10px 16px 8px!important}
  .h1{font-size:27px!important;line-height:32px!important}
  .sobe{padding-top:18px!important}
  .e11-meta-td{padding:10px 10px 10px 2px!important}
  .e11-meta{padding:12px 12px!important}
  .e11-cab{font-size:14px!important;line-height:18px!important}
  .e11-ico{width:16px!important;height:16px!important}
  .e11-nome{font-size:19px!important;line-height:24px!important;margin-top:4px!important}
  .e11-rot{font-size:14px!important;line-height:18px!important}
  .e11-valor{font-size:24px!important;line-height:28px!important}
  .e11-hoje{font-size:14px!important}
  .e11-apoio{margin-top:8px!important}
  .e11-sino-td{padding:6px 0 6px 8px!important}
  .e11-apoio-txt{font-size:14px!important;line-height:18px!important;padding:6px 6px 6px 6px!important}
  .e11-hr{margin:8px 0 6px!important}
  .e11-sino{width:16px!important;height:16px!important}
}`

function montar(d: DadosE11, ctx: CtxRegua) {
  const preco = rs(d.precoMewHoje)
  const destino = `${URL_CANONICA}/metas?nova=set:sv3pt5`
  const cta = utmRegua(destino, ID, 'cta')
  const hero = utmRegua(destino, ID, 'hero')
  const assunto = `A Mew ex da 151 está a ${brl(d.precoMewHoje)}. Falta na sua?`
  const preheader = `Um toque e a meta da 151 abre pronta: as ${TOTAL_151} cartas, o que falta e o menor preço de cada uma. A Mew ex está a ${brl(d.precoMewHoje)} hoje.`

  const cartaoMeta = `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.surface2}" style="background-color:${COR.surface2};border:1px solid ${COR.borda2};border-radius:16px;">
            <tr><td class="e11-meta" style="padding:18px 20px;${FONT}">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td valign="middle" style="padding-right:8px;"><img class="e11-ico" src="${urlArte(ID, 'icone-meta.png')}" width="20" height="20" alt="" style="display:block;width:20px;height:20px;border:0;"/></td>
                <td valign="middle" class="e11-cab" style="${FONT}font-size:18px;line-height:22px;font-weight:700;color:${COR.texto2};white-space:nowrap;">Meta &middot; ${TOTAL_151} cartas</td>
              </tr></table>
              <p class="e11-nome" style="margin:6px 0 0;font-size:26px;line-height:30px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};white-space:nowrap;">Fechar a 151</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e11-hr" style="margin:12px 0 10px;"><tr><td height="1" bgcolor="${COR.borda2}" style="height:1px;padding:0;font-size:1px;line-height:1px;background-color:${COR.borda2};">&nbsp;</td></tr></table>
              <p class="e11-rot" style="margin:0;font-size:18px;line-height:22px;font-weight:800;color:${COR.ambar};white-space:nowrap;">Falta: Mew ex</p>
              <p class="e11-valor" style="margin:2px 0 0;font-size:34px;line-height:38px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};white-space:nowrap;">${preco} <span class="e11-hoje" style="font-size:18px;font-weight:700;letter-spacing:0;color:${COR.texto2};">hoje</span></p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e11-apoio" style="margin-top:12px;border:1px dashed ${COR.borda2};border-radius:12px;"><tr>
                <td valign="middle" width="22" class="e11-sino-td" style="padding:10px 0 10px 12px;width:22px;"><img class="e11-sino" src="${urlArte(ID, 'icone-sino.png')}" width="20" height="20" alt="" style="display:block;width:20px;height:20px;border:0;"/></td>
                <td valign="middle" class="e11-apoio-txt" style="padding:10px 12px 10px 8px;${FONT}font-size:16px;line-height:20px;font-weight:700;color:${COR.texto2};white-space:nowrap;">Aviso de preço<br/><span style="color:${COR.texto};font-weight:800;white-space:nowrap;">até ${rs(d.tetoAviso)}</span></td>
              </tr></table>
            </td></tr>
          </table>`

  const passo = (n: number, titulo: string, texto: string, ultimo: boolean) => `
              <tr>
                <td width="40" valign="top" style="width:40px;padding:12px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="tinta" width="28" height="28" align="center" valign="middle" bgcolor="${COR.ambar}" style="width:28px;height:28px;border-radius:999px;background-color:${COR.ambar};background-image:linear-gradient(135deg,#f59e0b,#ef4444);${FONT}font-size:14px;line-height:28px;font-weight:800;color:${COR.tinta};">${n}</td></tr></table></td>
                <td valign="top" style="padding:12px 0;${ultimo ? '' : `border-bottom:1px solid ${COR.borda2};`}${FONT}">
                  <p style="margin:0;font-size:16px;line-height:24px;font-weight:700;color:${COR.texto};">${titulo}</p>
                  <p style="margin:2px 0 0;font-size:15px;line-height:22px;color:${COR.texto2};">${texto}</p>
                </td>
              </tr>`

  const conteudo = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="${COR.elevado}" style="background-color:${COR.elevado};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="52%" valign="middle" style="width:52%;padding:0;font-size:0;line-height:0;">
            <a href="${attr(hero)}" target="_blank" style="text-decoration:none;display:block;"><img src="${urlArte(ID, 'folha-mew.jpg')}" width="312" alt="Ilustração: em uma folha de fichário, o bolso da Mew ex da 151 está vazio, com contorno âmbar e a etiqueta Falta esta." style="display:block;width:100%;max-width:312px;height:auto;border:0;color:${COR.texto};${FONT}font-size:16px;font-weight:700;line-height:24px;background-color:${COR.surface2};"/></a>
          </td>
          <td class="e11-meta-td" width="48%" valign="middle" style="width:48%;padding:16px 16px 16px 4px;">
            <a href="${attr(hero)}" target="_blank" style="text-decoration:none;display:block;">${cartaoMeta}</a>
          </td>
        </tr></table>
      </td></tr>
    </table>
    ${linha(`<h1 class="h1" style="margin:0;font-size:30px;line-height:36px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};">Falta a Mew ex? Comece a meta da&nbsp;151.</h1>`, '24px 32px 0', 'sobe')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" align="left" style="padding:16px 32px 0;">
        ${btnRegua('Criar a minha meta da 151', cta)}
        <p style="margin:10px 0 0;${FONT}font-size:14px;line-height:20px;color:${COR.texto2};">A meta abre pronta, com as ${TOTAL_151} cartas e o menor preço de cada uma no Mercado Brasileiro. A Mew ex está a ${preco} hoje.&nbsp;Grátis.</p>
      </td></tr>
    </table>
    ${linha(`
        <p style="margin:0 0 14px;font-size:20px;line-height:26px;font-weight:800;letter-spacing:-0.01em;color:${COR.texto};">Dois passos e acabou</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.surface2}" style="background-color:${COR.surface2};border:1px solid ${COR.borda};border-radius:16px;">
          <tr><td style="padding:8px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${passo(1, 'Toque no botão: a meta da 151 já abre criada', 'Metas é novo na Bynx. Começa em 0%, mesmo com a coleção vazia. Marque as que já tem e a Mew ex fica na lista do que falta, com o menor preço.', false)}
              ${passo(2, 'Quer pagar menos? Toque no sino da Mew', `Ponha um teto abaixo do preço de hoje, como ${rs(d.tetoAviso)}. Você só recebe aviso quando alguém anunciar a Mew na Bynx até esse valor. Acima dele, silêncio.`, true)}
            </table>
          </td></tr>
        </table>`, '32px 32px 0')}
    ${linha(`
        <p style="margin:0;font-size:16px;line-height:25px;color:${COR.texto};">Saber o que falta e quanto custa fica por nossa conta: a meta faz a conta carta por carta. O seu trabalho é só marcar o que já tem.</p>`, '24px 32px 0')}`

  const ps = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;"><tr>
          <td style="border-top:1px dashed ${COR.borda2};padding-top:16px;${FONT}">
            <p style="margin:0;font-size:16px;line-height:25px;color:${COR.texto};"><span style="font-weight:800;color:${COR.ambar};">P.S.</span> Ainda não fecha set nenhum? A meta também vale para um Pokémon: escolha o seu favorito e a Bynx mostra todas as cartas dele, cada uma com o menor preço.</p>
          </td>
        </tr></table>`

  const html = layoutRegua({
    conteudo,
    campanha: ID,
    categoria: 'novidades',
    links: ctx.links,
    preheader,
    assinatura: true,
    respiroAssinatura: 12,
    psDepoisDoLogo: ps,
    css: CSS,
    promocao: blocoPromocao('destaque', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E11: TemplateRegua<DadosE11> = {
  id: 'E11',
  nome: 'O que chegou: Metas (fechar a 151, a Mew ex que falta)',
  trilha: 'Novidades',
  categoria: 'novidades',
  exemplo: { precoMewHoje: 34, tetoAviso: 29.9 },
  montar,
}
