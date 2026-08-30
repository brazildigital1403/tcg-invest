import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { ticketsPrecisandoResposta } from '@/lib/adminTickets'

// GET /api/admin/dashboard?period=7|30|90
//
// Alimenta o cockpit da home do admin: 3 metricas de periodo com tendencia +
// serie diaria (faturamento, novos usuarios, GMV do marketplace), 1 metrica
// de fila (tickets precisando resposta, sempre "agora", sem periodo), o
// bloco de alertas cruzando os paineis-irmaos, o grafico de crescimento de
// usuarios (mesma serie do headline, so que inteira) e receita x despesa
// dos ultimos 6 meses (mesmo calculo do /admin/financeiro, mas OUTSTANDING
// AQUI: fixo em 6 meses, nao segue o seletor de periodo -- 7/30d nao rende
// um grafico de barra mensal com sentido).

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// Agrupa uma lista de {data, valor} por dia (ymd) dentro da janela [start, end),
// preenchendo dias sem dado com 0 -- senao o sparkline fica com buraco.
function serieDiaria(start: Date, days: number, pontos: { dia: string; valor: number }[]) {
  const porDia: Record<string, number> = {}
  for (const p of pontos) porDia[p.dia] = (porDia[p.dia] || 0) + p.valor
  const serie: { d: string; v: number }[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000)
    const key = ymd(d)
    serie.push({ d: key, v: porDia[key] || 0 })
  }
  return serie
}

function trendPct(atual: number, anterior: number): number {
  if (anterior === 0) return atual > 0 ? 100 : 0
  return Math.round(((atual - anterior) / anterior) * 100)
}

export async function GET(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { searchParams } = new URL(req.url)
    const period = [7, 30, 90].includes(Number(searchParams.get('period'))) ? Number(searchParams.get('period')) : 30

    const sb = supabaseAdmin()
    const now = new Date()
    const startAtual    = new Date(now.getTime() - period * 86_400_000)
    const startAnterior = new Date(now.getTime() - period * 2 * 86_400_000)

    // ─── Faturamento (lancamentos.tipo='receita', mesma definicao do /admin/financeiro) ──
    const { data: lancPeriodo } = await sb
      .from('lancamentos')
      .select('valor_bruto, data_competencia')
      .eq('tipo', 'receita')
      .gte('data_competencia', ymd(startAnterior))
      .lte('data_competencia', ymd(now))

    let fatAtual = 0, fatAnterior = 0
    const fatPontos: { dia: string; valor: number }[] = []
    for (const l of lancPeriodo || []) {
      const v = Number(l.valor_bruto)
      const dia = String(l.data_competencia).slice(0, 10)
      if (dia >= ymd(startAtual)) { fatAtual += v; fatPontos.push({ dia, valor: v }) }
      else fatAnterior += v
    }

    // ─── Novos usuarios (users.created_at) ──────────────────────────────
    const { data: usersPeriodo } = await sb
      .from('users')
      .select('created_at')
      .gte('created_at', startAnterior.toISOString())
      .lte('created_at', now.toISOString())

    let usrAtual = 0, usrAnterior = 0
    const usrPontos: { dia: string; valor: number }[] = []
    for (const u of usersPeriodo || []) {
      const dia = String(u.created_at).slice(0, 10)
      if (dia >= ymd(startAtual)) { usrAtual++; usrPontos.push({ dia, valor: 1 }) }
      else usrAnterior++
    }

    // ─── GMV marketplace (pedidos pago/enviado/entregue, exclui aguardando
    // pagamento/cancelado/reembolsado -- mesmo filtro de /minha-loja/pedidos
    // e /dashboard-financeiro) ────────────────────────────────────────────
    const { data: pedidosPeriodo } = await sb
      .from('pedidos')
      .select('valor_item_cents, total_comprador_cents, pago_em, created_at')
      .in('status', ['pago', 'enviado', 'entregue'])
      .gte('pago_em', startAnterior.toISOString())
      .lte('pago_em', now.toISOString())

    let gmvAtual = 0, gmvAnterior = 0
    const gmvPontos: { dia: string; valor: number }[] = []
    // GMV = valor da MERCADORIA, sem frete. Antes somava total_comprador_cents,
    // que inclui frete -- e frete vai 100% pra loja, nao e volume de mercadoria
    // nem receita da Bynx (comissao.ts:113 ja documentava isso). No unico pedido
    // entregue ate hoje o frete era 79% da metrica: item R$ 2,00, frete R$ 11,93.
    for (const p of pedidosPeriodo || []) {
      const v = Number(p.valor_item_cents || 0) / 100
      const dia = String(p.pago_em || p.created_at).slice(0, 10)
      if (dia >= ymd(startAtual)) { gmvAtual += v; gmvPontos.push({ dia, valor: v }) }
      else gmvAnterior += v
    }

    // ─── Alertas (sempre "agora", nao segue o periodo) ──────────────────
    const [ticketsResp, lojasPend, lojasConnect, cardReqPend, despRec] = await Promise.all([
      ticketsPrecisandoResposta(sb),
      sb.from('lojas').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
      sb.from('lojas').select('id', { count: 'exact', head: true }).in('stripe_connect_status', ['pendente', 'restrito']),
      sb.from('card_requests').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
      sb.from('despesas_recorrentes').select('id, dia_vencimento').eq('ativa', true),
    ])

    const hoje = now.getDate()
    const ultimoDiaMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const contasAVencer = (despRec.data || []).filter(d => {
      const diaVenc = Math.min(d.dia_vencimento, ultimoDiaMes)
      const dias = diaVenc - hoje
      return dias >= 0 && dias <= 3
    }).length

    // ─── Receita x Despesa, 6 meses fixos (mesmo calculo do /admin/financeiro) ──
    const seisMesesAtras = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 5, 1))
    const { data: lanc6m } = await sb
      .from('lancamentos')
      .select('tipo, valor_bruto, data_competencia, pago')
      .gte('data_competencia', ymd(seisMesesAtras))

    const meses: Record<string, { receita: number; despesa: number }> = {}
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      meses[key] = { receita: 0, despesa: 0 }
    }
    for (const l of lanc6m || []) {
      const key = String(l.data_competencia).slice(0, 7)
      if (!meses[key]) continue
      if (l.tipo === 'receita') meses[key].receita += Number(l.valor_bruto)
      else if (l.pago) meses[key].despesa += Number(l.valor_bruto)
    }
    const receitaDespesa6m = Object.entries(meses).map(([mes, v]) => ({ mes, ...v }))

    return NextResponse.json({
      period,
      headline: {
        faturamento: { valor: fatAtual, valorAnterior: fatAnterior, trendPct: trendPct(fatAtual, fatAnterior), serie: serieDiaria(startAtual, period, fatPontos) },
        novosUsuarios: { valor: usrAtual, valorAnterior: usrAnterior, trendPct: trendPct(usrAtual, usrAnterior), serie: serieDiaria(startAtual, period, usrPontos) },
        gmv: { valor: gmvAtual, valorAnterior: gmvAnterior, trendPct: trendPct(gmvAtual, gmvAnterior), serie: serieDiaria(startAtual, period, gmvPontos) },
        ticketsPrecisandoResposta: ticketsResp,
      },
      alertas: {
        ticketsPrecisandoResposta: ticketsResp,
        contasAVencer,
        lojasPendentes: lojasPend.count || 0,
        lojasConnectPendente: lojasConnect.count || 0,
        cardRequestsPendentes: cardReqPend.count || 0,
      },
      receitaDespesa6m,
    })
  } catch (err: any) {
    console.error('[admin/dashboard GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
