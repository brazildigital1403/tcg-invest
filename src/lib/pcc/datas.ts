// Datas do Poke Creators Club (08/11/2026). Tudo em horario de Brasilia, comum
// aos Aniversariantes e a Agenda.

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export type Dia = { ano: number; mes: number; dia: number }
export type MesAno = { ano: number; mes: number }

export function hojeBrasilia(agora = new Date()): Dia {
  const [ano, mes, dia] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora).split('-').map(Number)
  return { ano, mes, dia }
}

export const bissexto = (ano: number) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0

/** Maior dia possivel do mes (fevereiro conta 29, para aceitar a data sem ano). */
export function diasDoMes(mes: number): number {
  return mes === 2 ? 29 : [4, 6, 9, 11].includes(mes) ? 30 : 31
}

/** Anda `delta` meses a partir de `m`, virando o ano quando precisa. */
export function trocarMes(m: MesAno, delta: number): MesAno {
  const t = m.mes - 1 + delta
  return { ano: m.ano + Math.floor(t / 12), mes: ((t % 12) + 12) % 12 + 1 }
}

export const quandoTexto = (emDias: number) => (emDias === 0 ? 'Hoje' : emDias === 1 ? 'amanhã' : `em ${emDias} dias`)
