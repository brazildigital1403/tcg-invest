import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// PATCH /api/admin/financeiro/lancamentos/[id]
// Aceita: { pago?, recebido?, valor_bruto?, taxa?, descricao?, observacao?, data_liquidacao? }
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

    // Se atualizar valor ou taxa, recalcular líquido (precisa buscar antes)
    if (body.valor_bruto !== undefined || body.taxa !== undefined) {
      const sb = supabaseAdmin()
      const { data: existing } = await sb
        .from('lancamentos')
        .select('valor_bruto, taxa')
        .eq('id', id)
        .limit(1)
      if (!existing?.[0]) {
        return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
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

    const sb = supabaseAdmin()
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
