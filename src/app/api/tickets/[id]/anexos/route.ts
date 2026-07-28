// Anexos de um ticket: listar (GET) e enviar (POST).
//
// Por que existe: a verificacao de loja pede cartao CNPJ, documento com foto
// do responsavel e fotos da loja. Antes o pedido dizia "responda este e-mail
// com os arquivos", e o remetente e noreply@bynx.gg — a resposta, e o
// documento junto, se perdia.
//
// ★ O arquivo vai pro bucket PRIVADO `ticket-anexos`. Nunca existe URL
// publica: quem quiser ver pede um link assinado em /anexos/[anexoId], e a
// rota so emite depois de conferir que o solicitante e o dono do ticket ou
// admin. Aqui entra RG e CNH de terceiro — bucket publico seria vazamento por
// construcao.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const MIMES_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
const TAMANHO_MAX = 10 * 1024 * 1024
const MAX_POR_TICKET = 20

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

/**
 * Quem pode mexer neste ticket? Dono ou admin.
 * Devolve o papel, porque o anexo guarda quem enviou.
 */
async function autorizar(req: NextRequest, ticketId: string): Promise<
  { ok: true; papel: 'user' | 'admin'; userId: string | null } | { ok: false; resposta: NextResponse }
> {
  const sb = supabaseAdmin()
  const { data: tickets } = await sb.from('tickets').select('id, user_id').eq('id', ticketId).limit(1)
  if (!tickets?.[0]) {
    return { ok: false, resposta: NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 }) }
  }

  const user = await getAuthUser(req)
  if (user && tickets[0].user_id === user.id) return { ok: true, papel: 'user', userId: user.id }

  // Nao e o dono — pode ser admin.
  const naoEhAdmin = await requireAdmin(req)
  if (!naoEhAdmin) return { ok: true, papel: 'admin', userId: null }

  return {
    ok: false,
    resposta: NextResponse.json({ error: user ? 'Sem permissão' : 'Não autorizado' }, { status: user ? 403 : 401 }),
  }
}

// ─── GET — lista os anexos (metadado, sem link) ─────────────────────────────
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const auth = await autorizar(req, id)
    if (!auth.ok) return auth.resposta

    const { data, error } = await supabaseAdmin()
      .from('ticket_anexos')
      .select('id, nome, mime, tamanho, enviado_por, created_at')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[tickets/anexos GET]', error.message)
      return NextResponse.json({ error: 'Erro ao listar anexos' }, { status: 500 })
    }
    return NextResponse.json({ anexos: data || [] })
  } catch (err: any) {
    console.error('[tickets/anexos GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ─── POST — envia um arquivo ────────────────────────────────────────────────
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const auth = await autorizar(req, id)
    if (!auth.ok) return auth.resposta

    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Envie um arquivo no campo "file"' }, { status: 400 })
    }
    if (!MIMES_OK.includes(file.type)) {
      return NextResponse.json({ error: `Tipo não aceito (${file.type || 'desconhecido'}). Use imagem ou PDF.` }, { status: 400 })
    }
    if (file.size > TAMANHO_MAX) {
      return NextResponse.json({ error: 'Arquivo acima de 10 MB' }, { status: 400 })
    }

    const sb = supabaseAdmin()

    // Teto por ticket: sem isso um upload em loop enche o bucket.
    const { count } = await sb
      .from('ticket_anexos')
      .select('id', { count: 'exact', head: true })
      .eq('ticket_id', id)
    if ((count ?? 0) >= MAX_POR_TICKET) {
      return NextResponse.json({ error: `Limite de ${MAX_POR_TICKET} arquivos por conversa` }, { status: 400 })
    }

    // Nome no storage NAO usa o nome do arquivo do usuario: ele pode conter
    // path traversal, acento ou colidir. O original fica so no banco, pra exibir.
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
    const path = `${id}/${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await sb.storage
      .from('ticket-anexos')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (upErr) {
      console.error('[tickets/anexos POST] upload', upErr.message)
      return NextResponse.json({ error: 'Falha ao enviar o arquivo' }, { status: 500 })
    }

    const { data: criado, error: insErr } = await sb
      .from('ticket_anexos')
      .insert({
        ticket_id: id,
        path,
        nome: file.name.slice(0, 200),
        mime: file.type,
        tamanho: file.size,
        enviado_por: auth.papel,
        user_id: auth.userId,
      })
      .select('id, nome, mime, tamanho, enviado_por, created_at')
      .limit(1)

    if (insErr || !criado?.[0]) {
      // Registro falhou: tira o arquivo do bucket pra nao virar orfao invisivel.
      await sb.storage.from('ticket-anexos').remove([path]).catch(() => {})
      console.error('[tickets/anexos POST] insert', insErr?.message)
      return NextResponse.json({ error: 'Falha ao registrar o anexo' }, { status: 500 })
    }

    // Move a conversa pro topo da lista do admin, como uma mensagem faria.
    await sb.from('tickets').update({ last_message_at: new Date().toISOString() }).eq('id', id)

    return NextResponse.json({ ok: true, anexo: criado[0] })
  } catch (err: any) {
    console.error('[tickets/anexos POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
