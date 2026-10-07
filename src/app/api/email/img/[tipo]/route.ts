import { NextRequest } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { temSegredoImagem, verificar } from '@/lib/regua/imgToken'
import { DESENHOS } from '@/lib/regua/img'

/**
 * GET /api/email/img/[tipo] -- imagem pessoal dos e-mails da regua.
 *
 * Modos:
 * - `?exemplo=1`: desenha a persona de exemplo do template (pre-visualizacao,
 *   admin, provas). Nao le banco nem segredo.
 * - `?t=<token>`: token de `src/lib/regua/imgToken.ts` (uuid do envio +
 *   HMAC). Os dados vem de `email_envios.meta.img.<tipo>`, gravados pelo motor
 *   no envio. Token ruim, envio inexistente ou sem os dados = 404 sem detalhe.
 *   Sem o segredo no ambiente = 503.
 *
 * ★ CACHE: o envio nao muda depois de enviado, entao a imagem do token e
 * `immutable` por 1 ano no CDN. Como nas OG dinamicas (95895b7), o header
 * explicito e o que segura o CDN; ISR sozinho re-renderizava por request.
 * O exemplo muda quando o desenho muda: 1 dia.
 *
 * ★ FALHA NUNCA VAI PARA O CACHE: erro de banco, de imagem de carta ou de
 * render vira 500 com `no-store`. Nada de imagem vazia "valida".
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 20

const CACHE_ENVIO = 'public, max-age=31536000, s-maxage=31536000, immutable'
const CACHE_EXEMPLO = 'public, max-age=3600, s-maxage=86400'

function vazio(status: number): Response {
  return new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params
  const desenho = Object.prototype.hasOwnProperty.call(DESENHOS, tipo) ? DESENHOS[tipo] : undefined
  if (!desenho) return vazio(404)

  const q = req.nextUrl.searchParams
  let dados: unknown
  let cache: string

  if (q.get('exemplo') === '1') {
    dados = desenho.exemplo
    cache = CACHE_EXEMPLO
  } else {
    if (!temSegredoImagem()) return vazio(503)
    const id = verificar(q.get('t'))
    if (!id) return vazio(404)
    const sb = getServiceSupabase()
    if (!sb) return vazio(503)
    const { data, error } = await sb.from('email_envios').select('meta').eq('id', id).maybeSingle()
    if (error) {
      console.error('[img regua] leitura do envio falhou:', error.code)
      return vazio(500)
    }
    const img = (data?.meta as { img?: Record<string, unknown> } | null)?.img
    dados = img && Object.prototype.hasOwnProperty.call(img, tipo) ? img[tipo] : undefined
    if (!desenho.valido(dados)) return vazio(404)
    cache = CACHE_ENVIO
  }

  try {
    const jpg = await desenho.renderizar(dados)
    return new Response(new Uint8Array(jpg), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(jpg.length),
        'Cache-Control': cache,
      },
    })
  } catch (e) {
    console.error(`[img regua] ${tipo}:`, e instanceof Error ? e.message : e)
    return vazio(500)
  }
}
