import { NextRequest, NextResponse } from 'next/server'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { validarRastreio, podeInformarPostagem } from '@/lib/leilao-reclamacao'
import { SEM_CACHE, UUID_RE, sbServico, usuarioDoBearer, sino, emailSeguro, contato, nomeDaLoja } from '@/lib/reclamacaoServer'
import { renderArrependimentoEmail } from '@/lib/email'

/**
 * POST /api/pedidos/[id]/desistir/postagem  { rastreio }
 *
 * O comprador informa o rastreio da devolucao (desistencia aberta, dentro de
 * postar_ate). Codigo no padrao S10 dos Correios, digito conferido
 * (validarRastreio). Compare-and-set: so grava se ainda nao postou e o prazo
 * nao venceu -- o cron de expiracao e este update nao se atropelam.
 * Avisa a loja (sino + e-mail).
 *
 * ★ Etapa 1 (#469): rastreio informado. Na etapa 2 a etiqueta do Melhor Envio
 *   preenche sozinha e o comprador nao digita nada.
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
    const rastreio = validarRastreio(body?.rastreio)
    if (!rastreio) return json(400, { error: 'Código de rastreio inválido. Confira: são 2 letras, 9 números e 2 letras, como AA123456789BR.' })

    const { data: recs } = await sb
      .from('pedido_reclamacoes')
      .select('id, motivo, status, postar_ate, devolucao_postada_em, loja_id, vendedor_user_id')
      .eq('pedido_id', pedidoId)
      .eq('comprador_user_id', userId)
      .eq('motivo', 'arrependimento')
      .eq('status', 'aguardando_devolucao')
      .limit(1)
    const rec = recs?.[0]
    if (!rec) return json(404, { error: 'Nenhuma devolução aberta neste pedido.' })
    if (!podeInformarPostagem(rec, Date.now())) {
      return json(409, { error: rec.devolucao_postada_em ? 'A postagem já foi informada.' : 'O prazo para postar terminou.' })
    }

    const agora = new Date().toISOString()
    const { data: mexeu, error } = await sb
      .from('pedido_reclamacoes')
      .update({ devolucao_rastreio: rastreio, devolucao_postada_em: agora, updated_at: agora })
      .eq('id', rec.id)
      .eq('status', 'aguardando_devolucao')
      .is('devolucao_postada_em', null)
      .gte('postar_ate', agora)
      .select('id')
    if (error) {
      console.error('[desistir postagem]', error.message)
      return json(500, { error: 'Erro ao registrar a postagem.' })
    }
    if (!mexeu?.length) return json(409, { error: 'A postagem já foi informada ou o prazo terminou. Atualize a página.' })

    try {
      const { data: peds } = await sb.from('pedidos').select('numero, item_nome').eq('id', pedidoId).limit(1)
      const ped = peds?.[0]
      const loja = await nomeDaLoja(sb, rec.loja_id)
      const lojista = loja.owner || rec.vendedor_user_id
      await sino(sb, lojista, 'Devolução postada',
        `O comprador postou a devolução do pedido #${ped?.numero ?? ''} (rastreio ${rastreio}).`, `/minha-loja/${rec.loja_id}/pedidos`)
      const cl = await contato(sb, lojista)
      if (cl.email) {
        await emailSeguro(renderArrependimentoEmail({
          to: cl.email, nome: cl.nome, papel: 'loja', etapa: 'postado', rastreio,
          pedidoId, pedidoNumero: ped?.numero ?? '', itemNome: ped?.item_nome || 'pedido', lojaNome: loja.nome, lojaId: rec.loja_id,
        }))
      }
    } catch (err) {
      console.error('[desistir postagem] avisos:', (err as Error)?.message)
    }

    return json(200, { ok: true, rastreio })
  } catch (err) {
    console.error('[desistir postagem] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
