/**
 * E20 - Suas repetidas paradas viram dinheiro.
 * Trilha Mercado. Mockup aprovado: _Regua/mockups/E20-venda-suas-repetidas.
 *
 * Arte: nenhuma fixa.
 * - A tela do anuncio (passo de Detalhes do AnunciarModal) virou HTML: miniatura
 *   oficial da carta, nome, "Preco de venda" com o valor em TEXTO VIVO, a pilula
 *   "Menor preco" e a faixa "Publicar anuncio" (desenho, nao e link).
 * - PESSOAL: o varal com as repetidas da pessoa e os precos, pela rota de imagem:
 *   urlImagemPessoal('e20-varal', token).
 *
 * ROTA /api/email/img/e20-varal (a fazer em outra fase):
 *   dados: ate 3 repetidas (imagem oficial e menor preco de hoje), a 1a maior e
 *          no centro, com o preco de 30 dias atras se estiver em alta.
 *   tamanho: 600x320 (render 2x = 1200x640), JPG, fundo #0d0f14 opaco.
 *   layout: varal com prendedores ambar; cada repetida com a copia gemea atras.
 *     Centro: a 1a maior, etiqueta ambar->vermelho "R$ 69,90 / era R$ 39,90"
 *     (riscado). Laterais: etiquetas brancas com o menor preco. Brilhos discretos.
 *   referencia exata: mockups/E20-venda-suas-repetidas/assets/hero.html.
 *   ?exemplo=1: Kangaskhan, Mew ex e Pikachu de 1999 (persona Marina).
 *
 * O CTA abre Minha colecao; o anuncio sai do CardDetailModal ("Anunciar esta carta").
 * liquidoAprox = preco da 1a repetida menos comissaoVendedorCents (prazo da pessoa),
 * calculado pelo motor (src/lib/comissao.ts), nunca aqui.
 */
