import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Token da imagem pessoal da regua (rota /api/email/img/[tipo]).
 *
 * Formato: `<uuid do email_envios>.<assinatura>`. A assinatura e um
 * HMAC-SHA256 do id com o segredo do servidor, cortado em 16 bytes
 * (22 caracteres base64url): curto para a URL do e-mail, longo o bastante
 * para ninguem chutar. O token NAO carrega dado da pessoa; ele so aponta para
 * a linha do envio, e a rota le os dados de `email_envios.meta.img.<tipo>`.
 *
 * Um token por envio serve a todos os tipos daquele e-mail (o E17 usa 5).
 *
 * ★ O segredo nunca sai daqui: nada de log, nada de mensagem de erro com ele.
 * Sem o segredo no ambiente, `assinar` lanca `SemSegredoImagem` e a rota
 * responde 503 (falha de configuracao, nao token invalido).
 */

const BYTES_ASSINATURA = 16
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Separa este uso do segredo de qualquer outro HMAC feito com ele. */
const DOMINIO = 'bynx:email-img:v1:'

export class SemSegredoImagem extends Error {
  constructor() {
    super('segredo da imagem pessoal ausente no ambiente')
    this.name = 'SemSegredoImagem'
  }
}

function segredo(): string {
  const s = process.env.CRON_SECRET
  if (!s) throw new SemSegredoImagem()
  return s
}

/** true quando o ambiente tem o segredo (a rota usa para decidir o 503). */
export function temSegredoImagem(): boolean {
  return Boolean(process.env.CRON_SECRET)
}

function hmac(id: string): Buffer {
  return createHmac('sha256', segredo()).update(DOMINIO + id.toLowerCase()).digest().subarray(0, BYTES_ASSINATURA)
}

/** Token da imagem para o envio `id` (uuid do email_envios). */
export function assinar(id: string): string {
  if (!UUID.test(id)) throw new Error('assinar: id de envio invalido')
  return `${id.toLowerCase()}.${hmac(id).toString('base64url')}`
}

/**
 * Devolve o uuid do envio quando o token confere; `null` em qualquer outro
 * caso (formato errado, assinatura errada). Lanca `SemSegredoImagem` se o
 * ambiente nao tem o segredo.
 */
export function verificar(token: string | null | undefined): string | null {
  if (!token || token.length > 100) return null
  const ponto = token.indexOf('.')
  if (ponto < 0) return null
  const id = token.slice(0, ponto)
  const assinatura = token.slice(ponto + 1)
  if (!UUID.test(id) || !/^[A-Za-z0-9_-]+$/.test(assinatura)) return null
  const recebida = Buffer.from(assinatura, 'base64url')
  const esperada = hmac(id)
  if (recebida.length !== esperada.length) return null
  return timingSafeEqual(recebida, esperada) ? id.toLowerCase() : null
}
