/**
 * Rate limit por IP, em memoria.
 *
 * A mecanica ja existia copiada em 3 rotas (cards/lookup, pokedex/browse,
 * lojas/[id]/track-click). Este arquivo existe pra nao virar a 4a e a 5a copia
 * — as 3 antigas continuam com a versao local delas de proposito (migrar mexe
 * em rota que esta funcionando; fica pra quando alguem tocar nelas por outro
 * motivo).
 *
 * ★ LIMITACAO REAL, ler antes de confiar: o contador vive na MEMORIA DA
 * INSTANCIA. Em serverless cada lambda tem o seu, e a Vercel escala sob carga —
 * ou seja, isto e um speed-bump contra rajada de um IP so, NAO um limite global.
 * Um atacante distribuido passa. A camada definitiva e edge (Vercel Firewall /
 * WAF), que ainda nao esta configurada.
 *
 * Serve pro que precisa servir hoje: impedir que UM script queime a cota de um
 * provedor terceiro ou empilhe conexao no Postgres — que foi exatamente o vetor
 * do apagao de 29/07 (rota sem teto segurando conexao ate o pool estourar).
 */

interface Registro {
  count: number
  resetAt: number
}

export interface Limitador {
  /** true = o IP passou do teto na janela atual (deve levar 429). */
  excedeu(ip: string): boolean
  /** Limpa entradas vencidas. Chamar antes de `excedeu` em rota de trafego alto. */
  gc(): void
}

/** Teto de IPs distintos guardados antes de valer a pena varrer o mapa. */
const GC_LIMIAR = 5000

export function criarLimitador({ janelaMs, max }: { janelaMs: number; max: number }): Limitador {
  const hits = new Map<string, Registro>()

  return {
    excedeu(ip: string): boolean {
      const agora = Date.now()
      const reg = hits.get(ip)
      if (!reg || agora > reg.resetAt) {
        hits.set(ip, { count: 1, resetAt: agora + janelaMs })
        return false
      }
      reg.count++
      return reg.count > max
    },

    gc(): void {
      if (hits.size < GC_LIMIAR) return
      const agora = Date.now()
      for (const [k, v] of hits) {
        if (agora > v.resetAt) hits.delete(k)
      }
    },
  }
}

/**
 * IP do cliente. Atras da Vercel o real vem no `x-forwarded-for`; o primeiro
 * item da lista e o cliente, o resto sao os proxies.
 *
 * Devolve null quando nao da pra identificar — a rota decide o que fazer. Nas
 * nossas, `null` PASSA: bloquear quem nao tem IP legivel derrubaria trafego
 * legitimo por um header ausente.
 */
export function ipDaRequest(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const primeiro = xff.split(',')[0]?.trim()
    if (primeiro) return primeiro
  }
  return req.headers.get('x-real-ip') || null
}
