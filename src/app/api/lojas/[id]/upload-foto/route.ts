import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

/**
 * POST /api/lojas/[id]/upload-foto
 *
 * v2: usa RPC lojas_append_foto pra append atômico (resolve race condition de
 * uploads paralelos do client). O lock FOR UPDATE garante serialização.
 *
 * Validações:
 *   - Bearer token + ownership da loja
 *   - Plano da loja: basico=0, pro=5, premium=10 fotos máx
 *   - Plano expirado degrada pra basico
 *   - MIME: image/jpeg, image/png, image/webp
 *   - Tamanho: máx 5MB
 *
 * Retornos:
 *   - 200 → { url, fotos }
 *   - 400 → arquivo inválido
 *   - 401 → sem token
 *   - 403 → não é owner / plano não permite / limite atingido
 *   - 404 → loja não encontrada
 *   - 500 → erro interno
 */

const MIMES_OK = ['image/jpeg', 'image/png', 'image/webp'] as const
const TAMANHO_MAX_BYTES = 5 * 1024 * 1024

const LIMITES_FOTOS_POR_PLANO: Record<string, number> = {
  basico:  0,
  pro:     5,
  premium: 10,
}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png')  return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'bin'
}

function planoEfetivo(loja: { plano: string; plano_expira_em: string | null }): string {
  if (loja.plano === 'basico') return 'basico'
  if (!loja.plano_expira_em) return loja.plano
  const expira = new Date(loja.plano_expira_em).getTime()
  return expira > Date.now() ? loja.plano : 'basico'
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params

    // ─── Auth ──────────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const sb = supabaseAdmin()
    const { data: { user }, error: authErr } = await sb.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    // ─── Buscar loja (sem ler fotos — RPC vai bloquear e ler) ────
    const { data: lojas, error: lojaErr } = await sb
      .from('lojas')
      .select('id, owner_user_id, plano, plano_expira_em')
      .eq('id', lojaId)
      .limit(1)

    if (lojaErr) {
      console.error('[upload-foto] erro ao buscar loja', lojaErr)
      return NextResponse.json({ error: 'Erro ao buscar loja' }, { status: 500 })
    }

    const loja = lojas?.[0]
    if (!loja) return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
    if (loja.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Você não é o dono desta loja' }, { status: 403 })
    }

    // ─── Validar plano ─────────────────────────────────────
    const plano = planoEfetivo(loja)
    const limite = LIMITES_FOTOS_POR_PLANO[plano] ?? 0

    if (limite === 0) {
      return NextResponse.json({
        error: 'Seu plano atual não permite fotos. Faça upgrade para Pro ou Premium.',
      }, { status: 403 })
    }

    // ─── Parse multipart ────────────────────────────────────
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Body multipart/form-data inválido' }, { status: 400 })
    }

    const file = formData.get('file')
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Campo "file" obrigatório' }, { status: 400 })
    }

    const mime = file.type
    if (!MIMES_OK.includes(mime as typeof MIMES_OK[number])) {
      return NextResponse.json({
        error: 'Tipo de arquivo inválido. Aceitos: JPG, PNG, WebP.',
      }, { status: 400 })
    }
    if (file.size > TAMANHO_MAX_BYTES) {
      return NextResponse.json({
        error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 5MB.`,
      }, { status: 400 })
    }

    // ─── Upload pro bucket ─────────────────────────────────
    const ext = extFromMime(mime)
    const fileName = `${randomUUID()}.${ext}`
    const path = `${lojaId}/${fileName}`
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadErr } = await sb
      .storage
      .from('loja-fotos')
      .upload(path, arrayBuffer, {
        contentType: mime,
        cacheControl: '31536000',
        upsert: false,
      })

    if (uploadErr) {
      console.error('[upload-foto] erro no upload Storage', uploadErr)
      return NextResponse.json({ error: 'Erro ao salvar a imagem. Tente novamente.' }, { status: 500 })
    }

    const { data: { publicUrl } } = sb
      .storage
      .from('loja-fotos')
      .getPublicUrl(path)

    // ─── APPEND ATÔMICO via RPC ────────────────────────────
    // A RPC faz lock FOR UPDATE da linha + valida limite + dá append atômico.
    // Isso resolve a race condition de uploads paralelos do client.
    const { data: rpcData, error: rpcErr } = await sb.rpc('lojas_append_foto', {
      p_loja_id: lojaId,
      p_owner_id: user.id,
      p_url: publicUrl,
      p_max_fotos: limite,
    })

    if (rpcErr) {
      console.error('[upload-foto] erro RPC append', rpcErr)
      // Rollback: remove a foto do bucket pra não deixar órfã
      await sb.storage.from('loja-fotos').remove([path]).catch(() => {})

      // Detecta se foi limite atingido
      const msg = rpcErr.message || ''
      if (msg.includes('Limite de')) {
        return NextResponse.json({
          error: `Limite de ${limite} foto${limite > 1 ? 's' : ''} atingido no plano ${plano}.`,
        }, { status: 403 })
      }
      return NextResponse.json({ error: 'Erro ao salvar foto na loja' }, { status: 500 })
    }

    const novasFotos = (rpcData?.[0]?.fotos as string[]) || []

    return NextResponse.json({ url: publicUrl, fotos: novasFotos }, { status: 200 })

  } catch (err: any) {
    console.error('[upload-foto] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
