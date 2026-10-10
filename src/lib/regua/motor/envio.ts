/**
 * Envio da regua: grava a linha em `email_envios`, gera o token da imagem
 * pessoal, monta o template e manda pelo Resend em LOTE (emails.batch, ate 100
 * por chamada). Depois de cada lote enviado, aquece a CDN das imagens pessoais.
 *
 * Ordem (e por que):
 * 1. id do envio gerado AQUI (uuid) -> token -> HTML. O token aponta para a
 *    linha; a rota /api/email/img/[tipo] le `meta.img.<tipo>` dela.
 * 2. INSERT das linhas ANTES do Resend, com status 'enviando'. Se a funcao
 *    morrer no meio, a linha ja conta para o dedup: o pior caso e alguem NAO
 *    receber, nunca receber duas vezes. Insert que falha = lote nao sai.
 * 3. Resend batch. ★ O batch e tudo-ou-nada na validacao: se ele recusar, o
 *    lote cai para envio um a um, e a falha de um nao derruba os outros.
 * 4. Upsert de status + resend_id (o webhook do Resend casa por resend_id).
 * 5. Aquecimento: GET em cada urlImagemPessoal com token, concorrencia baixa,
 *    falha ignorada (a imagem ainda se gera na 1a abertura, so mais devagar).
 *
 * ★ SIMULACAO (REGUA_ATIVA != '1'): passos 1 e 2 com status 'simulado' (o
 * HTML e montado de verdade, para pegar template quebrado), e PARA. Nada de
 * Resend, nada de aquecimento.
 */
import { randomUUID, createHash } from 'node:crypto'
import { Resend } from 'resend'
import {
  FROM_MARKETING, FROM_PRODUTO, REPLY_TO_MARKETING, URL_CANONICA, ehCategoriaMarketing,
  type CategoriaEmail, type LinksRelacionamento,
} from '@/lib/email'
import { REGUA } from '@/lib/regua/registro'
import { urlImagemPessoal, type CtxRegua } from '@/lib/regua/comum'
import { SemSegredoImagem, assinar } from '@/lib/regua/imgToken'
import { LOTE_RESEND, SUFIXO_TESTE } from './config'
import { emBlocos, type Usuario } from './banco'
import { promocoes, type Contexto } from './contexto'
import { registrar } from './regras'

export type Candidato = {
  usuario: Usuario
  template: string
  campanha: string
  /** Chave de dedup gravada em meta.chave (ex.: "meta:<uuid>", "radar:1"). */
  chave: string
  dados: unknown
  /** meta.img: os dados de cada tipo de imagem pessoal (chave = tipo da rota). */
  img: Record<string, unknown> | null
  /** card_ids citados (E08 avisados, E09 anunciado), em meta.cartas. */
  cartas?: string[]
  /** Envio de teste (lista de e-mails do admin): campanha com ':teste', fora do teto/dedup. */
  teste?: boolean
}

export type ResultadoEnvio = {
  simulados: number
  enviados: number
  falhas: number
  aquecidas: number
  aquecimentoFalhou: number
  aquecimentoPulado: number
  /** Exemplos de assunto (ate 5), para o log e para o admin. */
  amostra: { template: string; email: string; assunto: string }[]
}

let _resend: Resend | null = null
function resend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

function links(u: Usuario): LinksRelacionamento | null {
  if (!u.unsubscribeToken) return null
  return {
    descadastrar: `${URL_CANONICA}/api/email/descadastrar?t=${u.unsubscribeToken}`,
    preferencias: `${URL_CANONICA}/email/preferencias?t=${u.unsubscribeToken}`,
  }
}

type Montado = {
  id: string
  cand: Candidato
  categoria: CategoriaEmail
  trilha: string
  token: string | null
  assunto: string
  html: string
  erro: string | null
}

