import 'server-only'
import { cache } from 'react'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { podeExpirar, liberaEm as calcLiberaEm } from '@/lib/marketplaceStatus'
import { badgesDaCarta } from '@/lib/badgesCarta'
import { resolverRecebedor, podeReceber } from '@/lib/vendedorRecebimento'
import { pesoDeCartasG } from '@/lib/melhor-envio'

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
 * O Du achou que a Bynx nao tinha essa informacao em lugar nenhum -- tinha,
 * so que enterrada no codigo, o que na pratica e a mesma coisa pra quem
 * compra e pra quem vende. Estes valores existem pra EXIBIR o que ja e
 * cobrado; a fonte da cotacao continua sendo o `pacoteDeCartas`.
 *
 * ★ NAO CRAVAR O NUMERO AQUI (02/10/2026). Ate hoje esta linha dizia 80 g e a
 * de `melhor-envio.ts` tambem: duas copias da mesma conta, que e exatamente
 * o jeito de uma envelhecer sem a outra. Quando a gramatura foi corrigida
 * para 19 g, a ficha publica teria continuado anunciando 80 g para o
 * comprador. Agora ela DERIVA da lib de frete -- muda la, muda aqui.
 */
export const CARTA_PESO_G = pesoDeCartasG(1)
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
  /** `users.id` de quem vende. E a chave do carrinho por vendedor. */
  vendedorId: string
  vendedorNome: string
  vendedorCidade: string | null
  vendedorUsername: string | null
  lojaNome: string | null
  lojaId: string | null
  lojaSlug: string | null
  lojaLogoUrl: string | null
  lojaVerificada: boolean
  /**
   * A venda fecha na plataforma (pagamento, frete, rastreio)?
   *
   * ★ DEIXOU DE SER "TEM LOJA" (24/09/2026). Ate aqui isto era
   * `lojaPodeVender`, e sem loja nao havia caminho -- o que condenava 70 dos
   * 100 anuncios ao "Tenho interesse" para sempre. Agora quem responde e o
   * `resolverRecebedor`: anuncio de loja vale pela conta DA LOJA, anuncio de
   * pessoa pela conta DA PESSOA -- sem heranca entre as duas (01/10/2026).
   *
   * Continua exigindo o Connect LIBERADO, e nao so cadastrado: oferecer
   * "Comprar" a quem nao pode receber e prometer o que quebra no fim do
   * caminho. Frete calculado sem CEP de origem tambem nao fecha.
   */
  podeComprar: boolean
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

  const [donoRes, lojaRes, cartaRes, recebedor] = await Promise.all([
    db.from('public_users').select('id, name, city, username').eq('id', a.user_id).limit(1),
    db.from('lojas').select('id, nome, slug, logo_url, verificada, connect_charges_enabled, cidade, estado').eq('owner_user_id', a.user_id).eq('status', 'ativa').neq('oculta', true).limit(1),
    a.card_id
      ? db.from('pokemon_cards').select('slug').eq('id', a.card_id).limit(1)
      : Promise.resolve({ data: null, error: null }),
    // Uma query a mais por pagina de anuncio, e e a que decide o botao.
    resolverRecebedor(db, a.user_id),
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
    vendedorId: a.user_id as string,
    vendedorNome: (l?.nome || u?.name || 'Vendedor Bynx').trim(),
    vendedorCidade: u?.city?.trim() || null,
    vendedorUsername: u?.username || null,
    lojaNome: l?.nome?.trim() || null,
    lojaId: l?.id || null,
    lojaSlug: l?.slug || null,
    lojaLogoUrl: l?.logo_url || null,
    lojaVerificada: !!l?.verificada,
    podeComprar:
      podeReceber(recebedor) &&
      (recebedor!.freteModo !== 'calculado' || !!recebedor!.cepOrigem),
    lojaCidade: l?.cidade?.trim() || null,
    lojaEstado: l?.estado?.trim() || null,
  }
})

/** Carta do mesmo vendedor, no bloco "Mais deste vendedor". */
export type OutroDoVendedor = {
  id: string
  slug: string | null
  nome: string
  imagem: string | null
  precoCents: number
  condicao: string | null
}

/**
 * As outras cartas a venda do mesmo vendedor.
 *
 * ★ POR QUE EXISTE (02/10/2026). O frete e quase todo custo fixo de postagem:
 * medido na cotacao real, 1 carta de Fortaleza para SP custa R$ 17,43 e 10
 * cartas na mesma remessa custam R$ 17,49. Mas quem abria o anuncio de uma
 * carta de R$ 0,90 via R$ 17,44 de frete e ia embora, porque NADA na tela
 * dizia que a mesma vendedora tinha mais 12 cartas e que o envio seria um so.
 * O carrinho por vendedor subiu em `36cb82a` e ficou sem convite: carrinho
 * possivel nao e carrinho usado.
 *
 * ★ `disponivel` DE VERDADE: exige `status = 'disponivel'` E `removido_em`
 * nulo. Travado em negociacao e moderado pelo admin ficam de fora -- o numero
 * na faixa tem que bater com o que a pessoa encontra ao clicar, senao a
 * primeira impressao do recurso e a de um numero que mente.
 *
 * Nao recebe o recebedor de volta: quem chama ja sabe se o vendedor fecha
 * venda (`podeComprar` do proprio anuncio), e as cartas sao as mesmas pessoa.
 */
export const buscarOutrosDoVendedor = cache(async function buscarOutrosDoVendedor(
  vendedorId: string,
  excetoAnuncioId: string,
  limite = 6,
): Promise<{ itens: OutroDoVendedor[]; total: number }> {
  const db = getServiceSupabase()
  if (!db) return { itens: [], total: 0 }

  const { data, error, count } = await db
    .from('marketplace')
    .select('id, slug, card_name, card_image, fotos, price, condicao', { count: 'exact' })
    .eq('user_id', vendedorId)
    .eq('status', 'disponivel')
    .is('removido_em', null)
    .neq('id', excetoAnuncioId)
    // ★ MAIS BARATAS PRIMEIRO, de proposito. Quem esta nesta tela chegou por
    //   uma carta e vai decidir se junta outra para diluir o frete -- abrir
    //   com a mais cara e desenhar para o caso que nao existe.
    .order('price', { ascending: true })
    .limit(limite)

  if (error) {
    console.error('[anuncio] outros do vendedor:', error.message)
    return { itens: [], total: 0 }
  }

  const itens: OutroDoVendedor[] = (data || []).map(c => ({
    id: c.id as string,
    slug: (c.slug as string) || null,
    nome: (c.card_name as string) || 'Carta',
    // A foto do vendedor vence a imagem do catalogo, igual a pagina do anuncio.
    imagem: (Array.isArray(c.fotos) && c.fotos[0]) || (c.card_image as string) || null,
    precoCents: Math.round(Number(c.price) * 100),
    condicao: (c.condicao as string) || null,
  }))

  return { itens, total: count ?? itens.length }
})
