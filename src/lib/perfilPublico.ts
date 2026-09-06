import 'server-only'
import { cache } from 'react'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { calcPatrimonio, valorCarta, acharPreco } from '@/lib/calcPatrimonio'

/**
 * O conteudo PUBLICO de um perfil, buscado no servidor.
 *
 * ★ POR QUE (04/09/2026): a pagina de perfil e `'use client'` e buscava tudo
 * em `useEffect`, que so roda no browser. O `generateMetadata` prometia
 * "Guilherme tem 300 cartas Pokemon TCG organizadas na Bynx. Veja a colecao
 * completa" e o crawler recebia um corpo de 69 CARACTERES: "Carregando
 * perfil...". Sao 370 perfis publicos, com `Allow: /perfil/` no robots.txt.
 * Mesmo padrao que a vitrine da loja tinha ate 03/09.
 *
 * ★ ISTO SO PODE EXISTIR PORQUE A ROTA GANHOU ISR JUNTO. Medido antes de
 * escrever, no maior perfil (300 cartas): so o lookup de precos da **1.228
 * shared buffers** e 11,3 ms com buffer QUENTE. A regra da casa e "milhares =
 * risco, dezenas = seguro", e no lambda o buffer e frio. Mover isto pro
 * servidor numa rota sem cache -- 370 URLs publicas, convidadas pelo robots --
 * seria construir o apagao de 29/07 de proposito. Com `revalidate = 3600` roda
 * uma vez por hora por perfil visitado, nao por visita.
 *
 * ★ SO O QUE E IGUAL PRA TODO MUNDO. Nada aqui depende de quem esta olhando:
 * conteudo cacheado e servido identico pra todos. `viewerId`,
 * `isOwnerPreview`, sessao e acoes continuam no client.
 */

/**
 * ★ O FORMATO E O QUE O JSX DO CLIENT JA ESPERA (`card_name`, `card_image`,
 * `variante`, `maxValue`). Traduzir pra nomes "mais bonitos" obrigaria a
 * mexer no render, e o render e justamente o que nao se quer tocar numa
 * pagina de 613 linhas com 18 pontos interativos. `slug` e o unico campo
 * novo: e o que permite LINKAR a carta, coisa que o perfil nunca fez.
 */
export type CartaShowcase = {
  card_name: string
  card_image: string | null
  set_name: string | null
  variante: string | null
  maxValue: number
  graduada: boolean
  /** Link pra pagina publica da carta. So sai quando o slug e conhecido. */
  slug: string | null
}

export type PerfilPublico = {
  /**
   * O registro CRU de `public_users`, nos nomes originais. Mesma razao do
   * `CartaShowcase`: o JSX do client le `user?.name`, `user?.city`,
   * `user?.created_at` e `user?.perfil_ocultar_valores`. Renomear aqui
   * obrigaria a reescrever o render.
   */
  user: {
    id: string
    name: string | null
    city: string | null
    created_at: string | null
    username: string | null
    perfil_ocultar_valores: boolean | null
  }
  totalCartas: number
  patrimonio: number
  showcase: CartaShowcase[]
  anunciosAtivos: number
}

/** Marca de preco inflado (`card_preco_baseline`), igual ao /api/cards/lookup. */
async function idsSuspeitos(
  db: NonNullable<ReturnType<typeof getServiceSupabase>>,
  ids: string[],
): Promise<Set<string>> {
  const out = new Set<string>()
  if (ids.length === 0) return out
  try {
    // Lotes de 100: `.in()` grande vira URL longa demais pro PostgREST — a
    // mesma licao que o scan aprendeu e que o lookup ja aplica.
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await db
        .from('card_preco_baseline')
        .select('card_id')
        .in('card_id', ids.slice(i, i + 100))
        .eq('suspeito', true)
      for (const r of data || []) out.add(r.card_id as string)
    }
  } catch (err) {
    console.error('[perfil] suspeitos:', (err as Error)?.message)
  }
  return out
}

