// Webhook do Resend (regua F0, card #296).
//
// Sem isto a Bynx manda e-mail e fica cega: nao sabe o que foi entregue,
// aberto ou clicado, e -- o que pesa na reputacao -- nao sabe quem reclamou
// de spam ou deu bounce permanente, e continua mandando para essa pessoa.
//
// ★ ASSINATURA OBRIGATORIA. O Resend assina com Svix (headers svix-id,
//   svix-timestamp, svix-signature). O segredo fica na env
//   RESEND_WEBHOOK_SECRET, colado direto na Vercel. Sem a env a rota responde
//   503 e loga: NUNCA processa um evento sem verificar, porque o efeito
//   colateral (descadastrar alguem) e acionavel por qualquer um que saiba a URL.
//
// ★ IDEMPOTENTE. O Svix re-entrega. Cada timestamp so e gravado se ainda for
//   nulo (o primeiro evento vence), o status so avanca, e o opt-out e um
//   `update ... set true`, que repetido da o mesmo resultado.
//
// ★ Sem dependencia nova: a verificacao Svix e um HMAC-SHA256 em base64 sobre
//   `${id}.${timestamp}.${corpo}`. Feito aqui com node:crypto.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Tolerancia de relogio do Svix: 5 minutos para cada lado. */
const TOLERANCIA_S = 5 * 60

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

/** `ilike` sem curinga: `_` e `%` num e-mail casariam OUTRA conta. */
function semCuringa(email: string): string {
  return email.replace(/[\\%_]/g, (c) => `\\${c}`)
}

function verificarSvix(segredo: string, id: string, ts: string, assinaturas: string, corpo: string): boolean {
  const tsNum = Number(ts)
  if (!Number.isFinite(tsNum)) return false
  if (Math.abs(Date.now() / 1000 - tsNum) > TOLERANCIA_S) return false

  const chave = Buffer.from(segredo.startsWith('whsec_') ? segredo.slice(6) : segredo, 'base64')
  const esperado = createHmac('sha256', chave).update(`${id}.${ts}.${corpo}`).digest()

  // O header pode trazer varias assinaturas ("v1,abc v1,def") durante rotacao.
  for (const parte of assinaturas.split(' ')) {
    const [versao, valor] = parte.split(',')
    if (versao !== 'v1' || !valor) continue
    const recebido = Buffer.from(valor, 'base64')
    if (recebido.length === esperado.length && timingSafeEqual(recebido, esperado)) return true
  }
  return false
}

type DadosEvento = { email_id?: string; to?: string | string[]; bounce?: { type?: string } }

// Ordem do status: so avanca. bounce e reclamacao sao terminais.
const ORDEM = ['enviado', 'entregue', 'aberto', 'clicado'] as const
type Evento = 'email.delivered' | 'email.opened' | 'email.clicked' | 'email.bounced' | 'email.complained'

const MAPA: Record<Evento, { coluna: string; status: string; podeSobrescrever: string[] }> = {
  'email.delivered':  { coluna: 'entregue_em',   status: 'entregue',   podeSobrescrever: ['enviado'] },
  'email.opened':     { coluna: 'aberto_em',     status: 'aberto',     podeSobrescrever: ['enviado', 'entregue'] },
  'email.clicked':    { coluna: 'clicado_em',    status: 'clicado',    podeSobrescrever: ['enviado', 'entregue', 'aberto'] },
  'email.bounced':    { coluna: 'bounce_em',     status: 'bounce',     podeSobrescrever: [...ORDEM] },
  'email.complained': { coluna: 'reclamacao_em', status: 'reclamacao', podeSobrescrever: [...ORDEM, 'bounce'] },
}

/**
 * Bounce permanente? O Resend manda `data.bounce.type` ("Permanent" /
 * "Transient" / "Undetermined"). So o permanente descadastra: caixa cheia
 * nao e motivo para tirar alguem da lista. Sem o campo, NAO descadastra --
 * fica registrado no log e o Resend ja suprime hard bounce do lado dele.
 */
