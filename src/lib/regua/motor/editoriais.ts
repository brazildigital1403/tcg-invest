/**
 * Disparos EDITORIAIS da regua (o Du aprova cada um no /admin/regua):
 * E01, E10 (Radar), E11, E12, E17, E18, E19. O E01 sai como E01B para quem
 * tem 0 cartas e o E17 sai como E17B para quem tem 1 a 9 (mesmo disparo, mesma
 * chave: cada pessoa recebe um OU outro).
 *
 * Cada editorial recebe os dados da EDICAO (o que muda por disparo: numero do
 * Radar, ofertas da Black Friday, rodada do leilao...) e o motor completa o
 * que e da PESSOA a partir do banco.
 *
 * ★ Disparo e acao do admin, nunca do cron. 'simular' nao grava nada (conta e
 * monta 3 amostras); 'enviar' exige REGUA_ATIVA=1, confirmacao e o template
 * sem bloqueio. Um disparo que nao termina no tempo da funcao para e devolve
 * `incompleto`: clicar de novo continua de onde parou (o dedup segura quem ja
 * recebeu).
 */
import type { DadosE01 } from '@/lib/regua/templates/E01'
import { CARTAS_E01B, type DadosE01B } from '@/lib/regua/templates/E01B'
import type { DadosE10 } from '@/lib/regua/templates/E10'
import type { DadosE11 } from '@/lib/regua/templates/E11'
import type { DadosE12 } from '@/lib/regua/templates/E12'
import type { DadosE17 } from '@/lib/regua/templates/E17'
import type { DadosE17B, SegundoTrofeuE17B } from '@/lib/regua/templates/E17B'
import type { DadosE18, OfertaE18, PessoalE18 } from '@/lib/regua/templates/E18'
import type { DadosE19 } from '@/lib/regua/templates/E19'
import { REGUA } from '@/lib/regua/registro'
import type { BolsoE01, ImgE01 } from '@/lib/regua/img/e01'
import type { ImgE12 } from '@/lib/regua/img/e12'
import type { ImgE17BAlta, ImgE17BDia, ImgE17BHero } from '@/lib/regua/img/e17b'
import type { ImgE18 } from '@/lib/regua/img/e18'
import type { ImgE19 } from '@/lib/regua/img/e19'
import type { CategoriaEmail } from '@/lib/email'
import { PCT_SUSPEITO } from './config'
import { carregarCatalogo, type CartaCatalogo, type Colecao, type Usuario } from './banco'
import { colecoes, criarContexto, metas, prepararHistorico, semTempo, type Contexto } from './contexto'
import { maisValiosas, mediuVariacao, mexidas, r1, r2, repetidas } from './analise'
import { novaAvaliacao, passaNasRegras, pular, type Avaliacao } from './avaliacao'
import { enviarCandidatos, type Candidato, type ResultadoEnvio } from './envio'
import { DIA_MS, ddmm, diaDeMes, mesPorExtenso, somarDias } from './tempo'

export const EDITORIAIS = ['E01', 'E10', 'E11', 'E12', 'E17', 'E18', 'E19'] as const
export type IdEditorial = (typeof EDITORIAIS)[number]

/**
 * Templates que ainda NAO podem sair de verdade (simular pode). O motivo
 * aparece no admin; tirar daqui e a liberacao.
 */
export const BLOQUEIO_ENVIO: Partial<Record<string, string>> = {
  E12: 'O leilão ainda não está em produção (feat/leilao).',
  E17: 'A página /2026 (virar a carta) ainda não existe.',
  E18: 'O filtro Black Friday do Mercado (/marketplace?oferta=black-friday) ainda não existe.',
}

/** Quem e o publico de cada editorial (texto do admin). */
export const PUBLICO_TEXTO: Record<IdEditorial, string> = {
  E01: 'Aceitaram novidades, cadastro até 31/08, com carta que mexeu 10%+ em 7 dias; quem tem 0 cartas recebe o E01B. Ondas por último acesso: 1 até 30 dias, 2 de 31 a 90, 3 o resto.',
  E10: 'Aceitaram novidades com o Radar ligado. 5+ cartas ganham a abertura com a coleção.',
  E11: 'Aceitaram novidades, cadastro a partir de 01/09. Mesmas ondas do E01. Nunca E01 e E11 em 30 dias.',
  E12: 'Aceitaram novidades, fora de quem está no winback.',
  E17: 'Todos com 10+ cartas e ao menos 1 repetida; 1 a 9 cartas recebe o E17B (categoria Coleção).',
  E18: 'Aceitaram novidades com Mercado ligado.',
  E19: 'Aceitaram novidades, com carta de R$ 300+ ou graduada.',
}

