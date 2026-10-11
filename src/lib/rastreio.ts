/**
 * Codigo de rastreio: validacao por transportadora. Funcoes PURAS, cobertas
 * por scripts/reclamacao-selftest.mjs. Vale para TODO o marketplace (loja,
 * pessoa fisica e leilao): quem chama e marcarEnviado (lib/pedidoVendedor).
 *
 * ★ POR QUE (11/10): o envio so exigia 8 caracteres e "qualquer numero"
 *   passava. O comprador ficava sem rastreio de verdade, e numa reclamacao de
 *   "nao chegou" a prova da loja virava palavra contra palavra.
 *
 * ★ REGRA POR TRANSPORTADORA (pesquisa de 11/10):
 *   - Correios: padrao S10 da UPU, 2 letras + 8 digitos + digito verificador
 *     + 2 letras (AA123456789BR). Validacao COMPLETA, com o digito.
 *   - As demais (Jadlog, Loggi, J&T, Azul Cargo, LATAM Cargo, Buslog, outra):
 *     nao ha regra publica confiavel (a Loggi pelo Melhor Envio usa
 *     "LGI-ME...BR", a Azul Cargo "AZL-AK" + numeros; Jadlog e J&T sem
 *     fonte firme). Conferencia de FORMA so: letras, numeros e hifen, 8 a 30
 *     caracteres, pelo menos 6 digitos, e nada de sequencia boba (00000000,
 *     12345678). Endurecer quando houver codigos reais de cada uma.
 */

export const TRANSPORTADORAS = {
  correios: 'Correios',
  jadlog: 'Jadlog',
  loggi: 'Loggi',
  jt: 'J&T Express',
  azul: 'Azul Cargo',
  latam: 'LATAM Cargo',
  buslog: 'Buslog',
  outra: 'Outra',
} as const
export type Transportadora = keyof typeof TRANSPORTADORAS
export const LISTA_TRANSPORTADORAS = Object.keys(TRANSPORTADORAS) as Transportadora[]

export function ehTransportadora(v: unknown): v is Transportadora {
  return typeof v === 'string' && (LISTA_TRANSPORTADORAS as string[]).includes(v)
}

/**
 * Codigo dos Correios (S10). Aceita espaco e minuscula; devolve normalizado
 * ou null se o formato ou o digito nao bate.
 * Digito: pesos 8,6,4,2,3,5,9,7; r = 11 - soma % 11; 10 -> 0, 11 -> 5.
 */
export function validarRastreioCorreios(v: unknown): string | null {
  const s = typeof v === 'string' ? v.replace(/[\s.-]/g, '').toUpperCase() : ''
  const m = /^([A-Z]{2})(\d{8})(\d)([A-Z]{2})$/.exec(s)
  if (!m) return null
  const pesos = [8, 6, 4, 2, 3, 5, 9, 7]
  const soma = [...m[2]].reduce((acc, d, i) => acc + Number(d) * pesos[i], 0)
  let dv = 11 - (soma % 11)
  if (dv === 10) dv = 0
  else if (dv === 11) dv = 5
  return dv === Number(m[3]) ? s : null
}

/** Sequencia que ninguem recebe de transportadora: tudo igual ou em escada. */
function sequenciaBoba(digitos: string): boolean {
  if (/^(\d)\1+$/.test(digitos)) return true
  const asc = '01234567890123456789'
  const desc = '98765432109876543210'
  return digitos.length >= 6 && (asc.includes(digitos) || desc.includes(digitos))
}

export type RastreioValidado = { ok: true; codigo: string } | { ok: false; erro: string }

export function validarRastreioEnvio(transportadora: unknown, codigo: unknown): RastreioValidado {
  if (!ehTransportadora(transportadora)) return { ok: false, erro: 'Escolha a transportadora do envio.' }
  if (transportadora === 'correios') {
    const c = validarRastreioCorreios(codigo)
    return c ? { ok: true, codigo: c }
      : { ok: false, erro: 'Código dos Correios inválido. Confira: são 2 letras, 9 números e 2 letras, como AA123456789BR.' }
  }
  const s = typeof codigo === 'string' ? codigo.replace(/\s/g, '').toUpperCase() : ''
  if (s.length < 8 || s.length > 30 || !/^[A-Z0-9-]+$/.test(s)) {
    return { ok: false, erro: 'Código inválido. Use só letras, números e hífen, de 8 a 30 caracteres.' }
  }
  const digitos = s.replace(/\D/g, '')
  if (digitos.length < 6) return { ok: false, erro: 'Código inválido. Ele precisa ter pelo menos 6 números.' }
  if (sequenciaBoba(digitos)) return { ok: false, erro: 'Esse código não parece de uma transportadora. Confira e cole de novo.' }
  return { ok: true, codigo: s }
}
