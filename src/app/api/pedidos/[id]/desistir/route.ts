import { NextRequest, NextResponse } from 'next/server'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { podeDesistir, prazoPostagem, fmtPrazo, DESCRICAO_ARREPENDIMENTO, DIAS_RECLAMAR, MSG_UMA_OCORRENCIA } from '@/lib/leilao-reclamacao'
import {
  SEM_CACHE, UUID_RE, MSG_EM_DISPUTA, sbServico, usuarioDoBearer, carregarPedido, ehPedidoDeLeilao,
  cancelarPagoComEstorno, erroDoAbrir, sino, emailSeguro, contato, nomeDaLoja, teveOcorrencia,
} from '@/lib/reclamacaoServer'
import { renderArrependimentoEmail } from '@/lib/email'

/**
 * /api/pedidos/[id]/desistir -- direito de arrependimento (art. 49 do CDC) em
 * pedido de LEILAO. Regras puras em podeDesistir (lib/leilao-reclamacao).
 *
 * POST { confirmo?: true }
 *   - pedido 'pago' (antes do envio): estorno integral na hora, mesma
 *     sequencia do cancelamento por atraso (cancelarPagoComEstorno, chave
 *     'desistencia-<pedido>');
 *   - 'enviado', ou 'entregue' dentro de DIAS_RECLAMAR: abre a desistencia com
 *     devolucao (pedido_arrependimento_abrir, nasce em aguardando_devolucao)
 *     com DIAS_POSTAR_DEVOLUCAO dias para postar. Exige `confirmo: true` (o
 *     comprador marcou que devolve a carta no estado em que recebeu).
 *   O CDC nao pede motivo: a descricao gravada e fixa.
 *
 * GET -> para onde devolver: endereco da loja, so para o comprador com
 *   desistencia aberta neste pedido (o endereco nao fica exposto a mais ninguem).
 *
 * ★ Etiqueta reversa paga pela Bynx (Melhor Envio) e a etapa 2 (#469). Ate
 *   la o comprador posta e informa o rastreio em /desistir/postagem.
 */

export const dynamic = 'force-dynamic'