export type Publico =
  | { tipo: 'segmento'; onda?: 1 | 2 | 3 }
  /** Envio de teste para contas listadas: fora do teto e do dedup, campanha com ':teste'. */
  | { tipo: 'emails'; emails: string[] }

/** `template` so quando a pessoa recebe a variante (E01B, E17B) no lugar do editorial disparado. */
type Montagem = { dados: unknown; img: Record<string, unknown> | null; chave: string; campanha: string; template?: string } | string

type Def = {
  categoria: CategoriaEmail
  /** Filtro do segmento (antes das regras). */
  noSegmento: (ctx: Contexto, u: Usuario, col: Colecao, onda?: 1 | 2 | 3) => boolean
  /** Dedup: templates e chave/janela. */
  dedup: (edicao: Record<string, unknown>) => { templates?: string[]; chave?: string; janelaDias?: number }
  /** Valida a edicao; devolve erro legivel ou null. */
  validar: (edicao: Record<string, unknown>) => string | null
  montar: (ctx: Contexto, u: Usuario, col: Colecao, edicao: Record<string, unknown>) => Promise<Montagem>
}

// ─── auxiliares ─────────────────────────────────────────────────────────────

function onda(ctx: Contexto, u: Usuario): 1 | 2 | 3 {
  const visto = u.lastSeenMs
  if (visto === null) return 3
  const dias = (ctx.agoraMs - visto) / DIA_MS
  return dias <= 30 ? 1 : dias <= 90 ? 2 : 3
}

const eObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const eStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const eNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

// ─── E01 ────────────────────────────────────────────────────────────────────

/** E01B: quem tem 0 cartas. O preco do dia das tres cartas de 1999 e as novidades depois do cadastro. */
async function montarE01B(ctx: Contexto, u: Usuario): Promise<Montagem> {
  await carregarCatalogo(ctx.c, ctx.catalogo, CARTAS_E01B.map((c) => c.slug))
  const cartas = CARTAS_E01B.map((c) => {
    const cat = ctx.catalogo.get(c.slug)
    return { ...c, slug: cat?.slug || c.slug, preco: cat?.precoMin ?? 0 }
  })
  if (cartas.some((c) => !(c.preco > 0))) return 'preco_da_colecao_1999_indisponivel'
  const dados: DadosE01B = { nome: u.nome, cartas, entrouEm: u.criadoDia.slice(0, 7) }
  return { dados, img: null, chave: 'e01', campanha: 'e01b', template: 'E01B' }
}

async function montarE01(ctx: Contexto, u: Usuario, col: Colecao): Promise<Montagem> {
  if (col.total === 0) return montarE01B(ctx, u)
  const ms = mexidas(ctx, col, 7).filter((m) => m.carta.cat?.imagemGrande)
  const gancho = ms.filter((m) => m.pct >= 10).sort((a, b) => b.pct - a.pct)[0]
  if (!gancho) return 'sem_carta_que_subiu_10pct'
  const mexeu = new Map(ms.filter((m) => Math.abs(m.pct) >= 10).map((m) => [m.carta.cardId!, m.pct > 0 ? 'subiu' as const : 'caiu' as const]))
  let pagina = maisValiosas(col).slice(0, 8)
  if (!pagina.some((x) => x.cardId === gancho.carta.cardId)) pagina = [gancho.carta, ...pagina.slice(0, 7)]
  const bolsos: BolsoE01[] = pagina.map((x) => x.cardId === gancho.carta.cardId
    ? { gancho: true }
    : { imagem: x.cat!.imagemGrande, ...(mexeu.has(x.cardId!) ? { mexeu: mexeu.get(x.cardId!) } : {}) })
  const outras = ms.filter((m) => m !== gancho && Math.abs(m.pct) >= 10)
    .sort((a, b) => Math.abs(b.naColecao) - Math.abs(a.naColecao)).slice(0, 6)
    .map((m) => ({ nome: m.carta.nome, set: m.carta.cat!.set, slug: m.carta.cat!.slug, direcao: m.pct > 0 ? 'subiu' as const : 'caiu' as const }))
  const g = gancho.carta.cat!
  const dados: DadosE01 = {
    nome: u.nome,
    gancho: { nome: gancho.carta.nome, set: g.set, slug: g.slug, imagem: g.imagem, precoAntes: gancho.antes, precoAgora: gancho.agora, pct: r1(gancho.pct) },
    outras,
    totalCartas: col.total,
    valorColecao: col.valor,
  }
  const img: ImgE01 = {
    gancho: { nome: gancho.carta.nome, imagem: g.imagemGrande, pct: r1(gancho.pct), ganho: gancho.naColecao },
    pagina: bolsos,
    totalCartas: col.total,
    valorColecao: col.valor,
  }
  return { dados, img: { 'e01-fichario': img }, chave: 'e01', campanha: 'e01' }
}

