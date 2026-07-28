/**
 * src/lib/atribuicao.ts
 *
 * De onde veio o usuario. Capturado no primeiro pageview, lido no cadastro.
 *
 * POR QUE ISSO EXISTE
 * Ate 28/07/2026 a Bynx nao sabia responder "quantos cadastros vieram de
 * anuncio". O GA4 dizia 82% "(direct)/(none)" e o PostHog via 909 visitantes
 * para 134 cadastros — 14,7% de conversao, que e numero de denominador
 * quebrado, nao de funil. A causa: GTM e PostHog so ligam DEPOIS do aceite de
 * cookie, entao quem chega de anuncio e nao clica "Aceitar todos" nao e
 * medido por nenhum dos dois.
 *
 * A saida e nao depender deles: guardar a origem aqui e gravar na linha do
 * proprio `users` no cadastro. Dado primario, do nosso banco.
 *
 * FIRST vs LAST TOUCH
 * `first` nunca e sobrescrito — e como a pessoa DESCOBRIU a Bynx, e responde
 * "que canal traz gente nova". `last` e atualizado a cada visita com origem
 * externa — e o que estava carimbado quando ela decidiu criar conta. Canal de
 * consideracao longa aparece no first e some no last; os dois juntos contam a
 * historia inteira.
 *
 * ARMAZENAMENTO
 * localStorage, nao cookie: mesma persistencia, sem mandar bytes em todo
 * request (o publico e majoritariamente mobile em 4G). E dado primario de
 * primeira parte, usado so pra atribuir o proprio cadastro da pessoa.
 */

const CHAVE_FIRST = 'bx_attr_first'
const CHAVE_LAST = 'bx_attr_last'
const VALIDADE_DIAS = 90

export interface Atribuicao {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  referrer?: string
  landing_page?: string
  /** ISO. Quando esta origem foi vista. */
  visto_em?: string
}

/**
 * Click IDs que as plataformas carimbam SOZINHAS, sem ninguem configurar nada.
 *
 * Isso importa muito no estado atual: enquanto os anuncios nao tiverem UTM
 * padronizado, o `fbclid` sozinho ja prova que a visita veio do Meta. E o
 * unico sinal de trafego pago disponivel hoje — sem ele, esses cliques
 * continuariam indistinguiveis de trafego direto.
 */
const CLICK_IDS: Record<string, { source: string; medium: string }> = {
  fbclid: { source: 'facebook', medium: 'paid' },
  gclid: { source: 'google', medium: 'cpc' },
  gbraid: { source: 'google', medium: 'cpc' },
  wbraid: { source: 'google', medium: 'cpc' },
  ttclid: { source: 'tiktok', medium: 'paid' },
  msclkid: { source: 'bing', medium: 'cpc' },
  igshid: { source: 'instagram', medium: 'social' },
}

/** Referrers conhecidos -> (source, medium) quando nao ha utm nem click id. */
function classificarReferrer(host: string): { source: string; medium: string } | null {
  const h = host.replace(/^www\./, '').toLowerCase()
  if (/(^|\.)instagram\.com$/.test(h)) return { source: 'instagram', medium: 'social' }
  if (/(^|\.)(facebook|fb)\.com$/.test(h)) return { source: 'facebook', medium: 'social' }
  if (/(^|\.)l\.instagram\.com$/.test(h)) return { source: 'instagram', medium: 'social' }
  if (/(^|\.)tiktok\.com$/.test(h)) return { source: 'tiktok', medium: 'social' }
  if (/(^|\.)youtube\.com$/.test(h)) return { source: 'youtube', medium: 'social' }
  if (/(^|\.)(twitter|x)\.com$/.test(h)) return { source: 'twitter', medium: 'social' }
  if (/(^|\.)google\./.test(h)) return { source: 'google', medium: 'organic' }
  if (/(^|\.)bing\.com$/.test(h)) return { source: 'bing', medium: 'organic' }
  if (/(^|\.)duckduckgo\.com$/.test(h)) return { source: 'duckduckgo', medium: 'organic' }
  if (/(^|\.)(whatsapp|wa\.me)/.test(h)) return { source: 'whatsapp', medium: 'social' }
  if (/(^|\.)t\.co$/.test(h)) return { source: 'twitter', medium: 'social' }
  if (/(^|\.)linkedin\.com$/.test(h)) return { source: 'linkedin', medium: 'social' }
  if (/(^|\.)reddit\.com$/.test(h)) return { source: 'reddit', medium: 'social' }
  return { source: h, medium: 'referral' }
}

