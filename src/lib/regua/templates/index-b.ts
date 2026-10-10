/** Templates da regua, lote B (E11 a E20). */
import { E11 } from './E11'
import { E12 } from './E12'
import { E13 } from './E13'
import { E14 } from './E14'
import { E15 } from './E15'
import { E16 } from './E16'
import { E17 } from './E17'
import { E18 } from './E18'
import { E19 } from './E19'
import { E20 } from './E20'

export const TEMPLATES_B = { E11, E12, E13, E14, E15, E16, E17, E18, E19, E20 } as const

export type IdTemplateB = keyof typeof TEMPLATES_B