// ─── E10 · Radar ────────────────────────────────────────────────────────────

function validarE10(e: Record<string, unknown>): string | null {
  if (!eNum(e.numero)) return 'edicao.numero (número do Radar) é obrigatório'
  for (const k of ['capa', 'manchete', 'ancora', 'gaveta', 'placar', 'historia']) if (!eObj(e[k])) return `edicao.${k} é obrigatório (mesmo formato do exemplo do E10)`
  if (!eStr(e.despedida)) return 'edicao.despedida é obrigatória'
  return null
}

async function montarE10(ctx: Contexto, u: Usuario, col: Colecao, edicao: Record<string, unknown>): Promise<Montagem> {
  let colecao: DadosE10['colecao'] = null
  if (col.total >= 5) {
    const alta = mexidas(ctx, col, 7).filter((m) => m.naColecao > 0 && m.carta.cat?.imagem).sort((a, b) => b.naColecao - a.naColecao)[0]
    if (alta) {
      const c = alta.carta.cat!
      colecao = {
        nome: u.nome, valor: col.valor,
        maisSubiu: { nome: alta.carta.nome, numero: c.setTotal ? `${c.numero}/${c.setTotal}` : c.numero, imagem: c.imagem, precoAntes: alta.antes, precoAgora: alta.agora, dias: 7 },
      }
    }
  }
  const dados: DadosE10 = { edicao: edicao as unknown as DadosE10['edicao'], colecao }
  const n = edicao.numero as number
  return { dados, img: null, chave: `radar:${n}`, campanha: `e10-${n}` }
}

// ─── E11 ────────────────────────────────────────────────────────────────────

async function montarE11(ctx: Contexto, _u: Usuario, _col: Colecao, edicao: Record<string, unknown>): Promise<Montagem> {
  let preco = eNum(edicao.precoMewHoje) ? edicao.precoMewHoje : 0
  if (!preco) {
    await carregarCatalogo(ctx.c, ctx.catalogo, ['sv3pt5-151'])
    preco = ctx.catalogo.get('sv3pt5-151')?.precoMin ?? 0
  }
  if (!(preco > 0)) return 'preco_da_mew_indisponivel'
  const teto = eNum(edicao.tetoAviso) ? edicao.tetoAviso : Math.floor(preco * 0.9)
  const dados: DadosE11 = { precoMewHoje: preco, tetoAviso: teto }
  const id = eStr(edicao.id) ? edicao.id : 'o-que-chegou'
  return { dados, img: null, chave: `e11:${id}`, campanha: `e11-${id}` }
}

// ─── E12 ────────────────────────────────────────────────────────────────────

function validarE12(e: Record<string, unknown>): string | null {
  if (!eStr(e.prazoVoto)) return 'edicao.prazoVoto é obrigatório ("domingo, 06/12")'
  const r = e.rodada
  if (!eObj(r) || !eStr(r.numero) || !eStr(r.loja) || !eStr(r.dia)) return 'edicao.rodada { numero, loja, dia } é obrigatória'
  if (!Array.isArray(e.cartas) || e.cartas.length !== 3) return 'edicao.cartas precisa de exatamente 3 cartas'
  return null
}

