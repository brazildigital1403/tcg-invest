import { NextRequest } from 'next/server'
import { contextoPainel, json, pastaFotos } from '../_comum'

/**
 * POST /api/lojas/[id]/leiloes/foto
 * multipart/form-data: { file }
 *
 * Sobe UMA foto real do lote (frente ou verso) para o bucket `loja-fotos`, na
 * pasta leiloes/{lojaId}/, e devolve a URL publica. Quem grava a URL no lote e
 * a rota de lotes -- que so aceita URL desta pasta.
 *
 * Mesmas validacoes da /produtos/foto (MIME, 5 MB); a tela comprime antes
 * (comprimirImagem, webp 1600px). ★ Sem corte por plano: as duas fotos sao
 * OBRIGATORIAS no lote, entao barrar o Basico aqui seria barrar o leilao
 * inteiro para ele -- decisao que fica com o Du, nao escondida no upload.
 */

const MIMES_OK = ['image/jpeg', 'image/png', 'image/webp'] as const
const TAMANHO_MAX_BYTES = 5 * 1024 * 1024

function ext(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params
    const c = await contextoPainel(req, lojaId)
    if (!c.ok) return c.res
    if (c.loja.status !== 'ativa') return json(403, { error: 'Sua loja precisa estar ativa.' })

    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!file || typeof file === 'string') return json(400, { error: 'Envie uma imagem.' })

    const mime = file.type
    if (!MIMES_OK.includes(mime as (typeof MIMES_OK)[number])) {
      return json(400, { error: 'Formato inválido. Use JPG, PNG ou WEBP.' })
    }
    if (file.size > TAMANHO_MAX_BYTES) return json(400, { error: 'Imagem muito grande. Máximo 5 MB.' })

    const nome = `${pastaFotos(lojaId)}${crypto.randomUUID()}.${ext(mime)}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error: upErr } = await c.sb.storage
      .from('loja-fotos')
      .upload(nome, bytes, { contentType: mime, upsert: false })
    if (upErr) {
      console.error('[lojas/leiloes/foto] upload falhou:', upErr.message)
      return json(500, { error: 'Não consegui subir a imagem.' })
    }

    const { data: pub } = c.sb.storage.from('loja-fotos').getPublicUrl(nome)
    return json(200, { ok: true, url: pub.publicUrl })
  } catch (err) {
    console.error('[lojas/leiloes/foto] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
