import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')

  if (!name) {
    return NextResponse.json({ image: null })
  }

  try {
    const match = name.match(/\(([^)]+)\)/)
    const number = match ? match[1] : null
    const numOnly = number ? number.split('/')[0] : null

    if (!numOnly) {
      return NextResponse.json({ image: null })
    }

    // 🔥 busca direta usando num (muito mais confiável)
    const url = `https://www.ligapokemon.com.br/?view=cards/search&tipo=1&card=${numOnly}`

    const res = await fetch(url)
    const html = await res.text()

    // 🔎 pega imagem direto do HTML
    const imgMatch = html.match(/img class="main-card"[^>]*src="([^"]+)"/)

    let image = imgMatch ? imgMatch[1] : null

    if (image && image.startsWith('//')) {
      image = 'https:' + image
    }

    return NextResponse.json({ image })
  } catch (err) {
    console.log('Erro imagem:', err)
    return NextResponse.json({ image: null })
  }
}