import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  // ✅ Verificação de autenticação
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

  // ✅ Validação de segurança: só aceita URLs da LigaPokemon
  let parsedUrl: URL
  try {
    parsedUrl = new URL(targetUrl)
  } catch {
    return Response.json({ error: 'URL inválida' }, { status: 400 })
  }

  const dominiosPermitidos = ['ligapokemon.com.br', 'www.ligapokemon.com.br']
  if (!dominiosPermitidos.includes(parsedUrl.hostname)) {
    return Response.json(
      { error: 'URL não permitida. Apenas links da LigaPokemon são aceitos.' },
      { status: 403 }
    )
  }

  const url = parsedUrl.toString()

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

        // 🔥 pegar nome da carta — usa document.title pois o h1 não inclui o número
        const metaTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
        const pageTitle = metaTitle || document.title || ''
        // extrai só o nome com número: "Bulbasaur (064/063) | ..." → "Bulbasaur (064/063)"
        const title = pageTitle.split('|')[0].trim() || null

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

    // ✅ Grava no histórico de preços sempre que fizer scraping
    if (data && !data.debug && data.card_name) {
      const supabaseAdmin = (await import('@supabase/supabase-js')).createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      await supabaseAdmin.from('card_price_history').insert({
        card_name: data.card_name,
        preco_min: data.preco_min || null,
        preco_medio: data.preco_medio || null,
        preco_max: data.preco_max || null,
        preco_normal: data.preco_normal || null,
        preco_foil: data.preco_foil || null,
        recorded_at: new Date().toISOString(),
      })

      // Atualiza também o preço atual na card_prices
      await supabaseAdmin.from('card_prices').upsert({
        card_name: data.card_name,
        preco_min: data.preco_min || 0,
        preco_medio: data.preco_medio || 0,
        preco_max: data.preco_max || 0,
        preco_normal: data.preco_normal || 0,
        preco_foil: data.preco_foil || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'card_name' })
    }

    return Response.json(data)
  } catch (err) {
    console.error('ERRO PUPPETEER:', err)
    return Response.json({ error: 'Erro ao buscar preço' }, { status: 500 })
  } finally {
    await browser.close()
  }
}