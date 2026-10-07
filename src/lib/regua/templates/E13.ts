/**
 * E13 - Leilao: seu lance foi superado (aviso no meio da rodada).
 * Trilha Leilao. Mockup aprovado: _Regua/mockups/E13-leilao-superado.
 *
 * Arte: nenhuma fixa. O hero e PESSOAL (foto do lote + os lances da pessoa e
 * do rival), pela rota de imagem: urlImagemPessoal('e13-lance', token).
 *
 * ROTA /api/email/img/e13-lance (a fazer em outra fase):
 *   dados: foto do PROPRIO lote (URL https do storage da Bynx; BLOQUEIO DE
 *          ENVIO sem ela), seuLance, lanceAtual, rival (apelido mascarado).
 *   tamanho: 600x320 (render 2x = 1200x640), JPG, fundo #0d0f14 opaco.
 *   layout: a carta no centro, levemente inclinada, com luz ambar atras.
 *     Placa da esquerda caindo: "SEU LANCE" + valor riscado + selo vermelho
 *     "SUPERADO". Placa da direita subindo, contorno ambar: "LANCE ATUAL",
 *     valor e "de <rival>". Seta pontilhada ambar da placa da esquerda para a carta.
 *   referencia exata: mockups/E13-leilao-superado/assets/hero.html.
 *   ?exemplo=1: Blaine's Charizard, R$ 1.200,00 / R$ 1.350,00 de t***7.
 *
 * Todos os valores tambem vao em texto vivo (corpo e alt). Sem assinatura
 * propria no mockup aprovado: o rodape assina com o logo.
 * Categoria 'colecao' (aviso de leilao nao e marketing); o motivo do rodape
 * e o aprovado ("deu lance no lote...").
 */
