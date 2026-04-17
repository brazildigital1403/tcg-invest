const express = require('express')
const puppeteer = require('puppeteer')
const app = express()

const PORT = process.env.PORT || 3001
const SECRET = process.env.SCRAPER_SECRET || 'bynx-scraper-2026'

// Palavras que indicam bloqueio do Cloudflare
const BLOCKED_TITLES = ['just a moment', 'access denied', 'checking your browser', '403 forbidden', 'ray id', 'cloudflare']

app.get('/health', (req, res) => res.json({ ok: true }))

app.get('/scrape', async (req, res) => {
  const auth = req.headers['x-scraper-secret']
  if (auth !== SECRET) return res.status(401).json({ error: 'Não autorizado' })

  const url = req.query.url
  if (!url) return res.status(400).json({ error: 'URL não informada' })

  let browser
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    })
    const page = await browser.newPage()

    // Headers realistas de browser
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    })

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await new Promise(r => setTimeout(r, 4000))

    // Verifica bloqueio
    const title = await page.title()
    const titleLower = title.toLowerCase()
    const isBlocked = BLOCKED_TITLES.some(t => titleLower.includes(t))

    if (isBlocked) {
      console.log('Cloudflare block detected:', title)
      return res.status(429).json({ error: `LigaPokemon bloqueou: ${title}. Tente novamente em alguns segundos.` })
    }

    // Clica em Ver Mais para abrir preços extras
    try {
      await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span.cursor-pointer'))
          .filter(el => el.textContent?.trim() === 'Ver Mais')
        const t = spans[1] || spans[0]
        if (t) t.click()
      })
      await new Promise(r => setTimeout(r, 1500))
    } catch {}

    const data = await page.evaluate((BLOCKED) => {
      const parse = t => {
        if (!t) return null
        const n = parseFloat(t.replace('R$','').replace(/\./g,'').replace(',','.').trim())
        return isNaN(n) ? null : n
      }

      const metaTitle = document.querySelector('meta[property="og:title"]')?.content
      const card_name = (metaTitle || document.title || '').split('|')[0].trim() || null

      // Rejeita se bloqueado
      if (!card_name) return { error: 'Sem título na página' }
      if (BLOCKED.some(t => card_name.toLowerCase().includes(t))) {
        return { error: `Cloudflare block: ${card_name}` }
      }

      const numberMatch = card_name?.match(/\(([^)]+)\)/)
      const card_number = numberMatch?.[1] || new URL(location.href).searchParams.get('cid') || null

      const featuredImg = document.querySelector('#featuredImage')
      const metaImg = document.querySelector('meta[property="og:image"]')
      let card_image = featuredImg?.src || metaImg?.content || null
      if (card_image?.startsWith('//')) card_image = 'https:' + card_image

      const rarityMatch = document.body.innerText.match(/Raridade:\s*(.+)/i)
      const rarity = rarityMatch?.[1]?.split('\n')[0]?.trim() || null

      const varMap = { extras_n:'normal', extras_f:'foil', extras_p:'promo', extras_r:'reverse' }
      const variants = {}
      Object.keys(varMap).forEach(cls => {
        const el = document.querySelector(`[class*="${cls}"]`)
        if (!el) return
        let anc = el.parentElement
        for (let i=0; i<5; i++) {
          if (!anc) break
          const prices = anc.textContent?.match(/R\$\s*[\d.,]+/g)
          if (prices?.length >= 1) {
            const nums = prices.map(p=>parse(p)).filter(n=>n!==null)
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
    }, BLOCKED_TITLES)

    if (data.error) {
      console.log('Error from page:', data.error)
      return res.status(422).json({ error: data.error })
    }

    console.log('SCRAP OK:', data.card_name, '| normal:', data.preco_normal)
    res.json(data)

  } catch(err) {
    console.error('ERRO:', err.message)
    res.status(500).json({ error: err.message })
  } finally {
    if (browser) await browser.close()
  }
})

app.listen(PORT, () => console.log(`Scraper rodando na porta ${PORT}`))