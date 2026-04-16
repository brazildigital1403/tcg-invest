import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  // Verificação de autenticação
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
    return Response.json({ error: 'URL não permitida. Apenas links da LigaPokemon são aceitos.' }, { status: 403 })
  }

  try {
    // Busca o HTML da página com headers de browser real
    const res = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      return Response.json({ error: `Erro ao acessar LigaPokemon: ${res.status}` }, { status: 502 })
    }

    const html = await res.text()

    // Parser de HTML com regex
    const parse = (t: string | null | undefined): number | null => {
      if (!t) return null
      const n = parseFloat(t.replace('R$', '').replace(/\./g, '').replace(',', '.').trim())
      return isNaN(n) ? null : n
    }

    const getTag = (tag: string, attr: string, html: string): string | null => {
      const re = new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["']`, 'i')
      return html.match(re)?.[1] || null
    }

    const getMetaProp = (prop: string): string | null => {
      const re = new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i')
      const re2 = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${prop}["']`, 'i')
      return html.match(re)?.[1] || html.match(re2)?.[1] || null
    }

    // Nome da carta
    const metaTitle = getMetaProp('og:title')
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
    const rawTitle = metaTitle || titleMatch?.[1] || ''
    const card_name = rawTitle.split('|')[0].trim() || null

    // Número da carta
    const numberMatch = card_name?.match(/\(([^)]+)\)/)
    const cidParam = parsedUrl.searchParams.get('cid')
    const card_number = numberMatch?.[1] || cidParam || null

    // Imagem
    let card_image = getMetaProp('og:image')
    if (card_image?.startsWith('//')) card_image = 'https:' + card_image

    // Raridade
    const rarityMatch = html.match(/Raridade[:\s]*<[^>]+>([^<]+)<\/|Raridade[:\s]+([^\n<]+)/i)
    const rarity = rarityMatch?.[1]?.trim() || rarityMatch?.[2]?.trim() || null

    // Extrai preços — busca padrões de R$ no HTML
    const extractPrices = (varClass: string): { min: number|null, medio: number|null, max: number|null } => {
      const re = new RegExp(`class=["'][^"']*${varClass}[^"']*["'][^>]*>([\\s\\S]{0,500})`, 'i')
      const block = html.match(re)?.[1] || ''
      const prices = block.match(/R\$\s*[\d.,]+/g)?.map(p => parse(p)).filter((n): n is number => n !== null) || []
      return {
        min: prices[0] ?? null,
        medio: prices[1] ?? prices[0] ?? null,
        max: prices[2] ?? prices[1] ?? prices[0] ?? null,
      }
    }

    const normal = extractPrices('extras_n')
    const foil   = extractPrices('extras_f')
    const promo  = extractPrices('extras_p')

    // Fallback geral — pega primeiros preços encontrados
    if (!normal.min) {
      const allPrices = html.match(/R\$\s*[\d.,]+/g)?.map(p => parse(p)).filter((n): n is number => n !== null) || []
      if (allPrices.length >= 1) {
        normal.min   = allPrices[0]
        normal.medio = allPrices[1] ?? allPrices[0]
        normal.max   = allPrices[2] ?? allPrices[1] ?? allPrices[0]
      }
    }

    const data = {
      card_name,
      card_number,
      card_image,
      link: parsedUrl.toString(),
      rarity,
      preco_min: normal.min,
      preco_medio: normal.medio,
      preco_max: normal.max,
      preco_normal: normal.medio,
      preco_foil: foil.medio,
      variantes: { normal, foil, promo },
    }

    // Salva no banco
    if (data.card_name) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      )

      await supabaseAdmin.from('card_prices').upsert({
        card_name: data.card_name,
        preco_min: normal.min || 0,
        preco_medio: normal.medio || 0,
        preco_max: normal.max || 0,
        preco_normal: normal.medio || 0,
        preco_foil: foil.medio || 0,
        preco_foil_min: foil.min,
        preco_foil_medio: foil.medio,
        preco_foil_max: foil.max,
        preco_promo_min: promo.min,
        preco_promo_medio: promo.medio,
        preco_promo_max: promo.max,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'card_name' })

      await supabaseAdmin.from('card_price_history').insert({
        card_name: data.card_name,
        preco_min: normal.min,
        preco_medio: normal.medio,
        preco_max: normal.max,
        preco_normal: normal.medio,
        preco_foil: foil.medio,
        recorded_at: new Date().toISOString(),
      })
    }

    return Response.json(data)

  } catch (err: any) {
    console.error('ERRO scraping:', err.message)
    return Response.json({ error: 'Erro ao buscar dados da carta' }, { status: 500 })
  }
}