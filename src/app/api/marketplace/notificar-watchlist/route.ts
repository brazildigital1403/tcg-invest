import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { notify } from '@/lib/notify'

/**
 * POST /api/marketplace/notificar-watchlist
 *
 * Watchlist Fase 2: dispara logo depois de um anuncio novo ser criado no
 * Marketplace, avisando quem tem aquela carta na watchlist -- nao so quem
 * acompanha variacao de preco (isso o cron-notificacoes ja faz). Chamado
 * pelo client (AnunciarModal) fire-and-forget depois do insert em
 * `marketplace` dar certo; falha aqui nunca deve travar o fluxo de anunciar.
 *
 * Le o anuncio pelo ID em vez de confiar em card_id vindo do client -- so
 * notifica quem acompanha uma carta de um anuncio que realmente existe e
 * pertence a quem chamou.
 */
export async function POST(req: NextRequest) {
  try {
    const sb = getServiceSupabase()
    if (!sb) return NextResponse.json({ error: 'Servico indisponivel.' }, { status: 503 })

    const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!bearer) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    const { data: authData, error: authErr } = await sb.auth.getUser(bearer)
    if (authErr || !authData?.user) return NextResponse.json({ error: 'Token invalido.' }, { status: 401 })
    const vendedorId = authData.user.id

    const body = await req.json().catch(() => null)
    const anuncioId = body?.anuncio_id
    if (!anuncioId) return NextResponse.json({ error: 'anuncio_id obrigatorio.' }, { status: 400 })

    const { data: anuncio } = await sb
      .from('marketplace')
      .select('id, user_id, card_id, card_name, price, status')
      .eq('id', anuncioId)
      .maybeSingle()

    if (!anuncio || anuncio.user_id !== vendedorId || anuncio.status !== 'disponivel' || !anuncio.card_id) {
      return NextResponse.json({ notificados: 0 })
    }

    const { data: watchers } = await sb
      .from('watchlist')
      .select('user_id')
      .eq('card_id', anuncio.card_id)
      .neq('user_id', vendedorId)

    if (!watchers || watchers.length === 0) {
      return NextResponse.json({ notificados: 0 })
    }

    const cleanNome = (raw: string) =>
      (raw || '')
        .replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
        .replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()
    const nome = cleanNome(anuncio.card_name || '')
    const fmtBRL = (v: number) => Number(v || 0).toFixed(2).replace('.', ',')

    let notificados = 0
    for (const w of watchers) {
      const { data: existing } = await sb
        .from('notifications')
        .select('id')
        .eq('user_id', w.user_id)
        .eq('type', 'watch_listada')
        .eq('data->>anuncio_id', anuncioId)
        .limit(1)
      if (existing && existing.length > 0) continue

      const ok = await notify(
        w.user_id,
        'watch_listada',
        `${nome} apareceu no Marketplace`,
        `Por R$ ${fmtBRL(anuncio.price)} — uma carta que você acompanha.`,
        { anuncio_id: anuncioId, card_id: anuncio.card_id, price: anuncio.price }
      )
      if (ok) notificados++
    }

    return NextResponse.json({ notificados })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
