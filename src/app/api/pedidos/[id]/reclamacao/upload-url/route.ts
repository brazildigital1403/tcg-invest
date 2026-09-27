import { NextRequest, NextResponse } from 'next/server'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { SLOTS_FOTO, podeReclamar, type SlotFoto } from '@/lib/leilao-reclamacao'
import {
  BUCKET_RECLAMACOES, SEM_CACHE, UUID_RE, sbServico, usuarioDoBearer, carregarPedido, ehPedidoDeLeilao,
  caminhoFoto, mimeValido, pastaFotos,
} from '@/lib/reclamacaoServer'

/**
 * POST /api/pedidos/[id]/reclamacao/upload-url  { slot, mime }
 *
 * Emite a URL assinada de UMA foto da reclamacao (frente, verso ou embalagem)
 * no bucket PRIVADO 'reclamacoes'. O arquivo vai direto do navegador para o
 * bucket (sem passar pelo lambda de 4,5 MB); o caminho e escolhido aqui, nunca
 * pelo cliente: <pedido>/<comprador>/<slot>-<uuid>.<ext>. Padrao do
 * servico-midias.
 *
 * So o comprador, so pedido de leilao que ainda aceita reclamacao. Teto de 12
 * arquivos por pasta: um loop de reemissao nao enche o bucket.
 */

export const dynamic = 'force-dynamic'

const TETO_ARQUIVOS = 12

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
    const slot = String(body?.slot || '') as SlotFoto
    const mime = body?.mime
    if (!(SLOTS_FOTO as readonly string[]).includes(slot) || !mimeValido(mime)) {
      return json(400, { error: 'Foto inválida. Use JPG, PNG ou WebP.' })
    }

    const pedido = await carregarPedido(sb, pedidoId)
    if (!pedido || pedido.comprador_user_id !== userId) return json(404, { error: 'Pedido não encontrado.' })
    const ehLeilao = await ehPedidoDeLeilao(sb, pedido)
    const pode = podeReclamar({ ...pedido, ehLeilao }, Date.now())
    if (!pode.pode) return json(409, { error: 'Este pedido não aceita reclamação agora.' })

    const pasta = pastaFotos(pedidoId, userId)
    const { data: existentes } = await sb.storage.from(BUCKET_RECLAMACOES).list(pasta.replace(/\/$/, ''), { limit: 50 })
    if ((existentes?.length || 0) >= TETO_ARQUIVOS) return json(429, { error: 'Limite de envios de foto atingido. Fale com o suporte.' })

    const { data, error } = await sb.storage.from(BUCKET_RECLAMACOES).createSignedUploadUrl(caminhoFoto(pedidoId, userId, slot, mime))
    if (error || !data) {
      console.error('[reclamacao upload-url]', error?.message)
      return json(500, { error: 'Não foi possível preparar o envio da foto.' })
    }
    return json(200, { slot, path: data.path, token: data.token })
  } catch (err) {
    console.error('[reclamacao upload-url] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
