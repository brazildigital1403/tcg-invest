// Dimensao de jogo do catalogo. Pokemon e o default historico: todo dado
// anterior a coluna `game` e pokemon, e toda rota sem prefixo tambem.
export const GAMES = ['pokemon', 'lorcana'] as const
export type Game = (typeof GAMES)[number]

export const DEFAULT_GAME: Game = 'pokemon'

// Cookie de contexto do usuario (setado pelo seletor de jogo; F4).
export const GAME_COOKIE = 'bx_game'

export function isGame(v: unknown): v is Game {
  return typeof v === 'string' && (GAMES as readonly string[]).includes(v)
}

// Prefixo de chave de cache por jogo. Convencao da F1: TODO unstable_cache novo
// que leia catalogo usa gameCacheKey(game, 'minha-chave-v1'). Os caches antigos
// (pokedex-*) sao intrinsecos de pokemon e ficam como estao.
export function gameCacheKey(game: Game, key: string): string {
  return `${game}-${key}`
}
