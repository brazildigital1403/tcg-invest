/**
 * Gatilhos de EVENTO da regua (rodam no /api/cron-regua) e os builders de
 * dados de cada um. Cada `avaliarEXX` devolve quem entrou no gatilho, quem
 * saiu (por motivo) e os candidatos com o `DadosEXX` do template e o `meta.img`
 * que a rota de imagem precisa (formato ImgEXX do topo de src/lib/regua/img/eXX.tsx).
 *
 * Gatilhos (estrategia.md / BRIEFS.md):
 * - E02 D0: cadastro nas ultimas 48h (rede de seguranca do envio na hora, ver
 *   `enviarE02Agora`). Uma vez.
 * - E03 D1: cadastro entre 24h e 48h atras; 0 a 4 cartas (a variante B, 5 a 9,
 *   nao foi desenhada; 10+ sai do fluxo). Uma vez.
 * - E04 D3: cadastro entre 72h e 96h atras, sem meta. Uma vez.
 * - E05: trial acaba entre 12h e 36h a partir do tick (o "1 dia antes"), sem
 *   assinatura. Uma vez. Sem dado para montar = o aviso antigo (D-1) sai no lugar.
 * - E06: sexta quinzenal, 5+ cartas, caso "uma carta salvou a semana".
 * - E07: meta com faltam <= 3 (ou 90%+ com ate 9 faltando) e 1+ a venda. Uma vez por meta.
 * - E08: digest diario, limiar 15% E R$ 10 em 7 dias; 1/dia, 3/semana; carta
 *   nao repete aviso em 7 dias.
 * - E09: anuncio novo (ultimas 26h) com compra no site, abaixo do menor preco da
 *   MESMA carta, de set em que a pessoa tem carta e sem esta carta. 1 vez por
 *   carta por pessoa; 1/dia, 2/semana.
 * - E15: winback em 3 toques nas datas do calendario; quem clica sai.
 * - E16: sunset, so com 60 dias de log e 60 dias sem clique.
 * - E20: 10+ cartas, nenhum anuncio, 1+ repetida; a cada 30 dias.
 */
import { sendTrialExpiring7Email, sendWelcomeEmail } from '@/lib/email'
import { PLAN_PRECOS } from '@/lib/plan'
import { comissaoVendedorCents, normalizarPrazo } from '@/lib/comissao'
import { podeReceber, resolverRecebedor } from '@/lib/vendedorRecebimento'
import type { DadosE02 } from '@/lib/regua/templates/E02'
import type { CartaGavetaE03, DadosE03 } from '@/lib/regua/templates/E03'
import type { DadosE04 } from '@/lib/regua/templates/E04'
import type { DadosE05 } from '@/lib/regua/templates/E05'
import type { DadosE06, MovimentoE06 } from '@/lib/regua/templates/E06'
import type { CartaFaltaE07, DadosE07 } from '@/lib/regua/templates/E07'
import type { CartaPlacarE08, DadosE08 } from '@/lib/regua/templates/E08'
import type { DadosE09 } from '@/lib/regua/templates/E09'
import type { CartaVariacaoE15, DadosE15 } from '@/lib/regua/templates/E15'
import type { DadosE16 } from '@/lib/regua/templates/E16'
import type { DadosE20, GanchoE20 } from '@/lib/regua/templates/E20'
import { E03 } from '@/lib/regua/templates/E03'
import { REGUA } from '@/lib/regua/registro'
import type { ImgE04 } from '@/lib/regua/img/e04'
import type { ImgE05 } from '@/lib/regua/img/e05'
import type { ImgE06 } from '@/lib/regua/img/e06'
import type { BolsoE07, ImgE07 } from '@/lib/regua/img/e07'
import type { ImgE08 } from '@/lib/regua/img/e08'
import type { ImgE09 } from '@/lib/regua/img/e09'
import type { ImgE15 } from '@/lib/regua/img/e15'
import type { ImgE16 } from '@/lib/regua/img/e16'
import type { ImgE20 } from '@/lib/regua/img/e20'
import {
  E06_INTERVALO_DIAS, E06_PRIMEIRA, E08_LIMIAR, E08_MAX_DIA, E08_MAX_SEMANA, E09_MAX_DIA, E09_MAX_SEMANA,
  E15_TOQUES, INICIO, PCT_SUSPEITO, e02Substitui,
} from './config'
import {
  carregarCatalogo, cartasDoAlvo, donosDeAnuncioAtivo, ordemDoSet,
  type Anuncio, type CartaCatalogo, type CartaPessoa, type Colecao, type Usuario,
} from './banco'
import {
  anunciosAtivos, colecaoDe, colecoes, criarContexto, lojaDe, metas, prepararHistorico, semTempo, type Contexto,
} from './contexto'
import {
  maisValiosas, mediuVariacao, mexidas, nomeCurto, nomeIdioma, numeroCarta, numeroComTotal, r1, r2, repetidas,
  type Mexida,
} from './analise'
import { novaAvaliacao, passaNasRegras, pular, type Avaliacao } from './avaliacao'
import { enviarCandidatos, type ResultadoEnvio } from './envio'
import { contarHoje, contarNaJanela, enviosQueContam, jaRecebeu } from './regras'
import { DIA_MS, ddmm, diaBR, diasEntre, horaBR, porExtensoComHora, somarDias } from './tempo'

const H = 3_600_000

// ─── auxiliares ─────────────────────────────────────────────────────────────

/** Gatilho de evento aberto hoje? (`forcar` ignora o calendario, so na simulacao.) */
function aberto(ctx: Contexto, template: string): string | null {
  if (ctx.forcar) return null
  const ini = INICIO[template]
  if (ini && ctx.hoje < ini) return `abre_em_${ini}`
  return null
}

function usuariosAtivos(ctx: Contexto): Usuario[] {
  return [...ctx.usuarios.values()]
}

/** Trial em curso e sem assinatura valida. */
function emTrial(u: Usuario, agoraMs: number): boolean {
  if (!u.trialExpira) return false
  if (Date.parse(u.trialExpira) <= agoraMs) return false
  const pagoValido = (p: string | null) => !!p && ['plus', 'pro', 'mensal', 'pro_anual', 'anual'].includes(p)
  const proValido = !u.proExpira || Date.parse(u.proExpira) > agoraMs
  return !((u.isPro || pagoValido(u.plano)) && proValido)
}

/** Fotos de Scan IA livres no trial (mesma conta de scan_cota_mensal/get_scan_status: trial = 10). */
const COTA_TRIAL = 10
function fotosLivresTrial(u: Usuario, agoraMs: number): number {
  const resetou = !u.scanReset || agoraMs >= Date.parse(u.scanReset)
  const usados = resetou ? 0 : u.scanUsados
  return Math.max(0, COTA_TRIAL - usados) + u.scanCreditos
}

