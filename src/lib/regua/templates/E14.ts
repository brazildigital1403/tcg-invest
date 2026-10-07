/**
 * E14 - Leilao: resultado do lote.
 *   A) "arrematou": martelo batido, recibo e botao de pagar (roxo -> rosa).
 *   B) "faltou": perdeu por um lance; o mesmo card a venda no Mercado.
 * Trilha Leilao. Mockups aprovados: _Regua/mockups/E14-leilao-resultado
 * (email.html = A, email-b.html = B).
 *
 * Arte:
 * - FIXA: /emails/regua/e14/serrilha.png (borda serrilhada do recibo, 536x14 @2x).
 * - PESSOAL (o hero leva a foto do proprio lote e o resultado da pessoa),
 *   pela rota de imagem:
 *
 * ROTA /api/email/img/e14-arrematado (a fazer em outra fase):
 *   dados: foto do lote (storage da Bynx). Nenhum valor desenhado.
 *   tamanho: 600x372 (render 2x = 1200x744), JPG, fundo #0d0f14 opaco.
 *   layout: martelo de leilao batendo a esquerda, a carta do lote no centro
 *     com brilho ambar e o carimbo vermelho inclinado "ARREMATADO" por cima;
 *     confete ambar/vermelho/rosa. Ref.: mockups/E14-leilao-resultado/assets/hero-a.html.
 *
 * ROTA /api/email/img/e14-faltou (a fazer em outra fase):
 *   dados: foto do lote, seuLance, martelo, preco do anuncio da mesma carta.
 *   tamanho: 600x372 (2x), JPG, fundo #0d0f14 opaco.
 *   layout: placar do lote a esquerda (seu lance riscado, martelo), a mesma
 *     carta a direita com a etiqueta verde do anuncio no Mercado.
 *     Ref.: mockups/E14-leilao-resultado/assets/hero-b.html.
 *   ?exemplo=1 nas duas: Blaine's Charizard (persona Lucas).
 *
 * Valores, recibo e anuncio vao em TEXTO VIVO. Categoria 'colecao' (aviso de
 * leilao nao e marketing); o motivo do rodape e o aprovado de cada variante.
 * Rotas /leiloes/... ainda nao existem no main (branch feat/leilao).
 */
import { btnRegua, blocoPromocao, layoutRegua, utmRegua, URL_CANONICA } from '@/lib/email'
import { brl, urlArte, urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { COR, FONT, ajustarRodape, attr, brlCurto, btnCompra, comCss, esc, linha, logoAssinatura, rs } from './ui-b'

type CartaLote = {
  nome: string
  /** Nome curto usado no assunto e no botao da variante B ("Charizard"). */
  apelido: string
  set: string
  numero: string
  condicao: string
  idioma: string
  /** Foto do lote (storage da Bynx) ou imagem oficial da carta. */
  imagem: string
}

type Base = {
  nome: string
  carta: CartaLote
  loja: string
  lote: { numero: string; slug: string; rodadaDia: string; horaMartelo: string }
  /** true enquanto a imagem nao e a foto do proprio lote (legenda "Imagem ilustrativa"). */
  imagemIlustrativa: boolean
}

export type DadosE14 =
  | (Base & {
      resultado: 'arrematou'
      arremate: {
        lance: number
        protecao: number
        cartao: number
        total: number
        protecaoPct: string
        cartaoPct: string
        /** "sábado, 12/12, às 20h14" */
        prazo: string
      }
    })
  | (Base & {
      resultado: 'faltou'
      faltou: {
        seuLance: number
        martelo: number
        /** Anuncio da mesma carta (0,5x a 1,5x do martelo); null = sem bloco, botao vira a agenda. */
        anuncio: { preco: number; slug: string; dataPreco: string } | null
      }
    })

const ID = 'e14'
const CATEGORIA = 'colecao' as const

const CSS = `@media only screen and (max-width:480px){
  .h2{font-size:21px!important;line-height:27px!important}
  .rec{padding-left:16px!important;padding-right:16px!important}
  .total{font-size:24px!important;line-height:30px!important}
}
@media only screen and (max-width:360px){
  .totlab,.total{display:block!important;width:100%!important}
  .total{text-align:left!important;padding-top:2px!important;border-top:0!important;font-size:24px!important}
}`

const forte = (t: string) => `<span style="color:${COR.texto};font-weight:700;white-space:nowrap;">${t}</span>`

function hero(d: DadosE14, ctx: CtxRegua, href: string, alt: string): string {
  const tipo = d.resultado === 'arrematou' ? 'e14-arrematado' : 'e14-faltou'
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="${COR.elevado}" style="background-color:${COR.elevado};">
        <a href="${attr(href)}" target="_blank" style="text-decoration:none;">
          <img src="${attr(urlImagemPessoal(tipo, ctx.tokenImagem))}" width="600" height="372" alt="${alt}" style="display:block;width:100%;max-width:600px;height:auto;border:0;color:${COR.texto};${FONT}font-size:16px;font-weight:700;line-height:24px;background-color:${COR.surface2};"/>
        </a>
      </td></tr>
    </table>`
}

function assinatura(texto: string, padding: string): string {
  return linha(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${COR.borda};padding-top:22px;${FONT}">
          <p style="margin:0 0 12px;font-size:16px;line-height:25px;color:${COR.texto2};">${texto}</p>
          ${logoAssinatura()}
        </td></tr></table>`, padding)
}

