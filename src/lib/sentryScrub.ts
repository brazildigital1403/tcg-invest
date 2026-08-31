/**
 * Limpeza de credencial antes do evento sair da maquina.
 *
 * POR QUE EXISTE
 * `sendDefaultPii: true` faz o SDK anexar os headers da requisicao ao evento.
 * O header `Authorization` carrega o JWT do Supabase -- a credencial de sessao
 * do usuario. Ha 24 arquivos no app mandando `Authorization: Bearer` pro
 * backend, entao qualquer erro numa dessas rotas leva o token junto.
 *
 * O Sentry aplica scrubbing do lado dele e o `Authorization` costuma estar na
 * lista padrao. Mas isso e configuracao que vive NUM PAINEL, fora do repo, que
 * qualquer pessoa com acesso pode mudar e que ninguem confere. Seguranca que
 * depende de um toggle remoto nao verificado e aposta, nao garantia. Aqui o
 * dado nem chega la.
 *
 * O QUE NAO SAI DAQUI, DE PROPOSITO
 * Mensagem, stack trace, arquivo, linha, rota, breadcrumbs e a identificacao do
 * usuario (`Sentry.setUser`, chamado explicitamente em analytics.ts). E isso que
 * faz o alerta ser util -- e nada disso e credencial. Token nunca ajudou a
 * entender por que uma tela quebrou.
 */

/** Headers que carregam credencial ou sessao. Comparados em minusculo. */
const HEADERS_PROIBIDOS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-supabase-auth',
  'apikey',
  'x-api-key',
  'proxy-authorization',
  'stripe-signature',
])

/** Campos de corpo/query que nao devem viajar mesmo em erro. */
const CAMPOS_PROIBIDOS = /^(password|senha|token|access_token|refresh_token|secret|api_?key|authorization|cookie)$/i

function limpaHeaders(headers: unknown): unknown {
  if (!headers || typeof headers !== 'object') return headers
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    out[k] = HEADERS_PROIBIDOS.has(k.toLowerCase()) ? '[removido pela Bynx]' : v
  }
  return out
}

function limpaCampos(obj: unknown, profundidade = 0): unknown {
  if (profundidade > 4 || !obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map((v) => limpaCampos(v, profundidade + 1))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = CAMPOS_PROIBIDOS.test(k) ? '[removido pela Bynx]' : limpaCampos(v, profundidade + 1)
  }
  return out
}

/**
 * Passa em `beforeSend` e `beforeSendTransaction`. Nunca lanca: se algo aqui
 * quebrar, o certo e o evento seguir sem a limpeza a perder o alerta inteiro --
 * mas o `catch` devolve o evento SEM request, que e onde mora o risco.
 */
export function limparEvento<T extends { request?: any; extra?: any }>(event: T): T {
  try {
    if (event?.request) {
      event.request = {
        ...event.request,
        headers: limpaHeaders(event.request.headers),
        cookies: undefined,
        data: limpaCampos(event.request.data),
      }
    }
    if (event?.extra) event.extra = limpaCampos(event.extra) as typeof event.extra
    return event
  } catch {
    if (event?.request) event.request = undefined
    return event
  }
}
