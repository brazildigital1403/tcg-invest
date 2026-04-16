import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user) {
    return Response.json({ error: 'Sessão inválida' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const targetUrl = searchParams.get('url')

  if (!targetUrl) {
    return Response.json({ error: 'URL não informada' }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(targetUrl)
  } catch {
    return Response.json({ error: 'URL inválida' }, { status: 400 })
  }

  const dominiosPermitidos = ['ligapokemon.com.br', 'www.ligapokemon.com.br']
  if (!dominiosPermitidos.includes(parsedUrl.hostname)) {
    return Response.json({ error: 'URL não permitida.' }, { status: 403 })
  }

  try {
    let chromium: any
    let puppeteer: any

    // Em produção usa @sparticuz/chromium, localmente usa puppeteer normal
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      chromium = (await import('@sparticuz/chromium')).default
      puppeteer = (await import('puppeteer-core')).default
    } else {
      puppeteer = (await import('puppeteer')).default
    }

    const browser = await puppeteer.launch(
      process.env.VERCEL || process.env.NODE_ENV === 'production'
        ? {
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
          }
        : {
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
          }
    )

    try {
      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
      await page.goto(parsedUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 25000 })
      await new Promise(res => setTimeout(res, 2000))

      try {
        await page.evaluate(() => {
          const spans = Array.from(document.querySelectorAll('span.cursor-pointer'))
            .filter((el: any) => el.textContent?.trim() === 'Ver Mais')
          const target = spans[1] || spans[0]
          if (target) (target as HTMLElement).click()
        })
        await new Promise(res => setTimeout(res, 1000))
      } catch {}

      const data = await page.evaluate(() => {
        const parse = (t: string | null | undefined): number | null => {
          if (!t) return null
          const n = parseFloat(t.replace('R$', '').replace(/\./g, '').replace(',', '.').trim())
          return isNaN(n) ? null : n
        }

        const metaTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
        const card_name = (metaTitle || document.title || '').split('|')[0].trim() || null

        const numberMatch = card_name?.match(/\(([^)]+)\)/)
        const cidParam = new URL(window.location.href).searchParams.get('cid')
        const card_number = numberMatch?.[1] || cidParam || null

        const featuredImg = document.querySelector('#featuredImage') as HTMLImageElement | null
        const metaImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null
        let card_image = featuredImg?.src || metaImage?.content || null
        if (card_image?.startsWith('//')) card_image = 'https:' + card_image

        const rarityMatch = document.body.innerText.match(/Raridade:\s*(.+)/i)
        const rarity = rarityMatch?.[1]?.split('\n')[0]?.trim() || null

        const variantMap: Record<string, string> = {
          extras_n: 'normal', extras_f: 'foil', extras_p: 'promo',
          extras_r: 'reverse', extras_pb: 'pokeball',
        }

        const variants: Record<string, { min: number|null, medio: number|null, max: number|null }> = {}

        Object.keys(variantMap).forEach(cls => {
          const el = document.querySelector(`[class*="${cls}"]`)
          if (!el) return
          let ancestor = el.parentElement
          for (let i = 0; i < 5; i++) {
            if (!ancestor) break
            const prices = ancestor.textContent?.match(/R\$\s*[\d.,]+/g)
            if (prices && prices.length >= 1) {
              const nums = prices.map((p: string) => parse(p)).filter((n): n is number => n !== null)
              if (nums.length >= 1) {
                variants[variantMap[cls]] = { min: nums[0], medio: nums[1] ?? nums[0], max: nums[2] ?? nums[1] ?? nums[0] }
              }
              break
            }
            ancestor = ancestor.parentElement
          }
        })

        const normal = variants['normal'] || { min: null, medio: null, max: null }
        const foil = variants['foil'] || { min: null, medio: null, max: null }
        const promo = variants['promo'] || { min: null, medio: null, max: null }

        return { card_name, card_number, card_image, link: window.location.href, rarity,
          preco_min: normal.min, preco_medio: normal.medio, preco_max: normal.max,
          preco_normal: normal.medio, preco_foil: foil.medio, variantes: variants }
      })

      if (data?.card_name) {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_KEY!
        )
        const v = (data as any).variantes || {}
        await supabaseAdmin.from('card_prices').upsert({
          card_name: data.card_name,
          preco_min: v.normal?.min || 0, preco_medio: v.normal?.medio || 0,
          preco_max: v.normal?.max || 0, preco_normal: v.normal?.medio || 0,
          preco_foil: v.foil?.medio || 0,
          preco_foil_min: v.foil?.min, preco_foil_medio: v.foil?.medio, preco_foil_max: v.foil?.max,
          preco_promo_min: v.promo?.min, preco_promo_medio: v.promo?.medio, preco_promo_max: v.promo?.max,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'card_name' })

        await supabaseAdmin.from('card_price_history').insert({
          card_name: data.card_name,
          preco_min: v.normal?.min, preco_medio: v.normal?.medio, preco_max: v.normal?.max,
          preco_normal: v.normal?.medio, preco_foil: v.foil?.medio,
          recorded_at: new Date().toISOString(),
        })
      }

      return Response.json(data)
    } finally {
      await browser.close()
    }
  } catch (err: any) {
    console.error('ERRO:', err.message)
    return Response.json({ error: 'Erro ao buscar dados da carta: ' + err.message }, { status: 500 })
  }
}