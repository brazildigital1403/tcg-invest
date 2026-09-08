import 'server-only'
import { cache } from 'react'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { podeExpirar, liberaEm as calcLiberaEm } from '@/lib/marketplaceStatus'
import { badgesDaCarta } from '@/lib/badgesCarta'

/**
 * Um anuncio do marketplace, para a pagina PUBLICA dele.
 *
 * ★ POR QUE EXISTE (07/09/2026): nao havia URL de anuncio. O /marketplace
 * abre o anuncio por `onClick`, nao por link, e quem copiava a URL do
 * checkout mandava pro WhatsApp o banner GENERICO da Bynx -- nem a carta, nem
 * o preco, nem a foto. Um vendedor nao tinha como dizer "olha minha carta a
 * venda". Isso e aquisicao, nao SEO: o link e que traz o comprador.
 *
 * ★ E TAMBEM ERA "GRAVA MAS NAO LE" DE NOVO. O anuncio guarda `descricao` e
 * ate 10 `fotos`, e nenhuma tela lia isso -- so o /marketplace mostrava a
 * descricao, em 11px cinza. Hoje sao 5 anuncios com descricao e 2 com fotos
 * proprias; pouco porque nunca valeu a pena preencher.
 *
 * ★ SERVICE ROLE EXIGE FILTRO EXPLICITO. A RLS de `marketplace` nao se aplica
 * aqui. `removido_em` NAO pode faltar: sem ele, anuncio derrubado pela
 * moderacao ganharia pagina publica com OG bonito pra circular no WhatsApp.
 *
 * O anuncio VENDIDO continua com pagina (nao 404): quem recebeu o link
 * merece ver o que era, com o estado correto. Mesmo padrao do produto
 * esgotado.
 */

/**
 * ★ O FRETE DA CARTA JA TEM PESO PADRAO, e ele nunca apareceu na tela.
 * `pacoteDeCarta` (src/lib/melhor-envio.ts) cota toda carta como 80 g em
 * 13x18x2 cm, com seguro pelo valor do anuncio. O Du achou que a Bynx nao
 * tinha essa informacao em lugar nenhum -- tinha, so que enterrada no codigo,
 * o que na pratica e a mesma coisa pra quem compra e pra quem vende.
 * Estes valores existem pra EXIBIR o que ja e cobrado; a fonte da cotacao
 * continua sendo o `pacoteDeCarta`, nao daqui.
 */
export const CARTA_PESO_G = 80
export const CARTA_DIMENSOES = '13 x 18 x 2 cm'

export type AnuncioPublico = {
  id: string
  slug: string | null
  cardId: string | null
  /** Slug da carta no catalogo, pra linkar /carta/{slug}. */
  cartaSlug: string | null
  nome: string
  preco: number
  descricao: string | null
  badges: string[]
  graduada: boolean
  /** Fotos do vendedor; cai na arte do catalogo quando nao ha nenhuma. */
  fotos: string[]
  fotoPropria: boolean
  disponivel: boolean
  /**
   * Travado numa negociacao que ainda pode cair -- diferente de "vendido".
   * Quem chega por link compartilhado precisa saber a diferenca: uma volta em
   * horas, a outra nao volta.
   */
  travado: boolean
  /** ISO de quando ele volta pro marketplace. `null` quando nao e travado. */
  liberaEm: string | null
  vendedorNome: string
  vendedorCidade: string | null
  vendedorUsername: string | null
  lojaNome: string | null
  lojaId: string | null
  lojaSlug: string | null
  lojaLogoUrl: string | null
  lojaVerificada: boolean
  /**
   * Loja ativa E com Connect liberado. So com os dois a venda fecha na
   * plataforma (pagamento, frete, rastreio). Loja cadastrada sem recebimento
   * ativo NAO conta -- oferecer "Comprar" ali seria prometer o que quebra no
   * fim do caminho.
   */
  lojaPodeVender: boolean
  lojaCidade: string | null
  lojaEstado: string | null
}

export const buscarAnuncioPublico = cache(async function buscarAnuncioPublico(
  slugOuId: string,
): Promise<AnuncioPublico | null> {
  const db = getServiceSupabase()
  if (!db) return null

  const ehUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOuId)
  const q = db
    .from('marketplace')
    .select('id, slug, card_id, card_name, card_image, fotos, price, descricao, status, status_em, variante, idioma, condicao, graduada, graduadora, nota, black_label, user_id')
    // Moderado nao ganha pagina publica. Ver o cabecalho.
    .is('removido_em', null)
    .limit(1)

  const { data, error } = await (ehUuid ? q.eq('id', slugOuId) : q.eq('slug', slugOuId))
  if (error) {
    console.error('[anuncio] busca:', error.message)
    return null
  }
  const a = data?.[0]
  if (!a) return null

  const [donoRes, lojaRes, cartaRes] = await Promise.all([
    db.from('public_users').select('id, name, city, username').eq('id', a.user_id).limit(1),
    db.from('lojas').select('id, nome, slug, logo_url, verificada, connect_charges_enabled, cidade, estado').eq('owner_user_id', a.user_id).eq('status', 'ativa').limit(1),
    a.card_id
      ? db.from('pokemon_cards').select('slug').eq('id', a.card_id).limit(1)
      : Promise.resolve({ data: null, error: null }),
  ])

  const u = donoRes.data?.[0]
  const l = lojaRes.data?.[0]

  const fotosVend: string[] = Array.isArray(a.fotos)
    ? a.fotos.filter((f: unknown): f is string => typeof f === 'string' && !!f)
    : []

  return {
    id: a.id,
    slug: a.slug ?? null,
    cardId: a.card_id ?? null,
    cartaSlug: (cartaRes.data as { slug?: string }[] | null)?.[0]?.slug ?? null,
    nome: a.card_name || 'Carta',
    preco: Number(a.price) || 0,
    descricao: a.descricao?.trim() || null,
    badges: badgesDaCarta(a),
    graduada: !!a.graduada,
    // Mesmo criterio do checkout e da vitrine: foto do vendedor primeiro.
    fotos: fotosVend.length ? fotosVend : (a.card_image ? [a.card_image] : []),
    fotoPropria: fotosVend.length > 0,
    disponivel: a.status === 'disponivel',
    travado: podeExpirar(a.status),
    liberaEm: calcLiberaEm(a.status, a.status_em),
    vendedorNome: (l?.nome || u?.name || 'Vendedor Bynx').trim(),
    vendedorCidade: u?.city?.trim() || null,
    vendedorUsername: u?.username || null,
    lojaNome: l?.nome?.trim() || null,
    lojaId: l?.id || null,
    lojaSlug: l?.slug || null,
    lojaLogoUrl: l?.logo_url || null,
    lojaVerificada: !!l?.verificada,
    lojaPodeVender: !!l?.connect_charges_enabled,
    lojaCidade: l?.cidade?.trim() || null,
    lojaEstado: l?.estado?.trim() || null,
  }
})