async function montarE12(_ctx: Contexto, u: Usuario, _col: Colecao, edicao: Record<string, unknown>): Promise<Montagem> {
  const rodada = edicao.rodada as DadosE12['rodada']
  const dados: DadosE12 = { nome: u.nome, prazoVoto: edicao.prazoVoto as string, rodada, cartas: edicao.cartas as DadosE12['cartas'] }
  const img: ImgE12 = { nome: u.nome, rodada }
  return { dados, img: { 'e12-ingresso': img }, chave: `e12:${rodada.numero}`, campanha: `e12-${rodada.numero}` }
}

// ─── E17 ────────────────────────────────────────────────────────────────────

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const SEMANA_E17B = ['Um domingo', 'Uma segunda', 'Uma terça', 'Uma quarta', 'Uma quinta', 'Uma sexta', 'Um sábado']
const MES_CURTO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

/**
 * E17B: 1 a 9 cartas. A mais valiosa nunca aparece; o trofeu 2 e a carta
 * aberta que mais subiu em 30 dias (so %), ou a de set mais antigo.
 */
async function montarE17B(ctx: Contexto, u: Usuario, col: Colecao): Promise<Montagem> {
  const valiosas = maisValiosas(col)
  const top = valiosas[0]
  if (!top) return 'sem_imagem'
  let subiu = false
  if (mediuVariacao(top)) {
    const entrada = ctx.historico.precoEm(top.cat!, top.criadoDia)
    subiu = entrada !== null && top.cat!.precoMin > entrada
  }
  // O primeiro dia (so cartas com imagem, para o trofeu ter o que mostrar).
  const comImagem = col.cartas.filter((x) => x.cat?.imagemGrande)
  const dia0 = comImagem.map((x) => x.criadoDia).sort()[0]
  const doDia = col.cartas.filter((x) => x.criadoDia === dia0)
  const versoNoDia = doDia.some((x) => (x.cardId || x.nome) === (top.cardId || top.nome))
  const abertasDia = valiosas.filter((x) => x !== top && x.criadoDia === dia0).map((x) => x.cat!.imagemGrande).slice(0, versoNoDia ? 3 : 4)
  const dataCurta = `${Number(dia0.slice(8, 10))} ${MES_CURTO[Number(dia0.slice(5, 7)) - 1]}`

  // Trofeu 2: a aberta que mais subiu em 30 dias; senao a de set mais antigo.
  const abertas = valiosas.slice(1)
  let segundo: SegundoTrofeuE17B | null = null
  let imgSegundo: ImgE17BAlta | null = null
  let melhor: { x: (typeof abertas)[number]; pct: number } | null = null
  for (const x of abertas) {
    if (!mediuVariacao(x)) continue
    const v = ctx.historico.variacao(x.cat, 30)
    if (!v || !(v.pct > 0) || v.pct > PCT_SUSPEITO) continue
    if (!melhor || v.pct > melhor.pct) melhor = { x, pct: v.pct }
  }
  if (melhor) {
    segundo = { tipo: 'alta', nome: melhor.x.nome, pct: r1(melhor.pct) }
    imgSegundo = { imagem: melhor.x.cat!.imagemGrande, etiqueta: `${r1(melhor.pct).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`, seta: true }
  } else {
    const antiga = abertas.filter((x) => x.cat?.lancamento).sort((p, q) => (p.cat!.lancamento! < q.cat!.lancamento! ? -1 : 1))[0]
    if (antiga) {
      const ano = antiga.cat!.lancamento!.slice(0, 4)
      segundo = { tipo: 'antiga', nome: antiga.nome, ano }
      imgSegundo = { imagem: antiga.cat!.imagemGrande, etiqueta: ano, seta: false }
    }
  }

  const dados: DadosE17B = {
    nome: u.nome,
    mesEntrada: mesPorExtenso(u.criadoDia),
    subiu,
    primeiroDia: {
      data: diaDeMes(dia0),
      diaSemana: SEMANA_E17B[new Date(`${dia0}T12:00:00Z`).getUTCDay()],
      cartas: doDia.reduce((s, x) => s + x.quantidade, 0),
    },
    segundo,
    umaCarta: valiosas.length === 1,
  }
  const hero: ImgE17BHero = { leque: abertas.slice(0, 3).map((x) => x.cat!.imagemGrande), subiu }
  const dia: ImgE17BDia = { abertas: abertasDia, verso: versoNoDia, data: dataCurta }
  const img: Record<string, unknown> = { 'e17b-hero': hero, 'e17b-trofeu-dia': dia }
  if (imgSegundo) img['e17b-trofeu-alta'] = imgSegundo
  return { dados, img, chave: 'e17:2026', campanha: 'e17b', template: 'E17B' }
}

