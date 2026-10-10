// Pre-visualizacao de e-mail da regua. SO ADMIN (requireAdmin): devolve HTML
// para abrir no navegador, nunca envia nada.
//
// GET  ?tpl=base                 -> e-mail de exemplo com o layout + Selecao Bynx
//      &vitrine=email|default|... -> de qual vitrine ler (padrao `email`, a real)
//      &variante=dupla|destaque
// GET  ?tpl=E01..E20             -> o template com os dados de exemplo dele
//      &variante=<chave>          -> um dos exemplos extras (ex.: E14 b, E18 c)
// GET  ?tpl=lista                -> JSON com os 20 (id, nome, trilha, categoria,
//                                   variantes), para o /admin/regua
// POST { variante, produtos }    -> so o bloco, para a previa ao vivo do
//                                   /admin/promocoes (produto ainda nao salvo)

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { chaveValida } from '@/lib/promocoes'
import {
  URL_CANONICA, getPromocoesEmail, previaBlocoPromocao, previaReguaBase, type PromocaoEmail,
} from '@/lib/email'
import { IDS_REGUA, REGUA, VARIANTES, exemploDe, temTemplate } from '@/lib/regua/registro'
import type { CtxRegua } from '@/lib/regua/comum'

export const dynamic = 'force-dynamic'

const CABECALHOS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
}

/** Links de exemplo do rodape (token zerado: nao descadastra ninguem). */
const LINKS_EXEMPLO = {
  descadastrar: `${URL_CANONICA}/api/email/descadastrar?t=00000000-0000-0000-0000-000000000000`,
  preferencias: `${URL_CANONICA}/email/preferencias?t=00000000-0000-0000-0000-000000000000`,
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

/** Vitrine `email`; vazia, cai na `default` para a previa nao sair sem a Selecao Bynx. */
async function promocoesDaPrevia(): Promise<PromocaoEmail[]> {
  const email = await getPromocoesEmail(2, 'email')
  return email.length ? email : getPromocoesEmail(2, 'default')
}

export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  const sp = req.nextUrl.searchParams
  const tpl = sp.get('tpl') || 'base'

  if (tpl === 'lista') {
    const lista = IDS_REGUA.map((id) => ({
      id,
      nome: REGUA[id].nome,
      trilha: REGUA[id].trilha,
      categoria: REGUA[id].categoria,
      variantes: Object.keys(VARIANTES[id] || {}),
    }))
    return NextResponse.json({ templates: lista }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const id = tpl.toUpperCase()
  if (temTemplate(id)) {
    const ctx: CtxRegua = { links: LINKS_EXEMPLO, promocoes: await promocoesDaPrevia(), tokenImagem: null }
    const { html } = REGUA[id].montar(exemploDe(id, sp.get('variante')), ctx)
    return new NextResponse(html, { status: 200, headers: CABECALHOS })
  }

  if (tpl !== 'base') {
    return NextResponse.json({ error: 'Template desconhecido. Use tpl=base, tpl=lista ou tpl=E01..E20.' }, { status: 404 })
  }

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
