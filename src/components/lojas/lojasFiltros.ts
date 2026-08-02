// Estado de filtro do Guia de Lojas e helpers compartilhados entre o hero
// (busca) e a sidebar/gaveta (estado, tipo, especialidade) -- ambos escrevem
// na mesma URL, entao a montagem da querystring vive num lugar so.

export interface FiltrosLojasState {
  q: string
  estado: string
  tipo: string
  especialidade: string
}

export interface OpcaoFiltro {
  value: string
  label: string
  count: number
}

export function buildLojasUrl(f: FiltrosLojasState): string {
  const params = new URLSearchParams()
  if (f.q) params.set('q', f.q)
  if (f.estado) params.set('estado', f.estado)
  if (f.tipo) params.set('tipo', f.tipo)
  if (f.especialidade) params.set('especialidade', f.especialidade)
  const qs = params.toString()
  return qs ? `/lojas?${qs}` : '/lojas'
}

export const TIPO_LABEL: Record<string, string> = {
  fisica: 'Física',
  online: 'Online',
  ambas: 'Física + Online',
}
export const TIPOS_ORDEM = ['fisica', 'online', 'ambas']

export const ESPECIALIDADE_LABEL: Record<string, string> = {
  pokemon: 'Pokémon',
  magic: 'Magic',
  yugioh: 'Yu-Gi-Oh!',
  lorcana: 'Lorcana',
  digimon: 'Digimon',
  outros: 'Outros',
}
export const ESPECIALIDADES_ORDEM = ['pokemon', 'magic', 'yugioh', 'lorcana', 'digimon', 'outros']
