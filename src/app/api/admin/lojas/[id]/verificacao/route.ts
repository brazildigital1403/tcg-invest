// POST /api/admin/lojas/[id]/verificacao
//
// Dispara o pedido de documentos do Selo de Loja Validada SOB DEMANDA.
//
// Por que existe alem do automatico: o gatilho da aprovacao so pega loja
// NOVA. Toda loja aprovada antes disso existir nunca receberia o pedido — e
// varias delas estao ativas ha semanas sem o selo. Sem este botao, a unica
// saida seria reprovar e aprovar de novo, o que mandaria e-mail errado pro
// lojista.
//
// NAO exige que a loja esteja pendente nem que seja nao-verificada: quem
// decide e o admin. Loja ja verificada tambem pode receber, por exemplo se o
// documento venceu ou se a validacao anterior foi informal.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { abrirVerificacaoDeLoja } from '@/lib/verificacaoLoja'

export const dynamic = 'force-dynamic'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const sb = supabaseAdmin()

    const { data: lojas } = await sb
      .from('lojas')
      .select('id, nome, owner_user_id, verificacao_ticket_id')
      .eq('id', id)
      .limit(1)

    const loja = lojas?.[0]
    if (!loja) return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })

    const r = await abrirVerificacaoDeLoja(sb, loja)
    if (!r.ok) {
      console.error('[admin/lojas/verificacao]', loja.nome, '-', r.erro)
      return NextResponse.json({ error: r.erro || 'Falha ao abrir a verificação' }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      ticketId: r.ticketId,
      reaproveitou: r.reaproveitou,
      emailEnviado: r.emailEnviado,
      para: r.para,
    })
  } catch (err: any) {
    console.error('[admin/lojas/verificacao POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
