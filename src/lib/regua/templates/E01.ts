/**
 * E01 · "O Omanyte saiu do bolso" (Novidades). Mockup aprovado:
 * _Regua/mockups/E01-tudo-que-mudou/email.html.
 *
 * Gatilho: calendario, 1 vez por pessoa, em 3 ondas por last_seen_at. Para quem
 * tem ao menos 1 carta que mexeu 10% ou mais em 7 dias (filtro de preco fora da
 * curva no motor). A variante "0 cartas" (email-zero.html) NAO esta aqui.
 *
 * ARTE
 * - Hero = IMAGEM PESSOAL (rota de ImageResponse), tipo `e01-fichario`, 598x380
 *   (render 2x = 1196x760, JPG). Desenho de referencia:
 *   mockups/E01-tudo-que-mudou/assets/hero-fichario.html (variante `.m`).
 *   A rota desenha, com os dados do token:
 *   - fichario inclinado -1,5deg a esquerda (300x360), pagina 3x3 de bolsos
 *     76x106 com as ate 8 cartas DIFERENTES da pessoa (imagem da carta); o bolso
 *     da carta-gancho fica vazio ("saiu"), o 9o bolso fica tracejado;
 *   - cartas que mexeram em 7 dias ganham contorno (verde subiu, vermelho caiu)
 *     e um marcador redondo de 28px no canto com seta desenhada (sem numero);
 *   - a carta-gancho fora do bolso (136x190, rotate 6deg, brilho verde) presa
 *     por um barbante a uma etiqueta verde #22c55e com ilhos: nome da carta,
 *     "+62%" (pct arredondado), "+R$ 61,00" (ganho em R$) e "em 7 dias";
 *   - total discreto a direita: "Suas 11 cartas valem hoje" / "R$ 1.955,30" /
 *     "no Mercado Brasileiro".
 *   Fundo opaco #0d0f14, nenhum texto abaixo de 22px no canvas.
 *   Tudo o que a imagem diz tambem esta em texto vivo (H1, paragrafo e lista).
 */
