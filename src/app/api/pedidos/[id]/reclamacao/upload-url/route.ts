import { NextRequest, NextResponse } from 'next/server'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { SLOTS_FOTO, podeReclamar, type SlotFoto } from '@/lib/leilao-reclamacao'
import {
  BUCKET_RECLAMACOES, SEM_CACHE, UUID_RE, sbServico, usuarioDoBearer, carregarPedido, ehPedidoDeLeilao,
  caminhoFoto, mimeValido,
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
 * So o comprador, so pedido de leilao que ainda aceita reclamacao.
 *
 * ★ TETO DE URLs EMITIDAS, nao de arquivos. Contar arquivos na pasta nao
 *   segurava: URL emitida e ainda nao usada nao vira arquivo, entao um loop
 *   juntava centenas de URLs e subia tudo depois. Agora cada URL reserva uma
 *   vaga em pedidos.reclamacao_uploads (pedido_reclamacao_reservar_upload,
 *   incremento atomico com `where uploads < teto`) ANTES de ser emitida.
 *   Teto por pedido, pela vida do pedido: 3 fotos x 5 tentativas = 15
 *   (troca de foto, reenvio, uma segunda reclamacao depois de fechada a
 *   primeira). Passou disso, suporte. Vaga gasta com URL que falhou na
 *   emissao nao volta -- simples e a favor do teto.
 */

export const dynamic = 'force-dynamic'

const TETO_URLS_POR_PEDIDO = 15

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

    const { data: reservou, error: rErr } = await sb.rpc('pedido_reclamacao_reservar_upload', {
      p_pedido: pedidoId, p_comprador: userId, p_teto: TETO_URLS_POR_PEDIDO,
    })
    if (rErr) {
      console.error('[reclamacao upload-url] reserva:', rErr.message)
      return json(500, { error: 'Não foi possível preparar o envio da foto.' })
    }
    if (reservou !== true) return json(429, { error: 'Limite de envios de foto atingido. Fale com o suporte.' })

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
