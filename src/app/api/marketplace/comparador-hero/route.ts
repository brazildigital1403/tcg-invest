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
  sinal: 'alta' | 'queda' | 'anunciada' | 'adicionada' | 'procurada' | 'acessada'
  badge: string
  preco: number | null
  /** So os sinais novos usam: carta sem preco vira CTA "ver a carta". */
  slug?: string | null
  cta?: 'troca' | 'ver'
  /**
   * Sobrescreve o texto fixo do SINAL_INFO quando o dado exige.
   * ★ Existe porque copy fixa mentia: "Varias pessoas anunciando essa carta"
   * era escrita mesmo quando havia UM vendedor com varios anuncios. A frase
   * tem que sair da contagem, nao de um dicionario.
   */
  texto?: string
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

    const [moversRes, anunciadasRes, adicionadasRes, sinaisRes] = await Promise.all([
      sb.rpc('get_price_movers', { p_limit: 8 }),
      // marketplace: 106 linhas no total, cabe numa pagina com folga.
      // ★ user_id no select: sem ele nao da pra contar PESSOAS, so linhas --
      // e era isso que fazia "varias pessoas anunciando" aparecer com um
      // vendedor so. Coluna a mais no mesmo round-trip, custo zero.
      sb.from('marketplace').select('card_id, card_name, card_image, user_id').eq('status', 'disponivel'),
      lerTudo('user_cards', 'card_id, card_name, card_image, user_id', desde30d),
      // Agregacao e LIMIT em SQL de proposito -- ler a tabela crua aqui
      // repetiria o bug de truncamento de cima.
      sb.rpc('get_sinais_carta', { p_dias: 14, p_limit: 2, p_min_vis: 12, p_min_pico: 2 }),
    ])

    // Sem este log, um grant faltando ou coluna renomeada vira lista vazia
    // indistinguivel de "a semana foi fraca", e o hero fica bonito com 3
    // sinais por meses. Mesma armadilha do "RLS bloqueia em silencio".
    if (sinaisRes.error) {
      console.error('[api/marketplace/comparador-hero] sinais:', sinaisRes.error.message)
    }

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
    // ★ "em 7 dias" era FALSO em 11 dos 12 casos em cartaz. A mv_price_movers
    // compara o preco de hoje com o snapshot mais recente que tenha PELO MENOS
    // 7 dias -- e como o scan nao passa em toda carta toda semana, esse
    // snapshot costuma ser bem mais velho. Idades reais medidas em 31/08 nos
    // 12 movers no ar: 22, 74, 13, 13, 19, 46, 11, 10, 7, 74, 8 e 9 dias. So
    // UM era de 7 dias; dois eram de 74.
    //
    // A RPC nao devolve a data da base (assinatura: window_days, direction,
    // card_id, name, set_name, image_small, preco_atual, pct, slug), entao
    // daqui nao da pra dizer a data exata sem mexer na matview -- e matview e
    // schema, decisao do Du. O que da pra fazer sem mentir e afirmar so o que
    // a janela garante: 7 dias e o PISO, nao a medida.
    for (const m of altas7.slice(0, 2)) {
      push({ id: m.card_id, name: limparNome(m.name), image_small: m.image_small, sinal: 'alta', badge: `↑ +${m.pct!.toFixed(0)}% em 7 dias ou mais`, preco: m.preco_atual })
    }
    for (const m of quedas7.slice(0, 2)) {
      push({ id: m.card_id, name: limparNome(m.name), image_small: m.image_small, sinal: 'queda', badge: `↓ ${m.pct!.toFixed(0)}% em 7 dias ou mais`, preco: m.preco_atual })
    }

    // ── Procurada / acessada (sinais de comportamento) ───────────────────
    // ★ PRECEDENCIA: entram AQUI, depois de alta/queda e ANTES de anunciada/
    // adicionada. push() dedupa por NOME e descarta calado quem chega depois,
    // e as cartas mais vistas/buscadas sao por construcao as MESMAS que
    // aparecem em "anunciada" e "adicionada". No fim da fila, os sinais novos
    // seriam absorvidos e a feature nao mudaria um pixel do hero -- sem log,
    // sem sintoma, sem ninguem descobrir.
    const s = sinaisRes.data as {
      eventos_janela: number; cartas_distintas: number; dado_ate: string | null
      acessadas: { id: string; slug: string | null; nome: string; image_small: string | null; preco: number | null }[]
      procuradas: { id: string; slug: string | null; nome: string; image_small: string | null; preco: number | null }[]
    } | null

    if (s && s.eventos_janela === 0) {
      console.warn('[api/marketplace/comparador-hero] sinais: janela sem nenhum evento -- captura pode estar morta')
    }
    // Frescor do DADO, nao do cron: cron "verde" com rollup quebrado serviria
    // dado velho com cara de novo.
    const frescoDado = !!s?.dado_ate
      && (Date.now() - new Date(`${s.dado_ate}T12:00:00-03:00`).getTime()) < 3 * 86400000

    // Gate de ativacao: enquanto nao houver volume, a coleta roda e o hero
    // segue com os 3 sinais antigos. Superlativo apoiado em 5 eventos e pior
    // que superlativo nenhum.
    const sinaisAtivos = frescoDado && s!.eventos_janela >= 500 && s!.cartas_distintas >= 80

    if (sinaisAtivos) {
      for (const c of s!.acessadas || []) {
        push({
          id: c.id, name: limparNome(c.nome), image_small: c.image_small,
          sinal: 'acessada', badge: 'Muito vista nas últimas duas semanas',
          preco: c.preco, slug: c.slug, cta: c.preco && c.preco > 0 ? 'troca' : 'ver',
        })
      }
      for (const c of s!.procuradas || []) {
        push({
          id: c.id, name: limparNome(c.nome), image_small: c.image_small,
          sinal: 'procurada', badge: 'Procurada nas trocas',
          preco: c.preco, slug: c.slug, cta: c.preco && c.preco > 0 ? 'troca' : 'ver',
        })
      }
    }

    // ── Mais anunciada (agregado em JS -- tabela pequena, ja medido) ─────
    type Agregado = { name: string; image: string | null; n: number; donos: Set<string> }
    const anunciadasMap = new Map<string, Agregado>()
    for (const r of anunciadasRes.data || []) {
      const atual = anunciadasMap.get(r.card_id) || { name: limparNome(r.card_name), image: r.card_image, n: 0, donos: new Set<string>() }
      atual.n += 1
      if (r.user_id) atual.donos.add(r.user_id)
      anunciadasMap.set(r.card_id, atual)
    }
    const topAnunciadas = [...anunciadasMap.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 3)
    for (const [id, a] of topAnunciadas) {
      if (a.n < 2) continue // 1 anuncio so nao e sinal de nada
      // ★ A frase sai da contagem de PESSOAS. Hoje as cartas mais anunciadas
      // sao quase todas de um vendedor so com varios anuncios -- dizer "varias
      // pessoas" ali era falso, e e o tipo de exagero que o usuario checa em
      // dois cliques.
      const v = a.donos.size
      const texto = v > 1
        ? `${v} vendedores diferentes anunciando essa carta agora — bom momento pra comparar preços.`
        : `${a.n} anúncios dessa carta abertos agora — dá pra comparar antes de fechar.`
      push({ id, name: a.name, image_small: a.image, sinal: 'anunciada', badge: `${a.n} anúncios ativos`, preco: null, texto })
    }

    // ── Mais adicionada a colecao nos ultimos 30 dias ────────────────────
    const adicionadasMap = new Map<string, Agregado>()
    for (const r of adicionadasRes.data || []) {
      const atual = adicionadasMap.get(r.card_id) || { name: limparNome(r.card_name), image: r.card_image, n: 0, donos: new Set<string>() }
      atual.n += 1
      if (r.user_id) atual.donos.add(r.user_id)
      adicionadasMap.set(r.card_id, atual)
    }
    // ★ Ordena por PESSOAS, nao por linhas: duas copias da mesma carta pelo
    // mesmo dono contavam como "2 colecionadores".
    const topAdicionadas = [...adicionadasMap.entries()].sort((a, b) => b[1].donos.size - a[1].donos.size).slice(0, 4)
    for (const [id, a] of topAdicionadas) {
      const pessoas = a.donos.size || a.n
      if (pessoas < 2) continue
      push({
        id, name: a.name, image_small: a.image, sinal: 'adicionada', preco: null,
        badge: `${pessoas} colecionadores este mês`,
        // ★ Sem superlativo. O bloco empurra as QUATRO primeiras e o carrossel
        // embaralha, entao "a carta que mais entrou" era escrita por ate quatro
        // cartas diferentes -- a 4a colocada abria a pagina se dizendo a 1a.
        texto: `Uma das cartas que mais entraram em coleções este mês — pode valer a pena ficar de olho.`,
      })
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
        .select('id, preco_min, preco_foil_min, preco_reverse_min, preco_promo_min')
        .in('id', semPreco)
      const precoById = new Map<string, number>()
      for (const p of precos || []) {
        const brl = Number(p.preco_min) || Number(p.preco_foil_min)
          || Number(p.preco_reverse_min) || Number(p.preco_promo_min) || 0
        if (brl > 0) precoById.set(p.id, brl)
      }
      for (const c of pool) if (c.preco == null) c.preco = precoById.get(c.id) ?? null
    }

    // Carta sem preco nao pode cair na calculadora valendo R$ 0,00. Mas o pico
    // natural de view/busca e lancamento de set, e carta recem-subida
    // frequentemente ainda nao tem preco BRL -- so descartar deixaria o slide
    // vazio justo na semana em que o sinal e mais informativo. Entao ela fica,
    // com CTA "ver a carta" em vez de "montar troca".
    return NextResponse.json({
      pool: pool.filter(c => (c.preco != null && c.preco > 0) || (c.cta === 'ver' && c.slug)),
    })
  } catch {
    return NextResponse.json({ pool: [] })
  }
}
