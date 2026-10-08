/**
 * E06B · Resumo quinzenal da colecao, semana comum (Minha colecao). Mockup
 * aprovado: _Regua/mockups/E06B-resumo-colecao-semana-comum/email.html (v3,
 * "a subida coberta").
 *
 * Gatilho: a mesma sexta quinzenal do E06, 5+ cartas, mesma chave `e06:<dia>`
 * (a pessoa recebe o E06 OU o E06B). Entra quem o E06 pula: nada mexeu em 7
 * dias, ou o saldo dos 7 dias ficou abaixo de 3% do valor do comeco.
 *
 * O gancho e uma carta da pessoa que subiu (30 dias; senao 90 dias; senao a
 * mais valiosa e o "ano" dela). O tamanho da subida NUNCA aparece no e-mail:
 * fica do outro lado do botao, no grafico da carta (/carta/<slug>?periodo=30d,
 * que abre o PriceHistory no periodo certo).
 *
 * ARTE
 * - Hero = IMAGEM PESSOAL, tipo `e06b-gancho`, 600x320 (src/lib/regua/img/e06b.tsx):
 *   kicker "a sua carta Nº 1", nome grande, etiqueta "30 dias +R$" com a faixa
 *   de raspadinha (nenhum digito), linha verde subindo ate a carta inclinada.
 */
