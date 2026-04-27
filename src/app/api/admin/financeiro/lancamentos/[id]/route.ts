import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

function validarDetalhes(detalhes: any): { ok: true; lista: { descricao: string; valor: number }[] } | { ok: false; error: string } {
  if (detalhes === null) return { ok: true, lista: [] }
  if (!Array.isArray(detalhes)) return { ok: false, error: 'detalhes deve ser um array' }

  const lista: { descricao: string; valor: number }[] = []
  for (let i = 0; i < detalhes.length; i++) {
    const d = detalhes[i]
    if (!d || typeof d !== 'object') return { ok: false, error: `Item ${i + 1}: formato inválido` }
    const descricao = String(d.descricao || '').trim()
    if (!descricao) return { ok: false, error: `Item ${i + 1}: descrição obrigatória` }
    const valor = Number(d.valor)
    if (!Number.isFinite(valor) || valor < 0) {
      return { ok: false, error: `Item ${i + 1}: valor inválido` }
    }
    lista.push({ descricao, valor: Math.round(valor * 100) / 100 })
  }
  return { ok: true, lista }
}

// PATCH /api/admin/financeiro/lancamentos/[id]
// Aceita: { pago?, recebido?, valor_bruto?, taxa?, descricao?, observacao?, data_liquidacao?, detalhes? }
//
// Se `detalhes` vier no body, valor_bruto é recalculado pela soma (regra única do sistema)
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))

    const patch: any = { updated_at: new Date().toISOString() }

    if (body.pago     !== undefined) patch.pago     = !!body.pago
    if (body.recebido !== undefined) patch.recebido = !!body.recebido
    if (body.descricao !== undefined) {
      const v = String(body.descricao).trim()
      if (!v) return NextResponse.json({ error: 'Descrição não pode ser vazia' }, { status: 400 })
      patch.descricao = v
    }
    if (body.observacao !== undefined) {
      patch.observacao = body.observacao ? String(body.observacao).trim() : null
    }
    if (body.data_liquidacao !== undefined) {
      patch.data_liquidacao = body.data_liquidacao || null
    }

    const sb = supabaseAdmin()

    // ─── Detalhes mudaram → recalcula valor_bruto pela soma ──────────
    if (body.detalhes !== undefined) {
      const det = validarDetalhes(body.detalhes)
      if (!det.ok) return NextResponse.json({ error: det.error }, { status: 400 })

      patch.detalhes = det.lista.length > 0 ? det.lista : null

      if (det.lista.length > 0) {
        // Soma manda — recalcula bruto e líquido
        const novoBruto = Math.round(det.lista.reduce((s, i) => s + i.valor, 0) * 100) / 100
        // Pega taxa atual (ou nova se enviada) pra recalcular líquido
        let novaTaxa = body.taxa !== undefined ? Number(body.taxa) : null
        if (novaTaxa === null) {
          const { data: existing } = await sb
            .from('lancamentos')
            .select('taxa')
            .eq('id', id)
            .limit(1)
          if (!existing?.[0]) {
            return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
          }
          novaTaxa = Number(existing[0].taxa)
        }
        if (!Number.isFinite(novaTaxa) || novaTaxa < 0) {
          return NextResponse.json({ error: 'Taxa inválida' }, { status: 400 })
        }
        patch.valor_bruto   = novoBruto
        patch.taxa          = novaTaxa
        patch.valor_liquido = novoBruto - novaTaxa
      }
    }

    // ─── Sem detalhes mas valor/taxa mudaram → recálculo simples ──────
    if (patch.detalhes === undefined && (body.valor_bruto !== undefined || body.taxa !== undefined)) {
      const { data: existing } = await sb
        .from('lancamentos')
        .select('valor_bruto, taxa, detalhes')
        .eq('id', id)
        .limit(1)
      if (!existing?.[0]) {
        return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
      }
      // Se já tem detalhes salvos, não permite alterar valor_bruto manualmente
      if (existing[0].detalhes && body.valor_bruto !== undefined) {
        return NextResponse.json({
          error: 'Este lançamento tem sub-itens — edite os sub-itens pra alterar o valor'
        }, { status: 400 })
      }
      const novoBruto = body.valor_bruto !== undefined ? Number(body.valor_bruto) : Number(existing[0].valor_bruto)
      const novaTaxa  = body.taxa        !== undefined ? Number(body.taxa)        : Number(existing[0].taxa)
      if (!Number.isFinite(novoBruto) || novoBruto < 0) {
        return NextResponse.json({ error: 'Valor bruto inválido' }, { status: 400 })
      }
      if (!Number.isFinite(novaTaxa) || novaTaxa < 0) {
        return NextResponse.json({ error: 'Taxa inválida' }, { status: 400 })
      }
      patch.valor_bruto   = novoBruto
      patch.taxa          = novaTaxa
      patch.valor_liquido = novoBruto - novaTaxa
    }

    const { data, error } = await sb
      .from('lancamentos')
      .update(patch)
      .eq('id', id)
      .select()
      .limit(1)

    if (error) {
      console.error('[financeiro/lancamentos PATCH]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data?.[0]) {
      return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ lancamento: data[0] })
  } catch (err: any) {
    console.error('[financeiro/lancamentos PATCH]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE /api/admin/financeiro/lancamentos/[id]
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const sb = supabaseAdmin()

    const { error } = await sb.from('lancamentos').delete().eq('id', id)
    if (error) {
      console.error('[financeiro/lancamentos DELETE]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[financeiro/lancamentos DELETE]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
