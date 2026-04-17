import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

// Decodifica entidades HTML: &iacute; → í, &eacute; → é, etc.
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/g, 'á').replace(/&Aacute;/g, 'Á')
    .replace(/&eacute;/g, 'é').replace(/&Eacute;/g, 'É')
    .replace(/&iacute;/g, 'í').replace(/&Iacute;/g, 'Í')
    .replace(/&oacute;/g, 'ó').replace(/&Oacute;/g, 'Ó')
    .replace(/&uacute;/g, 'ú').replace(/&Uacute;/g, 'Ú')
    .replace(/&atilde;/g, 'ã').replace(/&Atilde;/g, 'Ã')
    .replace(/&otilde;/g, 'õ').replace(/&Otilde;/g, 'Õ')
    .replace(/&ccedil;/g, 'ç').replace(/&Ccedil;/g, 'Ç')
    .replace(/&agrave;/g, 'à').replace(/&Agrave;/g, 'À')
    .replace(/&acirc;/g, 'â').replace(/&Acirc;/g, 'Â')
    .replace(/&ecirc;/g, 'ê').replace(/&Ecirc;/g, 'Ê')
    .replace(/&ocirc;/g, 'ô').replace(/&Ocirc;/g, 'Ô')
    .replace(/&uuml;/g, 'ü').replace(/&auml;/g, 'ä')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

// Imagens genéricas a ignorar
const GENERIC_IMAGES = [
  'logo_new_tcg_2.jpg', 'logo_tcg', 'favicon', 'icon.svg',
  'lmcorp.com.br/arquivos/img/logo', 'default', 'placeholder'
]

