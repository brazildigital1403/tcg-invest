import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

const EXTRAS_MAP: Record<number, string> = {
  0: 'normal', 1: 'foil', 2: 'foil', 3: 'reverse',
  4: 'reverse', 14: 'promo', 15: 'special', 47: 'pokeball',
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&aacute;/g, 'á').replace(/&Aacute;/g, 'Á')
    .replace(/&eacute;/g, 'é').replace(/&Eacute;/g, 'É')
    .replace(/&iacute;/g, 'í').replace(/&Iacute;/g, 'Í')
    .replace(/&oacute;/g, 'ó').replace(/&Oacute;/g, 'Ó')
    .replace(/&uacute;/g, 'ú').replace(/&Uacute;/g, 'Ú')
    .replace(/&atilde;/g, 'ã').replace(/&Atilde;/g, 'Ã')
    .replace(/&otilde;/g, 'õ').replace(/&Otilde;/g, 'Õ')
    .replace(/&ccedil;/g, 'ç').replace(/&Ccedil;/g, 'Ç')
    .replace(/&agrave;/g, 'à').replace(/&acirc;/g, 'â')
    .replace(/&ecirc;/g, 'ê').replace(/&ocirc;/g, 'ô')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
}

function parsePrice(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const s = String(v).trim()
  const n = parseFloat(s)
  if (isNaN(n) || n <= 0) return null
  if (!s.includes('.') && !s.includes(',')) {
    return parseFloat((n / 100).toFixed(2))
  }
  return parseFloat(n.toFixed(2))
}

