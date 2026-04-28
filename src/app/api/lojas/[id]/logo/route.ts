import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

/**
 * /api/lojas/[id]/logo
 *
 * POST   → Upload do logo da loja (substitui anterior se existir)
 * DELETE → Remove o logo (limpa logo_url + apaga arquivo do bucket)
 *
 * Disponível para TODOS os planos (basico/pro/premium).
 * Path no bucket: loja-fotos/{lojaId}/logo/{uuid}.{ext}
 * Coluna afetada: lojas.logo_url (text, único — não array)
 *
 * Validações:
 *   - Bearer token + ownership da loja
 *   - MIME: image/jpeg, image/png, image/webp
 *   - Tamanho: máx 5MB (compressão client-side já reduz a ~50-150KB)
 *
 * Retornos POST:
 *   - 200 → { url }
 *   - 400 → arquivo inválido / faltando
 *   - 401 → sem token / token inválido
 *   - 403 → não é owner
 *   - 404 → loja não encontrada
 *   - 500 → erro de upload ou DB
 *
 * Retornos DELETE:
 *   - 200 → { ok: true }
 *   - 401 → sem token
 *   - 403 → não é owner
 *   - 404 → loja não encontrada
 *   - 500 → erro de DB
 */

const MIMES_OK = ['image/jpeg', 'image/png', 'image/webp'] as const
const TAMANHO_MAX_BYTES = 5 * 1024 * 1024

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

/**
 * Extrai o path do arquivo dentro do bucket a partir da URL pública.
 * URL: https://hvk.../storage/v1/object/public/loja-fotos/{lojaId}/logo/{uuid}.webp
 * Path: {lojaId}/logo/{uuid}.webp
 */
function extractStoragePath(url: string): string | null {
  const marker = '/loja-fotos/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.substring(idx + marker.length)
}

// ─── POST: Upload do logo ─────────────────────────────────────────────────────

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

    // ─── Buscar loja (e logo atual pra apagar depois) ───────
    const { data: lojas, error: lojaErr } = await sb
      .from('lojas')
      .select('id, owner_user_id, logo_url')
      .eq('id', lojaId)
      .limit(1)

    if (lojaErr) {
      console.error('[logo POST] erro ao buscar loja', lojaErr)
      return NextResponse.json({ error: 'Erro ao buscar loja' }, { status: 500 })
    }

    const loja = lojas?.[0]
    if (!loja) return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
    if (loja.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Você não é o dono desta loja' }, { status: 403 })
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
    const path = `${lojaId}/logo/${fileName}`
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
      console.error('[logo POST] erro no upload Storage', uploadErr)
      return NextResponse.json({ error: 'Erro ao salvar a imagem. Tente novamente.' }, { status: 500 })
    }

    // ─── URL pública ───────────────────────────────────────
    const { data: { publicUrl } } = sb
      .storage
      .from('loja-fotos')
      .getPublicUrl(path)

    // ─── Atualiza logo_url da loja ─────────────────────────
    const { error: updateErr } = await sb
      .from('lojas')
      .update({ logo_url: publicUrl })
      .eq('id', lojaId)
      .eq('owner_user_id', user.id)

    if (updateErr) {
      console.error('[logo POST] erro ao atualizar logo_url', updateErr)
      // Rollback: remove a foto do bucket pra não deixar órfã
      await sb.storage.from('loja-fotos').remove([path]).catch(() => {})
      return NextResponse.json({ error: 'Erro ao salvar logo na loja' }, { status: 500 })
    }

    // ─── Apaga logo anterior do bucket (best effort) ───────
    if (loja.logo_url) {
      const oldPath = extractStoragePath(loja.logo_url)
      if (oldPath) {
        await sb.storage.from('loja-fotos').remove([oldPath]).catch(err => {
          console.error('[logo POST] erro ao apagar logo anterior (orfão pode ter ficado)', err)
        })
      }
    }

    return NextResponse.json({ url: publicUrl }, { status: 200 })

  } catch (err: any) {
    console.error('[logo POST] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ─── DELETE: Remove logo ──────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params

    // ─── Auth ──────────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const sb = supabaseAdmin()
    const { data: { user }, error: authErr } = await sb.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    // ─── Buscar loja (pra pegar logo atual) ────────────────
    const { data: lojas, error: lojaErr } = await sb
      .from('lojas')
      .select('id, owner_user_id, logo_url')
      .eq('id', lojaId)
      .limit(1)

    if (lojaErr) {
      console.error('[logo DELETE] erro ao buscar loja', lojaErr)
      return NextResponse.json({ error: 'Erro ao buscar loja' }, { status: 500 })
    }

    const loja = lojas?.[0]
    if (!loja) return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
    if (loja.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Você não é o dono desta loja' }, { status: 403 })
    }

    // ─── Limpa logo_url ────────────────────────────────────
    const { error: updateErr } = await sb
      .from('lojas')
      .update({ logo_url: null })
      .eq('id', lojaId)
      .eq('owner_user_id', user.id)

    if (updateErr) {
      console.error('[logo DELETE] erro ao limpar logo_url', updateErr)
      return NextResponse.json({ error: 'Erro ao remover logo' }, { status: 500 })
    }

    // ─── Apaga arquivo do Storage (best effort) ────────────
    if (loja.logo_url) {
      const oldPath = extractStoragePath(loja.logo_url)
      if (oldPath) {
        await sb.storage.from('loja-fotos').remove([oldPath]).catch(err => {
          console.error('[logo DELETE] erro ao apagar do bucket (orfão pode ter ficado)', err)
        })
      }
    }

    return NextResponse.json({ ok: true })

  } catch (err: any) {
    console.error('[logo DELETE] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
