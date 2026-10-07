/**
 * Lote A da regua: E01 a E10. Cada template segue o contrato de
 * `src/lib/regua/comum.ts` (TemplateRegua<D>).
 */
import { E01 } from './E01'
import { E02 } from './E02'
import { E03 } from './E03'
import { E04 } from './E04'
import { E05 } from './E05'
import { E06 } from './E06'
import { E07 } from './E07'
import { E08 } from './E08'
import { E09 } from './E09'
import { E10 } from './E10'

export const TEMPLATES_A = { E01, E02, E03, E04, E05, E06, E07, E08, E09, E10 } as const

export type IdTemplateA = keyof typeof TEMPLATES_A
