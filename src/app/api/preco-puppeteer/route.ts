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

  const SCRAPER_URL = process.env.SCRAPER_URL // https://tcg-invest-production.up.railway.app
  const SCRAPER_SECRET = process.env.SCRAPER_SECRET || 'bynx-scraper-2026'

  try {
    let data: any

    if (SCRAPER_URL) {
      // Produção: chama o microserviço no Railway
      const res = await fetch(`${SCRAPER_URL}/scrape?url=${encodeURIComponent(parsedUrl.toString())}`, {
        headers: { 'x-scraper-secret': SCRAPER_SECRET },
        signal: AbortSignal.timeout(55000),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        return Response.json({ error: err.error || 'Erro no serviço de scraping' }, { status: 502 })
      }
      data = await res.json()
    } else {
      // Local: puppeteer direto
      const puppeteer = (await import('puppeteer')).default
      const browser = await puppeteer.launch({ headless: 'new' as any, args: ['--no-sandbox'] })
      try {
        const page = await browser.newPage()
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36')
        await page.goto(parsedUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 20000 })
        await new Promise(r => setTimeout(r, 2500))
        try {
          await page.evaluate(() => {
            const spans = Array.from(document.querySelectorAll('span.cursor-pointer'))
              .filter((el: any) => el.textContent?.trim() === 'Ver Mais')
            const t = (spans as any)[1] || (spans as any)[0]
            if (t) (t as HTMLElement).click()
          })
          await new Promise(r => setTimeout(r, 1000))
        } catch {}
        data = await page.evaluate(() => {
          const parse = (t: string | null | undefined): number | null => {
            if (!t) return null
            const n = parseFloat(t.replace('R$','').replace(/\./g,'').replace(',','.').trim())
            return isNaN(n) ? null : n
          }
          const metaTitle = (document.querySelector('meta[property="og:title"]') as any)?.content
          const card_name = (metaTitle || document.title || '').split('|')[0].trim() || null
          if (!card_name) return { error: 'Não carregou' }
          const numberMatch = card_name?.match(/\(([^)]+)\)/)
          const card_number = numberMatch?.[1] || null
          const featuredImg = document.querySelector('#featuredImage') as HTMLImageElement
          const metaImg = document.querySelector('meta[property="og:image"]') as HTMLMetaElement
          let card_image = featuredImg?.src || metaImg?.content || null
          if (card_image?.startsWith('//')) card_image = 'https:' + card_image
          const rarityMatch = document.body.innerText.match(/Raridade:\s*(.+)/i)
          const rarity = rarityMatch?.[1]?.split('\n')[0]?.trim() || null
          const varMap: Record<string, string> = { extras_n:'normal', extras_f:'foil', extras_p:'promo', extras_r:'reverse' }
          const variants: Record<string, any> = {}
          Object.keys(varMap).forEach(cls => {
            const el = document.querySelector(`[class*="${cls}"]`)
            if (!el) return
            let anc = el.parentElement
            for (let i=0; i<5; i++) {
              if (!anc) break
              const prices = anc.textContent?.match(/R\$\s*[\d.,]+/g)
              if (prices?.length >= 1) {
                const nums = prices.map((p: string) => parse(p)).filter((n: any): n is number => n !== null)
                if (nums.length) variants[varMap[cls]] = { min:nums[0], medio:nums[1]??nums[0], max:nums[2]??nums[1]??nums[0] }
                break
              }
              anc = anc.parentElement
            }
          })
          const normal = variants['normal'] || {}
          const foil = variants['foil'] || {}
          return { card_name, card_number, card_image, link:location.href, rarity,
            preco_min:normal.min||null, preco_medio:normal.medio||null, preco_max:normal.max||null,
            preco_normal:normal.medio||null, preco_foil:foil.medio||null, variantes:variants }
        })
      } finally {
        await browser.close()
      }
    }

    if (!data || data.error || !data.card_name) {
      return Response.json({ error: data?.error || 'Não foi possível identificar a carta.' }, { status: 422 })
    }

    console.log('SCRAP OK:', data.card_name)

    // Salva no banco
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
    const v = data.variantes || {}
    await Promise.all([
      supabaseAdmin.from('card_prices').upsert({
        card_name: data.card_name,
        preco_min: v.normal?.min||0, preco_medio: v.normal?.medio||0, preco_max: v.normal?.max||0,
        preco_normal: v.normal?.medio||0, preco_foil: v.foil?.medio||0,
        preco_foil_min: v.foil?.min, preco_foil_medio: v.foil?.medio, preco_foil_max: v.foil?.max,
        preco_promo_min: v.promo?.min, preco_promo_medio: v.promo?.medio, preco_promo_max: v.promo?.max,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'card_name' }),
      supabaseAdmin.from('card_price_history').insert({
        card_name: data.card_name,
        preco_min: v.normal?.min, preco_medio: v.normal?.medio, preco_max: v.normal?.max,
        preco_normal: v.normal?.medio, preco_foil: v.foil?.medio,
        recorded_at: new Date().toISOString(),
      })
    ])

    return Response.json(data)
  } catch (err: any) {
    console.error('ERRO:', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}