async function montarE17(ctx: Contexto, u: Usuario, col: Colecao): Promise<Montagem> {
  if (col.total < 10) return montarE17B(ctx, u, col)
  const reps = repetidas(col).filter((r) => r.carta.cat?.imagemGrande)
  if (reps.length === 0) return 'sem_repetida'
  const ordem = [...col.cartas].sort((a, b) => (a.criadoDia < b.criadoDia ? -1 : a.criadoDia > b.criadoDia ? 1 : 0))
  const primeira = ordem.find((x) => x.cat?.imagemGrande)
  if (!primeira) return 'sem_imagem'
  const recentes = [...ordem].reverse().filter((x) => x.cat?.imagemGrande && x !== primeira).slice(0, 2).map((x) => x.cat!.imagemGrande)
  if (recentes.length === 0) return 'sem_imagem'

  const mesEntrada = u.criadoDia.slice(0, 7)
  const fimMes = `${mesEntrada}-31`
  const porMes = new Map<string, number>()
  for (const x of col.cartas) porMes.set(x.criadoDia.slice(0, 7), (porMes.get(x.criadoDia.slice(0, 7)) || 0) + x.quantidade)
  const [mesSalto, nSalto] = [...porMes.entries()].sort((a, b) => b[1] - a[1])[0]

  const valiosas = maisValiosas(col)
  const top = valiosas[0]
  let subiu = false
  if (top && mediuVariacao(top)) {
    const entrada = ctx.historico.precoEm(top.cat!, top.criadoDia)
    subiu = entrada !== null && top.cat!.precoMin > entrada
  }
  const dados: DadosE17 = {
    nome: u.nome,
    mesEntrada: mesPorExtenso(u.criadoDia),
    cartasFimMesEntrada: col.cartas.filter((x) => x.criadoDia <= fimMes).reduce((s, x) => s + x.quantidade, 0),
    cartasHoje: col.total,
    diferentes: col.diferentes,
    maiorSalto: { mes: cap(mesPorExtenso(`${mesSalto}-01`)), cartas: nSalto },
    valorFichario: col.valor,
    repetidas: {
      quantidade: reps.length,
      valor: r2(reps.reduce((s, r) => s + r.carta.valorUnit * (r.copias - 1), 0)),
      nomes: reps.slice(0, 3).map((r) => r.carta.nome),
    },
    primeira: { data: diaDeMes(primeira.criadoDia), nome: primeira.nome },
    maisValiosaSubiu: subiu,
  }
  const img = {
    'e17-stories': { cartasHoje: col.total, diferentes: col.diferentes, repetidas: { quantidade: dados.repetidas.quantidade, valor: dados.repetidas.valor } },
    'e17-trofeu-cartas': { primeira: primeira.cat!.imagemGrande, recentes },
    'e17-trofeu-fichario': { cartas: valiosas.slice(1, 8).map((x) => x.cat!.imagemGrande) },
    'e17-trofeu-repetidas': { repetidas: reps.slice(0, 3).map((r) => ({ imagem: r.carta.cat!.imagemGrande, copias: r.copias })) },
    'e17-trofeu-primeira': { imagem: primeira.cat!.imagemGrande, data: ddmm(primeira.criadoDia) },
  }
  return { dados, img, chave: 'e17:2026', campanha: 'e17' }
}

// ─── E18 ────────────────────────────────────────────────────────────────────

function validarE18(e: Record<string, unknown>): string | null {
  if (!eStr(e.dataOntem) || !eStr(e.dataHoje)) return 'edicao.dataOntem e edicao.dataHoje são obrigatórias'
  if (!Array.isArray(e.ofertas) || e.ofertas.length < 1) return 'edicao.ofertas precisa de ao menos 1 oferta'
  for (const o of e.ofertas) {
    if (!eObj(o) || !eStr(o.nome) || !eStr(o.slug) || !eStr(o.imagem) || !eNum(o.preco) || !eNum(o.menorOntem)) return 'cada oferta precisa de nome, rotulo, numero, detalhe, imagem, preco, menorOntem e slug'
    // So oferta de verdade: preco abaixo do menor preco da vespera.
    if (!(o.preco < o.menorOntem)) return `a oferta ${o.nome} não está abaixo do menor preço de ontem`
  }
  return null
}

