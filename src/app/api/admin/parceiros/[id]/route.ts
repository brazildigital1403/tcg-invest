// src/app/api/admin/parceiros/[id]/route.ts
//
// Admin — detalhe e acoes do parceiro: pausar/ativar cupom, fechar ciclo,
// marcar fechamento como pago (com lancamento de despesa) e ajuste manual.
//
// Fechar ciclo agrupa linhas com 30+ dias (janela de refund) e ainda sem
// fechamento. Idempotente e reexecutavel: linha carimbada nao recarimba;
// fechamento que nasce vazio e desfeito e vira 400.

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

const JANELA_DIAS = 30

// GET /api/admin/parceiros/[id] — detalhe completo
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  try {
    const { id } = await ctx.params
    const supabase = supabaseAdmin()

    const { data: parceiros, error } = await supabase
      .from('parceiros')
      .select('*')
      .eq('id', id)
      .limit(1)
    if (error || !parceiros?.[0]) {
      return NextResponse.json({ error: 'Parceiro não encontrado' }, { status: 404 })
    }

    const cutoff = new Date(Date.now() - JANELA_DIAS * 86400_000).toISOString()
    // O resumo soma numa query propria SEM o cap de exibicao — somar sobre as
    // 500 mais recentes subestimaria em silencio quando o ledger crescer.
    const [comissoesRes, pendentesRes, fechamentosRes] = await Promise.all([
      supabase
        .from('parceiro_comissoes')
        .select('id, tipo, plano, valor_base_cents, comissao_cents, fechamento_id, observacao, criado_em, stripe_payment_intent_id')
        .eq('parceiro_id', id)
        .order('criado_em', { ascending: false })
        .limit(500),
      supabase
        .from('parceiro_comissoes')
        .select('comissao_cents, criado_em')
        .eq('parceiro_id', id)
        .is('fechamento_id', null),
      supabase
        .from('parceiro_fechamentos')
        .select('*')
        .eq('parceiro_id', id)
        .order('criado_em', { ascending: false }),
    ])

    const comissoes = comissoesRes.data || []
    const pendentes = pendentesRes.data || []
    // Mesmo criterio do fechar_ciclo: negativo (estorno) e sempre elegivel.
    const elegiveis = pendentes.filter(c => c.criado_em <= cutoff || Number(c.comissao_cents) < 0)

    return NextResponse.json({
      parceiro: parceiros[0],
      comissoes,
      fechamentos: fechamentosRes.data || [],
      resumo: {
        pendenteCents: pendentes.reduce((s, c) => s + Number(c.comissao_cents), 0),
        elegivelCents: elegiveis.reduce((s, c) => s + Number(c.comissao_cents), 0),
        elegivelLinhas: elegiveis.length,
        naJanelaCents: pendentes.filter(c => c.criado_em > cutoff && Number(c.comissao_cents) >= 0).reduce((s, c) => s + Number(c.comissao_cents), 0),
      },
    })
  } catch (err: any) {
    console.error('[admin/parceiros/id] unexpected:', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH /api/admin/parceiros/[id] — { acao: 'pausar'|'ativar'|'fechar_ciclo'|'marcar_pago'|'ajuste', ... }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const acao = String(body.acao || '')
    const supabase = supabaseAdmin()

    const { data: parceiros } = await supabase
      .from('parceiros')
      .select('*')
      .eq('id', id)
      .limit(1)
    const parceiro = parceiros?.[0]
    if (!parceiro) {
      return NextResponse.json({ error: 'Parceiro não encontrado' }, { status: 404 })
    }

    // ── Pausar / ativar: kill-switch do cupom. Stripe ANTES do banco. ──
    if (acao === 'pausar' || acao === 'ativar') {
      const ativo = acao === 'ativar'
      if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: 'Stripe não configurado' }, { status: 503 })
      }
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' as Stripe.StripeConfig['apiVersion'] })
      await stripe.promotionCodes.update(parceiro.stripe_promotion_code_id, { active: ativo })
      const { error } = await supabase.from('parceiros').update({ ativo }).eq('id', id)
      if (error) {
        console.error(`[admin/parceiros] CRITICAL: promo ${acao} na Stripe mas banco falhou:`, error.message)
        return NextResponse.json({ error: 'Stripe atualizada, banco falhou — tente de novo' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, ativo })
    }

    // ── Fechar ciclo: agrupa linhas 30d+ sem fechamento ──
    if (acao === 'fechar_ciclo') {
      const cutoff = new Date(Date.now() - JANELA_DIAS * 86400_000).toISOString()

      const { data: fech, error: fErr } = await supabase
        .from('parceiro_fechamentos')
        .insert({
          parceiro_id: id,
          periodo_inicio: new Date(0).toISOString().slice(0, 10),
          periodo_fim: cutoff.slice(0, 10),
          total_comissao_cents: 0,
          qtd_linhas: 0,
        })
        .select('id')
        .limit(1)
      if (fErr || !fech?.[0]) {
        return NextResponse.json({ error: `Não criou o fechamento: ${fErr?.message || '?'}` }, { status: 500 })
      }
      const fechamentoId = fech[0].id

      // Linha NEGATIVA (estorno/ajuste) entra SEM esperar 30 dias: a janela
      // de maturacao existe pra refund, e estorno E o refund — deixa-lo de
      // fora pagaria comissao de venda cujo dinheiro ja voltou pro cartao.
      const { error: upErr } = await supabase
        .from('parceiro_comissoes')
        .update({ fechamento_id: fechamentoId })
        .eq('parceiro_id', id)
        .is('fechamento_id', null)
        .or(`criado_em.lte.${cutoff},comissao_cents.lt.0`)
      if (upErr) {
        console.error('[admin/parceiros] CRITICAL: carimbo de fechamento falhou:', upErr.message)
        await supabase.from('parceiro_fechamentos').delete().eq('id', fechamentoId)
        return NextResponse.json({ error: 'Falha carimbando linhas — rode de novo' }, { status: 500 })
      }

      const { data: linhas, error: selErr } = await supabase
        .from('parceiro_comissoes')
        .select('comissao_cents, criado_em')
        .eq('fechamento_id', fechamentoId)

      // Erro aqui NAO significa fechamento vazio — deletar as cegas zeraria
      // um fechamento com linhas ja carimbadas (o delete falharia na FK, mas
      // deixaria o fechamento com total 0 e as linhas presas nele).
      if (selErr) {
        console.error('[admin/parceiros] CRITICAL: select pos-carimbo falhou:', selErr.message)
        return NextResponse.json({ error: `Fechamento ${fechamentoId} criado mas a soma falhou — abra o detalhe e confira antes de pagar` }, { status: 500 })
      }

      if (!linhas?.length) {
        await supabase.from('parceiro_fechamentos').delete().eq('id', fechamentoId)
        return NextResponse.json({ error: `Nada elegível: nenhuma linha com ${JANELA_DIAS}+ dias fora de fechamento` }, { status: 400 })
      }

      const total = linhas.reduce((s, l) => s + Number(l.comissao_cents), 0)
      const datas = linhas.map(l => l.criado_em).sort()
      await supabase
        .from('parceiro_fechamentos')
        .update({
          total_comissao_cents: total,
          qtd_linhas: linhas.length,
          periodo_inicio: datas[0].slice(0, 10),
          periodo_fim: datas[datas.length - 1].slice(0, 10),
        })
        .eq('id', fechamentoId)

      return NextResponse.json({ ok: true, fechamentoId, totalCents: total, linhas: linhas.length })
    }

    // ── Marcar pago: registra o Pix + lancamento de despesa no financeiro ──
    if (acao === 'marcar_pago') {
      const fechamentoId = String(body.fechamento_id || '')
      const comprovante = String(body.comprovante || '').trim() || null
      if (!fechamentoId) {
        return NextResponse.json({ error: 'fechamento_id obrigatório' }, { status: 400 })
      }
      const { data: fechs } = await supabase
        .from('parceiro_fechamentos')
        .select('*')
        .eq('id', fechamentoId)
        .eq('parceiro_id', id)
        .limit(1)
      const fechamento = fechs?.[0]
      if (!fechamento) {
        return NextResponse.json({ error: 'Fechamento não encontrado' }, { status: 404 })
      }
      if (fechamento.status === 'pago') {
        return NextResponse.json({ error: 'Fechamento já está pago' }, { status: 400 })
      }

      const agora = new Date().toISOString()
      // .select() confirma quantas linhas o update pegou: update de 0 linhas
      // nao e erro no PostgREST — sem isso, duplo clique inseriria a despesa
      // duas vezes no financeiro.
      const { data: pagos, error: upErr } = await supabase
        .from('parceiro_fechamentos')
        .update({ status: 'pago', pago_em: agora, comprovante })
        .eq('id', fechamentoId)
        .eq('status', 'fechado')
        .select('id')
      if (upErr) {
        return NextResponse.json({ error: `Falha marcando pago: ${upErr.message}` }, { status: 500 })
      }
      if (!pagos?.length) {
        return NextResponse.json({ error: 'Fechamento já estava pago (outra aba venceu?)' }, { status: 409 })
      }

      // Despesa no financeiro — trilha que o prêmio do ranking nunca teve.
      const valor = Math.round(Number(fechamento.total_comissao_cents)) / 100
      if (valor > 0) {
        const { error: lErr } = await supabase.from('lancamentos').insert({
          tipo: 'despesa',
          valor_bruto: valor,
          taxa: 0,
          valor_liquido: valor,
          descricao: `Comissão parceria ${parceiro.nome} — ciclo ${fechamento.periodo_inicio} a ${fechamento.periodo_fim}`,
          categoria: 'marketing',
          data_competencia: agora.slice(0, 10),
          data_liquidacao: agora.slice(0, 10),
          pago: true,
          recebido: false,
          fonte: 'manual',
        })
        if (lErr) {
          console.error('[admin/parceiros] CRITICAL: fechamento pago mas lançamento de despesa falhou:', lErr.message)
        }
      }

      return NextResponse.json({ ok: true, pagoEm: agora })
    }

    // ── Ajuste manual: válvula pra dispute perdido e correções ──
    if (acao === 'ajuste') {
      const comissaoCents = Math.round(Number(body.comissao_cents))
      const observacao = String(body.observacao || '').trim()
      if (!Number.isFinite(comissaoCents) || comissaoCents === 0) {
        return NextResponse.json({ error: 'comissao_cents inválido (centavos, pode ser negativo)' }, { status: 400 })
      }
      if (!observacao) {
        return NextResponse.json({ error: 'observação obrigatória num ajuste manual' }, { status: 400 })
      }
      const { error } = await supabase.from('parceiro_comissoes').insert({
        parceiro_id: id,
        tipo: 'ajuste',
        valor_base_cents: 0,
        comissao_cents: comissaoCents,
        observacao,
      })
      if (error) {
        return NextResponse.json({ error: `Falha no ajuste: ${error.message}` }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: `Ação '${acao}' não reconhecida` }, { status: 400 })
  } catch (err: any) {
    console.error('[admin/parceiros/id] unexpected:', err?.message)
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 })
  }
}
