/**
 * E08 · Alerta de preco: cartas suas mexeram (Minha colecao). Mockup aprovado:
 * _Regua/mockups/E08-alerta-preco/email.html.
 *
 * Gatilho: digest diario as 09h (Brasilia). Entra a carta da colecao que passou
 * de 15% E de R$ 10,00 de variacao em 7 dias (menor preco do Mercado
 * Brasileiro) e nao apareceu em outro aviso nos ultimos 7 dias. Maximo 1 por
 * dia e 3 por semana. A checagem de suspeita (alta ou queda acima de 50%) e do
 * motor, nao do template.
 *
 * ARTE
 * - Hero = IMAGEM PESSOAL (rota de ImageResponse), tipo `e08-painel`, 600x480
 *   (render 2x = 1200x960, JPG). Desenho de referencia:
 *   mockups/E08-alerta-preco/assets/hero.html. A rota desenha um painel
 *   split-flap (placas escuras com letra branca):
 *   - no alto, o nome da carta de destaque letra a letra ("GIRATINA V");
 *   - a esquerda, a imagem da carta pendurada no painel;
 *   - a direita: "PAINEL DA <NOME>" em ambar, a data com o ponto verde,
 *     "triangulo SUBIU EM 7 DIAS", o percentual em placas ("+64,8%"), o ganho
 *     "+R$ 510,90" em verde, "na sua colecao" e "+N NO PLACAR triangulo".
 *   Queda: mesmas pecas em vermelho ("CAIU EM 7 DIAS"). Tudo tambem em texto vivo.
 * - Miniaturas do placar: imagem da carta por URL (dado).
 */
