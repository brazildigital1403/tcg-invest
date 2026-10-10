/**
 * Variantes aprovadas da regua (o "B" de cada template): a mesma trilha e o
 * mesmo gatilho do principal, para o publico que o principal nao cobre.
 * Cada uma e um template proprio (id E01B, E03B...), registrado ao lado do
 * principal em `registro.ts`; o motor escolhe uma OU outra por pessoa.
 */
import { E01B } from './E01B'
import { E03B } from './E03B'
import { E04B } from './E04B'
import { E06B } from './E06B'
import { E17B } from './E17B'

export const TEMPLATES_VARIANTES = { E01B, E03B, E04B, E06B, E17B } as const

export type IdTemplateVariante = keyof typeof TEMPLATES_VARIANTES
