// POST /api/servicos/[id]/rastreio -- o cliente informa o codigo de envio da
// carta ate a Bynx. So depois do aceite (o endereco so aparece ali) e antes da
// chegada. Pode corrigir o codigo enquanto a carta nao chegou.

import { NextRequest, NextResponse } from 'next/server'
import { sbAdmin, carregarAutorizado, erro, registrarEvento } from '@/lib/servicosServer'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const auth = await carregarAutorizado(req, id)
    if (!auth.ok) return auth.resposta
    if (auth.sol.status !== 'aceito') return erro(409, 'O rastreio é informado depois do aceite e antes da chegada')

    const body = await req.json().catch(() => null)
    const codigo = String(body?.codigo || '').toUpperCase().replace(/[\s.-]/g, '')
    // Correios (AA123456789BR) ou transportadora: letras e numeros, 8 a 30.
    if (!/^[A-Z0-9]{8,30}$/.test(codigo)) return erro(400, 'Código de rastreio inválido')

    const { data, error } = await sbAdmin().from('servico_solicitacoes')
      .update({ rastreio_ida: codigo }).eq('id', id).eq('status', 'aceito').select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) return erro(409, 'Este pedido mudou de estado. Atualize a página.')

    await registrarEvento(id, 'aceito', `Rastreio de ida informado: ${codigo}`)
    return NextResponse.json({ ok: true, codigo })
  } catch (e) {
    console.error('[servicos/rastreio]', e instanceof Error ? e.message : e)
    return erro(500, 'Erro interno')
  }
}
