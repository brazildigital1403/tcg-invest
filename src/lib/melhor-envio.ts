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

/**
 * ★ UMA REMESSA DE CARTAS E UM VOLUME SO (02/10/2026).
 *
 * O peso antigo era **80 g por carta**, e as rotas empilhavam um pacote por
 * item: 10 cartas viravam 800 g e 4.680 cm3 -- uma caixa de sapato para um
 * envelope que pesa 154 g. Medido na API de cotacao, rota Fortaleza -> SP:
 *
 *     cartas   declarava   frete      com o peso certo
 *      2        160 g      R$ 17,43   R$ 17,43   (igual)
 *      4        320 g      R$ 21,87   R$ 17,44   -R$ 4,43
 *     10        800 g      R$ 23,51   R$ 17,50   -R$ 6,01
 *
 * E o pior nao era o preco: a partir de 4 cartas o **Correios Mini Envios
 * sumia da lista** (teto de 300 g), justo a modalidade mais barata do pais
 * para item leve. Com o peso certo ele volta.
 *
 * ★ A GRAMATURA, DECOMPOSTA (decisao do Du: modelo conservador). Envelope
 * entra UMA vez; cada carta leva o proprio toploader:
 *
 *     envelope ............  4 g   (uma vez, e a embalagem)
 *     carta ............... 1,8 g  }  por carta
 *     toploader 3x4 ...... ~13 g   }  = 15 g
 *
 * Uma carta da 19 g, que e a faixa de 18-22 g levantada na pesquisa. Dez dao
 * 154 g, dentro do teto de 300 g do Mini Envios.
 *
 * ★ POR QUE CONSERVADOR E NAO ENXUTO. Cartas empilhadas em sleeve com um
 * protetor para o lote pesariam ~3 g por carta, nao 15. Mas as duas contas
 * caem na MESMA faixa de preco ate ~16 cartas -- medido --, entao o numero
 * seguro sai de graca. E ele deixa de ser gratis no dia em que a Bynx emitir
 * a etiqueta: ai a transportadora cobra a diferenca de quem subdeclarou, e
 * quem paga e o vendedor.
 */
export const CARTA_EMBALAGEM_G = 4
export const CARTA_UNITARIA_G = 15
/** Espessura de uma carta em toploader, em mm. */
const CARTA_ESPESSURA_MM = 1.6
/** Acima disto nao e mais envelope; o chamador nao tem esse caso hoje. */
const TETO_CARTAS = 60

/** Peso declarado de uma remessa com `n` cartas, em gramas. */
export function pesoDeCartasG(n: number): number {
  const qtd = Math.max(1, Math.min(Math.floor(n) || 1, TETO_CARTAS))
  return CARTA_EMBALAGEM_G + CARTA_UNITARIA_G * qtd
}

/**
 * N cartas numa remessa: UM volume, area do envelope fixa, crescendo so na
 * espessura. `quantity` fica em 1 de proposito -- passar N faz a transportadora
 * cotar N volumes, que e exatamente o erro que isto corrige.
 */
export function pacoteDeCartas(n: number, valorTotalCents: number): ItemFrete {
  const qtd = Math.max(1, Math.min(Math.floor(n) || 1, TETO_CARTAS))
  const espessuraCm = (3 + CARTA_ESPESSURA_MM * qtd) / 10
  return {
    id: 'cartas',
    widthCm: 13,
    heightCm: 18,
    // Inteiro, com piso de 2 cm: a cotacao nao aceita fracao de cm.
    lengthCm: Math.max(2, Math.ceil(espessuraCm)),
    weightKg: pesoDeCartasG(qtd) / 1000,
    insuranceValue: Math.max(1, valorTotalCents / 100),
    quantity: 1,
  }
}

/** Uma carta. Mantido para os chamadores de item unico. */
export function pacoteDeCarta(precoCents: number): ItemFrete {
  return pacoteDeCartas(1, precoCents)
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
export function pacoteDeProduto(pesoG: number | null, tipo: string | null, precoCents: number, qtd = 1): ItemFrete {
  const d = DIMS_POR_TIPO[tipo || 'outros'] || DIMS_POR_TIPO.outros
  // Sem peso cadastrado: fallback de 300g (o lojista deveria preencher).
  const kg = pesoG && pesoG > 0 ? pesoG / 1000 : 0.3
  const n = Math.max(1, Math.floor(qtd) || 1)
  return {
    id: 'produto',
    widthCm: d.w,
    heightCm: d.h,
    lengthCm: d.l,
    weightKg: kg,
    // Seguro cobre a carga inteira, nao a unidade.
    insuranceValue: Math.max(1, (precoCents * n) / 100),
    // O Melhor Envio ja multiplica peso e volume por `quantity`.
    quantity: n,
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
