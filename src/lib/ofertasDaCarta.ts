import 'server-only'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { badgesDaCarta } from '@/lib/badgesCarta'

/**
 * Ofertas REAIS de uma carta — os anuncios que alguem pode comprar agora.
 *
 * ★ POR QUE ISTO EXISTE (04/09/2026): a pagina publica da carta mostrava so o
 * preco de MERCADO (referencia do catalogo) e nao dizia que a propria Bynx
 * tinha aquela carta a venda. O comprador via "vale R$ 34" e nao tinha como
 * comprar; o vendedor anunciava e sua carta so aparecia em /marketplace.
 * Hoje sao 55 cartas com oferta e 61 anuncios disponiveis, todos casando com
 * o catalogo por `card_id`.
 *
 * ★ SERVER-SIDE POR CAUSA DO GOOGLE. Se a busca fosse no browser, o crawler
 * receberia a pagina sem nenhuma oferta e o JSON-LD nao teria como declarar
 * oferta de verdade. Foi exatamente o erro que a vitrine da loja cometeu ate
 * 03/09 (ver `vitrineLoja.ts`).
 *
 * ★ SERVICE ROLE EXIGE FILTRO EXPLICITO. A RLS de `marketplace`
 * (`removido_em is null or dono or comprador`, migration de 04/09) NAO se
 * aplica ao service role. Sem o `is('removido_em', null)` aqui, anuncio
 * REMOVIDO pela moderacao voltaria a aparecer — agora numa pagina indexada.
 *
 * Custo: `explain (analyze, buffers)` em 04/09 deu Seq Scan com 6 buffers e
 * 0,27 ms. A tabela inteira cabe em 6 paginas, entao indice em `card_id` seria
 * mais lento que o scan. Quando `marketplace` passar de alguns milhares de
 * linhas, medir de novo — e a rota e ISR de 24h, ou seja, isto roda uma vez
 * por revalidacao, nao por visita.
 */

export type OfertaCarta = {
  id: string
  preco: number
  /** Foto do vendedor quando existe; senao a arte do catalogo. */
  imagem: string | null
  /** Foto REAL do vendedor (nao a arte). Muda o enquadramento na UI. */
  fotoPropria: boolean
  nFotos: number
  /** Variante, idioma e condicao/graduacao — mesma regra da vitrine. */
  badges: string[]
  vendedor: string
  vendedorCidade: string | null
  /** Loja ativa do vendedor, quando ele tem uma. */
  lojaNome: string | null
  lojaSlug: string | null
  lojaVerificada: boolean
  href: string
}

export async function buscarOfertasDaCarta(cardId: string | null): Promise<OfertaCarta[]> {
  if (!cardId) return []
  const db = getServiceSupabase()
  if (!db) return []

  const { data: anuncios, error } = await db
    .from('marketplace')
    .select('id, card_image, fotos, price, variante, idioma, condicao, graduada, graduadora, nota, black_label, user_id')
    .eq('card_id', cardId)
    .eq('status', 'disponivel')
    .is('removido_em', null)
    .order('price', { ascending: true })
    .limit(12)

  // Falha aqui NAO pode virar "carta sem oferta": a pagina diria que ninguem
  // vende, o que e diferente de "nao consegui saber". Loga e devolve vazio,
  // que e o mesmo que a pagina mostrava antes de existir este bloco.
  if (error) {
    console.error('[ofertas] busca:', error.message)
    return []
  }
  if (!anuncios || anuncios.length === 0) return []

  const userIds = [...new Set(anuncios.map(a => a.user_id).filter(Boolean))]

  const [vendedores, lojas] = await Promise.all([
    db.from('public_users').select('id, name, city').in('id', userIds),
    db.from('lojas').select('owner_user_id, nome, slug, verificada').in('owner_user_id', userIds).eq('status', 'ativa'),
  ])

  if (vendedores.error) console.error('[ofertas] vendedores:', vendedores.error.message)
  if (lojas.error) console.error('[ofertas] lojas:', lojas.error.message)

  const porUser = new Map((vendedores.data || []).map(u => [u.id, u]))
  const lojaDe = new Map((lojas.data || []).map(l => [l.owner_user_id, l]))

  return anuncios.map(a => {
    const fotos: string[] = Array.isArray(a.fotos)
      ? a.fotos.filter((u: unknown): u is string => typeof u === 'string' && !!u)
      : []
    const u = porUser.get(a.user_id)
    const l = lojaDe.get(a.user_id)
    return {
      id: a.id,
      preco: Number(a.price) || 0,
      // Mesmo criterio do checkout e da vitrine: a foto do vendedor primeiro.
      imagem: fotos[0] || a.card_image || null,
      fotoPropria: fotos.length > 0,
      nFotos: fotos.length,
      badges: badgesDaCarta(a),
      vendedor: l?.nome || u?.name || 'Vendedor Bynx',
      vendedorCidade: u?.city || null,
      lojaNome: l?.nome || null,
      lojaSlug: l?.slug || null,
      lojaVerificada: !!l?.verificada,
      href: `/checkout/${a.id}`,
    }
  })
}
