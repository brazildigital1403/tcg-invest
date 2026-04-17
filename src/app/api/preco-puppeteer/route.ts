import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

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

  if (!SCRAPER_API_KEY) {
    return Response.json({ error: 'Serviço de scraping não configurado.' }, { status: 503 })
  }

  try {
    // ScraperAPI usa proxies residenciais que bypassam Cloudflare
    const scraperUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(parsedUrl.toString())}&render=true&country_code=br`

    const res = await fetch(scraperUrl, {
      signal: AbortSignal.timeout(55000),
    })

    if (!res.ok) {
      return Response.json({ error: `Erro ao acessar LigaPokemon: ${res.status}` }, { status: 502 })
    }

    const html = await res.text()

    const BLOCKED = ['just a moment', 'access denied', 'checking your browser']
    if (BLOCKED.some(b => html.toLowerCase().slice(0, 3000).includes(b))) {
      return Response.json({ error: 'LigaPokemon bloqueou o acesso. Tente novamente.' }, { status: 429 })
    }

    // Parse do HTML
    const parse = (t: string | null | undefined): number | null => {
      if (!t) return null
      const n = parseFloat(t.replace('R$', '').replace(/\./g, '').replace(',', '.').trim())
      return isNaN(n) ? null : n
    }

    // Nome da carta
    const metaTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
    const card_name = metaTitleMatch?.[1]?.split('|')[0]?.trim() || null

    if (!card_name) {
      return Response.json({ error: 'Não foi possível identificar a carta. Verifique o link.' }, { status: 422 })
    }

    // Número
    const numberMatch = card_name.match(/\(([^)]+)\)/)
    const card_number = numberMatch?.[1] || parsedUrl.searchParams.get('num') || null

    // Imagem
    const metaImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
    let card_image = metaImgMatch?.[1] || null
    if (card_image?.startsWith('//')) card_image = 'https:' + card_image

    // Raridade
    const rarityMatch = html.match(/Raridade:\s*([^\n<]{2,40})/i)
    const rarity = rarityMatch?.[1]?.trim() || null

    // Preços por variante
    const varMap: Record<string, string> = {
      extras_n: 'normal', extras_f: 'foil', extras_p: 'promo', extras_r: 'reverse'
    }
    const variantes: Record<string, { min: number | null; medio: number | null; max: number | null }> = {}

    for (const [cls, name] of Object.entries(varMap)) {
      const re = new RegExp(`class="[^"]*${cls}[^"]*"[\\s\\S]{0,600}`, 'i')
      const block = html.match(re)?.[0] || ''
      const prices = block.match(/R\$\s*[\d.,]+/g)?.map(p => parse(p)).filter((n): n is number => n !== null) || []
      if (prices.length > 0) {
        variantes[name] = { min: prices[0], medio: prices[1] ?? prices[0], max: prices[2] ?? prices[1] ?? prices[0] }
      }
    }

    // Fallback
    if (!variantes.normal) {
      const all = html.match(/R\$\s*[\d.,]+/g)?.map(p => parse(p)).filter((n): n is number => n !== null) || []
      if (all.length > 0) {
        variantes.normal = { min: all[0], medio: all[1] ?? all[0], max: all[2] ?? all[1] ?? all[0] }
      }
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

    console.log('SCRAP OK:', card_name, '| normal:', normal.medio, '| foil:', foil.medio)

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
  } catch (err: any) {
    console.error('ERRO:', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}