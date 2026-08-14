import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'

/**
 * /api/marketplace/comparador-hero — pool de cartas pro carrossel do HERO do
 * /comparador (pedido do Du: manchete estatica so mostrava a maior alta/queda
 * da semana, sempre a mesma carta ate o cron rodar de novo -- sem motivo pra
 * ser "hero"). Combina 3 sinais reais e baratos (nenhum precisou de tabela ou
 * matview nova, tudo medido com explain analyze buffers antes de subir):
 *
 * - Maior alta/queda 7d: get_price_movers, ja usado no Radar da mesma pagina.
 * - Mais anunciada: marketplace status=disponivel agrupado por card_id
 *   (61 linhas ativas, 8 buffers).
 * - Mais adicionada a colecao (30d): user_cards agrupado por card_id
 *   (~2k linhas na janela, 181 buffers).
 *
 * Service role de proposito: user_cards tem RLS que so libera leitura de
 * perfil publico pro anon -- pra um sinal agregado de mercado (sem expor de
 * quem e a colecao, so nome/imagem/contagem da carta) queremos TODOS os
 * usuarios, nao so os com perfil publico. Nunca devolve user_id nem nome de
 * usuario, so o agregado por carta.
 *
 * "Mais procurada" e "mais acessada" ficaram de fora (nada loga busca nem
 * view de carta hoje) -- registrado no roadmap, decisao de schema fica pro Du.
 */

interface HeroCard {
  id: string
  name: string
  image_small: string | null
  sinal: 'alta' | 'queda' | 'anunciada' | 'adicionada'
  badge: string
  preco: number | null
}

function limparNome(raw: string | null): string {
  if (!raw) return ''
  return raw.replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/\s*\([^)]*\)\s*$/, '').trim()
}

/**
 * ★ O PostgREST corta em 1000 linhas e NAO avisa: `error` vem null e `data`
 * vem truncado. Foi exatamente o que aconteceu aqui na 1a versao -- user_cards
 * em 30 dias ja tem 2.060 linhas, entao a contagem "mais adicionada" ranqueava
 * em cima de 1000 linhas arbitrarias (sem order by) e mostrava carta e numero
 * errados no hero. Mesmo tropeco ja documentado em api/pokedex/species/route.ts
 * e lib/sitemap-core.ts.
 *
 * Le em paginas ate acabar. Teto de seguranca: passou de MAX_PAGINAS, LANCA em
 * vez de devolver parcial -- numero errado com cara de certo e pior que hero
 * sem o sinal (o catch la embaixo cai pros outros sinais). Quando o volume
 * chegar perto do teto, a saida e agregar por RPC no banco, nao subir o teto.
 */
const PAGINA = 1000
const MAX_PAGINAS = 12

async function lerTudo(tabela: string, colunas: string, desdeISO: string) {
  const sb = getServiceSupabase()
  if (!sb) return { data: [] as any[], error: null }

  const acumulado: any[] = []
  for (let p = 0; p < MAX_PAGINAS; p++) {
    const { data, error } = await sb
      .from(tabela)
      .select(colunas)
      .gte('created_at', desdeISO)
      .range(p * PAGINA, (p + 1) * PAGINA - 1)
    if (error) return { data: [] as any[], error }
    const lote = (data || []) as any[]
    acumulado.push(...lote)
    if (lote.length < PAGINA) return { data: acumulado, error: null }
  }
  throw new Error(`[comparador-hero] ${tabela} passou de ${MAX_PAGINAS * PAGINA} linhas -- agregar por RPC em vez de subir o teto`)
}

