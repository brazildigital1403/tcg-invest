// Gera src/lib/pokedexEspecies.json: os dados dos JOGOS que a grade da Pokedex
// usa para filtrar (27/10/2026). Roda uma vez, e de novo so quando sair especie
// nova. O site nunca chama a PokeAPI em tempo de execucao para isso.
//
//   node scripts/gerar-pokedex-especies.mjs
//
// Formato (indexado pelo numero da Pokedex, nunca por nome):
//   { "37": { "t": ["fire"], "r": [["ice","alola"]], "c": "", "e": "b" }, ... }
//   t = tipos dos jogos da forma padrao (o selo da grade).
//   r = tipos a mais das formas regionais, com a regiao de cada um (Alola,
//       Galar, Hisui, Paldea). O filtro soma os dois, porque a grade junta
//       todas as formas no nome base (Vulpix de Alola e Gelo), e o card mostra
//       "Gelo · Alola" quando entra so por ela. Omitido quando vazio.
//   c = categorias: I inicial, L lendario, M mitico, U ultra besta, P paradoxo,
//       B bebe.
//   e = evolucao como no TCG: b basico, 1 estagio 1, 2 estagio 2, u nao evolui.
//       Bebe nao conta degrau (Pikachu e basico, Raichu e estagio 1).

import { writeFileSync } from 'node:fs'

const API = 'https://pokeapi.co/api/v2'
const TOTAL = 1025
const REGIONAIS = /-(alola|galar|hisui|paldea)/

const INICIAIS = [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501,
  650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912]
const ULTRA_BESTAS = [793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806]
const PARADOXOS = [984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995,
  1005, 1006, 1009, 1010, 1020, 1021, 1022, 1023]

async function get(url, tentativa = 1) {
  const r = await fetch(url)
  if (r.ok) return r.json()
  if (tentativa < 4) {
    await new Promise(ok => setTimeout(ok, 800 * tentativa))
    return get(url, tentativa + 1)
  }
  throw new Error(`${r.status} ${url}`)
}

async function emLotes(itens, tam, fn) {
  const out = []
  for (let i = 0; i < itens.length; i += tam) {
    out.push(...await Promise.all(itens.slice(i, i + tam).map(fn)))
    process.stdout.write(`\r${Math.min(i + tam, itens.length)}/${itens.length}`)
  }
  process.stdout.write('\n')
  return out
}

const idDaUrl = url => Number(url.split('/').filter(Boolean).pop())

const ids = Array.from({ length: TOTAL }, (_, i) => i + 1)

console.log('especies')
const especies = await emLotes(ids, 20, id => get(`${API}/pokemon-species/${id}`))

console.log('tipos')
const tipos = await emLotes(especies, 20, async sp => {
  const vars = sp.varieties.filter(v => v.is_default || REGIONAIS.test(v.pokemon.name))
  const padrao = []
  const extra = []
  for (const v of vars.sort((a, b) => Number(b.is_default) - Number(a.is_default))) {
    const p = await get(v.pokemon.url)
    for (const t of [...p.types].sort((a, b) => a.slot - b.slot)) {
      const n = t.type.name
      if (v.is_default) { if (!padrao.includes(n)) padrao.push(n) }
      else if (!padrao.includes(n) && !extra.some(x => x[0] === n)) extra.push([n, v.pokemon.name.match(REGIONAIS)[1]])
    }
  }
  return { padrao, extra }
})

console.log('cadeias')
const cadeiaUrls = [...new Set(especies.map(sp => sp.evolution_chain.url))]
const cadeias = new Map()
for (const c of await emLotes(cadeiaUrls, 20, url => get(url).then(j => [url, j]))) cadeias.set(c[0], c[1])

const bebe = new Set(especies.filter(sp => sp.is_baby).map(sp => sp.id))

// Degrau de cada especie dentro da cadeia, sem contar bebe; quantas especies
// nao-bebe a cadeia tem (1 = nao evolui).
const degrau = new Map()
const tamanho = new Map()
for (const cad of cadeias.values()) {
  const membros = []
  const andar = (no, d) => {
    const id = idDaUrl(no.species.url)
    const nd = bebe.has(id) ? d : d + 1
    membros.push(id)
    degrau.set(id, bebe.has(id) ? 0 : nd - 1)
    for (const filho of no.evolves_to) andar(filho, nd)
  }
  andar(cad.chain, 0)
  const adultos = membros.filter(id => !bebe.has(id)).length
  for (const id of membros) tamanho.set(id, adultos)
}

const saida = {}
especies.forEach((sp, i) => {
  const id = sp.id
  let c = ''
  if (INICIAIS.includes(id)) c += 'I'
  if (sp.is_legendary) c += 'L'
  if (sp.is_mythical) c += 'M'
  if (ULTRA_BESTAS.includes(id)) c += 'U'
  if (PARADOXOS.includes(id)) c += 'P'
  if (sp.is_baby) c += 'B'
  const d = degrau.get(id) ?? 0
  const e = sp.is_baby ? 'b' : (tamanho.get(id) ?? 1) <= 1 ? 'u' : d === 0 ? 'b' : d === 1 ? '1' : '2'
  saida[id] = tipos[i].extra.length
    ? { t: tipos[i].padrao, r: tipos[i].extra, c, e }
    : { t: tipos[i].padrao, c, e }
})

// Inicial vale para a linha inteira (Charizard tambem e de inicial).
for (const cad of cadeias.values()) {
  const membros = []
  const andar = no => { membros.push(idDaUrl(no.species.url)); no.evolves_to.forEach(andar) }
  andar(cad.chain)
  if (membros.some(id => INICIAIS.includes(id))) {
    for (const id of membros) if (saida[id] && !saida[id].c.includes('I')) saida[id].c = 'I' + saida[id].c
  }
}

writeFileSync(new URL('../src/lib/pokedexEspecies.json', import.meta.url), JSON.stringify(saida))
console.log('ok', Object.keys(saida).length)
