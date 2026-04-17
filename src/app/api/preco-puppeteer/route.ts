import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

// Mapeamento de tipos de extras do LigaPokemon
const EXTRAS_MAP: Record<number, string> = {
  0: 'normal',
  2: 'foil',
  3: 'reverse',
  14: 'promo',
  47: 'pokeball',
  1: 'foil',       // foil alternativo
  4: 'reverse',    // reverse alternativo
  15: 'special',
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
    .replace(/&agrave;/g, 'à').replace(/&acirc;/g, 'â').replace(/&ecirc;/g, 'ê').replace(/&ocirc;/g, 'ô')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
}

function parsePrice(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const s = String(v).trim()
  const n = parseFloat(s)
  if (isNaN(n) || n <= 0) return null
  // LigaPokemon armazena preços em 2 formatos:
  // "0.17" → já em reais (tem ponto decimal)
  // "4499" → em centavos (sem ponto decimal) → divide por 100
  if (!s.includes('.') && !s.includes(',')) {
    return parseFloat((n / 100).toFixed(2))
  }
  return parseFloat(n.toFixed(2))
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const supabaseAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user) return Response.json({ error: 'Sessão inválida' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const targetUrl = searchParams.get('url')
  if (!targetUrl) return Response.json({ error: 'URL não informada' }, { status: 400 })

  let parsedUrl: URL
  try { parsedUrl = new URL(targetUrl) }
  catch { return Response.json({ error: 'URL inválida' }, { status: 400 }) }

  // ── Normaliza URL: resolve link curto e trata busca ─────────────────────

  // 1) Link curto lig.ae → segue redirect para URL completa
  if (parsedUrl.hostname === 'lig.ae' || parsedUrl.hostname.endsWith('.lig.ae')) {
    try {
      const redirectRes = await fetch(targetUrl, {
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' }
      })
      const finalUrl = redirectRes.url
      console.log('lig.ae redirect →', finalUrl)
      try { parsedUrl = new URL(finalUrl) }
      catch { return Response.json({ error: 'Link inválido após redirecionamento.' }, { status: 400 }) }
    } catch {
      return Response.json({ error: 'Não foi possível resolver o link curto.' }, { status: 400 })
    }
  }

  // 2) URL de busca → mantém e extrai nome do parâmetro card
  if (parsedUrl.searchParams.get('view')?.includes('search')) {
    const cidMatch = (parsedUrl.searchParams.get('card') || '').match(/cid=(\d+)/)
    if (cidMatch) {
      parsedUrl = new URL(`https://www.ligapokemon.com.br/?view=cards/card&cid=${cidMatch[1]}`)
    }
    // Para busca geral mantém a URL — ScraperAPI vai carregar e extrair os dados
  }

  // Valida que chegou num domínio permitido
  if (!['ligapokemon.com.br', 'www.ligapokemon.com.br'].includes(parsedUrl.hostname)) {
    return Response.json({ error: `URL não permitida: ${parsedUrl.hostname}. Use links da LigaPokemon.` }, { status: 403 })
  }

  const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY
  if (!SCRAPER_API_KEY) return Response.json({ error: 'Serviço de scraping não configurado.' }, { status: 503 })

  // ── STEP 1: Extrai nome/número da URL (instantâneo) ────────────────────
  const cardParam = decodeURIComponent(parsedUrl.searchParams.get('card') || '')
  let card_name = decodeHtmlEntities(cardParam.split('|')[0].trim()) || null
  const numberMatch = card_name?.match(/\(([^)]+)\)/)
  let card_number = numberMatch?.[1] || parsedUrl.searchParams.get('num') || null

  // ── STEP 2: ScraperAPI sem render para pegar HTML estático ────────────
  const fastUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(parsedUrl.toString())}&country_code=br`
  const fastRes = await fetch(fastUrl, { signal: AbortSignal.timeout(15000) })
  if (!fastRes.ok) return Response.json({ error: 'Erro ao acessar LigaPokemon' }, { status: 502 })
  const html = await fastRes.text()

  // Extrai nome do HTML se não tinha na URL
  if (!card_name) {
    const metaTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    card_name = decodeHtmlEntities(metaTitle?.[1]?.split('|')[0]?.trim() || '') || null
  }
  if (!card_name) return Response.json({ error: 'Não foi possível identificar a carta.' }, { status: 422 })

  // Extrai número
  if (!card_number) {
    const nm = card_name.match(/\(([^)]+)\)/)
    card_number = nm?.[1] || parsedUrl.searchParams.get('num') || null
  }

  // Raridade
  const rarityMatch = html.match(/Raridade[^<]*<[^>]*>\s*([^<]+)<|Raridade:\s*([^\n<]{2,40})/i)
  const rarity = decodeHtmlEntities((rarityMatch?.[1] || rarityMatch?.[2])?.trim() || '') || null

  // ── STEP 3: Extrai dados diretamente do HTML (cards_stock e cards_editions) ──
  // Os dados já estão no HTML como variáveis JavaScript inline!

  let card_image: string | null = null
  const variantes: Record<string, { min: number|null; medio: number|null; max: number|null }> = {}

  // Extrai cards_editions (imagem real da carta)
  const editionsMatch = html.match(/var\s+cards_editions\s*=\s*(\[[\s\S]+?\]);/)
    || html.match(/cards_editions\s*=\s*(\[[\s\S]+?\]);/)
  if (editionsMatch) {
    try {
      const editions = JSON.parse(editionsMatch[1])
      const img = editions[0]?.img
      if (img) card_image = img.startsWith('//') ? 'https:' + img : img
    } catch {}
  }

  // Extrai cards_stock (preços por variante)
  const stockMatch = html.match(/var\s+cards_stock\s*=\s*(\[[\s\S]+?\]);/)
    || html.match(/cards_stock\s*=\s*(\[[\s\S]+?\]);/)
  if (stockMatch) {
    try {
      const stock: Array<{ extras: number; precoFinal: string }> = JSON.parse(stockMatch[1])

      // Agrupa preços por tipo de extra
      const byExtra: Record<number, number[]> = {}
      stock.forEach(s => {
        const key = s.extras ?? 0
        if (!byExtra[key]) byExtra[key] = []
        const price = parsePrice(s.precoFinal)
        if (price && price > 0) byExtra[key].push(price)
      })

      // Calcula min/medio/max por tipo
      Object.entries(byExtra).forEach(([key, prices]) => {
        const variantName = EXTRAS_MAP[parseInt(key)] || `extra_${key}`
        prices.sort((a, b) => a - b)
        const min = prices[0]
        const max = prices[prices.length - 1]
        const medio = prices.reduce((a, b) => a + b, 0) / prices.length
        variantes[variantName] = {
          min: parseFloat(min.toFixed(2)),
          medio: parseFloat(medio.toFixed(2)),
          max: parseFloat(max.toFixed(2))
        }
      })
    } catch (e: any) {
      console.log('Erro ao parsear cards_stock:', e.message)
    }
  }

  console.log('variantes:', JSON.stringify(variantes))

  // Fallback imagem: Pokemon TCG API
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

  const normal  = variantes.normal  || { min: null, medio: null, max: null }
  const foil    = variantes.foil    || { min: null, medio: null, max: null }
  const promo   = variantes.promo   || { min: null, medio: null, max: null }
  const reverse = variantes.reverse || { min: null, medio: null, max: null }
  const pokeball = variantes.pokeball || { min: null, medio: null, max: null }

  const data = {
    card_name, card_number, card_image,
    link: parsedUrl.toString(), rarity,
    preco_min: normal.min, preco_medio: normal.medio, preco_max: normal.max,
    preco_normal: normal.medio, preco_foil: foil.medio,
    variantes,
  }

  console.log('✅', card_name, '| normal:', normal.medio, '| foil:', foil.medio, '| reverse:', reverse.medio, '| pokeball:', pokeball.medio)

  // Salva no banco
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  await Promise.all([
    supabaseAdmin.from('card_prices').upsert({
      card_name,
      preco_min: normal.min || 0, preco_medio: normal.medio || 0, preco_max: normal.max || 0,
      preco_normal: normal.medio || 0, preco_foil: foil.medio || 0,
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
    })
  ])

  return Response.json(data)
}