import { NextRequest, NextResponse } from 'next/server'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import {
  RESPOSTAS_LOJA, DIAS_UTEIS_DECISAO, ehRespostaLoja, lojaPodeResponder, somarDiasUteis, fmtPrazo,
} from '@/lib/leilao-reclamacao'
import { SEM_CACHE, UUID_RE, sino, emailSeguro, contato } from '@/lib/reclamacaoServer'
import { renderReclamacaoRespostaCompradorEmail } from '@/lib/email'

/**
 * POST /api/lojas/[id]/reclamacoes/[rid]/responder
 *   { tipo: 'aceitar' | 'contraproposta' | 'provas', texto, contraproposta_cents? }
 *
 * A loja responde a reclamacao dentro de DIAS_UTEIS_LOJA dias uteis
 * (prazo_loja_ate). A resposta leva a reclamacao para 'em_analise' e a Bynx
 * decide em ate DIAS_UTEIS_DECISAO dias uteis a partir de agora. Dinheiro NAO se move aqui: mesmo o "aceitar" so
 * registra a concordancia -- quem estorna e o admin (/api/admin/reclamacoes).
 *
 * Depois do prazo a rota recusa: o silencio ja conta a favor do comprador.
 * O update filtra por status + prazo (compare-and-set): duas respostas ao
 * mesmo tempo, so a primeira passa.
 */

export const dynamic = 'force-dynamic'

function json(status: number, corpo: Record<string, unknown>) {
  return NextResponse.json(corpo, { status, headers: SEM_CACHE })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; rid: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  try {
    const { id: lojaId, rid } = await ctx.params
    if (!UUID_RE.test(lojaId) || !UUID_RE.test(rid)) return json(404, { error: 'Reclamação não encontrada.' })
    const auth = await autenticarOwnerOuAdmin(req, lojaId, 'id, owner_user_id, nome')
    if ('error' in auth) return auth.error
    const { sb, loja } = auth

    const body = await req.json().catch(() => null)
    const tipo = body?.tipo
    if (!ehRespostaLoja(tipo)) return json(400, { error: 'Escolha como você quer responder.' })
    const texto = typeof body?.texto === 'string' ? body.texto.trim().slice(0, 2000) : ''
    if (tipo !== 'aceitar' && texto.length < 10) return json(400, { error: 'Explique sua resposta (mínimo 10 caracteres).' })
    let contraproposta: number | null = null
    if (tipo === 'contraproposta') {
      const v = Number(body?.contraproposta_cents)
      if (!Number.isInteger(v) || v <= 0) return json(400, { error: 'Informe o valor que você propõe devolver.' })
      contraproposta = v
    }

    const { data: recs } = await sb
      .from('pedido_reclamacoes')
      .select('id, pedido_id, status, prazo_loja_ate, comprador_user_id')
      .eq('id', rid)
      .eq('loja_id', lojaId)
      .limit(1)
    const rec = recs?.[0]
    if (!rec) return json(404, { error: 'Reclamação não encontrada.' })
    if (!lojaPodeResponder(rec, Date.now())) {
      return json(409, { error: rec.status === 'aguardando_loja' ? 'O prazo para responder terminou. A Bynx vai decidir o caso.' : 'Esta reclamação já foi respondida.' })
    }

    const { data: ped } = await sb.from('pedidos').select('total_comprador_cents, valor_reembolsado_cents, numero, item_nome').eq('id', rec.pedido_id).limit(1)
    const pedido = ped?.[0]
    if (contraproposta && pedido && contraproposta >= pedido.total_comprador_cents - (pedido.valor_reembolsado_cents || 0)) {
      return json(400, { error: 'Para devolver o valor inteiro, escolha aceitar o estorno.' })
    }

    const agora = new Date()
    const prazoDecisao = somarDiasUteis(agora, DIAS_UTEIS_DECISAO)!
    const { data: mexeu, error } = await sb
      .from('pedido_reclamacoes')
      .update({
        status: 'em_analise',
        resposta_tipo: tipo,
        resposta_loja: texto || null,
        contraproposta_cents: contraproposta,
        respondida_em: agora.toISOString(),
        prazo_decisao_ate: prazoDecisao.toISOString(),
        updated_at: agora.toISOString(),
      })
      .eq('id', rid)
      .eq('status', 'aguardando_loja')
      .gte('prazo_loja_ate', agora.toISOString())
      .select('id')
    if (error) {
      console.error('[reclamacao responder]', error.message)
      return json(500, { error: 'Erro ao registrar a resposta.' })
    }
    if (!mexeu?.length) return json(409, { error: 'Esta reclamação já foi respondida ou o prazo terminou.' })

    try {
      await sino(sb, rec.comprador_user_id, 'A loja respondeu sua reclamação',
        `A ${loja.nome} respondeu sobre o pedido #${pedido?.numero ?? ''}: ${RESPOSTAS_LOJA[tipo]}.`, `/pedido/${rec.pedido_id}`)
      const c = await contato(sb, rec.comprador_user_id)
      if (c.email) {
        await emailSeguro(renderReclamacaoRespostaCompradorEmail({
          to: c.email, nome: c.nome, pedidoId: rec.pedido_id, pedidoNumero: pedido?.numero ?? '',
          itemNome: pedido?.item_nome || 'seu pedido', lojaNome: loja.nome, lojaId,
          resposta: RESPOSTAS_LOJA[tipo], texto, contrapropostaCents: contraproposta, prazoDecisao: fmtPrazo(prazoDecisao),
        }))
      }
    } catch (err) {
      console.error('[reclamacao responder] avisos:', (err as Error)?.message)
    }

    return json(200, { ok: true })
  } catch (err) {
    console.error('[reclamacao responder] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
