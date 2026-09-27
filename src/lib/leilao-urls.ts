/**
 * Bynx Leiloes — UNICO lugar das URLs publicas do leilao.
 *
 * Toda tela, e-mail, aviso do sino e painel da loja monta o link por aqui.
 * Mudar um caminho do leilao = mudar so este arquivo. Funcoes puras: rodam no
 * servidor, no cliente e no autoteste (scripts/leilao-selftest.mjs).
 *
 * As rotas de API (/api/leiloes/...) ficam fora de proposito: sao contrato
 * interno, nao endereco que a pessoa ve ou compartilha.
 */

export const BASE_LEILOES = '/leiloes'

/** Abas da home da ferramenta (links ?aba=, sem JS). */
export type AbaLeiloes = 'ao-vivo' | 'agenda' | 'resultados' | 'como-funciona'

export const ABAS_LEILOES: ReadonlyArray<{ chave: AbaLeiloes; rotulo: string }> = [
  { chave: 'ao-vivo', rotulo: 'Ao vivo' },
  { chave: 'agenda', rotulo: 'Agenda' },
  { chave: 'resultados', rotulo: 'Resultados' },
  { chave: 'como-funciona', rotulo: 'Como funciona' },
]

/**
 * Aba da query. `encerrados` e o nome antigo de `resultados` (link ja
 * compartilhado continua abrindo a mesma aba).
 */
export function abaValida(v: unknown): AbaLeiloes {
  if (v === 'encerrados') return 'resultados'
  return v === 'agenda' || v === 'resultados' || v === 'como-funciona' ? v : 'ao-vivo'
}

/** Home da ferramenta. A aba padrao (ao vivo) fica sem query: e o canonico. */
export function urlHome(aba: AbaLeiloes = 'ao-vivo'): string {
  return aba === 'ao-vivo' ? BASE_LEILOES : `${BASE_LEILOES}?aba=${aba}`
}

/** Pagina publica de um lote: /leiloes/{carta}-{codigo}. */
export function urlLote(slug: string): string {
  return `${BASE_LEILOES}/${encodeURIComponent(slug)}`
}

/** Pagamento do arremate. `cancelado` = voltou do checkout sem pagar. */
export function urlPagar(slug: string, opts?: { cancelado?: boolean }): string {
  return `${urlLote(slug)}/pagar${opts?.cancelado ? '?cancelado=1' : ''}`
}

/** Pagina publica da rodada, pelo numero (curto, fixo): /leiloes/rodada/42. */
export function urlRodada(numero: number): string {
  return `${BASE_LEILOES}/rodada/${numero}`
}

/**
 * Area de quem da lance. `pagar` desce direto ate os arremates a pagar: a
 * ancora e o id da secao em src/app/leiloes/meus-lances/MeusLances.tsx
 * (`ml-${grupo}`). Mudou o id la, muda aqui.
 */
export function urlMeusLances(secao?: 'pagar'): string {
  return `${BASE_LEILOES}/meus-lances${secao === 'pagar' ? '#ml-a_pagar' : ''}`
}

// ─── Transmissao ────────────────────────────────────────────────────────────

const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/
const HOSTS_YOUTUBE = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])

/**
 * Id do VIDEO do YouTube num link de transmissao, ou null.
 *
 * Aceita watch?v=, youtu.be/{id}, /live/{id}, /embed/{id} e /shorts/{id}.
 * Link de CANAL (/@loja, /@loja/live, /channel/..., /c/...) nao tem id de
 * video: volta null e a pagina mostra so o botao que abre o link.
 */
export function idVideoYoutube(link: string | null | undefined): string | null {
  const s = (link ?? '').trim()
  if (!s) return null
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  if (u.username || u.password) return null
  const host = u.hostname.toLowerCase()
  const partes = u.pathname.split('/').filter(Boolean)

  let id: string | null = null
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = partes[0] ?? null
  } else if (HOSTS_YOUTUBE.has(host)) {
    if (partes[0] === 'watch') id = u.searchParams.get('v')
    else if (partes.length >= 2 && (partes[0] === 'live' || partes[0] === 'embed' || partes[0] === 'shorts')) id = partes[1]
  }
  return id && ID_VIDEO.test(id) ? id : null
}

/** Player sem cookie (a CSP ja libera www.youtube-nocookie.com). null se nao ha video. */
export function embedYoutube(link: string | null | undefined): string | null {
  const id = idVideoYoutube(link)
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
}
