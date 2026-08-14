/**
 * src/lib/sinais.ts — captura de sinal de carta (procurada / acessada).
 *
 * Client-only. Manda evento pra /api/marketplace/sinais-carta, que e o unico
 * caminho ate a RPC registrar_sinal_carta (as tabelas estao trancadas: RLS
 * ligada, zero policy, so service_role escreve).
 *
 * O QUE SAI DAQUI: tipo do evento, card_id, um uuid de primeira parte que
 * rotaciona a cada 24h, e 1 byte de classificacao de origem.
 * O QUE NUNCA SAI: o referrer (so a classificacao dele), user_id, e-mail,
 * nada de identidade. O IP nem e gravado do outro lado.
 *
 * Best-effort de ponta a ponta: nunca await, nunca bloqueia UX, nunca
 * levanta. Sinal que nao gravou e sinal perdido, e tudo bem -- o que nao
 * pode e a pagina sentir.
 */

type TipoSinal = 'view_pub' | 'view_app' | 'busca_troca' | 'busca_colecao'

const CHAVE_VID = 'bx_vid'
const VALIDADE_MS = 24 * 60 * 60 * 1000

/** Fallback pra quando localStorage lanca (Safari privado) -- some no reload. */
let vidEfemero: string | null = null

/** Ja mandado nesta sessao: evita repetir o mesmo evento no mesmo carregamento. */
const jaEnviado = new Set<string>()

function novoUuid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    // Ambiente sem crypto.randomUUID (webview antiga): serve, porque o valor
    // so precisa ser opaco e estavel por 24h, nao criptografico.
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
  }
}

function visitanteId(): string {
  try {
    const cru = localStorage.getItem(CHAVE_VID)
    if (cru) {
      const { v, exp } = JSON.parse(cru) as { v: string; exp: number }
      if (v && typeof exp === 'number' && Date.now() < exp) return v
    }
    const v = novoUuid()
    localStorage.setItem(CHAVE_VID, JSON.stringify({ v, exp: Date.now() + VALIDADE_MS }))
    return v
  } catch {
    // localStorage e NAO sessionStorage de proposito: sessionStorage e por
    // ABA, entao comparar 3 cartas em 3 abas viraria 3 "visitantes".
    if (!vidEfemero) vidEfemero = novoUuid()
    return vidEfemero
  }
}

/** Classifica a origem em 1 byte. O referrer em si nunca sai do browser. */
export function origemDaNavegacao(): 0 | 1 | 3 {
  try {
    const ref = document.referrer
    if (!ref) return 3
    const url = new URL(ref)
    if (url.origin !== window.location.origin) return 0
    const proprias = ['/minha-colecao', '/dashboard-financeiro', '/acompanhando', '/comparador']
    return proprias.some(p => url.pathname.startsWith(p)) ? 1 : 0
  } catch {
    return 0
  }
}

export function registrarSinal(tipo: TipoSinal, cardId: string, origem: 0 | 1 | 3 = 0): void {
  if (typeof window === 'undefined') return
  if (!cardId) return

  const chave = `${tipo}:${cardId}`
  if (jaEnviado.has(chave)) return

  try {
    fetch('/api/marketplace/sinais-carta', {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo, cardId, vid: visitanteId(), origem }),
    })
      .then(r => {
        // Marca SO depois do ok. Marcar antes faria o evento sumir pra sempre
        // quando a rota descarta por rate-limit -- e o vies seria sistematico
        // contra as sessoes mais ativas, que sao justamente as que carregam
        // o sinal.
        if (r.ok) jaEnviado.add(chave)
      })
      .catch(() => {})
  } catch {
    /* nunca deixa tracking derrubar a pagina */
  }
}
