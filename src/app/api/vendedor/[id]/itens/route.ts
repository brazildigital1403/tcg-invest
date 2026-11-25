import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { raridadePt } from '@/lib/pokedexTextos'

/**
 * GET /api/vendedor/[id]/itens -- a lista da folha "todas as cartas" do anuncio.
 *
 * ★ POR QUE EXISTE (25/11/2026). Quem queria juntar cartas de um vendedor
 * pulava entre quatro telas: o "Ver as 94 cartas" so rolava ate 6, cada carta
 * abria outro anuncio, e o "Ver todas" ia ao PERFIL (nao a loja), onde o
 * botao principal fechava uma carta por vez. A folha traz as cartas e os
 * selados do vendedor para dentro do anuncio, 24 por vez.
 *
 * `[id]` e o `users.id` de quem vende -- o mesmo agrupador da sacola. Carta
 * casa pelo dono; produto pela loja ATIVA dele (produto so existe em loja).
 *
 * ★ CONSULTAS MEDIDAS ANTES DE SUBIR (regra da casa: o `authenticator` tem 8 s
 * e buffer frio). `marketplace` tem 280 linhas e indice em `user_id`. O set e
 * o numero vem do catalogo pela CHAVE (`id = ANY(...)`, indice da PK): 33
 * buffers para 9 ids, 96 para 24 -- nada de varrer os 187 MB.
 *
 * Service role com filtro EXPLICITO (status, removido_em, ativo, estoque): a
 * RLS nao vale para o service role.
 */

const POR_PAGINA = 24
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ItemFolha {
  id: string
  tipo: 'carta' | 'produto'
  nome: string
  /** Set, numero, raridade e condicao, ja montados. O nome do anuncio repete. */
  detalhe: string | null
  imagem: string | null
  precoCents: number
  /** Pagina do item: anuncio ou produto. */
  href: string
  /** Produto: unidades. Carta: sempre 1. */
  estoque: number
}