/** Anuncio mais barato de cada carta (sem o da propria pessoa). */
function anuncioMaisBarato(anuncios: Anuncio[], cardId: string, excetoUser?: string): Anuncio | null {
  let melhor: Anuncio | null = null
  for (const a of anuncios) {
    if (a.cardId !== cardId || a.userId === excetoUser || !(a.preco > 0)) continue
    if (!melhor || a.preco < melhor.preco) melhor = a
  }
  return melhor
}

function origemAnuncio(loja: { nome: string } | null): string {
  return loja ? 'anúncio de loja' : 'anúncio de colecionador'
}

// ─── E02 · D0 boas-vindas ───────────────────────────────────────────────────

function dadosE02(u: Usuario, agoraMs: number): DadosE02 | null {
  if (!u.trialExpira || Date.parse(u.trialExpira) <= agoraMs) return null
  const dias = Math.max(1, Math.round((Date.parse(u.trialExpira) - u.criadoMs) / DIA_MS)) || 7
  return {
    nome: u.nome,
    fotosTotal: COTA_TRIAL,
    fotosLivres: fotosLivresTrial(u, agoraMs),
    fimTeste: ddmm(diaBR(new Date(u.trialExpira))),
    diasTeste: dias,
  }
}

export async function avaliarE02(ctx: Contexto): Promise<Avaliacao> {
  const a = novaAvaliacao('E02')
  const f = aberto(ctx, 'E02')
  if (f) { a.fechado = f; return a }
  for (const u of usuariosAtivos(ctx)) {
    if (u.criadoMs < ctx.agoraMs - 48 * H) continue
    a.noGatilho++
    // O welcome antigo pode ter saido antes da chave virar: nao manda os dois.
    if (!passaNasRegras(ctx, a, u, 'colecao', { templates: ['E02', 'welcome'] })) continue
    const d = dadosE02(u, ctx.agoraMs)
    if (!d) { pular(a, 'sem_trial'); continue }
    a.cands.push({ usuario: u, template: 'E02', campanha: 'e02', chave: 'e02', dados: d, img: null })
  }
  return a
}

/**
 * Chamado pelo /api/email/welcome no cadastro. Com a substituicao ligada,
 * manda o E02 na hora (pelo mesmo pipeline, com log e dedup); sem dado de
 * trial, cai no welcome antigo para ninguem ficar sem boas-vindas.
 * Devolve false quando a regua nao assume (chave desligada): o chamador
 * segue com o welcome antigo.
 */
export async function enviarE02Agora(userId: string): Promise<boolean> {
  const hoje = diaBR()
  if (!e02Substitui(hoje)) return false
  const ctx = await criarContexto({ so: [userId] })
  const u = ctx.usuarios.get(userId)
  if (!u) return false
  const a = novaAvaliacao('E02')
  if (!passaNasRegras(ctx, a, u, 'colecao', { templates: ['E02', 'welcome'] }, { ignorarTeste: true })) {
    console.log(`[regua] E02 nao sai para ${userId}: ${Object.keys(a.motivos).join(',')}`)
    return true
  }
  const d = dadosE02(u, ctx.agoraMs)
  if (!d) {
    await sendWelcomeEmail(u.email, u.nome)
    return true
  }
  await enviarCandidatos(ctx, [{ usuario: u, template: 'E02', campanha: 'e02', chave: 'e02', dados: d, img: null }])
  return true
}

// ─── E03 · D1 a gaveta ──────────────────────────────────────────────────────

export async function avaliarE03(ctx: Contexto): Promise<Avaliacao> {
  const a = novaAvaliacao('E03')
  const f = aberto(ctx, 'E03')
  if (f) { a.fechado = f; return a }
  const alvo = usuariosAtivos(ctx).filter((u) => u.criadoMs <= ctx.agoraMs - 24 * H && u.criadoMs > ctx.agoraMs - 48 * H)
  if (alvo.length === 0) return a
  // Precos do dia das cartas fixas da gaveta (por PK) e a alta de 30 dias.
  const base = E03.exemplo.cartas
  await carregarCatalogo(ctx.c, ctx.catalogo, base.map((c) => c.slug))
  await ctx.historico.carregar(ctx.c, base.map((c) => c.slug))
  const cartas: CartaGavetaE03[] = []
  for (const c of base) {
    const cat = ctx.catalogo.get(c.slug)
    if (!cat || !(cat.precoMin > 0)) continue
    const v = ctx.historico.variacao(cat, 30)
    // A alta do exemplo nao vale: so a medida hoje.
    const carta: CartaGavetaE03 = { nome: c.nome, set: c.set, ano: c.ano, slug: c.slug, miniatura: c.miniatura, preco: cat.precoMin, ...(c.comum ? { comum: true } : {}) }
    // Alta de 30 dias so quando medida e dentro da curva; senao a linha sai sem ela.
    if (v && v.pct >= 10 && v.pct <= PCT_SUSPEITO) carta.alta30d = r1(v.pct)
    cartas.push(carta)
  }
  for (const u of alvo) {
    a.noGatilho++
    const col = await colecaoDe(ctx, u.id)
    if (col.total >= 10) { pular(a, 'sai_10_ou_mais_cartas'); continue }
    if (col.total >= 5) { pular(a, 'variante_b_5_a_9_sem_template'); continue }
    if (!passaNasRegras(ctx, a, u, REGUA.E03.categoria, {})) continue
    if (cartas.length < base.length) { pular(a, 'preco_da_gaveta_indisponivel'); continue }
    const d: DadosE03 = {
      cartas,
      dataPreco: ddmm(ctx.hoje),
      fimTeste: emTrial(u, ctx.agoraMs) && u.trialExpira ? porExtensoComHora(u.trialExpira) : null,
    }
    a.cands.push({ usuario: u, template: 'E03', campanha: 'e03', chave: 'e03', dados: d, img: null })
  }
  return a
}

// ─── E04 · D3 primeira meta ─────────────────────────────────────────────────

