/**
 * Leilao da Bynx — PLANO dos avisos (funcoes puras, sem I/O).
 *
 * Recebe os eventos reservados da fila `leilao_eventos` + o retrato atual dos
 * lotes e devolve, por evento, o que sai: sinos (gravados pelo banco, na mesma
 * transacao que marca o evento) e e-mails (enviados em lote pela rota).
 * Consumidor: /api/cron-leilao-avisos. Testado em scripts/leilao-selftest.mjs.
 *
 * Matriz (fatia 3):
 *   superado  -> sino + e-mail. E-mail no maximo 1 por usuario + lote a cada
 *                10 min, e nunca nos ultimos 15 min do lote (so sino). Varios
 *                superados do mesmo usuario + lote no mesmo lote de eventos
 *                viram UM aviso (o mais recente); os outros so fecham.
 *                Quem ja voltou a liderar nao recebe nada.
 *   venceu    -> sino + e-mail imediato com o prazo. So se o lote ainda
 *                aguarda pagamento deste usuario.
 *   encerrado -> so quando terminou sem lances: sino + e-mail ao vendedor.
 *   calote    -> sino + e-mail ao vencedor e ao vendedor. So se o lote ainda
 *                esta em calote (pagamento tardio reverte para vendido).
 *   cancelado -> so sino ao SEGUIDOR (user_id do evento), sem e-mail. Nasce
 *                em leilao_cancelar_rodada (migration 20260928130000): um
 *                evento por seguidor de cada lote cancelado. So se o lote
 *                ainda esta cancelado.
 *   pago, reembolsado, iniciado, teto_ajustado, erro_tick -> nada.
 *
 * ★ Tudo e conferido contra o ESTADO ATUAL do lote, nao so contra o evento:
 *   o evento pode ter ficado velho na fila (retry, cron parado).
 */

import { formatarBRL } from './leilao'

export const DEBOUNCE_SUPERADO_MS = 10 * 60 * 1000
export const SEM_EMAIL_FINAL_MS = 15 * 60 * 1000

export type TipoEvento =
  | 'superado' | 'encerrado' | 'venceu' | 'calote'
  | 'iniciado' | 'teto_ajustado' | 'erro_tick' | 'pago' | 'reembolsado' | 'cancelado'

/** Linha devolvida por leilao_eventos_reservar. */
export interface EventoReservado {
  id: number
  leilao_id: string | null
  tipo: string
  user_id: string | null
  payload: Record<string, unknown> | null
  created_at: string
  tentativas: number
  sino_em: string | null
  email_em: string | null
  ultimo_email_superado_em: string | null
}

/** Retrato atual do lote (service_role, tabela leiloes). */
export interface LoteAviso {
  id: string
  slug: string
  card_name: string
  status: string
  termina_em: string | null
  pagar_ate: string | null
  lider_user_id: string | null
  vendedor_user_id: string
  preco_atual_cents: number | null
}

export type ModeloEmail =
  | 'superado' | 'venceu' | 'sem_lances' | 'calote_vencedor' | 'calote_vendedor'

export interface SinoPlanejado {
  user_id: string
  title: string
  message: string
  data: Record<string, unknown>
}

export interface EmailPlanejado {
  modelo: ModeloEmail
  userId: string
  lote: LoteAviso
  /** Valores ja resolvidos para o template. */
  precoCents: number
  minimoProximoCents?: number
  pagarAte?: string | null
}

export interface PlanoEvento {
  id: number
  sinos: SinoPlanejado[]
  emails: EmailPlanejado[]
  /** Motivo quando nada sai (log/diagnostico). */
  nota?: string
}

// ─── Formatacao ─────────────────────────────────────────────────────────────

const FMT_CURTO = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** "27/09 21:30" em America/Sao_Paulo. Vazio se a data nao vale. */
export function prazoCurtoBrasilia(date: Date | string | number | null | undefined): string {
  if (date == null) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const p: Record<string, string> = {}
  for (const part of FMT_CURTO.formatToParts(d)) p[part.type] = part.value
  const hora = p.hour === '24' ? '00' : p.hour
  return `${p.day}/${p.month} ${hora}:${p.minute}`
}

export function linkLote(slug: string): string {
  return `/leiloes/${slug}`
}