function json(status: number, corpo: Record<string, unknown>) {
  return NextResponse.json(corpo, { status, headers: SEM_CACHE })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  try {
    const { id: pedidoId } = await ctx.params
    if (!UUID_RE.test(pedidoId)) return json(404, { error: 'Pedido não encontrado.' })
    const sb = sbServico()
    const userId = await usuarioDoBearer(req, sb)
    if (!userId) return json(401, { error: 'Não autenticado.' })

    const { data: recs } = await sb
      .from('pedido_reclamacoes')
      .select('id, loja_id')
      .eq('pedido_id', pedidoId)
      .eq('comprador_user_id', userId)
      .eq('motivo', 'arrependimento')
      .eq('status', 'aguardando_devolucao')
      .limit(1)
    const rec = recs?.[0]
    if (!rec) return json(404, { error: 'Nenhuma devolução aberta neste pedido.' })

    const { data: lojas } = await sb.from('lojas').select('nome, endereco, cidade, estado, cep').eq('id', rec.loja_id).limit(1)
    const l = lojas?.[0]
    if (!l) return json(404, { error: 'Loja não encontrada.' })
    return json(200, { loja: { nome: l.nome, endereco: l.endereco, cidade: l.cidade, estado: l.estado, cep: l.cep } })
  } catch (err) {
    console.error('[desistir GET] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
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

    const pedido = await carregarPedido(sb, pedidoId)
    if (!pedido || pedido.comprador_user_id !== userId) return json(404, { error: 'Pedido não encontrado.' })
    const ehLeilao = await ehPedidoDeLeilao(sb, pedido)
    const pode = podeDesistir({ ...pedido, ehLeilao, teve_ocorrencia: await teveOcorrencia(sb, pedido.id) }, Date.now())
    if (!pode.pode) {
      const msg = pode.motivo === 'prazo_encerrado' ? `O prazo de ${DIAS_RECLAMAR} dias depois da entrega já terminou.`
        : pode.motivo === 'ja_aberta' ? 'Já existe uma reclamação ou desistência aberta para este pedido.'
        : pode.motivo === 'ja_teve' ? MSG_UMA_OCORRENCIA
        : pode.motivo === 'em_disputa' ? MSG_EM_DISPUTA
        : pode.motivo === 'nao_e_leilao' ? 'A desistência por aqui vale só para pedidos de leilão.'
        : 'Este pedido não está em um estado que permita desistência.'
      return json(409, { error: msg })
    }

    const loja = await nomeDaLoja(sb, pedido.loja_id)
    const lojista = loja.owner || pedido.vendedor_user_id
    const base = {
      pedidoId: pedido.id, pedidoNumero: pedido.numero, itemNome: pedido.item_nome,
      lojaNome: loja.nome, lojaId: pedido.loja_id,
    }

    // ── Antes do envio: estorno integral na hora ──
    if (pode.modo === 'antes_do_envio') {
      const r = await cancelarPagoComEstorno(sb, pedido, {
        chave: `desistencia-${pedido.id}`,
        origem: 'desistencia_antes_envio',
        canceladoPor: 'comprador',
        motivoTexto: 'Comprador desistiu antes do envio (art. 49 do CDC)',
        log: 'desistir',
      })
      if (!r.ok) return json(r.http, { error: r.erro })
      try {
        await sino(sb, userId, 'Compra cancelada e estornada',
          `Você desistiu do pedido #${pedido.numero} antes do envio. O valor foi estornado.`, `/pedido/${pedido.id}`)
        await sino(sb, lojista, 'Comprador desistiu antes do envio',
          `O pedido #${pedido.numero} foi cancelado e estornado. Não envie a carta.`, `/minha-loja/${pedido.loja_id}/pedidos`)
        const cc = await contato(sb, userId)
        if (cc.email) await emailSeguro(renderArrependimentoEmail({ ...base, to: cc.email, nome: cc.nome, papel: 'comprador', etapa: 'antes_do_envio', valorCents: pedido.total_comprador_cents }))
        const cl = await contato(sb, lojista)
        if (cl.email) await emailSeguro(renderArrependimentoEmail({ ...base, to: cl.email, nome: cl.nome, papel: 'loja', etapa: 'antes_do_envio' }))
      } catch (err) {
        console.error('[desistir] avisos:', (err as Error)?.message)
      }
      return json(200, { ok: true, modo: 'antes_do_envio', reembolsado: true })
    }

    // ── Depois do envio: abre a devolucao ──
    if (body?.confirmo !== true) {
      return json(400, { error: 'Confirme que vai devolver a carta no estado em que recebeu.' })
    }
    const agora = new Date()
    const postarAte = prazoPostagem(agora)!
    const { data: rid, error } = await sb.rpc('pedido_arrependimento_abrir', {
      p_pedido: pedidoId,
      p_comprador: userId,
      p_descricao: DESCRICAO_ARREPENDIMENTO,
      p_postar_ate: postarAte.toISOString(),
    })
    if (error) {
      const e = erroDoAbrir(error.message)
      if (e.status === 500) console.error('[desistir] abrir:', error.code, error.message)
      return json(e.status, { error: e.mensagem })
    }

    try {
      const prazo = fmtPrazo(postarAte)
      await sino(sb, userId, 'Desistência registrada',
        `Poste a carta do pedido #${pedido.numero} até ${prazo} e informe o rastreio.`, `/pedido/${pedido.id}`)
      await sino(sb, lojista, 'O comprador vai devolver a carta',
        `Desistência no pedido #${pedido.numero}. A postagem vai até ${prazo}.`, `/minha-loja/${pedido.loja_id}/pedidos`)
      const cc = await contato(sb, userId)
      if (cc.email) await emailSeguro(renderArrependimentoEmail({ ...base, to: cc.email, nome: cc.nome, papel: 'comprador', etapa: 'aberto', registradoEm: fmtPrazo(agora), prazo }))
      const cl = await contato(sb, lojista)
      if (cl.email) await emailSeguro(renderArrependimentoEmail({ ...base, to: cl.email, nome: cl.nome, papel: 'loja', etapa: 'aberto', prazo }))
    } catch (err) {
      console.error('[desistir] avisos:', (err as Error)?.message)
    }

    return json(200, { ok: true, modo: 'devolucao', id: rid, postar_ate: postarAte.toISOString() })
  } catch (err) {
    console.error('[desistir] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