function isGenericImage(url: string | null): boolean {
  if (!url) return true
  return GENERIC_IMAGES.some(g => url.toLowerCase().includes(g))
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

  if (!['ligapokemon.com.br', 'www.ligapokemon.com.br'].includes(parsedUrl.hostname)) {
    return Response.json({ error: 'URL não permitida.' }, { status: 403 })
  }

  const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY
  if (!SCRAPER_API_KEY) return Response.json({ error: 'Serviço de scraping não configurado.' }, { status: 503 })

  const parse = (t: string | null | undefined): number | null => {
    if (!t) return null
    const n = parseFloat(t.replace('R$', '').replace(/\./g, '').replace(',', '.').trim())
    return isNaN(n) ? null : n
  }

  let card_name: string | null = null
  let card_number: string | null = null
  let card_image: string | null = null
  let rarity: string | null = null
  let variantes: Record<string, { min: number | null; medio: number | null; max: number | null }> = {}

  // ─── FASE 1: ScraperAPI com render=true (dados completos) ───────────────
  // Tenta primeiro com render — se funcionar temos tudo
  let renderHtml = ''
  try {
    const renderUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(parsedUrl.toString())}&render=true&country_code=br&wait=2000&timeout=35000`
    const renderRes = await fetch(renderUrl, { signal: AbortSignal.timeout(40000) })
    if (renderRes.ok) renderHtml = await renderRes.text()
  } catch (err: any) {
    console.log('render falhou:', err.message)
  }

  // ─── FASE 2: Se render falhou, busca sem render (mais rápido) ─────────
  let fastHtml = renderHtml
  if (!renderHtml) {
    try {
      const fastUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(parsedUrl.toString())}&country_code=br`
      const fastRes = await fetch(fastUrl, { signal: AbortSignal.timeout(15000) })
      if (fastRes.ok) fastHtml = await fastRes.text()
    } catch {}
  }

  // ─── PARSE do HTML ────────────────────────────────────────────────────
  const html = fastHtml
  if (html) {
    // Nome (com decode de entidades HTML)
    const metaTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
    const rawTitle = metaTitle?.[1] || ''
    card_name = decodeHtmlEntities(rawTitle.split('|')[0].trim()) || null

    // Número
    const numberMatch = card_name?.match(/\(([^)]+)\)/)
    card_number = numberMatch?.[1] || parsedUrl.searchParams.get('num') || null

    // Imagem — primeiro tenta a imagem real da carta
    const featuredMatch = html.match(/id=["']featuredImage["'][^>]*src=["']([^"']+)["']/i)
      || html.match(/src=["']([^"']*repositorio\.sbrauble[^"']+)["']/i)
      || html.match(/src=["']([^"']*lmcorp\.com\.br\/arquivos\/in\/[^"']+)["']/i)
    const ogImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
    
    const candidates = [featuredMatch?.[1], ogImgMatch?.[1]].filter(Boolean)
    card_image = candidates.find(u => !isGenericImage(u)) || null

    // Raridade
    const rarityMatch = html.match(/Raridade:\s*([^\n<]{2,40})/i)
    rarity = decodeHtmlEntities(rarityMatch?.[1]?.trim() || '') || null

    // Preços
    const varMap: Record<string, string> = {
      extras_n: 'normal', extras_f: 'foil', extras_p: 'promo', extras_r: 'reverse'
    }
    for (const [cls, name] of Object.entries(varMap)) {
      const re = new RegExp(`class="[^"]*${cls}[^"]*"[\\s\\S]{0,800}`, 'i')
      const block = html.match(re)?.[0] || ''
      const prices = block.match(/R\$\s*[\d.,]+/g)?.map(p => parse(p)).filter((n): n is number => n !== null) || []
      if (prices.length > 0) {
        variantes[name] = { min: prices[0], medio: prices[1] ?? prices[0], max: prices[2] ?? prices[1] ?? prices[0] }
      }
    }
    if (!variantes.normal) {
      const all = html.match(/R\$\s*[\d.,]+/g)?.map(p => parse(p)).filter((n): n is number => n !== null) || []
      if (all.length >= 1) variantes.normal = { min: all[0], medio: all[1] ?? all[0], max: all[2] ?? all[1] ?? all[0] }
    }
  }

  // ─── Fallback nome da URL ─────────────────────────────────────────────
  if (!card_name) {
    const cardParam = decodeURIComponent(parsedUrl.searchParams.get('card') || '')
    card_name = cardParam.split('|')[0].trim() || null
    const numberMatch = card_name?.match(/\(([^)]+)\)/)
    card_number = numberMatch?.[1] || parsedUrl.searchParams.get('num') || null
  }

  if (!card_name) return Response.json({ error: 'Não foi possível identificar a carta.' }, { status: 422 })

  // ─── Fallback imagem: Pokemon TCG API ────────────────────────────────
  if (!card_image) {
    try {
      const baseName = card_name.split('(')[0].trim().replace(/\s+ex$/i, ' ex').replace(/\s+v$/i, ' V')
      const tcgRes = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(baseName)}"&pageSize=8`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (tcgRes.ok) {
        const tcgData = await tcgRes.json()
        const cards = tcgData?.data || []
        const numOnly = card_number?.split('/')[0]
        const matched = cards.find((c: any) => c.number === numOnly) || cards[0]
        if (matched?.images?.large || matched?.images?.small) {
          card_image = matched.images.large || matched.images.small
        }
      }
    } catch {}
  }

  const normal = variantes.normal || { min: null, medio: null, max: null }
  const foil = variantes.foil || { min: null, medio: null, max: null }
  const promo = variantes.promo || { min: null, medio: null, max: null }

  const data = {
    card_name, card_number, card_image,
    link: parsedUrl.toString(), rarity,
    preco_min: normal.min, preco_medio: normal.medio, preco_max: normal.max,
    preco_normal: normal.medio, preco_foil: foil.medio,
    variantes,
  }

  console.log('SCRAP:', card_name, '| img:', !!card_image, '| normal:', normal.medio, '| foil:', foil.medio, '| rarity:', rarity)

  // Salva no banco
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  await Promise.all([
    supabaseAdmin.from('card_prices').upsert({
      card_name, preco_min: normal.min || 0, preco_medio: normal.medio || 0,
      preco_max: normal.max || 0, preco_normal: normal.medio || 0, preco_foil: foil.medio || 0,
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