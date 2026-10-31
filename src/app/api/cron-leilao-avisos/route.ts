import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  enviarLoteEmails,
  renderLeilaoSuperadoEmail,
  renderLeilaoVenceuEmail,
  renderLeilaoSemLancesEmail,
  renderLeilaoCaloteVencedorEmail,
  renderLeilaoCaloteVendedorEmail,
  renderLeilaoBloqueioVendedorEmail,
  renderLeilaoCanceladoVendedorCompradorEmail,
  renderLeilaoCanceladoVendedorLojaEmail,
  type EmailRenderizado,
  type EmailLoteItem,
  type LeilaoEmailArgs,
} from '@/lib/email'
import {
  planejarAvisos,
  emailEnviavel,
  type EventoReservado,
  type LoteAviso,
  type EmailPlanejado,
  type SinoPlanejado,
  type PlanoEvento,
} from '@/lib/leilao-avisos'

/**
 * GET /api/cron-leilao-avisos  (cron, a cada 1-2 min)
 *
 * Consome a fila `leilao_eventos` e manda os avisos do leilao: sino + e-mail
 * (superado, venceu, sem lances, calote) e o sino de lote cancelado para quem
 * seguia (evento 'cancelado', sem e-mail). A matriz e o debounce estao em
 * src/lib/leilao-avisos.ts; a fila segura em
 * supabase/migrations/20260928110000_leilao_avisos.sql.
 *
 * Fluxo de uma execucao:
 *   1. leilao_eventos_reservar(100): reserva atomica (skip locked + prazo de
 *      120s). Duas execucoes juntas nunca pegam o mesmo evento; se esta morrer,
 *      a reserva vence e o evento volta para a fila.
 *   2. Le o estado ATUAL dos lotes e os usuarios envolvidos.
 *   3. Planeja (funcao pura) e renderiza os e-mails.
 *   4. Envia em LOTE (resend.batch.send, ate 100 por chamada), com os
 *      e-mails de um mesmo evento sempre no mesmo lote. Recusa de conteudo
 *      divide o lote ate isolar o endereco ruim (lib/email-lote.ts): so o
 *      evento culpado conta falha.
 *   5. leilao_eventos_concluir: grava os sinos NA MESMA TRANSACAO que marca o
 *      evento, marca e-mail enviado e finaliza. Evento cujo e-mail falhou volta
 *      para a fila com espera crescente (sino ja gravado nao repete); com 5
 *      tentativas o banco desiste e registra `ultimo_erro`.
 *
 * Para de ENVIAR aos ~18s: o que nao couber volta para a fila sem gastar
 * tentativa; os ~12s restantes sao margem para o concluir.
 * Falha ao LER leiloes/users tambem devolve sem gastar tentativa (e ainda
 * grava os sinos quando o plano ja existe).
 *
 * `?dry=1`: so LE a fila (sem reservar, sem concluir, sem tentativa gasta),
 * planeja e devolve o plano. Nao envia e-mail nem grava sino.
 *
 * Auth: Bearer ${CRON_SECRET} (mesmo padrao dos outros crons), comparado em
 * tempo constante.
 *
 * ── COMO REGISTRAR O CRON (decisao do Du; NAO registrado aqui) ─────────────
 * Depois de aplicar 20260928110000_leilao_avisos.sql, em vercel.json:
 *
 *     { "path": "/api/cron-leilao-avisos", "schedule": "* * * * *" }
 *
 * (a cada 1 min; para 2 min, o primeiro campo vira asterisco-barra-2). A Vercel manda o
 * Authorization: Bearer do CRON_SECRET sozinha. Cron por minuto depende do plano
 * da Vercel (conferir). O `maxDuration` fica neste arquivo (30s, decisao do Du); o `vercel.json` so
 * precisa da entrada acima. Rollback: remover a entrada -- os eventos ficam
 * pendentes na fila, nada se perde.
 * Monitoria: `select * from leilao_eventos where ultimo_erro is not null`.
 */