function ler(chave: string): (Atribuicao & { _exp?: number }) | null {
  try {
    const cru = window.localStorage.getItem(chave)
    if (!cru) return null
    const obj = JSON.parse(cru)
    if (obj?._exp && Date.now() > obj._exp) {
      window.localStorage.removeItem(chave)
      return null
    }
    return obj
  } catch {
    return null
  }
}

function gravar(chave: string, valor: Atribuicao) {
  try {
    window.localStorage.setItem(
      chave,
      JSON.stringify({ ...valor, _exp: Date.now() + VALIDADE_DIAS * 86400_000 }),
    )
  } catch {
    // Navegador em modo restrito / storage cheio. Atribuicao e best-effort:
    // nunca pode quebrar navegacao nem cadastro.
  }
}

/**
 * Le a URL atual + referrer e monta a origem. Retorna null quando a visita
 * nao tem NENHUM sinal externo (navegacao interna, ou digitou o endereco).
 * Retornar null e importante: sem isso, todo clique interno sobrescreveria o
 * last touch com "direct" e apagaria a origem real.
 */
function detectar(): Atribuicao | null {
  const url = new URL(window.location.href)
  const p = url.searchParams
  const pegar = (k: string) => p.get(k)?.trim().slice(0, 200) || undefined

  const utm_source = pegar('utm_source')
  const utm_medium = pegar('utm_medium')
  const utm_campaign = pegar('utm_campaign')
  const utm_content = pegar('utm_content')
  const utm_term = pegar('utm_term')

  const base: Atribuicao = {
    landing_page: (url.pathname + url.search).slice(0, 500),
    visto_em: new Date().toISOString(),
  }

  // 1) UTM explicito vence sempre — foi alguem carimbando de proposito.
  if (utm_source || utm_medium || utm_campaign) {
    return { ...base, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
             referrer: document.referrer?.slice(0, 500) || undefined }
  }

  // 2) Sem UTM, um click id de plataforma ja identifica a origem.
  for (const [param, origem] of Object.entries(CLICK_IDS)) {
    if (p.has(param)) {
      return { ...base, utm_source: origem.source, utm_medium: origem.medium,
               referrer: document.referrer?.slice(0, 500) || undefined }
    }
  }

  // 3) Sem nada na URL, sobra o referrer — desde que seja externo.
  const ref = document.referrer
  if (ref) {
    try {
      const rh = new URL(ref).hostname
      if (rh && rh !== window.location.hostname) {
        const c = classificarReferrer(rh)
        if (c) {
          return { ...base, utm_source: c.source, utm_medium: c.medium, referrer: ref.slice(0, 500) }
        }
      }
    } catch {
      // referrer malformado — ignora
    }
  }

  return null
}

/**
 * Chamada uma vez por pageview. Idempotente e barata.
 * NAO depende de consentimento de cookie de analytics: isso aqui nao alimenta
 * terceiro nenhum, so a nossa propria tabela `users` no momento do cadastro.
 */
export function capturarAtribuicao(): void {
  if (typeof window === 'undefined') return
  const atual = detectar()
  if (!atual) return

  if (!ler(CHAVE_FIRST)) gravar(CHAVE_FIRST, atual)
  gravar(CHAVE_LAST, atual)
}

/** Campos prontos pro insert em `users`. Retorna {} se nao houver nada. */
export function camposDeAtribuicao(): Record<string, string | null> {
  if (typeof window === 'undefined') return {}
  const f = ler(CHAVE_FIRST)
  const l = ler(CHAVE_LAST)
  if (!f && !l) return {}

  return {
    signup_utm_source: f?.utm_source ?? null,
    signup_utm_medium: f?.utm_medium ?? null,
    signup_utm_campaign: f?.utm_campaign ?? null,
    signup_utm_content: f?.utm_content ?? null,
    signup_utm_term: f?.utm_term ?? null,
    signup_referrer: f?.referrer ?? null,
    signup_landing_page: f?.landing_page ?? null,
    signup_first_seen_at: f?.visto_em ?? null,
    signup_last_utm_source: l?.utm_source ?? null,
    signup_last_utm_medium: l?.utm_medium ?? null,
    signup_last_utm_campaign: l?.utm_campaign ?? null,
  }
}
