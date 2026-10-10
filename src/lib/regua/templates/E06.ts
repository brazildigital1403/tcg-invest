/**
 * E06 · Resumo quinzenal da colecao (Minha colecao). Mockup aprovado:
 * _Regua/mockups/E06-resumo-colecao/email.html (caso "uma carta salvou a
 * semana"). O caso comum (email-comum.html) NAO esta aqui.
 *
 * Gatilho: sexta quinzenal, alternando com o Radar Bynx. So com 5+ cartas.
 *
 * ARTE
 * - Hero = IMAGEM PESSOAL (rota de ImageResponse), tipo `e06-grafico`, 600x320
 *   (render 2x = 1200x640, JPG). Desenho de referencia:
 *   mockups/E06-resumo-colecao/assets/hero.html. A rota desenha:
 *   - no alto a esquerda: "sua colecao hoje, <dd/mm>" e o valor grande;
 *     legenda "— com o <carta>" (linha ambar) e "- - sem ele: R$ X" (tracejada
 *     vermelha, valor em vermelho);
 *   - o grafico de 7 pontos (um por dia, serie do periodo) com a linha ambar
 *     subindo ate ENTRAR na carta-heroi, grande e inclinada a direita (imagem
 *     da carta com brilho holo); a linha tracejada vermelha e a mesma colecao
 *     sem a carta; rotulo do primeiro dia ("30/10") embaixo a esquerda.
 *   Sem pilula sobre a arte, sem % e sem o ganho da carta (estao no texto).
 * - Miniatura do anuncio da meta: imagem da carta por URL (dado).
 */