import { btnRegua, blocoPromocao, layoutRegua } from '@/lib/email'
import { urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import {
  FONT, attr, caminhoCarta, esc, h1, hero, linha, link, p, plural, reais, reaisTxt,
} from './blocos-a'

const CAMPANHA = 'e01'

export type CartaQueMexeuE01 = {
  nome: string
  set: string
  /** slug (ou id) da carta em /carta/[slug] */
  slug: string
  direcao: 'subiu' | 'caiu'
}

export type DadosE01 = {
  nome: string
  /** A carta que mais mexeu para cima: o gancho do e-mail. */
  gancho: {
    nome: string
    set: string
    slug: string
    imagem: string
    precoAntes: number
    precoAgora: number
    /** Variacao em 7 dias, em %, ex.: 61.6 */
    pct: number
  }
  /** As outras cartas da pagina que mexeram (so a direcao). */
  outras: CartaQueMexeuE01[]
  totalCartas: number
  valorColecao: number
}

function montar(d: DadosE01, ctx: CtxRegua) {
  const g = d.gancho
  const pctInt = Math.round(g.pct)
  const ganho = g.precoAgora - g.precoAntes
  const hrefGancho = (conteudo: string) => link(caminhoCarta(g.slug), CAMPANHA, conteudo)

  const assunto = `${d.nome}, o seu ${g.nome} do ${g.set} subiu ${pctInt}% em 7 dias`
  const n = d.outras.length
  const preheader = `Foi de ${reaisTxt(g.precoAntes)} para ${reaisTxt(g.precoAgora)}.` +
    (n === 0 ? '' : n === 1 ? ' E mais 1 carta da sua página mexeu.' : ` E mais ${n} cartas da sua página mexeram.`)

  const subiram = d.outras.filter((c) => c.direcao === 'subiu').map((c) => c.nome)
  const cairam = d.outras.filter((c) => c.direcao === 'caiu').map((c) => c.nome)
  const juntar = (l: string[]) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`)
  const alt = [
    `O seu ${g.nome} do ${g.set} saindo da página do fichário, com a etiqueta: mais ${pctInt}%, mais ${reaisTxt(ganho)} em 7 dias.`,
    subiram.length || cairam.length
      ? `Na página, ${[
          subiram.length ? `${juntar(subiram)} ${subiram.length === 1 ? 'subiu' : 'subiram'}` : '',
          cairam.length ? `${juntar(cairam)} ${cairam.length === 1 ? 'caiu' : 'caíram'}` : '',
        ].filter(Boolean).join(' e ')}.`
      : '',
    `As suas ${plural(d.totalCartas, 'carta', 'cartas')} valem hoje ${reaisTxt(d.valorColecao)} no Mercado Brasileiro.`,
  ].filter(Boolean).join(' ')

  const linhas = d.outras.map((c, i) => {
    const ultima = i === d.outras.length - 1
    const borda = ultima ? '' : 'border-bottom:1px solid #202227;'
    const cor = c.direcao === 'subiu' ? '#22c55e' : '#ef4444'
    return `<tr>
            <td valign="middle" style="${borda}padding:0;${FONT}">
              <a href="${attr(link(caminhoCarta(c.slug), CAMPANHA, 'pagina'))}" target="_blank" style="display:block;padding:12px 0;text-decoration:none;"><span style="display:block;font-size:16px;line-height:22px;font-weight:800;color:#f0f0f0;text-decoration:underline;text-decoration-color:#2f3135;">${esc(c.nome)}</span><span style="display:block;font-size:14px;line-height:20px;color:#a3a4a6;">${esc(c.set)}</span></a>
            </td>
            <td valign="middle" align="right" style="${borda}padding:12px 0 12px 12px;${FONT}font-size:16px;line-height:22px;font-weight:800;color:${cor};white-space:nowrap;">${c.direcao}</td>
          </tr>`
  }).join('')

  const blocoOutras = n === 0 ? '' : linha(`
        <p class="h2" style="margin:0 0 2px;font-size:21px;line-height:27px;font-weight:800;color:#f0f0f0;">${n === 1 ? 'Mais 1 da sua página mexeu' : `Mais ${n} da sua página mexeram`}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${linhas}</table>
        ${p('Toque em <strong style="color:#f0f0f0;">Acompanhar preço</strong> na página da carta e o sino avisa quando ela mexer 10% ou mais.', 'margin:14px 0 0;font-size:15px;line-height:23px;color:#a3a4a6;')}`, '30px 32px 0')

  const conteudo = [
    hero({
      src: urlImagemPessoal('e01-fichario', ctx.tokenImagem),
      alt,
      href: hrefGancho('hero'),
      largura: 598,
      altura: 380,
    }),
    linha(`
        ${h1(`${esc(d.nome)}, o seu ${esc(g.nome)} subiu&nbsp;${pctInt}%.`)}
        ${p(`Era ${reais(g.precoAntes)} há uma semana. Hoje o menor preço anunciado no Mercado Brasileiro é <strong style="color:#22c55e;white-space:nowrap;">${reais(g.precoAgora)}</strong>.`, 'margin:0;font-size:15px;line-height:22px;color:#a3a4a6;')}`, '18px 32px 0'),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="px" align="left" style="padding:20px 32px 0;">
        ${btnRegua(esc(`Abrir o meu ${g.nome}`), hrefGancho('cta'))}
      </td></tr></table>`,
    blocoOutras,
    linha(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-top:1px solid #202227;padding-top:16px;${FONT}font-size:16px;line-height:25px;color:#a3a4a6;">Seguimos de olho no seu fichário. Se outra carta sair do bolso, contamos para você por aqui.</td>
        </tr></table>`, '24px 32px 0'),
  ].join('\n')

  const html = layoutRegua({
    conteudo,
    campanha: CAMPANHA,
    categoria: 'novidades',
    links: ctx.links,
    preheader,
    assinatura: true,
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E01: TemplateRegua<DadosE01> = {
  id: 'E01',
  nome: 'O Omanyte saiu do bolso',
  trilha: 'Novidades',
  categoria: 'novidades',
  exemplo: {
    // PERSONA DE EXEMPLO (direcao/PERSONAS.md): Marina, 11 cartas, R$ 1.955,30.
    nome: 'Marina',
    gancho: {
      nome: 'Omanyte',
      set: '151',
      slug: 'sv3pt5-180',
      imagem: 'https://images.pokemontcg.io/sv3pt5/180.png',
      precoAntes: 99,
      precoAgora: 160,
      pct: 61.6,
    },
    outras: [
      { nome: 'Giratina V', set: 'Lost Origin', slug: 'swsh11-186', direcao: 'subiu' },
      { nome: 'Scizor', set: 'Obsidian Flames', slug: 'sv3-205', direcao: 'caiu' },
      { nome: 'Revavroom ex', set: 'Obsidian Flames', slug: 'sv3-224', direcao: 'caiu' },
    ],
    totalCartas: 11,
    valorColecao: 1955.3,
  },
  montar,
}