// DECISAO DO DU: maxDuration. 30s e o teto usado pelos outros crons; subir
// muda custo e superficie de execucao, entao nao mexer sem ele.
export const maxDuration = 30
export const dynamic = 'force-dynamic'

/**
 * Orcamento de ENVIO: depois de ~18s nenhuma chamada nova ao provedor sai.
 * Os ~12s restantes ate o maxDuration sao a margem do concluir -- ele TEM de
 * rodar (sem ele os e-mails ja aceitos sairiam de novo quando a reserva
 * vencer), entao o corte e no envio, nao nele.
 */
const ORCAMENTO_MS = 18_000
const LIMITE_EVENTOS = 100
const RESERVA_SEG = 120

type ItemConclusao = {
  id: number
  /** Gravados pelo banco com type = 'leilao' (NotifType). */
  sinos?: SinoPlanejado[]
  email_ok?: boolean
  finalizar?: boolean
  liberar?: boolean
  erro?: string
}

/** Falha ao LER estado (leiloes/users): nao e culpa do evento, nao gasta tentativa. */
class ErroLeitura extends Error {}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    { auth: { persistSession: false } },
  )
}

/** Comparacao em tempo constante (buffers do mesmo tamanho via hash). */
function segredoConfere(recebido: string | null, segredo: string): boolean {
  if (!recebido) return false
  const a = createHash('sha256').update(recebido).digest()
  const b = createHash('sha256').update(`Bearer ${segredo}`).digest()
  return timingSafeEqual(a, b)
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
    lojaId: e.lote.loja_id ?? null,
  }
  switch (e.modelo) {
    case 'superado': return renderLeilaoSuperadoEmail(a)
    case 'venceu': return renderLeilaoVenceuEmail(a)
    case 'sem_lances': return renderLeilaoSemLancesEmail(a)
    case 'calote_vencedor': return renderLeilaoCaloteVencedorEmail(a)
    case 'calote_vendedor': return renderLeilaoCaloteVendedorEmail(a)
    case 'bloqueio_vendedor': return renderLeilaoBloqueioVendedorEmail(a)
    case 'cancelado_vendedor_comprador': return renderLeilaoCanceladoVendedorCompradorEmail(a)
    case 'cancelado_vendedor_loja': return renderLeilaoCanceladoVendedorLojaEmail(a)
  }
}

type SB = ReturnType<typeof supabaseAdmin>

async function lerLotes(sb: SB, eventos: EventoReservado[]): Promise<Map<string, LoteAviso>> {
  const ids = [...new Set(eventos.map(e => e.leilao_id).filter((x): x is string => !!x))]
  const lotes = new Map<string, LoteAviso>()
  if (ids.length === 0) return lotes
  const { data, error } = await sb
    .from('leiloes')
    .select('id, slug, card_name, status, termina_em, pagar_ate, lider_user_id, vendedor_user_id, preco_atual_cents, loja_id, cancelado_motivo')
    .in('id', ids)
  // ★ Falha de leitura NAO vira "nada a avisar": sem o lote o plano
  //   finalizaria o evento em silencio.
  if (error) throw new ErroLeitura(`leiloes: ${error.message}`)
  for (const l of (data ?? []) as LoteAviso[]) lotes.set(l.id, l)
  return lotes
}

async function lerUsers(sb: SB, planos: PlanoEvento[]) {
  const ids = [...new Set(planos.flatMap(p => p.emails.map(e => e.userId)))]
  const users = new Map<string, { name: string | null; email: string | null }>()
  if (ids.length === 0) return users
  const { data, error } = await sb.from('users').select('id, name, email').in('id', ids)
  if (error) throw new ErroLeitura(`users: ${error.message}`)
  for (const u of (data ?? []) as Array<{ id: string; name: string | null; email: string | null }>) {
    users.set(u.id, { name: u.name, email: u.email })
  }
  return users
}

/**
 * ?dry=1: espia a fila SEM reservar (nao grava token, nao soma tentativa, nao
 * chama concluir). Mesmo filtro da reserva: pendente e com reserva livre.
 */
