import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// GET /api/admin/lojas?status=pendente|ativa|suspensa|inativa&q=&plano=&verificada=&page=1&perPage=50
//
// Ordenação: pendentes primeiro (pra priorizar moderação), depois created_at desc
// Retorna também agregados (counts por status) pra UI mostrar contador

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status     = searchParams.get('status')
    const q          = searchParams.get('q')?.trim().toLowerCase()
    const plano      = searchParams.get('plano')
    const verificada = searchParams.get('verificada')
    const page       = Math.max(1, Number(searchParams.get('page')    || 1))
    const perPage    = Math.min(100, Number(searchParams.get('perPage') || 50))

    const sb   = supabaseAdmin()
    const from = (page - 1) * perPage
    const to   = from + perPage - 1

    // ─── Query principal ────────────────────────────────────────────────
    let query = sb
      .from('lojas')
      .select('id, owner_user_id, nome, slug, logo_url, cidade, estado, tipo, especialidades, plano, status, verificada, suspensao_motivo, suspensao_data, aprovada_data, trial_expires_at, created_at', { count: 'exact' })

    if (status && ['pendente', 'ativa', 'suspensa', 'inativa'].includes(status)) {
      query = query.eq('status', status)
    }
    if (plano && ['basico', 'pro', 'premium'].includes(plano)) {
      query = query.eq('plano', plano)
    }
    if (verificada === 'true')  query = query.eq('verificada', true)
    if (verificada === 'false') query = query.eq('verificada', false)
    if (q) {
      query = query.or(`nome.ilike.%${q}%,slug.ilike.%${q}%,cidade.ilike.%${q}%`)
    }

    // Ordenação: pendentes primeiro (lexicográfica funciona: 'pendente' < 'suspensa')
    // Pra garantir exatamente "pendentes primeiro", uso dois orders:
    query = query
      .order('status', { ascending: true })   // pendente < suspensa < ativa < inativa (ordem lex)
      .order('created_at', { ascending: false })
      .range(from, to)

    const { data: lojas, error, count } = await query
    if (error) {
      console.error('[admin/lojas GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ─── Enriquecer com email/nome do owner ─────────────────────────────
    const ownerIds = [...new Set((lojas || []).map(l => l.owner_user_id).filter(Boolean))]
    const ownerMap: Record<string, { email: string; name: string | null }> = {}
    if (ownerIds.length > 0) {
      const { data: owners } = await sb
        .from('users')
        .select('id, email, name')
        .in('id', ownerIds)
      for (const u of owners || []) {
        ownerMap[u.id] = { email: u.email, name: u.name || null }
      }
    }

    const enriched = (lojas || []).map(l => ({
      ...l,
      owner_email: l.owner_user_id ? ownerMap[l.owner_user_id]?.email || null : null,
      owner_name:  l.owner_user_id ? ownerMap[l.owner_user_id]?.name  || null : null,
    }))

    // ─── Counts por status (pra UI mostrar contador) ────────────────────
    const [cPendente, cAtiva, cSuspensa, cInativa] = await Promise.all([
      sb.from('lojas').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
      sb.from('lojas').select('id', { count: 'exact', head: true }).eq('status', 'ativa'),
      sb.from('lojas').select('id', { count: 'exact', head: true }).eq('status', 'suspensa'),
      sb.from('lojas').select('id', { count: 'exact', head: true }).eq('status', 'inativa'),
    ])

    return NextResponse.json({
      lojas: enriched,
      total: count || 0,
      page,
      perPage,
      totalPages: count ? Math.ceil(count / perPage) : 1,
      counts: {
        pendente: cPendente.count || 0,
        ativa:    cAtiva.count    || 0,
        suspensa: cSuspensa.count || 0,
        inativa:  cInativa.count  || 0,
      },
    })
  } catch (err: any) {
    console.error('[admin/lojas GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}