/**
 * Indique e Ganhe — utilitários client-side e server-side.
 *
 * Centraliza:
 *   • Captura/leitura do ref_code (URL ?ref=XXXX → localStorage)
 *   • Geração de fingerprint do dispositivo (anti auto-indicação)
 *   • Validação de email descartável (mailinator etc)
 *   • Helpers de formatação de pontos
 */

const REF_STORAGE_KEY = 'bynx_ref'
const REF_TTL_DAYS = 7

interface StoredRef {
  code: string
  capturedAt: number
}

export function captureRefCodeFromURL(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const url = new URL(window.location.href)
    const raw = url.searchParams.get('ref')
    if (!raw) return null

    const code = raw.trim().toUpperCase()
    if (!/^BYN[A-HJ-NP-Z2-9]{5}$/.test(code)) return null

    const data: StoredRef = { code, capturedAt: Date.now() }
    window.localStorage.setItem(REF_STORAGE_KEY, JSON.stringify(data))
    return code
  } catch {
    return null
  }
}

export function readStoredRefCode(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(REF_STORAGE_KEY)
    if (!raw) return null

    const data: StoredRef = JSON.parse(raw)
    const ageDays = (Date.now() - data.capturedAt) / (1000 * 60 * 60 * 24)

    if (ageDays > REF_TTL_DAYS) {
      window.localStorage.removeItem(REF_STORAGE_KEY)
      return null
    }

    return data.code || null
  } catch {
    return null
  }
}

export function clearStoredRefCode(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(REF_STORAGE_KEY)
  } catch {}
}

/**
 * Gera hash estável (32 chars) do dispositivo pra detectar auto-indicação.
 * Combina UA, lang, screen, timezone e hardware concurrency.
 */
export function getFingerprint(): string {
  if (typeof window === 'undefined') return ''

  try {
    const parts = [
      navigator.userAgent,
      navigator.language || '',
      `${screen.width}x${screen.height}`,
      `${screen.colorDepth || 0}`,
      String(new Date().getTimezoneOffset()),
      String((navigator as any).hardwareConcurrency || 0),
    ]
    const raw = parts.join('|')
    return btoa(raw).replace(/[+/=]/g, '').slice(0, 32)
  } catch {
    return ''
  }
}

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'guerrillamail.net',
  'guerrillamail.org', 'guerrillamail.biz', 'guerrillamail.de',
  'sharklasers.com', 'grr.la', 'spam4.me',
  '10minutemail.com', '10minutemail.net', '20minutemail.com',
  'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'tempmail.com', 'temp-mail.org', 'tempmail.dev', 'tempmail.io',
  'tempinbox.com', 'tempemail.com', 'tempemail.net',
  'throwawaymail.com', 'getnada.com', 'maildrop.cc',
  'mintemail.com', 'mytrashmail.com', 'mailnesia.com',
  'inbox.lv', 'mt2014.com', 'tmail.ws', 'spambog.com',
  'mailcatch.com', 'trashmail.com', 'trashmail.net', 'trashmail.io',
  'discard.email', 'discardmail.com', 'mohmal.com',
  'fakeinbox.com', 'fake-mail.ml', 'fakemailgenerator.com',
  'emailondeck.com', 'emailisvalid.com', 'temporarymail.com',
  'mailtemp.com', 'meltmail.com', 'mailshell.com',
  'spamgourmet.com', 'spamavert.com',
  'incognitomail.com', 'incognitomail.net',
  'mailtothis.com', 'temp-link.net',
  'jetable.org', 'monemail.fr.nf',
  'cock.li', 'dropmail.me',
  'getairmail.com', 'getmails.eu',
])

export function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false
  const domain = email.split('@')[1].toLowerCase().trim()
  return DISPOSABLE_DOMAINS.has(domain)
}

export function formatPoints(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n || 0)
}

export function getNextTierPoints(qualifiedCount: number): number {
  if (qualifiedCount === 0) return 30
  if (qualifiedCount === 1) return 50
  if (qualifiedCount === 2) return 70
  return 100
}

export function buildShareLink(refCode: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'
  return `${base}/?ref=${encodeURIComponent(refCode)}`
}

export function buildShareMessage(refCode: string): string {
  const link = buildShareLink(refCode)
  return `Tô usando o Bynx pra organizar minha coleção de Pokémon TCG e tá MUITO bom 🎴 Cadastra com meu link e ganha 7 dias de Pro grátis: ${link}`
}