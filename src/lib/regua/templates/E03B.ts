/**
 * E03B · D1: quanto vale a sua colecao (Ativacao), para quem ja tem 5 a 9
 * cartas. Mockup aprovado: _Regua/mockups/E03B-gaveta-5-a-9-cartas/email.html
 * (v3) e email-pior-caso.html (sem nome, sem alta, fora do teste).
 *
 * Gatilho: o mesmo do E03 (24h a 48h do cadastro, uma vez); 0 a 4 cartas
 * recebe o E03, 10+ sai da trilha. Categoria 'colecao', fora do teto.
 *
 * ARTE (toda pessoal, pela rota de imagem; src/lib/regua/img/e03b.tsx)
 * - Hero desktop `e03b-fichario` (600x300) e celular `e03b-fichario-celular`
 *   (390x300), trocados por @media: o fichario com as cartas da pessoa e a
 *   mais valiosa saindo do bolso, com o selo "+80% em 30 dias" (ou "a mais
 *   valiosa", sem alta). Cliente sem <style> fica com o de desktop.
 * - Miniaturas da lista `e03b-mini-1..3` (72x72): recorte quadrado da arte.
 * Valor, nome, quantidade e variacao sao TEXTO VIVO.
 */
import { btnRegua, blocoPromocao, layoutRegua } from '@/lib/email'
import { urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { FONT, attr, caminhoCarta, esc, h1, linha, link, reais, reaisTxt } from './blocos-a'

const CAMPANHA = 'e03b'

export type CartaE03B = {
  nome: string
  set: string
  slug: string
  /** Menor preco do dia x copias. */
  valor: number
  /** Alta medida (30 dias tem prioridade sobre 7); null = sem variacao na linha. */
  variacao: { pct: number; dias: 30 | 7 } | null
  /** A rota de imagem tem a miniatura desta linha (`e03b-mini-<i>`)? */
  miniatura: boolean
}

export type DestaqueE03B =
  /** A mais valiosa subiu: preco unitario de N dias atras e de hoje, e o que somou (x copias). */
  | { tipo: 'alta'; dias: 30 | 7; antes: number; agora: number; ganho: number }
  /** Sem alta: a mais valiosa contra as outras somadas (quantas copias e quanto valem). */
  | { tipo: 'peso'; outras: number; outrasValor: number }

export type DadosE03B = {
  nome: string | null
  /** Soma das quantidades (5 a 9). */
  total: number
  valorTotal: number
  /** As 3 mais valiosas; a primeira e a do hero, do comparativo e do botao. */
  cartas: CartaE03B[]
  destaque: DestaqueE03B
  /** O resto da colecao: copias e soma. */
  restante: { quantidade: number; valor: number }
  /** Data do menor preco usado, "dd/mm". */
  dataPreco: string
  /** Fim do teste do Pro por extenso; null = fora do teste (sem P.S.). */
  fimTeste: string | null
  /** Scans que ainda restam no teste; null = so o prazo. */
  scansRestantes: number | null
}

function pctInt(v: number): string {
  return `${Math.round(v)}%`
}

function montar(d: DadosE03B, ctx: CtxRegua) {
  const mv = d.cartas[0]
  const dq = d.destaque
  const alta = dq.tipo === 'alta' ? dq : null
  const peso = dq.tipo === 'peso' ? dq : null
  const outrasN = peso ? peso.outras : d.total - 1
  const quase = peso ? Math.abs(mv.valor - peso.outrasValor) <= 0.15 * Math.max(mv.valor, peso.outrasValor) : false
  const pctColecao = d.valorTotal > 0 ? Math.round((mv.valor / d.valorTotal) * 100) : 0

  const assunto = d.nome
    ? `${d.nome}, sua coleção já vale ${reaisTxt(d.valorTotal)}`
    : `Suas ${d.total} cartas já valem ${reaisTxt(d.valorTotal)}`
  const preheader = alta
    ? `A ${mv.nome} foi de ${reaisTxt(alta.antes)} para ${reaisTxt(alta.agora)} em ${alta.dias} dias. Veja o gráfico.`
    : quase
      ? `A ${mv.nome} sozinha vale ${reaisTxt(mv.valor)}, quase o mesmo que as outras ${outrasN} juntas.`
      : `A ${mv.nome} sozinha vale ${reaisTxt(mv.valor)}, ${pctColecao}% da sua coleção.`

  const sub = alta
    ? `A ${esc(mv.nome)} sozinha subiu <strong style="color:#22c55e;font-weight:800;white-space:nowrap;">${pctInt(mv.variacao?.pct ?? 0)} em ${alta.dias}&nbsp;dias</strong>.`
    : `Só a mais valiosa, ${esc(mv.nome)}, vale <strong style="color:#f0f0f0;font-weight:800;white-space:nowrap;">${reais(mv.valor)}</strong>.`

  const hrefHero = link('/minha-colecao', CAMPANHA, 'hero')
  const ctaTxt = alta
    ? (mv.nome.length > 16 ? 'Ver o gráfico dessa carta' : `Ver o gráfico da ${mv.nome}`)
    : `Ver as ${d.total} cartas com preço`
  const ctaHref = alta ? link(caminhoCarta(mv.slug), CAMPANHA, 'cta') : link('/minha-colecao', CAMPANHA, 'cta')

  const alt = `O seu fichário aberto com as suas ${d.total} cartas. A ${mv.nome} sai do bolso: ` +
    (mv.variacao ? `subiu ${pctInt(mv.variacao.pct)} em ${mv.variacao.dias} dias.` : 'é a mais valiosa.')
  const estiloImg = `display:block;width:100%;height:auto;border:0;color:#f0f0f0;${FONT}font-size:16px;font-weight:700;line-height:24px;background-color:#191b20;`
  const heroHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="#0d0f14" style="background-color:#0d0f14;">
        <a href="${attr(hrefHero)}" target="_blank" style="text-decoration:none;">
          <img class="e03b-hero-d" src="${attr(urlImagemPessoal('e03b-fichario', ctx.tokenImagem))}" width="600" height="300" alt="${attr(alt)}" style="${estiloImg}max-width:600px;"/>
          <!--[if !mso]><!-->
          <div class="e03b-hero-m" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
            <img src="${attr(urlImagemPessoal('e03b-fichario-celular', ctx.tokenImagem))}" width="390" height="300" alt="${attr(alt)}" style="${estiloImg}"/>
          </div>
          <!--<![endif]-->
        </a>
      </td></tr>
    </table>`

  const cab = (txt: string, cor = '#a3a4a6') => `<p class="e03b-cab" style="margin:0;font-size:14px;line-height:18px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${cor};">${txt}</p>`
  const val = (v: number, cor: string) => `<p class="e03b-val" style="margin:4px 0 0;font-size:24px;line-height:30px;font-weight:800;letter-spacing:-0.02em;white-space:nowrap;color:${cor};">${reais(v)}</p>`
  const col = (html: string) => `<td width="44%" valign="top" style="width:44%;${FONT}">${html}</td>`
  const sinal = (s: string) => `<td width="12%" align="center" valign="middle" style="width:12%;${FONT}font-size:24px;line-height:30px;font-weight:800;color:#f59e0b;padding-top:18px;">${s}</td>`
  const titulo = alta ? `${esc(mv.nome)}, ${esc(mv.set)}` : 'Uma carta contra todas as outras'
  const colunas = alta
    ? `${col(cab(`Há ${alta.dias}&nbsp;dias`) + val(alta.antes, '#a3a4a6'))}${sinal('&rarr;')}${col(cab('Hoje', '#22c55e') + val(alta.agora, '#f0f0f0'))}`
    : `${col(cab(esc(mv.nome), '#f59e0b') + val(mv.valor, '#f0f0f0'))}${sinal(quase ? '&asymp;' : '&times;')}${col(cab(`As outras ${outrasN}&nbsp;juntas`) + val(peso!.outrasValor, '#a3a4a6'))}`
  const frase = alta
    ? `Só essa carta somou <strong style="color:#22c55e;font-weight:800;white-space:nowrap;">+${reais(alta.ganho)}</strong> à sua coleção. O gráfico de preço mostra o caminho até&nbsp;aqui.`
    : quase
      ? `A ${esc(mv.nome)} sozinha vale quase o mesmo que o resto da coleção. Em Minha coleção, cada carta aparece com o preço do&nbsp;dia.`
      : `A ${esc(mv.nome)} sozinha é ${pctColecao}% da coleção. Em Minha coleção, cada carta aparece com o preço do&nbsp;dia.`
  const comparativo = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#191b20" style="background-color:#191b20;border:1px solid #202227;border-radius:16px;">
          <tr><td class="e03b-cpx e03b-ctit" style="padding:16px 18px 0;${FONT}">
            <p style="margin:0;font-size:16px;line-height:22px;font-weight:800;color:#f0f0f0;">${titulo}</p>
          </td></tr>
          <tr><td class="e03b-cpx e03b-ccols" style="padding:12px 18px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${colunas}</tr></table>
          </td></tr>
          <tr><td class="e03b-cpx" style="padding:12px 18px 16px;${FONT}">
            <p style="margin:0;border-top:1px solid #2a2c31;padding-top:12px;font-size:15px;line-height:22px;color:#a3a4a6;">${frase}</p>
          </td></tr>
        </table>`

  const seta = (txt: string, largura: number) => `<td class="e03b-seta" width="${largura}" align="right" valign="middle" style="width:${largura}px;padding:10px 14px 10px 0;${FONT}">
                <p style="margin:0;font-size:14px;line-height:20px;font-weight:800;color:#f59e0b;white-space:nowrap;"><span class="e03b-seta-txt">${txt}&nbsp;</span><span style="font-size:20px;line-height:20px;">&rarr;</span></p>
              </td>`
  const linhas = d.cartas.map((c, i) => {
    const href = attr(link(caminhoCarta(c.slug), CAMPANHA, `linha-${i + 1}`))
    const varTxt = c.variacao
      ? `<span style="display:inline-block;font-size:14px;line-height:19px;font-weight:700;color:#22c55e;white-space:nowrap;">&nbsp;&nbsp;+${pctInt(c.variacao.pct)} em ${c.variacao.dias} dias</span>`
      : ''
    const meta = `${esc(c.set)}${i === 0 ? ' &middot; <strong style="color:#f0f0f0;font-weight:800;">a mais valiosa</strong>' : ''}`
    const estiloMini = `display:block;width:72px;height:72px;border:0;border-radius:10px;color:#a3a4a6;${FONT}font-size:14px;line-height:19px;background-color:#191b20;`
    const mini = c.miniatura
      ? `<img src="${attr(urlImagemPessoal(`e03b-mini-${i + 1}`, ctx.tokenImagem))}" width="72" height="72" alt="${attr(`${c.nome}, ${c.set}`)}" style="${estiloMini}"/>`
      : `<table role="presentation" width="72" cellpadding="0" cellspacing="0" border="0"><tr><td width="72" height="72" bgcolor="#0d0f14" style="${estiloMini}background-color:#0d0f14;border:1px solid #2f3135;">&nbsp;</td></tr></table>`
    return `<tr><td style="border-bottom:1px solid #202227;">
            <a href="${href}" target="_blank" title="${attr(`${c.nome}, ${c.set}: ver a carta e o preço na Bynx`)}" style="display:block;text-decoration:none;color:#f0f0f0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="72" valign="middle" style="width:72px;padding:10px 0 10px 10px;">${mini}</td>
              <td class="e03b-txt" valign="middle" style="padding:10px 6px 10px 14px;${FONT}">
                <p style="margin:0;font-size:17px;line-height:22px;font-weight:800;color:#f0f0f0;">${esc(c.nome)}</p>
                <p style="margin:1px 0 3px;font-size:14px;line-height:19px;color:#a3a4a6;">${meta}</p>
                <p style="margin:0;${FONT}"><span class="e03b-preco" style="font-size:19px;line-height:24px;font-weight:800;letter-spacing:-0.02em;color:${i === 0 ? '#f59e0b' : '#f0f0f0'};white-space:nowrap;">${reais(c.valor)}</span>${varTxt}</p>
              </td>
              ${seta('Ver carta', 92)}
            </tr></table>
            </a>
          </td></tr>`
  }).join('')
  const r = d.restante
  const linhaResto = r.quantidade > 0
    ? `<tr><td>
            <a href="${attr(link('/minha-colecao', CAMPANHA, 'linha-outras'))}" target="_blank" title="${attr(`Ver as ${d.total} cartas em Minha coleção`)}" style="display:block;text-decoration:none;color:#f0f0f0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td class="e03b-txt" valign="middle" style="padding:14px 6px 14px 16px;${FONT}">
                <p style="margin:0;font-size:15px;line-height:21px;color:#a3a4a6;">E mais ${r.quantidade} ${r.quantidade === 1 ? 'carta' : 'cartas'} &middot; <strong style="color:#f0f0f0;font-weight:800;white-space:nowrap;">${reais(r.valor)}</strong></p>
              </td>
              ${seta('Minha coleção', 140)}
            </tr></table>
            </a>
          </td></tr>`
    : ''

  const ps = d.fimTeste
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;"><tr>
          <td style="border-top:1px solid #202227;padding-top:16px;${FONT}">
            <p style="margin:0;font-size:16px;line-height:25px;color:#a3a4a6;"><span style="font-weight:800;color:#f59e0b;">P.S.</span> Seu teste do Pro na Bynx vai até <strong style="color:#f0f0f0;font-weight:800;">${esc(d.fimTeste).replace(/ (\S+)$/, '&nbsp;$1')}</strong>${d.scansRestantes && d.scansRestantes > 0 ? `, e ainda ${d.scansRestantes === 1 ? 'resta' : 'restam'} <strong style="color:#f0f0f0;font-weight:800;">${d.scansRestantes}&nbsp;${d.scansRestantes === 1 ? 'scan' : 'scans'}</strong>` : ''}.</p>
          </td>
        </tr></table>`
    : undefined

  const conteudo = [
    heroHtml,
    linha(`
        <p style="margin:0 0 8px;font-size:14px;line-height:18px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#f59e0b;">Suas ${d.total} cartas${d.nome ? `, ${esc(d.nome)}` : ''}</p>
        ${h1(`Sua coleção já vale <span style="color:#f59e0b;white-space:nowrap;">${reais(d.valorTotal)}</span>.`, '0')}
        <p class="e03b-sub" style="margin:10px 0 0;font-size:17px;line-height:25px;color:#a3a4a6;">${sub}</p>`, '24px 32px 0', 'e03b-pth'),
    linha(comparativo, '22px 32px 0', 'e03b-ptp'),
    linha(btnRegua(esc(ctaTxt), ctaHref), '18px 32px 0', 'e03b-ptc'),
    linha(`
        <p style="margin:0 0 10px;font-size:16px;line-height:22px;font-weight:800;color:#f0f0f0;">De onde vem esse valor</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#191b20" style="background-color:#191b20;border:1px solid #202227;border-radius:16px;">${linhas}${linhaResto}</table>
        <p style="margin:12px 0 0;font-size:14px;line-height:20px;color:#6b6c6f;">Menor preço no Mercado Brasileiro em&nbsp;${esc(d.dataPreco)}.</p>`, '32px 32px 0', 'e03b-ptl'),
  ].join('\n')

  const css = `@media only screen and (max-width:480px){
  .e03b-hero-d{display:none!important}
  .e03b-hero-m{display:block!important;max-height:none!important;overflow:visible!important}
  .e03b-pth{padding-top:14px!important}
  .e03b-sub{font-size:16px!important;line-height:23px!important;margin-top:6px!important}
  .e03b-ptp{padding-top:14px!important}
  .e03b-cpx{padding-left:14px!important;padding-right:14px!important}
  .e03b-val{font-size:20px!important;line-height:26px!important}
  .e03b-ctit{display:none!important}
  .e03b-ccols{padding-top:14px!important}
  .e03b-ptc{padding-top:12px!important}
  .e03b-ptl{padding-top:28px!important}
  .e03b-txt{padding:10px 4px 10px 12px!important}
  .e03b-seta{width:30px!important;padding:10px 12px 10px 0!important}
  .e03b-seta-txt{display:none!important}
  .e03b-preco{font-size:18px!important;line-height:23px!important}
}`

  const html = layoutRegua({
    conteudo,
    campanha: CAMPANHA,
    categoria: 'colecao',
    links: ctx.links,
    preheader,
    assinatura: true,
    respiroAssinatura: 28,
    psDepoisDoLogo: ps,
    css,
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E03B: TemplateRegua<DadosE03B> = {
  id: 'E03B',
  nome: 'D1: quanto vale a sua coleção (5 a 9 cartas)',
  trilha: 'Ativação',
  categoria: 'colecao',
  // PERSONA DE EXEMPLO (direcao/PERSONAS.md secao 3): Rafael no D1, 9 cartas, R$ 908,60. Precos de 07/10.
  exemplo: {
    nome: 'Rafael',
    total: 9,
    valorTotal: 908.6,
    cartas: [
      { nome: 'Cinccino ex', set: 'Caos Ascendente', slug: 'me4-119', valor: 349.9, variacao: { pct: 79.8, dias: 30 }, miniatura: true },
      { nome: 'Omanyte', set: '151', slug: 'sv3pt5-180', valor: 160, variacao: { pct: 61.6, dias: 7 }, miniatura: true },
      { nome: 'Durant ex', set: 'Fagulhas Impetuosas', slug: 'sv8-236', valor: 125, variacao: { pct: 78.8, dias: 7 }, miniatura: true },
    ],
    destaque: { tipo: 'alta', dias: 30, antes: 194.59, agora: 349.9, ganho: 155.31 },
    restante: { quantidade: 6, valor: 273.7 },
    dataPreco: '07/10',
    fimTeste: 'quarta, 14/10, às 14h',
    scansRestantes: 7,
  },
  montar,
}

/** Pior caso do mockup (email-pior-caso.html): sem nome, 6 cartas, sem alta, fora do teste. */
export const E03B_EXEMPLO_PIOR: DadosE03B = {
  nome: null,
  total: 6,
  valorTotal: 584.6,
  cartas: [
    { nome: 'Blastoise', set: 'Base (1999)', slug: 'base1-2', valor: 289.9, variacao: null, miniatura: true },
    { nome: 'Pikachu', set: 'Realeza Absoluta', slug: 'swsh12pt5-160', valor: 149.9, variacao: null, miniatura: true },
    { nome: 'Revavroom ex', set: 'Obsidiana em Chamas', slug: 'sv3-224', valor: 46, variacao: null, miniatura: true },
  ],
  destaque: { tipo: 'peso', outras: 5, outrasValor: 294.7 },
  restante: { quantidade: 3, valor: 98.8 },
  dataPreco: '07/10',
  fimTeste: null,
  scansRestantes: null,
}