async function dadosE04(ctx: Contexto, u: Usuario, col: Colecao): Promise<{ d: DadosE04; img: ImgE04 } | string> {
  const porSet = new Map<string, CartaPessoa[]>()
  for (const x of col.cartas) {
    if (!x.cat?.setId) continue
    const l = porSet.get(x.cat.setId) || []
    l.push(x)
    porSet.set(x.cat.setId, l)
  }
  if (porSet.size === 0) return 'sem_cartas_variante_0_sem_template'
  await prepararHistorico(ctx, [col])
  const sets = [...porSet.entries()].sort((x, y) => y[1].length - x[1].length).slice(0, 3)
  for (const [setId, minhas] of sets) {
    let destaque: { x: CartaPessoa; pct: number } | null = null
    for (const x of minhas) {
      if (!mediuVariacao(x) || !x.cat?.imagemGrande) continue
      const v = ctx.historico.variacao(x.cat, 7)
      if (!v || v.pct < 5 || v.pct > PCT_SUSPEITO) continue
      if (!destaque || v.pct > destaque.pct) destaque = { x, pct: v.pct }
    }
    if (!destaque) continue
    const doSet = await cartasDoAlvo(ctx.c, ctx.catalogo, { tipo: 'set', valor: setId })
    const tenho = new Set(minhas.map((x) => x.cardId))
    const falta = doSet.filter((c) => !tenho.has(c.id) && c.imagemGrande).sort((p, q) => q.precoMin - p.precoMin)[0]
    if (!falta) continue
    const nomes = [...new Set([...minhas].sort((p, q) => q.valorUnit - p.valorUnit).map((x) => x.nome))]
    const outra = minhas.find((x) => x.cardId !== destaque!.x.cardId && x.cat?.imagemGrande)
    const setNome = destaque.x.cat!.set
    const d: DadosE04 = {
      nome: u.nome,
      set: setNome,
      tem: nomes,
      valorNoSet: r2(minhas.reduce((s, x) => s + x.valorUnit * x.quantidade, 0)),
      destaque: { nome: destaque.x.nome, pct: r1(destaque.pct), preco: destaque.x.cat!.precoMin },
      falta: { nome: falta.nome },
    }
    const img: ImgE04 = {
      set: setNome,
      tem: nomes.length,
      destaque: { imagem: destaque.x.cat!.imagemGrande, pct: r1(destaque.pct), preco: destaque.x.cat!.precoMin },
      outra: outra ? { imagem: outra.cat!.imagemGrande } : null,
      falta: { nome: falta.nome, imagem: falta.imagemGrande },
    }
    return { d, img }
  }
  return 'sem_carta_em_alta_no_set'
}

export async function avaliarE04(ctx: Contexto): Promise<Avaliacao> {
  const a = novaAvaliacao('E04')
  const f = aberto(ctx, 'E04')
  if (f) { a.fechado = f; return a }
  const alvo = usuariosAtivos(ctx).filter((u) => u.criadoMs <= ctx.agoraMs - 72 * H && u.criadoMs > ctx.agoraMs - 96 * H)
  if (alvo.length === 0) return a
  const comMeta = new Set((await metas(ctx)).map((m) => m.user_id))
  for (const u of alvo) {
    if (semTempo(ctx)) { a.incompleto = true; break }
    a.noGatilho++
    if (comMeta.has(u.id)) { pular(a, 'ja_tem_meta'); continue }
    if (!passaNasRegras(ctx, a, u, REGUA.E04.categoria, {})) continue
    const r = await dadosE04(ctx, u, await colecaoDe(ctx, u.id))
    if (typeof r === 'string') { pular(a, r); continue }
    a.cands.push({ usuario: u, template: 'E04', campanha: 'e04', chave: 'e04', dados: r.d, img: { 'e04-proxima': r.img } })
  }
  return a
}

// ─── E05 · fim do trial ─────────────────────────────────────────────────────

async function dadosE05(ctx: Contexto, u: Usuario, col: Colecao): Promise<{ d: DadosE05; img: ImgE05 } | string> {
  const fotos = fotosLivresTrial(u, ctx.agoraMs)
  if (fotos < 1) return 'sem_foto_livre'
  if (col.total === 0) return 'sem_cartas'
  await prepararHistorico(ctx, [col])
  let melhor: { x: CartaPessoa; entrada: number; pct: number } | null = null
  for (const x of col.cartas) {
    if (!mediuVariacao(x) || !x.cat?.imagemGrande) continue
    const entrada = ctx.historico.precoEm(x.cat, x.criadoDia)
    if (!entrada || !(entrada > 0) || !(x.cat.precoMin > entrada)) continue
    const pct = ((x.cat.precoMin - entrada) / entrada) * 100
    if (pct > PCT_SUSPEITO) continue
    if (!melhor || pct > melhor.pct) melhor = { x, entrada, pct }
  }
  if (!melhor) return 'sem_carta_que_subiu'
  const saldo = mexidas(ctx, col, 7).reduce((s, m) => s + m.naColecao, 0)
  const baseValor = col.valor - saldo
  const leque = maisValiosas(col).filter((x) => x.cardId !== melhor!.x.cardId).slice(0, 3).map((x) => x.cat!.imagemGrande)
  const diaTeste = Math.min(7, Math.max(1, Math.floor((ctx.agoraMs - u.criadoMs) / DIA_MS) + 1))
  const d: DadosE05 = {
    nome: u.nome,
    horaFim: horaBR(u.trialExpira!),
    diaTeste,
    fotosRestantes: fotos,
    totalCartas: col.total,
    valorColecao: col.valor,
    pct7d: baseValor > 0 ? Math.round((saldo / baseValor) * 10000) / 100 : 0,
    destaque: { nome: melhor.x.nome, precoEntrada: melhor.entrada, precoAgora: melhor.x.cat!.precoMin, pct: r1(melhor.pct) },
    plus: { scans: 100, preco: PLAN_PRECOS.plus.mensal },
  }
  return { d, img: { destaque: { imagem: melhor.x.cat!.imagemGrande, pct: r1(melhor.pct) }, leque } }
}

/** E05 que nao deu para montar: o aviso antigo de ultimo dia sai no lugar (so no real). */
export type FallbackE05 = { usuario: Usuario; motivo: string }

export async function avaliarE05(ctx: Contexto): Promise<Avaliacao & { fallback: FallbackE05[] }> {
  const a = { ...novaAvaliacao('E05'), fallback: [] as FallbackE05[] }
  const f = aberto(ctx, 'E05')
  if (f) { a.fechado = f; return a }
  for (const u of usuariosAtivos(ctx)) {
    if (!u.trialExpira || !emTrial(u, ctx.agoraMs)) continue
    const fim = Date.parse(u.trialExpira)
    if (fim <= ctx.agoraMs + 12 * H || fim > ctx.agoraMs + 36 * H) continue
    if (semTempo(ctx)) { a.incompleto = true; break }
    a.noGatilho++
    if (!passaNasRegras(ctx, a, u, 'colecao', { templates: ['E05', 'trial-expiring1'], janelaDias: 10 })) continue
    const r = await dadosE05(ctx, u, await colecaoDe(ctx, u.id))
    if (typeof r === 'string') {
      pular(a, `aviso_antigo_no_lugar:${r}`)
      a.fallback.push({ usuario: u, motivo: r })
      continue
    }
    a.cands.push({ usuario: u, template: 'E05', campanha: 'e05', chave: 'e05', dados: r.d, img: { 'e05-trial': r.img } })
  }
  return a
}

export async function enviarFallbackE05(ctx: Contexto, fb: FallbackE05[]): Promise<number> {
  if (ctx.modo !== 'real') return 0
  let n = 0
  for (const x of fb) {
    await sendTrialExpiring7Email(x.usuario.email, x.usuario.nome).catch((e) => console.error('[regua] E05 fallback', e?.message))
    n++
  }
  return n
}

