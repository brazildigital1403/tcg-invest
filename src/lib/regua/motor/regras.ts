/**
 * Regras de quem pode receber: consentimento, preferencia, descadastro, teto
 * semanal de marketing, dedup e as saidas de winback/sunset.
 *
 * ★ O LOG E A FONTE. Teto e dedup contam `email_envios`, nunca memoria. Dentro
 * do mesmo tick, cada envio aceito entra no contexto na hora (`registrar`),
 * entao duas trilhas no mesmo tick enxergam uma a outra.
 *
 * ★ SIMULADO NAO CONTA NO REAL. Com a chave ligada, linha 'simulado' nao vale
 * para teto nem dedup (a simulacao de ontem nao pode impedir o envio de hoje).
 * Na simulacao ela conta, para a simulacao reproduzir o que o real faria e um
 * segundo tick no mesmo dia nao "simular de novo" as mesmas pessoas.
 */
import { ehCategoriaMarketing, type CategoriaEmail } from '@/lib/email'
import { FORA_DO_TETO, STATUS_QUE_CONTAM, SUFIXO_TESTE, TETO_MARKETING_SEMANA } from './config'
import type { EnvioLog, Usuario } from './banco'
import type { Contexto } from './contexto'
import { DIA_MS } from './tempo'

function contaNoModo(ctx: Contexto, e: EnvioLog): boolean {
  if (e.campanha && e.campanha.endsWith(SUFIXO_TESTE)) return false
  if (STATUS_QUE_CONTAM.includes(e.status)) return true
  return ctx.modo === 'simulacao' && e.status === 'simulado'
}

/** Envios desta pessoa que valem para teto/dedup no modo atual. */
export function enviosQueContam(ctx: Contexto, userId: string): EnvioLog[] {
  return (ctx.envios.get(userId) || []).filter((e) => contaNoModo(ctx, e))
}

/**
 * Consentimento e preferencia (mesma regra do `enviarNurture`):
 * - transacional: sempre (aviso de algo que a pessoa fez);
 * - colecao: descadastro + toggle de colecao;
 * - mercado/novidades/radar: descadastro + `marketing_aceito` + toggle.
 */
export function motivoConsentimento(u: Usuario, categoria: CategoriaEmail, opts: { ignorarTeste?: boolean } = {}): string | null {
  if (u.teste && !opts.ignorarTeste) return 'conta_de_teste'
  if (categoria === 'transacional') return null
  if (u.suspensa) return 'conta_suspensa'
  if (u.optOut) return 'optout'
  // Sem token nao ha List-Unsubscribe nem link de descadastro: nao manda relacionamento.
  if (!u.unsubscribeToken) return 'sem_token_descadastro'
  if (ehCategoriaMarketing(categoria)) {
    if (!u.marketingAceito) return 'sem_marketing_aceito'
  }
  if (u.prefs[categoria] === false) return `pref_${categoria}_desligada`
  return null
}

/** Ja recebeu este template (com a mesma chave, se dada) na janela? */
export function jaRecebeu(
  ctx: Contexto, userId: string, template: string | string[],
  opts: { chave?: string; janelaDias?: number } = {},
): boolean {
  const ts = Array.isArray(template) ? template : [template]
  const desde = opts.janelaDias ? ctx.agoraMs - opts.janelaDias * DIA_MS : -Infinity
  return enviosQueContam(ctx, userId).some((e) =>
    ts.includes(e.template) && e.enviadoMs >= desde && (opts.chave === undefined || e.chave === opts.chave))
}

export function contarNaJanela(ctx: Contexto, userId: string, template: string, dias: number): number {
  const desde = ctx.agoraMs - dias * DIA_MS
  return enviosQueContam(ctx, userId).filter((e) => e.template === template && e.enviadoMs >= desde).length
}

/** Mesmo dia de Brasilia (o `agoraMs` do tick vem do mesmo dia). */
export function contarHoje(ctx: Contexto, userId: string, template: string): number {
  const inicioDoDia = Date.parse(`${ctx.hoje}T03:00:00Z`) // 00h de Brasilia
  return enviosQueContam(ctx, userId).filter((e) => e.template === template && e.enviadoMs >= inicioDoDia).length
}

/** Teto: 2 de marketing em 7 dias, fora os templates com limite proprio. */
export function motivoTeto(ctx: Contexto, userId: string, template: string, categoria: CategoriaEmail): string | null {
  if (!ehCategoriaMarketing(categoria) || FORA_DO_TETO.has(template)) return null
  const desde = ctx.agoraMs - 7 * DIA_MS
  const n = enviosQueContam(ctx, userId).filter((e) =>
    e.enviadoMs >= desde && ehCategoriaMarketing(e.categoria as CategoriaEmail) && !FORA_DO_TETO.has(e.template)).length
  return n >= TETO_MARKETING_SEMANA ? 'teto_semanal' : null
}

/**
 * Winback (estrategia, principio 6): quem recebeu o E15 e nao clicou fica so
 * com winback e Radar ate clicar. Vale 30 dias a partir do ultimo toque.
 */
export function emWinback(ctx: Contexto, userId: string): boolean {
  const es = enviosQueContam(ctx, userId)
  const toques = es.filter((e) => e.template === 'E15' && e.enviadoMs >= ctx.agoraMs - 30 * DIA_MS)
  if (toques.length === 0) return false
  const primeiro = Math.min(...toques.map((t) => t.enviadoMs))
  return !es.some((e) => e.clicadoMs && e.clicadoMs >= primeiro)
}

/** Sunset: recebeu o E16 ha mais de 14 dias e nao clicou em nada depois: sai do marketing. */
export function saiuPorSunset(ctx: Contexto, userId: string): boolean {
  const es = enviosQueContam(ctx, userId)
  const e16 = es.filter((e) => e.template === 'E16')
  if (e16.length === 0) return false
  const quando = Math.min(...e16.map((e) => e.enviadoMs))
  if (ctx.agoraMs - quando < 14 * DIA_MS) return false
  return !es.some((e) => e.clicadoMs && e.clicadoMs >= quando)
}

/** Saidas do marketing que nao sao consentimento (winback e sunset). */
export function motivoFluxo(ctx: Contexto, userId: string, template: string, categoria: CategoriaEmail): string | null {
  if (!ehCategoriaMarketing(categoria)) return null
  if (template !== 'E16' && saiuPorSunset(ctx, userId)) return 'sunset_sem_resposta'
  if (template !== 'E15' && template !== 'E10' && emWinback(ctx, userId)) return 'em_winback'
  return null
}

/** Entra no contexto na hora: o proximo gatilho do mesmo tick ja enxerga. */
export function registrar(ctx: Contexto, userId: string, e: Omit<EnvioLog, 'enviadoMs' | 'clicadoMs' | 'status'>): void {
  const l = ctx.envios.get(userId) || []
  l.push({ ...e, enviadoMs: ctx.agoraMs, clicadoMs: null, status: ctx.modo === 'real' ? 'enviando' : 'simulado' })
  ctx.envios.set(userId, l)
}