export const buscarPerfilPublico = cache(async function buscarPerfilPublico(
  idOrUsername: string,
): Promise<PerfilPublico | null> {
  const db = getServiceSupabase()
  if (!db) return null

  const ehUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrUsername)
  const q = db
    .from('public_users')
    .select('id, name, city, created_at, username, perfil_publico, perfil_ocultar_valores')
    .limit(1)
  const { data: users } = await (ehUuid ? q.eq('id', idOrUsername) : q.eq('username', idOrUsername))
  const u = users?.[0]
  if (!u) return null

  // ★ Perfil privado nao rende NADA aqui. O dono ainda ve a propria pagina,
  // mas isso depende da sessao — e sessao nao existe em pagina cacheada, entao
  // quem resolve esse caso e o client, como sempre resolveu.
  if (u.perfil_publico === false) return null

  const [cartasRes, anunciosRes] = await Promise.all([
    db
      .from('user_cards')
      .select('card_name, variante, quantity, card_image, set_name, pokemon_api_id, graduada, valor_graduada')
      .eq('user_id', u.id),
    db
      .from('marketplace')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', u.id)
      .eq('status', 'disponivel')
      // Moderacao so seta `removido_em`, nao mexe no status. Sem isto o perfil
      // publico contaria anuncio removido — ja foi bug aqui.
      .is('removido_em', null),
  ])

  const cartas = cartasRes.data || []
  const base: PerfilPublico = {
    user: {
      id: u.id,
      name: u.name ?? null,
      city: u.city ?? null,
      created_at: u.created_at ?? null,
      username: u.username ?? null,
      perfil_ocultar_valores: u.perfil_ocultar_valores ?? null,
    },
    // ★ CONTA LINHAS, nao soma `quantity` -- e o que o client sempre fez
    // (`count: 'exact'` em user_cards). Somar quantity dava 301 contra 300 no
    // guihusky: o numero PISCARIA na hidratacao, de 301 pro 300 do client.
    // Mesma conta em dois lugares sempre diverge; aqui a fonte e o client.
    totalCartas: cartas.length,
    patrimonio: 0,
    showcase: [],
    anunciosAtivos: anunciosRes.count || 0,
  }

  if (cartas.length === 0) return base

  const ids = [...new Set(cartas.map(c => c.pokemon_api_id).filter(Boolean))] as string[]
  const priceMap: Record<string, unknown> = {}
  const slugDe = new Map<string, string>()

  if (ids.length > 0) {
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await db
        .from('pokemon_cards')
        .select('id, slug, preco_min, preco_medio, preco_max, preco_foil_min, preco_foil_medio, preco_foil_max, preco_promo_min, preco_promo_medio, preco_promo_max, preco_reverse_min, preco_reverse_medio, preco_reverse_max, preco_pokeball_min, preco_pokeball_medio, preco_pokeball_max')
        .in('id', ids.slice(i, i + 100))
      for (const p of data || []) {
        priceMap[p.id as string] = p
        if (p.slug) slugDe.set(p.id as string, p.slug as string)
      }
    }
    const suspeitos = await idsSuspeitos(db, Object.keys(priceMap))
    for (const id of suspeitos) {
      const row = priceMap[id] as Record<string, unknown> | undefined
      if (row) row.preco_nao_confiavel = true
    }
  }

  // Patrimonio: fonte unica, a mesma do resto da plataforma.
  base.patrimonio = calcPatrimonio(cartas as never[], priceMap as Record<string, never>).valor

  // Showcase: as 6 mais valiosas. Carta marcada pelo guard fica FORA -- ela
  // costuma ser a mais "valiosa" justamente pelo preco inflado, e entraria em
  // primeiro lugar num perfil publico, que e onde menos se pode errar.
  base.showcase = cartas
    .map(c => {
      const p = acharPreco(c as never, priceMap as Record<string, never>) as { preco_nao_confiavel?: boolean } | undefined
      return {
        carta: c,
        valor: valorCarta(c as never, p as never),
        suspeita: !!p?.preco_nao_confiavel,
      }
    })
    .filter(x => !x.suspeita)
    .filter(x => x.valor > 0 || x.carta.card_image)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 6)
    .map(x => ({
      card_name: x.carta.card_name || '',
      card_image: x.carta.card_image || null,
      set_name: x.carta.set_name || null,
      variante: x.carta.variante || null,
      maxValue: x.valor,
      graduada: !!x.carta.graduada,
      slug: (x.carta.pokemon_api_id && slugDe.get(x.carta.pokemon_api_id)) || null,
    }))

  return base
})
