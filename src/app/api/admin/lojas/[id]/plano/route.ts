import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { sendEmailLojaPlanoAlterado } from '@/lib/email'

/**
 * POST /api/admin/lojas/[id]/plano
 *
 * Altera o plano da loja (basico/pro/premium) com data de expiração opcional.
 * Usado para conceder Pro/Premium em negociações fora do Stripe.
 *
 * Auth: cookie HMAC `bynx_admin` (mesmo padrão das outras APIs admin).
 *
 * Body JSON:
 *   {
 *     plano: 'basico' | 'pro' | 'premium',
 *     dias: number | null   // null = permanente, 30/60/180/365 = duração em dias
 *   }
 *
 * Comportamento:
 *   - Atualiza `plano` da loja
 *   - Se `dias` fornecido: seta `plano_expira_em = NOW() + dias`
 *   - Se `dias` null/undefined: seta `plano_expira_em = NULL` (permanente)
 *   - Se mudando para `basico`: força `plano_expira_em = NULL`
 *   - Envia email pro owner avisando da mudança
 *
 * Retornos:
 *   - 200 → { ok: true, loja: {...} }
 *   - 400 → body inválido
 *   - 401 → não admin
 *   - 404 → loja não encontrada
 *   - 500 → erro interno
 */

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// ─── Auth admin (mesmo padrão do resto do /admin) ─────────────────────────────

const ADMIN_SECRET = process.env.ADMIN_HMAC_SECRET || ''

function verifyAdminCookie(req: NextRequest): boolean {
  const cookie = req.cookies.get('bynx_admin')?.value
  if (!cookie || !ADMIN_SECRET) return false
  try {
    const [payload, signature] = cookie.split('.')
    if (!payload || !signature) return false
    const expected = crypto
      .createHmac('sha256', ADMIN_SECRET)
      .update(payload)
      .digest('hex')
    if (signature !== expected) return false
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
    if (data.exp && data.exp < Date.now()) return false
    return true
  } catch {
    return false
  }
}

const PLANOS_VALIDOS = ['basico', 'pro', 'premium'] as const
type Plano = typeof PLANOS_VALIDOS[number]

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    // ─── Auth ──────────────────────────────────────────────
    if (!verifyAdminCookie(req)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id: lojaId } = await ctx.params

    // ─── Body ──────────────────────────────────────────────
    let body: { plano?: string; dias?: number | null }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
    }

    if (!body.plano || !PLANOS_VALIDOS.includes(body.plano as Plano)) {
      return NextResponse.json({
        error: `Plano inválido. Use: ${PLANOS_VALIDOS.join(', ')}`,
      }, { status: 400 })
    }

    const planoNovo = body.plano as Plano
    const dias = body.dias

    if (dias !== null && dias !== undefined) {
      if (typeof dias !== 'number' || dias < 1 || dias > 3650) {
        return NextResponse.json({
          error: 'Dias deve ser um número entre 1 e 3650, ou null para permanente',
        }, { status: 400 })
      }
    }

    // ─── Buscar loja atual ─────────────────────────────────
    const sb = supabaseAdmin()
    const { data: lojas, error: lojaErr } = await sb
      .from('lojas')
      .select('id, nome, slug, plano, owner_user_id')
      .eq('id', lojaId)
      .limit(1)

    if (lojaErr) {
      console.error('[admin/lojas/plano] erro ao buscar loja', lojaErr)
      return NextResponse.json({ error: 'Erro ao buscar loja' }, { status: 500 })
    }

    const loja = lojas?.[0]
    if (!loja) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
    }

    const planoAnterior = loja.plano as Plano

    // ─── Calcular plano_expira_em ──────────────────────────
    let planoExpiraEm: string | null = null
    if (planoNovo !== 'basico' && dias) {
      const expira = new Date()
      expira.setDate(expira.getDate() + dias)
      planoExpiraEm = expira.toISOString()
    }
    // Se planoNovo === 'basico' OU dias é null/undefined → planoExpiraEm = null

    // ─── Update loja ───────────────────────────────────────
    const { data: updated, error: updateErr } = await sb
      .from('lojas')
      .update({
        plano: planoNovo,
        plano_expira_em: planoExpiraEm,
      })
      .eq('id', lojaId)
      .select('id, nome, slug, plano, plano_expira_em, owner_user_id')
      .limit(1)

    if (updateErr) {
      console.error('[admin/lojas/plano] erro ao atualizar plano', updateErr)
      return NextResponse.json({ error: 'Erro ao atualizar plano' }, { status: 500 })
    }

    const lojaAtualizada = updated?.[0]

    // ─── Buscar dados do owner pra enviar email ────────────
    if (loja.owner_user_id && planoAnterior !== planoNovo) {
      const { data: owners } = await sb
        .from('users')
        .select('email, name')
        .eq('id', loja.owner_user_id)
        .limit(1)

      const owner = owners?.[0]
      if (owner?.email) {
        try {
          await sendEmailLojaPlanoAlterado({
            to: owner.email,
            nomeUser: owner.name || 'Colecionador',
            nomeLoja: loja.nome,
            slug: loja.slug,
            planoAnterior,
            planoNovo,
            expiraEm: planoExpiraEm,
          })
        } catch (emailErr) {
          console.error('[admin/lojas/plano] erro ao enviar email (não bloqueia)', emailErr)
          // Não retorna erro — o update foi bem-sucedido
        }
      }
    }

    return NextResponse.json({
      ok: true,
      loja: lojaAtualizada,
      planoAnterior,
      planoNovo,
      planoExpiraEm,
    })

  } catch (err: any) {
    console.error('[admin/lojas/plano] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
