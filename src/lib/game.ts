import { cookies } from 'next/headers'

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

// Resolucao do jogo no servidor, em ordem de prioridade:
// 1. URL (rota prefixada, ex: /lorcana/...) — o chamador passa quando souber;
// 2. cookie bx_game (contexto escolhido no seletor);
// 3. default pokemon.
// users.default_game entra no login (seta o cookie), nao aqui — evitar query por request.
export async function getGame(fromUrl?: string): Promise<Game> {
  if (isGame(fromUrl)) return fromUrl
  try {
    const jar = await cookies()
    const c = jar.get(GAME_COOKIE)?.value
    if (isGame(c)) return c
  } catch {
    // fora de contexto de request (build/ISR sem cookies) — cai no default
  }
  return DEFAULT_GAME
}

// Prefixo de chave de cache por jogo. Convencao da F1: TODO unstable_cache novo
// que leia catalogo usa gameCacheKey(game, 'minha-chave-v1'). Os caches antigos
// (pokedex-*) sao intrinsecos de pokemon e ficam como estao.
export function gameCacheKey(game: Game, key: string): string {
  return `${game}-${key}`
}
