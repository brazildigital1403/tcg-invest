/**
 * Etiqueta reversa da desistencia (#500): regras puras, sem rede.
 * Coberta por scripts/reclamacao-selftest.mjs. O lado da rede (Melhor Envio) e
 * a gravacao ficam em lib/etiquetaReversaServer.
 *
 * Fluxo no Melhor Envio (docs.melhorenvio.com.br, "Logistica Reversa"):
 *   POST /api/v2/me/cart/reverse  -> id do item no carrinho
 *   POST /api/v2/me/shipment/checkout {orders:[id]}  -> paga com o saldo da carteira
 *   POST /api/v2/me/shipment/generate {orders:[id]}  -> gera o codigo de postagem
 * Correios apenas (PAC = 1, SEDEX = 2), postado em agencia dos Correios, sem
 * etiqueta impressa: o comprador mostra o codigo no balcao.
 *
 * ★ O que a documentacao NAO diz (25/10): em que campo da resposta o codigo de
 *   postagem vem (o candidato e `authorization_code`) e a validade dele. O
 *   sandbox nao gera o codigo. Por isso `lerPedidoME` aceita mais de um campo e
 *   a resposta inteira fica guardada (etiqueta_resposta) para o primeiro teste
 *   em producao confirmar.
 */

export const SERVICO_PAC = 1
export const SERVICO_SEDEX = 2
/** Tentativas automaticas do cron antes de deixar so para o admin. */
export const MAX_TENTATIVAS_ETIQUETA = 5

/** Envelope com 1 carta: mesmo pacote da cotacao (lib/melhor-envio, pacoteDeCartas(1)). */
export const PACOTE_UMA_CARTA = { height: 18, width: 13, length: 2, weight: 0.023 }

export function soDigitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
}

/** CPF com digitos verificadores validos (rejeita repetidos como 111.111.111-11). */
export function cpfValido(v: unknown): boolean {
  const d = soDigitos(v)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const dv = (n: number) => {
    let s = 0
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}

/**
 * "Rua de Teste, 100 - Butanta" -> { rua, numero, bairro }. Endereco de loja
 * e texto livre; o Melhor Envio pede numero e bairro separados. Sem numero
 * reconhecivel, numero = 'S/N'.
 */
export function separarEndereco(texto: unknown): { rua: string; numero: string; bairro: string } {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim()
  const [antes, ...depois] = t.split(/\s+-\s+/)
  const bairro = depois.join(' - ').trim()
  const m = antes.match(/^(.*?)[,\s]+(n[ºo°.]?\s*)?(\d+[A-Za-z]?)\s*(.*)$/i)
  if (m && m[1].trim()) {
    return { rua: m[1].replace(/,\s*$/, '').trim(), numero: m[3], bairro: bairro || m[4].replace(/^[,\s-]+/, '').trim() }
  }
  return { rua: antes.replace(/,\s*$/, '').trim(), numero: 'S/N', bairro }
}

export interface PessoaReversa {
  nome: string | null | undefined
  email: string | null | undefined
  telefone: string | null | undefined
  cpf: string | null | undefined
  rua: string | null | undefined
  numero: string | null | undefined
  complemento?: string | null
  bairro: string | null | undefined
  cidade: string | null | undefined
  uf: string | null | undefined
  cep: string | null | undefined
}

export type CampoFaltando =
  | 'cpf_comprador' | 'endereco_comprador' | 'telefone_comprador' | 'email_comprador'
  | 'documento_loja' | 'endereco_loja'

function enderecoOk(p: PessoaReversa): boolean {
  return !!(p.rua && p.cidade && p.uf && soDigitos(p.cep).length === 8)
}

function pessoaME(p: PessoaReversa) {
  return {
    name: String(p.nome || '').slice(0, 100),
    phone: soDigitos(p.telefone).replace(/^55(?=\d{10,11}$)/, ''),
    email: String(p.email || ''),
    document: soDigitos(p.cpf),
    company_document: '',
    address: String(p.rua || '').slice(0, 100),
    complement: String(p.complemento || '').slice(0, 60),
    number: String(p.numero || 'S/N').slice(0, 10),
    district: String(p.bairro || 'Centro').slice(0, 60),
    city: String(p.cidade || ''),
    state_abbr: String(p.uf || '').toUpperCase().slice(0, 2),
    country_id: 'BR',
    postal_code: soDigitos(p.cep),
  }
}

/**
 * Corpo do POST /api/v2/me/cart/reverse. `from` = quem devolve (comprador),
 * `to` = a loja. Recusa (sem chamar a rede) quando falta o que o Melhor Envio
 * exige: CPF valido e endereco completo dos dois lados, telefone e e-mail do
 * comprador. A loja ainda nao tem CNPJ cadastrado (#470): o documento dela e
 * o CPF do dono.
 */
export function montarReversa(a: {
  comprador: PessoaReversa
  loja: PessoaReversa
  valorDeclaradoCents: number
  nomeItem: string
  servico?: number
}): { ok: true; body: Record<string, unknown> } | { ok: false; faltando: CampoFaltando[] } {
  const faltando: CampoFaltando[] = []
  if (!cpfValido(a.comprador.cpf)) faltando.push('cpf_comprador')
  if (!enderecoOk(a.comprador)) faltando.push('endereco_comprador')
  if (soDigitos(a.comprador.telefone).length < 10) faltando.push('telefone_comprador')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(a.comprador.email || ''))) faltando.push('email_comprador')
  if (!cpfValido(a.loja.cpf)) faltando.push('documento_loja')
  if (!enderecoOk(a.loja)) faltando.push('endereco_loja')
  if (faltando.length) return { ok: false, faltando }

  const valor = Math.max(1, Math.round(a.valorDeclaradoCents) / 100)
  const from = pessoaME(a.comprador)
  return {
    ok: true,
    body: {
      service: a.servico ?? SERVICO_PAC,
      new_sender_mail: from.email,
      new_sender_phone: from.phone,
      insurance_value: valor,
      from,
      to: pessoaME(a.loja),
      products: [{ name: String(a.nomeItem || 'Carta colecionável').slice(0, 100), quantity: 1, unitary_value: valor, weight: PACOTE_UMA_CARTA.weight }],
      package: PACOTE_UMA_CARTA,
      options: { own_hand: false, receipt: false },
    },
  }
}

