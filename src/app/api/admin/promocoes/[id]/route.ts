// PATCH /api/admin/promocoes/[id] -- edita conteudo (link, imagem, titulo,
// preco), `ativo` (o interruptor) e/ou `ordem`. A vitrine (`chave`) nao muda
// aqui: para levar a outra vitrine, duplicar.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { nomeVitrine } from '@/lib/promocoes'
import { COLUNAS_PRODUTO, revalidarChaves, supabaseAdmin, urlJaNaVitrine, validarCampos } from '@/lib/promocoesServer'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  try {
    const { id: idTxt } = await ctx.params
    const id = Number(idTxt)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const v = validarCampos(body, true)
    if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 })

    const update: Record<string, unknown> = { ...v.campos }
    if (body.ativo !== undefined) update.ativo = body.ativo === true
    if (body.ordem !== undefined) {
      const n = Number(body.ordem)
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json({ error: 'A ordem precisa ser um número inteiro a partir de 0.' }, { status: 400 })
      }
      update.ordem = n
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nada para salvar' }, { status: 400 })

    const sb = supabaseAdmin()
    const { data: atual, error: errAtual } = await sb
      .from('ml_afiliado_produtos').select('id, chave').eq('id', id).maybeSingle()
    if (errAtual) throw new Error(errAtual.message)
    if (!atual) return NextResponse.json({ error: 'Promoção não encontrada' }, { status: 404 })

    if (typeof update.url === 'string' && await urlJaNaVitrine(sb, atual.chave, update.url, id)) {
      return NextResponse.json({ error: `Já está na vitrine ${nomeVitrine(atual.chave)}.` }, { status: 409 })
    }

    update.updated_at = new Date().toISOString()
    const { data, error } = await sb
      .from('ml_afiliado_produtos').update(update).eq('id', id).select(COLUNAS_PRODUTO).maybeSingle()
    if (error) {
      console.error('[admin/promocoes] erro editando:', error.message)
      return NextResponse.json({ error: 'Erro ao salvar a promoção' }, { status: 500 })
    }

    const cache = revalidarChaves([atual.chave])
    return NextResponse.json({ ok: true, produto: data, cache })
  } catch (err) {
    console.error('[admin/promocoes] unexpected:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
