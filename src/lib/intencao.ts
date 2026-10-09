/**
 * src/lib/intencao.ts
 *
 * Intencao pendente de um visitante DESLOGADO numa pagina publica de carta:
 * "adicionar a minha colecao" ou "avisar quando anunciarem". Fica no
 * localStorage ate a pessoa ter sessao, e a pagina da carta aplica no
 * retorno (ver CardClient e WatchButton).
 *
 * ★ POR QUE EXISTE (08/10/2026): a pagina da carta nao tinha "Adicionar a
 * colecao" nem logada nem deslogada. Quem criava conta a partir dela voltava
 * pra mesma pagina publica sem nada para fazer -- 6 cadastros com landing
 * /carta, 1 com carta, 0 Pro, nenhum voltou depois do 1o dia. A intencao e
 * o que liga o cadastro ao objeto que trouxe a pessoa.
 *
 * O localStorage NAO e a unica via: o `next` do cadastro tambem carrega
 * `?add=<card_id>`, porque o e-mail de confirmacao pode abrir em outro
 * navegador (celular), onde este storage nao existe. Os dois caminhos
 * convergem no mesmo efeito do CardClient.
 */

const KEY = 'bx_intencao'
const VALIDADE_MS = 7 * 864e5

export type Intencao = {
  tipo: 'add' | 'watch'
  cardId: string
  slug: string
  variante?: string
  criadoEm: number
}

export function gravarIntencao(i: Omit<Intencao, 'criadoEm'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...i, criadoEm: Date.now() }))
  } catch {
    // storage indisponivel (modo restrito): o ?add= na URL cobre o caso
  }
}

export function lerIntencao(): Intencao | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const i = JSON.parse(raw) as Intencao
    if (!i?.cardId || !i?.tipo || Date.now() - (i.criadoEm || 0) > VALIDADE_MS) {
      limparIntencao()
      return null
    }
    return i
  } catch {
    return null
  }
}

export function limparIntencao(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nada a fazer
  }
}
