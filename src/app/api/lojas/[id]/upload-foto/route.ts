import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

/**
 * POST /api/lojas/[id]/upload-foto
 *
 * Faz upload de uma foto pra galeria da loja. Substitui o stub 501 do Passo 7.
 *
 * Validações:
 *   - Bearer token + ownership da loja
 *   - Plano da loja: basico=0, pro=5, premium=10 fotos máx
 *   - Plano expirado degrada pra basico (bloqueia upload)
 *   - MIME: image/jpeg, image/png, image/webp
 *   - Tamanho: máx 5MB (limite do bucket)
 *
 * Retornos:
 *   - 200 → { url, fotos }
 *   - 400 → arquivo inválido / faltando / muito grande
 *   - 401 → sem token / token inválido
 *   - 403 → não é owner / plano não permite / limite atingido
 *   - 404 → loja não encontrada
 *   - 500 → erro de upload ou DB
 *
 * Convenção de path no bucket:
 *   loja-fotos/{loja_id}/{uuid_random}.{ext}
 */

const MIMES_OK = ['image/jpeg', 'image/png', 'image/webp'] as const
const TAMANHO_MAX_BYTES = 5 * 1024 * 1024 // 5MB

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

/**
 * Calcula o plano efetivo da loja considerando expiração.
 * Se o plano é pro/premium mas plano_expira_em já passou, retorna 'basico'.
 */
function planoEfetivo(loja: { plano: string; plano_expira_em: string | null }): string {
  if (loja.plano === 'basico') return 'basico'
  if (!loja.plano_expira_em) return loja.plano // sem data = vitalício (caso raro)
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

    // ─── Buscar loja ───────────────────────────────────────
    const { data: lojas, error: lojaErr } = await sb
      .from('lojas')
      .select('id, owner_user_id, plano, plano_expira_em, fotos')
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

    // ─── Validar plano e limite ────────────────────────────
    const plano = planoEfetivo(loja)
    const limite = LIMITES_FOTOS_POR_PLANO[plano] ?? 0
    const fotosAtuais: string[] = Array.isArray(loja.fotos) ? loja.fotos : []

    if (limite === 0) {
      return NextResponse.json({
        error: 'Seu plano atual não permite fotos. Faça upgrade para Pro ou Premium.',
      }, { status: 403 })
    }
    if (fotosAtuais.length >= limite) {
      return NextResponse.json({
        error: `Limite de ${limite} foto${limite > 1 ? 's' : ''} atingido no plano ${plano}.`,
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

    // Validações de arquivo
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

    // Converte Blob -> ArrayBuffer (Supabase storage aceita ArrayBuffer)
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadErr } = await sb
      .storage
      .from('loja-fotos')
      .upload(path, arrayBuffer, {
        contentType: mime,
        cacheControl: '31536000', // 1 ano (são imagens permanentes)
        upsert: false,
      })

    if (uploadErr) {
      console.error('[upload-foto] erro no upload Storage', uploadErr)
      return NextResponse.json({ error: 'Erro ao salvar a imagem. Tente novamente.' }, { status: 500 })
    }

    // ─── URL pública ───────────────────────────────────────
    const { data: { publicUrl } } = sb
      .storage
      .from('loja-fotos')
      .getPublicUrl(path)

    // ─── Atualiza array fotos da loja ──────────────────────
    const novasFotos = [...fotosAtuais, publicUrl]

    const { error: updateErr } = await sb
      .from('lojas')
      .update({ fotos: novasFotos })
      .eq('id', lojaId)

    if (updateErr) {
      console.error('[upload-foto] erro ao atualizar fotos da loja', updateErr)
      // Tenta remover a foto do bucket pra não deixar órfã
      await sb.storage.from('loja-fotos').remove([path]).catch(() => {})
      return NextResponse.json({ error: 'Erro ao salvar foto na loja' }, { status: 500 })
    }

    return NextResponse.json({ url: publicUrl, fotos: novasFotos }, { status: 200 })

  } catch (err: any) {
    console.error('[upload-foto] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