function corpoArrematou(d: Extract<DadosE14, { resultado: 'arrematou' }>, ctx: CtxRegua): string {
  const a = d.arremate
  const pagar = `${URL_CANONICA}/leiloes/${encodeURIComponent(d.lote.slug)}/pagar`
  const carta = esc(d.carta.nome)
  const linhaConta = (rotulo: string, extra: string, valor: string, ultima = false) => `
              <tr>
                <td style="padding:6px 0${ultima ? ' 12px' : ''};font-size:16px;line-height:22px;color:${COR.tinta};">${rotulo}${extra ? ` <span style="color:#616161;white-space:nowrap;">${extra}</span>` : ''}</td>
                <td align="right" style="padding:6px 0${ultima ? ' 12px' : ''};font-size:16px;line-height:22px;font-weight:700;color:${ultima ? '#616161' : COR.tinta};white-space:nowrap;">${valor}</td>
              </tr>`
  return `
    ${hero(d, ctx, utmRegua(pagar, ID, 'hero'), `O martelo acabou de bater e o ${carta} ganhou o carimbo ARREMATADO`)}
    ${d.imagemIlustrativa ? linha(`<p style="margin:0;font-size:14px;line-height:20px;color:${COR.texto2};">Imagem ilustrativa. O lote é em ${esc(d.carta.idioma.toLowerCase())}, ${esc(d.carta.condicao)}.</p>`, '8px 32px 0') : ''}
    ${linha(`
        <p style="margin:0 0 8px;font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${COR.ambar};">Lote ${esc(d.lote.numero)} &middot; Arrematado</p>
        <h1 class="h1" style="margin:0 0 10px;font-size:34px;line-height:40px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};">Martelo batido. É seu.</h1>
        <p style="margin:0;font-size:16px;line-height:25px;color:${COR.texto2};">Na rodada ao vivo da <span style="color:${COR.texto};font-weight:700;">${esc(d.loja)}</span>, seu lance de ${forte(rs(a.lance))} levou o ${carta}. Com a Proteção Bynx e o cartão, fica ${forte(rs(a.total))} + frete, a mesma conta da tela do lance.</p>`, '20px 32px 0')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" align="left" style="padding:24px 32px 0;">
        ${btnCompra(`Pagar o lote ${esc(d.lote.numero)}`, utmRegua(pagar, ID, 'cta'), { escurecer: true, fonte: 20, largura: 280 })}
        <p style="margin:10px 0 0;${FONT}font-size:14px;line-height:20px;color:${COR.texto2};">Pague até <b style="color:${COR.texto};font-weight:800;white-space:nowrap;">${esc(a.prazo)}</b> &middot; só cartão</p>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" style="padding:32px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td class="rec" bgcolor="${COR.texto}" style="background-color:${COR.texto};border-radius:16px 16px 0 0;padding:22px 24px 14px;${FONT}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td align="left" style="${FONT}font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${COR.tinta};">Recibo do arremate</td>
              <td align="right" style="${FONT}font-size:14px;line-height:20px;font-weight:700;color:#616161;white-space:nowrap;">Lote ${esc(d.lote.numero)}</td>
            </tr></table>
            <p style="margin:2px 0 0;font-size:14px;line-height:20px;color:#616161;">Bynx Leilões &middot; ${esc(d.loja)}<br/>Rodada ao vivo de ${esc(d.lote.rodadaDia)}, ${esc(d.lote.horaMartelo)}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-top:2px dashed #d0d0d0;border-bottom:2px dashed #d0d0d0;">
              <tr>
                <td width="68" valign="middle" style="padding:14px 0;">
                  <img src="${attr(d.carta.imagem)}" width="56" alt="${carta}${d.imagemIlustrativa ? ' (imagem ilustrativa)' : ''}" style="display:block;width:56px;height:auto;border:0;border-radius:4px;color:${COR.tinta};${FONT}font-size:14px;background-color:#d0d0d0;"/>
                </td>
                <td valign="middle" style="padding:14px 0 14px 4px;${FONT}">
                  <p class="h2" style="margin:0;font-size:20px;line-height:26px;font-weight:800;color:${COR.tinta};">${carta}</p>
                  <p style="margin:2px 0 0;font-size:14px;line-height:20px;color:#616161;">${esc(d.carta.set)} &middot; ${esc(d.carta.numero)}</p>
                  <p style="margin:2px 0 0;font-size:14px;line-height:20px;font-weight:700;color:${COR.tinta};">${esc(d.carta.condicao)} &middot; ${esc(d.carta.idioma)}</p>
                  ${d.imagemIlustrativa ? `<p style="margin:2px 0 0;font-size:14px;line-height:20px;color:#616161;">Imagem ilustrativa: vale a descrição do&nbsp;lote.</p>` : ''}
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;${FONT}">
              ${linhaConta('Lance final', '', rs(a.lance)).replace('font-weight:700;color:#0a0a0a', 'font-weight:800;color:#0a0a0a')}
              ${linhaConta('Taxa de proteção', `(${esc(a.protecaoPct)})`, rs(a.protecao))}
              ${linhaConta('Custo do cartão', `(${esc(a.cartaoPct)})`, rs(a.cartao))}
              ${linhaConta('Frete', '(pelo seu CEP)', 'a calcular', true)}
              <tr>
                <td valign="bottom" class="totlab" style="padding:12px 0 0;border-top:2px solid ${COR.tinta};font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${COR.tinta};">Total antes do frete</td>
                <td align="right" valign="bottom" class="total" style="padding:12px 0 0;border-top:2px solid ${COR.tinta};font-size:28px;line-height:32px;font-weight:800;letter-spacing:-0.02em;color:${COR.tinta};white-space:nowrap;">${rs(a.total)}</td>
              </tr>
            </table>
            <p style="margin:8px 0 0;font-size:14px;line-height:20px;color:#616161;">Uma carta viaja na menor faixa de peso dos Correios (até 250 g). O valor exato sai pelo seu CEP na tela de pagamento, antes de você confirmar.</p>
          </td></tr>
          <tr><td bgcolor="${COR.elevado}" style="background-color:${COR.elevado};line-height:0;font-size:0;">
            <img src="${urlArte(ID, 'serrilha.png')}" width="536" alt="" style="display:block;width:100%;max-width:536px;height:auto;border:0;"/>
          </td></tr>
        </table>
      </td></tr>
    </table>
    ${linha(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="${COR.surface2}" style="background-color:${COR.surface2};border:1px solid ${COR.borda};border-left:3px solid ${COR.rosa};border-radius:12px;padding:14px 16px;${FONT}">
            <p style="margin:0;font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${COR.rosa};">Proteção Bynx</p>
            <p style="margin:4px 0 0;font-size:16px;line-height:24px;color:${COR.texto};">Pagou aqui, está protegido: se a loja não enviar em até 3 dias úteis, você cancela e o valor volta.</p>
          </td>
        </tr></table>`, '26px 32px 0')}
    ${assinatura(`Parabéns pela carta, ${esc(d.nome)}. Agora ela vai para o fichário certo. Quando chegar, responda este <span style="white-space:nowrap;">e-mail</span> e conte para a gente se veio do jeito que você esperava: a gente lê cada resposta.`, '30px 32px 28px')}`
}

function corpoFaltou(d: Extract<DadosE14, { resultado: 'faltou' }>, ctx: CtxRegua): string {
  const f = d.faltou
  const carta = esc(d.carta.nome)
  const agenda = utmRegua(`${URL_CANONICA}/leiloes?aba=agenda`, ID, 'agenda')
  const anuncioUrl = f.anuncio ? `${URL_CANONICA}/anuncio/${encodeURIComponent(f.anuncio.slug)}` : null
  const heroHref = anuncioUrl ? utmRegua(anuncioUrl, ID, 'hero') : agenda
  const altHero = f.anuncio
    ? `Placar do lote ${esc(d.lote.numero)}: seu lance de ${rs(f.seuLance)} riscado, martelo em ${rs(f.martelo)}. Ao lado, o mesmo ${carta} à venda no Mercado por ${rs(f.anuncio.preco)}`
    : `Placar do lote ${esc(d.lote.numero)}: seu lance de ${rs(f.seuLance)} riscado, martelo em ${rs(f.martelo)}.`

  const anuncio = f.anuncio && anuncioUrl
    ? linha(`
        <a href="${attr(utmRegua(anuncioUrl, ID, 'carta'))}" target="_blank" style="text-decoration:none;display:block;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.surface2}" style="background-color:${COR.surface2};border:1px solid ${COR.borda};border-radius:16px;">
          <tr>
            <td width="100" valign="middle" style="padding:14px 0 14px 14px;">
              <img src="${attr(d.carta.imagem)}" width="86" alt="${carta}, ${esc(d.carta.set)} ${esc(d.carta.numero)}, ${rs(f.anuncio.preco)}${d.imagemIlustrativa ? ' (imagem ilustrativa)' : ''}" style="display:block;width:86px;height:auto;border:0;border-radius:6px;color:${COR.texto2};${FONT}font-size:14px;background-color:${COR.borda};"/>
            </td>
            <td valign="middle" style="padding:14px 14px 14px 12px;${FONT}">
              <p style="margin:0;font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${COR.ambar};">O mesmo, sem disputa</p>
              <p class="h2" style="margin:6px 0 0;font-size:20px;line-height:26px;font-weight:800;color:${COR.texto};">${carta}</p>
              <p style="margin:2px 0 0;font-size:14px;line-height:20px;color:${COR.texto2};">${esc(d.carta.set)} &middot; ${esc(d.carta.numero)}</p>
              <p style="margin:2px 0 0;font-size:14px;line-height:20px;font-weight:700;color:${COR.texto};">${esc(d.carta.condicao)} &middot; ${esc(d.carta.idioma)}</p>
              <p style="margin:8px 0 0;font-size:22px;line-height:26px;font-weight:800;color:${COR.verde};white-space:nowrap;">${rs(f.anuncio.preco)}</p>
              <p style="margin:2px 0 0;font-size:14px;line-height:20px;color:${COR.texto2};">${rs(Math.abs(f.anuncio.preco - f.martelo))} ${f.anuncio.preco >= f.martelo ? 'acima' : 'abaixo'} do martelo</p>
            </td>
          </tr>
        </table>
        </a>
        <p style="margin:8px 0 0;font-size:14px;line-height:20px;color:${COR.texto2};">${d.imagemIlustrativa ? 'Imagem ilustrativa. ' : ''}Preço do anúncio em ${esc(f.anuncio.dataPreco)}; ele pode sair a qualquer momento.</p>`, '22px 32px 0')
    : ''

  const cta = f.anuncio && anuncioUrl
    ? btnRegua(`Ver o ${esc(d.carta.apelido)} por ${esc(brlCurto(f.anuncio.preco)).replace(/\s/g, '&nbsp;')}`, utmRegua(anuncioUrl, ID, 'cta'))
    : btnRegua('Ver a agenda de leilões', utmRegua(`${URL_CANONICA}/leiloes?aba=agenda`, ID, 'cta'))

  return `
    ${hero(d, ctx, heroHref, altHero)}
    ${linha(`
        <p style="margin:0 0 8px;font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${COR.ambar};">Lote ${esc(d.lote.numero)} &middot; Faltou um lance</p>
        <h1 class="h1" style="margin:0 0 10px;font-size:34px;line-height:40px;font-weight:800;letter-spacing:-0.02em;color:${COR.texto};">Por um lance, ${esc(d.nome)}.</h1>
        <p style="margin:0;font-size:16px;line-height:25px;color:${COR.texto2};">Seu último lance foi ${forte(rs(f.seuLance))} e o martelo bateu em ${forte(rs(f.martelo))}.${f.anuncio ? ` Mas o mesmo ${carta} está à venda no Mercado da Bynx, sem disputa e sem cronômetro.` : ''}</p>`, '24px 32px 0')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" align="left" style="padding:24px 32px 0;">
        ${cta}
      </td></tr>
    </table>
    ${anuncio}
    ${linha(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${COR.borda};padding-top:22px;${FONT}">
          <p style="margin:0;font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${COR.ambar};">Próxima rodada</p>
          <p style="margin:4px 0 0;font-size:16px;line-height:25px;color:${COR.texto};">A ${esc(d.loja)} faz rodada ao vivo na Bynx Leilões. Quando a próxima entrar na agenda, o aviso chega no sino e aqui.</p>
          ${f.anuncio ? `<a href="${attr(agenda)}" target="_blank" style="display:inline-block;padding:12px 0;font-size:16px;line-height:20px;font-weight:800;color:${COR.ambar};text-decoration:underline;">Ver a agenda de leilões</a>` : ''}
        </td></tr></table>`, '28px 32px 0')}
    ${assinatura('Leilão tem disso: às vezes o martelo bate logo acima do seu lance. Na próxima, chegue antes. A gente guarda a cadeira para você.', '14px 32px 28px')}`
}

function montar(d: DadosE14, ctx: CtxRegua) {
  let assunto: string
  let preheader: string
  let conteudo: string
  let motivo: string
  let promocaoVariante: 'dupla' | 'destaque' = 'dupla'
  if (d.resultado === 'arrematou') {
    assunto = `Martelo batido. O ${d.carta.nome} é seu`
    preheader = `Pague até ${d.arremate.prazo.replace(', às ', ', ')}. Total ${brl(d.arremate.total)} + frete, já com a Proteção Bynx.`
    conteudo = corpoArrematou(d, ctx)
    motivo = `Você recebe este aviso porque arrematou o lote ${d.lote.numero} na Bynx Leilões. Sair das novidades não interrompe os avisos de pagamento e envio do pedido.`
  } else {
    assunto = `Faltou um lance para o ${d.carta.apelido} ser seu`
    preheader = d.faltou.anuncio
      ? `O lote ${d.lote.numero} fechou em ${brlCurto(d.faltou.martelo)}. O mesmo ${d.carta.apelido} está à venda no Mercado, sem disputa.`
      : `O lote ${d.lote.numero} fechou em ${brlCurto(d.faltou.martelo)}. A próxima rodada da ${d.loja} chega no sino.`
    conteudo = corpoFaltou(d, ctx)
    motivo = `Você recebe este aviso porque deu lance no lote ${d.lote.numero} na Bynx Leilões. É uma vez só, uma hora depois do martelo.`
    promocaoVariante = 'dupla'
  }
  const html = layoutRegua({
    conteudo,
    campanha: d.resultado === 'arrematou' ? 'e14a' : 'e14b',
    categoria: CATEGORIA,
    links: ctx.links,
    preheader,
    rotulo: 'Leilões',
    // A assinatura com o logo fica dentro do conteudo, depois do filete do mockup.
    assinatura: false,
    promocao: blocoPromocao(promocaoVariante, ctx.promocoes),
  })
  return { assunto, preheader, html: comCss(ajustarRodape(html, CATEGORIA, { motivo }), CSS) }
}

const LOTE_EXEMPLO = {
  nome: 'Lucas',
  carta: {
    nome: "Blaine's Charizard",
    apelido: 'Charizard',
    set: 'Gym Challenge',
    numero: '2/132',
    condicao: 'NM',
    idioma: 'Português',
    imagem: 'https://images.pokemontcg.io/gym2/2.png',
  },
  loja: 'Ponto Holo Cards',
  lote: { numero: '14', slug: 'blaines-charizard-l14', rodadaDia: '10/12', horaMartelo: '20h14' },
  imagemIlustrativa: true,
}

export const E14: TemplateRegua<DadosE14> = {
  id: 'E14',
  nome: 'Leilão: você arrematou (A) / faltou um lance (B)',
  trilha: 'Leilão (transacional)',
  categoria: CATEGORIA,
  // Persona de exemplo: Lucas, Ponto Holo Cards (ficticia), rodada qui 10/12/2026.
  // Conta da A com as constantes da feat/leilao: R$ 1.450,00 + 5% + 4,8% = R$ 1.592,10.
  exemplo: {
    ...LOTE_EXEMPLO,
    resultado: 'arrematou',
    arremate: { lance: 1450, protecao: 72.5, cartao: 69.6, total: 1592.1, protecaoPct: '5%', cartaoPct: '4,8%', prazo: 'sábado, 12/12, às 20h14' },
  },
  montar,
}

/** Variante B (faltou um lance), para a pre-visualizacao. Anuncio real de 18/09 (R$ 1.500,00). */
export const EXEMPLOS_EXTRAS: Record<string, DadosE14> = {
  b: {
    ...LOTE_EXEMPLO,
    resultado: 'faltou',
    faltou: { seuLance: 1200, martelo: 1350, anuncio: { preco: 1500, slug: 'blaines-charizard-gym-challenge-2', dataPreco: '07/10' } },
  },
}
