import puppeteer from 'puppeteer'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')

  if (!name) {
    return Response.json({ error: 'Nome não informado' }, { status: 400 })
  }

  const url = `https://www.ligapokemon.com.br/?view=cards/card&card=${encodeURIComponent(name)}`

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

        return {
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