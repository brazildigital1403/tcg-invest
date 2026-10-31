/**
 * Envio de e-mails em lote com isolamento do item ruim. Funcao pura (o
 * provedor entra por callback) para o autoteste rodar sem rede:
 * scripts/leilao-selftest.mjs.
 *
 * Regras:
 *  - Itens com o mesmo `grupo` (ex.: o id do evento) vao SEMPRE no mesmo lote.
 *    So um grupo maior que o tamanho do lote e partido (nao acontece no
 *    leilao: no maximo 2 e-mails por evento).
 *  - O lote do provedor e tudo-ou-nada. Recusa de CONTEUDO (validation_error,
 *    invalid_parameter, missing_required_field) divide o lote ao meio, por
 *    grupo, recursivamente, ate isolar o grupo culpado; dentro dele, envio um a
 *    um. So o item ruim sai com erro, os outros saem enviados.
 *  - Erro que nao e de conteudo (rate limit, 5xx, rede) marca o lote inteiro:
 *    dividir so multiplicaria chamadas contra um provedor que ja esta recusando.
 *  - Envio unitario leva a `chave` de idempotencia do item. Chave ja usada
 *    com outro conteudo (invalid_idempotent_request) = aquele e-mail ja saiu
 *    antes, conta como enviado.
 *  - `unitario: true` no item manda o grupo inteiro um a um (com chave). O
 *    leilao usa em evento que ja falhou antes: e o que faz a chave valer no
 *    retry (o lote do provedor nao tem chave por item).
 *  - `deveParar()` e checado antes de CADA chamada; o que sobra sai como
 *    'sem_tempo' (o chamador devolve para a fila sem gastar tentativa).
 */

export interface EmailLoteItem {
  to: string
  subject: string
  html: string
  /** Mesmo grupo = mesmo lote (nunca partido entre lotes). */
  grupo?: string | number
  /** Chave de idempotencia do envio unitario. */
  chave?: string
  /** Manda o grupo um a um (com chave), fora do lote. */
  unitario?: boolean
}

export type RespostaEnvio = { ok: true } | { ok: false; nome?: string; erro: string }

export interface RemetenteEmail {
  lote(itens: EmailLoteItem[]): Promise<RespostaEnvio>
  um(item: EmailLoteItem): Promise<RespostaEnvio>
}

/** Resultado por mensagem, na mesma ordem da entrada. */
export interface ResultadoEmail {
  ok: boolean
  /** 'sem_tempo' = nao foi tentado (orcamento acabou). */
  erro?: string
}

export const ERROS_DE_CONTEUDO = new Set(['validation_error', 'invalid_parameter', 'missing_required_field'])
const JA_ENVIADO = 'invalid_idempotent_request'

/** Agrupa indices por `grupo` (ordem da 1a aparicao). Sem grupo = grupo proprio. */
export function agrupar(itens: EmailLoteItem[]): number[][] {
  const mapa = new Map<string, number[]>()
  const out: number[][] = []
  itens.forEach((it, i) => {
    if (it.grupo === undefined || it.grupo === null) { out.push([i]); return }
    const k = String(it.grupo)
    let g = mapa.get(k)
    if (!g) { g = []; mapa.set(k, g); out.push(g) }
    g.push(i)
  })
  return out
}

/** Empacota grupos inteiros em lotes de ate `tamanho` itens. */
export function empacotar(grupos: number[][], tamanho: number): number[][][] {
  const lotes: number[][][] = []
  let atual: number[][] = []
  let n = 0
  for (const g of grupos) {
    if (g.length > tamanho) {
      // Unico caso de grupo partido: nao cabe em lote nenhum.
      if (atual.length) { lotes.push(atual); atual = []; n = 0 }
      for (let i = 0; i < g.length; i += tamanho) lotes.push([g.slice(i, i + tamanho)])
      continue
    }
    if (n + g.length > tamanho && atual.length) { lotes.push(atual); atual = []; n = 0 }
    atual.push(g)
    n += g.length
  }
  if (atual.length) lotes.push(atual)
  return lotes
}

export async function enviarIsolando(
  itens: EmailLoteItem[],
  remetente: RemetenteEmail,
  opts: {
    tamanho?: number
    deveParar?: () => boolean
    /** Pausa entre chamadas consecutivas (limite de requisicoes do provedor). */
    pausaMs?: number
    esperar?: (ms: number) => Promise<void>
  } = {},
): Promise<ResultadoEmail[]> {
  const tamanho = Math.max(1, Math.min(opts.tamanho ?? 100, 100))
  const pausaMs = Math.max(0, opts.pausaMs ?? 0)
  const esperar = opts.esperar ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)))
  const res: ResultadoEmail[] = itens.map(() => ({ ok: false, erro: 'nao_tentado' }))
  let chamadas = 0

  const antesDeChamar = async (): Promise<boolean> => {
    if (opts.deveParar?.()) return false
    if (chamadas > 0 && pausaMs > 0) await esperar(pausaMs)
    if (opts.deveParar?.()) return false
    chamadas++
    return true
  }
  const marcar = (idx: number[], r: ResultadoEmail) => { for (const i of idx) res[i] = { ...r } }
  const chamar = async (f: () => Promise<RespostaEnvio>): Promise<RespostaEnvio> => {
    try {
      return await f()
    } catch (err) {
      return { ok: false, erro: (err as Error)?.message || 'excecao no envio' }
    }
  }

  const umAUm = async (idx: number[]) => {
    for (const i of idx) {
      if (!(await antesDeChamar())) { res[i] = { ok: false, erro: 'sem_tempo' }; continue }
      const r = await chamar(() => remetente.um(itens[i]))
      if (r.ok || r.nome === JA_ENVIADO) res[i] = { ok: true }
      else res[i] = { ok: false, erro: fmt(r) }
    }
  }

  const tentarLote = async (grupos: number[][]): Promise<void> => {
    const idx = grupos.flat()
    if (idx.length === 0) return
    if (idx.length === 1) return umAUm(idx)
    if (!(await antesDeChamar())) { marcar(idx, { ok: false, erro: 'sem_tempo' }); return }
    const r = await chamar(() => remetente.lote(idx.map(i => itens[i])))
    if (r.ok) { marcar(idx, { ok: true }); return }
    if (!r.nome || !ERROS_DE_CONTEUDO.has(r.nome)) { marcar(idx, { ok: false, erro: fmt(r) }); return }
    if (grupos.length > 1) {
      const meio = Math.ceil(grupos.length / 2)
      await tentarLote(grupos.slice(0, meio))
      await tentarLote(grupos.slice(meio))
      return
    }
    await umAUm(idx)
  }

  const grupos = agrupar(itens)
  const unitarios = grupos.filter(g => g.some(i => itens[i].unitario))
  const emLote = grupos.filter(g => !g.some(i => itens[i].unitario))
  for (const lote of empacotar(emLote, tamanho)) await tentarLote(lote)
  for (const g of unitarios) await umAUm(g)
  return res
}

function fmt(r: { ok: false; nome?: string; erro: string }): string {
  return r.nome ? `${r.nome}: ${r.erro}` : r.erro
}
