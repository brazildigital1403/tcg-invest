import { supabase } from '@/lib/supabaseClient'

/** Rotulo e cor (token) de cada status de rodada no painel. */
export const STATUS_RODADA: Record<string, { label: string; cor: string }> = {
  rascunho: { label: 'Rascunho', cor: 'var(--bx-text-2)' },
  agendada: { label: 'Agendada', cor: 'var(--ac-1)' },
  ao_vivo: { label: 'Ao vivo', cor: 'var(--bx-red)' },
  encerrada: { label: 'Encerrada', cor: 'var(--bx-green)' },
  cancelada: { label: 'Cancelada', cor: 'var(--bx-text-3)' },
}

/** Erro de busca que estourou `timeoutMs` (a tela distingue de erro da rota). */
export class TempoEsgotado extends Error {
  constructor() { super('A busca demorou demais.') }
}

/**
 * fetch com o Bearer da sessao (padrao do painel da loja). Lanca com a mensagem da rota.
 * `timeoutMs`: aborta a busca inteira (sessao, request e corpo) e lanca TempoEsgotado.
 * `init.signal` continua valendo: abortado por fora, lanca o AbortError do fetch.
 */
export async function chamarPainel<T = Record<string, unknown>>(
  url: string, init: RequestInit = {}, opts: { timeoutMs?: number } = {},
): Promise<T> {
  const ctrl = new AbortController()
  const externo = init.signal ?? null
  const repassar = () => ctrl.abort(externo?.reason)
  if (externo) {
    if (externo.aborted) repassar()
    else externo.addEventListener('abort', repassar, { once: true })
  }
  let estourou = false
  const timer = opts.timeoutMs && opts.timeoutMs > 0
    ? setTimeout(() => { estourou = true; ctrl.abort() }, opts.timeoutMs)
    : null
  try {
    const { data } = await supabase.auth.getSession()
    if (ctrl.signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const token = data.session?.access_token || ''
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json'
    const r = await fetch(url, {
      ...init, signal: ctrl.signal,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    })
    const j = await r.json().catch(() => ({}))
    // Abortado no meio do corpo: o catch acima devolveu {}, que nao e resposta.
    if (ctrl.signal.aborted) throw new DOMException('Aborted', 'AbortError')
    if (!r.ok) throw new Error((j as { error?: string })?.error || 'Não foi possível concluir. Tente de novo.')
    return j as T
  } catch (e) {
    if (estourou) throw new TempoEsgotado()
    throw e
  } finally {
    if (timer) clearTimeout(timer)
    externo?.removeEventListener('abort', repassar)
  }
}

export interface RodadaResumo {
  id: string
  numero: number
  titulo: string | null
  descricao: string | null
  modo: string
  status: string
  inicia_em: string | null
  link_transmissao: string | null
  created_at: string
  lotes?: number
}

export interface LotePainel {
  id: string
  codigo: string
  slug: string
  ordem: number
  card_id: string | null
  card_slug: string | null
  card_name: string
  card_numero: string | null
  set_nome: string | null
  card_image: string | null
  fotos: string[]
  condicao: string | null
  idioma: string | null
  graduadora: string | null
  nota: string | null
  descricao: string | null
  lance_inicial_cents: number
  preco_atual_cents: number | null
  n_lances: number
  duracao_seg: number
  status: string
}
