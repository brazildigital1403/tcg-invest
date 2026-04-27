import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// GET /api/admin/financeiro/dashboard
//
// Retorna tudo necessário pra renderizar a tela /admin/financeiro:
// - 4 cards macro (faturamento, despesas pagas, resultado, a pagar)
// - Tendência vs mês anterior
// - Avisos de vencimento próximo (3 dias)
// - Dados pros 2 gráficos (linha 6 meses, pizza categorias)

const MEI_LIMITE_ANUAL = 81_000

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}
function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

export async function GET(_req: NextRequest) {
  try {
    const sb = supabaseAdmin()
    const now = new Date()
    const startMes = startOfMonth(now)
    const endMes   = endOfMonth(now)
    const startMesAnt = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    const endMesAnt   = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    const startAno    = new Date(now.getFullYear(), 0, 1)

    // ─── Lançamentos do mês atual e anterior ───────────────────────
    const [respMes, respMesAnt] = await Promise.all([
      sb.from('lancamentos')
        .select('tipo, valor_bruto, valor_liquido, taxa, categoria, pago, recebido, data_competencia')
        .gte('data_competencia', ymd(startMes))
        .lte('data_competencia', ymd(endMes)),
      sb.from('lancamentos')
        .select('tipo, valor_bruto, valor_liquido, pago')
        .gte('data_competencia', ymd(startMesAnt))
        .lte('data_competencia', ymd(endMesAnt)),
    ])

    if (respMes.error) {
      console.error('[financeiro/dashboard] mes atual:', respMes.error.message)
      return NextResponse.json({ error: respMes.error.message }, { status: 500 })
    }

    const lancMes    = respMes.data    || []
    const lancMesAnt = respMesAnt.data || []

    // ─── Cálculos do mês atual ─────────────────────────────────────
    let faturamentoBruto    = 0
    let stripeFee           = 0
    let despesasPagas       = 0
    let despesasAPagar      = 0
    let despesasAPagarCount = 0

    for (const l of lancMes) {
      if (l.tipo === 'receita') {
        faturamentoBruto += Number(l.valor_bruto)
        stripeFee        += Number(l.taxa)
      } else {
        if (l.pago) despesasPagas += Number(l.valor_bruto)
        else {
          despesasAPagar += Number(l.valor_bruto)
          despesasAPagarCount++
        }
      }
    }

    // Resultado do mês = (faturamento bruto - taxas) - despesas pagas
    const resultado = (faturamentoBruto - stripeFee) - despesasPagas

    // ─── Tendência vs mês anterior ─────────────────────────────────
    let fatMesAnt = 0, despMesAnt = 0
    for (const l of lancMesAnt) {
      if (l.tipo === 'receita')           fatMesAnt  += Number(l.valor_bruto)
      else if (l.pago)                    despMesAnt += Number(l.valor_bruto)
    }
    const trend = (atual: number, anterior: number) => {
      if (anterior === 0) return atual > 0 ? 100 : 0
      return Math.round(((atual - anterior) / anterior) * 100)
    }

    // ─── Faturamento acumulado no ano (limite MEI) ─────────────────
    const { data: lancAno } = await sb.from('lancamentos')
      .select('valor_bruto, tipo')
      .eq('tipo', 'receita')
      .gte('data_competencia', ymd(startAno))

    const faturamentoAno = (lancAno || []).reduce((acc, l) => acc + Number(l.valor_bruto), 0)
    const percentualMEI  = MEI_LIMITE_ANUAL > 0 ? Math.round((faturamentoAno / MEI_LIMITE_ANUAL) * 100) : 0

    // ─── Avisos de vencimento (despesas recorrentes próximos 3 dias) ────
    const { data: despesasRec } = await sb.from('despesas_recorrentes')
      .select('id, nome, valor_mensal, dia_vencimento, categoria')
      .eq('ativa', true)

    const hoje = new Date()
    const hojeDia = hoje.getDate()
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()

    const proximosVencimentos = (despesasRec || [])
      .map(d => {
        const diaVenc = Math.min(d.dia_vencimento, ultimoDiaMes)
        const diasAteVencer = diaVenc - hojeDia
        return { ...d, dias: diasAteVencer, dia_real: diaVenc }
      })
      .filter(d => d.dias >= 0 && d.dias <= 3)
      .sort((a, b) => a.dias - b.dias)

    // ─── Gráfico 1: Linha 6 meses ─────────────────────────────────
    const seisMesesAtras = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 5, 1))
    const { data: lanc6m } = await sb.from('lancamentos')
      .select('tipo, valor_bruto, data_competencia, pago')
      .gte('data_competencia', ymd(seisMesesAtras))
      .lte('data_competencia', ymd(endMes))

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
      else if (l.pago)          meses[key].despesa += Number(l.valor_bruto)
    }
    const chartLinha = Object.entries(meses).map(([mes, v]) => ({ mes, ...v }))

    // ─── Gráfico 2: Pizza categorias do mês atual ─────────────────
    const porCategoria: Record<string, number> = {}
    for (const l of lancMes) {
      if (l.tipo === 'despesa' && l.pago) {
        porCategoria[l.categoria] = (porCategoria[l.categoria] || 0) + Number(l.valor_bruto)
      }
    }
    const chartPizza = Object.entries(porCategoria)
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor)

    // ─── Resposta ─────────────────────────────────────────────────
    return NextResponse.json({
      cards: {
        faturamento: {
          valor: faturamentoBruto,
          trend: trend(faturamentoBruto, fatMesAnt),
        },
        despesas_pagas: {
          valor: despesasPagas,
          trend: trend(despesasPagas, despMesAnt),
        },
        resultado: {
          valor: resultado,
          trend: trend(resultado, fatMesAnt - despMesAnt),
        },
        a_pagar: {
          valor: despesasAPagar,
          count: despesasAPagarCount,
        },
      },
      mei: {
        faturamento_ano: faturamentoAno,
        limite: MEI_LIMITE_ANUAL,
        percentual: percentualMEI,
      },
      vencimentos_proximos: proximosVencimentos.map(d => ({
        id: d.id,
        nome: d.nome,
        valor: Number(d.valor_mensal),
        dias: d.dias,
        dia_vencimento: d.dia_real,
      })),
      chart_linha: chartLinha,
      chart_pizza: chartPizza,
    })
  } catch (err: any) {
    console.error('[financeiro/dashboard GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
