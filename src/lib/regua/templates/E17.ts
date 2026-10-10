/**
 * E17 - Seu 2026 na Bynx (retrospectiva; a mais valiosa fica de costas).
 * Trilha Reativar/retrospectiva. Mockup aprovado: _Regua/mockups/E17-seu-2026.
 * BLOQUEIO DE ENVIO: a pagina /2026 (virar a carta) ainda nao existe.
 * Variante "E17 cheio" (10+ cartas). A "E17b curta" (1 a 9) nao foi desenhada.
 *
 * Arte:
 * - FIXA: /emails/regua/e17/trofeu-verso.jpg (a carta de costas do trofeu 5).
 * - PESSOAL (cartas e numeros da pessoa desenhados), pela rota de imagem.
 *   Todas: JPG opaco, fundo #080a0f, render 2x; ?exemplo=1 desenha a Marina.
 *
 * ROTA /api/email/img/e17-stories: 600x400. Tres telas de Stories em leque.
 *   Esquerda: "11" ambar->vermelho + "cartas" + "8 diferentes" + pilha de cartas.
 *   Direita: "3" + "repetidas" + "R$ 130,80" em verde + 3 cartas pequenas.
 *   Centro, na frente: "A mais valiosa do seu ano", uma carta de COSTAS (verso
 *   Bynx) com etiqueta "R$ ?" e a pilula "toque para virar". Nunca o nome nem o
 *   valor da mais valiosa. Dados: cartasHoje, diferentes, repetidas.quantidade/valor.
 *   Ref.: mockups/E17-seu-2026/assets/hero-stories.html.
 * ROTA /api/email/img/e17-trofeu-cartas: 244x136. A primeira carta (imagem
 *   oficial) a esquerda, seta tracejada ambar, pilha com as 2 cartas mais recentes.
 *   Ref.: assets/trofeu-cartas.html.
 * ROTA /api/email/img/e17-trofeu-fichario: 244x136. Pagina 3x3 com as cartas
 *   diferentes da pessoa (ate 8) e a mais valiosa de COSTAS no centro; etiqueta
 *   branca "R$" amarrada. Ref.: assets/trofeu-fichario.html.
 * ROTA /api/email/img/e17-trofeu-repetidas: 244x136. As repetidas lado a lado
 *   (ate 3), cada uma com a copia gemea atras e o selo verde com o numero de copias.
 *   Ref.: assets/trofeu-set.html.
 * ROTA /api/email/img/e17-trofeu-primeira: 244x136. A primeira carta com brilho
 *   e a etiqueta branca com a data curta ("18 MAI"). Ref.: assets/trofeu-primeira.html.
 *
 * Todo numero da pessoa tambem vai em TEXTO VIVO nas legendas dos trofeus.
 * Categoria 'colecao'; o motivo do rodape e o aprovado ("e cartas na sua colecao").
 */
