// POST /api/servicos/[id]/upload-url -- reemite a URL assinada de UMA foto.
//
// Usado quando o upload falha no meio (sinal caiu, aba fechou): o navegador
// pede uma URL nova so para o que faltou, sem refazer o pedido inteiro.
// Body: { item_id, slot, mime }. So enquanto o pedido aguarda orcamento.

import { NextRequest, NextResponse } from 'next/server'
import {
  sbAdmin, carregarAutorizado, erro, caminhoFoto, urlDeUpload, FOTO_MIMES, SLOTS, type Slot,
} from '@/lib/servicosServer'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const auth = await carregarAutorizado(req, id)
    if (!auth.ok) return auth.resposta
    if (auth.sol.status !== 'aguardando_orcamento') return erro(409, 'Este pedido já foi orçado')

    const body = await req.json().catch(() => null)
    const itemId = String(body?.item_id || '')
    const slot = String(body?.slot || '') as Slot
    const mime = String(body?.mime || '')
    if (!SLOTS.includes(slot) || !FOTO_MIMES.includes(mime)) return erro(400, 'Foto inválida')

    const { data: item } = await sbAdmin().from('servico_itens').select('id').eq('id', itemId).eq('solicitacao_id', id).limit(1)
    if (!item?.[0]) return erro(404, 'Carta não encontrada neste pedido')

    // Teto por pedido: sem isso um loop de reemissao enche o bucket.
    const { data: existentes } = await sbAdmin().storage.from('servico-midias').list(`${id}/${itemId}`, { limit: 40 })
    if ((existentes?.length || 0) >= 24) return erro(429, 'Limite de tentativas de envio atingido')

    const u = await urlDeUpload(caminhoFoto(id, itemId, slot, mime))
    return NextResponse.json({ item_id: itemId, slot, ...u })
  } catch (e) {
    console.error('[servicos/upload-url]', e instanceof Error ? e.message : e)
    return erro(500, 'Erro interno')
  }
}