function montarUm(cand: Candidato, promos: CtxRegua['promocoes'], real: boolean): Montado {
  const tpl = REGUA[cand.template]
  const id = randomUUID()
  const base = { id, cand, categoria: tpl.categoria as CategoriaEmail, trilha: tpl.trilha }
  let token: string | null = null
  try {
    token = assinar(id)
  } catch (e) {
    // Sem o segredo, a imagem pessoal nao abre: no real isso e erro de
    // configuracao (nada sai); na simulacao, segue com a imagem de exemplo.
    if (!(e instanceof SemSegredoImagem) || real) throw e
  }
  try {
    const m = tpl.montar(cand.dados, { links: links(cand.usuario), promocoes: promos, tokenImagem: token })
    return { ...base, token, assunto: m.assunto, html: m.html, erro: null }
  } catch (e) {
    return { ...base, token, assunto: '', html: '', erro: `montar: ${(e as Error)?.message ?? e}` }
  }
}

function linhaLog(m: Montado, status: string, resendId: string | null = null) {
  return {
    id: m.id,
    user_id: m.cand.usuario.id,
    email: m.cand.usuario.email,
    template: m.cand.template,
    trilha: m.trilha,
    categoria: m.categoria,
    campanha: m.cand.teste ? `${m.cand.campanha}${SUFIXO_TESTE}` : m.cand.campanha,
    status,
    resend_id: resendId,
  }
}

