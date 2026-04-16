import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

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

  try {
    let browser: any
    if (process.env.VERCEL) {
      const chromium = (await import('@sparticuz/chromium-min')).default
      const puppeteer = (await import('puppeteer-core')).default
      const executablePath = await chromium.executablePath(
        'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
      )
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath,
        headless: true,
      })
    } else {
      const puppeteer = (await import('puppeteer')).default
      browser = await puppeteer.launch({ headless: 'new' as any, args: ['--no-sandbox'] })
    }

    try {
      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

      // Timeout agressivo para caber em 30s
      await page.goto(parsedUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 12000 })
      await new Promise(r => setTimeout(r, 2500))

      const title = await page.title()

      // Se Cloudflare bloqueou, retorna erro específico
      if (title.toLowerCase().includes('just a moment') || title.toLowerCase().includes('checking')) {
        return Response.json({
          error: 'LigaPokemon está verificando o acesso. Aguarde alguns segundos e tente novamente.'
        }, { status: 429 })
      }

      const data = await page.evaluate(() => {
        const parse = (t: string | null | undefined): number | null => {
          if (!t) return null
          const n = parseFloat(t.replace('R$','').replace(/\./g,'').replace(',','.').trim())
          return isNaN(n) ? null : n
        }

        const metaTitle = (document.querySelector('meta[property="og:title"]') as any)?.content
        const card_name = (metaTitle || document.title || '').split('|')[0].trim() || null

        if (!card_name || card_name.toLowerCase().includes('just a moment')) {
          return { error: 'Página não carregou corretamente' }
        }

        const numberMatch = card_name?.match(/\(([^)]+)\)/)
        const card_number = numberMatch?.[1] || new URL(location.href).searchParams.get('cid') || null

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
          for (let i = 0; i < 5; i++) {
            if (!anc) break
            const prices = anc.textContent?.match(/R\$\s*[\d.,]+/g)
            if (prices && prices.length >= 1) {
              const nums = prices.map((p: string) => parse(p)).filter((n: any): n is number => n !== null)
              if (nums.length) variants[varMap[cls]] = { min:nums[0], medio:nums[1]??nums[0], max:nums[2]??nums[1]??nums[0] }
              break
            }
            anc = anc.parentElement
          }
        })

        const normal = variants['normal'] || {}
        const foil = variants['foil'] || {}

        return {
          card_name, card_number, card_image,
          link: location.href, rarity,
          preco_min: normal.min||null, preco_medio: normal.medio||null, preco_max: normal.max||null,
          preco_normal: normal.medio||null, preco_foil: foil.medio||null,
          variantes: variants
        }
      })

      if (!data || (data as any).error || !data.card_name) {
        return Response.json({ error: 'Não foi possível identificar a carta. Verifique o link.' }, { status: 422 })
      }

      console.log('SCRAP OK:', data.card_name)

      // Salva no banco em paralelo
      const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
      const v = (data as any).variantes || {}
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
    } finally {
      await browser.close()
    }
  } catch (err: any) {
    console.error('ERRO:', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}