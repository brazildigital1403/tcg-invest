// Filtros da grade da Pokedex (27/10/2026, formato do Mercado).
//
// Os dados dos JOGOS (18 tipos, categoria, evolucao) vem de um JSON estatico
// gerado por scripts/gerar-pokedex-especies.mjs, indexado pelo numero da
// Pokedex. Nada aqui chama banco nem API: a grade inteira ja filtra no cliente.
//
// O tipo do TCG (energia da carta) saiu da grade de proposito: o Gengar e
// Fantasma no jogo e Psiquico na carta, e os dois juntos confundiam. Ele segue
// nas cartas de cada Pokemon.

import ESPECIES from './pokedexEspecies.json'

type Especie = { t: string[]; r?: string[]; c: string; e: string }
const DADOS = ESPECIES as Record<string, Especie>

export function especie(dex: number): Especie | null {
  return DADOS[String(dex)] || null
}

/** Tipos para o filtro: forma padrao mais as regionais. */
export function tiposDoFiltro(dex: number): string[] {
  const e = especie(dex)
  return e ? [...e.t, ...(e.r || [])] : []
}

export const REGIOES: { id: string; gen: string; nome: string }[] = [
  { id: 'kanto', gen: 'I', nome: 'Kanto' },
  { id: 'johto', gen: 'II', nome: 'Johto' },
  { id: 'hoenn', gen: 'III', nome: 'Hoenn' },
  { id: 'sinnoh', gen: 'IV', nome: 'Sinnoh' },
  { id: 'unova', gen: 'V', nome: 'Unova' },
  { id: 'kalos', gen: 'VI', nome: 'Kalos' },
  { id: 'alola', gen: 'VII', nome: 'Alola' },
  { id: 'galar', gen: 'VIII', nome: 'Galar' },
  { id: 'paldea', gen: 'IX', nome: 'Paldea' },
]

/** Ordem dos 18 tipos na gaveta (a mesma dos jogos). */
export const TIPOS_JOGO = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
]

export const CATEGORIAS: { id: string; letra: string; nome: string }[] = [
  { id: 'inicial', letra: 'I', nome: 'Inicial' },
  { id: 'lendario', letra: 'L', nome: 'Lendário' },
  { id: 'mitico', letra: 'M', nome: 'Mítico' },
  { id: 'ultra-besta', letra: 'U', nome: 'Ultra Besta' },
  { id: 'paradoxo', letra: 'P', nome: 'Paradoxo' },
  { id: 'bebe', letra: 'B', nome: 'Bebê' },
]

export const EVOLUCOES: { id: string; letra: string; nome: string }[] = [
  { id: 'basico', letra: 'b', nome: 'Básico' },
  { id: 'estagio-1', letra: '1', nome: 'Estágio 1' },
  { id: 'estagio-2', letra: '2', nome: 'Estágio 2' },
  { id: 'nao-evolui', letra: 'u', nome: 'Não evolui' },
]

export const FAIXAS_CARTAS: { id: string; nome: string; min: number; max: number }[] = [
  { id: 'ate-10', nome: 'Até 10', min: 0, max: 10 },
  { id: '11-a-50', nome: '11 a 50', min: 11, max: 50 },
  { id: '51-a-200', nome: '51 a 200', min: 51, max: 200 },
  { id: 'mais-de-200', nome: 'Mais de 200', min: 201, max: Infinity },
]

export const ORDENS: { id: string; nome: string }[] = [
  { id: 'numero', nome: 'Nº da Pokédex' },
  { id: 'nome', nome: 'Nome (A-Z)' },
  { id: 'cartas', nome: 'Mais cartas' },
]

export type Status = 'todos' | 'tenho' | 'faltam'

export type FiltrosPokedex = {
  regiao: string        // id de REGIOES ou ''
  tipos: string[]       // ids de TIPOS_JOGO (qualquer um deles)
  categorias: string[]  // ids de CATEGORIAS (qualquer uma delas)
  evolucao: string      // id de EVOLUCOES ou ''
  cartas: string        // id de FAIXAS_CARTAS ou ''
}

export const FILTROS_VAZIOS: FiltrosPokedex = { regiao: '', tipos: [], categorias: [], evolucao: '', cartas: '' }