async function fetchHtml(url: string): Promise<{ html: string; method: string } | null> {
  // Tentativa 1: fetch direto com headers de browser
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    })
    if (res.ok) {
      const html = await res.text()
      // Valida que é HTML real da LigaPokemon (não uma página de bloqueio)
      if (html.includes('cards_stock') || html.includes('cards_editions') || html.includes('ligapokemon')) {
        console.log('[preco] fetch direto OK')
        return { html, method: 'direct' }
      }
    }
    console.log('[preco] fetch direto retornou', res.status)
  } catch (e: any) {
    console.log('[preco] fetch direto falhou:', e.message)
  }

  // Tentativa 2: ScraperAPI (se configurado)
  const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY
  if (SCRAPER_API_KEY) {
    try {
      const scraperUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}&country_code=br&render=false`
      const res = await fetch(scraperUrl, { signal: AbortSignal.timeout(25000) })
      if (res.ok) {
        const html = await res.text()
        if (html.includes('cards_stock') || html.includes('ligapokemon')) {
          console.log('[preco] ScraperAPI OK')
          return { html, method: 'scraperapi' }
        }
        console.log('[preco] ScraperAPI retornou HTML sem dados úteis')
      } else {
        console.log('[preco] ScraperAPI status:', res.status)
      }
    } catch (e: any) {
      console.log('[preco] ScraperAPI falhou:', e.message)
    }
  } else {
    console.log('[preco] SCRAPER_API_KEY não configurada')
  }

  return null
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user) return Response.json({ error: 'Sessão inválida' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const targetUrl = searchParams.get('url')
  if (!targetUrl) return Response.json({ error: 'URL não informada' }, { status: 400 })

  let parsedUrl: URL
  try { parsedUrl = new URL(targetUrl) }
  catch { return Response.json({ error: 'URL inválida' }, { status: 400 }) }

  // Resolve link curto lig.ae
  if (parsedUrl.hostname === 'lig.ae' || parsedUrl.hostname.endsWith('.lig.ae')) {
    try {
      const res = await fetch(targetUrl, {
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        headers: BROWSER_HEADERS,
      })
      try { parsedUrl = new URL(res.url) }
      catch { return Response.json({ error: 'Link inválido após redirecionamento.' }, { status: 400 }) }
    } catch {
      return Response.json({ error: 'Não foi possível resolver o link curto.' }, { status: 400 }) 
    }
  }

  // URL de busca com card param aninhado
  if (parsedUrl.searchParams.get('view')?.includes('search')) {
    const cidMatch = (parsedUrl.searchParams.get('card') || '').match(/cid=(\d+)/)
    if (cidMatch) {
      parsedUrl = new URL(`https://www.ligapokemon.com.br/?view=cards/card&cid=${cidMatch[1]}`)
    }
  }

  if (!['ligapokemon.com.br', 'www.ligapokemon.com.br'].includes(parsedUrl.hostname)) {
    return Response.json({ error: `Use links da LigaPokemon.com.br` }, { status: 403 })
  }

  // ── Busca HTML ──────────────────────────────────────────────────────────
  const result = await fetchHtml(parsedUrl.toString())
  if (!result) {
    return Response.json({
      error: 'Não foi possível acessar a LigaPokemon. Verifique o link e tente novamente.',
      debug: 'Ambas as tentativas de fetch falharam (direto + ScraperAPI)',
    }, { status: 503 })
  }

  const { html } = result

  // ── Extrai nome da carta ────────────────────────────────────────────────
  const cardParam = decodeURIComponent(parsedUrl.searchParams.get('card') || '')
  let card_name = decodeHtmlEntities(cardParam.split('|')[0].trim()) || null

  if (!card_name) {
    const metaTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<title>([^<]{3,80})<\/title>/i)
    const raw = metaTitle?.[1]?.split('|')[0]?.split('-')[0]?.trim() || ''
    card_name = decodeHtmlEntities(raw) || null
  }

  if (!card_name) {
    return Response.json({ error: 'Não foi possível identificar a carta. Tente um link diferente.' }, { status: 422 })
  }

  // ── Extrai número ───────────────────────────────────────────────────────
  let card_number: string | null = null
  const nm = card_name.match(/\(([^)]+)\)/)
  card_number = nm?.[1] || parsedUrl.searchParams.get('num') || null

  // ── Raridade ────────────────────────────────────────────────────────────
  const rarityMatch = html.match(/Raridade[^<]*<[^>]*>\s*([^<]+)<|Raridade:\s*([^\n<]{2,40})/i)
  const rarity = decodeHtmlEntities((rarityMatch?.[1] || rarityMatch?.[2])?.trim() || '') || null

  // ── cards_editions → imagem + set ──────────────────────────────────────
  let card_image: string | null = null
  let set_name: string | null = null

  const editionsMatch = html.match(/var\s+cards_editions\s*=\s*(\[[\s\S]+?\]);/)
    || html.match(/cards_editions\s*=\s*(\[[\s\S]+?\]);/)
  if (editionsMatch) {
    try {
      const editions = JSON.parse(editionsMatch[1])
      const img = editions[0]?.img
      if (img) card_image = img.startsWith('//') ? 'https:' + img : img
      const edName = editions[0]?.name || editions[0]?.edition || editions[0]?.set
      if (edName) set_name = decodeHtmlEntities(String(edName).trim())
    } catch {}
  }

  if (!set_name) {
    const setMatch = html.match(/Expans[ãa]o[^<]*<[^>]*>([^<]{3,60})</)
      || html.match(/Edi[çc][ãa]o[^<]*<[^>]*>([^<]{3,60})</)
    if (setMatch?.[1]) set_name = decodeHtmlEntities(setMatch[1].trim())
  }

  // ── cards_stock → preços ────────────────────────────────────────────────
  const variantes: Record<string, { min: number|null; medio: number|null; max: number|null }> = {}

  const stockMatch = html.match(/var\s+cards_stock\s*=\s*(\[[\s\S]+?\]);/)
    || html.match(/cards_stock\s*=\s*(\[[\s\S]+?\]);/)

  if (stockMatch) {
    try {
      const stock: Array<{ extras: number; precoFinal: string }> = JSON.parse(stockMatch[1])
      const byExtra: Record<number, number[]> = {}
      stock.forEach(s => {
        const key = s.extras ?? 0
        if (!byExtra[key]) byExtra[key] = []
        const price = parsePrice(s.precoFinal)
        if (price && price > 0) byExtra[key].push(price)
      })
      Object.entries(byExtra).forEach(([key, prices]) => {
        const variantName = EXTRAS_MAP[parseInt(key)] || `extra_${key}`
        prices.sort((a, b) => a - b)
        const min = prices[0]
        const max = prices[prices.length - 1]
        const medio = prices.reduce((a, b) => a + b, 0) / prices.length
        variantes[variantName] = {
          min: parseFloat(min.toFixed(2)),
          medio: parseFloat(medio.toFixed(2)),
          max: parseFloat(max.toFixed(2)),
        }
      })
      console.log('[preco] variantes extraídas:', Object.keys(variantes), JSON.stringify(variantes))
    } catch (e: any) {
      console.log('[preco] erro ao parsear cards_stock:', e.message)
    }
  } else {
    console.log('[preco] cards_stock NÃO encontrado no HTML')
  }

  // ── Fallback imagem via TCG API ─────────────────────────────────────────
  if (!card_image) {
    try {
      const baseName = card_name.split('(')[0].trim()
      const tcgRes = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(baseName)}"&pageSize=8`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (tcgRes.ok) {
        const tcgData = await tcgRes.json()
        const cards = tcgData?.data || []
        const numOnly = card_number?.split('/')[0]
        const matched = cards.find((c: any) => c.number === numOnly) || cards[0]
        card_image = matched?.images?.large || matched?.images?.small || null
      }
    } catch {}
  }

  const normal   = variantes.normal   || { min: null, medio: null, max: null }
  const foil     = variantes.foil     || { min: null, medio: null, max: null }
  const promo    = variantes.promo    || { min: null, medio: null, max: null }
  const reverse  = variantes.reverse  || { min: null, medio: null, max: null }
  const pokeball = variantes.pokeball || { min: null, medio: null, max: null }

  console.log(`[preco] ✅ ${card_name} | normal: ${normal.medio} | foil: ${foil.medio}`)

  // ── Salva no banco ──────────────────────────────────────────────────────
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  await Promise.allSettled([
    supabaseAdmin.from('card_prices').upsert({
      card_name,
      preco_min: normal.min || 0,
      preco_medio: normal.medio || 0,
      preco_max: normal.max || 0,
      preco_normal: normal.medio || 0,
      preco_foil: foil.medio || 0,
      preco_foil_min: foil.min, preco_foil_medio: foil.medio, preco_foil_max: foil.max,
      preco_promo_min: promo.min, preco_promo_medio: promo.medio, preco_promo_max: promo.max,
      preco_reverse_min: reverse.min, preco_reverse_medio: reverse.medio, preco_reverse_max: reverse.max,
      preco_pokeball_min: pokeball.min, preco_pokeball_medio: pokeball.medio, preco_pokeball_max: pokeball.max,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'card_name' }),
    supabaseAdmin.from('card_price_history').insert({
      card_name,
      preco_min: normal.min, preco_medio: normal.medio, preco_max: normal.max,
      preco_normal: normal.medio, preco_foil: foil.medio,
      recorded_at: new Date().toISOString(),
    }),
  ])

  return Response.json({
    card_name, card_number, card_image, set_name, rarity,
    link: parsedUrl.toString(),
    preco_min: normal.min,
    preco_medio: normal.medio,
    preco_max: normal.max,
    preco_normal: normal.medio,
    preco_foil: foil.medio,
    variantes,
    _method: result.method,
  })
}