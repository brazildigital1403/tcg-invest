/**
 * Registro unico da regua: os 20 templates (lote A + lote B) num mapa so,
 * mais as variantes de exemplo que alguns deles tem para a pre-visualizacao.
 *
 * Quem precisa de "todos os templates" (pre-visualizacao do admin, motor de
 * envio) le daqui, nunca de index-a/index-b separados.
 */
import type { TemplateRegua } from './comum'
import { TEMPLATES_A } from './templates/index-a'
import { TEMPLATES_B } from './templates/index-b'
import { E10_EXEMPLO_5MAIS } from './templates/E10'
import { EXEMPLOS_EXTRAS as EXTRAS_E14 } from './templates/E14'
import { EXEMPLOS_EXTRAS as EXTRAS_E18 } from './templates/E18'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const REGUA: Record<string, TemplateRegua<any>> = { ...TEMPLATES_A, ...TEMPLATES_B }

/**
 * Exemplos alternativos por template (chave = `&variante=` da previa).
 * O exemplo principal de cada um continua sendo `REGUA[id].exemplo`.
 */
export const VARIANTES: Record<string, Record<string, unknown>> = {
  E10: { '5mais': E10_EXEMPLO_5MAIS },
  E14: EXTRAS_E14,
  E18: EXTRAS_E18,
}

/** E01..E20 em ordem. */
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
