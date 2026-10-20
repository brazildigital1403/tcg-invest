import { NextRequest, NextResponse } from 'next/server'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import {
  MOTIVOS, DIAS_RECLAMAR, DIAS_UTEIS_LOJA, DIAS_UTEIS_DECISAO, ehMotivo, motivoExigeFoto, podeReclamar, somarDiasUteis,
  validarDescricao, validarFotos, validarVideoUrl, fmtPrazo, MSG_UMA_OCORRENCIA
} from '@/lib/leilao-reclamacao'
import {
  SEM_CACHE, UUID_RE, sbServico, usuarioDoBearer, carregarPedido, ehPedidoDeLeilao, pastaFotos, arquivosNaPasta,
  erroDoAbrir, sino, emailSeguro, contato, nomeDaLoja, teveOcorrencia,
} from '@/lib/reclamacaoServer'
import { renderReclamacaoAbertaLojaEmail } from '@/lib/email'

/**
 * POST /api/pedidos/[id]/reclamacao
 *   { motivo, descricao, fotos?: string[], video_url?: string }
 *
 * O comprador abre a reclamacao de um pedido de LEILAO (Protecao Bynx):
 *   - enviado, ou entregue ha no maximo DIAS_RECLAMAR dias;
 *   - motivo nao_chegou | diferente_do_anuncio | suspeita_falsificacao | danificado;
 *   - nos 3 ultimos, fotos frente/verso/embalagem obrigatorias, ja enviadas ao
 *     bucket pela URL de /reclamacao/upload-url. O servidor confere que cada
 *     caminho esta na pasta deste comprador e EXISTE no bucket;
 *   - video opcional, so link https.
 * Grava pela RPC pedido_reclamacao_abrir (trava o pedido, confere tudo de novo
 * sob lock e liga pedidos.reclamacao_aberta na mesma transacao) e avisa a loja
 * (sino + e-mail). O prazo da loja (DIAS_UTEIS_LOJA) e o da Bynx (+DIAS_UTEIS_DECISAO) saem de
 * lib/leilao-reclamacao.
 */

export const dynamic = 'force-dynamic'

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
    const motivo = body?.motivo
    if (!ehMotivo(motivo)) return json(400, { error: 'Escolha o motivo da reclamação.' })
    const descricao = validarDescricao(body?.descricao)
    if (!descricao) return json(400, { error: 'Conte o que aconteceu (de 10 a 2000 caracteres).' })
    const video = validarVideoUrl(body?.video_url)
    if (video === false) return json(400, { error: 'O link do vídeo precisa começar com https://.' })

    const pedido = await carregarPedido(sb, pedidoId)
    if (!pedido || pedido.comprador_user_id !== userId) return json(404, { error: 'Pedido não encontrado.' })
    const ehLeilao = await ehPedidoDeLeilao(sb, pedido)
    const pode = podeReclamar({ ...pedido, ehLeilao, teve_ocorrencia: await teveOcorrencia(sb, pedido.id) }, Date.now())
    if (!pode.pode) {
      const msg = pode.motivo === 'prazo_encerrado' ? `O prazo de ${DIAS_RECLAMAR} dias depois da entrega já terminou.`
        : pode.motivo === 'ja_aberta' ? 'Já existe uma reclamação aberta para este pedido.'
        : pode.motivo === 'ja_teve' ? MSG_UMA_OCORRENCIA
        : pode.motivo === 'nao_e_leilao' ? 'A reclamação por aqui vale só para pedidos de leilão.'
        : 'Este pedido não está em um estado que permita reclamação.'
      return json(409, { error: msg })
    }

    const pasta = pastaFotos(pedidoId, userId)
    const exigir = motivoExigeFoto(motivo)
    const fotos = validarFotos(body?.fotos, pasta, exigir)
    if (!fotos.ok) return json(400, { error: fotos.erro })
    if (fotos.fotos.length) {
      const existem = await arquivosNaPasta(sb, pasta)
      if (!fotos.fotos.every(f => existem.has(f))) {
        return json(400, { error: 'Alguma foto não terminou de enviar. Envie de novo.' })
      }
    }

    const agora = new Date()
    const prazoLoja = somarDiasUteis(agora, DIAS_UTEIS_LOJA)!
    const prazoDecisao = somarDiasUteis(prazoLoja, DIAS_UTEIS_DECISAO)!

    const { data: rid, error } = await sb.rpc('pedido_reclamacao_abrir', {
      p_pedido: pedidoId,
      p_comprador: userId,
      p_motivo: motivo,
      p_descricao: descricao,
      p_fotos: fotos.fotos,
      p_video_url: video,
      p_prazo_loja_ate: prazoLoja.toISOString(),
      p_prazo_decisao_ate: prazoDecisao.toISOString(),
    })
    if (error) {
      const e = erroDoAbrir(error.message)
      if (e.status === 500) console.error('[reclamacao abrir]', error.code, error.message)
      return json(e.status, { error: e.mensagem })
    }

    // Avisos: falha aqui nao desfaz a reclamacao.
    try {
      const loja = await nomeDaLoja(sb, pedido.loja_id)
      const destino = loja.owner || pedido.vendedor_user_id
      const prazoTxt = fmtPrazo(prazoLoja)
      await sino(sb, destino, 'Reclamação em um pedido',
        `O comprador relatou um problema no pedido #${pedido.numero} (${MOTIVOS[motivo]}). Responda até ${prazoTxt}.`,
        `/minha-loja/${pedido.loja_id}/pedidos`)
      const c = await contato(sb, destino)
      if (c.email) {
        await emailSeguro(renderReclamacaoAbertaLojaEmail({
          to: c.email, nome: c.nome, pedidoId, pedidoNumero: pedido.numero, itemNome: pedido.item_nome,
          lojaNome: loja.nome, lojaId: pedido.loja_id, motivo: MOTIVOS[motivo], descricao, prazoLoja: prazoTxt,
        }))
      }
    } catch (err) {
      console.error('[reclamacao abrir] avisos:', (err as Error)?.message)
    }

    return json(200, { ok: true, id: rid, prazo_loja_ate: prazoLoja.toISOString() })
  } catch (err) {
    console.error('[reclamacao abrir] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
