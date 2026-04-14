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
    await page.waitForSelector('body', { timeout: 10000 })
    await new Promise(res => setTimeout(res, 3000))

    const data = await page.evaluate(() => {
      const parse = (t: string | null | undefined) => {
        if (!t) return null
        const n = parseFloat(t.replace('R$', '').replace(/\./g, '').replace(',', '.').trim())
        return isNaN(n) ? null : n
      }

      try {
        // ✅ Nome da carta via og:title (inclui número)
        const metaTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
        const pageTitle = metaTitle || document.title || ''
        const title = pageTitle.split('|')[0].trim() || null

        // ✅ Número da carta
        const numberMatch = title?.match(/\(([^)]+)\)/)
        let cardNumber = numberMatch ? numberMatch[1] : null
        if (!cardNumber) {
          const cid = new URL(window.location.href).searchParams.get('cid')
          if (cid) cardNumber = cid
        }

        // ✅ Imagem da carta
        const featuredImg = document.querySelector('#featuredImage') as HTMLImageElement | null
        const zoomDiv = document.querySelector('#container-zoom') as HTMLDivElement | null
        const metaImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null
        let cardImage = null
        if (featuredImg?.src) {
          cardImage = featuredImg.src
        } else if (zoomDiv?.style?.backgroundImage) {
          const m = zoomDiv.style.backgroundImage.match(/url\("?(.*?)"?\)/)
          cardImage = m ? m[1] : null
        } else if (metaImage?.content) {
          cardImage = metaImage.content
        }
        if (cardImage?.startsWith('//')) cardImage = 'https:' + cardImage

        // ✅ Raridade
        let rarity = null
        const rarityEl = document.querySelector('[class*="raridade" i], [class*="rarity" i]')
        if (rarityEl?.textContent) rarity = rarityEl.textContent.trim()
        if (!rarity) {
          const rarityMatch = document.body.innerText.match(/Raridade:\s*(.+)/i)
          if (rarityMatch) rarity = rarityMatch[1].split('\n')[0].trim()
        }

        // ✅ Extrai TODAS as variantes de preço (Normal, Foil, Promo, Reverse, Pokeball)
        const variantMap: Record<string, string> = {
          extras_n: 'normal',
          extras_f: 'foil',
          extras_p: 'promo',
          extras_r: 'reverse',
          extras_pb: 'pokeball',
          extras_mf: 'master_foil',
        }

        const variants: Record<string, { min: number|null, medio: number|null, max: number|null, label: string }> = {}

        const priceContainers = document.querySelectorAll('.container-price-mkp')
        priceContainers.forEach(container => {
          const extrasEl = container.querySelector('[class*="extras_"]')
          if (!extrasEl) return

          const typeClass = Array.from(extrasEl.classList).find(c => c.startsWith('extras_'))
          if (!typeClass) return

          const varKey = variantMap[typeClass] || typeClass.replace('extras_', '')
          const label = container.querySelector('.container-extras span')?.textContent?.trim() || varKey

          const min = parse(container.querySelector('.min .price')?.textContent)
          const medio = parse(container.querySelector('.medium .price')?.textContent)
          const max = parse(container.querySelector('.max .price')?.textContent)

          if (medio !== null) {
            variants[varKey] = { min, medio, max, label }
          }
        })

        // Fallback: se não encontrou nenhuma variante pelo seletor novo,
        // tenta pelo método antigo (regex no texto)
        const hasVariants = Object.keys(variants).length > 0
        if (!hasVariants) {
          const target = Array.from(document.querySelectorAll('*')).find(el =>
            el.textContent?.includes('Preço Médio de Venda no Marketplace')
          )
          if (target) {
            const prices = target.textContent?.match(/R\$\s?[\d,.]+/g) || []
            if (prices.length >= 3) {
              variants['normal'] = {
                min: parse(prices[0]),
                medio: parse(prices[1]),
                max: parse(prices[2]),
                label: 'Normal'
              }
            }
          }
        }

        // Preços da variante principal (normal) para compatibilidade
        const normalVariant = variants['normal']
        const foilVariant = variants['foil']

        return {
          card_name: title,
          card_number: cardNumber,
          card_image: cardImage,
          link: window.location.href,
          rarity,
          // Campos legados (compatibilidade)
          preco_min: normalVariant?.min || null,
          preco_medio: normalVariant?.medio || null,
          preco_max: normalVariant?.max || null,
          preco_normal: normalVariant?.medio || null,
          preco_foil: foilVariant?.medio || null,
          // ✅ Novas variantes completas
          variantes: variants,
          debug: null,
        }
      } catch (e) {
        return { debug: 'erro evaluate' }
      }
    })

    console.log('SCRAP RESULT:', data)

    // ✅ Grava no banco se scraping teve sucesso
    if (data && !data.debug && data.card_name) {
      const supabaseAdmin = (await import('@supabase/supabase-js')).createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const variants = (data as any).variantes || {}

      // Upsert preço atual com todas as variantes
      await supabaseAdmin.from('card_prices').upsert({
        card_name: data.card_name,
        preco_min: variants.normal?.min || 0,
        preco_medio: variants.normal?.medio || 0,
        preco_max: variants.normal?.max || 0,
        preco_normal: variants.normal?.medio || 0,
        preco_foil: variants.foil?.medio || 0,
        // Variantes completas
        preco_foil_min: variants.foil?.min || null,
        preco_foil_medio: variants.foil?.medio || null,
        preco_foil_max: variants.foil?.max || null,
        preco_promo_min: variants.promo?.min || null,
        preco_promo_medio: variants.promo?.medio || null,
        preco_promo_max: variants.promo?.max || null,
        preco_reverse_min: variants.reverse?.min || null,
        preco_reverse_medio: variants.reverse?.medio || null,
        preco_reverse_max: variants.reverse?.max || null,
        preco_pokeball_min: variants.pokeball?.min || null,
        preco_pokeball_medio: variants.pokeball?.medio || null,
        preco_pokeball_max: variants.pokeball?.max || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'card_name' })

      // Insere no histórico com todas as variantes
      await supabaseAdmin.from('card_price_history').insert({
        card_name: data.card_name,
        preco_min: variants.normal?.min || null,
        preco_medio: variants.normal?.medio || null,
        preco_max: variants.normal?.max || null,
        preco_normal: variants.normal?.medio || null,
        preco_foil: variants.foil?.medio || null,
        preco_foil_min: variants.foil?.min || null,
        preco_foil_medio: variants.foil?.medio || null,
        preco_foil_max: variants.foil?.max || null,
        preco_promo_min: variants.promo?.min || null,
        preco_promo_medio: variants.promo?.medio || null,
        preco_promo_max: variants.promo?.max || null,
        preco_reverse_min: variants.reverse?.min || null,
        preco_reverse_medio: variants.reverse?.medio || null,
        preco_reverse_max: variants.reverse?.max || null,
        recorded_at: new Date().toISOString(),
      })
    }

    return Response.json(data)
  } catch (err) {
    console.error('ERRO PUPPETEER:', err)
    return Response.json({ error: 'Erro ao buscar preço' }, { status: 500 })
  } finally {
    await browser.close()
  }
}