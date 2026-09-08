import 'server-only'
import { cache } from 'react'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { badgesDaCarta } from '@/lib/badgesCarta'
import { STATUS_EXPIRAVEIS, liberaEm as calcLiberaEm } from '@/lib/marketplaceStatus'

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
  /**
   * Slab graduado e OUTRO produto, nao a carta do catalogo. Quem decide o que
   * vai pro dado estruturado precisa saber diferenciar — ver `ofertasCruas`.
   */
  graduada: boolean
  vendedor: string
  vendedorCidade: string | null
  /** Loja ativa do vendedor, quando ele tem uma. */
  lojaNome: string | null
  lojaSlug: string | null
  lojaVerificada: boolean
  href: string
  /**
   * Travada numa negociacao que ainda pode cair. Ela APARECE (a carta e o
   * que atrai, e ela pode voltar em horas), mas nao e comprivel agora e
   * NUNCA entra no preco de divulgacao -- ver `ofertasParaDivulgacao`.
   */
  travada: boolean
  /** ISO de quando ela volta pro marketplace. `null` quando nao e travada. */
  liberaEm: string | null
}

/**
 * `cache()` porque `generateMetadata` e o componente da pagina rodam na MESMA
 * request e os dois precisam disto — sem o dedupe seriam duas idas ao banco
 * por revalidacao em vez de uma. (O `fetchCardData` da rota tinha o mesmo
 * problema; foi tratado no mesmo dia, junto de `/lojas/[slug]`,
 * `/produto/[id]` e `/set/[id]`.)
 */
export const buscarOfertasDaCarta = cache(async function buscarOfertasDaCarta(
  cardId: string | null,
): Promise<OfertaCarta[]> {
  if (!cardId) return []
  const db = getServiceSupabase()
  if (!db) return []

  const { data: anuncios, error } = await db
    .from('marketplace')
    .select('id, slug, card_image, fotos, price, variante, idioma, condicao, graduada, graduadora, nota, black_label, user_id, status, status_em')
    .eq('card_id', cardId)
    // ★ A TRAVADA ENTRA (08/09/2026). Ate hoje era `.eq('status','disponivel')`
    //   e o anuncio em negociacao sumia da pagina da carta -- escondendo uma
    //   oferta que volta em ate 72h. Agora ela aparece com o cronometro, e o
    //   que a mantem fora do PRECO e `ofertasParaDivulgacao`, nao este filtro.
    .in('status', ['disponivel', ...STATUS_EXPIRAVEIS])
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
      graduada: !!a.graduada,
      // `trim`: o cadastro guarda nome com espaco sobrando ("Adriano da
      // Silveira Magnabosco "), e ele ia direto pro JSON-LD.
      vendedor: (l?.nome || u?.name || 'Vendedor Bynx').trim(),
      vendedorCidade: u?.city?.trim() || null,
      lojaNome: l?.nome || null,
      lojaSlug: l?.slug || null,
      lojaVerificada: !!l?.verificada,
      // Detalhe, nao checkout: quem chega pelo /carta esta comparando ofertas
      // e precisa ver foto e vendedor antes de decidir.
      href: `/anuncio/${a.slug || a.id}`,
      travada: a.status !== 'disponivel',
      liberaEm: calcLiberaEm(a.status, a.status_em),
    }
  })
  // Comprivel primeiro, travada depois -- dentro de cada grupo o preco manda
  // (o `.order` do banco ja garantiu). Sem isto uma travada barata lideraria
  // a lista de uma carta que TEM oferta livre.
  .sort((x, y) => Number(x.travada) - Number(y.travada))
})

/**
 * So as ofertas que sao O MESMO PRODUTO da pagina.
 *
 * ★ Slab graduado fica de fora do dado estruturado. No Clefairy 94/88 o
 * mercado da carta e R$ 94,99 e o unico anuncio e um AGS 9.5 por R$ 627,12 --
 * 6,6x. Declarar isso como oferta DA CARTA faria o Google anunciar R$ 627 pra
 * quem procura a carta crua. Hoje e 1 anuncio em 61, mas a regra e o que
 * importa: o preco de um slab nao representa a carta.
 *
 * Na UI o slab continua aparecendo normalmente — la o badge "AGS 9.5" diz o
 * que e, e o comprador ve a foto. O rich snippet nao tem esse contexto.
 *
 * ★ E A TRAVADA TAMBEM FICA DE FORA (08/09/2026). Ela aparece na UI com o
 * cronometro, mas nao pode entrar no "a partir de" nem no JSON-LD: seria
 * anunciar no Google um preco que ninguem consegue pagar hoje. E o mesmo erro
 * que o guard de preco acabou de tirar de 295 paginas de carta -- so que este
 * seria auto-infligido.
 *
 * O nome mudou de `ofertasCruas` pra este porque a funcao passou a ter DOIS
 * criterios, e "crua" so descrevia o primeiro.
 */
export function ofertasParaDivulgacao(ofertas: OfertaCarta[]): OfertaCarta[] {
  return ofertas.filter(o => !o.graduada && !o.travada)
}
