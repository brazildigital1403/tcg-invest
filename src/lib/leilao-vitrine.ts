/**
 * Vitrine do Bynx Leiloes (/leiloes) — funcoes puras (sem I/O, sem Supabase).
 * Rodam no servidor (pagina), no cliente (botao "Adicionar à agenda") e no
 * autoteste (scripts/leilao-selftest.mjs).
 *
 * Tudo que vira numero na tela sai de dado do banco ou de constante do motor
 * (taxa em leilao-taxas.ts, prazo aqui, espelhando o SQL). Nada digitado.
 */

import { dataBrasiliaISO, formatarBRL, formatarTempoRestante } from './leilao'
import { LEILAO_PROTECAO_MIN_CENTS, LEILAO_PROTECAO_PCT } from './leilao-taxas'

// ─── Regras do motor mostradas na vitrine ───────────────────────────────────

/**
 * Prazo para pagar o arremate, em horas. ★ ESPELHO do SQL: `pagar_ate = now()
 * + interval '48 hours'` em supabase/migrations/20260928090000_leilao_motor.sql.
 * O autoteste le a migration e falha se os dois divergirem.
 */
export const PRAZO_PAGAMENTO_ARREMATE_HORAS = 48

/** "5% (mínimo R$ 2,00)", lido de leilao-taxas.ts. */
export function rotuloTaxaProtecao(): string {
  const pct = (LEILAO_PROTECAO_PCT * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  return `${pct}% (mínimo ${formatarBRL(LEILAO_PROTECAO_MIN_CENTS)})`
}

// ─── Tempo ──────────────────────────────────────────────────────────────────

/**
 * "começa em 12 min" / "começa em 1h 14min" / "começa em 2d 3h". Minuto e a
 * menor unidade: o texto nao tica por segundo. Ja passou (a rodada ainda nao
 * abriu): "começa em instantes".
 */
export function textoComecaEm(ms: number): string {
  if (!Number.isFinite(ms) || ms < 60_000) return 'começa em instantes'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `começa em ${min} min`
  return `começa em ${formatarTempoRestante(ms)}`
}

const FMT_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

/** "19h" / "19h30" em Brasilia. "--" se nao ha horario. */
export function horaCurtaBrasilia(iso: string | null | undefined): string {
  if (!iso) return '--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--'
  const p: Record<string, string> = {}
  for (const part of FMT_HORA.formatToParts(d)) p[part.type] = part.value
  const h = String(Number(p.hour === '24' ? '0' : p.hour))
  return p.minute === '00' ? `${h}h` : `${h}h${p.minute}`
}

/** "Hoje, 19h" / "Amanhã, 21h30" / "Sáb 04/10, 19h" (Brasilia). */
export function quandoRodada(iso: string | null | undefined, agoraMs: number): string {
  if (!iso) return ''
  const dia = dataBrasiliaISO(iso)
  if (!dia) return ''
  const hora = horaCurtaBrasilia(iso)
  if (dia === dataBrasiliaISO(agoraMs)) return `Hoje, ${hora}`
  if (dia === dataBrasiliaISO(agoraMs + DIA_MS)) return `Amanhã, ${hora}`
  const rot = rotuloDiaSemana(dia)
  return `${rot.charAt(0)}${rot.slice(1).toLowerCase()} ${dia.slice(8, 10)}/${dia.slice(5, 7)}, ${hora}`
}

// ─── Semana (Brasilia) ──────────────────────────────────────────────────────

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'] as const
const DIA_MS = 24 * 60 * 60 * 1000

export interface DiaDaSemana<T> {
  /** "2026-09-29" em Brasilia. */
  dataISO: string
  /** "SEG" */
  rotulo: string
  /** 29 */
  dia: number
  hoje: boolean
  itens: T[]
}

/** Dia da semana de uma data "AAAA-MM-DD" (sem fuso: a data ja e de Brasilia). */
export function rotuloDiaSemana(dataISO: string): string {
  const [a, m, d] = dataISO.split('-').map(Number)
  if (!a || !m || !d) return ''
  return DIAS_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]
}

