import { NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const cardName = searchParams.get('name')

  if (!cardName) {
    return NextResponse.json({ error: 'Nome não enviado' })
  }

  // 🔎 CACHE
  const { data: cached, error: cacheError } = await supabase
    .from('card_prices')
    .select('*')
    .eq('card_name', cardName)
    .single()

  const TEN_MINUTES = 10 * 60 * 1000

  if (cached) {
    const updatedAt = cached.updated_at ? new Date(cached.updated_at).getTime() : 0
    const now = Date.now()

    const hasValidPrice = (
      cached.preco_normal !== null ||
      cached.preco_foil !== null ||
      cached.preco_min !== null ||
      cached.preco_medio !== null ||
      cached.preco_max !== null
    )

    // só usa cache se tiver preço válido
    if (hasValidPrice && (now - updatedAt < TEN_MINUTES)) {
      // 📈 salvar histórico mesmo usando cache
      try {
        await supabase
          .from('card_price_history')
          .insert([
            {
              card_name: cached.card_name,
              preco_normal: cached.preco_normal ?? null,
              preco_foil: cached.preco_foil ?? null,
              created_at: new Date().toISOString(),
            },
          ])
      } catch (e) {
        console.log('Erro ao salvar histórico (cache)')
      }

      return NextResponse.json({
        name: cached.card_name,
        precoMin: cached.preco_min ?? null,
        precoMedio: cached.preco_medio ?? null,
        precoMax: cached.preco_max ?? null,
        precoNormal: cached.preco_normal ?? null,
        precoFoil: cached.preco_foil ?? null,
        source: 'cache',
      })
    }

    console.log('CACHE EXPIRADO, VAI BUSCAR NOVO PREÇO...')
  }

  let browser = null
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()

    // 🔎 BUSCA INTELIGENTE VIA SEARCH (LigaPokemon)
    const searchUrl = `https://www.ligapokemon.com.br/?view=cards%2Fsearch&tipo=1&card=${encodeURIComponent(cardName)}`

    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
    })

    await new Promise(resolve => setTimeout(resolve, 3000))

    // 🧠 encontrar carta exata baseada em nome + número
    let selectedCardUrl = await page.evaluate((originalName) => {
      const cards = Array.from(document.querySelectorAll('a'))

      const match = originalName.match(/(.+)\s\((\d+)\/(\d+|∞)\)/)
      const targetName = match ? match[1].toLowerCase() : originalName.toLowerCase()
      const targetNum = match ? match[2] : null
      const targetTotal = match ? match[3] : null

      // filtrar apenas links de carta
      const cardLinks = cards.filter(link =>
        link.getAttribute('href')?.includes('view=cards/card')
      )

      // prioridade máxima: nome + número
      if (targetNum) {
        const exact = cardLinks.find(link => {
          const text = link.textContent || ''

          // match número normal ou promo (∞)
          const numberMatch = targetTotal === '∞'
            ? text.includes(`(${targetNum}/`) // aceita qualquer total
            : text.includes(`(${targetNum}/${targetTotal})`)

          // se tiver número, prioriza número (ignora idioma do nome)
          if (targetNum) {
            return numberMatch
          }

          // fallback: usa nome
          return text.toLowerCase().includes(targetName)
        })

        if (exact) return exact.getAttribute('href')
      }

      // fallback: só nome
      const byName = cardLinks.find(link => {
        const text = link.textContent || ''
        return text.toLowerCase().includes(targetName)
      })

      if (byName) return byName.getAttribute('href')

      return null
    }, cardName)

    if (!selectedCardUrl) {
      console.log('⚠️ Não encontrou carta exata, tentando fallback direto...')

      // fallback: tenta abrir busca simples sem número
      const baseName = cardName.split('(')[0].trim()

      const fallbackUrl = `https://www.ligapokemon.com.br/?view=cards%2Fsearch&tipo=1&card=${encodeURIComponent(baseName)}`

      await page.goto(fallbackUrl, { waitUntil: 'networkidle2' })
      await new Promise(resolve => setTimeout(resolve, 3000))

      const fallbackCard = await page.evaluate(() => {
        const link = document.querySelector('a[href*="view=cards/card"]')
        return link ? link.getAttribute('href') : null
      })

      if (!fallbackCard) {
        throw new Error('Carta não encontrada nem no fallback')
      }

      selectedCardUrl = fallbackCard
    }

    // navegar para a carta correta
    await page.goto(`https://www.ligapokemon.com.br/${selectedCardUrl}`, {
      waitUntil: 'networkidle2',
    })

    await new Promise(resolve => setTimeout(resolve, 3000))

    // Aceitar cookies se aparecer
    try {
      const buttons = await page.$$('button')
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn)
        if (text && text.toUpperCase().includes('COOKIES')) {
          await btn.click()
          break
        }
      }
    } catch (e) {}

    // Clicar na aba Marketplace (onde os preços aparecem)
    try {
      await page.waitForSelector('body', { timeout: 10000 })

      const clicked = await page.evaluate((originalName) => {
        const links = Array.from(document.querySelectorAll('a'))

        // tenta extrair número da carta (ex: 93/147)
        const match = originalName.match(/\((\d+)\/(\d+|∞)\)/)
        const targetNum = match ? match[1] : null
        const targetTotal = match ? match[2] : null

        // prioridade 1: link que contém o número correto
        if (targetNum) {
          const exact = links.find(link => {
            const text = link.textContent || ''

            const numberMatch = targetTotal === '∞'
              ? text.includes(`(${targetNum}/`)
              : text.includes(`(${targetNum}/${targetTotal})`)

            if (targetNum) {
              return numberMatch && link.getAttribute('href')?.includes('view=cards/card')
            }

            return link.getAttribute('href')?.includes('view=cards/card')
          })

          if (exact) {
            (exact as HTMLElement).click()
            return true
          }
        }

        // fallback: primeiro link de carta
        const fallback = links.find(link =>
          link.getAttribute('href')?.includes('view=cards/card')
        )

        if (fallback) {
          (fallback as HTMLElement).click()
          return true
        }

        return false
      }, cardName)

      if (!clicked) {
        console.log('Marketplace não encontrado')
      }
    } catch (e) {
      console.log('Erro ao clicar na aba Marketplace')
    }

    // pequena espera para renderização
    await page.waitForSelector('body', { timeout: 15000 }).catch(() => {})
    await new Promise(resolve => setTimeout(resolve, 3000))

    const data = await page.evaluate(() => {
      const parse = (t) => {
        if (!t) return null
        return parseFloat(
          t.replace('R$', '')
           .replace(/\./g, '')
           .replace(',', '.')
           .trim()
        )
      }

      const result = {
        precoMin: null,
        precoMedio: null,
        precoMax: null,
        precoNormal: null,
        precoFoil: null,
        debug: null,
      }

      // 🔎 encontra a seção "Preço Médio de Venda"
      const blocks = Array.from(document.querySelectorAll('div'))
      let targetBlock = null

      for (const block of blocks) {
        const txt = (block.innerText || '').toLowerCase()
        if (txt.includes('preço médio de venda') || txt.includes('preco medio de venda')) {
          targetBlock = block
          break
        }
      }

      if (!targetBlock) {
        result.debug = 'Bloco de preço não encontrado'
        return result
      }

      const text = targetBlock.innerText || ''
      const matches = text.match(/R\$\s?[\d,.]+/g)

      if (matches && matches.length >= 3) {
        result.precoMin = parse(matches[0])
        result.precoMedio = parse(matches[1])
        result.precoMax = parse(matches[2])

        // compatibilidade com sistema atual
        result.precoNormal = result.precoMin
        result.precoFoil = result.precoMax
      } else {
        // fallback: pega quaisquer preços visíveis no bloco
        if (matches && matches.length > 0) {
          result.precoMin = parse(matches[0])
          result.precoMedio = matches[1] ? parse(matches[1]) : null
          result.precoMax = matches[2] ? parse(matches[2]) : null
          result.precoNormal = result.precoMin
          result.precoFoil = result.precoMax
        } else {
          result.debug = 'Não encontrou preços no bloco'
        }
      }

      return result
    })


    // 📈 salvar histórico de preço
    try {
      await supabase
        .from('card_price_history')
        .insert([
          {
            card_name: cardName,
            preco_normal: data.precoNormal ?? null,
            preco_foil: data.precoFoil ?? null,
            created_at: new Date().toISOString(),
          },
        ])
    } catch (e) {
      console.log('Erro ao salvar histórico (não crítico)')
    }

    // salvar no banco
    const { error: upsertError, data: upsertData } = await supabase
      .from('card_prices')
      .upsert([
        {
          card_name: cardName,
          number: null,
          tipo: null,
          edicao: null,
          raridade: null,
          artista: null,
          preco_min: data.precoMin ?? null,
          preco_medio: data.precoMedio ?? null,
          preco_max: data.precoMax ?? null,
          preco_normal: data.precoNormal ?? null,
          preco_foil: data.precoFoil ?? null,
          updated_at: new Date().toISOString(),
        },
      ], { onConflict: 'card_name' })
      .select()

    if (upsertError) {
      console.error('SUPABASE INSERT ERROR:', upsertError)
    } else {
      console.log('SALVO NO SUPABASE:', upsertData)
    }

    const hasPrice = data.precoNormal !== null || data.precoFoil !== null

    return NextResponse.json({
      name: cardName,
      precoMin: data.precoMin ?? null,
      precoMedio: data.precoMedio ?? null,
      precoMax: data.precoMax ?? null,
      precoNormal: data.precoNormal ?? null,
      precoFoil: data.precoFoil ?? null,
      debug: data.debug ?? null,
      source: hasPrice ? 'puppeteer' : 'puppeteer_no_price',
    })
  } catch (error) {
    console.error('PUPPETEER ERROR:', error)

    // 🔥 fallback: salva mesmo com erro
    try {
      await supabase
        .from('card_prices')
        .upsert([
          {
            card_name: cardName,
            preco_min: null,
            preco_medio: null,
            preco_max: null,
            preco_normal: null,
            preco_foil: null,
            updated_at: new Date().toISOString(),
          },
        ], { onConflict: 'card_name' })
    } catch (e) {
      console.log('Erro ao salvar fallback')
    }

    return NextResponse.json({
      error: 'Erro com puppeteer',
      details: String(error)
    }, { status: 500 })
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch (e) {
        console.log('Erro ao fechar browser')
      }
    }
  }
}