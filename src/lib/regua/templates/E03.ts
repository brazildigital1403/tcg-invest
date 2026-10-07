/**
 * E03 · D1: uma de cada epoca, a gaveta da infancia (Ativacao). Mockup
 * aprovado: _Regua/mockups/E03-sua-colecao-vale/email.html (variante A, 0 a 4
 * cartas). A variante B (5 a 9 cartas, email-b.html) NAO esta aqui.
 *
 * Gatilho: 24h apos o cadastro; sai do fluxo quem ja tem 10+ cartas.
 *
 * ARTE (toda FIXA, igual para todos; nenhum dado pessoal)
 * - Hero `e03/hero-gaveta.jpg` (600x270): gaveta "Nao mexer" com Charizard e
 *   Pikachu (1999) e Lugia-GX (2018). Sem preco na arte.
 * - Miniaturas `e03/thumb-charizard.jpg`, `thumb-pikachu.jpg`, `thumb-lugia.jpg`
 *   (72x72, recorte quadrado da arte de images.pokemontcg.io).
 * Os precos da lista sao texto vivo: o motor passa o menor preco do dia.
 *
 * PENDENTE ANTES DO ENVIO: /pokedex ainda nao le ?p= (o CTA abre a Pokedex sem
 * o filtro).
 */
import { btnRegua, blocoPromocao, layoutRegua } from '@/lib/email'
import { urlArte, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import {
  FONT, attr, caminhoCarta, esc, estiloCelular, hero, h1, imagemCarta, linha, link, reais, reaisTxt,
} from './blocos-a'

const CAMPANHA = 'e03'

export type CartaGavetaE03 = {
  nome: string
  set: string
  ano: number
  slug: string
  /** Miniatura quadrada 72x72 (urlArte ou imagem de carta permitida). */
  miniatura: string
  preco: number
  /** Raridade comum: vira a "saida" para quem nao tem as caras. */
  comum?: boolean
  /** Variacao em 30 dias, em %, quando relevante (ex.: 74.9). */
  alta30d?: number
}

export type DadosE03 = {
  /** A primeira carta e a ancora do assunto e do hero. */
  cartas: CartaGavetaE03[]
  /** Data do menor preco usado, "dd/mm". */
  dataPreco: string
  /** Fim do teste do Pro, ja por extenso ("quarta, 14/10, às 14h"); null = sem P.S. */
  fimTeste: string | null
}

function montar(d: DadosE03, ctx: CtxRegua) {
  const ancora = d.cartas[0]
  const comum = d.cartas.find((c) => c.comum)
  const assunto = `Seu ${ancora.nome} de ${ancora.ano} ainda está na gaveta?`
  const preheader = `Hoje ele vale ${reaisTxt(ancora.preco)}.` +
    (comum ? ` Até o ${comum.nome} comum de ${comum.ano} vale ${reaisTxt(comum.preco)}.` : '')
  const slugTxt = (c: CartaGavetaE03) => `${c.nome}-${c.ano}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const linhas = d.cartas.map((c, i) => {
    const borda = i < d.cartas.length - 1 ? 'border-bottom:1px solid #202227;' : ''
    const href = attr(link(caminhoCarta(c.slug), CAMPANHA, `linha-${slugTxt(c)}`))
    const corPreco = i === 0 ? '#f59e0b' : '#f0f0f0'
    const alta = c.alta30d && c.alta30d > 0
      ? `<span style="display:inline-block;font-size:14px;line-height:19px;font-weight:700;color:#22c55e;white-space:nowrap;">&nbsp;&nbsp;+${Math.round(c.alta30d)}% em 30 dias</span>`
      : ''
    const meta = `${esc(c.set)} &middot; ${c.ano}${c.comum ? ' &middot; <strong style="color:#f0f0f0;font-weight:800;">comum</strong>' : ''}`
    return `<tr><td style="${borda}">
            <a href="${href}" target="_blank" title="${attr(`${c.nome}, ${c.set} ${c.ano}: ver a carta e o preço na Bynx`)}" style="display:block;text-decoration:none;color:#f0f0f0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="72" valign="middle" style="width:72px;padding:10px 0 10px 10px;">
                <img src="${attr(imagemCarta(c.miniatura))}" width="72" height="72" alt="${attr(`${c.nome}, ${c.set} ${c.ano}`)}" style="display:block;width:72px;height:72px;border:0;border-radius:10px;color:#a3a4a6;${FONT}font-size:14px;line-height:19px;background-color:#191b20;"/>
              </td>
              <td class="e03-txt" valign="middle" style="padding:10px 6px 10px 14px;${FONT}">
                <p style="margin:0;font-size:17px;line-height:22px;font-weight:800;color:#f0f0f0;">${esc(c.nome)}</p>
                <p style="margin:1px 0 3px;font-size:14px;line-height:19px;color:#a3a4a6;">${meta}</p>
                <p style="margin:0;${FONT}"><span class="e03-preco" style="font-size:19px;line-height:24px;font-weight:800;letter-spacing:-0.02em;color:${corPreco};white-space:nowrap;">${reais(c.preco)}</span>${alta}</p>
              </td>
              <td class="e03-seta" width="92" align="right" valign="middle" style="width:92px;padding:10px 14px 10px 0;${FONT}">
                <p style="margin:0;font-size:14px;line-height:20px;font-weight:800;color:#f59e0b;white-space:nowrap;"><span class="e03-seta-txt">Ver carta&nbsp;</span><span style="font-size:20px;line-height:20px;">&rarr;</span></p>
              </td>
            </tr></table>
            </a>
          </td></tr>`
  }).join('')

  const conteudo = [
    estiloCelular('.e03-pt{padding-top:16px!important}.e03-txt{padding:10px 4px 10px 12px!important}.e03-seta{width:30px!important;padding:10px 12px 10px 0!important}.e03-seta-txt{display:none!important}.e03-preco{font-size:18px!important;line-height:23px!important}'),
    hero({
      src: urlArte('e03', 'hero-gaveta.jpg'),
      alt: 'Uma gaveta aberta escrita Não mexer. Na divisória de 1999, o Charizard e o Pikachu; na de 2018, o Lugia-GX.',
      href: link(caminhoCarta(ancora.slug), CAMPANHA, 'hero'),
      largura: 600,
      altura: 270,
    }),
    linha(h1('Qual destas ainda está na sua&nbsp;gaveta?', '0'), '24px 32px 0', 'e03-pt'),
    linha(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#191b20" style="background-color:#191b20;border:1px solid #202227;border-radius:16px;">${linhas}</table>`, '20px 32px 0'),
    linha(`
        ${btnRegua('Achar a minha na Pokédex', link(`/pokedex?p=${encodeURIComponent(ancora.nome.toLowerCase())}`, CAMPANHA, 'cta'))}
        <p style="margin:12px 0 0;font-size:14px;line-height:20px;color:#6b6c6f;">Menor preço no Mercado Brasileiro em&nbsp;${esc(d.dataPreco)}.</p>`, '20px 32px 0'),
    d.fimTeste
      ? linha(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-top:1px solid #202227;padding-top:16px;${FONT}">
            <p style="margin:0;font-size:16px;line-height:25px;color:#a3a4a6;"><span style="font-weight:800;color:#f59e0b;">P.S.</span> Seu teste do Pro na Bynx vai até <strong style="color:#f0f0f0;font-weight:800;">${esc(d.fimTeste).replace(/ (\S+)$/, '&nbsp;$1')}</strong>.</p>
          </td>
        </tr></table>`, '28px 32px 0')
      : '',
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

export const E03: TemplateRegua<DadosE03> = {
  id: 'E03',
  nome: 'D1: a gaveta da infância',
  trilha: 'Ativação',
  categoria: 'novidades',
  // Variante A, sem persona. Cartas e menor preco reais de 07/10 (dados.json).
  exemplo: {
    cartas: [
      { nome: 'Charizard', set: 'Base', ano: 1999, slug: 'base1-4', miniatura: urlArte('e03', 'thumb-charizard.jpg'), preco: 1249 },
      { nome: 'Pikachu', set: 'Base', ano: 1999, slug: 'base1-58', miniatura: urlArte('e03', 'thumb-pikachu.jpg'), preco: 26.9, comum: true },
      { nome: 'Lugia-GX', set: 'Lost Thunder', ano: 2018, slug: 'sm8-207', miniatura: urlArte('e03', 'thumb-lugia.jpg'), preco: 699.5, alta30d: 74.9 },
    ],
    dataPreco: '07/10',
    fimTeste: 'quarta, 14/10, às 14h',
  },
  montar,
}

