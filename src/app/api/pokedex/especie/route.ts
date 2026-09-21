import { NextResponse } from 'next/server'

/**
 * GET /api/pokedex/especie?dex=3
 *
 * Ficha da especie para o cabecalho da Pokedex: os dois tipos ("Planta ·
 * Veneno"), a cadeia de evolucao e o texto da Pokedex em portugues quando
 * existe. Vem da PokeAPI, que nao esta no connect-src da CSP -- por isso passa
 * por aqui, no servidor, em vez de o navegador chamar direto.
 *
 * Dado de especie nao muda: o fetch fica em cache de 7 dias. Falha da PokeAPI
 * devolve 502 e a tela segue sem a ficha (cabecalho so com o que o catalogo tem).
 */
const SETE_DIAS = 60 * 60 * 24 * 7

type No = { species: { name: string }; evolves_to: No[] }

async function pegar(url: string) {
  const r = await fetch(url, { next: { revalidate: SETE_DIAS } })
  if (!r.ok) throw new Error(`${url} -> ${r.status}`)
  return r.json()
}

export async function GET(req: Request) {
  const dex = Number(new URL(req.url).searchParams.get('dex'))
  if (!Number.isInteger(dex) || dex < 1 || dex > 1025) {
    return NextResponse.json({ erro: 'dex_invalido' }, { status: 400 })
  }
  try {
    const [esp, pk] = await Promise.all([
      pegar(`https://pokeapi.co/api/v2/pokemon-species/${dex}`),
      pegar(`https://pokeapi.co/api/v2/pokemon/${dex}`),
    ])
    const tipos: string[] = (pk.types || [])
      .sort((a: { slot: number }, b: { slot: number }) => a.slot - b.slot)
      .map((t: { type: { name: string } }) => t.type.name)
    // Texto da Pokedex: so em portugues. Em ingles nao entra (a tela e em portugues).
    const pt = (esp.flavor_text_entries || []).find((f: { language: { name: string } }) => /^pt/.test(f.language?.name || ''))
    const texto = pt ? String(pt.flavor_text).replace(/[\n\f\r]+/g, ' ').trim() : null
    let evolucao: string[] = []
    if (esp.evolution_chain?.url) {
      const ch = await pegar(esp.evolution_chain.url)
      // Evolucao ramificada (Eevee) mostra o caminho que passa pela especie aberta.
      const caminhos: string[][] = []
      const andar = (n: No, acc: string[]) => {
        const at = [...acc, n.species.name]
        if (!n.evolves_to?.length) caminhos.push(at)
        else n.evolves_to.forEach(f => andar(f, at))
      }
      if (ch?.chain) andar(ch.chain as No, [])
      // Todos os caminhos que passam pela especie, sem repetir nome: Eevee
      // mostra as 8 evolucoes; Vaporeon mostra so Eevee > Vaporeon.
      const alvo = String(esp.name)
      const passam = caminhos.filter(c => c.includes(alvo))
      evolucao = [...new Set((passam.length ? passam : caminhos.slice(0, 1)).flat())]
    }
    return NextResponse.json({ tipos, evolucao, texto }, {
      headers: { 'Cache-Control': `public, s-maxage=${SETE_DIAS}, stale-while-revalidate=86400` },
    })
  } catch (e) {
    console.error('[api/pokedex/especie]', (e as Error).message)
    return NextResponse.json({ erro: 'pokeapi_indisponivel' }, { status: 502 })
  }
}