/**
 * Os 7 dias a partir de hoje (Brasilia), cada um com os itens cujo
 * `iniciaEm` cai nele, na ordem do horario. Item fora da janela (ou sem
 * horario) fica de fora. Brasil sem horario de verao desde 2019: somar 24h
 * anda exatamente um dia no calendario de Brasilia.
 */
export function agruparSemana<T extends { iniciaEm: string | null }>(itens: readonly T[], agoraMs: number): DiaDaSemana<T>[] {
  const dias: DiaDaSemana<T>[] = []
  const porData = new Map<string, DiaDaSemana<T>>()
  for (let i = 0; i < 7; i++) {
    const dataISO = dataBrasiliaISO(agoraMs + i * DIA_MS)
    const d: DiaDaSemana<T> = {
      dataISO,
      rotulo: rotuloDiaSemana(dataISO),
      dia: Number(dataISO.slice(8, 10)),
      hoje: i === 0,
      itens: [],
    }
    dias.push(d)
    porData.set(dataISO, d)
  }
  const ordenados = [...itens].sort((a, b) => Date.parse(a.iniciaEm ?? '') - Date.parse(b.iniciaEm ?? ''))
  for (const it of ordenados) {
    if (!it.iniciaEm) continue
    const d = porData.get(dataBrasiliaISO(it.iniciaEm))
    if (d) d.itens.push(it)
  }
  return dias
}

/** Semana sem nenhuma rodada: a secao some. */
export function semanaVazia(dias: ReadonlyArray<DiaDaSemana<unknown>>): boolean {
  return dias.every(d => d.itens.length === 0)
}

// ─── Palco (rodada no ar em destaque) ───────────────────────────────────────

/** Estado do lote NO AR de uma rodada ao vivo, para escolher o palco. */
export interface LoteNoArResumo {
  nLances: number
  terminaEm: string | null
}

/**
 * Com varias rodadas ao vivo, o palco fica com a MAIS MOVIMENTADA: a que tem
 * mais lances (n_lances) no lote no ar. Empate: a que termina primeiro
 * (termina_em do lote no ar; sem prazo vai para o fim). Ultimo desempate:
 * numero da rodada (estavel). Rodada sem lote no ar conta como 0 lance e sem
 * prazo. As demais saem na mesma ordem, para "Também ao vivo".
 */
export function escolherPalcoAoVivo<T extends { id: string; numero: number }>(
  rodadas: readonly T[],
  loteNoAr: (rodadaId: string) => LoteNoArResumo | null | undefined
): { destaque: T | null; outras: T[] } {
  const prazo = (iso: string | null | undefined) => {
    const t = iso ? Date.parse(iso) : NaN
    return Number.isFinite(t) ? t : Infinity
  }
  const chave = new Map(
    rodadas.map(r => {
      const l = loteNoAr(r.id)
      const n = Number(l?.nLances)
      return [r.id, { n: Number.isFinite(n) && n > 0 ? n : 0, fim: prazo(l?.terminaEm) }] as const
    })
  )
  const ordenadas = [...rodadas].sort((a, b) => {
    const ka = chave.get(a.id)!, kb = chave.get(b.id)!
    return kb.n - ka.n || (ka.fim === kb.fim ? 0 : ka.fim < kb.fim ? -1 : 1) || a.numero - b.numero
  })
  return { destaque: ordenadas[0] ?? null, outras: ordenadas.slice(1) }
}

// ─── Lojas ──────────────────────────────────────────────────────────────────

/**
 * ★ REGRA UNICA de "quantas rodadas a loja fez" (vitrine e pagina da rodada
 * leem daqui; antes cada tela contava de um jeito e divergiam, 5 x 4).
 *
 * Conta so rodada que JA FOI AO AR: `ao_vivo` ou `encerrada`. Fica de fora
 * `agendada` (ainda nao aconteceu, pode ser cancelada), `cancelada` e
 * `rascunho`. A rodada no ar agora conta.
 */
export const STATUS_RODADA_FOI_AO_AR = ['ao_vivo', 'encerrada'] as const

