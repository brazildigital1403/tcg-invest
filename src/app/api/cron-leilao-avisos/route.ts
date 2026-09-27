import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  enviarLoteEmails,
  renderLeilaoSuperadoEmail,
  renderLeilaoVenceuEmail,
  renderLeilaoSemLancesEmail,
  renderLeilaoCaloteVencedorEmail,
  renderLeilaoCaloteVendedorEmail,
  type EmailRenderizado,
  type LeilaoEmailArgs,
} from '@/lib/email'
import {
  planejarAvisos,
  emailEnviavel,
  type EventoReservado,
  type LoteAviso,
  type EmailPlanejado,
  type SinoPlanejado,
} from '@/lib/leilao-avisos'

/**
 * GET /api/cron-leilao-avisos  (cron, a cada 1-2 min)
 *
 * Consome a fila `leilao_eventos` e manda os avisos do leilao: sino + e-mail
 * (superado, venceu, sem lances, calote). A matriz e o debounce estao em
 * src/lib/leilao-avisos.ts; a fila segura em
 * supabase/migrations/20260928110000_leilao_avisos.sql.
 *
 * Fluxo de uma execucao:
 *   1. leilao_eventos_reservar(100): reserva atomica (skip locked + prazo de
 *      120s). Duas execucoes juntas nunca pegam o mesmo evento; se esta morrer,
 *      a reserva vence e o evento volta para a fila.
 *   2. Le o estado ATUAL dos lotes e os usuarios envolvidos.
 *   3. Planeja (funcao pura) e renderiza os e-mails.
 *   4. Envia em LOTE (resend.batch.send, ate 100 por chamada) -- nada de um
 *      e-mail por vez (o cron de trial das lojas estourou 30s assim).
 *   5. leilao_eventos_concluir: grava os sinos NA MESMA TRANSACAO que marca o
 *      evento, marca e-mail enviado e finaliza. Evento cujo e-mail falhou volta
 *      para a fila com espera crescente (sino ja gravado nao repete); na 5a
 *      tentativa o banco desiste e registra `ultimo_erro`.
 *
 * Para por volta de 20s: o que nao couber e devolvido para a fila sem gastar
 * tentativa, e a proxima execucao continua.
 *
 * `?dry=1`: reserva, planeja e devolve tudo para a fila SEM enviar e-mail nem
 * gravar sino. Resposta traz o plano (para conferir a matriz sem efeito).
 *
 * Auth: Bearer ${CRON_SECRET} (mesmo padrao dos outros crons).
 *
 * ── COMO REGISTRAR O CRON (decisao do Du; NAO registrado aqui) ─────────────
 * Depois de aplicar 20260928110000_leilao_avisos.sql, em vercel.json:
 *
 *     { "path": "/api/cron-leilao-avisos", "schedule": "* * * * *" }
 *
 * (a cada 1 min; para 2 min, o primeiro campo vira asterisco-barra-2). A Vercel manda o
 * Authorization: Bearer do CRON_SECRET sozinha. Cron por minuto depende do plano
 * da Vercel (conferir). O `maxDuration` fica neste arquivo (30s); o `vercel.json` so
 * precisa da entrada acima. Rollback: remover a entrada -- os eventos ficam
 * pendentes na fila, nada se perde.
 * Monitoria: `select * from leilao_eventos where ultimo_erro is not null`.
 */

export const maxDuration = 30
export const dynamic = 'force-dynamic'

/** Orcamento de tempo da execucao (a funcao morre em maxDuration). */
const ORCAMENTO_MS = 20_000
const LIMITE_EVENTOS = 100

type ItemConclusao = {
  id: number
  /** Gravados pelo banco com type = 'leilao' (NotifType). */
  sinos?: SinoPlanejado[]
  email_ok?: boolean
  finalizar?: boolean
  liberar?: boolean
  erro?: string
}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    { auth: { persistSession: false } },
  )
}

function renderizar(e: EmailPlanejado, to: string, nome: string | null): EmailRenderizado {
  const a: LeilaoEmailArgs = {
    to,
    nome,
    cardName: e.lote.card_name,
    slug: e.lote.slug,
    precoCents: e.precoCents,
    minimoProximoCents: e.minimoProximoCents,
    terminaEm: e.lote.termina_em,
    pagarAte: e.pagarAte ?? e.lote.pagar_ate,
  }
  switch (e.modelo) {
    case 'superado': return renderLeilaoSuperadoEmail(a)
    case 'venceu': return renderLeilaoVenceuEmail(a)
    case 'sem_lances': return renderLeilaoSemLancesEmail(a)
    case 'calote_vencedor': return renderLeilaoCaloteVencedorEmail(a)
    case 'calote_vendedor': return renderLeilaoCaloteVendedorEmail(a)
  }
}

