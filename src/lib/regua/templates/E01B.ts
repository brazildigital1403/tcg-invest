/**
 * E01B · Tudo que mudou desde que voce entrou, para quem tem 0 cartas
 * (Novidades). Mockup aprovado: _Regua/mockups/E01B-tudo-que-mudou-zero-cartas/
 * email.html (r3, "o fichario das novidades").
 *
 * Gatilho: o mesmo disparo editorial do E01 (calendario, 3 ondas por ultimo
 * acesso, cadastro ate 31/08), so para quem tem 0 cartas. Dedup com E01 e E11
 * em 365 dias: cada pessoa recebe o E01 OU o E01B.
 *
 * Primeira dobra sem hero: o preco de hoje de tres cartas da colecao de 1999
 * (texto vivo, menor preco do dia) e o botao para /set/base1, que abre sem
 * login. As novidades vem depois do botao, so as que chegaram DEPOIS do mes de
 * cadastro da pessoa.
 *
 * ARTE (FIXA, igual para todos)
 * - `e01b/fichario-novidades.jpg` (534x321 a 2x): a pagina de fichario com as
 *   novidades (SET/JUL/AGO). Miniaturas das 3 cartas: images.pokemontcg.io.
 */
import { btnRegua, blocoPromocao, layoutRegua } from '@/lib/email'
import { urlArte, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { FONT, attr, caminhoCarta, esc, imagemCarta, linha, link, reais, reaisTxt } from './blocos-a'

const CAMPANHA = 'e01b'

export type CartaE01B = { nome: string; slug: string; imagem: string; preco: number }

export type DadosE01B = {
  nome: string
  /** Pikachu, Blastoise e Charizard da colecao de 1999, do mais barato ao mais caro (o ultimo e o gancho). */
  cartas: CartaE01B[]
  /** Mes de cadastro "YYYY-MM": so entram as novidades de depois dele. */
  entrouEm: string
}

/**
 * Novidades citadas no texto (dados.json -> timeline_produto). `zero` serve a
 * quem nao tem carta e vai primeiro; `colecao` e "para quando a colecao crescer".
 * A Pokedex completa e gratis (09/2026) abre o bloco para todo o publico do E01.
 */
const NOVIDADES: { mes: string; txt: string; grupo: 'zero' | 'colecao' }[] = [
  { mes: '2026-09', txt: 'as Metas de coleção', grupo: 'zero' },
  { mes: '2026-07', txt: 'o idioma de cada carta', grupo: 'zero' },
  { mes: '2026-08', txt: 'o aviso quando uma carta que você acompanha é anunciada', grupo: 'zero' },
  { mes: '2026-08', txt: 'as Páginas Lendárias', grupo: 'zero' },
  { mes: '2026-07', txt: 'comprar com rastreio no Mercado', grupo: 'colecao' },
  { mes: '2026-09', txt: 'vender sem precisar de loja', grupo: 'colecao' },
  { mes: '2026-10', txt: 'restaurar&nbsp;carta', grupo: 'colecao' },
]

function juntar(l: string[]): string {
  return l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`
}

function montar(d: DadosE01B, ctx: CtxRegua) {
  const [barata, media, gancho] = d.cartas
  const voc = d.nome ? `${d.nome}, o` : 'O'
  const assunto = `${voc} ${gancho.nome} de 1999 vale ${reaisTxt(gancho.preco)} hoje`
  const preheader = `O ${barata.nome} da mesma coleção sai por ${reaisTxt(barata.preco)}. Veja o preço de hoje de cada carta de 1999 no Mercado Brasileiro.`

  const faixa = d.cartas.map((c, i) => {
    const ultimo = i === d.cartas.length - 1
    const cel = `<td width="32%" class="e01b-cel" align="center" valign="top" bgcolor="#191b20" style="width:32%;background-color:#191b20;border:1px solid ${ultimo ? '#f59e0b' : '#202227'};border-radius:12px;padding:12px 6px 12px;${FONT}">
            <a href="${attr(link(caminhoCarta(c.slug), CAMPANHA, 'faixa'))}" target="_blank" style="text-decoration:none;display:block;"><img src="${attr(imagemCarta(c.imagem))}" class="e01b-img" width="80" height="112" alt="${attr(`${c.nome}, coleção de 1999`)}" style="display:block;margin:0 auto;width:80px;height:112px;border:0;border-radius:5px;background-color:#0d0f14;color:#a3a4a6;${FONT}font-size:14px;line-height:18px;"/><span class="e01b-nome" style="display:block;margin-top:10px;font-size:14px;line-height:20px;font-weight:700;color:#a3a4a6;">${esc(c.nome)}</span><span class="e01b-preco" style="display:block;font-size:18px;line-height:24px;font-weight:800;color:#f0f0f0;white-space:nowrap;">${reais(c.preco)}</span></a>
          </td>`
    return ultimo ? cel : `${cel}\n          <td width="2%" class="e01b-gap" style="width:8px;font-size:1px;line-height:1px;">&nbsp;</td>`
  }).join('\n')

  const depois = NOVIDADES.filter((n) => n.mes > d.entrouEm)
  const zero = depois.filter((n) => n.grupo === 'zero').map((n) => n.txt)
  const colecao = depois.filter((n) => n.grupo === 'colecao').map((n) => n.txt)
  const resto = [
    zero.length ? `Chegaram também ${juntar(zero)}.` : '',
    colecao.length ? `E, para quando a coleção crescer: ${juntar(colecao)}.` : '',
  ].filter(Boolean).join(' ')

  const conteudo = [
    linha(`
        <p style="margin:0 0 8px;font-size:14px;line-height:20px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#f59e0b;">Coleção de 1999 · preço de hoje</p>
        <h1 class="h1" style="margin:0 0 8px;font-size:32px;line-height:38px;font-weight:800;letter-spacing:-0.02em;color:#f0f0f0;">${esc(voc)} ${esc(gancho.nome)} de 1999 vale <span style="white-space:nowrap;">${reais(gancho.preco)}</span>&nbsp;hoje</h1>
        <p style="margin:0;font-size:15px;line-height:22px;color:#a3a4a6;">O ${esc(media.nome)} da mesma coleção sai por <strong style="color:#f0f0f0;white-space:nowrap;">${reais(media.preco)}</strong>. O ${esc(barata.nome)}, por <strong style="color:#f0f0f0;white-space:nowrap;">${reais(barata.preco)}</strong>. Menor preço no Mercado Brasileiro.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;"><tr>
          ${faixa}
        </tr></table>`, '26px 32px 0', 'e01b-pth'),
    linha(`
        ${btnRegua('Ver o preço de cada carta de 1999', link('/set/base1', CAMPANHA, 'cta'))}
        <p style="margin:10px 0 0;${FONT}font-size:14px;line-height:21px;color:#a3a4a6;">A coleção inteira, carta por carta, com o menor preço de hoje. Abre direto, grátis.</p>`, '18px 32px 0', 'e01b-ptc'),
    linha(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-top:1px solid #202227;padding-top:24px;${FONT}">
            <p class="h2" style="margin:0 0 6px;font-size:21px;line-height:27px;font-weight:800;color:#f0f0f0;">O que chegou desde que você entrou</p>
            <p style="margin:0;font-size:15px;line-height:23px;color:#a3a4a6;">A Pokédex ficou completa e grátis: achou uma carta que você tem ou quer, um toque em <a href="${attr(link('/pokedex', CAMPANHA, 'apoio'))}" target="_blank" style="color:#f0f0f0;font-weight:700;text-decoration:underline;">Já&nbsp;tenho</a> e ela entra na coleção com&nbsp;preço.</p>
          </td>
        </tr></table>`, '32px 32px 0'),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="e01b-fich" style="padding:16px 32px 0;font-size:0;line-height:0;">
        <a href="${attr(link('/pokedex', CAMPANHA, 'fichario'))}" target="_blank" style="text-decoration:none;"><img src="${attr(urlArte('e01b', 'fichario-novidades.jpg'))}" class="e01b-fich-img" width="534" height="321" alt="Uma página de fichário com as novidades da Bynx: Pokédex grátis, Metas de coleção, idioma da carta, aviso de anúncio e Páginas Lendárias. Um bolso tracejado tem o botão Já tenho: um toque e a carta entra na coleção com preço." style="display:block;width:100%;max-width:534px;height:auto;border:0;border-radius:12px;color:#f0f0f0;${FONT}font-size:15px;font-weight:700;line-height:22px;background-color:#0d0f14;"/></a>
      </td></tr></table>`,
    resto ? linha(`<p style="margin:0;font-size:15px;line-height:23px;color:#a3a4a6;">${resto}</p>`, '14px 32px 0') : '',
    linha(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-top:1px solid #202227;padding-top:16px;${FONT}font-size:16px;line-height:25px;color:#a3a4a6;">Cada carta que entrar na sua coleção ganha o preço do dia, e nós avisamos quando ele mexer.</td>
        </tr></table>`, '24px 32px 0'),
  ].join('\n')

  const css = `@media only screen and (max-width:480px){
  .e01b-gap{width:6px!important}
  .e01b-cel{padding:8px 4px 10px!important}
  .e01b-preco{font-size:16px!important;line-height:21px!important}
  .e01b-img{width:64px!important;height:89px!important}
  .e01b-nome{margin-top:6px!important}
  .e01b-pth{padding-top:20px!important}
  .e01b-ptc{padding-top:14px!important}
  .e01b-fich{padding:16px 0 0!important}
  .e01b-fich-img{border-radius:0!important;max-width:100%!important}
}`

  const html = layoutRegua({
    conteudo,
    campanha: CAMPANHA,
    categoria: 'novidades',
    links: ctx.links,
    preheader,
    assinatura: true,
    respiroAssinatura: 12,
    css,
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

/** As tres cartas da faixa (colecao de 1999): o motor troca o preco pelo menor do dia. */
export const CARTAS_E01B: CartaE01B[] = [
  { nome: 'Pikachu', slug: 'base1-58', imagem: 'https://images.pokemontcg.io/base1/58.png', preco: 26.9 },
  { nome: 'Blastoise', slug: 'base1-2', imagem: 'https://images.pokemontcg.io/base1/2.png', preco: 289.9 },
  { nome: 'Charizard', slug: 'base1-4', imagem: 'https://images.pokemontcg.io/base1/4.png', preco: 1249 },
]

export const E01B: TemplateRegua<DadosE01B> = {
  id: 'E01B',
  nome: 'O preço de hoje da coleção de 1999 (0 cartas)',
  trilha: 'Novidades',
  categoria: 'novidades',
  // PERSONA DE EXEMPLO (direcao/PERSONAS.md secao 6): Camila, 0 cartas, entrou em 06/2026. Precos de 07/10.
  exemplo: {
    nome: 'Camila',
    cartas: CARTAS_E01B,
    entrouEm: '2026-06',
  },
  montar,
}
