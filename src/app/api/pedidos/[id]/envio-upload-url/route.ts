import { NextRequest, NextResponse } from 'next/server'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { SLOTS_FOTO_ENVIO, type SlotFotoEnvio } from '@/lib/leilao-reclamacao'
import {
  BUCKET_RECLAMACOES, SEM_CACHE, UUID_RE, sbServico, usuarioDoBearer, carregarPedido, ehPedidoDeLeilao,
  caminhoFotoEnvio, mimeValido, nomeDaLoja,
} from '@/lib/reclamacaoServer'

/**
 * POST /api/pedidos/[id]/envio-upload-url  { slot: 'frente' | 'verso', mime }
 *
 * URL assinada de UMA foto da carta tirada pelo VENDEDOR antes de embalar um
 * lote de leilao (obrigatoria a partir de VALOR_FOTO_ENVIO_CENTS; quem confere
 * e marcarEnviado). Bucket privado 'reclamacoes', caminho escolhido aqui:
 * <pedido>/envio/<slot>-<uuid>.<ext>. Mesmo desenho do upload da reclamacao.
 *
 * Quem pode: o dono da loja do pedido ou, em venda sem loja, o vendedor. So
 * pedido 'pago' de leilao. Teto de URLs por pedido em
 * pedido_envio_reservar_upload (2 fotos x 5 tentativas).
 */

export const dynamic = 'force-dynamic'

const TETO_URLS_POR_PEDIDO = 10

function json(status: number, corpo: Record<string, unknown>) {
  return NextResponse.json(corpo, { status, headers: SEM_CACHE })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  try {
    const { id: pedidoId } = await ctx.params
    if (!UUID_RE.test(pedidoId)) return json(404, { error: 'Pedido não encontrado.' })
    const sb = sbServico()
    const userId = await usuarioDoBearer(req, sb)
    if (!userId) return json(401, { error: 'Não autenticado.' })

    const body = await req.json().catch(() => null)
    const slot = String(body?.slot || '') as SlotFotoEnvio
    const mime = body?.mime
    if (!(SLOTS_FOTO_ENVIO as readonly string[]).includes(slot) || !mimeValido(mime)) {
      return json(400, { error: 'Foto inválida. Use JPG, PNG ou WebP.' })
    }

    const pedido = await carregarPedido(sb, pedidoId)
    if (!pedido) return json(404, { error: 'Pedido não encontrado.' })
    const dono = pedido.loja_id ? (await nomeDaLoja(sb, pedido.loja_id)).owner : null
    if (userId !== dono && userId !== pedido.vendedor_user_id) return json(404, { error: 'Pedido não encontrado.' })
    if (pedido.status !== 'pago') return json(409, { error: 'Só dá para fotografar o envio de um pedido pago.' })
    if (!(await ehPedidoDeLeilao(sb, pedido))) return json(409, { error: 'Foto de envio vale só para pedidos de leilão.' })

    const { data: reservou, error: rErr } = await sb.rpc('pedido_envio_reservar_upload', {
      p_pedido: pedidoId, p_teto: TETO_URLS_POR_PEDIDO,
    })
    if (rErr) {
      console.error('[envio upload-url] reserva:', rErr.message)
      return json(500, { error: 'Não foi possível preparar o envio da foto.' })
    }
    if (reservou !== true) return json(429, { error: 'Limite de envios de foto atingido. Fale com o suporte.' })

    const { data, error } = await sb.storage.from(BUCKET_RECLAMACOES).createSignedUploadUrl(caminhoFotoEnvio(pedidoId, slot, mime))
    if (error || !data) {
      console.error('[envio upload-url]', error?.message)
      return json(500, { error: 'Não foi possível preparar o envio da foto.' })
    }
    return json(200, { slot, path: data.path, token: data.token })
  } catch (err) {
    console.error('[envio upload-url] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
