/**
 * Textos da Pokedex em portugues + a ficha da especie (PokeAPI).
 *
 * O catalogo guarda tipo e raridade em ingles (vem da API oficial do TCG), e a
 * tela mostrava "Grass" e "Special Illustration Rare" para um publico
 * brasileiro. A tela traduz na exibicao; os FILTROS continuam usando a chave
 * em ingles, que e o que esta no banco.
 */

// Cor por tipo de energia do TCG (a mesma de sempre da Pokedex).
export const TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  Fire:       { bg: 'rgba(239,68,68,0.15)',    text: '#ef4444' },
  Water:      { bg: 'rgba(96,165,250,0.15)',   text: '#60a5fa' },
  Grass:      { bg: 'rgba(34,197,94,0.15)',    text: '#22c55e' },
  Lightning:  { bg: 'rgba(245,158,11,0.15)',   text: '#f59e0b' },
  Psychic:    { bg: 'rgba(168,85,247,0.15)',   text: '#a855f7' },
  Fighting:   { bg: 'rgba(249,115,22,0.15)',   text: '#f97316' },
  Darkness:   { bg: 'rgba(107,114,128,0.15)',  text: '#9ca3af' },
  Metal:      { bg: 'rgba(148,163,184,0.15)',  text: '#94a3b8' },
  Dragon:     { bg: 'rgba(16,185,129,0.15)',   text: '#10b981' },
  Colorless:  { bg: 'rgba(209,213,219,0.1)',   text: '#d1d5db' },
  Fairy:      { bg: 'rgba(244,114,182,0.15)',  text: '#f472b6' },
  Normal:     { bg: 'rgba(209,213,219,0.1)',   text: '#d1d5db' },
}

// Tipo de ENERGIA do TCG (o que vem em pokemon_cards.types).
export const TIPO_TCG_PT: Record<string, string> = {
  Grass: 'Planta', Fire: 'Fogo', Water: 'Água', Lightning: 'Elétrico', Psychic: 'Psíquico',
  Fighting: 'Lutador', Darkness: 'Sombrio', Metal: 'Metal', Fairy: 'Fada', Dragon: 'Dragão',
  Colorless: 'Incolor', Normal: 'Normal',
}
export const tipoTcgPt = (t: string) => TIPO_TCG_PT[t] || t

// Tipo da ESPECIE (os 18 dos jogos, vindos da PokeAPI em minusculas). A cor
// reaproveita a paleta do tipo de energia equivalente (TYPE_COLOR da Pokedex).
export const TIPO_ESPECIE: Record<string, { pt: string; cor: string }> = {
  normal: { pt: 'Normal', cor: 'Colorless' }, fire: { pt: 'Fogo', cor: 'Fire' }, water: { pt: 'Água', cor: 'Water' },
  electric: { pt: 'Elétrico', cor: 'Lightning' }, grass: { pt: 'Planta', cor: 'Grass' }, ice: { pt: 'Gelo', cor: 'Water' },
  fighting: { pt: 'Lutador', cor: 'Fighting' }, poison: { pt: 'Veneno', cor: 'Psychic' }, ground: { pt: 'Terra', cor: 'Fighting' },
  flying: { pt: 'Voador', cor: 'Colorless' }, psychic: { pt: 'Psíquico', cor: 'Psychic' }, bug: { pt: 'Inseto', cor: 'Grass' },
  rock: { pt: 'Pedra', cor: 'Fighting' }, ghost: { pt: 'Fantasma', cor: 'Psychic' }, dragon: { pt: 'Dragão', cor: 'Dragon' },
  dark: { pt: 'Sombrio', cor: 'Darkness' }, steel: { pt: 'Aço', cor: 'Metal' }, fairy: { pt: 'Fada', cor: 'Fairy' },
}