function ms(iso: string | null | undefined): number {
  if (!iso) return NaN
  return new Date(iso).getTime()
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

function sino(userId: string, lote: LoteAviso, title: string, message: string, evento: number): SinoPlanejado {
  return {
    user_id: userId,
    title,
    message,
    data: { link: linkLote(lote.slug), leilao_id: lote.id, evento_id: evento },
  }
}

// ─── Plano ──────────────────────────────────────────────────────────────────

/**
 * Um plano por evento, na MESMA ordem de `eventos`. Evento sem aviso sai com
 * sinos/emails vazios (a rota so finaliza).
 */
export function planejarAvisos(
  eventos: EventoReservado[],
  lotes: Map<string, LoteAviso>,
  agoraMs: number,
): PlanoEvento[] {
  // superado: so o mais recente de cada usuario + lote conta.
  const ultimoSuperado = new Map<string, number>()
  for (const e of eventos) {
    if (e.tipo !== 'superado' || !e.leilao_id || !e.user_id) continue
    const k = `${e.leilao_id}:${e.user_id}`
    ultimoSuperado.set(k, Math.max(ultimoSuperado.get(k) ?? -Infinity, e.id))
  }

  return eventos.map((e): PlanoEvento => {
    const vazio = (nota: string): PlanoEvento => ({ id: e.id, sinos: [], emails: [], nota })
    const lote = e.leilao_id ? lotes.get(e.leilao_id) : undefined
    if (!lote) return vazio('sem_lote')
    const nome = lote.card_name
    const payload = e.payload ?? {}

    switch (e.tipo) {
      case 'superado': {
        if (!e.user_id) return vazio('sem_usuario')
        if (ultimoSuperado.get(`${e.leilao_id}:${e.user_id}`) !== e.id) return vazio('agrupado')
        if (lote.lider_user_id === e.user_id) return vazio('voltou_a_liderar')
        const preco = lote.preco_atual_cents ?? num(payload.preco_cents) ?? 0
        // O minimo do payload envelhece se houve lance depois; so vale quando o
        // preco ainda e o do evento. Senao, o e-mail cita so o preco atual.
        const minPayload = num(payload.minimo_proximo_cents)
        const minimo = num(payload.preco_cents) === preco && minPayload ? minPayload : undefined
        const sinos = [sino(
          e.user_id, lote, 'Seu lance foi superado',
          `${nome}: lance atual ${formatarBRL(preco)}.`, e.id,
        )]
        const fimMs = ms(lote.termina_em)
        const ultimoEmail = ms(e.ultimo_email_superado_em)
        const podeEmail =
          lote.status === 'ativo' &&
          Number.isFinite(fimMs) && fimMs - agoraMs >= SEM_EMAIL_FINAL_MS &&
          !(Number.isFinite(ultimoEmail) && agoraMs - ultimoEmail < DEBOUNCE_SUPERADO_MS) &&
          !e.email_em
        return {
          id: e.id,
          sinos,
          emails: podeEmail
            ? [{ modelo: 'superado', userId: e.user_id, lote, precoCents: preco, minimoProximoCents: minimo }]
            : [],
          nota: podeEmail ? undefined : 'so_sino',
        }
      }

      case 'venceu': {
        if (!e.user_id) return vazio('sem_usuario')
        if (lote.status !== 'aguardando_pagamento' || lote.lider_user_id !== e.user_id) {
          return vazio(`lote_${lote.status}`)
        }
        const preco = lote.preco_atual_cents ?? num(payload.preco_cents) ?? 0
        const pagarAte = lote.pagar_ate ?? (typeof payload.pagar_ate === 'string' ? payload.pagar_ate : null)
        const prazo = prazoCurtoBrasilia(pagarAte)
        return {
          id: e.id,
          sinos: [sino(
            e.user_id, lote, `Você venceu: ${nome}`,
            prazo ? `Pague até ${prazo} (Brasília).` : 'Pague para garantir o arremate.', e.id,
          )],
          emails: e.email_em ? [] : [{ modelo: 'venceu', userId: e.user_id, lote, precoCents: preco, pagarAte }],
        }
      }

      case 'encerrado': {
        if (payload.resultado !== 'sem_lances' || lote.status !== 'sem_lances') return vazio('com_vencedor')
        return {
          id: e.id,
          sinos: [sino(
            lote.vendedor_user_id, lote, 'Lote encerrado sem lances',
            `${nome} terminou sem nenhum lance.`, e.id,
          )],
          emails: e.email_em ? [] : [{ modelo: 'sem_lances', userId: lote.vendedor_user_id, lote, precoCents: 0 }],
        }
      }

      case 'calote': {
        if (lote.status !== 'calote') return vazio(`lote_${lote.status}`)
        const preco = lote.preco_atual_cents ?? 0
        const sinos: SinoPlanejado[] = []
        const emails: EmailPlanejado[] = []
        if (e.user_id) {
          sinos.push(sino(e.user_id, lote, 'Prazo de pagamento encerrado',
            `O pagamento de ${nome} não foi confirmado a tempo.`, e.id))
          emails.push({ modelo: 'calote_vencedor', userId: e.user_id, lote, precoCents: preco, pagarAte: lote.pagar_ate })
        }
        sinos.push(sino(lote.vendedor_user_id, lote, 'Arremate não pago',
          `O vencedor de ${nome} não pagou dentro do prazo.`, e.id))
        emails.push({ modelo: 'calote_vendedor', userId: lote.vendedor_user_id, lote, precoCents: preco, pagarAte: lote.pagar_ate })
        return { id: e.id, sinos, emails: e.email_em ? [] : emails }
      }

      case 'cancelado': {
        // Rodada cancelada pela loja antes de abrir: aviso so no sino.
        if (!e.user_id) return vazio('sem_usuario')
        if (lote.status !== 'cancelado') return vazio(`lote_${lote.status}`)
        return {
          id: e.id,
          sinos: [sino(
            e.user_id, lote, 'Leilão cancelado',
            `A loja cancelou o leilão de ${nome}. Ele não vai mais acontecer.`, e.id,
          )],
          emails: [],
        }
      }

      default:
        return vazio('sem_aviso')
    }
  })
}

/** E-mail valido o bastante para nao derrubar o lote inteiro no provedor. */
export function emailEnviavel(email: string | null | undefined): boolean {
  return typeof email === 'string' && /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email.trim())
}