export function contarFiltros(f: FiltrosPokedex): number {
  return (f.regiao ? 1 : 0) + f.tipos.length + f.categorias.length + (f.evolucao ? 1 : 0) + (f.cartas ? 1 : 0)
}

type PokemonGrade = { name: string; dexId: number; generation: string; card_count?: number }

/** Dimensao a ignorar, para contar quantos sobram em cada opcao. */
export type Dimensao = keyof FiltrosPokedex | 'busca' | 'status' | null

export function passa(
  p: PokemonGrade,
  f: FiltrosPokedex,
  busca: string,
  status: Status,
  tenho: boolean,
  ignorar: Dimensao = null,
): boolean {
  if (ignorar !== 'busca' && busca) {
    const q = busca.trim().toLowerCase().replace(/^#/, '')
    if (/^\d+$/.test(q)) { if (p.dexId !== Number(q)) return false }
    else if (!p.name.toLowerCase().includes(q)) return false
  }
  if (ignorar !== 'status') {
    if (status === 'tenho' && !tenho) return false
    if (status === 'faltam' && tenho) return false
  }
  const e = especie(p.dexId)
  if (ignorar !== 'regiao' && f.regiao) {
    const r = REGIOES.find(x => x.id === f.regiao)
    if (r && p.generation !== r.gen) return false
  }
  if (ignorar !== 'tipos' && f.tipos.length) {
    const t = tiposDoFiltro(p.dexId)
    if (!f.tipos.some(x => t.includes(x))) return false
  }
  if (ignorar !== 'categorias' && f.categorias.length) {
    const letras = CATEGORIAS.filter(c => f.categorias.includes(c.id)).map(c => c.letra)
    if (!e || !letras.some(l => e.c.includes(l))) return false
  }
  if (ignorar !== 'evolucao' && f.evolucao) {
    const ev = EVOLUCOES.find(x => x.id === f.evolucao)
    if (!e || !ev || e.e !== ev.letra) return false
  }
  if (ignorar !== 'cartas' && f.cartas) {
    const fx = FAIXAS_CARTAS.find(x => x.id === f.cartas)
    const n = p.card_count || 0
    if (fx && (n < fx.min || n > fx.max)) return false
  }
  return true
}

// ── URL: ?tipo=ghost,poison&regiao=kanto&categoria=lendario&evolucao=basico
//         &cartas=ate-10&status=faltam&ordem=nome ─────────────────────────────

const lista = (v: string | null, validos: string[]) =>
  (v || '').split(',').map(s => s.trim()).filter(s => validos.includes(s))
const um = (v: string | null, validos: string[]) => (v && validos.includes(v) ? v : '')

export function lerDaUrl(search: string): { filtros: FiltrosPokedex; status: Status; ordem: string } {
  const sp = new URLSearchParams(search)
  return {
    filtros: {
      regiao: um(sp.get('regiao'), REGIOES.map(r => r.id)),
      tipos: lista(sp.get('tipo'), TIPOS_JOGO),
      categorias: lista(sp.get('categoria'), CATEGORIAS.map(c => c.id)),
      evolucao: um(sp.get('evolucao'), EVOLUCOES.map(e => e.id)),
      cartas: um(sp.get('cartas'), FAIXAS_CARTAS.map(c => c.id)),
    },
    status: (um(sp.get('status'), ['tenho', 'faltam']) || 'todos') as Status,
    ordem: um(sp.get('ordem'), ORDENS.map(o => o.id)) || 'numero',
  }
}

/** Grava na URL atual sem navegar; os demais parametros ficam como estavam. */
export function gravarNaUrl(f: FiltrosPokedex, status: Status, ordem: string): void {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    const pares: [string, string][] = [
      ['regiao', f.regiao], ['tipo', f.tipos.join(',')], ['categoria', f.categorias.join(',')],
      ['evolucao', f.evolucao], ['cartas', f.cartas],
      ['status', status === 'todos' ? '' : status], ['ordem', ordem === 'numero' ? '' : ordem],
    ]
    for (const [k, v] of pares) {
      if (v) url.searchParams.set(k, v)
      else url.searchParams.delete(k)
    }
    const novo = url.pathname + url.search + url.hash
    if (novo !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(window.history.state, '', novo)
    }
  } catch { /* URL invalida: deixa como esta */ }
}