export interface EstadoPedidoME {
  status: string | null
  codigo: string | null
  rastreio: string | null
  postado: boolean
  entregue: boolean
  cancelado: boolean
  precoCents: number | null
}

/**
 * Le o pedido do Melhor Envio (GET /api/v2/me/orders/{id} ou o item do
 * carrinho).
 *
 * ★ CODIGO DE POSTAGEM, provado em producao em 26/10 (ORD-202610146471463):
 *   na logistica reversa dos Correios o `authorization_code` volta NULO e o
 *   codigo que o painel do Melhor Envio mostra para postar e o proprio
 *   rastreio dos Correios, em `tracking` (AE069010603BR), preenchido assim
 *   que `generated_at` sai. `self_tracking` (ME...) e o rastreio interno do
 *   Melhor Envio, nao serve no balcao. Validade vista no painel: ~7 dias
 *   depois da geracao (gerada 26/10 02:08, expira 02/11 21h).
 */
export function lerPedidoME(j: unknown): EstadoPedidoME {
  const o = (j && typeof j === 'object' ? j : {}) as Record<string, unknown>
  const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const status = txt(o.status)?.toLowerCase() ?? null
  const preco = Number(o.price)
  return {
    status,
    codigo: txt(o.authorization_code) ?? (o.reverse && txt(o.generated_at) ? txt(o.tracking) : null),
    rastreio: txt(o.tracking) ?? null,
    postado: status === 'posted' || status === 'delivered' || !!txt(o.posted_at),
    entregue: status === 'delivered' || !!txt(o.delivered_at),
    cancelado: status === 'canceled' || status === 'cancelled' || !!txt(o.canceled_at),
    precoCents: Number.isFinite(preco) && preco > 0 ? Math.round(preco * 100) : null,
  }
}

/** Mensagem curta para o comprador quando falta dado para gerar a etiqueta. */
export const TEXTO_FALTANDO: Record<CampoFaltando, string> = {
  cpf_comprador: 'Informe o seu CPF. Os Correios exigem para a devolução.',
  endereco_comprador: 'Complete o seu endereço em Minha Conta (rua, número, cidade e CEP).',
  telefone_comprador: 'Informe um celular com DDD.',
  email_comprador: 'A sua conta está sem e-mail válido.',
  documento_loja: 'A loja está sem documento cadastrado. A Bynx vai resolver com ela.',
  endereco_loja: 'A loja está com o endereço incompleto. A Bynx vai resolver com ela.',
}
