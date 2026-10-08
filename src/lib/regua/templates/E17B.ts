/**
 * E17B - Seu 2026 na Bynx, para quem tem 1 a 9 cartas (retrospectiva curta).
 * Trilha Reativar/retrospectiva. Mockup aprovado:
 * _Regua/mockups/E17B-seu-2026-menos-de-10-cartas/email.html (v3, "a carta do
 * ano"). BLOQUEIO DE ENVIO: o mesmo do E17 (a pagina /2026 ainda nao existe, e
 * precisa aceitar colecao pequena).
 *
 * Mesmo disparo editorial do E17 e mesma chave de dedup 'e17:2026': cada
 * pessoa recebe o E17 OU o E17B. 0 cartas nao recebe.
 *
 * A mais valiosa NUNCA aparece (nem nome, nem imagem, nem valor): fica no verso
 * Bynx no hero, no trofeu 1 e no trofeu 3. Nenhum valor em R$ no e-mail.
 *
 * Arte:
 * - PESSOAL (src/lib/regua/img/e17b.tsx): e17b-hero (600x400), e17b-trofeu-dia
 *   e e17b-trofeu-alta (244x136).
 * - FIXA: /emails/regua/e17/trofeu-verso.jpg (o mesmo trofeu da mais valiosa do E17).
 */
