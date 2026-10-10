/**
 * E12 - Bynx Leiloes: vote na carta que abre a primeira rodada (lista de espera).
 * Trilha Novidades (Leilao). Mockup aprovado: _Regua/mockups/E12-leilao-lista-espera.
 *
 * Arte:
 * - FIXA (igual para todos da edicao): as 3 fatias do palco, cada carta em um
 *   toploader: /emails/regua/e12/palco-charizard.jpg, palco-lugia.jpg,
 *   palco-pikachu.jpg (400x512, 2x de 200x256). Trocar a cedula = trocar a arte.
 * - PESSOAL: o ingresso leva o NOME da pessoa no canhoto. Vai pela rota de
 *   imagem: urlImagemPessoal('e12-ingresso', token).
 *
 * ROTA /api/email/img/e12-ingresso (a fazer em outra fase):
 *   dados: nome (primeiro nome, maiusculas no canhoto), rodada.numero ("01"),
 *          rodada.loja ("Ponto Holo Cards"), rodada.dia ("quinta, 10/12").
 *   tamanho: 600x136 (render 2x = 1200x272), JPG, fundo #0d0f14 opaco.
 *   layout: ingresso escuro com contorno ambar fino e serrilha nas pontas.
 *     Esquerda: logo BYNX | LEILOES + "RODADA 01" ambar->vermelho; embaixo
 *     a loja em maiusculas e "QUINTA, 10/12 · AO VIVO". Picote vertical
 *     tracejado. Canhoto a direita: o NOME na vertical + codigo de barras.
 *   referencia exata: mockups/E12-leilao-lista-espera/assets/ingresso.html.
 *   ?exemplo=1 desenha a persona (LUCAS, Rodada 01, Ponto Holo Cards, quinta, 10/12).
 *
 * Os dados da pessoa ficam em texto vivo no HTML (kicker, alt do ingresso).
 * A pagina /leiloes ainda nao existe no main (branch feat/leilao).
 */