// ─── E06 · resumo quinzenal ─────────────────────────────────────────────────

function diaDeE06(ctx: Contexto): boolean {
  if (ctx.forcar) return true
  const d = diasEntre(E06_PRIMEIRA, ctx.hoje)
  return d >= 0 && d % E06_INTERVALO_DIAS === 0
}

async function achadoDaMeta(ctx: Contexto, u: Usuario, col: Colecao): Promise<DadosE06['achadoMeta']> {
  const minhas = (await metas(ctx)).filter((m) => m.user_id === u.id && !m.concluida_em)
  if (minhas.length === 0) return null
  const anuncios = await anunciosAtivos(ctx)
  await carregarCatalogo(ctx.c, ctx.catalogo, anuncios.map((x) => x.cardId))
  const tenho = new Set(col.cartas.map((x) => x.cardId).filter(Boolean))
  let melhor: { a: Anuncio; cat: CartaCatalogo; m: (typeof minhas)[number] } | null = null
  for (const m of minhas) {
    for (const an of anuncios) {
      const cat = ctx.catalogo.get(an.cardId)
      if (!cat || tenho.has(cat.id) || an.userId === u.id || !cat.imagem) continue
      const daMeta = m.tipo === 'set' ? cat.setId === m.alvo : cat.pokemons.includes(m.alvo) && (!m.regiao || cat.regiao === m.regiao)
      if (!daMeta) continue
      if (!melhor || an.preco < melhor.a.preco) melhor = { a: an, cat, m }
    }
  }
  if (!melhor || !melhor.a.slug) return null
  const loja = await lojaDe(ctx, melhor.a.userId)
  const tem = (melhor.m.tenho ?? 0) + 1
  return {
    carta: melhor.cat.nome,
    numero: numeroComTotal(melhor.cat.numero, melhor.cat.setTotal),
    preco: melhor.a.preco,
    descricao: `${melhor.a.condicao || 'NM'}, em ${nomeIdioma(melhor.a.idioma)}, ${loja ? 'em uma loja da Bynx' : 'de um colecionador da Bynx'}`,
    imagem: melhor.a.imagemVendedor || melhor.cat.imagem,
    metaId: melhor.m.id,
    metaNome: melhor.m.tipo === 'set' ? melhor.cat.set : melhor.m.alvo,
    comEla: tem,
    totalMeta: melhor.m.total ?? tem,
  }
}

async function dadosE06(ctx: Contexto, u: Usuario, col: Colecao): Promise<{ d: DadosE06; img: ImgE06 } | string> {
  await prepararHistorico(ctx, [col])
  const ms = mexidas(ctx, col, 7).filter((m) => Math.abs(m.naColecao) >= 1)
  if (ms.length === 0) return 'nada_mexeu'
  const heroi = [...ms].sort((p, q) => q.naColecao - p.naColecao)[0]
  const saldo = ms.reduce((s, m) => s + m.naColecao, 0)
  // So o caso desenhado: "uma carta salvou a semana" (o caso comum nao tem template).
  if (!(heroi.naColecao > 0) || !(saldo - heroi.naColecao < 0) || !(saldo >= 0)) return 'caso_comum_sem_template'
  if (!heroi.carta.cat?.imagemGrande) return 'heroi_sem_imagem'

  const inicio = somarDias(ctx.hoje, -7)
  // Serie dos 8 dias com a MESMA conta do texto: valor de hoje menos o que
  // cada carta que mexeu ainda ia mexer depois daquele dia.
  const valorEm = (dia: string) => r2(col.valor - ms.reduce((s, m) => {
    const p = ctx.historico.precoEm(m.carta.cat!, dia) ?? m.antes
    return s + (m.agora - p) * m.copias
  }, 0))
  const dias = Array.from({ length: 8 }, (_, i) => somarDias(inicio, i))
  const valores = dias.map((d, i) => (i === 7 ? col.valor : valorEm(d)))
  let corte = 7
  for (let i = 1; i <= 7; i++) {
    const p0 = ctx.historico.precoEm(heroi.carta.cat!, dias[i - 1]) ?? heroi.antes
    const p1 = ctx.historico.precoEm(heroi.carta.cat!, dias[i]) ?? heroi.agora
    if (p1 > p0) { corte = i; break }
  }
  const movimentos: MovimentoE06[] = [heroi, ...ms.filter((m) => m !== heroi).sort((p, q) => Math.abs(q.naColecao) - Math.abs(p.naColecao))]
    .map((m) => ({ nome: m.carta.nome, set: m.carta.cat!.set, slug: m.carta.cat!.slug, variacao: m.naColecao }))
  const copias = heroi.copias
  const d: DadosE06 = {
    nome: u.nome,
    periodo: { inicio: ddmm(inicio), fim: ddmm(ctx.hoje) },
    totalCartas: col.total,
    valorInicio: r2(col.valor - saldo),
    valorHoje: col.valor,
    heroi: { nome: heroi.carta.nome, set: heroi.carta.cat!.set, slug: heroi.carta.cat!.slug, curto: nomeCurto(heroi.carta.nome) },
    movimentos,
    achadoMeta: await achadoDaMeta(ctx, u, col),
    notaColecionador: `O ${heroi.carta.nome} do ${heroi.carta.cat!.set} foi de ${brlTxt(heroi.antes)} para ${brlTxt(heroi.agora)} em 7 dias, pelo menor preço do Mercado Brasileiro. ${copias > 1 ? `Você tem ${copias} cópias dele.` : 'Você tem uma cópia dele.'}`,
  }
  const img: ImgE06 = {
    dia: ddmm(ctx.hoje),
    inicio: ddmm(inicio),
    valores,
    corte,
    semEle: r2(col.valor - heroi.naColecao),
    heroi: { nome: heroi.carta.nome, imagem: heroi.carta.cat!.imagemGrande },
  }
  return { d, img }
}

function brlTxt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ')
}

export async function avaliarE06(ctx: Contexto): Promise<Avaliacao> {
  const a = novaAvaliacao('E06')
  if (!diaDeE06(ctx)) { a.fechado = `quinzenal_a_partir_de_${E06_PRIMEIRA}`; return a }
  const cols = await colecoes(ctx)
  const alvo = usuariosAtivos(ctx).filter((u) => (cols.get(u.id)?.total ?? 0) >= 5)
  await prepararHistorico(ctx, alvo.map((u) => cols.get(u.id)!))
  for (const u of alvo) {
    if (semTempo(ctx)) { a.incompleto = true; break }
    a.noGatilho++
    if (!passaNasRegras(ctx, a, u, 'colecao', { chave: `e06:${ctx.hoje}`, janelaDias: 10 })) continue
    const r = await dadosE06(ctx, u, cols.get(u.id)!)
    if (typeof r === 'string') { pular(a, r); continue }
    a.cands.push({ usuario: u, template: 'E06', campanha: 'e06', chave: `e06:${ctx.hoje}`, dados: r.d, img: { 'e06-grafico': r.img } })
  }
  return a
}

