import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { sendCardRequestResolvedEmail } from '@/lib/emailCardRequest'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

const STATUSES = ['pendente', 'em_analise', 'adicionada', 'rejeitada']

export async function GET(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const sb = supabaseAdmin()
    const { searchParams } = new URL(req.url)

    if (searchParams.get('count')) {
      const { count, error } = await sb
        .from('card_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ pendente: count || 0 })
    }

    const status = searchParams.get('status')
    const tipo = searchParams.get('tipo')
    const origem = searchParams.get('origem')
    const q = searchParams.get('q')?.trim()

    let query = sb
      .from('card_requests')
      .select('id, tipo, numero, nome, colecao, idioma, card_id, erro_tipo, descricao, termo_busca, origem, user_id, status, notas_admin, notificado, created_at, resolved_at')
      .order('created_at', { ascending: false })
      .limit(400)

    if (status && STATUSES.includes(status)) query = query.eq('status', status)
    if (tipo && ['faltando', 'erro'].includes(tipo)) query = query.eq('tipo', tipo)
    if (origem && ['form', 'auto'].includes(origem)) query = query.eq('origem', origem)
    if (q) query = query.or(`nome.ilike.%${q}%,termo_busca.ilike.%${q}%,numero.ilike.%${q}%`)

    const { data: rows, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const userIds = [...new Set((rows || []).map(r => r.user_id).filter(Boolean))] as string[]
    const userMap: Record<string, { email: string; name: string }> = {}
    if (userIds.length) {
      const { data: users } = await sb.from('users').select('id, email, name').in('id', userIds)
      for (const u of users || []) userMap[u.id] = { email: u.email, name: u.name || '' }
    }

    const cardIds = [...new Set((rows || []).map(r => r.card_id).filter(Boolean))] as string[]
    const cardMap: Record<string, any> = {}
    if (cardIds.length) {
      const { data: cards } = await sb.from('pokemon_cards').select('id, name, number, set_name, image_small').in('id', cardIds)
      for (const c of cards || []) cardMap[c.id] = c
    }

    const enriched = (rows || []).map(r => ({
      ...r,
      user_email: r.user_id ? (userMap[r.user_id]?.email || null) : null,
      user_name: r.user_id ? (userMap[r.user_id]?.name || null) : null,
      card: r.card_id ? (cardMap[r.card_id] || null) : null,
    }))

    return NextResponse.json({ requests: enriched })
  } catch (err: any) {
    console.error('[admin/card-requests GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const body = await req.json().catch(() => ({}))
    const ids: string[] = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : [])
    const status: string | undefined = body.status
    const notas_admin: string | undefined = body.notas_admin
    const card_id: string | undefined = body.card_id

    if (!ids.length) return NextResponse.json({ error: 'ids obrigatorio' }, { status: 400 })
    if (status && !STATUSES.includes(status)) return NextResponse.json({ error: 'status invalido' }, { status: 400 })

    const sb = supabaseAdmin()

    const { data: alvos, error: loadErr } = await sb
      .from('card_requests')
      .select('id, tipo, nome, numero, colecao, card_id, erro_tipo, user_id, status, notificado')
      .in('id', ids)
    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })

    const patch: any = {}
    if (status) patch.status = status
    if (notas_admin !== undefined) patch.notas_admin = notas_admin
    if (card_id !== undefined) patch.card_id = card_id || null
    if (status === 'adicionada' || status === 'rejeitada') patch.resolved_at = new Date().toISOString()

    const aNotificar = status === 'adicionada'
      ? (alvos || []).filter(a => !a.notificado && a.user_id)
      : []

    const { error: upErr } = await sb.from('card_requests').update(patch).in('id', ids)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    let emailsEnviados = 0
    if (aNotificar.length) {
      const uids = [...new Set(aNotificar.map(a => a.user_id))] as string[]
      const { data: users } = await sb.from('users').select('id, email, name').in('id', uids)
      const umap: Record<string, { email: string; name: string }> = {}
      for (const u of users || []) umap[u.id] = { email: u.email, name: u.name || '' }

      for (const a of aNotificar) {
        const u = umap[a.user_id!]
        if (!u?.email) continue
        try {
          await sendCardRequestResolvedEmail({
            to: u.email,
            name: u.name || '',
            tipo: a.tipo,
            nome: a.nome,
            numero: a.numero,
            colecao: a.colecao,
            cardId: card_id || a.card_id,
            erroTipo: a.erro_tipo,
          })
          emailsEnviados++
          await sb.from('card_requests').update({ notificado: true }).eq('id', a.id)
        } catch (e: any) {
          console.error('[admin/card-requests email]', e?.message)
        }
      }
    }

    return NextResponse.json({ ok: true, updated: ids.length, emails: emailsEnviados })
  } catch (err: any) {
    console.error('[admin/card-requests PATCH]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