export async function GET() {
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ pool: [] })

  try {
    const desde30d = new Date(Date.now() - 30 * 86400000).toISOString()

    const [moversRes, anunciadasRes, adicionadasRes] = await Promise.all([
      sb.rpc('get_price_movers', { p_limit: 8 }),
      // marketplace: 106 linhas no total, cabe numa pagina com folga.
      sb.from('marketplace').select('card_id, card_name, card_image').eq('status', 'disponivel'),
      lerTudo('user_cards', 'card_id, card_name, card_image', desde30d),
    ])

    const pool: HeroCard[] = []
    // Carta sem card_id nao serve (anuncio antigo com card_id null existe no
    // banco -- clicar nela mandaria a calculadora um id vazio). Dedup por nome
    // porque a mesma carta em sets diferentes tem id diferente e o hero
    // mostrando "Mega Charizard X ex" 2x parece bug, nao variedade.
    const nomesVistos = new Set<string>()
    function push(c: HeroCard) {
      const chave = c.name.toLowerCase()
      if (!c.id || !c.name || nomesVistos.has(chave)) return
      nomesVistos.add(chave)
      pool.push(c)
    }

    // ── Maior alta/queda 7d: pega a maior de cada direcao ────────────────
    const movers = (moversRes.data || []) as { window_days: number; direction: 'up' | 'down'; card_id: string; name: string; image_small: string | null; preco_atual: number | null; pct: number | null }[]
    const altas7 = movers.filter(m => m.window_days === 7 && m.direction === 'up' && m.pct != null).sort((a, b) => (b.pct! - a.pct!))
    const quedas7 = movers.filter(m => m.window_days === 7 && m.direction === 'down' && m.pct != null).sort((a, b) => (a.pct! - b.pct!))
    for (const m of altas7.slice(0, 2)) {
      push({ id: m.card_id, name: limparNome(m.name), image_small: m.image_small, sinal: 'alta', badge: `↑ +${m.pct!.toFixed(0)}% em 7 dias`, preco: m.preco_atual })
    }
    for (const m of quedas7.slice(0, 2)) {
      push({ id: m.card_id, name: limparNome(m.name), image_small: m.image_small, sinal: 'queda', badge: `↓ ${m.pct!.toFixed(0)}% em 7 dias`, preco: m.preco_atual })
    }

    // ── Mais anunciada (agregado em JS -- tabela pequena, ja medido) ─────
    type Agregado = { name: string; image: string | null; n: number }
    const anunciadasMap = new Map<string, Agregado>()
    for (const r of anunciadasRes.data || []) {
      const atual = anunciadasMap.get(r.card_id) || { name: limparNome(r.card_name), image: r.card_image, n: 0 }
      atual.n += 1
      anunciadasMap.set(r.card_id, atual)
    }
    const topAnunciadas = [...anunciadasMap.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 3)
    for (const [id, a] of topAnunciadas) {
      if (a.n < 2) continue // 1 anuncio so nao e sinal de nada
      push({ id, name: a.name, image_small: a.image, sinal: 'anunciada', badge: `${a.n} anúncios ativos`, preco: null })
    }

    // ── Mais adicionada a colecao nos ultimos 30 dias ────────────────────
    const adicionadasMap = new Map<string, Agregado>()
    for (const r of adicionadasRes.data || []) {
      const atual = adicionadasMap.get(r.card_id) || { name: limparNome(r.card_name), image: r.card_image, n: 0 }
      atual.n += 1
      adicionadasMap.set(r.card_id, atual)
    }
    const topAdicionadas = [...adicionadasMap.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 4)
    for (const [id, a] of topAdicionadas) {
      push({ id, name: a.name, image_small: a.image, sinal: 'adicionada', badge: `Adicionada por ${a.n} colecionadores este mês`, preco: null })
    }

    // ── Preço das cartas que vieram sem ele ──────────────────────────────
    // Os sinais de anuncio/colecao nao tem preco (marketplace guarda o preco
    // PEDIDO pelo vendedor, nao o de mercado; user_cards nao guarda preco).
    // Sem isso a carta cai na calculadora valendo R$ 0,00 e o veredito nao
    // calcula nada. Lookup por PK em pokemon_cards: Index Scan, 18 buffers
    // medidos -- longe da zona de risco, nao e varredura da tabela de 187MB.
    const semPreco = pool.filter(c => c.preco == null).map(c => c.id)
    if (semPreco.length) {
      const { data: precos } = await sb
        .from('pokemon_cards')
        .select('id, preco_medio, preco_normal, preco_foil_medio, preco_reverse_medio, preco_promo_medio')
        .in('id', semPreco)
      const precoById = new Map<string, number>()
      for (const p of precos || []) {
        const brl = Number(p.preco_medio) || Number(p.preco_normal) || Number(p.preco_foil_medio)
          || Number(p.preco_reverse_medio) || Number(p.preco_promo_medio) || 0
        if (brl > 0) precoById.set(p.id, brl)
      }
      for (const c of pool) if (c.preco == null) c.preco = precoById.get(c.id) ?? null
    }

    // Carta sem preco nenhum nao entra: o CTA do hero e "montar troca com essa
    // carta", e ela cairia na calculadora valendo R$ 0,00.
    return NextResponse.json({ pool: pool.filter(c => c.preco != null && c.preco > 0) })
  } catch {
    return NextResponse.json({ pool: [] })
  }
}
