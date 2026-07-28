// Link para VER um anexo, e remocao.
//
// O bucket e privado de proposito (ver a migration). Entao aqui nao existe
// "URL do arquivo": a rota confere quem esta pedindo e so entao emite um link
// ASSINADO, valido por poucos minutos. Se o link vazar depois, ja expirou.
//
// Vida curta importa porque isso pode ser um RG. Link eterno em conversa de
// WhatsApp ou histórico de navegador seria o mesmo que bucket publico.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const VALIDADE_SEGUNDOS = 300 // 5 min: tempo de abrir e olhar, nao de guardar

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await sb.auth.getUser(token)
  return user
}

async function autorizar(req: NextRequest, ticketId: string) {
  const sb = supabaseAdmin()
  const { data: t } = await sb.from('tickets').select('id, user_id').eq('id', ticketId).limit(1)
  if (!t?.[0]) return { ok: false as const, status: 404, erro: 'Ticket não encontrado' }

  const user = await getAuthUser(req)
  if (user && t[0].user_id === user.id) return { ok: true as const, admin: false }

  const naoEhAdmin = await requireAdmin(req)
  if (!naoEhAdmin) return { ok: true as const, admin: true }

  return { ok: false as const, status: user ? 403 : 401, erro: user ? 'Sem permissão' : 'Não autorizado' }
}

// ─── GET — devolve link assinado ────────────────────────────────────────────
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; anexoId: string }> }) {
  try {
    const { id, anexoId } = await ctx.params
    const auth = await autorizar(req, id)
    if (!auth.ok) return NextResponse.json({ error: auth.erro }, { status: auth.status })

    const sb = supabaseAdmin()
    // Confere que o anexo e DESTE ticket: sem o eq(ticket_id) daria pra pedir
    // o anexo de outra conversa passando um id qualquer.
    const { data: anexos } = await sb
      .from('ticket_anexos')
      .select('id, path, nome, mime')
      .eq('id', anexoId)
      .eq('ticket_id', id)
      .limit(1)

    const anexo = anexos?.[0]
    if (!anexo) return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 })

    const { data: assinado, error } = await sb.storage
      .from('ticket-anexos')
      .createSignedUrl(anexo.path, VALIDADE_SEGUNDOS)

    if (error || !assinado?.signedUrl) {
      console.error('[tickets/anexo GET] assinatura', error?.message)
      return NextResponse.json({ error: 'Falha ao gerar o link' }, { status: 500 })
    }

    return NextResponse.json({
      url: assinado.signedUrl,
      nome: anexo.nome,
      mime: anexo.mime,
      expira_em_s: VALIDADE_SEGUNDOS,
    })
  } catch (err: any) {
    console.error('[tickets/anexo GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ─── DELETE — remove arquivo e registro ─────────────────────────────────────
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; anexoId: string }> }) {
  try {
    const { id, anexoId } = await ctx.params
    const auth = await autorizar(req, id)
    if (!auth.ok) return NextResponse.json({ error: auth.erro }, { status: auth.status })

    const sb = supabaseAdmin()
    const { data: anexos } = await sb
      .from('ticket_anexos').select('id, path').eq('id', anexoId).eq('ticket_id', id).limit(1)
    const anexo = anexos?.[0]
    if (!anexo) return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 })

    // Storage primeiro: se o registro sumisse antes, o arquivo ficaria orfao
    // no bucket sem ninguem sabendo que existe.
    const { error: rmErr } = await sb.storage.from('ticket-anexos').remove([anexo.path])
    if (rmErr) {
      console.error('[tickets/anexo DELETE] storage', rmErr.message)
      return NextResponse.json({ error: 'Falha ao remover o arquivo' }, { status: 500 })
    }
    await sb.from('ticket_anexos').delete().eq('id', anexoId)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[tickets/anexo DELETE]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
