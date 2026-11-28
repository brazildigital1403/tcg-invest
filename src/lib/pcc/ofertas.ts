// Marketplace dentro do Club (28/11/2026, mockups v3 aprovados pelo Du). Tudo AUTOMATICO: nenhum creator
// escolhe nada e nao ha curadoria. A fonte e a mesma do Marketplace (chave anon, no navegador), e so entra
// o que la mostraria "Comprar":
//   anuncio  -> status 'disponivel', removido_em nulo, vendedor que recebe pela Bynx (loja ativa nao oculta
//               com Connect; sem loja, a pessoa com `vende_online`). Exclusivo, nunca `||` (ver o Marketplace).
//   produto  -> loja ativa, nao oculta, com Connect; produto ativo com estoque.
// Uma leitura por pagina (memo de 2 min), tabelas pequenas, nada em pokemon_cards_all: o set e o preco de
// referencia da carta vem do /api/cards/lookup, como no Marketplace.
// Regra de variedade: no maximo 2 itens do mesmo vendedor por pagina (quem chama passa o conjunto de usados).

import { supabase } from '@/lib/supabaseClient'

/** Item no formato que os cards do Marketplace (components/marketplace/CardsVenda) esperam. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ItemVenda = Record<string, any> & {
  id: string
  ehProduto?: boolean
  price: number
  created_at: string
  /** Chave do vendedor para a regra de variedade: a loja, ou a pessoa sem loja. */
  vendedor: string
  /** Set da carta do anuncio (pelo catalogo) ou o que a loja informou no selado (28/11/2026). */
  set_id?: string | null
}

let cache: { em: number; p: Promise<ItemVenda[]> } | null = null

/** Tudo o que da para comprar agora no Marketplace. Erro vira lista vazia (o bloco some). */
export function carregarVitrine(): Promise<ItemVenda[]> {
  if (cache && Date.now() - cache.em < 120_000) return cache.p
  const p = ler().catch(() => [] as ItemVenda[])
  cache = { em: Date.now(), p }
  return p
}

async function ler(): Promise<ItemVenda[]> {
  const [an, lj] = await Promise.all([
    supabase.from('marketplace').select('*').eq('status', 'disponivel').is('removido_em', null)
      .order('created_at', { ascending: false }).limit(300),
    supabase.from('lojas').select('id, owner_user_id, slug, nome, logo_url, verificada, cidade, connect_charges_enabled, natureza')
      .eq('status', 'ativa').neq('oculta', true),
  ])
  if (an.error || lj.error) throw new Error('vitrine')
  const lojas = lj.data || []
  const lojaDoDono = new Map(lojas.map(l => [l.owner_user_id, l]))
  const anuncios = an.data || []

  const donos = [...new Set(anuncios.map(a => a.user_id).filter(Boolean))]
  const pessoas = new Map<string, { vende_online?: boolean; city?: string | null; name?: string | null }>()
  if (donos.length) {
    const { data, error } = await supabase.from('public_users').select('id, name, city, vende_online').in('id', donos)
    if (error) throw new Error('vitrine')
    for (const u of data || []) pessoas.set(u.id, u)
  }

  const cardIds = [...new Set(anuncios.map(a => a.card_id).filter(Boolean))]
  const catalogo = new Map<string, { set_id: string | null; preco: number }>()
  if (cardIds.length) {
    const cards = await fetch('/api/cards/lookup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: cardIds }),
    }).then(r => r.json()).then(d => d.cards || []).catch(() => [])
    for (const c of cards) catalogo.set(c.id, { set_id: c.set_id ?? null, preco: c.preco_nao_confiavel ? 0 : (c.preco_min || 0) })
  }

  const itens: ItemVenda[] = []
  for (const a of anuncios) {
    const loja = lojaDoDono.get(a.user_id)
    const pessoa = pessoas.get(a.user_id)
    const vende = loja ? !!loja.connect_charges_enabled : !!pessoa?.vende_online
    if (!vende || !(Number(a.price) > 0)) continue
    const cat = a.card_id ? catalogo.get(a.card_id) : undefined
    itens.push({
      ...a,
      price: Number(a.price),
      vendedor: loja ? `loja:${loja.id}` : `pessoa:${a.user_id}`,
      set_id: cat?.set_id ?? null,
      seller_name: pessoa?.name ?? null,
      seller_city: pessoa?.city ?? null,
      seller_vende: true,
      seller_loja_slug: loja?.slug ?? null,
      seller_loja_nome: loja?.nome ?? null,
      seller_loja_logo: loja?.logo_url ?? null,
      seller_loja_verificada: !!loja?.verificada,
      seller_loja_cidade: loja?.cidade ?? null,
      seller_loja_natureza: loja?.natureza ?? null,
      preco_mercado: a.card_id && !a.graduada ? (cat?.preco || 0) : 0,
    })
  }

  // Produtos: a busca parte das LOJAS visiveis (o filtro de loja oculta so existe aqui, nao na RLS).
  const comConnect = lojas.filter(l => l.connect_charges_enabled)
  if (comConnect.length) {
    const porId = new Map(comConnect.map(l => [l.id, l]))
    const { data, error } = await supabase.from('loja_produtos')
      .select('id, slug, tipo, nome, preco_cents, estoque, fotos, loja_id, created_at, set_id')
      .eq('ativo', true).gt('estoque', 0).in('loja_id', [...porId.keys()])
      .order('created_at', { ascending: false }).limit(200)
    if (error) throw new Error('vitrine')
    for (const p of data || []) {
      const l = porId.get(p.loja_id)
      if (!l || !(p.preco_cents > 0)) continue
      itens.push({
        id: `produto:${p.id}`, ehProduto: true, slug: p.slug || p.id, tipo: p.tipo, card_name: p.nome,
        price: p.preco_cents / 100, fotos: Array.isArray(p.fotos) ? p.fotos.filter(Boolean) : [], estoque: p.estoque,
        created_at: p.created_at, status: 'disponivel', user_id: l.owner_user_id, vendedor: `loja:${l.id}`, set_id: p.set_id ?? null,
        seller_city: l.cidade, seller_loja_slug: l.slug, seller_loja_nome: l.nome, seller_loja_logo: l.logo_url,
        seller_loja_verificada: !!l.verificada, seller_loja_cidade: l.cidade, seller_loja_natureza: l.natureza,
        seller_vende: true, preco_mercado: 0,
      })
    }
  }
  return itens
}