import { btnRegua, blocoPromocao, layoutRegua } from '@/lib/email'
import { urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import {
  FONT, attr, caminhoCarta, esc, h1, hero, imagemCarta, linha, link, num, p, reais, reaisSinal, reaisTxt,
} from './blocos-a'

const CAMPANHA = 'e08'
/** Limiar do aviso (o motor aplica; o texto do rodape do placar repete). */
const LIMIAR = { pct: 15, reais: 10 }

export type CartaPlacarE08 = {
  nome: string
  set: string
  slug: string
  imagem: string
  precoAntes: number
  precoAgora: number
  /** Variacao em 7 dias, em % (negativo = queda). */
  pct: number
  /** Variacao em R$ na colecao da pessoa (copias x variacao). */
  naColecao: number
  /** Mostra "Quer a segunda copia?" (queda em carta que ela tem 1 copia). */
  segundaCopia?: boolean
}

export type DadosE08 = {
  /** Primeiro nome (vai na arte; o texto do e-mail nao usa). */
  nome: string
  /** Data do digest, "dd/mm". */
  data: string
  /** A carta que mais mexeu em R$ na colecao: hero, H1 e botao. */
  destaque: Omit<CartaPlacarE08, 'segundaCopia' | 'imagem'> & { imagem: string }
  /** As outras cartas do digest. */
  outras: CartaPlacarE08[]
}

const SETA_SOBE = '&#9650;&#xFE0E;'
const SETA_CAI = '&#9660;&#xFE0E;'

function juntar(l: string[]): string {
  return l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`
}

function barra(pct: number): string {
  const w = Math.min(Math.abs(pct), 100) / 2
  const fmt = (x: number) => `${Number(x.toFixed(2))}%`
  const vazio = (x: number, extra = '') => `<td width="${fmt(x)}" height="10" style="width:${fmt(x)};height:10px;font-size:1px;line-height:10px;${extra}">&nbsp;</td>`
  if (pct >= 0) {
    return `${vazio(50)}<td width="${fmt(w)}" height="10" bgcolor="#22c55e" style="width:${fmt(w)};height:10px;font-size:1px;line-height:10px;background-color:#22c55e;border-left:2px solid #f0f0f0;border-radius:0 999px 999px 0;">&nbsp;</td>${50 - w > 0 ? vazio(50 - w) : ''}`
  }
  return `${50 - w > 0 ? vazio(50 - w) : ''}<td width="${fmt(w)}" height="10" bgcolor="#ef4444" style="width:${fmt(w)};height:10px;font-size:1px;line-height:10px;background-color:#ef4444;border-radius:999px 0 0 999px;">&nbsp;</td>${vazio(50, 'border-left:2px solid #f0f0f0;')}`
}

function montar(d: DadosE08, ctx: CtxRegua) {
  const de = d.destaque
  const sobe = de.naColecao >= 0
  const hrefDestaque = (c: string) => link(caminhoCarta(de.slug), CAMPANHA, c)

  const assunto = `Seu ${de.nome} ${sobe ? 'subiu' : 'caiu'} ${reaisTxt(de.naColecao)}`
  const subiram = d.outras.filter((c) => c.pct >= 0).map((c) => `o ${c.nome}`)
  const cairam = d.outras.filter((c) => c.pct < 0).map((c) => `o ${c.nome}`)
  const partes = [
    subiram.length ? `${juntar(subiram)} ${subiram.length === 1 ? 'subiu' : 'subiram'}${sobe ? ' junto' : ''}` : '',
    cairam.length ? `${juntar(cairam)} ${cairam.length === 1 ? 'caiu' : 'caíram'}${sobe ? '' : ' junto'}` : '',
  ].filter(Boolean)
  const resto = partes.join('; ')
  const preheader = `Ele vale ${reaisTxt(de.precoAgora)} agora.` + (resto ? ` ${resto.charAt(0).toUpperCase()}${resto.slice(1)}.` : '')

  const saldo = de.naColecao + d.outras.reduce((s, c) => s + c.naColecao, 0)
  const total = d.outras.length + 1

  const linhasOutras = d.outras.map((c, i) => {
    const up = c.pct >= 0
    const cor = up ? '#22c55e' : '#ef4444'
    const href = attr(link(caminhoCarta(c.slug), CAMPANHA, 'ranking'))
    const ultima = i === d.outras.length - 1
    const borda = ultima ? '' : 'border-bottom:1px solid #202227;'
    const segunda = c.segundaCopia && !up
      ? `<a href="${attr(link(caminhoCarta(c.slug), CAMPANHA, 'segunda-copia'))}" target="_blank" style="display:block;padding:12px 0;${FONT}font-size:14px;line-height:20px;color:#a3a4a6;text-decoration:none;">Quer a segunda cópia? <span style="color:#f0f0f0;font-weight:500;text-decoration:underline;white-space:nowrap;">Ver a partir de ${reais(c.precoAgora)}</span></a>`
      : ''
    return `<tr><td style="padding:16px 0 ${segunda ? '4px' : '16px'};${borda}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="64" valign="top" style="padding:0 14px 0 0;">
                <a href="${href}" target="_blank" style="text-decoration:none;"><img src="${attr(imagemCarta(c.imagem))}" width="64" height="89" alt="${attr(c.nome)}" style="display:block;width:64px;height:89px;border:0;border-radius:5px;background-color:#202227;color:#a3a4a6;${FONT}font-size:14px;"/></a>
              </td>
              <td valign="top" style="${FONT}">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td valign="top" style="${FONT}font-size:18px;line-height:24px;font-weight:800;color:#f0f0f0;"><a href="${href}" target="_blank" style="color:#f0f0f0;text-decoration:none;">${esc(c.nome)}</a></td>
                  <td valign="top" align="right" style="${FONT}font-size:18px;line-height:24px;font-weight:800;color:${cor};white-space:nowrap;">${up ? SETA_SOBE : SETA_CAI}&nbsp;${up ? '+' : '&minus;'}${num(c.pct)}%</td>
                </tr><tr>
                  <td style="${FONT}font-size:14px;line-height:20px;color:#a3a4a6;">${esc(c.set)}</td>
                  <td align="right" style="${FONT}font-size:14px;line-height:20px;font-weight:700;color:${cor};white-space:nowrap;">${up ? 'subiu' : 'caiu'}</td>
                </tr></table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#202227" style="background-color:#202227;border-radius:999px;margin:10px 0 10px;"><tr>${barra(c.pct)}</tr></table>
                <p style="margin:0;${FONT}font-size:14px;line-height:20px;color:#a3a4a6;"><span style="white-space:nowrap;">${reais(c.precoAntes)}</span>&nbsp;&rarr;&nbsp;<span style="white-space:nowrap;font-size:16px;font-weight:800;color:#f0f0f0;">${reais(c.precoAgora)}</span></p>
                <p style="margin:2px 0 0;${FONT}font-size:14px;line-height:20px;color:#a3a4a6;">Na sua coleção: <span style="white-space:nowrap;font-weight:800;color:${c.naColecao >= 0 ? '#22c55e' : '#ef4444'};">${reaisSinal(c.naColecao)}</span></p>
                ${segunda}
              </td>
            </tr></table>
          </td></tr>`
  }).join('')

  const placar = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="${FONT}font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#f0f0f0;">O placar das suas cartas</td>
          <td align="right" style="${FONT}font-size:14px;line-height:20px;color:#a3a4a6;white-space:nowrap;">7 dias &middot; até ${esc(d.data)}</td>
        </tr></table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080a0f" style="background-color:#080a0f;border:1px solid #202227;border-radius:16px;margin-top:12px;">
          <tr><td class="e08-bloco" style="padding:4px 20px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="border-bottom:1px solid #202227;">
                <a href="${attr(hrefDestaque('ranking'))}" target="_blank" style="display:block;padding:14px 0;text-decoration:none;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td valign="middle" style="${FONT}font-size:16px;line-height:24px;font-weight:800;color:#f0f0f0;">${esc(de.nome)} <span style="font-size:14px;font-weight:400;color:#a3a4a6;">&middot; destaque acima</span></td>
                  <td valign="middle" align="right" style="${FONT}font-size:16px;line-height:24px;font-weight:800;color:${sobe ? '#22c55e' : '#ef4444'};white-space:nowrap;">${reaisSinal(de.naColecao)}</td>
                </tr></table>
                </a>
              </td></tr>
              ${linhasOutras}
            </table>
          </td></tr>
          <tr><td class="e08-bloco" style="padding:0 20px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #202227;"><tr>
              <td style="padding:16px 0 0;${FONT}font-size:14px;line-height:20px;font-weight:700;color:#a3a4a6;">Saldo das ${total} na sua coleção</td>
              <td align="right" style="padding:16px 0 0;${FONT}font-size:18px;line-height:24px;font-weight:800;color:${saldo >= 0 ? '#22c55e' : '#ef4444'};white-space:nowrap;">${saldo >= 0 ? SETA_SOBE : SETA_CAI}&nbsp;${reaisSinal(saldo)}</td>
            </tr></table>
          </td></tr>
        </table>
        <p style="margin:10px 0 0;${FONT}font-size:14px;line-height:20px;color:#6e6f72;">Menor preço do Mercado Brasileiro, 7 dias. Aviso só em mexida acima de ${LIMIAR.pct}% e ${reais(LIMIAR.reais)}.</p>`

  const n = d.outras.length
  const alt = `Painel da sua coleção, ${d.data}: ${de.nome} ${sobe ? 'subiu' : 'caiu'} ${num(de.pct)}% em 7 dias, ${sobe ? 'mais' : 'menos'} ${reaisTxt(de.naColecao)} na sua coleção.` +
    (n ? ` Mais ${n === 1 ? '1 carta' : `${n} cartas`} no placar abaixo.` : '')

  const conteudo = [
    `<style>@media only screen and (max-width:480px){.e08-bloco{padding-left:14px!important;padding-right:14px!important}}</style>`,
    hero({ src: urlImagemPessoal('e08-painel', ctx.tokenImagem), alt, href: hrefDestaque('hero'), largura: 600, altura: 480 }),
    linha(`
        ${h1(`Seu ${esc(de.nome)} vale <span style="white-space:nowrap;">${reais(de.precoAgora)}</span> hoje.`)}
        ${p(`Era <span style="white-space:nowrap;">${reais(de.precoAntes)}</span> há uma semana.`, 'margin:0;font-size:16px;line-height:25px;color:#a3a4a6;')}`, '20px 32px 0'),
    linha(btnRegua('Pico ou tendência? Ver o gráfico', hrefDestaque('cta')), '20px 32px 0'),
    sobe
      ? linha(`<a href="${attr(link('/minha-colecao', CAMPANHA, 'vender'))}" target="_blank" style="display:block;padding:12px 0;${FONT}font-size:14px;line-height:20px;color:#a3a4a6;text-decoration:none;">Quer aproveitar a alta? <span style="color:#f0f0f0;font-weight:500;text-decoration:underline;">Anuncie direto da sua coleção</span>, sem loja.</a>`, '4px 32px 0')
      : '',
    linha(placar, '20px 32px 0'),
    linha(p('Ficamos de olho no preço das suas cartas todo dia. Você só recebe quando uma delas mexe de verdade.', 'margin:0;font-size:14px;line-height:21px;color:#a3a4a6;'), '24px 32px 0'),
  ].join('\n')

  const html = layoutRegua({
    conteudo,
    campanha: CAMPANHA,
    categoria: 'colecao',
    links: ctx.links,
    preheader,
    rotulo: 'Alerta de preço',
    assinatura: true,
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E08: TemplateRegua<DadosE08> = {
  id: 'E08',
  nome: 'Alerta de preço: cartas suas mexeram',
  trilha: 'Minha coleção',
  categoria: 'colecao',
  // PERSONA DE EXEMPLO (direcao/PERSONAS.md): Marina; as 4 cartas que mexeram em 7 dias (dados.json, 07/10).
  exemplo: {
    nome: 'Marina',
    data: '07/10',
    destaque: {
      nome: 'Giratina V', set: 'Lost Origin', slug: 'swsh11-186', imagem: 'https://images.pokemontcg.io/swsh11/186.png',
      precoAntes: 789, precoAgora: 1299.9, pct: 64.8, naColecao: 510.9,
    },
    outras: [
      { nome: 'Omanyte', set: '151', slug: 'sv3pt5-180', imagem: 'https://images.pokemontcg.io/sv3pt5/180.png', precoAntes: 99, precoAgora: 160, pct: 61.6, naColecao: 61 },
      { nome: 'Scizor', set: 'Obsidian Flames', slug: 'sv3-205', imagem: 'https://images.pokemontcg.io/sv3/205.png', precoAntes: 100, precoAgora: 37.9, pct: -62.1, naColecao: -62.1, segundaCopia: true },
      { nome: 'Revavroom ex', set: 'Obsidian Flames', slug: 'sv3-224', imagem: 'https://images.pokemontcg.io/sv3/224.png', precoAntes: 103.95, precoAgora: 46, pct: -55.7, naColecao: -57.95 },
    ],
  },
  montar,
}