import { btnRegua, blocoPromocao, layoutRegua, utmRegua, URL_CANONICA } from '@/lib/email'
import { brl, urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { COR, FONT, ajustarRodape, attr, comCss, esc, linha, rs } from './ui-b'

export type DadosE13 = {
  nome: string
  carta: { nome: string; set: string; numero: string; condicao: string }
  loja: string
  lote: { numero: string; slug: string; rodada: string }
  seuLance: number
  lanceAtual: number
  /** Apelido mascarado do rival (formato mascararApelido: "t***7"). */
  rival: string
  /** Hora do lance do rival, Brasilia: "19h41". */
  horaRival: string
  /** Minimo para voltar a liderar. */
  minimo: number
  /** Hora do martelo, Brasilia: "20h14". */
  horaMartelo: string
  /** termina_em - enviado_em, arredondado para baixo. */
  minutosRestantes: number
}

const ID = 'e13'
const CATEGORIA = 'colecao' as const

const CSS = `@media only screen and (max-width:480px){
  .hora{font-size:26px!important;line-height:46px!important;padding:0 12px!important}
  .relogio-txt{padding-left:12px!important}
}`

function montar(d: DadosE13, ctx: CtxRegua) {
  const destino = `${URL_CANONICA}/leiloes/${encodeURIComponent(d.lote.slug)}`
  const carta = esc(d.carta.nome)
  const assunto = `${d.carta.nome}: ${d.rival} passou na sua frente, fecha ${d.horaMartelo}`
  const preheader = `Com ${brl(d.minimo)} você volta a liderar. Você só paga se arrematar.`
  const forte = (t: string) => `<span style="color:${COR.texto};font-weight:700;white-space:nowrap;">${t}</span>`

  const conteudo = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="${COR.elevado}" style="background-color:${COR.elevado};">
        <a href="${attr(utmRegua(destino, ID, 'hero'))}" target="_blank" style="text-decoration:none;">
          <img src="${attr(urlImagemPessoal('e13-lance', ctx.tokenImagem))}" width="600" height="320" alt="${carta} do lote ${esc(d.lote.numero)}. Seu lance de ${rs(d.seuLance)} foi superado; o lance atual é ${rs(d.lanceAtual)}, de ${esc(d.rival)}." style="display:block;width:100%;max-width:600px;height:auto;border:0;color:${COR.texto};${FONT}font-size:16px;font-weight:700;line-height:24px;background-color:${COR.surface2};"/>
        </a>
      </td></tr>
    </table>
    ${linha(`
        <h1 class="h1" style="margin:0 0 8px;font-size:30px;line-height:36px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};">${esc(d.nome)}, o ${carta} está&nbsp;escapando.</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:21px;color:${COR.texto2};">${esc(d.carta.set)} ${esc(d.carta.numero)} &middot; ${esc(d.carta.condicao)} &middot; ${esc(d.loja)}</p>
        <p style="margin:0;font-size:16px;line-height:25px;color:${COR.texto2};">Seu lance era ${forte(rs(d.seuLance))}. Às ${esc(d.horaRival)}, <span style="color:${COR.texto};font-weight:700;">${esc(d.rival)}</span> passou na sua frente com ${forte(rs(d.lanceAtual))}. Com <span style="color:${COR.ambar};font-weight:800;white-space:nowrap;">${rs(d.minimo)}</span> você volta a&nbsp;liderar.</p>`, '24px 32px 0')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" style="padding:20px 32px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td class="hora" align="center" valign="middle" bgcolor="${COR.surface2}" style="padding:0 14px;white-space:nowrap;background-color:${COR.surface2};border:1px solid ${COR.ambar};border-radius:10px;${FONT}font-size:28px;line-height:48px;font-weight:800;letter-spacing:-0.01em;color:${COR.texto};">${esc(d.horaMartelo)}</td>
          <td class="relogio-txt" valign="middle" style="padding-left:14px;${FONT}">
            <p style="margin:0;font-size:14px;line-height:20px;font-weight:800;color:${COR.texto};">Hora do martelo (Brasília)</p>
            <p style="margin:0;font-size:14px;line-height:20px;color:${COR.texto2};">Quando este aviso saiu, faltavam&nbsp;${esc(d.minutosRestantes)}&nbsp;min</p>
          </td>
        </tr></table>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" align="left" style="padding:16px 32px 0;">
        ${btnRegua(`Dar lance de ${rs(d.minimo)}`, utmRegua(destino, ID, 'cta'))}
        <p style="margin:10px 0 0;${FONT}font-size:14px;line-height:20px;color:${COR.texto2};">Só paga se arrematar &middot; cartão com proteção&nbsp;Bynx</p>
        <p style="margin:12px 0 0;${FONT}font-size:14px;line-height:21px;color:${COR.texto2};">Sem tempo de ficar de olho até o fim? Defina um <span style="color:${COR.texto};font-weight:700;">lance máximo</span>: a Bynx cobre os lances por você até esse valor, e ninguém vê o seu&nbsp;teto.</p>
      </td></tr>
      <tr><td height="28" style="height:28px;font-size:1px;line-height:28px;">&nbsp;</td></tr>
    </table>`

  const html = layoutRegua({
    conteudo,
    campanha: ID,
    categoria: CATEGORIA,
    links: ctx.links,
    preheader,
    rotulo: 'Bynx Leilões',
    // O mockup aprovado nao tem bloco de assinatura: o rodape assina com o logo.
    assinatura: false,
    promocao: blocoPromocao('destaque', ctx.promocoes),
  })
  const rodape = ajustarRodape(html, CATEGORIA, {
    antes: ['Lance nos últimos segundos prorroga o lote: ninguém leva no último segundo.'],
    motivo: `Você recebe porque deu lance no lote ${d.lote.numero} da Rodada ${d.lote.rodada} da ${d.loja}.`,
  })
  return { assunto, preheader, html: comCss(rodape, CSS) }
}

export const E13: TemplateRegua<DadosE13> = {
  id: 'E13',
  nome: 'Leilão: seu lance foi superado',
  trilha: 'Leilão (transacional)',
  categoria: CATEGORIA,
  // Persona de exemplo: Lucas (comprador), t***7 (rival), Ponto Holo Cards (loja ficticia).
  // Carta real: Blaine's Charizard, Gym Challenge 2/132 (anuncio de R$ 1.500,00 do pacote de 07/10).
  exemplo: {
    nome: 'Lucas',
    carta: { nome: "Blaine's Charizard", set: 'Gym Challenge', numero: '2/132', condicao: 'NM' },
    loja: 'Ponto Holo Cards',
    lote: { numero: '14', slug: 'blaines-charizard-l14', rodada: '01' },
    seuLance: 1200,
    lanceAtual: 1350,
    rival: 't***7',
    horaRival: '19h41',
    minimo: 1450,
    horaMartelo: '20h14',
    minutosRestantes: 33,
  },
  montar,
}