import { btnRegua, blocoPromocao, layoutRegua } from '@/lib/email'
import { urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import {
  FONT, attr, caminhoCarta, esc, estiloCelular, h1, hero, imagemCarta, kicker, linha, link, p, plural, reais, reaisSinal, reaisTxt,
} from './blocos-a'

const CAMPANHA = 'e06'

export type MovimentoE06 = { nome: string; set: string; slug: string; /** variacao em R$ no periodo */ variacao: number }

export type DadosE06 = {
  nome: string
  periodo: { inicio: string; fim: string }
  totalCartas: number
  valorInicio: number
  valorHoje: number
  /** A carta que segurou a semana (a de maior ganho em R$). */
  heroi: { nome: string; set: string; slug: string; /** nome curto do botao, ex.: "Giratina" */ curto: string }
  /** As cartas que mexeram no periodo; a soma e o saldo. A do heroi vem primeiro. */
  movimentos: MovimentoE06[]
  /** Anuncio ativo de carta que falta na meta da pessoa (opcional). */
  achadoMeta: {
    carta: string
    numero: string
    preco: number
    /** Ex.: "NM, em português, em uma loja da Bynx" */
    descricao: string
    imagem: string
    metaId: string
    metaNome: string
    /** Quantas da meta a pessoa tera com esta carta e o total da meta. */
    comEla: number
    totalMeta: number
  } | null
  /** Paragrafo de colecionador sobre a carta-heroi (texto puro). */
  notaColecionador: string
}

const EXTENSO = ['Nenhuma', 'Uma', 'Duas', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove', 'Dez']

function montar(d: DadosE06, ctx: CtxRegua) {
  const h = d.heroi
  const assunto = `${d.nome}, o seu ${h.nome} salvou a semana`
  const preheader = 'Sem ele, a sua coleção teria fechado no vermelho. Foi um pico ou ele vem subindo há meses?'
  const hrefHeroi = (c: string) => link(caminhoCarta(h.slug), CAMPANHA, c)

  const saldo = d.movimentos.reduce((s, m) => s + m.variacao, 0)
  const ganhoHeroi = d.movimentos.find((m) => m.slug === h.slug)?.variacao ?? 0
  const semEle = d.valorHoje - ganhoHeroi
  const maior = Math.max(...d.movimentos.map((m) => Math.abs(m.variacao)), 1)
  const qtd = d.movimentos.length
  const qtdTxt = qtd <= 10 ? EXTENSO[qtd] : String(qtd)

  const linhas = d.movimentos.map((m) => {
    const href = attr(link(caminhoCarta(m.slug), CAMPANHA, `conta-${m.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`))
    const cor = m.variacao >= 0 ? '#22c55e' : '#ef4444'
    const larg = Math.max(2, Math.round((Math.abs(m.variacao) / maior) * 100))
    const barra = larg >= 100
      ? `<td width="100%" height="8" bgcolor="${cor}" style="height:8px;font-size:1px;line-height:8px;background-color:${cor};border-radius:999px;">&nbsp;</td>`
      : `<td width="${larg}%" height="8" bgcolor="${cor}" style="height:8px;font-size:1px;line-height:8px;background-color:${cor};border-radius:999px;">&nbsp;</td><td width="${100 - larg}%" style="font-size:1px;line-height:8px;">&nbsp;</td>`
    return `<tr><td valign="top" style="padding:0;"><a href="${href}" target="_blank" style="display:block;padding:12px 0 10px;${FONT}font-size:16px;line-height:22px;font-weight:800;color:#f0f0f0;text-decoration:none;">${esc(m.nome)} <span class="e06-set" style="white-space:nowrap;font-size:14px;font-weight:400;color:#a3a4a6;"><span class="e06-ponto">&middot; </span>${esc(m.set)}</span></a></td><td align="right" valign="top" style="padding:0 0 0 12px;"><a href="${href}" target="_blank" style="display:block;padding:12px 0 10px;${FONT}font-size:16px;line-height:22px;font-weight:800;color:${cor};text-decoration:none;white-space:nowrap;">${reaisSinal(m.variacao)}</a></td></tr>
              <tr><td colspan="2" style="padding:0 0 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#2b2d32" style="background-color:#2b2d32;border-radius:999px;"><tr>${barra}</tr></table></td></tr>`
  }).join('')

  const corSaldo = saldo >= 0 ? '#22c55e' : '#ef4444'
  const conta = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#191b20" style="background-color:#191b20;border:1px solid #202227;border-radius:16px;">
          <tr><td class="e06-conta" style="padding:20px 20px 18px;${FONT}">
            <p style="margin:0 0 4px;font-size:22px;line-height:28px;font-weight:800;letter-spacing:-0.01em;color:#f0f0f0;">A conta dos 7 dias</p>
            <p style="margin:0 0 2px;font-size:14px;line-height:20px;color:#a3a4a6;">${qtd === 1 ? 'Uma carta fez todo o saldo. Toque nela para ver o preço.' : `${qtdTxt} cartas fizeram todo o saldo. Toque em uma para ver o preço.`}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${linhas}
              <tr><td style="padding:14px 0 0;border-top:1px solid #2b2d32;${FONT}font-size:16px;line-height:22px;font-weight:800;color:#f0f0f0;">Saldo dos 7 dias</td><td align="right" style="padding:14px 0 0;border-top:1px solid #2b2d32;${FONT}font-size:18px;line-height:22px;font-weight:800;color:${corSaldo};white-space:nowrap;">${reaisSinal(saldo)}</td></tr>
            </table>
          </td></tr>
        </table>`

  const a = d.achadoMeta
  const achado = a
    ? linha(`<a href="${attr(link(`/metas/${encodeURIComponent(a.metaId)}`, CAMPANHA, 'meta'))}" target="_blank" style="display:block;text-decoration:none;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #202227;border-radius:16px;">
          <tr>
            <td width="72" valign="top" style="padding:14px 0 14px 14px;width:72px;">
              <img src="${attr(imagemCarta(a.imagem))}" width="72" height="100" alt="${attr(`${a.carta} ${a.numero}`)}" style="display:block;width:72px;height:100px;border:0;border-radius:6px;color:#f0f0f0;${FONT}font-size:14px;background-color:#191b20;"/>
            </td>
            <td valign="top" style="padding:14px;${FONT}">
              ${kicker('Achamos para a sua meta', '#f59e0b', '0 0 4px')}
              <p style="margin:0 0 4px;font-size:16px;line-height:22px;font-weight:800;color:#f0f0f0;">${esc(a.carta)} ${esc(a.numero)} à venda por <span style="color:#22c55e;white-space:nowrap;">${reais(a.preco)}</span></p>
              <p style="margin:0;font-size:14px;line-height:20px;color:#a3a4a6;">${esc(a.descricao)}. ${a.comEla === 1 ? 'É a primeira carta' : 'É mais uma carta'} da sua meta de ${esc(a.metaNome)}: com ela, <span style="color:#f0f0f0;white-space:nowrap;">${a.comEla} de ${a.totalMeta}</span>.</p>
            </td>
          </tr>
        </table>
        </a>`, '28px 32px 0')
    : ''

  const alt = `Sua coleção hoje, ${d.periodo.fim}: ${reaisTxt(d.valorHoje)}. No gráfico de ${d.periodo.inicio} a ${d.periodo.fim}, a linha desce nos primeiros dias e depois sobe até entrar na carta do ${h.nome}, grande, à direita. A linha tracejada é a mesma coleção sem ele: ${reaisTxt(semEle)}, abaixo dos ${reaisTxt(d.valorInicio)} do começo.`

  const conteudo = [
    estiloCelular('.e06-conta{padding:16px 14px 14px!important}.e06-set{display:block!important}.e06-ponto{display:none!important}'),
    hero({ src: urlImagemPessoal('e06-grafico', ctx.tokenImagem), alt, href: hrefHeroi('hero'), largura: 600, altura: 320 }),
    linha(`
        ${kicker(`Seus 7 dias, ${esc(d.nome)}`)}
        ${h1(`O ${esc(h.nome)} salvou a&nbsp;sua&nbsp;semana`)}
        ${p(`Sem ele, a sua coleção teria fechado a semana no <strong style="color:#ef4444;">vermelho</strong>. Foi um pico de 7 dias ou ele vem subindo há meses?`)}`, '20px 32px 0'),
    linha(btnRegua(esc(`Ver o gráfico do meu ${h.curto}`), hrefHeroi('cta')), '20px 32px 0'),
    linha(conta, '32px 32px 0'),
    linha(`<p style="margin:0;font-size:14px;line-height:20px;color:#a3a4a6;">${plural(d.totalCartas, 'carta', 'cartas')} <span style="color:#6e6f72;">&middot;</span> menor preço do Mercado Brasileiro</p>`, '12px 32px 0'),
    achado,
    linha(`<p style="margin:0;padding-top:20px;border-top:1px solid #202227;font-size:16px;line-height:25px;color:#a3a4a6;">${esc(d.notaColecionador)}</p>`, '28px 32px 0'),
  ].join('\n')

  const html = layoutRegua({
    conteudo,
    campanha: CAMPANHA,
    categoria: 'colecao',
    links: ctx.links,
    preheader,
    rotulo: `Resumo · ${d.periodo.inicio} a ${d.periodo.fim}`,
    assinatura: true,
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E06: TemplateRegua<DadosE06> = {
  id: 'E06',
  nome: 'Resumo quinzenal da coleção',
  trilha: 'Minha coleção',
  categoria: 'colecao',
  // PERSONA DE EXEMPLO (direcao/PERSONAS.md): Marina, 11 cartas, de R$ 1.503,45 a R$ 1.955,30.
  exemplo: {
    nome: 'Marina',
    periodo: { inicio: '30/10', fim: '06/11' },
    totalCartas: 11,
    valorInicio: 1503.45,
    valorHoje: 1955.3,
    heroi: { nome: 'Giratina V', set: 'Lost Origin', slug: 'swsh11-186', curto: 'Giratina' },
    movimentos: [
      { nome: 'Giratina V', set: 'Lost Origin', slug: 'swsh11-186', variacao: 510.9 },
      { nome: 'Omanyte', set: '151', slug: 'sv3pt5-180', variacao: 61 },
      { nome: 'Revavroom ex', set: 'Obsidian Flames', slug: 'sv3-224', variacao: -57.95 },
      { nome: 'Scizor', set: 'Obsidian Flames', slug: 'sv3-205', variacao: -62.1 },
    ],
    achadoMeta: {
      carta: 'Tinkatuff',
      numero: '217/193',
      preco: 125,
      descricao: 'NM, em português, em uma loja da Bynx',
      imagem: 'https://images.pokemontcg.io/sv2/217.png',
      metaId: 'exemplo',
      metaNome: 'Paldea Evolved',
      comEla: 1,
      totalMeta: 279,
    },
    notaColecionador: 'Uma coisa de colecionador: esse Giratina V é a arte alternativa do Lost Origin, a do Giratina no Mundo Distorção, e é das cartas que mais gostamos de ver em uma pasta. Por que ele subiu agora, não sabemos dizer com certeza. Se você souber, responde este e-mail: a Bynx lê todas as respostas.',
  },
  montar,
}