/** card_id do anuncio de cada oferta (por slug do anuncio), para o bloco pessoal. */
async function cartasDasOfertas(ctx: Contexto, ofertas: OfertaE18[]): Promise<(CartaCatalogo | null)[]> {
  const { data, error } = await ctx.c.from('marketplace').select('slug, card_id').in('slug', ofertas.map((o) => o.slug))
  if (error) throw new Error(`[regua] ofertas E18: ${error.message}`)
  const porSlug = new Map(((data || []) as { slug: string; card_id: string | null }[]).map((r) => [r.slug, r.card_id]))
  const ids = ofertas.map((o) => porSlug.get(o.slug) ?? null)
  await carregarCatalogo(ctx.c, ctx.catalogo, ids.filter((x): x is string => !!x))
  return ids.map((id) => (id ? ctx.catalogo.get(id) ?? null : null))
}

async function montarE18(ctx: Contexto, u: Usuario, col: Colecao, edicao: Record<string, unknown>): Promise<Montagem> {
  const ofertas = edicao.ofertas as OfertaE18[]
  const cats = (edicao.__cats as (CartaCatalogo | null)[]) || []
  const olhos = (edicao.__olhos as Map<string, Set<string>>) || new Map()
  let pessoal: PessoalE18 = { tipo: 'colecao', nCartas: col.total }
  const minhas = (await metas(ctx)).filter((m) => m.user_id === u.id && !m.concluida_em)
  for (const m of minhas) {
    const nomes = ofertas.filter((_, i) => {
      const c = cats[i]
      return c && (m.tipo === 'set' ? c.setId === m.alvo : c.pokemons.includes(m.alvo))
    }).map((o) => o.nome)
    if (nomes.length) {
      pessoal = { tipo: 'meta', set: m.tipo === 'set' ? (cats.find((c) => c?.setId === m.alvo)?.set ?? m.alvo) : m.alvo, cartas: nomes, nenhumaDaMeta: (m.tenho ?? 0) === 0 }
      break
    }
  }
  if (pessoal.tipo === 'colecao') {
    const meus = olhos.get(u.id)
    const i = cats.findIndex((c) => c && meus?.has(c.id))
    if (i >= 0) pessoal = { tipo: 'acompanha', pokemon: cats[i]!.pokemons[0] || ofertas[i].nome, oferta: i }
  }
  const dados: DadosE18 = { nome: u.nome, dataOntem: edicao.dataOntem as string, dataHoje: edicao.dataHoje as string, ofertas, pessoal }
  const img: ImgE18 = {
    ofertas: ofertas.slice(0, 3).map((o) => ({
      imagem: o.imagem, nome: o.nome, numero: o.numero, selo: String(o.detalhe || '').split('·')[0].trim(), preco: o.preco, menorOntem: o.menorOntem,
    })),
  }
  const id = String(edicao.dataHoje).replace(/[^0-9a-z]+/gi, '-').toLowerCase()
  return { dados, img: { 'e18-remarcadas': img }, chave: `e18:${id}`, campanha: 'e18' }
}

// ─── E19 ────────────────────────────────────────────────────────────────────

async function montarE19(ctx: Contexto, _u: Usuario, col: Colecao): Promise<Montagem> {
  const carta = maisValiosas(col).find((x) => !x.graduada && x.valorUnit > 0)
  if (!carta) return 'sem_carta_nao_graduada'
  let alta: DadosE19['alta'] = null
  if (mediuVariacao(carta)) {
    const v7 = ctx.historico.variacao(carta.cat, 7)
    const v30 = ctx.historico.variacao(carta.cat, 30)
    const ha3 = ctx.historico.precoEm(carta.cat!, somarDias(ctx.hoje, -3))
    // Regra do meta.json: positiva em 7 dias, nao caindo de novo, nao e pico isolado.
    if (v7 && v7.delta >= 10 && v7.pct <= PCT_SUSPEITO && ha3 !== null && carta.cat!.precoMin >= ha3 && v30 && v30.pct > 0) {
      alta = { valor: r2(v7.delta), dias: 7 }
    }
  }
  const dados: DadosE19 = { carta: { nome: carta.nome, set: carta.cat!.set }, preco: carta.valorUnit, alta }
  const img: ImgE19 = { carta: { nome: carta.nome, imagem: carta.cat!.imagemGrande } }
  return { dados, img: { 'e19-bancada': img }, chave: 'e19', campanha: 'e19' }
}