export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const inicio = Date.now()
  const semTempo = () => Date.now() - inicio > ORCAMENTO_MS
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const sb = supabaseAdmin()

  // 1. Reserva.
  const { data: reservados, error: errRes } = await sb.rpc('leilao_eventos_reservar', {
    p_limite: LIMITE_EVENTOS,
    p_reserva_seg: 120,
  })
  if (errRes) {
    console.error('[cron-leilao-avisos] falha ao reservar:', errRes.message)
    return NextResponse.json({ ok: false, erro: 'reservar', detalhe: errRes.message }, { status: 500 })
  }
  const eventos = (reservados ?? []) as EventoReservado[]
  if (eventos.length === 0) {
    return NextResponse.json({ ok: true, eventos: 0 })
  }
  const reserva = (reservados as Array<{ reserva: string }>)[0].reserva

  const concluir = async (itens: ItemConclusao[]) => {
    const { data, error } = await sb.rpc('leilao_eventos_concluir', { p_reserva: reserva, p_itens: itens })
    if (error) {
      // A reserva vence em 120s e os eventos voltam para a fila: nada se perde.
      console.error('[cron-leilao-avisos] falha ao concluir:', error.message)
      return null
    }
    return data as Record<string, number>
  }

  try {
    // 2. Estado atual dos lotes e usuarios.
    const idsLotes = [...new Set(eventos.map(e => e.leilao_id).filter((x): x is string => !!x))]
    const lotes = new Map<string, LoteAviso>()
    if (idsLotes.length > 0) {
      const { data, error } = await sb
        .from('leiloes')
        .select('id, slug, card_name, status, termina_em, pagar_ate, lider_user_id, vendedor_user_id, preco_atual_cents')
        .in('id', idsLotes)
      // ★ Falha de leitura NAO vira "nada a avisar": sem o lote o plano
      //   finalizaria o evento em silencio. Joga para o catch (tudo volta).
      if (error) throw new Error(`leiloes: ${error.message}`)
      for (const l of (data ?? []) as LoteAviso[]) lotes.set(l.id, l)
    }

    const agora = Date.now()
    const planos = planejarAvisos(eventos, lotes, agora)

    const idsUsers = [...new Set(planos.flatMap(p => p.emails.map(e => e.userId)))]
    const users = new Map<string, { name: string | null; email: string | null }>()
    if (idsUsers.length > 0) {
      const { data, error } = await sb.from('users').select('id, name, email').in('id', idsUsers)
      if (error) throw new Error(`users: ${error.message}`)
      for (const u of (data ?? []) as Array<{ id: string; name: string | null; email: string | null }>) {
        users.set(u.id, { name: u.name, email: u.email })
      }
    }

    // 3. Renderiza. Cada e-mail lembra de qual evento veio.
    const fila: EmailRenderizado[] = []
    const eventoDoEmail: number[] = []
    let semEndereco = 0
    for (const p of planos) {
      for (const e of p.emails) {
        const u = users.get(e.userId)
        if (!u || !emailEnviavel(u.email)) { semEndereco++; continue }
        fila.push(renderizar(e, u.email!.trim(), u.name))
        eventoDoEmail.push(p.id)
      }
    }

    if (dry) {
      await concluir(eventos.map(e => ({ id: e.id, liberar: true })))
      return NextResponse.json({
        ok: true,
        dry: true,
        eventos: eventos.length,
        emails: fila.length,
        sem_endereco: semEndereco,
        plano: planos.map(p => ({
          id: p.id,
          tipo: eventos.find(e => e.id === p.id)?.tipo,
          sinos: p.sinos.map(s => ({ user_id: s.user_id, title: s.title, message: s.message })),
          emails: p.emails.map(e => ({ modelo: e.modelo, user_id: e.userId })),
          nota: p.nota,
        })),
        assuntos: fila.map(f => f.subject),
      })
    }

    // 4. Envio em lote. Sem tempo = nao envia, devolve para a fila.
    const falhaPorEvento = new Map<number, string>()
    if (fila.length > 0) {
      const resultados = await enviarLoteEmails(fila, { deveParar: semTempo })
      for (const r of resultados) {
        if (r.ok) continue
        for (const i of r.indices) falhaPorEvento.set(eventoDoEmail[i], r.erro || 'falha no envio')
      }
    }

    // 5. Conclui. Evento com e-mail que nao saiu por falta de tempo volta sem
    //    gastar tentativa; por erro do provedor, volta com espera.
    const itens: ItemConclusao[] = planos.map(p => {
      const sinos = p.sinos
      const erro = falhaPorEvento.get(p.id)
      if (!erro) {
        return { id: p.id, sinos, email_ok: p.emails.length > 0, finalizar: true }
      }
      if (erro === 'sem_tempo') return { id: p.id, sinos, liberar: true }
      return { id: p.id, sinos, erro }
    })
    const resumo = await concluir(itens)

    return NextResponse.json({
      ok: resumo !== null,
      eventos: eventos.length,
      emails: fila.length,
      emails_com_falha: [...falhaPorEvento.values()].filter(e => e !== 'sem_tempo').length,
      sem_endereco: semEndereco,
      resumo,
      ms: Date.now() - inicio,
    }, { status: resumo === null ? 500 : 200 })
  } catch (err) {
    const msg = (err as Error)?.message || 'erro'
    console.error('[cron-leilao-avisos] erro:', msg)
    // Devolve tudo para a fila com o erro registrado (conta tentativa).
    await concluir(eventos.map(e => ({ id: e.id, erro: msg })))
    return NextResponse.json({ ok: false, erro: msg }, { status: 500 })
  }
}