import { btnRegua, blocoPromocao, layoutRegua, utmRegua, URL_CANONICA } from '@/lib/email'
import { brl, urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { COR, FONT, attr, comCss, esc, linha, logoAssinatura, rs } from './ui-b'

export type RepetidaE20 = {
  nome: string
  set: string
  imagem: string
  /** Menor preco de hoje no Mercado Brasileiro. */
  preco: number
}

export type GanchoE20 =
  /** A) pessoas com a carta na watchlist (> 0). */
  | { tipo: 'acompanham'; n: number }
  /** B) ninguem acompanha e nenhum anuncio ativo da carta. */
  | { tipo: 'sem-anuncio' }
  /** C) ninguem acompanha e de 1 a 3 anuncios ativos. */
  | { tipo: 'poucos'; n: number }
  /** D) ninguem acompanha, mais de 3 anuncios: a alta de 30 dias (so com `altaDe`). */
  | { tipo: 'alta' }

export type DadosE20 = {
  nome: string
  /** Repetidas nao anunciadas; a primeira e a mais cara (destaque). */
  repetidas: RepetidaE20[]
  /** Menor preco da 1a repetida 30 dias atras, se ela estiver em alta; senao null. */
  altaDe: number | null
  gancho: GanchoE20
  /** Quanto a pessoa recebe da 1a repetida depois da taxa (aproximado). */
  liquidoAprox: number
}

const ID = 'e20'

const CSS = `@media only screen and (max-width:480px){
  .topo{padding:12px 16px 8px!important}
  .h1{font-size:24px!important;line-height:30px!important}
  .pt-h1{padding-top:16px!important}
  .pt-g{padding-top:12px!important}
  .g-txt{line-height:23px!important}
  .pt-b{padding-top:16px!important}
  .h2{font-size:21px!important;line-height:27px!important}
  .btn{height:48px!important;line-height:48px!important}
  .tela{width:54%!important;padding-right:10px!important}
  .tl-px{padding:8px!important}
  .tl-nome{font-size:15px!important;line-height:19px!important}
  .tl-mini{width:32px!important}
  .tl-rot{font-size:14px!important}
  .tl-valor{font-size:24px!important;line-height:30px!important}
  .tl-pill{font-size:14px!important}
  .tl-pub{font-size:14px!important;line-height:36px!important}
}`

function montar(d: DadosE20, ctx: CtxRegua) {
  const colecao = `${URL_CANONICA}/minha-colecao`
  const [c] = d.repetidas
  const carta = esc(c.nome)
  const q = d.repetidas.length
  const soma = d.repetidas.reduce((s, r) => s + r.preco, 0)
  const pctAlta = d.altaDe && d.altaDe > 0 && c.preco > d.altaDe ? Math.round(((c.preco - d.altaDe) / d.altaDe) * 100) : null
  const assunto = pctAlta
    ? `${d.nome}, seu ${c.nome} repetido subiu ${pctAlta}%`
    : `${d.nome}, seu ${c.nome} repetido está saindo por ${brl(c.preco)}`
  const g = d.gancho
  const preheader = g.tipo === 'acompanham' && g.n > 0
    ? (g.n === 1
        ? '1 pessoa acompanha esta carta e recebe um aviso quando você anunciar.'
        : `${g.n} pessoas acompanham esta carta e recebem um aviso quando você anunciar.`)
    : `Suas ${q} repetidas somam ${brl(soma)}. Anunciar é grátis.`

  const amb = (t: string) => `<span style="color:${COR.ambar};">${t}</span>`
  let gancho = ''
  if (g.tipo === 'acompanham' && g.n > 0) {
    gancho = g.n === 1
      ? `${amb('1 pessoa acompanha esta carta.')} Você anuncia, ela recebe um aviso.`
      : `${amb(`${esc(g.n)} pessoas acompanham esta carta.`)} Você anuncia, elas recebem um aviso.`
  } else if (g.tipo === 'sem-anuncio') {
    gancho = `${amb(`Nenhum ${carta} à venda no Mercado da Bynx hoje.`)} O seu seria o único.`
  } else if (g.tipo === 'poucos') {
    gancho = amb(`Só ${esc(g.n)} ${g.n === 1 ? 'anúncio' : 'anúncios'} de ${carta} no Mercado da Bynx hoje.`)
  } else if (g.tipo === 'alta' && d.altaDe) {
    gancho = amb(`Em 30 dias, ele foi de ${rs(d.altaDe)} para ${rs(c.preco)}.`)
  }

  const inteiro = rs(c.preco).replace(/^R\$&nbsp;/, '')
  const tela = `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.fundo}" style="background-color:${COR.fundo};border:3px solid ${COR.borda2};border-bottom:0;border-radius:28px 28px 0 0;">
              <tr><td align="center" style="padding:12px 0 2px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="56" height="12" style="width:56px;height:12px;border:2px solid ${COR.borda2};border-radius:999px;font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td></tr>
              <tr><td class="tl-px" style="padding:10px 12px 14px;${FONT}">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${COR.borda};border-radius:12px;"><tr>
                  <td width="48" valign="middle" style="padding:8px 0 8px 8px;width:48px;"><img class="tl-mini" src="${attr(c.imagem)}" width="40" alt="" style="display:block;width:40px;height:auto;border:0;border-radius:3px;background-color:${COR.borda};"/></td>
                  <td valign="middle" class="tl-nome" style="padding:8px 8px 8px 10px;${FONT}font-size:18px;line-height:22px;font-weight:800;color:${COR.texto};">${carta}</td>
                </tr></table>
                <p class="tl-rot" style="margin:10px 0 4px;font-size:16px;line-height:20px;font-weight:700;color:${COR.texto2};">Preço de venda</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.surface2}" style="background-color:${COR.surface2};border:2px solid ${COR.ambar};border-radius:12px;"><tr>
                  <td class="tl-valor" style="padding:4px 12px;${FONT}font-size:28px;line-height:36px;font-weight:800;color:${COR.texto};white-space:nowrap;"><span style="font-size:16px;color:${COR.texto2};">R$</span>&nbsp;${inteiro}</td>
                </tr></table>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;"><tr>
                  <td class="tl-pill" style="padding:4px 12px;border:2px solid ${COR.ambar};border-radius:999px;${FONT}font-size:15px;line-height:20px;font-weight:800;color:${COR.ambar};white-space:nowrap;">Menor preço</td>
                </tr></table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;"><tr>
                  <td class="tl-pub tinta" align="center" bgcolor="${COR.ambar}" style="background-color:${COR.ambar};background-image:linear-gradient(135deg,#f59e0b,#ef4444);border-radius:10px;${FONT}font-size:15px;line-height:40px;font-weight:800;color:${COR.tinta};white-space:nowrap;">Publicar anúncio</td>
                </tr></table>
              </td></tr>
            </table>`

  const passo = (n: number, t: string, ultimo = false) => `
            <p style="margin:0;font-size:14px;line-height:20px;font-weight:800;color:${COR.ambar};">${n}</p>
            <p style="margin:0 0 ${ultimo ? 0 : 14}px;font-size:16px;line-height:23px;color:${COR.texto};">${t}</p>`

  const conteudo = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="${COR.elevado}" style="background-color:${COR.elevado};">
        <a href="${attr(utmRegua(colecao, ID, 'hero'))}" target="_blank" style="text-decoration:none;">
          <img src="${attr(urlImagemPessoal('e20-varal', ctx.tokenImagem))}" width="600" height="320" alt="Varal com as suas ${q === 1 ? 'carta repetida' : `${esc(q)} cartas repetidas`}, pelo menor preço de hoje no Mercado Brasileiro. No centro, maior, o ${carta}: ${rs(c.preco)}${d.altaDe ? `, era ${rs(d.altaDe)} há 30 dias` : ''}. ${d.repetidas.slice(1).map((r) => `${esc(r.nome)}: ${rs(r.preco)}.`).join(' ')}${q > 1 ? ` As ${q === 2 ? 'duas' : q === 3 ? 'três' : esc(q)} somam ${rs(soma)}.` : ''}" style="display:block;width:100%;max-width:600px;height:auto;border:0;color:${COR.texto};${FONT}font-size:16px;font-weight:700;line-height:24px;background-color:${COR.surface2};"/>
        </a>
      </td></tr>
    </table>
    ${linha(`
        <h1 class="h1" style="margin:0 0 8px;font-size:30px;line-height:36px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};">Seu ${carta} repetido está saindo por <span style="white-space:nowrap;">${rs(c.preco)}.</span></h1>
        ${q > 1 ? `<p style="margin:0;font-size:16px;line-height:24px;color:${COR.texto2};">Suas ${esc(q)} repetidas somam <span style="white-space:nowrap;color:${COR.texto};font-weight:700;">${rs(soma)}</span>.</p>` : ''}`, '24px 32px 0', 'pt-h1')}
    ${gancho ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px pt-g" style="padding:14px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="4" bgcolor="${COR.ambar}" style="width:4px;background-color:${COR.ambar};background-image:linear-gradient(180deg,#f59e0b,#ef4444);border-radius:999px;font-size:1px;line-height:1px;">&nbsp;</td>
          <td class="g-txt" style="padding:1px 0 1px 14px;${FONT}font-size:16px;line-height:24px;font-weight:700;color:${COR.texto};">${gancho}</td>
        </tr></table>
      </td></tr>
    </table>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px pt-b" align="left" style="padding:20px 32px 0;">
        ${btnRegua('Anunciar da minha coleção', utmRegua(colecao, ID, 'cta'))}
      </td></tr>
    </table>
    ${linha(`
        <h2 class="h2" style="margin:0 0 16px;font-size:24px;line-height:30px;font-weight:800;letter-spacing:-0.01em;color:${COR.texto};">Da coleção para o Mercado.</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td class="tela" width="46%" valign="top" style="width:46%;padding:0 14px 0 0;">${tela}</td>
          <td valign="middle" style="${FONT}">
            ${passo(1, `Na sua coleção, toque no ${carta}.`)}
            ${passo(2, 'Toque em Anunciar esta carta. O preço já vem pelo menor do Mercado Brasileiro.')}
            ${passo(3, 'Publique. Sem loja e sem CNPJ.', true)}
          </td>
        </tr></table>
        <p style="margin:20px 0 0;font-size:16px;line-height:24px;font-weight:700;color:${COR.texto};">Anunciar é grátis. A taxa só sai quando vende: do ${carta}, você recebe cerca de ${rs(d.liquidoAprox)}.</p>`, '32px 32px 0')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" align="left" style="padding:24px 32px 0;">
        ${btnRegua('Anunciar da minha coleção', utmRegua(colecao, ID, 'cta-fim'))}
      </td></tr>
    </table>
    ${linha(`
        <p style="margin:0 0 12px;padding-top:20px;border-top:1px solid ${COR.borda};font-size:16px;line-height:25px;color:${COR.texto2};">Travou em algum passo do anúncio? É só responder este <span style="white-space:nowrap;">e-mail</span>: nós lemos todas as respostas.</p>
        ${logoAssinatura()}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-top:1px solid ${COR.borda};"><tr>
          <td style="padding-top:16px;${FONT}font-size:15px;line-height:23px;color:${COR.texto2};"><span style="font-weight:800;color:${COR.ambar};">P.S.</span> Uma repetida vendida é um booster a mais no fim de semana.</td>
        </tr></table>`, '28px 32px 28px')}`

  const html = layoutRegua({
    conteudo,
    campanha: ID,
    categoria: 'mercado',
    links: ctx.links,
    preheader,
    rotulo: 'Mercado',
    // Logo da assinatura no conteudo: o P.S. aprovado vem DEPOIS dele.
    assinatura: false,
    promocao: blocoPromocao('destaque', ctx.promocoes),
  })
  return { assunto, preheader, html: comCss(html, CSS) }
}

export const E20: TemplateRegua<DadosE20> = {
  id: 'E20',
  nome: 'Suas repetidas paradas viram dinheiro',
  trilha: 'Mercado',
  categoria: 'mercado',
  // Persona de exemplo: Marina (PERSONAS.md secao 2): 3 repetidas, R$ 130,80. Kangaskhan
  // R$ 69,90 (era R$ 39,90, altas_30d), Mew ex R$ 34,00, Pikachu de 1999 R$ 26,90.
  // "3 pessoas acompanham" e o liquido de ~R$ 66,00 sao valores de EXEMPLO do mockup.
  exemplo: {
    nome: 'Marina',
    repetidas: [
      { nome: 'Kangaskhan', set: 'Destined Rivals', imagem: 'https://images.pokemontcg.io/sv10/204.png', preco: 69.9 },
      { nome: 'Mew ex', set: '151', imagem: 'https://images.pokemontcg.io/sv3pt5/151.png', preco: 34 },
      { nome: 'Pikachu (Base 1999)', set: 'Base', imagem: 'https://images.pokemontcg.io/base1/58.png', preco: 26.9 },
    ],
    altaDe: 39.9,
    gancho: { tipo: 'acompanham', n: 3 },
    liquidoAprox: 66,
  },
  montar,
}
