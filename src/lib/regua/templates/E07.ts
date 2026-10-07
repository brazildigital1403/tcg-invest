/**
 * E07 · Faltam 3 cartas para fechar a meta (Minha colecao). Mockup aprovado:
 * _Regua/mockups/E07-meta-quase-completa/email.html.
 *
 * Gatilho: meta atinge 90% ou faltam 3 cartas ou menos. Uma vez por meta. So
 * envia com pelo menos 1 carta que falta a venda (o botao promete isso).
 *
 * ARTE
 * - Hero = IMAGEM PESSOAL (rota de ImageResponse), tipo `e07-fichario`, 598x439
 *   (render 2x = 1196x878, JPG). Desenho de referencia:
 *   mockups/E07-meta-quase-completa/assets/hero-fichario.html. A rota desenha:
 *   - fichario aberto com a pagina 3x3 que contem as cartas que faltam
 *     (bolsos na ordem do set; cartas que a pessoa tem com a imagem da carta);
 *   - cada bolso vazio com etiqueta: nome, "#numero" grande e, embaixo, a
 *     pilula verde com o preco do anuncio ("R$ 225,00") ou, sem anuncio, o sino
 *     ambar com "AVISAMOS" e o bolso tracejado;
 *   - a direita, o anel de progresso com o percentual ("99%").
 *   Tudo isso tambem esta na lista "Onde achar cada uma" em texto vivo.
 * - Sino do bolso sem anuncio `e07/sino.png` (20x20 exibido) = FIXO.
 * - Miniatura do anuncio: imagem da carta por URL (dado; foto do anuncio no
 *   storage da Bynx ou imagem do catalogo).
 *
 * PENDENTE ANTES DO ENVIO: /metas/[id] ainda nao abre a aba "A venda" com
 * ?ver=a-venda; a linha "Menor preco no Mercado Brasileiro" das cartas a venda
 * so entra quando o envio tiver esse valor (campo `mercado`).
 */