import { blocoPromocao, layoutRegua, utmRegua, URL_CANONICA } from '@/lib/email'
import { urlArte, urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { COR, FONT, attr, esc, linha } from './ui-b'

export type CartaVotoE12 = {
  nome: string
  set: string
  /** "199/165" */
  numero: string
  /** Valor do ?quero= (identifica a carta no voto). */
  slug: string
  /** Arquivo da fatia do palco em /emails/regua/e12/. */
  arte: string
}

export type DadosE12 = {
  /** Primeiro nome da pessoa. */
  nome: string
  /** Prazo do voto em texto: "domingo, 06/12". */
  prazoVoto: string
  rodada: { numero: string; loja: string; dia: string }
  cartas: [CartaVotoE12, CartaVotoE12, CartaVotoE12]
}

const ID = 'e12'

const CSS = `@media only screen and (max-width:480px){
  .topo{padding:12px 16px 10px!important}
  .p1{padding-top:14px!important}
  .h1{font-size:26px!important;line-height:31px!important}
  .sub{font-size:16px!important;line-height:22px!important}
  .cn{padding:6px 4px 0!important}
  .cb1{padding:10px 6px 0 16px!important}
  .cb2{padding:10px 6px 0 6px!important}
  .cb3{padding:10px 16px 0 6px!important}
  .cd{margin-top:10px!important}
}`

function montar(d: DadosE12, ctx: CtxRegua) {
  const nome = esc(d.nome)
  const assunto = `${d.nome}, você escolhe a carta do 1º leilão da Bynx`
  const preheader = `Live da loja, lance pelo celular. Vote até ${d.prazoVoto}, e saiba o lote e o horário da sua carta.`
  const voto = (c: CartaVotoE12) =>
    attr(utmRegua(`${URL_CANONICA}/leiloes?quero=${encodeURIComponent(c.slug)}`, ID, `voto-${c.slug}`))

  const fatia = (c: CartaVotoE12) => `
        <td width="33%" valign="top" style="width:33.33%;padding:0;font-size:0;line-height:0;">
          <a href="${voto(c)}" target="_blank" style="text-decoration:none;display:block;"><img src="${attr(urlArte(ID, c.arte))}" width="200" alt="Votar no ${esc(c.nome)}, ${esc(c.set)}, ${esc(c.numero)}" style="display:block;width:100%;max-width:200px;height:auto;border:0;color:${COR.texto};${FONT}font-size:14px;line-height:20px;background-color:${COR.surface2};"/></a>
        </td>`
  const legenda = (c: CartaVotoE12) => `
        <td class="cn" align="center" valign="top" style="padding:10px 8px 0;${FONT}">
          <a href="${voto(c)}" target="_blank" style="text-decoration:none;display:block;">
            <span style="display:block;font-size:16px;line-height:20px;font-weight:800;color:${COR.texto};">${esc(c.nome)}</span>
            <span style="display:block;margin-top:2px;font-size:14px;line-height:18px;color:${COR.texto2};white-space:nowrap;">${esc(c.set)}</span>
            <span style="display:block;font-size:14px;line-height:18px;color:${COR.texto2};white-space:nowrap;">${esc(c.numero)}</span>
          </a>
        </td>`
  const votar = (c: CartaVotoE12, classe: string, padding: string) => `
        <td class="${classe}" valign="top" style="padding:${padding};${FONT}">
          <a href="${voto(c)}" target="_blank" style="display:block;padding:12px 0;border:1px solid ${COR.ambar};border-radius:10px;background-color:${COR.elevado};text-align:center;font-size:16px;line-height:20px;font-weight:800;color:${COR.ambar};text-decoration:none;">Votar</a>
        </td>`
  const [c1, c2, c3] = d.cartas

  const conteudo = `
    ${linha(`
        <p style="margin:0 0 6px;font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${COR.ambar};">${nome}, vote até ${esc(d.prazoVoto)}</p>
        <h1 class="h1" style="margin:0;font-size:30px;line-height:36px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};">Qual carta abre o primeiro leilão ao vivo da&nbsp;Bynx?</h1>
        <p class="sub" style="margin:8px 0 0;font-size:17px;line-height:25px;color:${COR.texto2};"><span style="color:${COR.texto};font-weight:700;">Live da loja, lance pelo celular.</span> Se a sua carta entrar em qualquer lote, você recebe o número e o horário dela na&nbsp;véspera.</p>`, '22px 32px 0', 'p1')}
    <table class="cd" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
      <tr>${fatia(c1)}${fatia(c2)}${fatia(c3)}
      </tr>
      <tr>${legenda(c1)}${legenda(c2)}${legenda(c3)}
      </tr>
      <tr>${votar(c1, 'cb1', '12px 10px 0 20px')}${votar(c2, 'cb2', '12px 15px 0')}${votar(c3, 'cb3', '12px 20px 0 10px')}
      </tr>
    </table>
    ${linha(`
        <p style="margin:0;font-size:16px;line-height:24px;color:${COR.texto2};"><span style="color:${COR.texto};font-weight:700;">A mais votada abre a rodada como lote&nbsp;01.</span> Um toque no Votar e o seu voto está registrado.</p>
        <p style="margin:4px 0 0;font-size:16px;line-height:24px;"><a href="${attr(utmRegua(`${URL_CANONICA}/leiloes?avisar=1`, ID, 'so-avisar'))}" target="_blank" style="display:inline-block;padding:10px 0;color:${COR.texto};font-weight:700;text-decoration:underline;">Ainda não sei. Só me avise da rodada</a></p>`, '20px 32px 0')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" style="padding:24px 32px 0;${FONT}">
        <p style="margin:0;font-size:14px;line-height:20px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${COR.texto2};">Onde e quando</p>
      </td></tr>
      <tr><td style="padding:4px 0 0;">
        <img src="${attr(urlImagemPessoal('e12-ingresso', ctx.tokenImagem))}" width="600" alt="Ingresso da Bynx Leilões no seu nome: rodada ${esc(d.rodada.numero)} da ${esc(d.rodada.loja)}, ${esc(d.rodada.dia)}, ao vivo." style="display:block;width:100%;max-width:600px;height:auto;border:0;color:${COR.texto};${FONT}font-size:16px;font-weight:700;line-height:24px;background-color:${COR.elevado};"/>
      </td></tr>
      <tr><td class="px" style="padding:6px 32px 0;${FONT}">
        <p style="margin:0;font-size:14px;line-height:21px;color:${COR.texto2};">Lotes de 30 a 90 segundos, pagamento com cartão na Bynx, lance a partir de 18 anos.</p>
      </td></tr>
    </table>
    ${linha(`<p style="margin:0;padding-top:20px;border-top:1px solid ${COR.borda};font-size:16px;line-height:25px;color:${COR.texto2};">A carta dos seus sonhos ficou de fora da cédula? Responda este <span style="white-space:nowrap;">e-mail</span> com o nome dela. Lemos todas as respostas, e a próxima cédula sai delas.</p>`, '24px 32px 0')}`

  const html = layoutRegua({
    conteudo,
    campanha: ID,
    categoria: 'novidades',
    links: ctx.links,
    preheader,
    assinatura: true,
    css: CSS,
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E12: TemplateRegua<DadosE12> = {
  id: 'E12',
  nome: 'Bynx Leilões: vote na carta que abre a primeira rodada',
  trilha: 'Novidades (Leilão)',
  categoria: 'novidades',
  // Persona de exemplo: Lucas, 29, Fortaleza; loja ficticia Ponto Holo Cards (PERSONAS.md, secao 5).
  exemplo: {
    nome: 'Lucas',
    prazoVoto: 'domingo, 06/12',
    rodada: { numero: '01', loja: 'Ponto Holo Cards', dia: 'quinta, 10/12' },
    cartas: [
      { nome: 'Charizard ex', set: '151', numero: '199/165', slug: 'charizard-ex-151-199', arte: 'palco-charizard.jpg' },
      { nome: 'Lugia-GX', set: 'Lost Thunder', numero: '207/214', slug: 'lugia-gx-lost-thunder-207', arte: 'palco-lugia.jpg' },
      { nome: 'Pikachu', set: 'Crown Zenith', numero: '160/159', slug: 'pikachu-crown-zenith-160', arte: 'palco-pikachu.jpg' },
    ],
  },
  montar,
}
