/**
 * E09 · Um Pokemon procurado que falta na sua colecao apareceu abaixo do
 * Mercado Brasileiro (Mercado). Mockup aprovado:
 * _Regua/mockups/E09-carta-do-seu-set/email.html.
 *
 * Gatilho: anuncio novo com compra no site que passa nas 4 travas do motor
 * (Pokemon elegivel, falta na colecao com carta do mesmo set, preco abaixo do
 * menor preco da MESMA carta no Mercado Brasileiro, frequencia).
 *
 * ARTE
 * - Hero = IMAGEM PESSOAL (rota de ImageResponse), tipo `e09-bolso`, 600x420
 *   (render 2x = 1200x840, JPG). Desenho de referencia:
 *   mockups/E09-carta-do-seu-set/assets/hero-bolso.html. A rota desenha:
 *   - a esquerda, a pagina 3x3 do set da pessoa ("Seu <set>" e "Voce tem:
 *     <carta>" com a miniatura da carta dela), bolsos numerados em ordem
 *     (012 a 020) com o bolso da carta anunciada vazio, tracejado em rosa;
 *   - a direita, a carta anunciada (imagem do catalogo, girada, brilho) ligada
 *     ao bolso por uma seta tracejada rosa; embaixo "R$ 99,90 a venda" e
 *     "Mercado Brasileiro: R$ 129,90".
 *   Tudo tambem em texto vivo (H1, paragrafo, legenda).
 */
import { blocoPromocao, layoutRegua } from '@/lib/email'
import { urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { FONT, btnCompra, esc, h1, hero, kicker, linha, link, p, plural, reais, reaisTxt } from './blocos-a'

const CAMPANHA = 'e09'

export type DadosE09 = {
  /** Pokemon que falta, ex.: "Charizard". */
  pokemon: string
  totalCartas: number
  /** Set do anuncio e a carta que a pessoa tem nele. */
  set: { nome: string; cartaQueTem: string }
  anuncio: {
    slug: string
    /** Nome completo da carta, ex.: "Radiant Charizard". */
    carta: string
    /** Nome curto para o pre-header, ex.: "Radiant". */
    curto: string
    idioma: string
    condicao: string
    preco: number
    /** Menor preco da MESMA carta no Mercado Brasileiro. */
    mercado: number
    /** Hora do anuncio, ex.: "14h". */
    hora: string
    /** Ex.: "uma loja de Curitiba, PR" */
    vendedor: string
    /** A imagem do hero e do catalogo em outro idioma (mostra a legenda). */
    imagemIlustrativa: { idiomaImagem: string } | null
  }
}

function montar(d: DadosE09, ctx: CtxRegua) {
  const a = d.anuncio
  const href = (c: string) => link(`/anuncio/${encodeURIComponent(a.slug)}`, CAMPANHA, c)
  const assunto = `Seu primeiro ${d.pokemon} pode custar ${reaisTxt(a.preco)}`
  const preheader = `${a.curto} do ${d.set.nome}, em ${a.idioma}, abaixo do menor preço do Mercado Brasileiro. Anunciado hoje às ${a.hora}.`

  const alt = `A página do seu ${d.set.nome}, com o bolso da carta vazio e destacado; deste set você tem o ${d.set.cartaQueTem}. Ao lado, o ${a.carta}` +
    (a.imagemIlustrativa ? ` (imagem ilustrativa, versão em ${a.imagemIlustrativa.idiomaImagem})` : '') +
    `, à venda por ${reaisTxt(a.preco)}; menor preço dele no Mercado Brasileiro, ${reaisTxt(a.mercado)}.`

  const conteudo = [
    hero({ src: urlImagemPessoal('e09-bolso', ctx.tokenImagem), alt, href: href('hero'), largura: 600, altura: 420 }),
    a.imagemIlustrativa
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="px" align="right" style="padding:10px 32px 0;${FONT}">
        <p style="margin:0;font-size:14px;line-height:20px;color:#a3a4a6;text-align:right;">Imagem ilustrativa, versão em ${esc(a.imagemIlustrativa.idiomaImagem)}. <span style="white-space:nowrap;color:#f0f0f0;font-weight:700;">A carta anunciada é em ${esc(a.idioma)}.</span></p>
      </td></tr></table>`
      : '',
    linha(`
        ${kicker(`Anunciado hoje às ${esc(a.hora)}`, '#f59e0b', '0 0 8px')}
        ${h1(`Nenhum ${esc(d.pokemon)} nas suas ${plural(d.totalCartas, 'carta', 'cartas').replace(' ', '&nbsp;')}. Este custa <span style="white-space:nowrap;">${reais(a.preco)}.</span>`)}
        ${p(`${esc(a.carta)} do ${esc(d.set.nome)}, <span style="white-space:nowrap;">em ${esc(a.idioma)}, estado ${esc(a.condicao)}.</span>`, 'margin:0;font-size:16px;line-height:25px;color:#a3a4a6;')}`, '18px 32px 0'),
    linha(`
        ${btnCompra(`Ver o ${d.pokemon} no Mercado`, href('cta'), { texto: '#ffffff', tamanho: 19, bloco: true })}
        <p style="margin:12px 0 0;font-size:14px;line-height:20px;color:#f0f0f0;text-align:center;font-weight:700;"><span style="white-space:nowrap;">Vendido por ${esc(a.vendedor)}</span></p>`, '20px 32px 0'),
    linha(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="#202227" style="height:1px;font-size:1px;line-height:1px;background-color:#202227;">&nbsp;</td></tr></table>
        ${p('Ficamos de olho nos bolsos vazios da sua coleção. Quando falta um Pokémon muito procurado e ele aparece abaixo do menor preço do Mercado Brasileiro, a Bynx avisa você.', 'margin:20px 0 0;font-size:16px;line-height:25px;color:#a3a4a6;')}`, '28px 32px 0'),
  ].join('\n')

  const html = layoutRegua({
    conteudo,
    campanha: CAMPANHA,
    categoria: 'mercado',
    links: ctx.links,
    preheader,
    rotulo: `Mercado · ${d.pokemon}`,
    assinatura: true,
    promocao: blocoPromocao('destaque', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E09: TemplateRegua<DadosE09> = {
  id: 'E09',
  nome: 'Pokémon que falta apareceu abaixo do Mercado Brasileiro',
  trilha: 'Mercado',
  categoria: 'mercado',
  // PERSONA DE EXEMPLO (direcao/PERSONAS.md): Marina, 11 cartas, Pikachu do Crown Zenith.
  // Anuncio real de dados.json: Radiant Charizard 020, NM, PT, R$ 99,90.
  exemplo: {
    pokemon: 'Charizard',
    totalCartas: 11,
    set: { nome: 'Crown Zenith', cartaQueTem: 'Pikachu' },
    anuncio: {
      slug: 'exemplo-radiant-charizard',
      carta: 'Radiant Charizard',
      curto: 'Radiant',
      idioma: 'português',
      condicao: 'NM',
      preco: 99.9,
      mercado: 129.9,
      hora: '14h',
      vendedor: 'uma loja de Curitiba, PR',
      imagemIlustrativa: { idiomaImagem: 'inglês' },
    },
  },
  montar,
}
