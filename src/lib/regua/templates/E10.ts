/**
 * E10 · Radar Bynx (newsletter quinzenal), edicao No 1 de Halloween. Mockup
 * aprovado: _Regua/mockups/E10-radar-bynx-1/email.html (abertura padrao, 0 a 4
 * cartas) e email-5mais.html (abertura com a colecao, 5+ cartas).
 *
 * Gatilho: calendario, quarta 19h30 (Brasilia), a cada duas quartas.
 *
 * Os dados se dividem em dois: `edicao` (igual para todos os leitores da
 * edicao: capa, manchete, gaveta, placar, historia) e `colecao` (so para quem
 * tem 5+ cartas; null = abertura padrao).
 *
 * ARTE (FIXA por edicao, igual para todos os leitores)
 * - Capa `e10/n1-capa.jpg` (1080x720, exibida 600x400): Zekrom ex saindo da
 *   cova, lapide "Aqui jaz R$ 1.343,00" e placa "Hoje R$ 2.400,00". Precos da
 *   edicao (nao sao da pessoa); o H1 repete o ganho em texto vivo.
 * - Historia `e10/n1-historia.jpg` (993x540, exibida 552x300): Charizard G
 *   LV.X em vitrine de museu, "R$ 552,50 -> R$ 989,00".
 * Cada edicao nova sobe a capa e a historia como `e10/n<numero>-*.jpg`.
 * As cartas da gaveta, do placar e da colecao vem por URL (dado).
 */