import { btnRegua, blocoPromocao, layoutRegua, utmRegua, URL_CANONICA } from '@/lib/email'
import { urlArte, urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { COR, FONT, attr, esc, linha, rs } from './ui-b'

export type DadosE17 = {
  nome: string
  /** Mes de entrada por extenso, minusculo ("maio"), e quantas cartas tinha no fim dele. */
  mesEntrada: string
  cartasFimMesEntrada: number
  cartasHoje: number
  diferentes: number
  /** Maior salto mensal em quantidade. */
  maiorSalto: { mes: string; cartas: number }
  /** Soma das cartas pelo menor preco do Mercado Brasileiro. */
  valorFichario: number
  /** Repetidas nao anunciadas: quantidade, soma e nomes. */
  repetidas: { quantidade: number; valor: number; nomes: string[] }
  /** Primeira carta da colecao: data por extenso e nome. */
  primeira: { data: string; nome: string }
  /** A mais valiosa vale hoje mais do que no dia em que entrou? */
  maisValiosaSubiu: boolean
}

const ID = 'e17'
const CATEGORIA = 'colecao' as const

const CSS = `@media only screen and (max-width:480px){
  .tv{font-size:22px!important;line-height:28px!important}
  .tv-rs{font-size:14px!important}
  .tr-px{padding:10px 10px 14px!important}
  .cap{height:60px!important}
  .gap{width:10px!important}
  .verso-td{width:104px!important}
  .verso-img{width:96px!important;height:auto!important}
}`

function listaNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes.join('')
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

function montar(d: DadosE17, ctx: CtxRegua) {
  const pagina = `${URL_CANONICA}/2026`
  const link = (conteudo: string, ancora = '') => attr(`${utmRegua(pagina, ID, conteudo)}${ancora}`)
  const assunto = `${d.nome}, a sua carta de 2026 ainda está de costas`
  const preheader = d.maisValiosaSubiu
    ? 'Ela vale hoje mais do que no dia em que entrou no seu fichário. Vire para ver quanto.'
    : 'A mais valiosa do seu ano está esperando você virar.'
  const apoioH1 = d.maisValiosaSubiu
    ? 'A mais valiosa vale hoje mais do que no dia em que entrou no seu fichário.'
    : 'A mais valiosa está esperando você virar.'
  const sec = 'rgba(255,255,255,.62)'

  const trofeu = (o: { tipo: string; conteudo: string; ancora?: string; alt: string; rotulo: string; valor: string; legenda: string; ordem: number }) => `
            <td class="tr-td" width="48%" valign="top" bgcolor="${COR.fundo}" style="padding:0;background-color:${COR.fundo};border:1px solid ${COR.borda};border-radius:16px;">
              <a href="${link(o.conteudo, o.ancora)}" target="_blank" style="text-decoration:none;display:block;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="padding:8px 8px 0;"><img class="tr-img" src="${attr(urlImagemPessoal(o.tipo, ctx.tokenImagem))}" width="244" height="136" alt="${o.alt}" style="display:block;width:100%;max-width:244px;height:auto;border:0;border-radius:10px;color:${COR.texto};${FONT}font-size:14px;font-weight:700;line-height:20px;background-color:${COR.fundo};"/></td></tr>
                <tr><td class="tr-px" style="padding:12px 14px 16px;${FONT}">
                  <p style="margin:0 0 4px;font-size:14px;line-height:18px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${COR.ambar};white-space:nowrap;">${o.rotulo}</p>
                  <p class="tv" style="margin:0 0 6px;font-size:28px;line-height:32px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};white-space:nowrap;">${o.valor}</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="cap" height="40" valign="top" style="height:40px;${FONT}font-size:14px;line-height:20px;color:${sec};">${o.legenda}</td></tr></table>
                  <p style="margin:8px 0 0;font-size:14px;line-height:18px;font-weight:700;color:${sec};">${o.ordem} de 5</p>
                </td></tr>
              </table></a>
            </td>`
  const valorRs = (v: number) => {
    const [, numero] = rs(v).split('&nbsp;')
    return `<span class="tv-rs" style="font-size:17px;">R$&nbsp;</span>${numero}`
  }
  const vao = `<td class="gap" width="4%" style="width:4%;min-width:10px;font-size:1px;line-height:1px;">&nbsp;</td>`
  const espaco = `<tr><td colspan="3" height="16" style="height:16px;font-size:1px;line-height:1px;">&nbsp;</td></tr>`
  const nomesRep = listaNomes(d.repetidas.nomes)

  const conteudo = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="${COR.elevado}" style="background-color:${COR.elevado};">
        <a href="${link('hero')}" target="_blank" style="text-decoration:none;display:block;">
          <img src="${attr(urlImagemPessoal('e17-stories', ctx.tokenImagem))}" width="600" height="400" alt="Sua retrospectiva em três telas de Stories: ${esc(d.cartasHoje)} cartas, ${esc(d.diferentes)} diferentes; ${esc(d.repetidas.quantidade)} repetidas, ${rs(d.repetidas.valor)}; e, na frente, a carta mais valiosa do seu ano de costas, com o preço escondido. Toque para virar." style="display:block;width:100%;max-width:600px;height:auto;border:0;color:${COR.texto};${FONT}font-size:16px;font-weight:700;line-height:24px;background-color:${COR.elevado};"/>
        </a>
      </td></tr>
    </table>
    ${linha(`
        <h1 class="h1" style="margin:0 0 10px;font-size:30px;line-height:36px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};">Uma carta do seu ano ainda está de costas.</h1>
        <p style="margin:0;font-size:16px;line-height:25px;color:${sec};">Você terminou ${esc(d.mesEntrada)} com ${esc(d.cartasFimMesEntrada)} ${d.cartasFimMesEntrada === 1 ? 'carta' : 'cartas'} e fecha o ano com ${esc(d.cartasHoje)}. <span style="color:${COR.texto};font-weight:700;">${apoioH1}</span></p>`, '22px 32px 0')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" align="left" style="padding:22px 32px 8px;">
        ${btnRegua('Virar a minha carta', utmRegua(pagina, ID, 'cta'))}
      </td></tr>
    </table>
    ${linha(`
        <p style="margin:0 0 4px;font-size:21px;line-height:27px;font-weight:800;color:${COR.texto};">O seu ano em 5 cartas</p>
        <p style="margin:0 0 14px;font-size:14px;line-height:20px;color:${sec};">Quatro estão abertas. A quinta você vira na Bynx.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${trofeu({ tipo: 'e17-trofeu-cartas', conteudo: 'trofeu-cartas', alt: `${esc(d.primeira.nome)} em ${esc(d.mesEntrada)} e, hoje, uma pilha de ${esc(d.cartasHoje)} cartas.`, rotulo: 'Na coleção', valor: `${esc(d.cartasHoje)} cartas`, legenda: `${esc(d.maiorSalto.mes)} foi o seu maior salto: +${esc(d.maiorSalto.cartas)} ${d.maiorSalto.cartas === 1 ? 'carta' : 'cartas'} em um mês.`, ordem: 1 })}
            ${vao}
            ${trofeu({ tipo: 'e17-trofeu-fichario', conteudo: 'trofeu-fichario', alt: `Página de fichário com as suas ${esc(d.diferentes)} cartas diferentes; a mais valiosa está de costas. Etiqueta de preço amarrada.`, rotulo: 'O fichário hoje', valor: valorRs(d.valorFichario), legenda: `As ${esc(d.cartasHoje)} somadas pelo menor preço do Mercado Brasileiro.`, ordem: 2 })}
          </tr>
          ${espaco}
          <tr>
            ${trofeu({ tipo: 'e17-trofeu-repetidas', conteudo: 'trofeu-repetidas', ancora: '#repetidas', alt: `${esc(nomesRep)}, duas cópias de cada.`, rotulo: 'Para vender', valor: valorRs(d.repetidas.valor), legenda: `${esc(d.repetidas.quantidade)} ${d.repetidas.quantidade === 1 ? 'repetida' : 'repetidas'}: ${esc(nomesRep)}.`, ordem: 3 })}
            ${vao}
            ${trofeu({ tipo: 'e17-trofeu-primeira', conteudo: 'trofeu-primeira', alt: `${esc(d.primeira.nome)}, a sua primeira carta, com uma etiqueta: ${esc(d.primeira.data)}.`, rotulo: 'A primeira', valor: esc(d.primeira.data), legenda: `Um ${esc(d.primeira.nome)}. Foi assim que começou.`, ordem: 4 })}
          </tr>
          ${espaco}
          <tr><td colspan="3" style="padding:0;">
            <a href="${link('trofeu-mais-valiosa')}" target="_blank" style="text-decoration:none;display:block;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.fundo}" style="background-color:${COR.fundo};border:1px solid ${COR.ambar};border-radius:16px;">
              <tr>
                <td class="verso-td" width="158" valign="middle" style="padding:8px 0 8px 8px;">
                  <img class="verso-img" src="${urlArte(ID, 'trofeu-verso.jpg')}" width="150" height="190" alt="Uma carta de costas: a mais valiosa do seu ano. Toque para virar." style="display:block;width:150px;height:auto;border:0;border-radius:10px;color:${COR.texto};${FONT}font-size:14px;font-weight:700;line-height:20px;background-color:${COR.fundo};"/>
                </td>
                <td valign="middle" style="padding:16px 16px 16px 14px;${FONT}">
                  <p style="margin:0 0 4px;font-size:14px;line-height:18px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${COR.ambar};">A mais valiosa</p>
                  <p style="margin:0 0 6px;font-size:22px;line-height:28px;font-weight:800;color:${COR.texto};">${d.maisValiosaSubiu ? 'Quanto ela subiu desde que entrou?' : 'Qual foi a carta do seu ano?'}</p>
                  <p style="margin:0;font-size:14px;line-height:21px;color:${sec};">O preço de hoje ao lado do preço do dia em que ela chegou.</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tr>
                    <td valign="middle" style="padding:0;${FONT}font-size:16px;line-height:22px;font-weight:800;color:${COR.ambar};text-decoration:underline;white-space:nowrap;">Virar a carta&nbsp;&rsaquo;</td>
                    <td valign="middle" style="padding-left:14px;${FONT}font-size:14px;line-height:18px;font-weight:700;color:${sec};white-space:nowrap;">5 de 5</td>
                  </tr></table>
                </td>
              </tr>
            </table></a>
          </td></tr>
        </table>`, '28px 32px 0')}
    ${linha(`<p style="margin:0;font-size:16px;line-height:25px;color:${sec};">Valeu por ter colocado o seu ano aqui dentro. A Bynx nasceu em abril, e você está com a gente desde ${esc(d.mesEntrada)}. Por isso guardamos a melhor carta para o fim: <a href="${link('texto-fim')}" target="_blank" style="color:${COR.ambar};font-weight:800;text-decoration:underline;">${d.maisValiosaSubiu ? 'ver quanto ela subiu' : 'ver qual é'}</a>.</p>`, '28px 32px 0')}`

  const html = layoutRegua({
    conteudo,
    campanha: ID,
    categoria: CATEGORIA,
    links: ctx.links,
    preheader,
    rotulo: 'Retrospectiva 2026',
    assinatura: true,
    motivo: 'Você recebe porque tem conta na Bynx e cartas na sua coleção.',
    css: CSS,
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E17: TemplateRegua<DadosE17> = {
  id: 'E17',
  nome: 'Seu 2026 na Bynx',
  trilha: 'Reativar/retrospectiva',
  categoria: CATEGORIA,
  // Persona de exemplo: Marina, 31, Sao Paulo (PERSONAS.md secao 2). 11 cartas, 8 diferentes,
  // R$ 1.955,30; repetidas Kangaskhan R$ 69,90 + Mew ex R$ 34,00 + Pikachu de 1999 R$ 26,90.
  exemplo: {
    nome: 'Marina',
    mesEntrada: 'maio',
    cartasFimMesEntrada: 2,
    cartasHoje: 11,
    diferentes: 8,
    maiorSalto: { mes: 'Agosto', cartas: 3 },
    valorFichario: 1955.3,
    repetidas: { quantidade: 3, valor: 130.8, nomes: ['Kangaskhan', 'Mew ex', 'Pikachu de 1999'] },
    primeira: { data: '18 de maio', nome: 'Pikachu de 1999' },
    maisValiosaSubiu: true,
  },
  montar,
}
