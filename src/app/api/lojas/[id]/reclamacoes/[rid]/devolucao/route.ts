import { NextRequest, NextResponse } from 'next/server'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { lojaPodeContestar, validarContestacao, somarDiasUteis, fmtPrazo, DIAS_UTEIS_DECISAO } from '@/lib/leilao-reclamacao'
import {
  SEM_CACHE, UUID_RE, carregarPedido, concluirDevolucao, sino, emailSeguro, contato,
} from '@/lib/reclamacaoServer'
import { renderArrependimentoEmail } from '@/lib/email'

/**
 * POST /api/lojas/[id]/reclamacoes/[rid]/devolucao
 *   { acao: 'liberar' }                              a carta voltou certa: estorna agora
 *   { acao: 'contestar', tipo, texto, video_url? }   voltou trocada ou danificada
 *     tipo 'dano' (so estorno total/parcial) ou 'troca' (pode ser improcedente,
 *     video da abertura obrigatorio). Regra do #501 em validarContestacao.
 *
 * So desistencia ('arrependimento') em aguardando_devolucao e ja postada.
 *   - liberar: concluirDevolucao (Stripe antes do banco, chave
 *     'arrependimento-<rid>', fecha como resolvida/estorno_total). Nao precisa
 *     esperar a Bynx marcar a entrega: a loja dizer que recebeu basta.
 *   - contestar: dentro de contestar_ate (quando ja marcado). Vai para
 *     'em_analise' e a Bynx decide pelo caminho da reclamacao
 *     (/api/admin/reclamacoes/[rid]/decidir). A contestacao tambem vai em
 *     resposta_tipo='provas' + resposta_loja para o painel do admin mostrar
 *     sem tela nova. Compare-and-set no status e em contestada_em.
 */

export const dynamic = 'force-dynamic'

function json(status: number, corpo: Record<string, unknown>) {
  return NextResponse.json(corpo, { status, headers: SEM_CACHE })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; rid: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  try {
    const { id: lojaId, rid } = await ctx.params
    if (!UUID_RE.test(lojaId) || !UUID_RE.test(rid)) return json(404, { error: 'Desistência não encontrada.' })
    const auth = await autenticarOwnerOuAdmin(req, lojaId, 'id, owner_user_id, nome')
    if ('error' in auth) return auth.error
    const { sb, loja } = auth

    const body = await req.json().catch(() => null)
    const acao = body?.acao
    if (acao !== 'liberar' && acao !== 'contestar') return json(400, { error: 'Ação inválida.' })

    const { data: recs } = await sb
      .from('pedido_reclamacoes')
      .select('id, pedido_id, motivo, status, postar_ate, devolucao_postada_em, devolucao_entregue_em, contestar_ate, contestada_em, comprador_user_id')
      .eq('id', rid)
      .eq('loja_id', lojaId)
      .limit(1)
    const rec = recs?.[0]
    if (!rec || rec.motivo !== 'arrependimento') return json(404, { error: 'Desistência não encontrada.' })
    if (!lojaPodeContestar(rec, Date.now())) {
      return json(409, {
        error: rec.status !== 'aguardando_devolucao' ? 'Esta desistência já foi encerrada.'
          : !rec.devolucao_postada_em ? 'O comprador ainda não postou a devolução.'
          : 'O prazo para conferir a devolução terminou.',
      })
    }
    const pedido = await carregarPedido(sb, rec.pedido_id)
    if (!pedido) return json(404, { error: 'Pedido não encontrado.' })
    const baseEmail = {
      pedidoId: pedido.id, pedidoNumero: pedido.numero, itemNome: pedido.item_nome, lojaNome: loja.nome as string, lojaId,
    }

    if (acao === 'liberar') {
      const r = await concluirDevolucao(sb, rid, pedido, 'loja')
      if (!r.ok) return json(r.http, { error: r.erro })
      if (r.resultado !== 'ja_resolvida') {
        try {
          await sino(sb, rec.comprador_user_id, 'Devolução concluída',
            `A loja confirmou a devolução do pedido #${pedido.numero} e o valor foi estornado.`, `/pedido/${pedido.id}`)
          const cc = await contato(sb, rec.comprador_user_id)
          if (cc.email) await emailSeguro(renderArrependimentoEmail({ ...baseEmail, to: cc.email, nome: cc.nome, papel: 'comprador', etapa: 'estornado', valorCents: r.valorCents }))
        } catch (err) {
          console.error('[devolucao liberar] avisos:', (err as Error)?.message)
        }
      }
      return json(200, { ok: true, valor_estornado_cents: r.valorCents })
    }

    const v = validarContestacao(body || {})
    if (!v.ok) return json(400, { error: v.erro })
    const { tipo, texto, video } = v

    const agora = new Date()
    const prazoDecisao = somarDiasUteis(agora, DIAS_UTEIS_DECISAO)!
    let q = sb
      .from('pedido_reclamacoes')
      .update({
        status: 'em_analise',
        contestacao: texto,
        contestacao_tipo: tipo,
        contestacao_video_url: video,
        contestada_em: agora.toISOString(),
        resposta_tipo: 'provas',
        resposta_loja: texto,
        respondida_em: agora.toISOString(),
        prazo_decisao_ate: prazoDecisao.toISOString(),
        updated_at: agora.toISOString(),
      })
      .eq('id', rid)
      .eq('status', 'aguardando_devolucao')
      .is('contestada_em', null)
    if (rec.contestar_ate) q = q.gte('contestar_ate', agora.toISOString())
    const { data: mexeu, error } = await q.select('id')
    if (error) {
      console.error('[devolucao contestar]', error.message)
      return json(500, { error: 'Erro ao registrar a contestação.' })
    }
    if (!mexeu?.length) return json(409, { error: 'A desistência mudou de situação. Atualize a página.' })

    try {
      const prazo = fmtPrazo(prazoDecisao)
      await sino(sb, rec.comprador_user_id, 'A loja contestou a devolução',
        `A Bynx analisa o pedido #${pedido.numero} e decide até ${prazo}.`, `/pedido/${pedido.id}`)
      const cc = await contato(sb, rec.comprador_user_id)
      if (cc.email) await emailSeguro(renderArrependimentoEmail({ ...baseEmail, to: cc.email, nome: cc.nome, papel: 'comprador', etapa: 'contestado', prazo }))
    } catch (err) {
      console.error('[devolucao contestar] avisos:', (err as Error)?.message)
    }
    return json(200, { ok: true })
  } catch (err) {
    console.error('[devolucao loja] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