// Raridade: as mais comuns no catalogo. O que nao estiver aqui sai como veio.
const RARIDADE_PT: Record<string, string> = {
  'Common': 'Comum', 'Uncommon': 'Incomum', 'Rare': 'Rara', 'Rare Holo': 'Rara Holo',
  'Rare Holo EX': 'Rara Holo EX', 'Rare Holo GX': 'Rara Holo GX', 'Rare Holo V': 'Rara Holo V',
  'Rare Holo VMAX': 'Rara Holo VMAX', 'Rare Holo VSTAR': 'Rara Holo VSTAR', 'Rare Ultra': 'Ultra Rara',
  'Rare Secret': 'Rara Secreta', 'Rare Rainbow': 'Rara Arco-íris', 'Rare Shiny': 'Rara Brilhante',
  'Rare Shiny GX': 'Rara Brilhante GX', 'Rare Holo Star': 'Rara Holo Estrela', 'Rare BREAK': 'Rara BREAK',
  'Rare Prime': 'Rara Prime', 'Rare Holo LV.X': 'Rara Holo LV.X', 'Rare ACE': 'Rara ACE',
  'Double Rare': 'Rara Dupla', 'Ultra Rare': 'Ultra Rara', 'Illustration Rare': 'Ilustração Rara',
  'Special Illustration Rare': 'Ilustração Especial Rara', 'Hyper Rare': 'Hiper Rara',
  'Shiny Rare': 'Rara Brilhante', 'Shiny Ultra Rare': 'Ultra Rara Brilhante', 'ACE SPEC Rare': 'Rara ACE SPEC',
  'Amazing Rare': 'Rara Incrível', 'Radiant Rare': 'Rara Radiante', 'Trainer Gallery Rare Holo': 'Galeria de Treinador',
  'Classic Collection': 'Coleção Clássica', 'Promo': 'Promo', 'LEGEND': 'LENDA',
}
export const raridadePt = (r?: string | null) => (r ? RARIDADE_PT[r] || r : null)

// Estagio (subtypes do TCG).
const SUBTIPO_PT: Record<string, string> = {
  'Basic': 'Básico', 'Stage 1': 'Estágio 1', 'Stage 2': 'Estágio 2', 'BREAK': 'BREAK', 'Mega': 'Mega',
  'Restored': 'Restaurado', 'Baby': 'Bebê', 'Level-Up': 'Nível Superior', 'TAG TEAM': 'TAG TEAM',
  'Single Strike': 'Golpe Único', 'Rapid Strike': 'Golpe Fluido', 'Fusion Strike': 'Golpe Fusão',
  'Tera': 'Tera', 'Ancient': 'Ancestral', 'Future': 'Futuro',
}
export const subtipoPt = (s: string) => SUBTIPO_PT[s] || s

// ─── Ficha da especie ─────────────────────────────────────────────────────────
// Tipos da especie, cadeia de evolucao (slugs da PokeAPI, ex. "mr-mime") e o
// texto da Pokedex em portugues quando existe. Vem da rota /api/pokedex/especie
// (servidor, cache de 7 dias). Cache por sessao aqui tambem: reabrir o mesmo
// Pokemon nao repete nem a chamada a rota.
export type FichaEspecie = { tipos: string[]; evolucao: string[]; texto: string | null }

export async function buscarFichaEspecie(dex: number): Promise<FichaEspecie | null> {
  if (!dex || dex <= 0) return null
  const chave = `bx-especie-${dex}`
  try { const c = sessionStorage.getItem(chave); if (c) return JSON.parse(c) as FichaEspecie } catch {}
  try {
    const r = await fetch(`/api/pokedex/especie?dex=${dex}`)
    if (!r.ok) return null
    const f = (await r.json()) as FichaEspecie
    try { sessionStorage.setItem(chave, JSON.stringify(f)) } catch {}
    return f
  } catch { return null }
}

/** "mr-mime" -> "mrmime": casa o slug da PokeAPI com o nome do catalogo ("Mr. Mime"). */
export const normalizarNome = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
