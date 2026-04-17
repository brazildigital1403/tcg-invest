/**
 * Faz scraping da LigaPokemon DIRETAMENTE NO BROWSER do usuário.
 * O browser do usuário tem IP residencial — sem bloqueio do Cloudflare!
 */
export async function scrapeCardFromBrowser(url: string): Promise<{
  card_name: string | null
  card_number: string | null
  card_image: string | null
  link: string
  rarity: string | null
  preco_min: number | null
  preco_medio: number | null
  preco_max: number | null
  preco_normal: number | null
  preco_foil: number | null
  variantes: Record<string, { min: number | null; medio: number | null; max: number | null }>
} | { error: string }> {
  try {
    // Busca a página direto no browser do usuário — sem CORS porque é mesmo domínio de destino
    const res = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Cache-Control': 'no-cache',
      },
      // Sem credentials — evita bloqueio por CORS preflight
      credentials: 'omit',
    })

    if (!res.ok) {
      return { error: `Erro ao acessar a página: ${res.status}` }
    }

    const html = await res.text()

    // Verifica se bloqueou
    const BLOCKED = ['just a moment', 'access denied', 'checking your browser']
    const lowerHtml = html.toLowerCase().slice(0, 2000)
    if (BLOCKED.some(b => lowerHtml.includes(b))) {
      return { error: 'Página bloqueada. Tente novamente em alguns segundos.' }
    }

    // Parse do HTML via DOMParser do browser
    const parse = (t: string | null | undefined): number | null => {
      if (!t) return null
      const n = parseFloat(t.replace('R$', '').replace(/\./g, '').replace(',', '.').trim())
      return isNaN(n) ? null : n
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Nome da carta
    const metaTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || ''
    const card_name = metaTitle.split('|')[0].trim() || doc.title.split('|')[0].trim() || null

    if (!card_name) return { error: 'Não foi possível identificar a carta. Verifique o link.' }

    // Número
    const numberMatch = card_name?.match(/\(([^)]+)\)/)
    const card_number = numberMatch?.[1] || new URL(url).searchParams.get('cid') || null

    // Imagem
    const metaImg = doc.querySelector('meta[property="og:image"]')?.getAttribute('content')
    const featuredImg = (doc.querySelector('#featuredImage') as HTMLImageElement)?.src
    let card_image = featuredImg || metaImg || null
    if (card_image?.startsWith('//')) card_image = 'https:' + card_image

    // Raridade
    const bodyText = doc.body?.innerText || doc.body?.textContent || ''
    const rarityMatch = bodyText.match(/Raridade:\s*(.+)/i)
    const rarity = rarityMatch?.[1]?.split('\n')[0]?.trim() || null

    // Preços por variante
    const varMap: Record<string, string> = {
      extras_n: 'normal', extras_f: 'foil', extras_p: 'promo', extras_r: 'reverse'
    }
    const variantes: Record<string, { min: number | null; medio: number | null; max: number | null }> = {}

    for (const [cls, name] of Object.entries(varMap)) {
      const el = doc.querySelector(`[class*="${cls}"]`)
      if (!el) continue
      let anc = el.parentElement
      for (let i = 0; i < 5; i++) {
        if (!anc) break
        const prices = (anc.textContent || '').match(/R\$\s*[\d.,]+/g)
        if (prices && prices.length >= 1) {
          const nums = prices.map(p => parse(p)).filter((n): n is number => n !== null)
          if (nums.length) {
            variantes[name] = { min: nums[0], medio: nums[1] ?? nums[0], max: nums[2] ?? nums[1] ?? nums[0] }
          }
          break
        }
        anc = anc.parentElement
      }
    }

    // Fallback: pega qualquer preço se não achou variantes
    if (!variantes.normal) {
      const allPrices = (doc.body?.textContent || '').match(/R\$\s*[\d.,]+/g)
      if (allPrices) {
        const nums = allPrices.map(p => parse(p)).filter((n): n is number => n !== null)
        if (nums.length) {
          variantes.normal = { min: nums[0], medio: nums[1] ?? nums[0], max: nums[2] ?? nums[1] ?? nums[0] }
        }
      }
    }

    const normal = variantes.normal || { min: null, medio: null, max: null }
    const foil = variantes.foil || { min: null, medio: null, max: null }

    return {
      card_name,
      card_number,
      card_image,
      link: url,
      rarity,
      preco_min: normal.min,
      preco_medio: normal.medio,
      preco_max: normal.max,
      preco_normal: normal.medio,
      preco_foil: foil.medio,
      variantes,
    }
  } catch (err: any) {
    return { error: err.message || 'Erro ao buscar a página' }
  }
}