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
  if (!SCRAPER_API_KEY) return Response.json({ error: 'Serviço de scraping não configurado.' }, { status: 503 })

  const parse = (t: string | null | undefined): number | null => {
    if (!t) return null
    const n = parseFloat(t.replace('R$', '').replace(/\./g, '').replace(',', '.').trim())
    return isNaN(n) ? null : n
  }

  // --- STEP 1: Busca sem render (rápido) para pegar nome e número ---
  let card_name: string | null = null
  let card_number: string | null = null

  try {
    const fastUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(parsedUrl.toString())}&country_code=br`
    const fastRes = await fetch(fastUrl, { signal: AbortSignal.timeout(15000) })
    if (fastRes.ok) {
      const html = await fastRes.text()
      const metaTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
      card_name = metaTitle?.[1]?.split('|')[0]?.trim() || null
      const numberMatch = card_name?.match(/\(([^)]+)\)/)
      card_number = numberMatch?.[1] || parsedUrl.searchParams.get('num') || null
    }
  } catch {}

  // Extrai nome do URL como fallback
  if (!card_name) {
    const cardParam = parsedUrl.searchParams.get('card') || ''
    card_name = cardParam.split('|')[0].trim() || null
    const numberMatch = card_name?.match(/\(([^)]+)\)/)
    card_number = numberMatch?.[1] || parsedUrl.searchParams.get('num') || null
  }

  if (!card_name) return Response.json({ error: 'Não foi possível identificar a carta.' }, { status: 422 })

  // --- STEP 2: Busca imagem via Pokemon TCG API ---
  let card_image: string | null = null
  try {
    const cardBaseName = card_name.split('(')[0].trim()
    const tcgRes = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cardBaseName)}"&pageSize=5`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (tcgRes.ok) {
      const tcgData = await tcgRes.json()
      const cards = tcgData?.data || []
      // Tenta match pelo número
      const matched = cards.find((c: any) => c.number === card_number?.split('/')[0]) || cards[0]
      card_image = matched?.images?.large || matched?.images?.small || null
    }
  } catch {}

  // --- STEP 3: Busca com render=true para preços e imagem real ---
  let variantes: Record<string, { min: number | null; medio: number | null; max: number | null }> = {}
  let rarity: string | null = null

  try {
    const renderUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(parsedUrl.toString())}&render=true&country_code=br&wait=3000&timeout=40000`
    const renderRes = await fetch(renderUrl, { signal: AbortSignal.timeout(45000) })

    if (renderRes.ok) {
      const html = await renderRes.text()

      // Imagem real (se ScraperAPI renderizou JS)
      const featuredMatch = html.match(/id=["']featuredImage["'][^>]*src=["']([^"']+)["']/i)
        || html.match(/src=["']([^"']+repositorio\.sbrauble[^"']+)["']/i)
      if (featuredMatch?.[1]) card_image = featuredMatch[1]

      // Raridade
      const rarityMatch = html.match(/Raridade:\s*([^\n<]{2,40})/i)
      rarity = rarityMatch?.[1]?.trim() || null

      // Preços por variante
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

      // Fallback preços
      if (!variantes.normal) {
        const all = html.match(/R\$\s*[\d.,]+/g)?.map(p => parse(p)).filter((n): n is number => n !== null) || []
        if (all.length > 0) {
          variantes.normal = { min: all[0], medio: all[1] ?? all[0], max: all[2] ?? all[1] ?? all[0] }
        }
      }
    }
  } catch (err: any) {
    console.log('render timeout ou erro:', err.message)
    // Não falha — retorna com o que tem (nome, número, imagem do TCG API)
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

  console.log('SCRAP OK:', card_name, '| img:', !!card_image, '| normal:', normal.medio, '| foil:', foil.medio)

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