function bouncePermanente(data: DadosEvento): boolean {
  const tipo = String(data?.bounce?.type ?? '').toLowerCase()
  return tipo === 'permanent' || tipo === 'hard'
}

export async function POST(req: NextRequest) {
  const segredo = process.env.RESEND_WEBHOOK_SECRET
  if (!segredo) {
    console.error('[resend/webhook] RESEND_WEBHOOK_SECRET ausente -- evento recusado sem processar')
    return NextResponse.json({ error: 'webhook nao configurado' }, { status: 503 })
  }

  const corpo = await req.text()
  const id = req.headers.get('svix-id') || ''
  const ts = req.headers.get('svix-timestamp') || ''
  const assinatura = req.headers.get('svix-signature') || ''
  if (!id || !ts || !assinatura || !verificarSvix(segredo, id, ts, assinatura, corpo)) {
    console.warn('[resend/webhook] assinatura invalida ou ausente')
    return NextResponse.json({ error: 'assinatura invalida' }, { status: 401 })
  }

  let evento: { type?: string; created_at?: string; data?: DadosEvento }
  try { evento = JSON.parse(corpo) } catch {
    return NextResponse.json({ error: 'corpo invalido' }, { status: 400 })
  }

  const tipo = evento?.type as Evento
  const regra = MAPA[tipo] as (typeof MAPA)[Evento] | undefined
  // Evento que nao acompanhamos (sent, delivery_delayed, ...): 200 para o
  // Svix nao ficar re-entregando.
  if (!regra) return NextResponse.json({ ok: true, ignorado: tipo ?? null })

  const data: DadosEvento = evento?.data ?? {}
  const resendId: string | undefined = data.email_id
  const quando = typeof evento?.created_at === 'string' ? evento.created_at : new Date().toISOString()
  const sb = supabaseAdmin()

  // ── 1. Atualiza o log (se o envio esta nele) ──────────────────────────────
  let userIdDoLog: string | null = null
  if (resendId) {
    // Timestamp: so grava o primeiro (is null). Re-entrega nao mexe.
    const t = await sb.from('email_envios')
      .update({ [regra.coluna]: quando })
      .eq('resend_id', resendId)
      .is(regra.coluna, null)
    // Status: so avanca.
    const s = await sb.from('email_envios')
      .update({ status: regra.status })
      .eq('resend_id', resendId)
      .in('status', regra.podeSobrescrever)
    const erro = t.error || s.error
    if (erro) {
      // 500 para o Svix tentar de novo: o update e idempotente.
      console.error('[resend/webhook] falha ao atualizar email_envios:', erro.message)
      return NextResponse.json({ error: 'falha ao gravar' }, { status: 500 })
    }
    const { data: linha } = await sb.from('email_envios').select('user_id').eq('resend_id', resendId).limit(1)
    userIdDoLog = linha?.[0]?.user_id ?? null
  }

  // ── 2. Reclamacao ou bounce permanente: tira da lista de relacionamento ──
  const descadastrar = tipo === 'email.complained' || (tipo === 'email.bounced' && bouncePermanente(data))
  if (descadastrar) {
    const destinos: string[] = Array.isArray(data.to) ? data.to : (data.to ? [data.to] : [])
    let q
    if (userIdDoLog) {
      q = await sb.from('users').update({ email_optout_nurture: true }).eq('id', userIdDoLog).select('id')
    } else if (destinos.length) {
      // Envio fora do log (contato, ou anterior ao log): casa pelo endereco.
      q = await sb.from('users').update({ email_optout_nurture: true }).ilike('email', semCuringa(destinos[0])).select('id')
    }
    if (q?.error) {
      console.error('[resend/webhook] falha ao descadastrar:', q.error.message)
      return NextResponse.json({ error: 'falha ao descadastrar' }, { status: 500 })
    }
    console.log(`[resend/webhook] ${tipo} -> email_optout_nurture=true (${q?.data?.length ?? 0} conta)`)
  }

  return NextResponse.json({ ok: true })
}
