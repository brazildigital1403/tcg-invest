import puppeteer from 'puppeteer'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const targetUrl = searchParams.get('url')

  if (!targetUrl) {
    return Response.json({ error: 'URL não informada' }, { status: 400 })
  }

  const url = targetUrl

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()

    await page.goto(url, { waitUntil: 'domcontentloaded' })

    // 🔥 espera o bloco de preço aparecer de verdade
    await page.waitForSelector('body', { timeout: 10000 })
    await new Promise(res => setTimeout(res, 3000))

    const data = await page.evaluate(() => {
      const parse = (t: string | null) => {
        if (!t) return null
        return parseFloat(
          t.replace('R$', '')
            .replace(/\./g, '')
            .replace(',', '.')
            .trim()
        )
      }

      try {
        const all = Array.from(document.querySelectorAll('*'))

        const target = all.find(el =>
          el.textContent?.includes('Preço Médio de Venda no Marketplace')
        )

        if (!target) {
          return { debug: 'bloco não encontrado' }
        }

        const text = target.textContent || ''
        const prices = text.match(/R\$\s?[\d,.]+/g) || []

        if (prices.length < 3) {
          return { debug: 'preços insuficientes', prices }
        }

        // 🔥 pegar nome da carta
        const titleEl = document.querySelector('h1') || document.querySelector('#featuredImage')
        const title = titleEl?.textContent?.trim() || (titleEl as HTMLImageElement)?.alt || null

        // 🔥 extrair raridade (mais preciso)
        let rarity = null

        // 🎯 tentar pegar raridade por seletor comum da LigaPokemon
        const rarityEl = document.querySelector('[class*="raridade" i], [class*="rarity" i]')
        if (rarityEl?.textContent) {
          rarity = rarityEl.textContent.trim()
        }

        // fallback texto (menos confiável)
        if (!rarity) {
          const infoText = document.body.innerText

          if (!rarity) {
            const rarityMatch = infoText.match(/Raridade:\s*(.+)/i)
            if (rarityMatch) {
              rarity = rarityMatch[1].split('\n')[0].trim()
            }
          }
        }

        // 🔥 tentar extrair número do nome (ex: Pikachu (4/53))
        const numberMatch = title?.match(/\(([^)]+)\)/)
        let cardNumber = numberMatch ? numberMatch[1] : null

        // 🔥 fallback: extrair do URL (cid)
        if (!cardNumber) {
          const urlParams = new URL(window.location.href).searchParams
          const cid = urlParams.get('cid')
          if (cid) {
            cardNumber = cid
          }
        }

        // 🔥 pegar imagem correta da carta
        const featuredImg = document.querySelector('#featuredImage') as HTMLImageElement | null
        const zoomDiv = document.querySelector('#container-zoom') as HTMLDivElement | null
        const metaImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null

        let cardImage = null

        if (featuredImg?.src) {
          cardImage = featuredImg.src
        } else if (zoomDiv?.style?.backgroundImage) {
          const match = zoomDiv.style.backgroundImage.match(/url\("?(.*?)"?\)/)
          cardImage = match ? match[1] : null
        } else if (metaImage?.content) {
          cardImage = metaImage.content
        }

        // corrigir URLs que começam com //
        if (cardImage && cardImage.startsWith('//')) {
          cardImage = 'https:' + cardImage
        }

        return {
          card_name: title,
          card_number: cardNumber,
          card_image: cardImage,
          link: window.location.href,
          rarity,
          preco_min: parse(prices[0]),
          preco_medio: parse(prices[1]),
          preco_max: parse(prices[2]),
          preco_normal: parse(prices[1]),
          preco_foil: prices[4] ? parse(prices[4]) : null,
          debug: null,
        }
      } catch (e) {
        return { debug: 'erro evaluate' }
      }
    })

    console.log('SCRAP RESULT:', data)

    return Response.json(data)
  } catch (err) {
    console.error('ERRO PUPPETEER:', err)
    return Response.json({ error: 'Erro ao buscar preço' }, { status: 500 })
  } finally {
    await browser.close()
  }
}