function payload(m: Montado) {
  const u = m.cand.usuario
  const marketing = ehCategoriaMarketing(m.categoria)
  const l = links(u)
  const headers: Record<string, string> = {}
  if (m.categoria !== 'transacional' && l) {
    headers['List-Unsubscribe'] = `<${l.descadastrar}>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }
  return {
    from: marketing ? FROM_MARKETING : FROM_PRODUTO,
    ...(marketing ? { replyTo: REPLY_TO_MARKETING } : {}),
    to: [u.email],
    subject: m.assunto,
    html: m.html,
    ...(Object.keys(headers).length ? { headers } : {}),
    tags: [
      { name: 'template', value: m.cand.template },
      { name: 'envio', value: m.id },
    ],
  }
}

async function comConcorrencia<T>(itens: T[], n: number, fn: (x: T) => Promise<void>, parar: () => boolean): Promise<number> {
  let i = 0
  let pulados = 0
  async function trabalhador() {
    while (i < itens.length) {
      const x = itens[i++]
      if (parar()) { pulados++; continue }
      await fn(x)
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, trabalhador))
  return pulados
}

/** Grava as linhas do lote. Erro = o lote inteiro nao sai (sem log, sem dedup). */
async function inserir(ctx: Contexto, ms: Montado[], status: string): Promise<boolean> {
  const linhas = ms.map((m) => ({
    ...linhaLog(m, m.erro ? 'falhou' : status),
    meta: {
      chave: m.cand.chave,
      assunto: m.assunto || null,
      img: m.cand.img,
      ...(m.cand.cartas?.length ? { cartas: m.cand.cartas } : {}),
      ...(m.erro ? { erro: m.erro } : {}),
      ...(m.token ? {} : { sem_token_imagem: true }),
      motor: 1,
    },
  }))
  const { error } = await ctx.c.from('email_envios').insert(linhas)
  if (error) {
    console.error(`[regua] insert de ${linhas.length} envios falhou: ${error.message}`)
    return false
  }
  return true
}

async function atualizar(ctx: Contexto, linhas: ReturnType<typeof linhaLog>[]): Promise<void> {
  if (linhas.length === 0) return
  const { error } = await ctx.c.from('email_envios').upsert(linhas, { onConflict: 'id' })
  if (error) console.error(`[regua] status de ${linhas.length} envios nao gravado: ${error.message}`)
}

async function enviarUmAUm(ms: Montado[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  await comConcorrencia(ms, 4, async (m) => {
    try {
      const r = await resend().emails.send(payload(m))
      if (r.error) console.error(`[regua] envio ${m.cand.template} falhou: ${r.error.name}: ${r.error.message}`)
      out.set(m.id, r.data?.id ?? null)
    } catch (e) {
      console.error(`[regua] envio ${m.cand.template} falhou: ${(e as Error)?.message}`)
      out.set(m.id, null)
    }
  }, () => false)
  return out
}

async function enviarLoteResend(ms: Montado[]): Promise<Map<string, string | null>> {
  const chave = createHash('sha256').update(ms.map((m) => m.id).join(',')).digest('hex').slice(0, 40)
  try {
    const r = await resend().batch.send(ms.map(payload), { idempotencyKey: `regua-${chave}` })
    if (!r.error && r.data?.data?.length === ms.length) {
      return new Map(ms.map((m, i) => [m.id, r.data!.data[i]?.id ?? null]))
    }
    console.error(`[regua] batch recusado (${ms.length}): ${r.error?.name ?? 'resposta incompleta'}: ${r.error?.message ?? ''} -- caindo para um a um`)
  } catch (e) {
    console.error(`[regua] batch falhou (${ms.length}): ${(e as Error)?.message} -- caindo para um a um`)
  }
  return enviarUmAUm(ms)
}

/** GET nas imagens pessoais: a primeira abertura ja encontra a CDN quente. */
async function aquecer(ctx: Contexto, ms: Montado[], r: ResultadoEnvio): Promise<void> {
  const urls: string[] = []
  for (const m of ms) {
    if (!m.token || !m.cand.img) continue
    for (const tipo of Object.keys(m.cand.img)) urls.push(urlImagemPessoal(tipo, m.token))
  }
  r.aquecimentoPulado += await comConcorrencia(urls, 3, async (url) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000), cache: 'no-store' })
      await res.arrayBuffer().catch(() => null)
      if (res.ok) r.aquecidas++
      else r.aquecimentoFalhou++
    } catch {
      r.aquecimentoFalhou++
    }
  }, () => Date.now() > ctx.prazoMs)
}

/**
 * Manda (ou simula) os candidatos. Cada aceito ja entra no contexto do tick
 * (teto/dedup) antes do envio. Lotes de 100.
 */
export async function enviarCandidatos(ctx: Contexto, cands: Candidato[]): Promise<ResultadoEnvio> {
  const r: ResultadoEnvio = { simulados: 0, enviados: 0, falhas: 0, aquecidas: 0, aquecimentoFalhou: 0, aquecimentoPulado: 0, amostra: [] }
  if (cands.length === 0) return r
  const real = ctx.modo === 'real'
  if (real && !process.env.RESEND_API_KEY) throw new Error('[regua] RESEND_API_KEY ausente: nada foi enviado')
  const promos = await promocoes(ctx)

  for (const lote of emBlocos(cands, LOTE_RESEND)) {
    const ms = lote.map((c) => montarUm(c, promos, real))
    for (const m of ms) {
      if (!m.cand.teste) registrar(ctx, m.cand.usuario.id, {
        template: m.cand.template, categoria: m.categoria, campanha: m.cand.campanha, chave: m.cand.chave, cartas: m.cand.cartas ?? [],
      })
      if (r.amostra.length < 5 && !m.erro) r.amostra.push({ template: m.cand.template, email: m.cand.usuario.email, assunto: m.assunto })
    }
    const okMontagem = ms.filter((m) => !m.erro)
    r.falhas += ms.length - okMontagem.length
    for (const m of ms) if (m.erro) console.error(`[regua] ${m.cand.template} para ${m.cand.usuario.id}: ${m.erro}`)

    if (!(await inserir(ctx, ms, real ? 'enviando' : 'simulado'))) {
      r.falhas += okMontagem.length
      continue
    }
    if (!real) {
      r.simulados += okMontagem.length
      continue
    }

    const ids = await enviarLoteResend(okMontagem)
    const linhas = okMontagem.map((m) => {
      const rid = ids.get(m.id) ?? null
      if (rid) r.enviados++
      else r.falhas++
      return linhaLog(m, rid ? 'enviado' : 'falhou', rid)
    })
    await atualizar(ctx, linhas)
    await aquecer(ctx, okMontagem.filter((m) => ids.get(m.id)), r)
  }
  if (real && (r.aquecidas || r.aquecimentoFalhou || r.aquecimentoPulado)) {
    console.log(`[regua] aquecimento da CDN: ${r.aquecidas} ok, ${r.aquecimentoFalhou} falharam, ${r.aquecimentoPulado} sem tempo`)
  }
  return r
}
