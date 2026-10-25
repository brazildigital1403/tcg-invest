/**
 * Registro unico da regua: os 20 templates (lote A + lote B) e as variantes
 * aprovadas (E01B, E03B, E04B, E05B, E06B, E17B) num mapa so, mais os exemplos
 * alternativos que alguns deles tem para a pre-visualizacao.
 *
 * Quem precisa de "todos os templates" (pre-visualizacao do admin, motor de
 * envio) le daqui, nunca de index-a/index-b separados.
 */
import type { TemplateRegua } from './comum'
import { TEMPLATES_A } from './templates/index-a'
import { TEMPLATES_B } from './templates/index-b'
import { TEMPLATES_VARIANTES } from './templates/index-variantes'
import { E03B_EXEMPLO_PIOR } from './templates/E03B'
import { EXEMPLOS_EXTRAS as EXTRAS_E05B } from './templates/E05B'
import { E10_EXEMPLO_5MAIS } from './templates/E10'
import { EXEMPLOS_EXTRAS as EXTRAS_E14 } from './templates/E14'
import { EXEMPLOS_EXTRAS as EXTRAS_E18 } from './templates/E18'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const REGUA: Record<string, TemplateRegua<any>> = { ...TEMPLATES_A, ...TEMPLATES_B, ...TEMPLATES_VARIANTES }

/**
 * Exemplos alternativos por template (chave = `&variante=` da previa).
 * O exemplo principal de cada um continua sendo `REGUA[id].exemplo`.
 */
export const VARIANTES: Record<string, Record<string, unknown>> = {
  E03B: { 'pior-caso': E03B_EXEMPLO_PIOR },
  E05B: EXTRAS_E05B,
  E10: { '5mais': E10_EXEMPLO_5MAIS },
  E14: EXTRAS_E14,
  E18: EXTRAS_E18,
}

/** E01, E01B, E02... em ordem (a variante logo depois do principal). */
export const IDS_REGUA: string[] = Object.keys(REGUA).sort()

/** Dados de exemplo do template; `variante` vazia ou desconhecida = exemplo principal. */
export function exemploDe(id: string, variante?: string | null): unknown {
  if (!temTemplate(id)) return null
  const extras = VARIANTES[id]
  const extra = variante && extras && Object.hasOwn(extras, variante) ? extras[variante] : undefined
  return extra ?? REGUA[id].exemplo
}

/** So chave propria (nada de `constructor`/`toString` vindo da URL). */
export function temTemplate(id: string): boolean {
  return Object.hasOwn(REGUA, id)
}