import { btnRegua, blocoPromocao, layoutRegua } from '@/lib/email'
import { urlArte, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import {
  FONT, attr, caminhoCarta, esc, estiloCelular, h1, hero, imagemCarta, kicker, linha, link, num, p, reais, reaisTxt,
} from './blocos-a'

const CAMPANHA = 'e10'

export type CartaGavetaE10 = { nome: string; numero: string; slug: string; imagem: string; preco: number }

export type CartaPlacarE10 = {
  nome: string
  numero: string
  slug: string
  imagem: string
  precoAntes: number
  precoAgora: number
  /** Variacao em 30 dias, em % (negativo = queda). */
  pct: number
  /** Frase do placar (texto puro). */
  frase: string
  /** Pilula ambar opcional, ex.: "maior alta em reais da lista". */
  selo?: string
}

export type DadosE10 = {
  edicao: {
    numero: number
    /** Arquivos da edicao em /emails/regua/e10/. */
    capa: { arquivo: string; alt: string; largura: number; altura: number }
    /** Carta da capa: "O <carta> <verbo> com R$ X a mais." */
    manchete: { carta: string; slug: string; verbo: string; ganho: number }
    /** Carta-ancora do assunto ("O Charizard de 1999 da sua gaveta vale ..."). */
    ancora: { nome: string; preco: number }
    /** `recorte` vai no P.S.: "Vale para qualquer carta, nao so <recorte>". */
    gaveta: { kicker: string; titulo: string; recorte: string; cartas: CartaGavetaE10[] }
    placar: { titulo: string; doces: CartaPlacarE10[]; sustos: CartaPlacarE10[]; ate: string }
    historia: {
      arquivo: string
      alt: string
      largura: number
      altura: number
      titulo: string
      slug: string
      texto: string
      pergunta: string
      dica: string
    }
    despedida: string
  }
  /** Abertura 5+ cartas; null = abertura padrao. */
  colecao: {
    nome: string
    valor: number
    maisSubiu: { nome: string; numero: string; imagem: string; precoAntes: number; precoAgora: number; dias: number }
  } | null
}

function cartaPlacar(c: CartaPlacarE10): string {
  const up = c.pct >= 0
  const href = attr(link(caminhoCarta(c.slug), CAMPANHA, 'placar'))
  const borda = c.selo ? '#f59e0b' : '#202227'
  return `<tr><td style="padding:0 0 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080a0f" style="background-color:#080a0f;border:1px solid ${borda};border-radius:12px;">
            <tr>
              <td width="74" valign="top" style="padding:12px 0 12px 12px;"><a href="${href}" target="_blank" style="text-decoration:none;color:#a1a2a4;"><img src="${attr(imagemCarta(c.imagem))}" width="62" alt="${attr(`${c.nome} nº ${c.numero}`)}" style="display:block;width:62px;height:auto;border:0;border-radius:4px;background-color:#202227;color:#a1a2a4;${FONT}font-size:14px;"/></a></td>
              <td valign="top" style="padding:12px 12px 12px 6px;${FONT}">
                ${c.selo ? `<span style="display:inline-block;margin:0 0 6px;padding:1px 10px;border-radius:999px;background-color:#f59e0b;color:#0a0a0a;font-size:14px;line-height:22px;font-weight:800;">${esc(c.selo)}</span><br>` : ''}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td valign="top" style="${FONT}font-size:16px;line-height:22px;font-weight:800;color:#f0f0f0;"><a href="${href}" target="_blank" style="color:#f0f0f0;text-decoration:none;">${esc(c.nome)}</a></td>
                  <td valign="top" align="right" style="${FONT}font-size:16px;line-height:22px;font-weight:800;color:${up ? '#22c55e' : '#ef4444'};white-space:nowrap;padding-left:8px;">${up ? '&#9650;' : '&#9660;'}&nbsp;${up ? '+' : '&minus;'}${num(c.pct)}%</td>
                </tr></table>
                <p style="margin:2px 0 0;font-size:14px;line-height:20px;color:#a1a2a4;white-space:nowrap;">nº&nbsp;${esc(c.numero)}</p>
                <p style="margin:2px 0 0;font-size:14px;line-height:20px;color:#a1a2a4;"><span style="text-decoration:line-through;white-space:nowrap;">${reais(c.precoAntes)}</span> &rarr; <span style="color:#f0f0f0;font-weight:700;white-space:nowrap;">${reais(c.precoAgora)}</span></p>
                <p style="margin:6px 0 0;font-size:14px;line-height:20px;color:#f0f0f0;">${esc(c.frase).replace(/R\$ /g, () => 'R$&nbsp;')}</p>
              </td>
            </tr>
          </table>
        </td></tr>`
}

function montar(d: DadosE10, ctx: CtxRegua) {
  const e = d.edicao
  const col = d.colecao
  const m = e.manchete
  const assunto = `O ${e.ancora.nome} da sua gaveta vale ${reaisTxt(e.ancora.preco)}`
  const preheader = col
    ? `O ${col.maisSubiu.nome} da sua pasta ganhou ${reaisTxt(col.maisSubiu.precoAgora - col.maisSubiu.precoAntes)} em ${col.maisSubiu.dias} dias. E o ${m.carta} ${m.verbo}.`
    : `E o ${m.carta} ${m.verbo} com ${reaisTxt(m.ganho)} a mais. Veja quanto valem as suas cartas.`
  const ctaHref = link(col ? '/minha-colecao' : '/busca', CAMPANHA, 'cta')
  const sep = linha(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="#202227" style="height:1px;font-size:1px;line-height:1px;background-color:#202227;">&nbsp;</td></tr></table>`, '26px 32px 0')
  const h2 = (t: string) => `<h2 class="e10-h2" style="margin:0 0 14px;font-size:24px;line-height:30px;font-weight:800;letter-spacing:-0.01em;color:#f0f0f0;">${t}</h2>`

  const abertura = col
    ? linha(h1(`${esc(col.nome)}, sua coleção está em <span style="white-space:nowrap;">${reais(col.valor)}</span>.`, '0'), '22px 32px 0')
    : linha(`
        ${h1(`O ${esc(m.carta)} ${esc(m.verbo)} com <span style="white-space:nowrap;color:#22c55e;">${reais(m.ganho)}</span> a mais.`, '0')}
        ${p(`E aquele <b style="color:#f0f0f0;">${esc(e.ancora.nome)}</b> da sua gaveta? Hoje vale <b style="color:#f0f0f0;white-space:nowrap;">${reais(e.ancora.preco)}</b>. Digite o nome das suas e veja o&nbsp;preço.`, 'margin:10px 0 0;font-size:16px;line-height:24px;color:#a3a4a6;')}`, '20px 32px 0')

  const ms = col?.maisSubiu
  const blocoColecao = ms
    ? linha(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080a0f" style="background-color:#080a0f;border:1px solid #202227;border-radius:12px;"><tr>
          <td width="74" valign="top" style="padding:12px 0 12px 12px;"><a href="${attr(ctaHref)}" target="_blank" style="text-decoration:none;color:#a1a2a4;"><img src="${attr(imagemCarta(ms.imagem))}" width="62" alt="${attr(`${ms.nome} nº ${ms.numero}`)}" style="display:block;width:62px;height:auto;border:0;border-radius:4px;background-color:#202227;color:#a1a2a4;${FONT}font-size:14px;"/></a></td>
          <td valign="top" style="padding:12px 12px 12px 6px;${FONT}">
            ${kicker('A que mais subiu em reais na sua pasta', '#22c55e', '0', '0.06em')}
            <p style="margin:2px 0 0;font-size:16px;line-height:22px;font-weight:800;color:#f0f0f0;">${esc(ms.nome)}</p>
            <p style="margin:2px 0 0;font-size:14px;line-height:20px;color:#a1a2a4;white-space:nowrap;">nº&nbsp;${esc(ms.numero)}</p>
            <p style="margin:2px 0 0;font-size:14px;line-height:20px;color:#a1a2a4;"><span style="text-decoration:line-through;white-space:nowrap;">${reais(ms.precoAntes)}</span> &rarr; <b style="color:#f0f0f0;white-space:nowrap;">${reais(ms.precoAgora)}</b> &middot; <b style="color:#22c55e;white-space:nowrap;">+${reais(ms.precoAgora - ms.precoAntes)} em ${ms.dias} dias</b></p>
          </td>
        </tr></table>`, '14px 32px 0')
    : ''

  const nGav = e.gaveta.cartas.length
  const gaveta = e.gaveta.cartas.map((c, i) => {
    const pad = i === 0 ? '0 6px 0 0' : i === nGav - 1 ? '0 0 0 6px' : '0 3px'
    const href = attr(link(caminhoCarta(c.slug), CAMPANHA, `gaveta-${c.slug}`))
    return `<td width="${Math.floor(100 / nGav)}%" valign="top" style="padding:${pad};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080a0f" style="background-color:#080a0f;border:1px solid #202227;border-radius:12px;"><tr><td align="center" style="padding:10px 8px 12px;${FONT}">
                <a href="${href}" target="_blank" style="text-decoration:none;color:#a1a2a4;"><img src="${attr(imagemCarta(c.imagem))}" width="120" alt="${attr(`${c.nome} nº ${c.numero}`)}" style="display:block;width:120px;max-width:100%;height:auto;margin:0 auto;border:0;border-radius:6px;background-color:#202227;color:#a1a2a4;${FONT}font-size:14px;"/></a>
                <p style="margin:8px 0 0;font-size:14px;line-height:20px;font-weight:800;color:#f0f0f0;"><a href="${href}" target="_blank" style="color:#f0f0f0;text-decoration:none;">${esc(c.nome)}</a></p>
                <p style="margin:0;font-size:14px;line-height:20px;color:#a1a2a4;white-space:nowrap;">nº&nbsp;${esc(c.numero)}</p>
                <p style="margin:4px 0 0;font-size:14px;line-height:20px;font-weight:800;color:#22c55e;white-space:nowrap;">${reais(c.preco)}</p>
              </td></tr></table>
            </td>`
  }).join('')

  const pl = e.placar
  const lista = (l: CartaPlacarE10[]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${l.map(cartaPlacar).join('')}</table>`
  const rotuloPlacar = (t: string, cor: string, margem: string) => `<p style="margin:${margem};font-size:14px;line-height:20px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${cor};">${t}</p>`

  const h = e.historia
  const conteudo = [
    estiloCelular('.e10-h2{font-size:21px!important;line-height:27px!important}.e10-cta{padding-top:16px!important}'),
    hero({ src: urlArte('e10', e.capa.arquivo), alt: e.capa.alt, href: link(caminhoCarta(m.slug), CAMPANHA, 'hero'), largura: e.capa.largura, altura: e.capa.altura, fundo: '#080a0f' }),
    abertura,
    linha(btnRegua(col ? 'Ver a minha coleção' : 'Ver quanto vale a minha gaveta', ctaHref), '18px 32px 0', 'e10-cta'),
    blocoColecao,
    linha(`
        ${kicker(esc(e.gaveta.kicker))}
        ${h2(esc(e.gaveta.titulo))}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${gaveta}</tr></table>
        ${p('Menor preço no Mercado Brasileiro. Toque na&nbsp;sua.', 'margin:10px 0 0;font-size:14px;line-height:20px;color:#a3a4a6;')}`, '26px 32px 0'),
    sep,
    linha(`
        ${kicker('01 &middot; O placar do mês')}
        ${h2(esc(pl.titulo))}
        ${pl.doces.length ? rotuloPlacar(pl.doces.length === 1 ? 'Doce' : 'Doces', '#22c55e', '0 0 8px') + lista(pl.doces) : ''}
        ${pl.sustos.length ? rotuloPlacar(pl.sustos.length === 1 ? 'Susto' : 'Sustos', '#ef4444', '8px 0 8px') + lista(pl.sustos) : ''}
        ${p(`Menor preço no Mercado Brasileiro, 30 dias até ${esc(pl.ate)}. Toque na carta para ver a versão exata.`, 'margin:6px 0 0;font-size:14px;line-height:20px;color:#a3a4a6;')}`, '22px 32px 0'),
    sep,
    linha(`
        ${kicker('02 &middot; A história')}
        ${h2(esc(h.titulo))}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080a0f" style="background-color:#080a0f;border:1px solid #202227;border-radius:16px;">
          <tr><td bgcolor="#080a0f" style="background-color:#080a0f;border-radius:16px 16px 0 0;font-size:0;line-height:0;">
            <a href="${attr(link(caminhoCarta(h.slug), CAMPANHA, 'historia'))}" target="_blank" style="text-decoration:none;color:#f0f0f0;"><img src="${attr(urlArte('e10', h.arquivo))}" width="${h.largura}" height="${h.altura}" alt="${attr(h.alt)}" style="display:block;width:100%;max-width:${h.largura}px;height:auto;border:0;border-radius:16px 16px 0 0;color:#f0f0f0;${FONT}font-size:14px;font-weight:700;background-color:#080a0f;"/></a>
          </td></tr>
          <tr><td style="padding:16px 16px 6px;${FONT}">
            <p style="margin:0 0 10px;font-size:16px;line-height:25px;color:#a1a2a4;">${esc(h.texto)} <b style="color:#f0f0f0;">${esc(h.pergunta)}</b> ${esc(h.dica)}</p>
          </td></tr>
        </table>`, '22px 32px 0'),
    linha(`
        ${p(esc(e.despedida), 'margin:0 0 18px;font-size:16px;line-height:25px;color:#a3a4a6;')}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="#080a0f" style="background-color:#080a0f;border-left:3px solid #f59e0b;border-radius:0 12px 12px 0;padding:14px 16px;${FONT}">
            <p style="margin:0;font-size:16px;line-height:25px;color:#f0f0f0;"><b>P.S.</b> Vale para qualquer carta, não só ${esc(e.gaveta.recorte)}: <a href="${attr(link('/busca', CAMPANHA, 'ps'))}" target="_blank" style="color:#f59e0b;text-decoration:underline;">digite o nome na busca</a> e o menor preço aparece na hora, sem login.</p>
          </td>
        </tr></table>`, '28px 32px 0'),
  ].join('\n')

  const html = layoutRegua({
    conteudo,
    campanha: CAMPANHA,
    categoria: 'radar',
    links: ctx.links,
    preheader,
    rotulo: `Radar Bynx · Nº ${e.numero}`,
    assinatura: true,
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

/** Edicao No 1 (Halloween, 28/10/2026). Dados reais de dados.json (07/10). */
const EDICAO_1: DadosE10['edicao'] = {
  numero: 1,
  capa: {
    arquivo: 'n1-capa.jpg',
    largura: 600,
    altura: 400,
    alt: "Zekrom ex saindo da cova: era R$ 1.343,00, hoje R$ 2.400,00. Na lápide, 'Aqui jaz R$ 1.343,00'. Radar Bynx, edição de Halloween.",
  },
  manchete: { carta: 'Zekrom ex', slug: 'zsv10pt5-172', verbo: 'saiu do túmulo', ganho: 1057 },
  ancora: { nome: 'Charizard de 1999', preco: 1249 },
  gaveta: {
    kicker: 'A gaveta de 1999',
    titulo: 'Tem alguma destas guardada?',
    recorte: 'as de 1999',
    cartas: [
      { nome: 'Charizard', numero: '4/102', slug: 'base1-4', imagem: 'https://images.pokemontcg.io/base1/4_hires.png', preco: 1249 },
      { nome: 'Blastoise', numero: '2/102', slug: 'base1-2', imagem: 'https://images.pokemontcg.io/base1/2_hires.png', preco: 289.9 },
      { nome: 'Pikachu', numero: '58/102', slug: 'base1-58', imagem: 'https://images.pokemontcg.io/base1/58_hires.png', preco: 26.9 },
    ],
  },
  placar: {
    titulo: 'Um doce e um susto.',
    ate: '27/10',
    doces: [
      { nome: 'Lugia-GX', numero: '207/214', slug: 'sm8-207', imagem: 'https://images.pokemontcg.io/sm8/207.png', precoAntes: 399.9, precoAgora: 699.5, pct: 74.9, frase: 'Ganhou R$ 299,60 em 30 dias. Quem guardou a sua está rindo à toa.' },
    ],
    sustos: [
      { nome: 'Ralts', numero: '211/198', slug: 'sv1-211', imagem: 'https://images.pokemontcg.io/sv1/211.png', precoAntes: 299, precoAgora: 95.99, pct: -67.9, frase: 'Não é a Ralts comum: é a nº 211/198, de arte especial. Boa notícia para quem ainda quer uma.' },
    ],
  },
  historia: {
    arquivo: 'n1-historia.jpg',
    largura: 552,
    altura: 300,
    alt: 'Charizard G LV.X, promo DP45, em uma vitrine de museu. Menor preço no Mercado Brasileiro: de R$ 552,50 para R$ 989,00 em 30 dias.',
    titulo: 'A carta que só saiu como promo.',
    slug: 'dpp-DP45',
    texto: 'Só existiu como promo, nunca em pacote.',
    pergunta: 'Tem um guardado?',
    dica: 'Veja se o número DP45 está impresso no canto da carta.',
  },
  despedida: 'Até o Radar Nº 2, daqui a duas quartas. Sem sustos, prometemos. Ou quase.',
}

export const E10: TemplateRegua<DadosE10> = {
  id: 'E10',
  nome: 'Radar Bynx',
  trilha: 'Radar Bynx',
  categoria: 'radar',
  exemplo: { edicao: EDICAO_1, colecao: null },
  montar,
}

/**
 * Abertura 5+ cartas da mesma edicao. PERSONA DE EXEMPLO (direcao/PERSONAS.md):
 * Marina, R$ 1.955,30; a que mais subiu em reais e o Giratina V. O placar ganha
 * a linha do Zekrom ex (carta da capa), como no mockup email-5mais.html.
 */
export const E10_EXEMPLO_5MAIS: DadosE10 = {
  edicao: {
    ...EDICAO_1,
    placar: {
      ...EDICAO_1.placar,
      titulo: 'Duas cartas adoçaram o mês. Uma assustou.',
      doces: [
        { nome: 'Zekrom ex', numero: '172/086', slug: 'zsv10pt5-172', imagem: 'https://images.pokemontcg.io/zsv10pt5/172.png', precoAntes: 1343, precoAgora: 2400, pct: 78.7, frase: 'Ganhou R$ 1.057,00 em 30 dias. É a carta da capa.', selo: 'maior alta em reais da lista' },
        ...EDICAO_1.placar.doces,
      ],
    },
  },
  colecao: {
    nome: 'Marina',
    valor: 1955.3,
    maisSubiu: { nome: 'Giratina V', numero: '186/196', imagem: 'https://images.pokemontcg.io/swsh11/186.png', precoAntes: 789, precoAgora: 1299.9, dias: 7 },
  },
}

/** Variantes para a pre-visualizacao (sufixo do arquivo -> dados). */
export const E10_VARIANTES: Record<string, DadosE10> = { '': E10.exemplo, '-5mais': E10_EXEMPLO_5MAIS }