// ─── E07 · faltam poucas para fechar a meta ─────────────────────────────────

export async function avaliarE07(ctx: Contexto): Promise<Avaliacao> {
  const a = novaAvaliacao('E07')
  const f = aberto(ctx, 'E07')
  if (f) { a.fechado = f; return a }
  const lista = (await metas(ctx)).filter((m) => !m.concluida_em)
  const anuncios = await anunciosAtivos(ctx)
  const porAlvo = new Map<string, CartaCatalogo[]>()
  for (const m of lista) {
    if (semTempo(ctx)) { a.incompleto = true; break }
    const u = ctx.usuarios.get(m.user_id)
    if (!u) continue
    const col = await colecaoDe(ctx, u.id)
    // Duas metas do mesmo alvo (ha dois "Pikachu" hoje) leem o catalogo uma vez.
    const k = `${m.tipo}:${m.alvo}:${m.regiao ?? ''}`
    if (!porAlvo.has(k)) {
      porAlvo.set(k, (await cartasDoAlvo(ctx.c, ctx.catalogo, m.tipo === 'set'
        ? { tipo: 'set', valor: m.alvo }
        : { tipo: 'pokemon', valor: m.alvo, regiao: m.regiao })).sort(ordemDoSet))
    }
    const cartas = porAlvo.get(k)!
    if (cartas.length === 0) continue
    // Mesma regra do meta_cartas: com idioma na meta, so conta copia naquele idioma.
    const minhas = new Set(col.cartas
      .filter((x) => x.cardId && (!m.idioma || (x.idioma || 'pt') === m.idioma))
      .map((x) => x.cardId!))
    const faltamCat = cartas.filter((c) => !minhas.has(c.id))
    const tem = cartas.length - faltamCat.length
    const total = cartas.length
    const perto = faltamCat.length >= 1 && (faltamCat.length <= 3 || (tem / total >= 0.9 && faltamCat.length <= 9))
    if (!perto) continue
    a.noGatilho++
    if (!passaNasRegras(ctx, a, u, 'colecao', { chave: `meta:${m.id}` })) continue

    await ctx.historico.carregar(ctx.c, faltamCat.map((c) => c.id))
    const faltam: CartaFaltaE07[] = faltamCat.map((c) => {
      const an = anuncioMaisBarato(anuncios, c.id, u.id)
      const v = ctx.historico.variacao(c, 7)
      return {
        nome: c.nome,
        numero: numeroComTotal(c.numero, c.setTotal),
        anuncio: an && an.slug ? {
          slug: an.slug, preco: an.preco, condicao: an.condicao || 'NM', idioma: nomeIdioma(an.idioma),
          origem: 'anúncio', imagem: an.imagemVendedor || c.imagem,
        } : null,
        mercado: c.precoMin > 0 ? { preco: c.precoMin, pct7d: v && Math.abs(v.pct) <= PCT_SUSPEITO ? r1(v.pct) : null } : null,
      }
    })
    if (!faltam.some((x) => x.anuncio)) { pular(a, 'nenhuma_a_venda'); continue }
    for (const [i, x] of faltam.entries()) {
      if (!x.anuncio) continue
      const an = anuncioMaisBarato(anuncios, faltamCat[i].id, u.id)!
      x.anuncio.origem = origemAnuncio(await lojaDe(ctx, an.userId))
    }
    // Pagina de 9 bolsos que cobre o maximo de cartas que faltam.
    const idxFalta = cartas.map((c, i) => (minhas.has(c.id) ? -1 : i)).filter((i) => i >= 0)
    let ini = 0, melhor = -1
    for (let s = Math.max(0, idxFalta[idxFalta.length - 1] - 8); s <= idxFalta[0]; s++) {
      const n = idxFalta.filter((i) => i >= s && i < s + 9).length
      if (n > melhor) { melhor = n; ini = s }
    }
    ini = Math.max(0, Math.min(ini, cartas.length - 9))
    const bolsos: BolsoE07[] = cartas.slice(ini, ini + 9).map((c) => {
      const numero = c.numero
      if (minhas.has(c.id)) return { nome: '', numero, imagem: c.imagem || null, estado: 'tem' }
      const an = anuncioMaisBarato(anuncios, c.id, u.id)
      return an && an.slug
        ? { nome: c.nome, numero, imagem: c.imagem || null, estado: 'anuncio', preco: an.preco }
        : { nome: c.nome, numero, imagem: null, estado: 'aviso' }
    })
    const d: DadosE07 = { meta: { id: m.id, setNome: m.tipo === 'set' ? cartas[0].set : m.alvo, tem, total }, faltam }
    const img: ImgE07 = { tem, total, bolsos }
    a.cands.push({ usuario: u, template: 'E07', campanha: 'e07', chave: `meta:${m.id}`, dados: d, img: { 'e07-fichario': img } })
  }
  return a
}

// ─── E08 · alerta de preco (digest) ─────────────────────────────────────────

export async function avaliarE08(ctx: Contexto): Promise<Avaliacao> {
  const a = novaAvaliacao('E08')
  const f = aberto(ctx, 'E08')
  if (f) { a.fechado = f; return a }
  const cols = await colecoes(ctx)
  const alvo = usuariosAtivos(ctx).filter((u) => (cols.get(u.id)?.total ?? 0) > 0)
  await prepararHistorico(ctx, alvo.map((u) => cols.get(u.id)!))
  for (const u of alvo) {
    if (semTempo(ctx)) { a.incompleto = true; break }
    const col = cols.get(u.id)!
    const avisadas = new Set(enviosQueContam(ctx, u.id)
      .filter((e) => e.template === 'E08' && e.enviadoMs >= ctx.agoraMs - 7 * DIA_MS).flatMap((e) => e.cartas))
    const passaram = mexidas(ctx, col, 7).filter((m) =>
      Math.abs(m.pct) >= E08_LIMIAR.pct && Math.abs(m.delta) >= E08_LIMIAR.reais && !avisadas.has(m.carta.cardId!) && m.carta.cat!.imagem)
    if (passaram.length === 0) continue
    a.noGatilho++
    if (contarHoje(ctx, u.id, 'E08') >= E08_MAX_DIA) { pular(a, 'limite_diario'); continue }
    if (contarNaJanela(ctx, u.id, 'E08', 7) >= E08_MAX_SEMANA) { pular(a, 'limite_semanal'); continue }
    if (!passaNasRegras(ctx, a, u, 'colecao', { chave: `e08:${ctx.hoje}`, janelaDias: 1 })) continue
    const ord = [...passaram].sort((p, q) => Math.abs(q.naColecao) - Math.abs(p.naColecao))
    const [de, ...resto] = ord
    const base = (m: Mexida) => ({
      nome: m.carta.nome, set: m.carta.cat!.set, slug: m.carta.cat!.slug, imagem: m.carta.cat!.imagem,
      precoAntes: m.antes, precoAgora: m.agora, pct: r1(m.pct), naColecao: m.naColecao,
    })
    const placar = (m: Mexida): CartaPlacarE08 => ({ ...base(m), ...(m.pct < 0 && m.copias === 1 ? { segundaCopia: true } : {}) })
    const outras = resto.slice(0, 5).map(placar)
    const destaque = base(de)
    const d: DadosE08 = { nome: u.nome, data: ddmm(ctx.hoje), destaque, outras }
    const img: ImgE08 = {
      nome: u.nome, data: ddmm(ctx.hoje), carta: { nome: de.carta.nome, imagem: de.carta.cat!.imagemGrande },
      pct: r1(de.pct), naColecao: de.naColecao, placar: outras.length,
    }
    a.cands.push({
      usuario: u, template: 'E08', campanha: 'e08', chave: `e08:${ctx.hoje}`, dados: d, img: { 'e08-painel': img },
      cartas: [de, ...resto.slice(0, 5)].map((m) => m.carta.cardId!),
    })
  }
  return a
}

