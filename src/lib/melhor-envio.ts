/**
 * Melhor Envio — cotacao de frete (Fase 1: SO cotacao, sem etiqueta).
 *
 * Usa UM token central da Bynx (env MELHOR_ENVIO_TOKEN) so pra COTAR. A loja
 * recebe o valor no pedido e envia por conta propria. Etiqueta + rastreio
 * automatico e a Fase 2 (cada loja conecta a propria conta via OAuth).
 *
 * SO SERVIDOR: o token nunca pode ir pro browser. Nao importar em 'use client'.
 *
 * Endpoint: POST {BASE}/api/v2/me/shipment/calculate
 *   headers: Authorization: Bearer <token> + User-Agent (obrigatorio) + JSON
 *   body (por produtos): { from, to, products[], options }
 *   -> a ME empacota sozinha e devolve as opcoes. Usar custom_price /
 *      custom_delivery_time (ja com as taxas/descontos da conta).
 */

const BASE = process.env.MELHOR_ENVIO_BASE || 'https://www.melhorenvio.com.br'
const UA = process.env.MELHOR_ENVIO_UA || 'Bynx (contato@bynx.gg)'
// Filtro opcional de servicos (ex "1,2,17"). Vazio = todas as transportadoras.
const SERVICES = process.env.MELHOR_ENVIO_SERVICES || ''
// Corta a lista pra nao afogar o comprador (ja vem ordenada por preco, mais
// barata primeiro). Tunavel por env sem redeploy; default 4.
const MAX_OPCOES = Math.max(1, Number(process.env.MELHOR_ENVIO_MAX) || 4)

export interface ItemFrete {
  id: string
  widthCm: number
  heightCm: number
  lengthCm: number
  weightKg: number
  insuranceValue: number // valor do item em BRL (pro seguro)
  quantity: number
}

export interface OpcaoFrete {
  id: number         // service id (o checkout re-cota e casa por este id)
  nome: string       // ex "PAC"
  empresa: string    // ex "Correios"
  precoCents: number // custom_price em centavos
  prazoDias: number  // custom_delivery_time em dias
}

function soDigitos(cep: string): string {
  return String(cep || '').replace(/\D/g, '').slice(0, 8)
}

/** Carta em toploader + envelope rigido: peso/medidas conservadores. */
export function pacoteDeCarta(precoCents: number): ItemFrete {
  return {
    id: 'carta',
    widthCm: 13,
    heightCm: 18,
    lengthCm: 2,
    weightKg: 0.08,
    insuranceValue: Math.max(1, precoCents / 100),
    quantity: 1,
  }
}

// Dimensoes default por tipo (cm). Os tipos batem com os do /api/lojas/[id]/produtos:
// selado, pelucia, funko, fichario, acessorio. O peso o lojista informa; a
// dimensao a Bynx estima por tipo (cubagem raramente e o gargalo do frete).
const DIMS_POR_TIPO: Record<string, { w: number; h: number; l: number }> = {
  selado: { w: 25, h: 20, l: 12 },
  pelucia: { w: 30, h: 25, l: 18 },
  funko: { w: 16, h: 12, l: 10 },
  fichario: { w: 32, h: 28, l: 8 },
  acessorio: { w: 20, h: 15, l: 8 },
  outros: { w: 22, h: 18, l: 10 },
}

/** Produto da loja: peso vem do cadastro (pedido ao lojista); dimensao default por tipo. */
export function pacoteDeProduto(pesoG: number | null, tipo: string | null, precoCents: number): ItemFrete {
  const d = DIMS_POR_TIPO[tipo || 'outros'] || DIMS_POR_TIPO.outros
  // Sem peso cadastrado: fallback de 300g (o lojista deveria preencher).
  const kg = pesoG && pesoG > 0 ? pesoG / 1000 : 0.3
  return {
    id: 'produto',
    widthCm: d.w,
    heightCm: d.h,
    lengthCm: d.l,
    weightKg: kg,
    insuranceValue: Math.max(1, precoCents / 100),
    quantity: 1,
  }
}

export async function cotarFrete(fromCep: string, toCep: string, itens: ItemFrete[]): Promise<OpcaoFrete[]> {
  const token = process.env.MELHOR_ENVIO_TOKEN
  if (!token) throw new Error('MELHOR_ENVIO_TOKEN ausente')

  const body: Record<string, unknown> = {
    from: { postal_code: soDigitos(fromCep) },
    to: { postal_code: soDigitos(toCep) },
    products: itens.map(i => ({
      id: i.id,
      width: i.widthCm,
      height: i.heightCm,
      length: i.lengthCm,
      weight: i.weightKg,
      insurance_value: Number(i.insuranceValue.toFixed(2)),
      quantity: i.quantity,
    })),
    options: { receipt: false, own_hand: false },
  }
  if (SERVICES) body.services = SERVICES

  const r = await fetch(`${BASE}/api/v2/me/shipment/calculate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': UA,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`Melhor Envio ${r.status}: ${t.slice(0, 200)}`)
  }

  const data = (await r.json()) as Array<Record<string, unknown>>
  return (Array.isArray(data) ? data : [])
    .filter(o => o && !o.error && o.custom_price != null)
    .map(o => ({
      id: Number(o.id),
      nome: String(o.name || ''),
      empresa: String((o.company as { name?: string } | undefined)?.name || ''),
      precoCents: Math.round(Number(o.custom_price) * 100),
      prazoDias: Number((o.custom_delivery_time as number) ?? (o.delivery_time as number) ?? 0),
    }))
    .filter(o => Number.isFinite(o.precoCents) && o.precoCents > 0)
    .sort((a, b) => a.precoCents - b.precoCents)
    .slice(0, MAX_OPCOES)
}
