import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { cotarFrete, pacoteDeCarta } from '@/lib/melhor-envio'
import { criarLimitador, ipDaRequest } from '@/lib/rateLimit'
import { resolverRecebedor } from '@/lib/vendedorRecebimento'

/**
 * GET /api/leiloes/[id]/frete?preco=centavos  (Bearer)
 *
 * Frete estimado ANTES do lance, ate o CEP do cadastro. Sem isso, o total da
 * folha de lance deixava o frete de fora. So a folha aberta chama, uma vez por
 * lote. Falha nunca atrapalha o lance: sem cotacao volta `freteCents: null` e a
 * tela diz "calculado no pagamento". Quem cobra de verdade e o checkout, que
 * cota de novo no servidor.
 *
 * Mesma origem e mesmo teto de /api/frete/cotar: a cota do token central do
 * Melhor Envio e de todas as lojas.
 */

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const semCache = { 'Cache-Control': 'no-store, max-age=0', Vary: 'Authorization' }
const limitador = criarLimitador({ janelaMs: 60_000, max: 30 })
const semFrete = (status = 200) => NextResponse.json({ freteCents: null, estimado: false, gratisAcimaCents: null }, { status, headers: semCache })

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return semFrete(404)

  const ip = ipDaRequest(req)
  if (ip) {
    limitador.gc()
    if (limitador.excedeu(ip)) return semFrete(429)
  }

  const db = getServiceSupabase()
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!db || !token) return semFrete(401)

  try {
    const { data: auth } = await db.auth.getUser(token)
    if (!auth?.user) return semFrete(401)

    const [{ data: lote }, { data: eu }] = await Promise.all([
      db.from('leiloes').select('vendedor_user_id, status, lance_inicial_cents, preco_atual_cents').eq('id', id).maybeSingle(),
      db.from('users').select('cep').eq('id', auth.user.id).maybeSingle(),
    ])
    if (!lote || lote.status !== 'ativo') return semFrete()

    const r = await resolverRecebedor(db, lote.vendedor_user_id as string)
    if (!r) return semFrete()
    if (r.freteModo === 'fixo') {
      return NextResponse.json(
        { freteCents: Math.max(0, r.freteCents), estimado: false, gratisAcimaCents: r.freteGratisAcimaCents },
        { headers: semCache },
      )
    }

    const cep = String(eu?.cep || '').replace(/\D/g, '')
    const origem = String(r.cepOrigem || '').replace(/\D/g, '')
    if (cep.length !== 8 || origem.length !== 8) return semFrete()
    const preco = Number(new URL(req.url).searchParams.get('preco'))
    const base = Number.isFinite(preco) && preco > 0 ? Math.round(preco) : Number(lote.preco_atual_cents ?? lote.lance_inicial_cents)
    const opcoes = await cotarFrete(origem, cep, [pacoteDeCarta(base)])
    if (!opcoes.length) return semFrete()
    const menor = Math.min(...opcoes.map(o => o.precoCents))
    return NextResponse.json({ freteCents: menor, estimado: true, gratisAcimaCents: null }, { headers: semCache })
  } catch (err) {
    console.error('[leilao/frete]', id, (err as Error)?.message)
    return semFrete()
  }
}