import { btnRegua, blocoPromocao, layoutRegua, utmRegua, URL_CANONICA } from '@/lib/email'
import { urlArte, urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { COR, FONT, attr, esc, linha } from './ui-b'

export type SegundoTrofeuE17B =
  /** A carta aberta (nao a mais valiosa) que mais subiu em 30 dias: so o percentual. */
  | { tipo: 'alta'; nome: string; pct: number }
  /** Nenhuma aberta subiu: a de set mais antigo. */
  | { tipo: 'antiga'; nome: string; ano: string }

export type DadosE17B = {
  nome: string
  /** Mes de entrada por extenso, minusculo ("junho"). */
  mesEntrada: string
  /** A mais valiosa vale hoje mais do que no dia em que entrou? */
  subiu: boolean
  /** O primeiro dia: data por extenso, dia da semana ("Um sábado") e quantas cartas entraram. */
  primeiroDia: { data: string; diaSemana: string; cartas: number }
  /** Trofeu 2; null = so 1 carta (a grade fica com o trofeu 1 e a mais valiosa). */
  segundo: SegundoTrofeuE17B | null
  /** So 1 carta na colecao (textos no singular do trofeu 3). */
  umaCarta: boolean
}

const ID = 'e17b'
const CATEGORIA = 'colecao' as const

const CSS = `@media only screen and (max-width:480px){
  .tv{font-size:22px!important;line-height:28px!important}
  .tr-px{padding:10px 10px 14px!important}
  .cap{height:80px!important}
  .gap{width:10px!important}
  .verso-td{width:104px!important}
  .verso-img{width:96px!important;height:auto!important}
}`

function pct1(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function montar(d: DadosE17B, ctx: CtxRegua) {
  const pagina = `${URL_CANONICA}/2026`
  const link = (conteudo: string) => attr(utmRegua(pagina, ID, conteudo))
  const voc = d.nome ? `${d.nome}, ` : ''
  const cap = (s: string) => (d.nome ? s : s.charAt(0).toUpperCase() + s.slice(1))
  const assunto = d.subiu
    ? cap(`${voc}a carta mais valiosa do seu 2026 subiu. Quanto?`)
    : cap(`${voc}quanto vale hoje a carta mais valiosa do seu 2026?`)
  const preheader = 'A sua retrospectiva 2026 está pronta, com o preço de hoje lado a lado com o do dia em que ela entrou.'
  const titulo = d.subiu ? 'A carta mais valiosa do seu 2026 subiu.' : 'Já separamos quanto vale hoje a carta mais valiosa do seu 2026.'
  const apoio = `Você sabe qual é. ${d.subiu ? 'Quanto ela subiu' : 'O preço dela'} está na sua retrospectiva: <span style="color:${COR.texto};font-weight:700;">o preço de hoje ao lado do preço do dia em que ela entrou no seu fichário.</span>`
  const cta = d.subiu ? 'Ver quanto a minha carta subiu' : 'Ver quanto a minha carta vale hoje'
  const sec = 'rgba(255,255,255,.62)'
  const nTrofeus = d.segundo ? 3 : 2

  const trofeu = (o: { tipo: string; conteudo: string; alt: string; rotulo: string; valor: string; corValor?: string; legenda: string; ordem: number; largura?: string }) => `
            <td class="tr-td" width="${o.largura ?? '48%'}" valign="top" bgcolor="${COR.fundo}" style="padding:0;background-color:${COR.fundo};border:1px solid rgba(255,255,255,.08);border-radius:16px;">
              <a href="${link(o.conteudo)}" target="_blank" style="text-decoration:none;display:block;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="padding:8px 8px 0;"><img class="tr-img" src="${attr(urlImagemPessoal(o.tipo, ctx.tokenImagem))}" width="244" height="136" alt="${attr(o.alt)}" style="display:block;width:100%;max-width:244px;height:auto;border:0;border-radius:10px;color:${COR.texto};${FONT}font-size:14px;font-weight:700;line-height:20px;background-color:${COR.fundo};"/></td></tr>
                <tr><td class="tr-px" style="padding:12px 14px 16px;${FONT}">
                  <p style="margin:0 0 4px;font-size:14px;line-height:18px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${COR.ambar};white-space:nowrap;">${o.rotulo}</p>
                  <p class="tv" style="margin:0 0 6px;font-size:28px;line-height:32px;font-weight:800;letter-spacing:-0.02em;color:${o.corValor ?? COR.texto};white-space:nowrap;">${o.valor}</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="cap" height="60" valign="top" style="height:60px;${FONT}font-size:14px;line-height:20px;color:${sec};">${o.legenda}</td></tr></table>
                  <p style="margin:8px 0 0;font-size:14px;line-height:18px;font-weight:700;color:${sec};">${o.ordem} de ${nTrofeus}</p>
                </td></tr>
              </table></a>
            </td>`

  const pd = d.primeiroDia
  const veja = pd.cartas === 1 ? 'Veja a carta do jeito que entrou.' : `Veja as ${pd.cartas} do jeito que entraram.`
  const t1 = trofeu({
    tipo: 'e17b-trofeu-dia', conteudo: 'trofeu-dia',
    alt: `As ${pd.cartas === 1 ? 'sua carta' : `suas ${pd.cartas} cartas`} do primeiro dia em leque e uma etiqueta: ${pd.data}.`,
    rotulo: 'O primeiro dia', valor: esc(pd.data),
    legenda: `${esc(pd.diaSemana)}. <span style="color:${COR.texto};font-weight:700;">${veja}</span>`,
    ordem: 1, largura: d.segundo ? '48%' : '100%',
  })
  const s = d.segundo
  const t2 = s
    ? trofeu(s.tipo === 'alta'
      ? {
          tipo: 'e17b-trofeu-alta', conteudo: 'trofeu-alta',
          alt: `O seu ${s.nome} com uma etiqueta de alta: ${pct1(s.pct)}% em 30 dias.`,
          rotulo: d.subiu ? 'Também subiu' : 'Subiu em 30 dias', valor: `+${pct1(s.pct)}%`, corValor: COR.verde,
          legenda: `O seu ${esc(s.nome)}, em 30 dias. <span style="color:${COR.texto};font-weight:700;">Veja como ficou cada carta do seu ano.</span>`,
          ordem: 2,
        }
      : {
          tipo: 'e17b-trofeu-alta', conteudo: 'trofeu-antiga',
          alt: `O seu ${s.nome}, a carta de set mais antigo do seu ano: ${s.ano}.`,
          rotulo: 'A mais antiga', valor: esc(s.ano),
          legenda: `O seu ${esc(s.nome)}. <span style="color:${COR.texto};font-weight:700;">Veja como ficou cada carta do seu ano.</span>`,
          ordem: 2,
        })
    : ''
  const vao = `<td class="gap" width="4%" style="width:4%;min-width:10px;font-size:1px;line-height:1px;">&nbsp;</td>`
  const linhaTrofeus = s ? `${t1}${vao}${t2}` : t1
  const colspan = s ? 3 : 1

  const leque = d.segundo || !d.umaCarta ? 'Atrás dela, outras cartas do seu ano.' : ''
  const altHero = `A mais valiosa do seu 2026, ${d.subiu ? 'com uma etiqueta de preço em alta' : 'com uma etiqueta de preço'}: R$ ?. ${leque} O preço de hoje está ao lado do preço do dia em que ela entrou.`.replace(/\s+/g, ' ')
  const fim = d.subiu ? 'ver quanto ela subiu' : 'ver quanto ela vale hoje'

  const conteudo = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="${COR.elevado}" style="background-color:${COR.elevado};">
        <a href="${link('hero')}" target="_blank" style="text-decoration:none;display:block;">
          <img src="${attr(urlImagemPessoal('e17b-hero', ctx.tokenImagem))}" width="600" height="400" alt="${attr(altHero)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;color:${COR.texto};${FONT}font-size:16px;font-weight:700;line-height:24px;background-color:${COR.elevado};"/>
        </a>
      </td></tr>
    </table>
    ${linha(`
        <h1 class="h1" style="margin:0 0 10px;font-size:30px;line-height:36px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};">${titulo}</h1>
        <p style="margin:0;font-size:16px;line-height:25px;color:${sec};">${apoio}</p>`, '22px 32px 0')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" align="left" style="padding:22px 32px 8px;">
        ${btnRegua(cta, utmRegua(pagina, ID, 'cta'))}
      </td></tr>
    </table>
    ${linha(`
        <p style="margin:0 0 4px;font-size:21px;line-height:27px;font-weight:800;color:${COR.texto};">O seu ano em ${nTrofeus} cartas</p>
        <p style="margin:0 0 14px;font-size:14px;line-height:20px;color:${sec};">${s ? 'Duas aqui' : 'Uma aqui'}. A mais valiosa, com o preço, na sua retrospectiva.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>${linhaTrofeus}
          </tr>
          <tr><td colspan="${colspan}" height="16" style="height:16px;font-size:1px;line-height:1px;">&nbsp;</td></tr>
          <tr><td colspan="${colspan}" style="padding:0;">
            <a href="${link('trofeu-mais-valiosa')}" target="_blank" style="text-decoration:none;display:block;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.fundo}" style="background-color:${COR.fundo};border:1px solid ${COR.ambar};border-radius:16px;">
              <tr>
                <td class="verso-td" width="158" valign="middle" style="padding:8px 0 8px 8px;">
                  <img class="verso-img" src="${urlArte('e17', 'trofeu-verso.jpg')}" width="150" height="190" alt="A mais valiosa do seu ano, com o preço escondido." style="display:block;width:150px;height:auto;border:0;border-radius:10px;color:${COR.texto};${FONT}font-size:14px;font-weight:700;line-height:20px;background-color:${COR.fundo};"/>
                </td>
                <td valign="middle" style="padding:16px 16px 16px 14px;${FONT}">
                  <p style="margin:0 0 4px;font-size:14px;line-height:18px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${COR.ambar};">A mais valiosa</p>
                  <p style="margin:0 0 6px;font-size:22px;line-height:28px;font-weight:800;color:${COR.texto};">${d.subiu ? 'Quanto ela subiu desde que entrou?' : 'Quanto ela vale hoje?'}</p>
                  <p style="margin:0;font-size:14px;line-height:21px;color:${sec};">O preço de hoje ao lado do preço do dia em que ela chegou.</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tr>
                    <td valign="middle" style="padding:0;${FONT}font-size:16px;line-height:22px;font-weight:800;color:${COR.ambar};text-decoration:underline;white-space:nowrap;">Ver o preço de hoje&nbsp;&rsaquo;</td>
                    <td valign="middle" style="padding-left:14px;${FONT}font-size:14px;line-height:18px;font-weight:700;color:${sec};white-space:nowrap;">${nTrofeus} de ${nTrofeus}</td>
                  </tr></table>
                </td>
              </tr>
            </table></a>
          </td></tr>
        </table>`, '28px 32px 0')}
    ${linha(`<p style="margin:0;font-size:16px;line-height:25px;color:${sec};">Valeu por ter começado a sua coleção com a gente. A Bynx nasceu em abril, e você chegou em ${esc(d.mesEntrada)}. Por isso guardamos a melhor carta do seu ano para o fim: <a href="${link('texto-fim')}" target="_blank" style="color:${COR.ambar};font-weight:800;text-decoration:underline;">${fim}</a>.</p>`, '28px 32px 0')}`

  const html = layoutRegua({
    conteudo,
    campanha: ID,
    categoria: CATEGORIA,
    links: ctx.links,
    preheader,
    rotulo: 'Retrospectiva 2026',
    assinatura: true,
    respiroAssinatura: 12,
    motivo: 'Você recebe porque tem conta na Bynx e cartas na sua coleção.',
    css: CSS,
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E17B: TemplateRegua<DadosE17B> = {
  id: 'E17B',
  nome: 'Seu 2026 na Bynx (menos de 10 cartas)',
  trilha: 'Reativar/retrospectiva',
  categoria: CATEGORIA,
  // PERSONA DE EXEMPLO (PERSONAS.md secao 4): Ana, 4 cartas, entrou em 13/06 (sabado, ficcao marcada no meta.json).
  exemplo: {
    nome: 'Ana',
    mesEntrada: 'junho',
    subiu: true,
    primeiroDia: { data: '13 de junho', diaSemana: 'Um sábado', cartas: 4 },
    segundo: { tipo: 'alta', nome: 'Lugia-GX', pct: 74.9 },
    umaCarta: false,
  },
  montar,
}