export function rodadaFoiAoAr(status: string | null | undefined): boolean {
  return (STATUS_RODADA_FOI_AO_AR as readonly string[]).includes(status ?? '')
}

/** Contagem por loja a partir das linhas de `leilao_rodadas`, pela regra acima. */
export function contarRodadasPorLoja(
  linhas: ReadonlyArray<{ loja_id: string | null; status: string | null }>
): Map<string, number> {
  const mapa = new Map<string, number>()
  for (const r of linhas) {
    if (!r.loja_id || !rodadaFoiAoAr(r.status)) continue
    mapa.set(r.loja_id, (mapa.get(r.loja_id) ?? 0) + 1)
  }
  return mapa
}

/** "1 rodada" / "6 rodadas". */
export function rotuloRodadas(n: number): string {
  return n === 1 ? '1 rodada' : `${n} rodadas`
}

/**
 * "4,9 de 5 (32 avaliações)" a partir das estrelas reais. Sem avaliacao:
 * "Loja nova na Bynx" (regra da casa: nunca nota inventada nem zero).
 */
export function rotuloAvaliacao(estrelas: readonly number[]): string {
  const validas = estrelas.filter(e => Number.isFinite(e) && e >= 1 && e <= 5)
  if (!validas.length) return 'Loja nova na Bynx'
  const media = validas.reduce((s, e) => s + e, 0) / validas.length
  const txt = (Math.round(media * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  return `${txt} de 5 (${validas.length === 1 ? '1 avaliação' : `${validas.length} avaliações`})`
}

// ─── .ics (Adicionar à agenda) ──────────────────────────────────────────────

/** Duracao do evento na agenda: a rodada nao tem fim marcado no banco. */
export const DURACAO_EVENTO_AGENDA_MIN = 60

function dataIcs(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Escapa texto de propriedade do iCalendar (RFC 5545, 3.3.11). */
export function escaparIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Dobra linha com mais de 75 octetos (RFC 5545, 3.1). */
function dobrar(linha: string): string {
  const enc = new TextEncoder()
  if (enc.encode(linha).length <= 75) return linha
  const partes: string[] = []
  let atual = ''
  for (const ch of linha) {
    const limite = partes.length === 0 ? 75 : 74
    if (enc.encode(atual + ch).length > limite) {
      partes.push(atual)
      atual = ch
    } else {
      atual += ch
    }
  }
  if (atual) partes.push(atual)
  return partes.join('\r\n ')
}

export interface EventoRodada {
  numero: number
  titulo: string
  /** ISO do inicio (UTC ou com offset). */
  iniciaEm: string
  /** URL absoluta da rodada. */
  url: string
  descricao?: string | null
  /** Carimbo DTSTAMP (ms). */
  agoraMs: number
}

/**
 * Arquivo .ics de UMA rodada (gerado no aparelho, sem banco). Horario em UTC
 * (sufixo Z): cada agenda converte para o fuso de quem baixou. null se o
 * horario nao vale.
 */
export function gerarIcsRodada(e: EventoRodada): string | null {
  const ini = Date.parse(e.iniciaEm)
  if (!Number.isFinite(ini) || !Number.isFinite(e.agoraMs)) return null
  const fim = ini + DURACAO_EVENTO_AGENDA_MIN * 60_000
  const desc = [e.descricao?.trim(), e.url].filter(Boolean).join('\n')
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bynx//Leiloes//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:rodada-${e.numero}@bynx.gg`,
    `DTSTAMP:${dataIcs(e.agoraMs)}`,
    `DTSTART:${dataIcs(ini)}`,
    `DTEND:${dataIcs(fim)}`,
    `SUMMARY:${escaparIcs(e.titulo)}`,
    `DESCRIPTION:${escaparIcs(desc)}`,
    `URL:${e.url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escaparIcs(e.titulo)}`,
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return linhas.map(dobrar).join('\r\n') + '\r\n'
}

/** Nome do arquivo baixado: "bynx-rodada-42.ics". */
export function nomeArquivoIcs(numero: number): string {
  return `bynx-rodada-${numero}.ics`
}
