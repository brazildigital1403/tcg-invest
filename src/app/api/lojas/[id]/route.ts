import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Endpoints da loja individual (owner-only).
 *
 *   PATCH  /api/lojas/[id]  → edita campos da loja
 *   DELETE /api/lojas/[id]  → soft delete (status = 'inativa')
 *
 * Em ambos, o usuário autenticado deve ser o owner da loja (user.id === loja.owner_user_id).
 * Caso contrário, retornamos 403.
 *
 * Campos que o USUÁRIO pode editar:
 *   nome, slug, descricao, tipo, especialidades,
 *   cidade, estado, endereco, cep,
 *   whatsapp, instagram, facebook, website,
 *   logo_url, banner_url, fotos, eventos,
 *   seo_title, seo_description,
 *   status  (apenas transições específicas — ver abaixo)
 *
 * Campos que SOMENTE ADMIN pode alterar (não via essa API):
 *   owner_user_id, plano, verificada, ultima_aparicao_topo
 *   status (transições restritas: aprovar pendente→ativa, suspender, etc)
 *
 * Transições de status permitidas ao owner:
 *   ativa    → inativa   (desativar loja)
 *   pendente → inativa   (desistir antes de ser aprovada)
 *   inativa  → pendente  (reativar pra re-moderação)
 *   suspensa → X         (bloqueado — só admin resolve)
 */

// ─── Whitelist de campos editáveis pelo owner ────────────────────────────────

const EDITABLE_FIELDS = new Set([
  'nome', 'slug', 'descricao', 'tipo', 'especialidades',
  'cidade', 'estado', 'endereco', 'cep',
  'whatsapp', 'instagram', 'facebook', 'website',
  'logo_url', 'banner_url', 'fotos', 'eventos',
  'seo_title', 'seo_description',
  'status', // transição controlada abaixo
])

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

// Transições de status permitidas ao owner (NÃO admin)
const USER_STATUS_TRANSITIONS: Record<string, string[]> = {
  ativa:    ['inativa'],
  pendente: ['inativa'],
  inativa:  ['pendente'],
  suspensa: [], // bloqueado
}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

async function authenticateOwner(req: NextRequest, lojaId: string) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }

  const sb = supabaseAdmin()
  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) return { error: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) }

  const { data: lojas, error: lojaErr } = await sb
    .from('lojas')
    .select('*')
    .eq('id', lojaId)
    .limit(1)

  if (lojaErr) {
    console.error('[api/lojas/[id]] erro ao buscar loja', lojaErr)
    return { error: NextResponse.json({ error: 'Erro ao buscar loja' }, { status: 500 }) }
  }

  const loja = lojas?.[0]
  if (!loja) return { error: NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 }) }

  if (loja.owner_user_id !== user.id) {
    return { error: NextResponse.json({ error: 'Você não é o dono desta loja' }, { status: 403 }) }
  }

  return { user, loja, sb }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params

    const auth = await authenticateOwner(req, id)
    if ('error' in auth) return auth.error
    const { loja, sb } = auth

    let body: Record<string, any>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
    }

    // ─── Filtra whitelist ─────────────────────────────────
    const payload: Record<string, any> = {}
    for (const key of Object.keys(body)) {
      if (EDITABLE_FIELDS.has(key)) payload[key] = body[key]
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo editável foi enviado' }, { status: 400 })
    }

    // ─── Validações específicas ───────────────────────────

    // Slug mudou?
    if (payload.slug !== undefined) {
      const slug = String(payload.slug).toLowerCase().trim()
      if (slug.length < 3 || slug.length > 50) {
        return NextResponse.json({ error: 'Slug deve ter entre 3 e 50 caracteres' }, { status: 400 })
      }
      if (!SLUG_REGEX.test(slug)) {
        return NextResponse.json({
          error: 'Slug deve conter apenas letras minúsculas, números e hífens',
        }, { status: 400 })
      }
      payload.slug = slug

      // Se mudou de fato, verifica unicidade
      if (slug !== loja.slug) {
        const { data: slugCheck } = await sb
          .from('lojas')
          .select('id')
          .eq('slug', slug)
          .neq('id', loja.id)
          .limit(1)

        if (slugCheck && slugCheck.length > 0) {
          return NextResponse.json({
            error: 'Esse slug já está em uso. Tente outro.',
          }, { status: 409 })
        }
      }
    }

    // Tipo
    if (payload.tipo !== undefined && !['fisica', 'online', 'ambas'].includes(payload.tipo)) {
      return NextResponse.json({ error: 'Tipo deve ser: fisica, online ou ambas' }, { status: 400 })
    }

    // Especialidades
    if (payload.especialidades !== undefined) {
      if (!Array.isArray(payload.especialidades) || payload.especialidades.length === 0) {
        return NextResponse.json({
          error: 'Especialidades deve ser um array com ao menos 1 jogo',
        }, { status: 400 })
      }
    }

    // Status — só permite transições válidas pelo owner
    if (payload.status !== undefined) {
      const allowed = USER_STATUS_TRANSITIONS[loja.status] || []
      if (!allowed.includes(payload.status)) {
        return NextResponse.json({
          error: `Transição de status não permitida (de "${loja.status}" para "${payload.status}"). Entre em contato com o suporte se necessário.`,
        }, { status: 403 })
      }
    }

    // ─── Update ───────────────────────────────────────────
    const { data: updated, error: updateErr } = await sb
      .from('lojas')
      .update(payload)
      .eq('id', loja.id)
      .select('*')
      .limit(1)

    if (updateErr) {
      console.error('[api/lojas/[id] PATCH] erro ao atualizar', updateErr)
      return NextResponse.json({ error: 'Erro ao atualizar loja: ' + updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ loja: updated?.[0] })

  } catch (err: any) {
    console.error('[api/lojas/[id] PATCH] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ─── DELETE (soft delete → status='inativa') ─────────────────────────────────

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params

    const auth = await authenticateOwner(req, id)
    if ('error' in auth) return auth.error
    const { loja, sb } = auth

    // Se já tá inativa, no-op (idempotente)
    if (loja.status === 'inativa') {
      return NextResponse.json({ loja, message: 'Loja já estava inativa' })
    }

    // Suspensa não pode ser desativada pelo owner (só admin gerencia)
    if (loja.status === 'suspensa') {
      return NextResponse.json({
        error: 'Loja suspensa não pode ser alterada pelo owner. Contate o suporte.',
      }, { status: 403 })
    }

    const { data: updated, error: updateErr } = await sb
      .from('lojas')
      .update({ status: 'inativa' })
      .eq('id', loja.id)
      .select('*')
      .limit(1)

    if (updateErr) {
      console.error('[api/lojas/[id] DELETE] erro ao desativar', updateErr)
      return NextResponse.json({ error: 'Erro ao desativar loja' }, { status: 500 })
    }

    return NextResponse.json({ loja: updated?.[0], message: 'Loja desativada' })

  } catch (err: any) {
    console.error('[api/lojas/[id] DELETE] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}