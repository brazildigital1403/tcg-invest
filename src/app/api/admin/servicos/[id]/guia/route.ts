// Guia de envio de UMA solicitacao (admin): o mesmo dado que o dono recebe no
// GET do pedido, mais o remetente do cadastro. O admin ve o endereco da Bynx
// em qualquer etapa; quem decide quando o CLIENTE ve continua sendo o GET dele.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { sbAdmin, erro, enderecoRecebimento, pagamentosDoPedido } from '@/lib/servicosServer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  try {
    const { id } = await ctx.params
    const sb = sbAdmin()
    const { data: sols } = await sb.from('servico_solicitacoes').select('id, numero, servico, status, valor_declarado_cents, user_id').eq('id', id).limit(1)
    const sol = sols?.[0]
    if (!sol) return erro(404, 'Solicitação não encontrada')
    const [{ data: itens }, { data: us }, pagamentos] = await Promise.all([
      sb.from('servico_itens').select('id, aceito, valor_declarado_cents').eq('solicitacao_id', id).order('created_at'),
      sb.from('users').select('name, logradouro, numero, complemento, bairro, city, uf, cep').eq('id', sol.user_id).limit(1),
      pagamentosDoPedido(id),
    ])
    const { user_id: _u, ...solicitacao } = sol
    void _u
    return NextResponse.json({
      solicitacao,
      itens: itens || [],
      endereco: enderecoRecebimento(),
      pagamentos: pagamentos.map(({ etapa, valor_cents, pago_em }) => ({ etapa, valor_cents, pago_em })),
      cadastro: us?.[0] || null,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[admin/servicos/id/guia GET]', e instanceof Error ? e.message : e)
    return erro(500, 'Erro interno')
  }
}
