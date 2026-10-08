/**
 * Motor da regua: chave geral, calendario aprovado, limites e contas de teste.
 *
 * ★ CHAVE GERAL: `process.env.REGUA_ATIVA`. Qualquer valor diferente de '1'
 * = MODO SIMULACAO: o motor calcula tudo, grava em `email_envios` com status
 * 'simulado' e NAO chama o Resend nem aquece a CDN. Ninguem recebe nada ate o
 * Du ligar a chave na Vercel.
 *
 * ★ CALENDARIO: as datas sao as do cronograma aprovado (estrategia.md e
 * BRIEFS.md, Semana 0 = 12/10/2026), em Brasilia. Ligar a chave antes de uma
 * data NAO antecipa o template: o gatilho so abre no dia. Mudar data e mudar
 * aqui, num lugar so.
 */

export type Modo = 'real' | 'simulacao'

export function reguaAtiva(): boolean {
  return process.env.REGUA_ATIVA === '1'
}

export function modoAtual(): Modo {
  return reguaAtiva() ? 'real' : 'simulacao'
}

/** Inicio de cada gatilho de EVENTO (YYYY-MM-DD, Brasilia). */
export const INICIO: Record<string, string> = {
  E02: '2026-10-27',
  E03: '2026-10-27',
  E04: '2026-10-27',
  E05: '2026-10-27',
  E07: '2026-11-05',
  E08: '2026-11-05',
  E09: '2026-11-05',
  E20: '2026-11-17',
  E16: '2027-01-05',
}

/** E06: sexta quinzenal a partir de 06/11 (06/11, 20/11, 04/12, 18/12, ...). */
export const E06_PRIMEIRA = '2026-11-06'
export const E06_INTERVALO_DIAS = 14

/** E15: os 3 toques do winback (pula a semana da Black Friday). */
export const E15_TOQUES: string[] = ['2026-11-12', '2026-11-19', '2026-12-01']

/**
 * A substituicao decidida: com a chave ligada E o gatilho aberto, o welcome
 * atual (/api/email/welcome) da lugar ao E02 e os avisos D-2/D-1 do
 * cron-trial-emails dao lugar ao E05. Chave desligada: tudo como hoje.
 * As duas pontas leem DAQUI, para nunca haver dia sem nenhum dos dois.
 */
export function e02Substitui(hoje: string): boolean {
  return reguaAtiva() && hoje >= INICIO.E02
}
export function e05Substitui(hoje: string): boolean {
  return reguaAtiva() && hoje >= INICIO.E05
}

// ─── Limites ────────────────────────────────────────────────────────────────

/** Teto de e-mails de MARKETING (mercado/novidades/radar) por pessoa em 7 dias. */
export const TETO_MARKETING_SEMANA = 2

/**
 * Templates de categoria de marketing que ficam FORA do teto (estrategia,
 * principio 6): ativacao (E03, E04) e alerta com limite proprio (E09).
 */
export const FORA_DO_TETO = new Set(['E03', 'E04', 'E09'])

/** E08: limiar (BRIEFS decisao 7) e frequencia. */
export const E08_LIMIAR = { pct: 15, reais: 10 }
export const E08_MAX_DIA = 1
export const E08_MAX_SEMANA = 3

/** E09: frequencia por pessoa. */
export const E09_MAX_DIA = 1
export const E09_MAX_SEMANA = 2

/**
 * Variacao acima disto (em modulo) e tratada como preco fora da curva e nao
 * entra em alerta nem em gancho. Mesmo teto do mv_price_movers (80%): ja houve
 * 529 cartas com preco 5x fora da propria mediana (quarentena de preco).
 */
export const PCT_SUSPEITO = 80

/** Status de `email_envios` que contam para teto e dedup (o envio saiu ou esta saindo). */
export const STATUS_QUE_CONTAM = ['enviando', 'enviado', 'entregue', 'aberto', 'clicado', 'bounce', 'reclamacao']

/** Sufixo de campanha dos envios de teste (lista de e-mails do admin): nao contam. */
export const SUFIXO_TESTE = ':teste'

// ─── Contas de teste (nunca entram em publico automatico) ──────────────────

/** E-mails internos/de teste. Conta do irmao do Du: interna, nao e usuario externo. */
export const EMAILS_TESTE = new Set(['pafernando.silva@gmail.com'])

export function ehContaDeTeste(email: string | null | undefined): boolean {
  const e = (email || '').trim().toLowerCase()
  if (!e) return true
  if (EMAILS_TESTE.has(e)) return true
  const [local, dominio = ''] = e.split('@')
  if (local === 'eduardo') return true
  if (dominio.includes('brazildigital')) return true
  return false
}

/** Loja de teste: o dono sai de todo publico (busca por nome, ver banco.ts). */
export const LOJAS_TESTE_NOME = ['vulcano cards']

// ─── Orcamento de tempo ─────────────────────────────────────────────────────

/** maxDuration das rotas do motor (vercel.json + export da rota). */
export const MAX_DURACAO_S = 60
/** Para de COMECAR trabalho novo depois disto; o resto fica para o proximo tick. */
export const ORCAMENTO_MS = 42_000
/** Resend: ate 100 e-mails por chamada de batch. */
export const LOTE_RESEND = 100
