import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { badgesDaCarta } from '@/lib/badgesCarta'

/**
 * POST /api/metas/a-venda  { card_ids: string[] }
 *
 * "A venda agora" das Metas (#368, passo 3): quais das cartas que FALTAM na
 * meta alguem vende hoje na Bynx, e por quanto.
 *
 * ★ Nao usa `.in('card_id', ids)`. Uma meta tem ate ~770 cartas e o filtro
 * iria na URL da PostgREST. Em vez disso le os anuncios disponiveis com
 * vinculo ao catalogo (hoje ~100 linhas; a tabela inteira cabe em 6 paginas,
 * ver ofertasDaCarta.ts) e cruza aqui. Quando `marketplace` passar de alguns
 * milhares de linhas, trocar por RPC com o array no corpo.
 *
 * ★ So anuncio COMPRAVEL AGORA: `disponivel` e nao removido. A travada em
 * negociacao fica de fora -- o orcamento guiado somaria um preco que ninguem
 * consegue pagar hoje. Service role nao passa pela RLS, por isso o filtro de
 * `removido_em` e explicito.
 *
 * ★ LOJA COMPRA, COLECIONADOR NEGOCIA (decisao de 07/09): `compraDireta` so
 * com loja ativa E Connect liberado, a mesma regra de anuncioPublico.ts.
 *
 * Dado publico (e o que o /marketplace ja mostra): nao exige login.
 */

type Oferta = {
  id: string
  card_id: string
  preco: number
  idioma: string
  badges: string[]
  graduada: boolean
  vendedor: string
  lojaId: string | null
  lojaNome: string | null
  compraDireta: boolean
  href: string
}

export async function POST(req: Request) {
  let ids: string[] = []
  try {
    const body = await req.json()
    ids = Array.isArray(body?.card_ids) ? body.card_ids.filter((x: unknown) => typeof x === 'string').slice(0, 1000) : []
  } catch {
    return NextResponse.json({ erro: 'payload_invalido' }, { status: 400 })
  }
  if (ids.length === 0) return NextResponse.json({ ofertas: [] })

  const db = getServiceSupabase()
  if (!db) return NextResponse.json({ erro: 'indisponivel' }, { status: 503 })

  const { data: anuncios, error } = await db
    .from('marketplace')
    .select('id, slug, card_id, price, variante, idioma, condicao, graduada, graduadora, nota, black_label, user_id')
    .eq('status', 'disponivel')
    .is('removido_em', null)
    .not('card_id', 'is', null)
    .order('price', { ascending: true })
    .limit(2000)

  // Falha NAO vira "ninguem vende": a tela diria algo falso. Devolve erro e a
  // tela esconde o bloco.
  if (error) {
    console.error('[metas/a-venda] anuncios:', error.message)
    return NextResponse.json({ erro: 'falha' }, { status: 500 })
  }

  const alvo = new Set(ids)
  const doAlvo = (anuncios || []).filter(a => alvo.has(a.card_id as string))
  if (doAlvo.length === 0) return NextResponse.json({ ofertas: [] })

  const userIds = [...new Set(doAlvo.map(a => a.user_id).filter(Boolean))]
  const [vendedores, lojas] = await Promise.all([
    db.from('public_users').select('id, name').in('id', userIds),
    db.from('lojas').select('id, owner_user_id, nome, connect_charges_enabled').in('owner_user_id', userIds).eq('status', 'ativa'),
  ])
  if (vendedores.error) console.error('[metas/a-venda] vendedores:', vendedores.error.message)
  if (lojas.error) console.error('[metas/a-venda] lojas:', lojas.error.message)

  const porUser = new Map((vendedores.data || []).map(u => [u.id, u]))
  const lojaDe = new Map((lojas.data || []).map(l => [l.owner_user_id, l]))

  const ofertas: Oferta[] = doAlvo.map(a => {
    const u = porUser.get(a.user_id)
    const l = lojaDe.get(a.user_id)
    return {
      id: a.id,
      card_id: a.card_id as string,
      preco: Number(a.price) || 0,
      idioma: (a.idioma as string) || 'pt',
      badges: badgesDaCarta(a),
      graduada: !!a.graduada,
      vendedor: (l?.nome || u?.name || 'Vendedor Bynx').trim(),
      lojaId: l?.id || null,
      lojaNome: l?.nome?.trim() || null,
      compraDireta: !!l?.connect_charges_enabled,
      href: `/anuncio/${a.slug || a.id}`,
    }
  })

  return NextResponse.json({ ofertas })
}
