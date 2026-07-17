import { NextRequest, NextResponse } from 'next/server'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'

/**
 * POST /api/lojas/[id]/produtos/foto
 * multipart/form-data: { file }
 *
 * Sobe UMA imagem pro bucket `loja-fotos` (pasta produtos/) e devolve a URL
 * publica. Quem grava a URL em `loja_produtos.fotos` e a rota de produtos —
 * aqui so tratamos o arquivo.
 *
 * Por que nao reusar /upload-foto: aquela faz append em `lojas.fotos` (galeria
 * da loja) via RPC. Produto tem galeria propria; misturar bagunçaria as duas.
 *
 * Espelha as validacoes da /upload-foto: MIME, 5MB e limite por plano.
 */

const MIMES_OK = ['image/jpeg', 'image/png', 'image/webp'] as const
const TAMANHO_MAX_BYTES = 5 * 1024 * 1024
const LIMITES_FOTOS_POR_PLANO: Record<string, number> = { basico: 0, pro: 5, premium: 10 }

function ext(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

/** Plano vencido cai pra basico — mesma regra da /upload-foto. */
function planoEfetivo(loja: { plano: string; plano_expira_em: string | null }): string {
  if (loja.plano === 'basico') return 'basico'
  if (!loja.plano_expira_em) return loja.plano
  return new Date(loja.plano_expira_em).getTime() > Date.now() ? loja.plano : 'basico'
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params
    const auth = await autenticarOwnerOuAdmin(
      req,
      lojaId,
      'id, owner_user_id, status, plano, plano_expira_em'
    )
    if ('error' in auth) return auth.error
    const { loja, sb, isAdmin } = auth

    if (loja.status !== 'ativa') {
      return NextResponse.json({ error: 'Sua loja precisa estar ativa.' }, { status: 403 })
    }

    // Admin nao e barrado por plano (mesma logica da /upload-foto).
    const plano = planoEfetivo(loja as { plano: string; plano_expira_em: string | null })
    const limite = LIMITES_FOTOS_POR_PLANO[plano] ?? 0
    if (!isAdmin && limite === 0) {
      return NextResponse.json(
        { error: 'O plano Básico não permite fotos. Assine o Pro ou o Premium para vender produtos com imagem.' },
        { status: 403 }
      )
    }

    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Envie uma imagem.' }, { status: 400 })
    }

    const mime = file.type
    if (!MIMES_OK.includes(mime as (typeof MIMES_OK)[number])) {
      return NextResponse.json({ error: 'Formato inválido. Use JPG, PNG ou WEBP.' }, { status: 400 })
    }
    if (file.size > TAMANHO_MAX_BYTES) {
      return NextResponse.json({ error: 'Imagem muito grande. Máximo 5 MB.' }, { status: 400 })
    }

    const nome = `produtos/${lojaId}/${crypto.randomUUID()}.${ext(mime)}`
    const bytes = new Uint8Array(await file.arrayBuffer())

    const { error: upErr } = await sb.storage
      .from('loja-fotos')
      .upload(nome, bytes, { contentType: mime, upsert: false })

    if (upErr) {
      console.error('[produtos/foto] upload falhou:', upErr.message)
      return NextResponse.json({ error: 'Não consegui subir a imagem.' }, { status: 500 })
    }

    const { data: pub } = sb.storage.from('loja-fotos').getPublicUrl(nome)
    return NextResponse.json({ ok: true, url: pub.publicUrl, limite })
  } catch (err) {
    console.error('[produtos/foto] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