import { blocoPromocao, layoutRegua } from '@/lib/email'
import { urlArte, urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import {
  FONT, attr, btnCompra, esc, estiloCelular, h1, hero, imagemCarta, kicker, linha, link, num, reais,
} from './blocos-a'

const CAMPANHA = 'e07'

export type CartaFaltaE07 = {
  nome: string
  /** "209/193" */
  numero: string
  /** Anuncio ativo na Bynx; null = ninguem anunciou. */
  anuncio: {
    slug: string
    preco: number
    condicao: string
    idioma: string
    /** "anúncio de loja" ou "anúncio de colecionador" */
    origem: string
    imagem: string
  } | null
  /** Menor preco no Mercado Brasileiro e variacao em 7 dias, quando houver. */
  mercado: { preco: number; pct7d: number | null } | null
}

export type DadosE07 = {
  meta: {
    id: string
    /** Nome do set da meta, ex.: "Evoluções em Paldea" */
    setNome: string
    tem: number
    total: number
  }
  /** Cartas que faltam, na ordem do set. */
  faltam: CartaFaltaE07[]
}

const EXTENSO = ['Nenhum', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove', 'Dez']

function juntar(l: string[]): string {
  return l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`
}

function montar(d: DadosE07, ctx: CtxRegua) {
  const m = d.meta
  const n = d.faltam.length
  const aVenda = d.faltam.filter((c) => c.anuncio)
  const semAnuncio = d.faltam.filter((c) => !c.anuncio)
  const k = aVenda.length
  const hrefMeta = (c: string, q = '') => link(`/metas/${encodeURIComponent(m.id)}${q}`, CAMPANHA, c)

  const assunto = `Faltam ${n} para fechar ${m.setNome}`
  const artigo = (nome: string) => `o ${nome}`
  const preheader = [
    k ? `${juntar(aVenda.map((c) => artigo(c.nome))).replace(/^o/, 'O')} ${k === 1 ? 'está' : 'estão'} à venda agora na Bynx.` : '',
    semAnuncio.length ? `Do ${juntar(semAnuncio.map((c) => c.nome))}, avisamos quando aparecer.` : '',
  ].filter(Boolean).join(' ')

  const bolsos = n === 1 ? 'Um bolso vazio.' : `${n <= 10 ? EXTENSO[n] : n} bolsos vazios.`
  const ext = (x: number) => (x <= 10 ? EXTENSO[x] : String(x))
  const preenche = k === n
    ? (n === 1 ? 'Você preenche hoje.' : `Os ${ext(n).toLowerCase()} você preenche hoje.`)
    : `${ext(k)} você preenche hoje.`
  const restam = m.total - m.tem - k
  const apoio = restam <= 0
    ? `Com ${juntar(aVenda.map((c) => artigo(c.nome)))}, você fecha a meta.`
    : `Com ${juntar(aVenda.map((c) => artigo(c.nome)))}, você fica <span style="white-space:nowrap;">a <span style="font-weight:800;color:#f59e0b;">${restam === 1 ? '1 carta' : `${restam} cartas`}</span></span> de fechar a meta.`
  const pctMeta = Math.floor((m.tem / m.total) * 100)

  const linhas = d.faltam.map((c, i) => {
    const ultima = i === n - 1
    const [nr] = c.numero.split('/')
    const conteudoTag = `onde-achar-${c.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
    const sep = ultima ? '' : `<tr><td style="padding:16px 16px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="#202227" style="height:1px;font-size:1px;line-height:1px;background-color:#202227;">&nbsp;</td></tr></table></td></tr>`
    const titulo = `<span style="display:block;font-size:18px;line-height:24px;font-weight:800;color:#f0f0f0;">${esc(c.nome)} <span style="font-size:14px;font-weight:700;color:#a3a4a6;">${esc(c.numero)}</span></span>`
    const merc = c.mercado
      ? `<span style="display:block;margin:4px 0 0;font-size:14px;line-height:20px;color:#a3a4a6;">Mercado Brasileiro: <span style="white-space:nowrap;">${reais(c.mercado.preco)}</span>${c.mercado.pct7d != null ? ` &middot; <span style="white-space:nowrap;">${c.mercado.pct7d >= 0 ? '+' : '&minus;'}${Math.round(Math.abs(c.mercado.pct7d))}% em 7 dias</span>` : ''}</span>`
      : ''
    let miolo: string
    if (c.anuncio) {
      const a = c.anuncio
      const href = attr(link(`/anuncio/${encodeURIComponent(a.slug)}`, CAMPANHA, conteudoTag))
      miolo = `<td class="e07-td" width="88" valign="top" style="width:88px;">
                <a href="${href}" target="_blank"><img class="e07-img" src="${attr(imagemCarta(a.imagem))}" width="76" height="106" alt="${attr(`${c.nome} ${c.numero}, foto do anúncio`)}" style="display:block;width:76px;height:auto;border:0;border-radius:6px;color:#a3a4a6;${FONT}font-size:14px;background-color:#202227;"/></a>
              </td>
              <td valign="top" style="${FONT}">
                <a href="${href}" target="_blank" style="text-decoration:none;color:#f0f0f0;display:block;">
                  ${titulo}
                  <span style="display:block;margin:2px 0 8px;font-size:14px;line-height:20px;color:#a3a4a6;">${esc(a.condicao)} &middot; ${esc(a.idioma)} &middot; ${esc(a.origem)}</span>
                </a>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td class="e07-pilula" bgcolor="#123221" style="background-color:#123221;border-radius:999px;font-size:14px;line-height:20px;font-weight:800;white-space:nowrap;"><a href="${href}" target="_blank" style="display:inline-block;padding:12px 14px;color:#22c55e;text-decoration:none;${FONT}">À venda na Bynx &rsaquo;</a></td>
                  <td class="e07-preco" style="padding-left:12px;white-space:nowrap;${FONT}"><a href="${href}" target="_blank" style="color:#f0f0f0;text-decoration:none;"><span style="font-size:20px;line-height:24px;font-weight:800;color:#f0f0f0;">${reais(a.preco)}</span> <span style="font-size:14px;line-height:20px;color:#a3a4a6;">no anúncio</span></a></td>
                </tr></table>
                ${merc ? `<a href="${href}" target="_blank" style="text-decoration:none;display:block;">${merc}</a>` : ''}
              </td>`
    } else {
      const href = attr(hrefMeta(conteudoTag))
      miolo = `<td class="e07-td" width="88" valign="top" style="width:88px;">
                <a href="${href}" target="_blank" style="text-decoration:none;display:block;width:76px;">
                  <table class="e07-img" role="presentation" width="76" cellpadding="0" cellspacing="0" border="0" style="width:76px;"><tr>
                    <td align="center" valign="middle" height="102" bgcolor="#24221f" style="height:102px;background-color:#24221f;border:2px dashed #f59e0b;border-radius:6px;${FONT}">
                      <img src="${attr(urlArte('e07', 'sino.png'))}" width="20" height="20" alt="" style="display:block;margin:0 auto 6px;width:20px;height:20px;border:0;"/>
                      <span style="display:block;font-size:18px;line-height:22px;font-weight:800;color:#f59e0b;">#${esc(nr)}</span>
                    </td>
                  </tr></table>
                </a>
              </td>
              <td valign="top" style="${FONT}">
                <a href="${href}" target="_blank" style="text-decoration:none;color:#f0f0f0;display:block;">
                  ${titulo}
                  <span style="display:block;margin:2px 0 0;font-size:16px;line-height:24px;color:#f0f0f0;">Sem anúncio agora. Defina um teto e avisamos quando aparecer.</span>
                  ${merc}
                </a>
                <a href="${href}" target="_blank" style="display:inline-block;padding:12px 0;font-size:14px;line-height:20px;font-weight:800;color:#f59e0b;text-decoration:underline;">Definir meu teto &rsaquo;</a>
              </td>`
    }
    return `<tr><td style="padding:16px 16px ${ultima ? '16px' : '0'};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;"><tr>
              ${miolo}
            </tr></table>
          </td></tr>${sep}`
  }).join('')

  const alt = `Página do fichário da Coleção ${m.setNome}, ${pctMeta}% completa. ${bolsos} ` +
    d.faltam.map((c) => `${c.nome} ${c.numero.split('/')[0]}, ${c.anuncio ? `à venda por R$ ${num(c.anuncio.preco, 2)}` : 'ainda sem anúncio, com aviso ligado'}`).join('; ') + '.'

  const conteudo = [
    estiloCelular('.e07-ph{padding-top:20px!important}.e07-pb{padding-top:16px!important}.e07-img{width:64px!important}.e07-td{width:76px!important}.e07-pilula{display:inline-block!important}.e07-preco{display:block!important;padding:8px 0 0!important}'),
    hero({ src: urlImagemPessoal('e07-fichario', ctx.tokenImagem), alt, href: hrefMeta('hero', '?ver=a-venda'), largura: 598, altura: 439 }),
    linha(`
        ${kicker(`Coleção ${esc(m.setNome)} &middot; <span style="white-space:nowrap;color:#f0f0f0;">${m.tem} de ${m.total}</span>`, '#f59e0b', '0 0 8px', '0.06em')}
        ${h1(`${bolsos} ${preenche}`, '0')}`, '24px 32px 0', 'e07-ph'),
    linha(btnCompra(n === 1 || k === 1 ? 'Ver a carta à venda agora' : `Ver as ${k} à venda agora`, hrefMeta('cta', '?ver=a-venda')), '20px 32px 0', 'e07-pb'),
    linha(`<p style="margin:0;font-size:16px;line-height:25px;color:#a3a4a6;">${apoio}</p>`, '14px 32px 0'),
    linha(`
        <p style="margin:0;font-size:18px;line-height:24px;font-weight:800;color:#f0f0f0;">${n === 1 ? 'Onde achar' : 'Onde achar cada uma'}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#191b20" style="background-color:#191b20;border:1px solid #202227;border-radius:16px;margin-top:12px;">${linhas}</table>`, '32px 32px 0'),
    linha(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="#191b20" style="background-color:#191b20;border-left:3px solid #f59e0b;border-radius:0 12px 12px 0;padding:14px 16px;${FONT}font-size:16px;line-height:24px;color:#f0f0f0;">
            <span style="font-weight:800;color:#f59e0b;">P.S.</span> Quando a última entrar, tira uma foto da página fechada e marca a Bynx no Instagram. Queremos ver.
          </td>
        </tr></table>
        <p style="margin:16px 0 0;font-size:14px;line-height:20px;color:#a3a4a6;">De olho nas cartas que faltam na sua meta.</p>`, '28px 32px 0'),
  ].join('\n')

  const html = layoutRegua({
    conteudo,
    campanha: CAMPANHA,
    categoria: 'colecao',
    links: ctx.links,
    preheader,
    rotulo: 'Suas metas',
    assinatura: true,
    promocao: blocoPromocao('destaque', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E07: TemplateRegua<DadosE07> = {
  id: 'E07',
  nome: 'Faltam 3 cartas para fechar a meta',
  trilha: 'Minha coleção',
  categoria: 'colecao',
  // TELA DE EXEMPLO (contagem ilustrativa 276 de 279; nenhuma persona tem colecao
  // para isso). Anuncios reais de 12/09 (dados.json); imagem do catalogo (EN) no
  // lugar da foto do anuncio.
  exemplo: {
    meta: { id: 'exemplo', setNome: 'Evoluções em Paldea', tem: 276, total: 279 },
    faltam: [
      {
        nome: 'Arctibax', numero: '209/193',
        anuncio: { slug: 'exemplo-arctibax', preco: 225, condicao: 'NM', idioma: 'Português', origem: 'anúncio de loja', imagem: 'https://images.pokemontcg.io/sv2/209.png' },
        mercado: null,
      },
      { nome: 'Tinkatink', numero: '216/193', anuncio: null, mercado: { preco: 139.99, pct7d: 55.7 } },
      {
        nome: 'Tinkatuff', numero: '217/193',
        anuncio: { slug: 'exemplo-tinkatuff', preco: 125, condicao: 'NM', idioma: 'Português', origem: 'anúncio de loja', imagem: 'https://images.pokemontcg.io/sv2/217.png' },
        mercado: null,
      },
    ],
  },
  montar,
}
