/**
 * Resultado de avaliar um template: quem entrou no gatilho, quem saiu e por
 * que (contagem por motivo), e os candidatos prontos para o envio.
 */
import type { CategoriaEmail } from '@/lib/email'
import type { Usuario } from './banco'
import type { Contexto } from './contexto'
import type { Candidato } from './envio'
import { jaRecebeu, motivoConsentimento, motivoFluxo, motivoTeto } from './regras'

export type Avaliacao = {
  template: string
  /** Pessoas que bateram no gatilho (antes das regras). */
  noGatilho: number
  cands: Candidato[]
  motivos: Record<string, number>
  /** Gatilho fechado hoje (calendario) ou bloqueado: o motivo. */
  fechado?: string
  /** O tempo do tick acabou antes de avaliar todo mundo. */
  incompleto?: boolean
}

export function novaAvaliacao(template: string): Avaliacao {
  return { template, noGatilho: 0, cands: [], motivos: {} }
}

export function pular(a: Avaliacao, motivo: string): false {
  a.motivos[motivo] = (a.motivos[motivo] || 0) + 1
  return false
}

/**
 * Regras na ordem: consentimento/preferencia -> winback/sunset -> dedup ->
 * teto. A primeira que barra e a que conta (um motivo por pessoa).
 */
export function passaNasRegras(
  ctx: Contexto, a: Avaliacao, u: Usuario, categoria: CategoriaEmail,
  dedup: { templates?: string[]; chave?: string; janelaDias?: number } | null,
  opts: { ignorarTeste?: boolean; semTeto?: boolean } = {},
): boolean {
  const c = motivoConsentimento(u, categoria, { ignorarTeste: opts.ignorarTeste })
  if (c) return pular(a, c)
  const f = motivoFluxo(ctx, u.id, a.template, categoria)
  if (f) return pular(a, f)
  if (dedup && jaRecebeu(ctx, u.id, dedup.templates ?? a.template, { chave: dedup.chave, janelaDias: dedup.janelaDias })) {
    return pular(a, 'ja_recebeu')
  }
  if (!opts.semTeto) {
    const t = motivoTeto(ctx, u.id, a.template, categoria)
    if (t) return pular(a, t)
  }
  return true
}
