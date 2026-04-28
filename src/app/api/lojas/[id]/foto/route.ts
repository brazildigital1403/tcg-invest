import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'

/**
 * DELETE /api/lojas/[id]/foto
 *
 * Remove uma foto da galeria da loja.
 * - Remove a URL do array `fotos` na tabela `lojas`
 * - Apaga o arquivo correspondente do bucket `loja-fotos`
 *
 * Body JSON: { url: string }
 *
 * Ownership: só o dono da loja pode deletar.
 *
 * Retornos:
 *   - 200 → { fotos: [...] }
 *   - 400 → URL faltando ou não pertence à loja
 *   - 401 → sem token / token inválido
 *   - 403 → não é owner
 *   - 404 → loja não encontrada
 *   - 500 → erro de DB ou Storage
 */

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

/**
 * Extrai o path do arquivo dentro do bucket a partir da URL pública.
 *
 * URL: https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/loja-fotos/{lojaId}/{uuid}.webp
 * Path: {lojaId}/{uuid}.webp
 */
function extractStoragePath(url: string): string | null {
  const marker = '/loja-fotos/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.substring(idx + marker.length)
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params

    // ─── Auth (owner OU admin) ─────────────────────────────
    const auth = await autenticarOwnerOuAdmin(
      req,
      lojaId,
      'id, owner_user_id, fotos'
    )
    if ('error' in auth) return auth.error
    const { sb, loja } = auth

    // ─── Body ──────────────────────────────────────────────
    let body: { url?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
    }

    const url = body.url?.trim()
    if (!url) return NextResponse.json({ error: 'Campo "url" obrigatório' }, { status: 400 })

    // ─── Verifica que a URL pertence à loja ────────────────
    const fotosAtuais: string[] = Array.isArray(loja.fotos) ? loja.fotos : []
    if (!fotosAtuais.includes(url)) {
      return NextResponse.json({
        error: 'Foto não encontrada nesta loja',
      }, { status: 400 })
    }

    // ─── Atualiza array (remove a URL) ─────────────────────
    const novasFotos = fotosAtuais.filter(u => u !== url)

    const { error: updateErr } = await sb
      .from('lojas')
      .update({ fotos: novasFotos })
      .eq('id', lojaId)

    if (updateErr) {
      console.error('[delete-foto] erro ao atualizar lojas', updateErr)
      return NextResponse.json({ error: 'Erro ao remover foto' }, { status: 500 })
    }

    // ─── Apaga do Storage (best effort, não bloqueia sucesso) ─
    const storagePath = extractStoragePath(url)
    if (storagePath) {
      const { error: storageErr } = await sb
        .storage
        .from('loja-fotos')
        .remove([storagePath])
      if (storageErr) {
        // Loga mas não retorna erro — DB foi atualizado, foto não aparece mais
        console.error('[delete-foto] erro ao apagar do bucket (foto orfã pode ter ficado)', storageErr)
      }
    }

    return NextResponse.json({ fotos: novasFotos })

  } catch (err: any) {
    console.error('[delete-foto] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
