/**
 * Datas do motor, sempre em America/Sao_Paulo. Banco, logs e Vercel cron
 * falam UTC; o que a pessoa le e o calendario da regua sao Brasilia.
 */

const TZ = 'America/Sao_Paulo'
export const DIA_MS = 86_400_000

/** "2026-10-08" (dia de Brasilia) de um instante. */
export function diaBR(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Soma dias a um "YYYY-MM-DD" (aritmetica de calendario, sem fuso). */
export function somarDias(dia: string, n: number): string {
  const t = Date.parse(`${dia}T12:00:00Z`) + n * DIA_MS
  return new Date(t).toISOString().slice(0, 10)
}

/** Dias inteiros entre dois "YYYY-MM-DD" (b - a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA_MS)
}

/** "2026-10-08" -> "08/10". */
export function ddmm(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
}

/** Hora cheia de Brasilia de um instante: "14h" (ou "14h30"). */
export function horaBR(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(d).split(':')
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`
}

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "quarta, 14/10, às 14h" (fim do teste do Pro, E03). */
export function porExtensoComHora(iso: string): string {
  const d = new Date(iso)
  const dia = diaBR(d)
  const sem = SEMANA[new Date(`${dia}T12:00:00Z`).getUTCDay()]
  return `${sem}, ${ddmm(dia)}, às ${horaBR(d)}`
}

/** Mes por extenso, minusculo, de um "YYYY-MM-DD": "maio". */
export function mesPorExtenso(dia: string): string {
  return MESES[Number(dia.slice(5, 7)) - 1]
}

/** "18 de maio" de um "YYYY-MM-DD". */
export function diaDeMes(dia: string): string {
  return `${Number(dia.slice(8, 10))} de ${mesPorExtenso(dia)}`
}

/** Dia de Brasilia de um timestamp do banco (com ou sem fuso; sem fuso = UTC). */
export function diaDoBanco(ts: string | null | undefined): string | null {
  if (!ts) return null
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : `${ts}Z`
  const t = Date.parse(iso)
  return Number.isFinite(t) ? diaBR(new Date(t)) : null
}

/** Instante (ms) de um timestamp do banco; sem fuso = UTC. */
export function msDoBanco(ts: string | null | undefined): number | null {
  if (!ts) return null
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : `${ts}Z`
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}
