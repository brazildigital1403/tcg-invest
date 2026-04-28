import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

const CATEGORIAS_TODAS = ['infra', 'marketing', 'dominio', 'pagamentos', 'impostos', 'assinatura', 'outros']

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
// Aceita: { pago?, recebido?, valor_bruto?, taxa?, descricao?, observacao?, data_liquidacao?, data_competencia?, categoria?, detalhes? }
//
// Regra: se `detalhes` vier no body (array), valor_bruto é recalculado pela soma.
// Regra: lançamentos com fonte='stripe' têm restrições — apenas observação + recebido podem ser alterados.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))

    const sb = supabaseAdmin()

    // Busca lançamento atual pra validar permissões e ter taxa/detalhes pra recálculos
    const { data: existing } = await sb
      .from('lancamentos')
      .select('valor_bruto, taxa, detalhes, fonte')
      .eq('id', id)
      .limit(1)
    if (!existing?.[0]) {
      return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
    }
    const atual = existing[0]
    const isStripe = atual.fonte === 'stripe'

    const patch: any = { updated_at: new Date().toISOString() }

    // ─── Lançamento Stripe: só observação e recebido ─────────────────
    if (isStripe) {
      if (body.observacao !== undefined) {
        patch.observacao = body.observacao ? String(body.observacao).trim() : null
      }
      if (body.recebido !== undefined) patch.recebido = !!body.recebido
      if (body.pago     !== undefined) patch.pago     = !!body.pago

      const camposBloqueados = ['valor_bruto', 'taxa', 'descricao', 'categoria', 'data_competencia', 'data_liquidacao', 'detalhes']
      const tentouBloqueado = camposBloqueados.some(k => body[k] !== undefined)
      if (tentouBloqueado) {
        return NextResponse.json({
          error: 'Lançamentos do Stripe só permitem editar observação e status (recebido)'
        }, { status: 400 })
      }

      const { data, error } = await sb
        .from('lancamentos')
        .update(patch)
        .eq('id', id)
        .select()
        .limit(1)
      if (error) {
        console.error('[financeiro/lancamentos PATCH stripe]', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ lancamento: data?.[0] })
    }

    // ─── Lançamento manual ───────────────────────────────────────────

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

    if (body.data_competencia !== undefined) {
      const v = String(body.data_competencia)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        return NextResponse.json({ error: 'Data de competência inválida (YYYY-MM-DD)' }, { status: 400 })
      }
      patch.data_competencia = v
    }

    if (body.categoria !== undefined) {
      if (!CATEGORIAS_TODAS.includes(body.categoria)) {
        return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 })
      }
      patch.categoria = body.categoria
    }

    // ─── Detalhes mudaram → recalcula valor_bruto pela soma ──────────
    if (body.detalhes !== undefined) {
      const det = validarDetalhes(body.detalhes)
      if (!det.ok) return NextResponse.json({ error: det.error }, { status: 400 })

      patch.detalhes = det.lista.length > 0 ? det.lista : null

      if (det.lista.length > 0) {
        const novoBruto = Math.round(det.lista.reduce((s, i) => s + i.valor, 0) * 100) / 100
        const novaTaxa  = body.taxa !== undefined ? Number(body.taxa) : Number(atual.taxa)
        if (!Number.isFinite(novaTaxa) || novaTaxa < 0) {
          return NextResponse.json({ error: 'Taxa inválida' }, { status: 400 })
        }
        patch.valor_bruto   = novoBruto
        patch.taxa          = novaTaxa
        patch.valor_liquido = novoBruto - novaTaxa
      } else {
        // Detalhes virou null mas não veio valor_bruto — precisa de valor manual
        if (body.valor_bruto === undefined) {
          return NextResponse.json({
            error: 'Removeu sub-itens mas não informou valor_bruto. Defina o valor manualmente.'
          }, { status: 400 })
        }
      }
    }

    // ─── Sem detalhes no body, mas valor/taxa mudaram → recálculo simples ────
    if (patch.detalhes === undefined && (body.valor_bruto !== undefined || body.taxa !== undefined)) {
      // Se já tem detalhes salvos e não mudou detalhes, não permite alterar valor manualmente
      if (atual.detalhes && body.valor_bruto !== undefined) {
        return NextResponse.json({
          error: 'Este lançamento tem sub-itens — edite os sub-itens pra alterar o valor'
        }, { status: 400 })
      }
      const novoBruto = body.valor_bruto !== undefined ? Number(body.valor_bruto) : Number(atual.valor_bruto)
      const novaTaxa  = body.taxa        !== undefined ? Number(body.taxa)        : Number(atual.taxa)
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

    // ─── Caso: removeu detalhes E mandou valor_bruto novo ──────────
    if (patch.detalhes === null && body.valor_bruto !== undefined) {
      const novoBruto = Number(body.valor_bruto)
      const novaTaxa  = body.taxa !== undefined ? Number(body.taxa) : Number(atual.taxa)
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
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

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
