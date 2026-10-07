// Pre-visualizacao de e-mail da regua. SO ADMIN (requireAdmin): devolve HTML
// para abrir no navegador, nunca envia nada.
//
// GET  ?tpl=base                 -> e-mail de exemplo com o layout + Selecao Bynx
//      &vitrine=email|default|... -> de qual vitrine ler (padrao `email`, a real)
//      &variante=dupla|destaque
// POST { variante, produtos }    -> so o bloco, para a previa ao vivo do
//                                   /admin/promocoes (produto ainda nao salvo)

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { chaveValida } from '@/lib/promocoes'
import { getPromocoesEmail, previaBlocoPromocao, previaReguaBase, type PromocaoEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const CABECALHOS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
}

/** Previa so com http(s): o HTML volta para dentro do admin. */
function soHttp(v: unknown): string {
  try {
    const u = new URL(String(v ?? ''))
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '#'
  } catch {
    return '#'
  }
}

function lerVariante(v: unknown): 'dupla' | 'destaque' {
  return v === 'destaque' ? 'destaque' : 'dupla'
}

export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  const sp = req.nextUrl.searchParams
  const tpl = sp.get('tpl') || 'base'
  if (tpl !== 'base') return NextResponse.json({ error: 'Template desconhecido. Use tpl=base.' }, { status: 404 })

  const vitrineParam = sp.get('vitrine') || 'email'
  const vitrine = chaveValida(vitrineParam) ? vitrineParam : 'email'
  const variante = lerVariante(sp.get('variante'))
  const produtos = await getPromocoesEmail(variante === 'dupla' ? 2 : 1, vitrine)
  return new NextResponse(previaReguaBase(produtos, variante), { status: 200, headers: CABECALHOS })
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  const body = await req.json().catch(() => ({}))
  const produtos: PromocaoEmail[] = Array.isArray(body.produtos)
    ? (body.produtos as Record<string, unknown>[]).slice(0, 2).map((p) => ({
        titulo: String(p?.titulo ?? '').slice(0, 120),
        preco: String(p?.preco ?? '').slice(0, 20),
        imagem: soHttp(p?.imagem),
        url: soHttp(p?.url),
      }))
    : []
  return new NextResponse(previaBlocoPromocao(lerVariante(body.variante), produtos), { status: 200, headers: CABECALHOS })
}