// ─── E09 · carta do seu set a venda ─────────────────────────────────────────

export async function avaliarE09(ctx: Contexto): Promise<Avaliacao> {
  const a = novaAvaliacao('E09')
  const f = aberto(ctx, 'E09')
  if (f) { a.fechado = f; return a }
  const novos = (await anunciosAtivos(ctx)).filter((x) => x.criadoMs >= ctx.agoraMs - 26 * H && x.slug && !x.graduada)
  if (novos.length === 0) return a
  await carregarCatalogo(ctx.c, ctx.catalogo, novos.map((x) => x.cardId))
  // Trava de preco: abaixo do menor preco da MESMA carta. Trava de compra: o vendedor recebe pela Bynx.
  const validos: { an: Anuncio; cat: CartaCatalogo }[] = []
  for (const an of novos) {
    const cat = ctx.catalogo.get(an.cardId)
    if (!cat || !cat.imagemGrande || !(cat.precoMin > 0) || !(an.preco < cat.precoMin)) continue
    const rec = await resolverRecebedor(ctx.c, an.userId).catch(() => null)
    if (!podeReceber(rec)) continue
    validos.push({ an, cat })
  }
  if (validos.length === 0) return a
  const cols = await colecoes(ctx)
  const escolhido = new Map<string, { an: Anuncio; cat: CartaCatalogo; tem: CartaPessoa }>()
  for (const u of usuariosAtivos(ctx)) {
    const col = cols.get(u.id)
    if (!col || col.total === 0) continue
    const tenho = new Set(col.cartas.map((x) => x.cardId))
    for (const v of validos) {
      if (v.an.userId === u.id || tenho.has(v.cat.id)) continue
      const doSet = col.cartas.filter((x) => x.cat?.setId === v.cat.setId && x.cat.imagemGrande).sort((p, q) => q.valorUnit - p.valorUnit)[0]
      if (!doSet) continue
      if (jaRecebeu(ctx, u.id, 'E09', { chave: `card:${v.cat.id}` })) continue
      const atual = escolhido.get(u.id)
      const desconto = (x: { an: Anuncio; cat: CartaCatalogo }) => (x.cat.precoMin - x.an.preco) / x.cat.precoMin
      if (!atual || desconto(v) > desconto(atual)) escolhido.set(u.id, { ...v, tem: doSet })
    }
  }
  for (const [userId, v] of escolhido) {
    const u = ctx.usuarios.get(userId)!
    a.noGatilho++
    if (contarHoje(ctx, u.id, 'E09') >= E09_MAX_DIA) { pular(a, 'limite_diario'); continue }
    if (contarNaJanela(ctx, u.id, 'E09', 7) >= E09_MAX_SEMANA) { pular(a, 'limite_semanal'); continue }
    if (!passaNasRegras(ctx, a, u, 'mercado', { chave: `card:${v.cat.id}` })) continue
    const loja = await lojaDe(ctx, v.an.userId)
    const vend = ctx.usuarios.get(v.an.userId)
    const cidade = loja?.cidade || vend?.cidade || ''
    const uf = loja?.uf || vend?.uf || ''
    const onde = cidade ? ` de ${cidade}${uf ? `, ${uf}` : ''}` : ' da Bynx'
    const ilustr = v.an.imagemVendedor ? null
      : v.cat.regiao === 'ocidental' && (v.an.idioma || 'pt') !== 'en' ? { idiomaImagem: 'inglês' }
      : v.cat.regiao === 'jp' && (v.an.idioma || 'pt') !== 'jp' ? { idiomaImagem: 'japonês' } : null
    const d: DadosE09 = {
      pokemon: v.cat.pokemons[0] || v.cat.nome,
      totalCartas: (cols.get(u.id)?.total) ?? 0,
      set: { nome: v.cat.set, cartaQueTem: v.tem.nome },
      anuncio: {
        slug: v.an.slug!, carta: v.cat.nome, curto: v.cat.nome, idioma: nomeIdioma(v.an.idioma),
        condicao: v.an.condicao || 'NM', preco: v.an.preco, mercado: v.cat.precoMin, hora: horaBR(new Date(v.an.criadoMs)),
        vendedor: `${loja ? 'uma loja' : 'um colecionador'}${onde}`, imagemIlustrativa: ilustr,
      },
    }
    const img: ImgE09 = {
      set: v.cat.set,
      temNoSet: { nome: v.tem.nome, imagem: v.tem.cat!.imagemGrande },
      anuncio: { imagem: v.an.imagemVendedor || v.cat.imagemGrande, numero: numeroCarta(v.cat.numero), preco: v.an.preco, mercado: v.cat.precoMin },
    }
    a.cands.push({ usuario: u, template: 'E09', campanha: 'e09', chave: `card:${v.cat.id}`, dados: d, img: { 'e09-bolso': img }, cartas: [v.cat.id] })
  }
  return a
}

// ─── E15 · winback ──────────────────────────────────────────────────────────

function toqueDeHoje(ctx: Contexto): number | null {
  if (ctx.forcar) return 1
  const i = E15_TOQUES.indexOf(ctx.hoje)
  return i >= 0 ? i + 1 : null
}

function variacao30(ctx: Contexto, col: Colecao) {
  const ms = mexidas(ctx, col, 30).filter((m) => Math.abs(m.naColecao) >= 1)
  const altas = ms.filter((m) => m.naColecao > 0).sort((p, q) => q.naColecao - p.naColecao)
  const quedas = ms.filter((m) => m.naColecao < 0).sort((p, q) => p.naColecao - q.naColecao)
  return { ms, altas, quedas, saldo: r2(ms.reduce((s, m) => s + m.naColecao, 0)) }
}