async function espiarFila(sb: SB): Promise<EventoReservado[]> {
  const agoraIso = new Date().toISOString()
  const { data, error } = await sb
    .from('leilao_eventos')
    .select('id, leilao_id, tipo, user_id, payload, created_at, tentativas, sino_em, email_em')
    .is('processado_em', null)
    .or(`reservado_ate.is.null,reservado_ate.lt.${agoraIso}`)
    .order('id', { ascending: true })
    .limit(LIMITE_EVENTOS)
  if (error) throw new ErroLeitura(`leilao_eventos: ${error.message}`)
  const evs = (data ?? []) as Omit<EventoReservado, 'ultimo_email_superado_em'>[]
  const lotesSup = [...new Set(evs.filter(e => e.tipo === 'superado' && e.leilao_id).map(e => e.leilao_id!))]
  const ultimo = new Map<string, string>()
  if (lotesSup.length > 0) {
    const { data: env, error: e2 } = await sb
      .from('leilao_eventos')
      .select('leilao_id, user_id, email_em')
      .eq('tipo', 'superado')
      .not('email_em', 'is', null)
      .in('leilao_id', lotesSup)
    if (e2) throw new ErroLeitura(`leilao_eventos(debounce): ${e2.message}`)
    for (const r of (env ?? []) as Array<{ leilao_id: string; user_id: string; email_em: string }>) {
      const k = `${r.leilao_id}:${r.user_id}`
      const atual = ultimo.get(k)
      if (!atual || Date.parse(r.email_em) > Date.parse(atual)) ultimo.set(k, r.email_em)
    }
  }
  return evs.map(e => ({
    ...e,
    ultimo_email_superado_em: e.tipo === 'superado' ? ultimo.get(`${e.leilao_id}:${e.user_id}`) ?? null : null,
  }))
}