// `%` e `_` sao curingas do ILIKE: quem busca "100%" nao quer "tudo".
const escaparIlike = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`)

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: vendedorId } = await ctx.params
  if (!UUID.test(vendedorId)) return NextResponse.json({ error: 'Vendedor inválido.' }, { status: 400 })

  const db = getServiceSupabase()
  if (!db) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })

  const sp = req.nextUrl.searchParams
  const tipo = sp.get('tipo') === 'produto' ? 'produto' : 'carta'
  const asc = sp.get('ordem') !== 'desc'
  const offset = Math.max(0, Math.min(Number(sp.get('offset')) || 0, 5000))
  const q = (sp.get('q') || '').trim().slice(0, 60)
  const exceto = sp.get('exceto')
  const padrao = q ? `%${escaparIlike(q)}%` : null

  try {
    // Loja ativa do vendedor: e dela que vem o produto. Sem loja, sem produto.
    const { data: lojas } = await db.from('lojas').select('id')
      .eq('owner_user_id', vendedorId).eq('status', 'ativa').limit(1)
    const lojaId = (lojas?.[0]?.id as string | undefined) ?? null

    // As contagens dos dois filtros acompanham a busca: "Selados 0" quando a
    // busca nao acha selado e verdade, e evita um filtro que abre vazio.
    let qCartas = db.from('marketplace').select('id', { count: 'exact', head: true })
      .eq('user_id', vendedorId).eq('status', 'disponivel').is('removido_em', null)
    if (exceto && UUID.test(exceto)) qCartas = qCartas.neq('id', exceto)
    if (padrao) qCartas = qCartas.ilike('card_name', padrao)

    // Produto vem com o `tipo` (sao poucas linhas por loja) para o filtro dizer
    // o que e: "Selados" quando todos sao selado, "Produtos" quando ha sleeve,
    // fichario ou pelucia junto. Um chip "Selados" sobre um acessorio mentiria.
    let qProdutos = lojaId
      ? db.from('loja_produtos').select('tipo', { count: 'exact' })
          .eq('loja_id', lojaId).eq('ativo', true).gt('estoque', 0)
      : null
    if (qProdutos && padrao) qProdutos = qProdutos.ilike('nome', padrao)

    const [cCartas, cProdutos] = await Promise.all([
      qCartas,
      qProdutos ?? Promise.resolve({ count: 0, data: [] as Array<{ tipo: string }>, error: null }),
    ])
    if (cCartas.error) throw new Error(cCartas.error.message)
    const prods = cProdutos as { count: number | null; data: Array<{ tipo: string }> | null }
    const total = { cartas: cCartas.count || 0, produtos: prods.count || 0 }
    const tiposProduto = new Set((prods.data || []).map(p => p.tipo))
    const rotuloProdutos = tiposProduto.size > 0 && [...tiposProduto].every(t => t === 'selado') ? 'Selados' : 'Produtos'

    let itens: ItemFolha[] = []

    if (tipo === 'carta') {
      let qy = db.from('marketplace')
        .select('id, slug, card_name, card_image, fotos, price, condicao, card_id')
        .eq('user_id', vendedorId).eq('status', 'disponivel').is('removido_em', null)
        .order('price', { ascending: asc }).order('id', { ascending: true })
        .range(offset, offset + POR_PAGINA - 1)
      if (exceto && UUID.test(exceto)) qy = qy.neq('id', exceto)
      if (padrao) qy = qy.ilike('card_name', padrao)
      const { data, error } = await qy
      if (error) throw new Error(error.message)

      // Set e numero pela chave do catalogo. Carta oculta (dedup) ou sem
      // card_id fica sem a linha de detalhe -- o anuncio segue valendo.
      const ids = [...new Set((data || []).map(c => c.card_id).filter((x): x is string => !!x))]
      const cat = new Map<string, { set_name: string | null; number: string | null; rarity: string | null }>()
      if (ids.length) {
        const { data: cs } = await db.from('pokemon_cards').select('id, set_name, number, rarity').in('id', ids)
        for (const c of cs || []) cat.set(c.id as string, c as { set_name: string | null; number: string | null; rarity: string | null })
      }

      itens = (data || []).map(c => {
        const k = c.card_id ? cat.get(c.card_id as string) : undefined
        const partes = [k?.set_name, k?.number, raridadePt(k?.rarity), c.condicao].filter(Boolean) as string[]
        const fotos = Array.isArray(c.fotos) ? c.fotos.filter((u: unknown): u is string => typeof u === 'string' && !!u) : []
        return {
          id: c.id as string,
          tipo: 'carta' as const,
          nome: (c.card_name as string) || 'Carta',
          detalhe: partes.length ? partes.join(' · ') : null,
          // A foto do vendedor vence a arte do catalogo, igual ao anuncio.
          imagem: fotos[0] || (c.card_image as string) || null,
          precoCents: Math.round(Number(c.price) * 100),
          href: `/anuncio/${c.slug || c.id}`,
          estoque: 1,
        }
      })
    } else if (lojaId) {
      let qy = db.from('loja_produtos')
        .select('id, slug, nome, fotos, preco_cents, estoque, tipo')
        .eq('loja_id', lojaId).eq('ativo', true).gt('estoque', 0)
        .order('preco_cents', { ascending: asc }).order('id', { ascending: true })
        .range(offset, offset + POR_PAGINA - 1)
      if (padrao) qy = qy.ilike('nome', padrao)
      const { data, error } = await qy
      if (error) throw new Error(error.message)
      itens = (data || []).map(p => ({
        id: p.id as string,
        tipo: 'produto' as const,
        nome: (p.nome as string) || 'Produto',
        detalhe: Number(p.estoque) > 1 ? `${p.estoque} em estoque` : 'Última unidade',
        imagem: Array.isArray(p.fotos) && p.fotos.length ? (p.fotos[0] as string) : null,
        precoCents: Number(p.preco_cents) || 0,
        href: `/produto/${p.slug || p.id}`,
        estoque: Number(p.estoque) || 1,
      }))
    }

    const doTipo = tipo === 'carta' ? total.cartas : total.produtos
    return NextResponse.json({
      itens,
      total,
      rotuloProdutos,
      lojaId,
      temMais: offset + itens.length < doTipo,
    })
  } catch (e) {
    console.error('[vendedor/itens]', vendedorId, (e as Error)?.message)
    return NextResponse.json({ error: 'Não deu para carregar as cartas.' }, { status: 500 })
  }
}