const cartaVar = (m: Mexida): CartaVariacaoE15 => ({ nome: m.carta.nome, set: m.carta.cat!.set, imagem: m.carta.cat!.imagemGrande, de: m.antes, para: m.agora })

export async function avaliarE15(ctx: Contexto): Promise<Avaliacao> {
  const a = novaAvaliacao('E15')
  const toque = toqueDeHoje(ctx)
  if (!toque) { a.fechado = `toques_em_${E15_TOQUES.join('_')}`; return a }
  const cols = await colecoes(ctx)
  const dormentes = usuariosAtivos(ctx).filter((u) => {
    const visto = u.lastSeenMs ?? u.criadoMs
    return visto < ctx.agoraMs - 30 * DIA_MS && (cols.get(u.id)?.total ?? 0) > 0
  })
  await prepararHistorico(ctx, dormentes.map((u) => cols.get(u.id)!))
  const desde = somarDias(ctx.hoje, -30)
  for (const u of dormentes) {
    if (semTempo(ctx)) { a.incompleto = true; break }
    a.noGatilho++
    if (toque > 1) {
      const anteriores = enviosQueContam(ctx, u.id).filter((e) => e.template === 'E15')
      const ultimo = anteriores.find((e) => e.chave === `winback:${toque - 1}`)
      if (!ultimo) { pular(a, 'sem_toque_anterior'); continue }
      const primeiro = Math.min(...anteriores.map((e) => e.enviadoMs))
      if (enviosQueContam(ctx, u.id).some((e) => e.clicadoMs && e.clicadoMs >= primeiro)) { pular(a, 'clicou_saiu_do_fluxo'); continue }
      if ((u.lastSeenMs ?? 0) >= primeiro) { pular(a, 'voltou_ao_app'); continue }
    }
    if (!passaNasRegras(ctx, a, u, 'novidades', { chave: `winback:${toque}` })) continue
    const col = cols.get(u.id)!
    const v = variacao30(ctx, col)
    const dest = v.altas.find((m) => m.carta.cat!.imagemGrande)
    if (!dest) { pular(a, 'sem_carta_que_subiu'); continue }
    const outras = v.altas.filter((m) => m !== dest)
    const d: DadosE15 = {
      nome: u.nome, cidade: u.cidade, uf: u.uf, desde: ddmm(desde), ate: ddmm(ctx.hoje),
      valorInicio: r2(col.valor - v.saldo), valorHoje: col.valor,
      subiram: v.altas.length, cairam: v.quedas.length,
      destaque: cartaVar(dest),
      quedas: v.quedas.filter((m) => m.carta.cat!.imagemGrande).slice(0, 6).map(cartaVar),
      outrasAltas: { quantidade: outras.length, soma: r2(outras.reduce((s, m) => s + m.naColecao, 0)) },
    }
    const img: ImgE15 = {
      nome: u.nome, cidade: u.cidade, uf: u.uf, desde: d.desde, ate: d.ate, variacao: v.saldo,
      subiram: d.subiram, cairam: d.cairam, selo: dest.carta.cat!.imagemGrande,
    }
    a.cands.push({ usuario: u, template: 'E15', campanha: `e15-toque${toque}`, chave: `winback:${toque}`, dados: d, img: { 'e15-postal': img } })
  }
  return a
}

// ─── E16 · sunset ───────────────────────────────────────────────────────────

export async function avaliarE16(ctx: Contexto): Promise<Avaliacao> {
  const a = novaAvaliacao('E16')
  const f = aberto(ctx, 'E16')
  if (f) { a.fechado = f; return a }
  const cols = await colecoes(ctx)
  const alvo: Usuario[] = []
  for (const u of usuariosAtivos(ctx)) {
    const es = enviosQueContam(ctx, u.id).filter((e) => e.categoria !== 'transacional')
    if (es.length === 0) continue
    // So com 60 dias de log: o primeiro envio tem de ter 60+ dias.
    if (Math.min(...es.map((e) => e.enviadoMs)) > ctx.agoraMs - 60 * DIA_MS) continue
    if (es.some((e) => e.clicadoMs && e.clicadoMs >= ctx.agoraMs - 60 * DIA_MS)) continue
    alvo.push(u)
  }
  await prepararHistorico(ctx, alvo.map((u) => cols.get(u.id)!).filter(Boolean))
  for (const u of alvo) {
    if (semTempo(ctx)) { a.incompleto = true; break }
    a.noGatilho++
    if (!passaNasRegras(ctx, a, u, 'novidades', { chave: 'sunset' })) continue
    const col = cols.get(u.id)
    if (!col || col.total === 0) { pular(a, 'sem_cartas'); continue }
    const v = variacao30(ctx, col)
    const top = v.altas.filter((m) => m.carta.cat!.imagemGrande).slice(0, 2)
    const imagens = top.length ? top.map((m) => m.carta.cat!.imagemGrande) : maisValiosas(col).slice(0, 2).map((x) => x.cat!.imagemGrande)
    if (imagens.length === 0) { pular(a, 'sem_imagem'); continue }
    const d: DadosE16 = {
      nome: u.nome, nCartas: col.total, valorHoje: col.valor, variacao30d: v.saldo,
      destaques: top.map((m) => ({ nome: m.carta.nome, de: m.antes, para: m.agora })),
      quedas: v.quedas.length,
    }
    const img: ImgE16 = { cartas: imagens }
    a.cands.push({ usuario: u, template: 'E16', campanha: 'e16', chave: 'sunset', dados: d, img: { 'e16-fichario': img } })
  }
  return a
}

// ─── E20 · repetidas paradas ────────────────────────────────────────────────

async function watchlistPorCarta(ctx: Contexto): Promise<Map<string, number>> {
  // watchlist tem 9 linhas hoje: leitura inteira paginada (indice por card_id existe).
  const out = new Map<string, number>()
  for (let de = 0; ; de += 1000) {
    const { data, error } = await ctx.c.from('watchlist').select('card_id').order('id').range(de, de + 999)
    if (error) throw new Error(`[regua] watchlist: ${error.message}`)
    for (const r of (data || []) as { card_id: string }[]) out.set(r.card_id, (out.get(r.card_id) || 0) + 1)
    if (!data || data.length < 1000) break
  }
  return out
}

