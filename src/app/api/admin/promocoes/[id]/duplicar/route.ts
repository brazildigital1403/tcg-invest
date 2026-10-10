// POST /api/admin/promocoes/[id]/duplicar  { chave }
//
// Copia a promocao para outra vitrine, no fim da fila. `ml_id` vai NULL de
// proposito: a coluna e UNIQUE, copiar o valor quebraria o insert.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { chaveValida, nomeVitrine } from '@/lib/promocoes'
import { COLUNAS_PRODUTO, proximaOrdem, revalidarChaves, supabaseAdmin, urlJaNaVitrine } from '@/lib/promocoesServer'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  try {
    const { id: idTxt } = await ctx.params
    const id = Number(idTxt)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const chave = body.chave
    if (!chaveValida(chave)) return NextResponse.json({ error: 'Vitrine inválida' }, { status: 400 })

    const sb = supabaseAdmin()
    const { data: orig, error: errOrig } = await sb
      .from('ml_afiliado_produtos').select('chave, titulo, preco, imagem_url, url, ativo').eq('id', id).maybeSingle()
    if (errOrig) throw new Error(errOrig.message)
    if (!orig) return NextResponse.json({ error: 'Promoção não encontrada' }, { status: 404 })
    if (orig.chave === chave) return NextResponse.json({ error: 'A promoção já é desta vitrine.' }, { status: 400 })
    if (await urlJaNaVitrine(sb, chave, orig.url)) {
      return NextResponse.json({ error: `Já está na vitrine ${nomeVitrine(chave)}.` }, { status: 409 })
    }

    const agora = new Date().toISOString()
    const { data, error } = await sb.from('ml_afiliado_produtos').insert({
      chave,
      titulo: orig.titulo,
      preco: orig.preco,
      imagem_url: orig.imagem_url,
      url: orig.url,
      ativo: orig.ativo,
      ordem: await proximaOrdem(sb, chave),
      ml_id: null,
      link_manual: true,
      produto_codigo: null,
      last_seen_at: agora,
      updated_at: agora,
    }).select(COLUNAS_PRODUTO).maybeSingle()
    if (error) {
      console.error('[admin/promocoes] erro duplicando:', error.message)
      return NextResponse.json({ error: 'Erro ao duplicar a promoção' }, { status: 500 })
    }

    const cache = revalidarChaves([chave])
    return NextResponse.json({ ok: true, produto: data, cache })
  } catch (err) {
    console.error('[admin/promocoes] unexpected:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
