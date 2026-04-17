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

  const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN

  try {
    let html: string

    if (BROWSERLESS_TOKEN) {
      // Produção: usa Browserless.io (sem timeout de download)
      const res = await fetch(`https://chrome.browserless.io/content?token=${BROWSERLESS_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: parsedUrl.toString(),
          waitFor: 3000,
          rejectResourceTypes: ['image', 'font', 'stylesheet'],
        }),
        signal: AbortSignal.timeout(50000),
      })
      if (!res.ok) {
        return Response.json({ error: `Erro ao acessar LigaPokemon: ${res.status}` }, { status: 502 })
      }
      html = await res.text()
    } else {
      // Local: usa puppeteer normal
      const puppeteer = (await import('puppeteer')).default
      const browser = await puppeteer.launch({ headless: 'new' as any, args: ['--no-sandbox'] })
      try {
        const page = await browser.newPage()
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36')
        await page.goto(parsedUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 20000 })
        await new Promise(r => setTimeout(r, 2500))
        html = await page.content()
      } finally {
        await browser.close()
      }
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
    const rawTitle = metaTitleMatch?.[1] || ''
    const card_name = rawTitle.split('|')[0].trim() || null

    if (!card_name || card_name.toLowerCase().includes('just a moment') || card_name.toLowerCase().includes('checking')) {
      return Response.json({ error: 'LigaPokemon bloqueou o acesso. Tente novamente em alguns segundos.' }, { status: 429 })
    }

    // Número da carta
    const numberMatch = card_name?.match(/\(([^)]+)\)/)
    const card_number = numberMatch?.[1] || parsedUrl.searchParams.get('cid') || null

    // Imagem
    const metaImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
    let card_image = metaImgMatch?.[1] || null
    if (card_image?.startsWith('//')) card_image = 'https:' + card_image

    // Raridade
    const rarityMatch = html.match(/Raridade[^<]*<[^>]+>([^<]+)<\/|Raridade:\s*([^\n<]+)/i)
    const rarity = (rarityMatch?.[1] || rarityMatch?.[2])?.trim() || null

    // Preços por variante
    const varMap: Record<string, string> = {
      extras_n: 'normal', extras_f: 'foil', extras_p: 'promo', extras_r: 'reverse'
    }
    const variants: Record<string, { min: number|null, medio: number|null, max: number|null }> = {}

    for (const [cls, name] of Object.entries(varMap)) {
      const re = new RegExp(`class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]{0,600})`, 'i')
      const block = html.match(re)?.[1] || ''
      const prices = block.match(/R\$\s*[\d.,]+/g)?.map(p => parse(p)).filter((n): n is number => n !== null) || []
      if (prices.length > 0) {
        variants[name] = { min: prices[0], medio: prices[1] ?? prices[0], max: prices[2] ?? prices[1] ?? prices[0] }
      }
    }

    // Fallback — pega qualquer preço no HTML se não achou variantes
    if (!variants.normal) {
      const allPrices = html.match(/R\$\s*[\d.,]+/g)?.map(p => parse(p)).filter((n): n is number => n !== null) || []
      if (allPrices.length > 0) {
        variants.normal = { min: allPrices[0], medio: allPrices[1] ?? allPrices[0], max: allPrices[2] ?? allPrices[1] ?? allPrices[0] }
      }
    }

    const normal = variants.normal || { min: null, medio: null, max: null }
    const foil   = variants.foil   || { min: null, medio: null, max: null }
    const promo  = variants.promo  || { min: null, medio: null, max: null }

    const data = {
      card_name, card_number, card_image,
      link: parsedUrl.toString(), rarity,
      preco_min: normal.min, preco_medio: normal.medio, preco_max: normal.max,
      preco_normal: normal.medio, preco_foil: foil.medio,
      variantes: variants,
    }

    console.log('SCRAP OK:', card_name, '| normal:', normal.medio, '| foil:', foil.medio)

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
  } catch (err: any) {
    console.error('ERRO:', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}