export async function avaliarE20(ctx: Contexto): Promise<Avaliacao> {
  const a = novaAvaliacao('E20')
  const f = aberto(ctx, 'E20')
  if (f) { a.fechado = f; return a }
  const cols = await colecoes(ctx)
  const vendem = await donosDeAnuncioAtivo(ctx.c)
  const alvo = usuariosAtivos(ctx).filter((u) => (cols.get(u.id)?.total ?? 0) >= 10 && !vendem.has(u.id))
  if (alvo.length === 0) return a
  const olhos = await watchlistPorCarta(ctx)
  const anuncios = await anunciosAtivos(ctx)
  await prepararHistorico(ctx, alvo.map((u) => cols.get(u.id)!))
  for (const u of alvo) {
    if (semTempo(ctx)) { a.incompleto = true; break }
    const col = cols.get(u.id)!
    const reps = repetidas(col).filter((r) => r.carta.cat?.imagemGrande)
    if (reps.length === 0) continue
    a.noGatilho++
    if (!passaNasRegras(ctx, a, u, 'mercado', { janelaDias: 30 })) continue
    // A 1a repetida e a que tem um gancho verdadeiro (ninguem inventa "poucos anuncios").
    let escolha: { i: number; gancho: GanchoE20; altaDe: number | null } | null = null
    for (const [i, r] of reps.slice(0, 3).entries()) {
      const id = r.carta.cardId!
      const v = mediuVariacao(r.carta) ? ctx.historico.variacao(r.carta.cat, 30) : null
      const altaDe = v && v.pct > 0 && v.pct <= PCT_SUSPEITO ? v.antes : null
      const n = olhos.get(id) || 0
      const nAn = anuncios.filter((x) => x.cardId === id).length
      const gancho: GanchoE20 | null = n > 0 ? { tipo: 'acompanham', n }
        : nAn === 0 ? { tipo: 'sem-anuncio' }
        : nAn <= 3 ? { tipo: 'poucos', n: nAn }
        : altaDe ? { tipo: 'alta' } : null
      if (gancho) { escolha = { i, gancho, altaDe }; break }
    }
    if (!escolha) { pular(a, 'sem_gancho_verdadeiro'); continue }
    const ordem = [reps[escolha.i], ...reps.filter((_, j) => j !== escolha!.i)].slice(0, 3)
    const primeira = ordem[0].carta
    const centavos = Math.round(primeira.valorUnit * 100)
    const liquido = (centavos - comissaoVendedorCents(centavos, normalizarPrazo(u.repassePrazo))) / 100
    const d: DadosE20 = {
      nome: u.nome,
      repetidas: ordem.map((r) => ({ nome: r.carta.nome, set: r.carta.cat!.set, imagem: r.carta.cat!.imagemGrande, preco: r.carta.valorUnit })),
      altaDe: escolha.altaDe,
      gancho: escolha.gancho,
      liquidoAprox: r2(liquido),
    }
    const img: ImgE20 = { repetidas: d.repetidas.map((r) => ({ imagem: r.imagem, preco: r.preco })), altaDe: escolha.altaDe }
    a.cands.push({ usuario: u, template: 'E20', campanha: 'e20', chave: `e20:${ctx.hoje}`, dados: d, img: { 'e20-varal': img } })
  }
  return a
}

// ─── ordem do tick ──────────────────────────────────────────────────────────

/**
 * Ordem de processamento: produto/ativacao primeiro (fora do teto), depois os
 * alertas, e por ultimo o marketing que disputa o teto (winback antes de
 * repetidas). Cada template e avaliado DEPOIS do envio do anterior, entao o
 * teto ja enxerga o que saiu no mesmo tick.
 */
export const ORDEM_EVENTOS: { id: string; avaliar: (ctx: Contexto) => Promise<Avaliacao> }[] = [
  { id: 'E02', avaliar: avaliarE02 },
  { id: 'E05', avaliar: avaliarE05 },
  { id: 'E03', avaliar: avaliarE03 },
  { id: 'E04', avaliar: avaliarE04 },
  { id: 'E07', avaliar: avaliarE07 },
  { id: 'E06', avaliar: avaliarE06 },
  { id: 'E08', avaliar: avaliarE08 },
  { id: 'E09', avaliar: avaliarE09 },
  { id: 'E15', avaliar: avaliarE15 },
  { id: 'E20', avaliar: avaliarE20 },
  { id: 'E16', avaliar: avaliarE16 },
]

export type ResumoTemplate = Omit<Avaliacao, 'cands'> & { candidatos: number; envio: ResultadoEnvio | null; fallbackLegado?: number }

/** Roda os gatilhos de evento em ordem, enviando (ou simulando) template a template. */
export async function rodarEventos(ctx: Contexto, so?: string[]): Promise<ResumoTemplate[]> {
  const out: ResumoTemplate[] = []
  for (const { id, avaliar } of ORDEM_EVENTOS) {
    if (so && so.length && !so.includes(id)) continue
    if (semTempo(ctx)) {
      out.push({ template: id, noGatilho: 0, motivos: {}, incompleto: true, candidatos: 0, envio: null })
      continue
    }
    try {
      const a = await avaliar(ctx)
      const envio = a.cands.length ? await enviarCandidatos(ctx, a.cands) : null
      const fb = id === 'E05' ? await enviarFallbackE05(ctx, (a as Avaliacao & { fallback?: FallbackE05[] }).fallback ?? []) : undefined
      const { cands, ...resto } = a
      delete (resto as { fallback?: unknown }).fallback
      out.push({ ...resto, candidatos: cands.length, envio, ...(fb !== undefined ? { fallbackLegado: fb } : {}) })
    } catch (e) {
      // Um template quebrado nao derruba os outros do tick.
      console.error(`[regua] ${id} falhou:`, (e as Error)?.message)
      out.push({ template: id, noGatilho: 0, motivos: { erro: 1 }, candidatos: 0, envio: null, fechado: `erro: ${(e as Error)?.message}` })
    }
  }
  return out
}

/**
 * Contagem SECA de um gatilho de evento para o admin: avalia como o cron
 * avaliaria (ignorando o calendario quando `forcar`), nao grava e nao envia.
 * Monta ate 3 e-mails de verdade para mostrar o assunto.
 */
export async function contarEvento(id: string, forcar = true) {
  const item = ORDEM_EVENTOS.find((x) => x.id === id)
  if (!item) return null
  const ctx = await criarContexto({ forcar, seco: true })
  const a = await item.avaliar(ctx)
  const amostra: { email: string; assunto: string }[] = []
  for (const c of a.cands.slice(0, 3)) {
    try {
      amostra.push({ email: c.usuario.email, assunto: REGUA[c.template].montar(c.dados, { links: null, promocoes: [], tokenImagem: null }).assunto })
    } catch (e) {
      amostra.push({ email: c.usuario.email, assunto: `ERRO ao montar: ${(e as Error)?.message}` })
    }
  }
  return {
    template: id, modo: ctx.modo, noSegmento: a.noGatilho, elegiveis: a.cands.length,
    motivos: a.motivos, fechado: a.fechado ?? null, incompleto: !!a.incompleto, amostra,
  }
}
