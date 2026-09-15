import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

const STATUS_EM_NEGOCIACAO = ['reservado', 'em_negociacao', 'enviado', 'concluido']

/**
 * GET /api/marketplace/[id]/contato
 *
 * Revela o WhatsApp da contraparte de um anuncio EM NEGOCIACAO:
 *  - Comprador (buyer_id) recebe o WhatsApp do vendedor.
 *  - Vendedor (user_id) recebe o WhatsApp do comprador.
 *
 * Privacidade / anti-scraping: o WhatsApp NUNCA fica na view publica.
 * Para ver o numero, o comprador precisa reservar o anuncio (acao visivel
 * que notifica o vendedor e trava o anuncio) — nada de raspar em massa.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params

    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const sb = supabaseAdmin()
    const { data: authData, error: authErr } = await sb.auth.getUser(token)
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
    const uid = authData.user.id

    const { data: anuncio, error: anErr } = await sb
      .from('marketplace')
      .select('id, user_id, buyer_id, status')
      .eq('id', id)
      .single()

    if (anErr || !anuncio) {
      return NextResponse.json({ error: 'Anúncio não encontrado' }, { status: 404 })
    }

    let contraparteId: string | null = null
    let papel: 'vendedor' | 'comprador' | null = null
    if (uid === anuncio.buyer_id) {
      contraparteId = anuncio.user_id
      papel = 'vendedor'
    } else if (uid === anuncio.user_id) {
      contraparteId = anuncio.buyer_id
      papel = 'comprador'
    }

    if (!contraparteId || !STATUS_EM_NEGOCIACAO.includes(anuncio.status)) {
      return NextResponse.json({ error: 'Contato indisponível para este anúncio' }, { status: 403 })
    }

    // ★ Loja que recebe pela Bynx: o contato fica dentro da plataforma
    //   (15/09/2026). Mesma regra do bloqueio no chat (enviar_mensagem):
    //   loja ativa com recebimentos ligados. Sem isto, esta rota entregaria o
    //   WhatsApp que o chat recusa.
    const { data: lojaRecebe } = await sb
      .from('lojas')
      .select('id')
      .eq('owner_user_id', anuncio.user_id)
      .eq('status', 'ativa')
      .eq('connect_charges_enabled', true)
      .limit(1)
    if (lojaRecebe && lojaRecebe.length > 0) {
      return NextResponse.json({ error: 'Nesta venda o contato fica dentro da Bynx. Use o botão Comprar do anúncio.' }, { status: 403 })
    }

    const { data: u } = await sb
      .from('users')
      .select('whatsapp, name')
      .eq('id', contraparteId)
      .single()

    const whatsapp = (u?.whatsapp || '').replace(/\D/g, '')
    if (!whatsapp) {
      return NextResponse.json({ error: 'Esta pessoa não cadastrou WhatsApp' }, { status: 404 })
    }

    return NextResponse.json({ whatsapp, nome: u?.name || null, papel })
  } catch (err: any) {
    console.error('[marketplace/contato] erro', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