// ─── definicoes ─────────────────────────────────────────────────────────────

const DEFS: Record<IdEditorial, Def> = {
  E01: {
    categoria: 'novidades',
    // 0 cartas tambem entra: recebe o E01B (montarE01).
    noSegmento: (ctx, u, _col, o) => u.criadoDia <= '2026-08-31' && (!o || onda(ctx, u) === o),
    dedup: () => ({ templates: ['E01', 'E01B', 'E11'], janelaDias: 365 }),
    validar: () => null,
    montar: (ctx, u, col) => montarE01(ctx, u, col),
  },
  E10: {
    categoria: 'radar',
    noSegmento: () => true,
    dedup: (e) => ({ chave: `radar:${e.numero}` }),
    validar: validarE10,
    montar: montarE10,
  },
  E11: {
    categoria: 'novidades',
    noSegmento: (ctx, u, _col, o) => u.criadoDia >= '2026-09-01' && (!o || onda(ctx, u) === o),
    dedup: () => ({ templates: ['E01', 'E01B', 'E11'], janelaDias: 30 }),
    validar: () => null,
    montar: montarE11,
  },
  E12: {
    categoria: 'novidades',
    noSegmento: () => true,
    dedup: (e) => ({ chave: `e12:${(e.rodada as { numero?: string } | undefined)?.numero}` }),
    validar: validarE12,
    montar: montarE12,
  },
  E17: {
    categoria: 'colecao',
    // 1 a 9 cartas recebe o E17B (montarE17); 0 cartas nao recebe.
    noSegmento: (_ctx, _u, col) => col.total >= 1,
    dedup: () => ({ templates: ['E17', 'E17B'], chave: 'e17:2026' }),
    validar: () => null,
    montar: (ctx, u, col) => montarE17(ctx, u, col),
  },
  E18: {
    categoria: 'mercado',
    noSegmento: () => true,
    dedup: (e) => ({ chave: `e18:${String(e.dataHoje).replace(/[^0-9a-z]+/gi, '-').toLowerCase()}` }),
    validar: validarE18,
    montar: montarE18,
  },
  E19: {
    categoria: 'novidades',
    noSegmento: (_ctx, _u, col) => col.cartas.some((x) => x.graduada) || col.cartas.some((x) => !x.graduada && x.valorUnit >= 300),
    dedup: () => ({ chave: 'e19' }),
    validar: () => null,
    montar: (ctx, u, col) => montarE19(ctx, u, col),
  },
}

/**
 * Edicao de partida no admin: o que muda por disparo, tirado do exemplo do
 * proprio template (o Du edita antes de simular). E01, E17 e E19 nao tem
 * edicao (e tudo da pessoa); o E11 calcula o preco da Mew ex do dia.
 */
export function edicaoExemplo(id: string): Record<string, unknown> {
  const ex = REGUA[id]?.exemplo as Record<string, unknown> | undefined
  if (!ex) return {}
  if (id === 'E10') return { ...(ex.edicao as Record<string, unknown>) }
  if (id === 'E12') return { prazoVoto: ex.prazoVoto, rodada: ex.rodada, cartas: ex.cartas }
  if (id === 'E18') return { dataOntem: ex.dataOntem, dataHoje: ex.dataHoje, ofertas: ex.ofertas }
  if (id === 'E11') return { id: 'o-que-chegou' }
  return {}
}

export function ehEditorial(id: string): id is IdEditorial {
  return (EDITORIAIS as readonly string[]).includes(id)
}

// ─── disparo ────────────────────────────────────────────────────────────────

export type ResultadoDisparo = {
  template: string
  acao: 'simular' | 'enviar'
  modo: 'real' | 'simulacao'
  noSegmento: number
  elegiveis: number
  motivos: Record<string, number>
  incompleto: boolean
  envio: ResultadoEnvio | null
  /** Ate 3 assuntos montados de verdade (simular). */
  amostra: { email: string; assunto: string }[]
  bloqueio: string | null
}

