import { cookies } from 'next/headers'
import { DEFAULT_GAME, GAME_COOKIE, isGame, type Game } from './game'

// Resolucao do jogo no SERVIDOR (usa next/headers — nao importar em client
// component; constantes client-safe vivem em ./game). Ordem de prioridade:
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
