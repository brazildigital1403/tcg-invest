import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'

/**
 * /api/lojas/[id]/capa
 *
 * POST   → Upload da capa (banner do topo da pagina publica da loja)
 * DELETE → Remove a capa (limpa capa_url + apaga arquivo do bucket)
 *
 * Disponível para TODOS os planos (basico/pro/premium) -- mesma regra do logo.
 * Path no bucket: loja-fotos/{lojaId}/capa/{uuid}.{ext}
 * Coluna afetada: lojas.capa_url (text, único — não array)
 *
 * Validações:
 *   - Bearer token + ownership da loja
 *   - MIME: image/jpeg, image/png, image/webp
 * A compressao client-side (`src/lib/comprimirImagem.ts`, desde 03/09/2026)
 * ja reduz e converte pra webp antes de chegar aqui. Ate essa data este
 * comentario AFIRMAVA isso e era falso: o FormLoja mandava o File cru.
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
 * URL: https://hvk.../storage/v1/object/public/loja-fotos/{lojaId}/capa/{uuid}.webp
 * Path: {lojaId}/capa/{uuid}.webp
 */
function extractStoragePath(url: string): string | null {
  const marker = '/loja-fotos/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.substring(idx + marker.length)
}

// ─── POST: Upload da capa ──────────────────────────────────────────────────────

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params

    // ─── Auth (owner OU admin) ─────────────────────────────
    const auth = await autenticarOwnerOuAdmin(
      req,
      lojaId,
      'id, owner_user_id, capa_url'
    )
    if ('error' in auth) return auth.error
    const { sb, loja, user, isAdmin } = auth

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
    const path = `${lojaId}/capa/${fileName}`
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
      console.error('[capa POST] erro no upload Storage', uploadErr)
      return NextResponse.json({ error: 'Erro ao salvar a imagem. Tente novamente.' }, { status: 500 })
    }

    // ─── URL pública ───────────────────────────────────────
    const { data: { publicUrl } } = sb
      .storage
      .from('loja-fotos')
      .getPublicUrl(path)

    // ─── Atualiza capa_url da loja ──────────────────────────
    // Owner: força where ownership como segurança extra. Admin: só por id.
    let updateQuery = sb
      .from('lojas')
      .update({ capa_url: publicUrl })
      .eq('id', lojaId)
    if (!isAdmin) {
      updateQuery = updateQuery.eq('owner_user_id', user!.id)
    }
    const { error: updateErr } = await updateQuery

    if (updateErr) {
      console.error('[capa POST] erro ao atualizar capa_url', updateErr)
      // Rollback: remove a foto do bucket pra não deixar órfã
      await sb.storage.from('loja-fotos').remove([path]).catch(() => {})
      return NextResponse.json({ error: 'Erro ao salvar capa na loja' }, { status: 500 })
    }

    // ─── Apaga capa anterior do bucket (best effort) ───────
    if (loja.capa_url) {
      const oldPath = extractStoragePath(loja.capa_url)
      if (oldPath) {
        await sb.storage.from('loja-fotos').remove([oldPath]).catch(err => {
          console.error('[capa POST] erro ao apagar capa anterior (orfão pode ter ficado)', err)
        })
      }
    }

    return NextResponse.json({ url: publicUrl }, { status: 200 })

  } catch (err: any) {
    console.error('[capa POST] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ─── DELETE: Remove capa ───────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params

    // ─── Auth (owner OU admin) ─────────────────────────────
    const auth = await autenticarOwnerOuAdmin(
      req,
      lojaId,
      'id, owner_user_id, capa_url'
    )
    if ('error' in auth) return auth.error
    const { sb, loja, user, isAdmin } = auth

    // ─── Limpa capa_url ────────────────────────────────────
    // Owner: força where ownership. Admin: só por id.
    let updateQuery = sb
      .from('lojas')
      .update({ capa_url: null })
      .eq('id', lojaId)
    if (!isAdmin) {
      updateQuery = updateQuery.eq('owner_user_id', user!.id)
    }
    const { error: updateErr } = await updateQuery

    if (updateErr) {
      console.error('[capa DELETE] erro ao limpar capa_url', updateErr)
      return NextResponse.json({ error: 'Erro ao remover capa' }, { status: 500 })
    }

    // ─── Apaga arquivo do Storage (best effort) ────────────
    if (loja.capa_url) {
      const oldPath = extractStoragePath(loja.capa_url)
      if (oldPath) {
        await sb.storage.from('loja-fotos').remove([oldPath]).catch(err => {
          console.error('[capa DELETE] erro ao apagar do bucket (orfão pode ter ficado)', err)
        })
      }
    }

    return NextResponse.json({ ok: true })

  } catch (err: any) {
    console.error('[capa DELETE] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
