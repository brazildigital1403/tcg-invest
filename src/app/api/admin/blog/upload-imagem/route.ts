import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * POST /api/admin/blog/upload-imagem
 *
 * Upload de imagem pro blog — usado tanto pra capa do post quanto pra imagens
 * de bloco de conteudo. Mesmo tratamento de /api/lojas/[id]/logo, sem escopo
 * de dono (bucket `blog-fotos`, so o admin escreve).
 */

const MIMES_OK = ['image/jpeg', 'image/png', 'image/webp'] as const
const TAMANHO_MAX_BYTES = 5 * 1024 * 1024
const BUCKET = 'blog-fotos'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'bin'
}

export async function POST(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Body multipart/form-data invalido' }, { status: 400 })
    }

    const file = formData.get('file')
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Campo "file" obrigatorio' }, { status: 400 })
    }

    const mime = file.type
    if (!MIMES_OK.includes(mime as typeof MIMES_OK[number])) {
      return NextResponse.json({ error: 'Tipo de arquivo invalido. Aceitos: JPG, PNG, WebP.' }, { status: 400 })
    }
    if (file.size > TAMANHO_MAX_BYTES) {
      return NextResponse.json({ error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximo: 5MB.` }, { status: 400 })
    }

    const sb = supabaseAdmin()
    const ext = extFromMime(mime)
    const path = `posts/${randomUUID()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadErr } = await sb.storage.from(BUCKET).upload(path, arrayBuffer, {
      contentType: mime,
      cacheControl: '31536000',
      upsert: false,
    })

    if (uploadErr) {
      console.error('[blog/upload-imagem] erro no upload Storage', uploadErr)
      return NextResponse.json({ error: 'Erro ao salvar a imagem. Tente novamente.' }, { status: 500 })
    }

    const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: publicUrl }, { status: 200 })
  } catch (err: any) {
    console.error('[blog/upload-imagem] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
