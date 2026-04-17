import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

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
    .replace(/&agrave;/g, 'à').replace(/&acirc;/g, 'â').replace(/&ecirc;/g, 'ê')
    .replace(/&ocirc;/g, 'ô').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

const GENERIC_IMAGES = ['logo_new_tcg_2', 'lmcorp.com.br/arquivos/img/logo', 'default', 'placeholder', 'favicon', 'icon.svg', 'loading']

function isGenericImage(url: string | null): boolean {
  if (!url) return true
  return GENERIC_IMAGES.some(g => url.toLowerCase().includes(g))
}

const parse = (t: string | null | undefined): number | null => {
  if (!t) return null
  const n = parseFloat(t.replace('R$', '').replace(/\./g, '').replace(',', '.').trim())
  return isNaN(n) ? null : n
}

function extractFromHtml(html: string) {
  const metaTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
  const card_name = decodeHtmlEntities(metaTitle?.[1]?.split('|')[0]?.trim() || '') || null

  const featuredMatch = html.match(/id=["']featuredImage["'][^>]*src=["']([^"']+)["']/i)
    || html.match(/src=["']([^"']*repositorio\.sbrauble[^"']+)["']/i)
    || html.match(/src=["']([^"']*lmcorp\.com\.br\/arquivos\/in\/[^"']+)["']/i)
  const ogImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
  const card_image = [featuredMatch?.[1], ogImgMatch?.[1]].find(u => !isGenericImage(u)) || null

  const rarityMatch = html.match(/Raridade:\s*([^\n<]{2,40})/i)
  const rarity = decodeHtmlEntities(rarityMatch?.[1]?.trim() || '') || null

  const varMap: Record<string, string> = { extras_n: 'normal', extras_f: 'foil', extras_p: 'promo', extras_r: 'reverse' }
  const variantes: Record<string, { min: number|null; medio: number|null; max: number|null }> = {}
  for (const [cls, name] of Object.entries(varMap)) {
    const block = html.match(new RegExp(`class="[^"]*${cls}[^"]*"[\\s\\S]{0,800}`, 'i'))?.[0] || ''
    const prices = block.match(/R\$\s*[\d.,]+/g)?.map(p => parse(p)).filter((n): n is number => n !== null) || []
    if (prices.length > 0) variantes[name] = { min: prices[0], medio: prices[1] ?? prices[0], max: prices[2] ?? prices[1] ?? prices[0] }
  }
  if (!variantes.normal) {
    const all = html.match(/R\$\s*[\d.,]+/g)?.map(p => parse(p)).filter((n): n is number => n !== null) || []
    if (all.length >= 1) variantes.normal = { min: all[0], medio: all[1] ?? all[0], max: all[2] ?? all[1] ?? all[0] }
  }

  return { card_name, card_image, rarity, variantes }
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

  if (!['ligapokemon.com.br', 'www.ligapokemon.com.br'].includes(parsedUrl.hostname)) {
    return Response.json({ error: 'URL não permitida.' }, { status: 403 })
  }

  const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY
  if (!SCRAPER_API_KEY) return Response.json({ error: 'Serviço de scraping não configurado.' }, { status: 503 })

  // ── STEP 1: Extrai nome/número diretamente da URL (instantâneo) ────────
  const cardParam = decodeURIComponent(parsedUrl.searchParams.get('card') || '')
  let card_name = decodeHtmlEntities(cardParam.split('|')[0].trim()) || null
  const numberMatch = card_name?.match(/\(([^)]+)\)/)
  let card_number = numberMatch?.[1] || parsedUrl.searchParams.get('num') || null

  // ── STEP 2: Busca imagem no Pokemon TCG API (paralelo com scraping) ────
  const tcgPromise = (async (): Promise<string | null> => {
    try {
      const baseName = (card_name || '').split('(')[0].trim()
      if (!baseName) return null
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(baseName)}"&pageSize=8`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (!res.ok) return null
      const data = await res.json()
      const cards = data?.data || []
      const numOnly = card_number?.split('/')[0]
      const matched = cards.find((c: any) => c.number === numOnly) || cards[0]
      return matched?.images?.large || matched?.images?.small || null
    } catch { return null }
  })()

  // ── STEP 3: ScraperAPI com render=true (mais tempo disponível) ─────────
  const scraperPromise = (async (): Promise<string> => {
    try {
      const renderUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(parsedUrl.toString())}&render=true&country_code=br&wait=3000&timeout=45000`
      const res = await fetch(renderUrl, { signal: AbortSignal.timeout(50000) })
      if (res.ok) return await res.text()
    } catch (e: any) { console.log('ScraperAPI render error:', e.message) }
    return ''
  })()

  // Roda TCG API e ScraperAPI em paralelo
  const [tcgImage, html] = await Promise.all([tcgPromise, scraperPromise])

  // Parse do HTML scrapeado
  let card_image: string | null = null
  let rarity: string | null = null
  let variantes: Record<string, { min: number|null; medio: number|null; max: number|null }> = {}

  if (html) {
    const parsed = extractFromHtml(html)
    if (parsed.card_name) card_name = parsed.card_name
    card_image = parsed.card_image
    rarity = parsed.rarity
    variantes = parsed.variantes
    // Número do nome parseado
    const nm = card_name?.match(/\(([^)]+)\)/)
    if (nm?.[1]) card_number = nm[1]
  }

  // Usa imagem do TCG API se não achou no LigaPokemon
  if (!card_image) card_image = tcgImage

  if (!card_name) return Response.json({ error: 'Não foi possível identificar a carta.' }, { status: 422 })

  const normal = variantes.normal || { min: null, medio: null, max: null }
  const foil   = variantes.foil   || { min: null, medio: null, max: null }
  const promo  = variantes.promo  || { min: null, medio: null, max: null }

  const data = {
    card_name, card_number, card_image,
    link: parsedUrl.toString(), rarity,
    preco_min: normal.min, preco_medio: normal.medio, preco_max: normal.max,
    preco_normal: normal.medio, preco_foil: foil.medio,
    variantes,
  }

  console.log('SCRAP:', card_name, '| img:', !!card_image, '| normal:', normal.medio, '| foil:', foil.medio, '| rarity:', rarity)

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  await Promise.all([
    supabaseAdmin.from('card_prices').upsert({
      card_name, preco_min: normal.min||0, preco_medio: normal.medio||0, preco_max: normal.max||0,
      preco_normal: normal.medio||0, preco_foil: foil.medio||0,
      preco_foil_min: foil.min, preco_foil_medio: foil.medio, preco_foil_max: foil.max,
      preco_promo_min: promo.min, preco_promo_medio: promo.medio, preco_promo_max: promo.max,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'card_name' }),
    supabaseAdmin.from('card_price_history').insert({
      card_name, preco_min: normal.min, preco_medio: normal.medio, preco_max: normal.max,
      preco_normal: normal.medio, preco_foil: foil.medio,
      recorded_at: new Date().toISOString(),
    })
  ])

  return Response.json(data)
}