export type Regra = {
  /** Filtro do bloco (categoria, set, teto...). */
  filtro?: (i: ItemVenda) => boolean
  /**
   * Sem ordem (padrao): a ordem em que a vitrine chegou, que o useVitrine embaralha a cada abertura da pagina
   * (pedido do Du, 28/11: os produtos mudam a cada visita). 'recentes' e 'barato' ficam para quem precisar.
   */
  ordem?: 'recentes' | 'barato'
  max: number
  /** Abaixo disto o bloco some. */
  min?: number
  /** Alternar carta e produto (o "Chegou agora"). */
  alternar?: boolean
  /** Uma carta so por card_id (blocos de set). */
  umaPorCarta?: boolean
}

/**
 * Escolhe os itens de um bloco respeitando o teto de 2 por vendedor NA PAGINA: `usados` guarda o que ja
 * foi mostrado (ids e contagem por vendedor) e e atualizado aqui. Sem itens suficientes, devolve [].
 */
export function escolher(todos: ItemVenda[], regra: Regra, usados: Usados): ItemVenda[] {
  const base = todos.filter(i => !usados.ids.has(i.id) && (!regra.filtro || regra.filtro(i)))
  if (regra.ordem === 'barato') base.sort((a, b) => a.price - b.price)
  else if (regra.ordem === 'recentes') base.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  let fila = base
  if (regra.alternar) {
    const cartas = base.filter(i => !i.ehProduto), prods = base.filter(i => i.ehProduto)
    fila = []
    for (let k = 0; k < Math.max(cartas.length, prods.length); k++) {
      if (cartas[k]) fila.push(cartas[k])
      if (prods[k]) fila.push(prods[k])
    }
  }
  const porVend = new Map(usados.porVendedor)
  const cartasVistas = new Set<string>()
  const escolhidos: ItemVenda[] = []
  for (const i of fila) {
    if (escolhidos.length >= regra.max) break
    if ((porVend.get(i.vendedor) || 0) >= 2) continue
    if (regra.umaPorCarta && i.card_id) { if (cartasVistas.has(i.card_id)) continue; cartasVistas.add(i.card_id) }
    escolhidos.push(i)
    porVend.set(i.vendedor, (porVend.get(i.vendedor) || 0) + 1)
  }
  if (escolhidos.length < (regra.min ?? 1)) return []
  for (const i of escolhidos) { usados.ids.add(i.id); usados.porVendedor.set(i.vendedor, (usados.porVendedor.get(i.vendedor) || 0) + 1) }
  return escolhidos
}

export type Usados = { ids: Set<string>; porVendedor: Map<string, number> }
export const novosUsados = (): Usados => ({ ids: new Set(), porVendedor: new Map() })

/** Categorias do card do Feed, pelo tema dos posts ao redor. */
export const ehSelado = (i: ItemVenda) => !!i.ehProduto && i.tipo === 'selado'
export const ehFichario = (i: ItemVenda) => !!i.ehProduto && i.tipo === 'fichario'
export const ehAcessorio = (i: ItemVenda) => !!i.ehProduto && i.tipo === 'acessorio'
export const ehCartaAvulsa = (i: ItemVenda) => !i.ehProduto && !i.graduada

/** Do set (blocos de Torneio e Agenda): carta avulsa anunciada do set ou selado que a loja marcou com o set. */
export const doSet = (sets: readonly string[]) => (i: ItemVenda) =>
  !!i.set_id && sets.includes(i.set_id) && (i.ehProduto ? i.tipo === 'selado' : !i.graduada)

/** Copia embaralhada (Fisher-Yates). */
export function embaralhar<T>(lista: T[]): T[] {
  const a = lista.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