export class ErroDisparo extends Error {}

export async function dispararEditorial(args: {
  template: string
  edicao: Record<string, unknown>
  publico: Publico
  acao: 'simular' | 'enviar'
  /** Contexto pronto (teste offline); sem ele, le o banco. */
  ctx?: Contexto
}): Promise<ResultadoDisparo> {
  if (!ehEditorial(args.template)) throw new ErroDisparo(`${args.template} não é editorial`)
  const def = DEFS[args.template]
  const erro = def.validar(args.edicao)
  if (erro) throw new ErroDisparo(erro)

  const ctx = args.ctx ?? await criarContexto()
  const bloqueio = BLOQUEIO_ENVIO[args.template] ?? null
  if (args.acao === 'enviar') {
    if (ctx.modo !== 'real') throw new ErroDisparo('A régua está desligada (REGUA_ATIVA diferente de 1): só simulação.')
    if (bloqueio) throw new ErroDisparo(`Envio bloqueado: ${bloqueio}`)
  }

  const a: Avaliacao = novaAvaliacao(args.template)
  const cols = await colecoes(ctx)
  const teste = args.publico.tipo === 'emails'
  let pessoas: Usuario[]
  if (args.publico.tipo === 'emails') {
    const alvo = new Set(args.publico.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))
    if (alvo.size === 0 || alvo.size > 20) throw new ErroDisparo('Lista de teste: de 1 a 20 e-mails.')
    pessoas = [...ctx.usuarios.values()].filter((u) => alvo.has(u.email.toLowerCase()))
  } else {
    const o = args.publico.onda
    pessoas = [...ctx.usuarios.values()].filter((u) => def.noSegmento(ctx, u, cols.get(u.id) ?? { cartas: [], total: 0, diferentes: 0, valor: 0 }, o))
  }
  await prepararHistorico(ctx, pessoas.map((u) => cols.get(u.id)).filter((c): c is Colecao => !!c))

  const edicao: Record<string, unknown> = { ...args.edicao }
  if (args.template === 'E18') {
    edicao.__cats = await cartasDasOfertas(ctx, args.edicao.ofertas as OfertaE18[])
    const { data } = await ctx.c.from('watchlist').select('user_id, card_id').limit(10000)
    const olhos = new Map<string, Set<string>>()
    for (const r of (data || []) as { user_id: string; card_id: string }[]) {
      const s = olhos.get(r.user_id) || new Set<string>()
      s.add(r.card_id)
      olhos.set(r.user_id, s)
    }
    edicao.__olhos = olhos
  }

  for (const u of pessoas) {
    if (semTempo(ctx)) { a.incompleto = true; break }
    a.noGatilho++
    const ok = teste
      ? passaNasRegras(ctx, a, u, def.categoria, null, { ignorarTeste: true, semTeto: true })
      : passaNasRegras(ctx, a, u, def.categoria, def.dedup(args.edicao))
    if (!ok) continue
    const col = cols.get(u.id) ?? { cartas: [], total: 0, diferentes: 0, valor: 0 }
    const m = await def.montar(ctx, u, col, edicao)
    if (typeof m === 'string') { pular(a, m); continue }
    a.cands.push({ usuario: u, template: m.template ?? args.template, campanha: m.campanha, chave: m.chave, dados: m.dados, img: m.img, teste } as Candidato)
  }

  const amostra: ResultadoDisparo['amostra'] = []
  for (const c of a.cands.slice(0, 3)) {
    try {
      const mm = REGUA[c.template].montar(c.dados, { links: null, promocoes: [], tokenImagem: null })
      amostra.push({ email: c.usuario.email, assunto: mm.assunto })
    } catch (e) {
      amostra.push({ email: c.usuario.email, assunto: `ERRO ao montar: ${(e as Error)?.message}` })
    }
  }

  const envio = args.acao === 'enviar' && a.cands.length ? await enviarCandidatos(ctx, a.cands) : null
  return {
    template: args.template, acao: args.acao, modo: ctx.modo,
    noSegmento: a.noGatilho, elegiveis: a.cands.length, motivos: a.motivos,
    incompleto: !!a.incompleto, envio, amostra, bloqueio,
  }
}
