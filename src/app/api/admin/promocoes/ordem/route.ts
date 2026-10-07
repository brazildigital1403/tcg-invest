// PUT /api/admin/promocoes/ordem  { chave, ids: number[] }
//
// Grava `ordem = indice` na sequencia recebida. Dezenas de updates pequenos
// por chave primaria (sem RPC: seria schema). So mexe em linhas DA vitrine.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { chaveValida } from '@/lib/promocoes'
import { revalidarChaves, supabaseAdmin } from '@/lib/promocoesServer'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  try {
    const body = await req.json().catch(() => ({}))
    const chave = body.chave
    if (!chaveValida(chave)) return NextResponse.json({ error: 'Vitrine inválida' }, { status: 400 })
    const ids: number[] = Array.isArray(body.ids) ? body.ids.map(Number) : []
    if (ids.length === 0 || ids.length > 200 || ids.some((n) => !Number.isInteger(n) || n <= 0)) {
      return NextResponse.json({ error: 'Lista de IDs inválida' }, { status: 400 })
    }

    const sb = supabaseAdmin()
    const { data: daVitrine, error: errV } = await sb.from('ml_afiliado_produtos').select('id').eq('chave', chave)
    if (errV) throw new Error(errV.message)
    const validos = new Set((daVitrine || []).map((r) => r.id as number))
    if (ids.some((id) => !validos.has(id))) {
      return NextResponse.json({ error: 'A lista tem promoção de outra vitrine. Recarregue a página.' }, { status: 409 })
    }

    const agora = new Date().toISOString()
    const resultados = await Promise.all(ids.map((id, i) =>
      sb.from('ml_afiliado_produtos').update({ ordem: i, updated_at: agora }).eq('id', id).eq('chave', chave),
    ))
    const falha = resultados.find((r) => r.error)
    if (falha?.error) {
      console.error('[admin/promocoes] erro ordenando:', falha.error.message)
      return NextResponse.json({ error: 'Erro ao salvar a ordem. Recarregue e confira.' }, { status: 500 })
    }

    const cache = revalidarChaves([chave])
    return NextResponse.json({ ok: true, cache })
  } catch (err) {
    console.error('[admin/promocoes] unexpected:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
