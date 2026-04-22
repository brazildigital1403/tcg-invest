// Sistema de autenticação do painel admin
// - Cookie httpOnly com assinatura HMAC-SHA256 (Web Crypto)
// - Funciona tanto em Node runtime quanto em Edge runtime
// - Sessão de 7 dias

export const ADMIN_COOKIE   = 'bynx_admin'
export const ADMIN_MAX_AGE  = 60 * 60 * 24 * 7 // 7 dias em segundos

// ─── Assina / verifica payload com HMAC-SHA256 ──────────────────────────────

async function hmacSHA256(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  // Converte ArrayBuffer pra hex
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Comparação de strings em tempo constante (anti-timing attack) ──────────

function constTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// ─── Segredo usado pra assinar. Usa ADMIN_SECRET, ou cai no ADMIN_PASSWORD ──

function getSecret(): string {
  return process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || ''
}

// ─── Gera novo token admin ───────────────────────────────────────────────────

export async function makeAdminToken(): Promise<string> {
  const ts  = Date.now().toString()
  const sig = await hmacSHA256(ts, getSecret())
  return `${ts}.${sig}`
}

// ─── Verifica se o token é válido e não expirou ──────────────────────────────

export async function verifyAdminToken(token: string | undefined | null): Promise<boolean> {
  if (!token || typeof token !== 'string') return false
  const [ts, sig] = token.split('.')
  if (!ts || !sig) return false

  const age = Date.now() - Number(ts)
  if (!Number.isFinite(age) || age < 0 || age > ADMIN_MAX_AGE * 1000) return false

  const expected = await hmacSHA256(ts, getSecret())
  return constTimeEqual(sig, expected)
}

// ─── Compara senha em tempo constante ────────────────────────────────────────

export function verifyAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || ''
  if (!expected) return false
  if (!input || typeof input !== 'string') return false

  // Se forem tamanhos diferentes, retorna falso mas ainda gasta tempo equivalente
  if (input.length !== expected.length) {
    // Força comparação pra manter tempo constante
    let _noise = 0
    for (let i = 0; i < Math.max(input.length, expected.length); i++) _noise |= 0
    return false
  }
  return constTimeEqual(input, expected)
}