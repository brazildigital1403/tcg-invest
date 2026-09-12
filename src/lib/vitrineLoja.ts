import 'server-only'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { badgesDaCarta } from '@/lib/badgesCarta'
import { STATUS_EXPIRAVEIS, liberaEm as calcLiberaEm } from '@/lib/marketplaceStatus'

/**
 * Itens da vitrine de uma loja — CARTAS (marketplace) + PRODUTOS (loja_produtos)
 * no mesmo formato.
 *
 * ★ POR QUE ISTO VIVE NO SERVIDOR (03/09/2026): antes a vitrine buscava no
 * BROWSER, dentro de `AnunciosLoja` ('use client'). Resultado: o Google recebia
 * a pagina da loja **sem nada do que ela vende** — a lista inteira era invisivel
 * pro crawler. O produto ate ganhou pagina propria indexavel, mas a vitrine que
 * leva ate ela nao existia no HTML.
 *
 * ★ E POR QUE O MAPEAMENTO VEM JUNTO: se o servidor buscasse e o componente
 * montasse o item, a regra de badge/href/preco existiria em dois lugares — o
 * padrao que mais gerou bug nesta operacao. Aqui a vitrine tem UMA fonte.
 *
 * ★ SERVICE ROLE EXIGE FILTRO EXPLICITO. A RLS de `loja_produtos`
 * (`ativo AND estoque > 0`) NAO se aplica ao service role. Sem o where, a
 * vitrine mostraria produto despublicado. Mesma pegadinha do sitemap.
 */

export type ItemVitrine = {
  id: string
  tipo: string
  nome: string
  imagem: string | null
  preco: number
  /** Badges: carta -> variante/condicao · produto -> estoque */
  badges: string[]
  /** Destino do CTA de compra. */
  href: string
  /** Pagina de detalhe. So produto tem uma; carta ainda nao. */
  detalhe: string | null
  ehCarta: boolean
  /**
   * A imagem e foto do VENDEDOR (nao a arte do catalogo). Muda o
   * enquadramento: a arte ja vem na proporcao 0.72 de carta, a foto vem numa
   * proporcao qualquer de celular.
   */
  fotoPropria: boolean
  /** Quantas fotos o vendedor subiu. 0 quando a imagem e a arte do catalogo. */
  nFotos: number
  /**
   * As fotos do vendedor, na ordem. A vitrine precisa da LISTA (nao so da
   * contagem) desde 12/09 pra navegar entre elas no proprio card -- antes
   * mostrava `fotos[0]` e o selo dizia "6" sem jeito de ver as outras.
   */
  fotos: string[]
  /**
   * Travada numa negociacao que ainda pode cair. Aparece na vitrine com o
   * cronometro em vez de sumir -- ver `CronometroLiberacao`.
   */
  travada: boolean
  /** ISO de quando ela volta pro marketplace. `null` quando nao e travada. */
  liberaEm: string | null
}

export async function buscarItensDaVitrine(
  ownerUserId: string | null,
  lojaId: string | null,
): Promise<ItemVitrine[]> {
  const db = getServiceSupabase()
  if (!db) return []

  const [cartas, produtos] = await Promise.all([
    ownerUserId
      ? db
          .from('marketplace')
          .select('id, slug, card_name, card_image, fotos, price, variante, idioma, condicao, graduada, graduadora, nota, black_label, status, status_em')
          .eq('user_id', ownerUserId)
          // ★ A TRAVADA ENTRA (08/09/2026). Com `.eq('status','disponivel')` a
          //   carta em negociacao sumia da vitrine e a loja parecia ter menos
          //   estoque do que tem. Agora ela fica, com o tempo pra liberar.
          .in('status', ['disponivel', ...STATUS_EXPIRAVEIS])
          // ★ `removido_em` NAO pode faltar. A moderacao do admin so seta esse
          // campo — nao mexe no `status` (ver api/admin/marketplace/moderar).
          // Sem este filtro, anuncio REMOVIDO continua na vitrine publica e
          // comprável. Era o caso ate 03/09; o erro foi meu, neste arquivo.
          .is('removido_em', null)
          .order('created_at', { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
    lojaId
      ? db
          .from('loja_produtos')
          .select('id, slug, tipo, nome, preco_cents, estoque, fotos')
          .eq('loja_id', lojaId)
          .eq('ativo', true)
          .gt('estoque', 0)
          .order('created_at', { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
  ])

  // Falha aqui NAO pode virar vitrine vazia silenciosa: a loja pareceria nao ter
  // nada a venda. Loga alto e devolve o que deu certo.
  if (cartas.error) console.error('[vitrine] cartas:', cartas.error.message)
  if (produtos.error) console.error('[vitrine] produtos:', produtos.error.message)

  const itensCarta: ItemVitrine[] = (cartas.data || []).map(c => {
    // ★ A FOTO DO VENDEDOR VEM PRIMEIRO (04/09/2026). Antes a vitrine sempre
    // mostrava `card_image`, a arte generica do catalogo — mesmo quando o
    // vendedor tinha subido fotos da carta REAL. Numa carta graduada isso e
    // pior que feio: quem compra um slab quer ver o slab, e a vitrine e a
    // primeira (as vezes unica) tela que ele ve. Mesmo criterio do checkout.
    const fotos: string[] = Array.isArray(c.fotos)
      ? c.fotos.filter((u: unknown): u is string => typeof u === 'string' && !!u)
      : []
    return {
      id: c.id,
      tipo: 'carta',
      nome: c.card_name || '',
      imagem: fotos[0] || c.card_image,
      preco: Number(c.price) || 0,
      badges: badgesDaCarta(c),
      // ★ LEVA AO DETALHE, nao direto ao checkout (07/09/2026). O checkout e
      // "finalizar compra"; quem esta na vitrine ainda esta decidindo, e e no
      // detalhe que estao as fotos reais, a descricao e o vendedor. Padrao de
      // e-commerce: card -> detalhe -> checkout.
      href: `/anuncio/${c.slug || c.id}`,
      detalhe: `/anuncio/${c.slug || c.id}`,
      ehCarta: true,
      fotoPropria: fotos.length > 0,
      nFotos: fotos.length,
      fotos,
      travada: c.status !== 'disponivel',
      liberaEm: calcLiberaEm(c.status, c.status_em),
    }
  })

  const itensProduto: ItemVitrine[] = (produtos.data || []).map(p => ({
    id: p.id,
    tipo: p.tipo,
    nome: p.nome,
    imagem: Array.isArray(p.fotos) && p.fotos.length ? p.fotos[0] : null,
    preco: (p.preco_cents || 0) / 100,
    badges: [p.estoque > 1 ? `${p.estoque} em estoque` : 'Última unidade'],
    href: `/checkout/${p.id}?tipo=produto`,
    detalhe: `/produto/${p.slug || p.id}`,
    ehCarta: false,
    fotoPropria: true,
    nFotos: Array.isArray(p.fotos) ? p.fotos.length : 0,
    fotos: Array.isArray(p.fotos) ? p.fotos.filter((u: unknown): u is string => typeof u === 'string' && !!u) : [],
    // Produto de loja nao passa por negociacao: ou tem estoque, ou nao esta aqui.
    travada: false,
    liberaEm: null,
  }))

  // Comprivel primeiro: a vitrine abre com o que da pra levar agora.
  return [...itensCarta, ...itensProduto].sort((a, b) => Number(a.travada) - Number(b.travada))
}