import { btnRegua, blocoPromocao, layoutRegua } from '@/lib/email'
import { urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import {
  FONT, attr, caminhoCarta, esc, estiloCelular, h1, hero, kicker, linha, link, p, plural, reais, reaisSinal,
} from './blocos-a'

const CAMPANHA = 'e06b'

export type JanelaE06B = '30d' | '90d' | 'ano'

export type LinhaE06B = {
  nome: string
  set: string
  slug: string
  /** Valor da carta na colecao (menor preco x copias). */
  valor: number
  /** "subiu no mes", "+R$ 25,00 na semana"... So para quem mexeu. */
  rotulo: { texto: string; cor: 'verde' | 'vermelho' } | null
}

export type DadosE06B = {
  nome: string
  periodo: { inicio: string; fim: string }
  totalCartas: number
  valorHoje: number
  janela: JanelaE06B
  gancho: { nome: string; set: string; slug: string; /** e a carta mais valiosa da colecao? */ maisValiosa: boolean }
  /** Peso do gancho na colecao: % do valor, quantas outras cartas (copias) e se ele vale mais que elas somadas. */
  peso: { pct: number; outras: number; superaOutras: boolean }
  /** Barra empilhada: o peso de cada carta (soma 100). */
  barra: { pct: number; tipo: 'gancho' | 'subiu' | 'demais' }[]
  linhas: LinhaE06B[]
  /** O que nao virou linha: quantas cartas (copias) e como chamar ("Mew ex ×2"). */
  resto: { quantidade: number; nomes: string[]; maisNomes: number } | null
  /** Saldo dos 7 dias (com sinal). */
  saldo: number
  /** Frase de catalogo sobre a carta; null = versao neutra. Texto puro. */
  notaColecionador: string | null
}

const COR = { verde: '#22c55e', vermelho: '#ef4444' }

function quando(j: JanelaE06B): string {
  return j === '30d' ? 'no mês' : j === '90d' ? 'nos últimos 3 meses' : 'este ano'
}

function juntarNomes(l: string[]): string {
  return l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`
}

function pctTxt(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function montar(d: DadosE06B, ctx: CtxRegua) {
  const g = d.gancho
  const ano = d.janela === 'ano'
  const periodo = d.janela === '30d' ? '30d' : d.janela === '90d' ? '90d' : null
  const hrefCarta = (c: string) => link(`${caminhoCarta(g.slug)}${periodo ? `?periodo=${periodo}` : ''}`, CAMPANHA, c)
  const voc = d.nome ? `${d.nome}, ` : ''
  const cap = (s: string) => (d.nome ? s : s.charAt(0).toUpperCase() + s.slice(1))

  const assunto = ano
    ? cap(`${voc}o ano do seu ${g.nome} em um gráfico`)
    : cap(`${voc}quanto o seu ${g.nome} subiu ${quando(d.janela)}?`)

  const outrasTxt = d.peso.outras === 1 ? 'a outra carta' : `as outras ${d.peso.outras}`
  const resposta = ano ? 'O histórico dele está no gráfico.' : 'A resposta está no gráfico.'
  const preheader = d.peso.superaOutras
    ? `Ele já vale mais do que ${d.peso.outras === 1 ? 'a outra carta da sua coleção' : `as outras ${d.peso.outras} cartas da sua coleção juntas`}. ${resposta}`
    : g.maisValiosa
      ? `Ele é a carta mais valiosa da sua coleção: ${pctTxt(d.peso.pct)}% dela. ${resposta}`
      : `Sozinho, ele vale ${pctTxt(d.peso.pct)}% da sua coleção. ${resposta}`

  const fato = d.peso.superaOutras
    ? `Ele é a carta mais valiosa da sua coleção e, sozinho, já vale mais do que ${outrasTxt}${d.peso.outras === 1 ? '' : ' juntas'}.`
    : g.maisValiosa
      ? `Ele é a carta mais valiosa da sua coleção e, sozinho, vale ${pctTxt(d.peso.pct)}% dela.`
      : `Sozinho, ele vale ${pctTxt(d.peso.pct)}% da sua coleção.`
  const onde = d.janela === '30d'
    ? 'A subida dos últimos 30 dias, do primeiro ao último dia, está no gráfico&nbsp;dele.'
    : d.janela === '90d'
      ? 'A subida dos últimos 3 meses, do primeiro ao último dia, está no gráfico&nbsp;dele.'
      : 'O histórico dele, do primeiro ao último dia, está no&nbsp;gráfico.'
  const titulo = ano
    ? `O ano do seu ${esc(g.nome)} em um&nbsp;gráfico`
    : `O seu ${esc(g.nome)} subiu ${quando(d.janela)}. Quanto?`
  const cta = ano ? `Ver o ano do meu ${g.nome}` : `Ver quanto o meu ${g.nome} subiu`

  // Barra empilhada: ambar = gancho, verde = as que subiram, cinza = as demais.
  const corBarra = { gancho: '#f59e0b', subiu: '#22c55e', demais: '#6e6f72' }
  const segs = d.barra.filter((s) => s.pct > 0)
  const barra = segs.map((s, i) => {
    const sep = i < segs.length - 1
      ? '<td width="2" bgcolor="#191b20" style="width:2px;font-size:1px;line-height:12px;background-color:#191b20;">&nbsp;</td>'
      : ''
    return `<td width="${Math.max(1, Math.round(s.pct))}%" height="12" bgcolor="${corBarra[s.tipo]}" style="height:12px;font-size:1px;line-height:12px;background-color:${corBarra[s.tipo]};">&nbsp;</td>${sep}`
  }).join('')
  const temVerde = segs.some((s) => s.tipo === 'subiu')
  const legenda = `<span style="color:#f59e0b;font-weight:800;">${esc(g.nome)}</span> <span style="color:#6e6f72;">&middot;</span> ${temVerde ? '<span style="color:#22c55e;font-weight:800;">subiram</span> <span style="color:#6e6f72;">&middot;</span> ' : ''}as demais`

  const slugTxt = (l: LinhaE06B) => `${l.nome}-${l.set}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const linhas = d.linhas.map((l) => {
    const href = attr(link(caminhoCarta(l.slug), CAMPANHA, `conta-${slugTxt(l)}`))
    const rot = l.rotulo
      ? `<span style="color:${COR[l.rotulo.cor]};font-weight:800;">${esc(l.rotulo.texto).replace(/R\$ /g, () => 'R$&nbsp;')}</span>`
      : '&nbsp;'
    return `<tr>
                <td valign="top" style="padding:0;border-top:1px solid #2b2d32;"><a href="${href}" target="_blank" style="display:block;text-decoration:none;${FONT}padding:11px 0 10px;">
                  <span style="display:block;font-size:16px;line-height:22px;font-weight:800;color:#f0f0f0;">${esc(l.nome)}</span>
                  <span style="display:block;font-size:14px;line-height:20px;color:#a3a4a6;">${esc(l.set)}</span></a></td>
                <td align="right" valign="top" style="padding:0 0 0 12px;border-top:1px solid #2b2d32;"><a href="${href}" target="_blank" style="display:block;text-decoration:none;${FONT}padding:11px 0 10px;text-align:right;white-space:nowrap;">
                  <span style="display:block;font-size:16px;line-height:22px;font-weight:800;color:#f0f0f0;">${reais(l.valor)}</span>
                  <span style="display:block;font-size:14px;line-height:20px;">${rot}</span></a></td>
              </tr>`
  }).join('')

  const r = d.resto
  const resto = r && r.quantidade > 0
    ? `<tr><td colspan="2" style="padding:10px 0 12px;border-top:1px solid #2b2d32;${FONT}font-size:14px;line-height:20px;color:#a3a4a6;">Mais ${plural(r.quantidade, 'carta', 'cartas')}: ${esc(juntarNomes(r.maisNomes > 0 ? [...r.nomes, `mais ${r.maisNomes}`] : r.nomes)).replace(/ x(\d+)/g, ' &times;$1')}.</td></tr>`
    : ''
  const corSaldo = d.saldo < 0 ? '#ef4444' : '#22c55e'

  const conta = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#191b20" style="background-color:#191b20;border:1px solid #202227;border-radius:16px;">
          <tr><td class="e06b-conta" style="padding:20px 20px 18px;${FONT}">
            <p style="margin:0 0 4px;font-size:22px;line-height:28px;font-weight:800;letter-spacing:-0.01em;color:#f0f0f0;">A sua coleção, carta a carta</p>
            <p style="margin:0 0 14px;font-size:14px;line-height:20px;color:#a3a4a6;">O peso de cada carta nos ${reais(d.valorHoje)} de hoje.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:999px;overflow:hidden;table-layout:auto;"><tr>${barra}</tr></table>
            <p style="margin:8px 0 6px;font-size:14px;line-height:20px;color:#a3a4a6;">${legenda}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${linhas}
              ${resto}
              <tr><td style="padding:14px 0 0;border-top:1px solid #2b2d32;${FONT}font-size:16px;line-height:22px;font-weight:800;color:#f0f0f0;">Saldo dos 7 dias</td><td align="right" style="padding:14px 0 0;border-top:1px solid #2b2d32;${FONT}font-size:18px;line-height:22px;font-weight:800;color:${corSaldo};white-space:nowrap;">${reaisSinal(d.saldo)}</td></tr>
            </table>
          </td></tr>
        </table>`

  const nota = d.notaColecionador
    ?? `Se você souber o que mexeu com o ${g.nome} ${quando(d.janela)}, responde este e-mail: a Bynx lê todas as respostas.`
  const alt = `${g.maisValiosa ? 'A sua carta Nº 1' : 'Uma carta da sua coleção'}, o ${g.nome}, grande e inclinada à direita.` +
    (ano
      ? ' Uma linha âmbar sai de um ano atrás e entra na carta.'
      : ` Uma linha verde sai de ${d.janela === '30d' ? '30 dias' : '3 meses'} atrás, sobe e entra na carta. Ao lado, a etiqueta: ${d.janela === '30d' ? '30 dias' : '3 meses'}, mais R$, e o valor coberto por uma faixa de raspadinha.`)

  const conteudo = [
    estiloCelular('.e06b-conta{padding:16px 14px 14px!important}'),
    hero({ src: urlImagemPessoal('e06b-gancho', ctx.tokenImagem), alt, href: hrefCarta('hero'), largura: 600, altura: 320 }),
    linha(`
        ${kicker(d.nome ? `Na sua coleção, ${esc(d.nome)}` : 'Na sua coleção')}
        ${h1(titulo)}
        ${p(`${esc(fato)} ${onde}`)}`, '20px 32px 0'),
    linha(btnRegua(esc(cta), hrefCarta('cta')), '20px 32px 0'),
    linha(conta, '32px 32px 0'),
    linha(`<p style="margin:0;font-size:14px;line-height:20px;color:#a3a4a6;">${plural(d.totalCartas, 'carta', 'cartas')} <span style="color:#6e6f72;">&middot;</span> menor preço do Mercado Brasileiro</p>`, '12px 32px 0'),
    linha(`<p style="margin:0;padding-top:20px;border-top:1px solid #202227;font-size:16px;line-height:25px;color:#a3a4a6;">${esc(nota).replace(/e-mail:/, '<span style="white-space:nowrap;">e-mail</span>:')}</p>`, '28px 32px 0'),
  ].join('\n')

  const html = layoutRegua({
    conteudo,
    campanha: CAMPANHA,
    categoria: 'colecao',
    links: ctx.links,
    preheader,
    rotulo: `Resumo · ${d.periodo.inicio} a ${d.periodo.fim}`,
    assinatura: true,
    respiroAssinatura: 12,
    motivo: 'Você recebe porque tem 5 ou mais cartas na sua coleção da Bynx e o resumo da coleção está ligado nas suas preferências.',
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E06B: TemplateRegua<DadosE06B> = {
  id: 'E06B',
  nome: 'Resumo quinzenal: semana comum',
  trilha: 'Minha coleção',
  categoria: 'colecao',
  // PERSONA DE EXEMPLO (meta.json do mockup): Gabriel, 8 cartas, R$ 1.363,10; Lugia-GX subiu no mes.
  exemplo: {
    nome: 'Gabriel',
    periodo: { inicio: '30/10', fim: '06/11' },
    totalCartas: 8,
    valorHoje: 1363.1,
    janela: '30d',
    gancho: { nome: 'Lugia-GX', set: 'Lost Thunder', slug: 'sm8-207', maisValiosa: true },
    peso: { pct: 51.3, outras: 7, superaOutras: true },
    barra: [
      { pct: 51, tipo: 'gancho' }, { pct: 21, tipo: 'demais' }, { pct: 11, tipo: 'demais' }, { pct: 5, tipo: 'subiu' },
      { pct: 5, tipo: 'demais' }, { pct: 4, tipo: 'subiu' }, { pct: 2, tipo: 'demais' },
    ],
    linhas: [
      { nome: 'Lugia-GX', set: 'Lost Thunder', slug: 'sm8-207', valor: 699.5, rotulo: { texto: 'subiu no mês', cor: 'verde' } },
      { nome: 'Blastoise', set: 'Base (1999)', slug: 'base1-2', valor: 289.9, rotulo: null },
      { nome: 'Pikachu', set: 'Crown Zenith', slug: 'swsh12pt5-160', valor: 149.9, rotulo: null },
      { nome: 'Kangaskhan', set: 'Destined Rivals', slug: 'sv10-204', valor: 69.9, rotulo: { texto: 'subiu no mês', cor: 'verde' } },
      { nome: 'Tympole', set: 'Black Bolt', slug: 'zsv10pt5-103', valor: 59, rotulo: { texto: '+R$ 25,00 na semana', cor: 'verde' } },
    ],
    resto: { quantidade: 3, nomes: ['Mew ex x2', 'Pikachu Base (1999)'], maisNomes: 0 },
    saldo: 25,
    notaColecionador: 'Uma coisa de colecionador: esse Lugia-GX é a versão de arte completa do Lost Thunder, a 207/214, ilustrada por PLANETA Igarashi. Se você souber o que mexeu com ele no mês, responde este e-mail: a Bynx lê todas as respostas.',
  },
  montar,
}