export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || !segredoConfere(req.headers.get('authorization'), segredo)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const inicio = Date.now()
  const semTempo = () => Date.now() - inicio > ORCAMENTO_MS
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const sb = supabaseAdmin()

  // ── Dry: so leitura, nenhum efeito na fila. ──────────────────────────────
  if (dry) {
    try {
      const eventos = await espiarFila(sb)
      const lotes = await lerLotes(sb, eventos)
      const planos = planejarAvisos(eventos, lotes, Date.now())
      const users = await lerUsers(sb, planos)
      let semEndereco = 0
      const assuntos: string[] = []
      for (const p of planos) {
        for (const e of p.emails) {
          const u = users.get(e.userId)
          if (!u || !emailEnviavel(u.email)) { semEndereco++; continue }
          assuntos.push(renderizar(e, u.email!.trim(), u.name).subject)
        }
      }
      return NextResponse.json({
        ok: true,
        dry: true,
        eventos: eventos.length,
        emails: assuntos.length,
        sem_endereco: semEndereco,
        plano: planos.map(p => ({
          id: p.id,
          tipo: eventos.find(e => e.id === p.id)?.tipo,
          sinos: p.sinos.map(s => ({ user_id: s.user_id, title: s.title, message: s.message })),
          emails: p.emails.map(e => ({ modelo: e.modelo, user_id: e.userId })),
          nota: p.nota,
        })),
        assuntos,
      })
    } catch (err) {
      const msg = (err as Error)?.message || 'erro'
      console.error('[cron-leilao-avisos] dry falhou:', msg)
      return NextResponse.json({ ok: false, dry: true, erro: msg }, { status: 500 })
    }
  }

  // 1. Reserva.
  const { data: reservados, error: errRes } = await sb.rpc('leilao_eventos_reservar', {
    p_limite: LIMITE_EVENTOS,
    p_reserva_seg: RESERVA_SEG,
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
    if (semTempo()) {
      // Passou do orcamento de envio: ainda cabe na margem ate o maxDuration,
      // e concluir e obrigatorio (senao o que ja saiu sai de novo).
      console.warn(`[cron-leilao-avisos] concluir com ${Date.now() - inicio}ms (acima do orcamento)`)
    }
    const { data, error } = await sb.rpc('leilao_eventos_concluir', { p_reserva: reserva, p_itens: itens })
    if (error) {
      // A reserva vence em RESERVA_SEG e os eventos voltam para a fila.
      console.error('[cron-leilao-avisos] falha ao concluir:', error.message)
      return null
    }
    return data as Record<string, number>
  }

  // Planos ficam fora do try: se so a leitura de users falhar, os sinos
  // (que nao dependem dela) ainda sao gravados.
  let planos: PlanoEvento[] | null = null
  try {
    // 2. Estado atual dos lotes e usuarios.
    const lotes = await lerLotes(sb, eventos)
    planos = planejarAvisos(eventos, lotes, Date.now())
    const users = await lerUsers(sb, planos)

    // 3. Renderiza. Grupo = evento: os e-mails de um evento vao juntos no
    //    mesmo lote. Evento que ja falhou antes (tentativas > 1) vai um a um,
    //    com chave de idempotencia estavel -- e o que deixa o retry nao
    //    duplicar o e-mail que ja tinha saido.
    const tentativasDe = new Map(eventos.map(e => [e.id, e.tentativas]))
    const fila: EmailLoteItem[] = []
    const eventoDoEmail: number[] = []
    let semEndereco = 0
    for (const p of planos) {
      for (const e of p.emails) {
        const u = users.get(e.userId)
        if (!u || !emailEnviavel(u.email)) { semEndereco++; continue }
        fila.push({
          ...renderizar(e, u.email!.trim(), u.name),
          grupo: p.id,
          chave: `leilao-ev-${p.id}-${e.modelo}-${e.userId}`,
          unitario: (tentativasDe.get(p.id) ?? 1) > 1,
        })
        eventoDoEmail.push(p.id)
      }
    }

    // 4. Envio. Resultado por mensagem; so o evento culpado conta falha.
    const falhaPorEvento = new Map<number, string>()
    const semTempoPorEvento = new Set<number>()
    if (fila.length > 0) {
      const resultados = await enviarLoteEmails(fila, { deveParar: semTempo })
      resultados.forEach((r, i) => {
        if (r.ok) return
        const ev = eventoDoEmail[i]
        if (r.erro === 'sem_tempo') semTempoPorEvento.add(ev)
        else if (!falhaPorEvento.has(ev)) falhaPorEvento.set(ev, r.erro || 'falha no envio')
      })
    }

    // 5. Conclui. Erro do provedor volta com espera (conta tentativa); so
    //    falta de tempo volta sem gastar tentativa.
    const itens: ItemConclusao[] = planos.map(p => {
      const sinos = p.sinos
      const erro = falhaPorEvento.get(p.id)
      if (erro) return { id: p.id, sinos, erro }
      if (semTempoPorEvento.has(p.id)) return { id: p.id, sinos, liberar: true }
      return { id: p.id, sinos, email_ok: p.emails.length > 0, finalizar: true }
    })
    const resumo = await concluir(itens)

    return NextResponse.json({
      ok: resumo !== null,
      eventos: eventos.length,
      emails: fila.length,
      eventos_com_falha: falhaPorEvento.size,
      eventos_sem_tempo: semTempoPorEvento.size,
      sem_endereco: semEndereco,
      resumo,
      ms: Date.now() - inicio,
    }, { status: resumo === null ? 500 : 200 })
  } catch (err) {
    const msg = (err as Error)?.message || 'erro'
    console.error('[cron-leilao-avisos] erro:', msg)
    if (err instanceof ErroLeitura) {
      // Leitura falhou: o evento nao tem culpa. Volta sem gastar tentativa e,
      // se o plano ja existe (falhou so users), grava os sinos mesmo assim.
      const porId = new Map((planos ?? []).map(p => [p.id, p.sinos]))
      await concluir(eventos.map(e => ({ id: e.id, sinos: porId.get(e.id), liberar: true })))
      return NextResponse.json({ ok: false, erro: msg, liberados: eventos.length }, { status: 500 })
    }
    // Erro inesperado (render, bug): volta com o erro registrado e conta tentativa.
    await concluir(eventos.map(e => ({ id: e.id, erro: msg })))
    return NextResponse.json({ ok: false, erro: msg }, { status: 500 })
  }
}
