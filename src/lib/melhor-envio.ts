import { medidaPadrao } from '@/lib/medidasProduto'
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
 * ★ A GRAMATURA, DECOMPOSTA (decisao do Du). A embalagem entra UMA vez; a
 * carta entra em sleeve, SEM toploader:
 *
 *     envelope de seguranca 12x18 ...  2,4 g  }
 *     2 papeloes de protecao ........  8   g  }  tara, uma vez = 20 g
 *     declaracao de conteudo (A4) ...  4,7 g  }
 *     envelope plastico da declaracao  3   g  }
 *
 *     carta .......................... 1,9 g  }  por carta = 3 g
 *     penny sleeve ................... 0,45 g }  (2,35 g + folga)
 *
 * ★ A DECLARACAO DE CONTEUDO E TARA E QUASE TODO MUNDO ESQUECE. Ela e
 * obrigatoria, vai COLADA POR FORA do pacote, e sozinha pesa mais que duas
 * cartas. A primeira versao desta funcao (commit 260fcdd) usava tara de 4 g
 * justamente por ter esquecido dela.
 *
 * ★ A PROVA DOS 3 g POR CARTA. A Cardmarket publica os limites por faixa:
 * "ate 20 g: 4 cartas · ate 50 g: 17 cartas · ate 100 g: 40 cartas".
 * Regredindo, o modelo deles e tara ~12 g + 2,2 g por carta -- e 2,2 g e
 * exatamente carta + penny sleeve, chegando pelo outro lado ao mesmo numero.
 * Os 3 g daqui sao os 2,35 g calculados mais folga para pedido cheio de holo
 * e full art, que pesam ate 1,98 g cada.
 *
 * ★ A PROVA DE QUE NINGUEM USA TOPLOADER EM TODAS. Dezessete toploaders
 * pesam 120 g sozinhos, e a Cardmarket declara 17 cartas numa carta de 50 g.
 * Em pedido de varias cartas elas vao empilhadas em sleeve, com um ou dois
 * protetores para o lote -- que e o que a tara ja cobre. Toploader e para a
 * carta cara avulsa, e quando houver, os ~7 g dele cabem na folga: uma carta
 * assim daria 30 g contra os 23 g declarados, e as duas estao no piso
 * tarifario.
 *
 * ★ HISTORICO DOS NUMEROS DESTA FUNCAO, porque os dois erros foram meus:
 *   80 g por carta (ate 02/10) -- 4 cartas estouravam o teto de 300 g do
 *     Mini Envios e o frete ia de R$ 17,44 para R$ 21,87.
 *   4 + 15n (260fcdd) -- tara sem a declaracao de conteudo e toploader em
 *     cada carta; 20 cartas davam 304 g e perdiam o Mini de novo.
 *   20 + 10n (8251f26) -- tara certa, toploader ainda em todas.
 *   20 + 3n (agora) -- o que de fato vai no envelope.
 */
export const CARTA_EMBALAGEM_G = 20
export const CARTA_UNITARIA_G = 3
/** Espessura de uma carta em sleeve, em mm (carta 0,30 + sleeve 0,10). */
const CARTA_ESPESSURA_MM = 0.4
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
  const espessuraCm = (4 + CARTA_ESPESSURA_MM * qtd) / 10
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

/**
 * ★ VOLTA DO SERVICO DE BANCADA (restauracao / pre-grading), 02/10/2026.
 *
 * Diferente da venda (pacoteDeCartas) em tres pontos, decisao do Du:
 *   1. TODA carta volta em sleeve + toploader: e carta de valor saindo da
 *      bancada, nao lote de varejo.
 *   2. O relatorio impresso vai junto, PLANO (A4), entao o envelope e A4 com
 *      um papelao A4 rigido, nao o 12x18 da venda.
 *   3. O numero de paginas depende do servico (ver PAGINAS_RELATORIO).
 *
 *     envelope de seguranca A4 ......... 12 g  }
 *     papelao rigido A4 ................ 40 g  }  tara, uma vez = 60 g
 *     declaracao de conteudo (A4) ......  4,7 g}  (ESTIMATIVA ate o Du pesar
 *     envelope plastico da declaracao ..  3 g  }   o kit real)
 *
 *     carta 1,9 + penny sleeve 0,45 + toploader ~7 ...  10 g por carta
 *     folha A4 75 g/m2 ............................... 4,7 g por pagina
 *
 * 1 carta de pre-grading (6 paginas): 60 + 10 + 28 = 98 g. Tudo cabe na
 * primeira faixa de frete (ate 250 g) ate umas 8 cartas.
 */
export const SERVICO_TARA_G = 60
export const SERVICO_CARTA_G = 10
export const FOLHA_A4_G = 4.7
/** Paginas do relatorio: fixas (fechamento + termos) e por carta, por servico. */
export const PAGINAS_RELATORIO: Record<string, { fixas: number; porCarta: number }> = {
  pre_grading: { fixas: 2, porCarta: 4 },
  restauracao: { fixas: 2, porCarta: 5 },
  completo: { fixas: 2, porCarta: 6 },
}

export function paginasRelatorio(servico: string, cartas: number): number {
  const p = PAGINAS_RELATORIO[servico] || PAGINAS_RELATORIO.completo
  return p.fixas + p.porCarta * Math.max(1, Math.floor(cartas) || 1)
}

export function pesoServicoVoltaG(servico: string, cartas: number): number {
  const n = Math.max(1, Math.min(Math.floor(cartas) || 1, TETO_CARTAS))
  return Math.ceil(SERVICO_TARA_G + SERVICO_CARTA_G * n + FOLHA_A4_G * paginasRelatorio(servico, n))
}

/** A volta de um pedido de servico: UM envelope A4, crescendo na espessura (toploader ~1,5 mm). */
export function pacoteServicoVolta(servico: string, cartas: number, valorDeclaradoCents: number): ItemFrete {
  const n = Math.max(1, Math.min(Math.floor(cartas) || 1, TETO_CARTAS))
  return {
    id: 'servico-volta',
    // Envelope C4 (22,9 x 32,4) declarado 23 x 32: o frete cobra o MAIOR entre
    // peso real e cubado (volume / 6000), e 23 x 32 x 2 = 245 g cubado fica na
    // primeira faixa (ate 250 g); 24 x 33 x 2 daria 264 g e pularia de faixa.
    widthCm: 23,
    heightCm: 32,
    lengthCm: Math.max(2, Math.ceil((5 + 1.5 * n) / 10)),
    weightKg: pesoServicoVoltaG(servico, n) / 1000,
    insuranceValue: Math.max(1, valorDeclaradoCents / 100),
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

/**
 * O que se sabe sobre a embalagem de um produto. Tudo pode faltar.
 *
 * `formato` e `idioma` entram para consultar a medida de FABRICA quando o
 * lojista nao mediu: produto selado tem caixa identica em qualquer loja.
 */
export type DimsProduto = {
  largura_cm?: number | null
  altura_cm?: number | null
  comprimento_cm?: number | null
  formato?: string | null
  idioma?: string | null
}

/**
 * Produto da loja. Peso e dimensao vem do cadastro; `DIMS_POR_TIPO` so entra
 * quando o lojista nao informou.
 *
 * ★ A DIMENSAO PASSOU A SER DO LOJISTA (02/10/2026, Quadro #447). O frete
 * cobra pelo MAIOR entre peso real e peso cubado (volume / 6000), e a
 * estimativa por tipo inflava o cubado a ponto de ele mandar no lugar do peso:
 * a ETB de 500 g declarava 25x20x12 = 1,00 kg de cubado. Medido BH -> SP,
 * R$ 18,95 contra R$ 17,99 de uma caixa 20x15x9. Eram numeros que ninguem
 * mediu -- a mesma natureza dos "80 g por carta" que inflavam o frete de carta
 * ate a manha do mesmo dia.
 *
 * ★ POR QUE NAO BASTAVA TROCAR OS NUMEROS: a correcao da carta tinha fonte; a
 * da ETB nao teria nenhuma. Quem tem a caixa na mao e o lojista.
 *
 * ★ TUDO OU NADA nas tres medidas: com uma faltando, o volume declarado seria
 * parte medida e parte chutada, e nao da para saber qual mandou no cubado.
 */
export function pacoteDeProduto(
  pesoG: number | null,
  tipo: string | null,
  precoCents: number,
  qtd = 1,
  dims?: DimsProduto | null,
): ItemFrete {
  // ★ A ORDEM IMPORTA (02/10/2026): o que o LOJISTA mediu vence tudo -- ele tem
  //   a caixa na mao e pode ter reembalado --, depois a medida de FABRICA da
  //   tabela por (formato, idioma), e so entao a estimativa antiga por tipo,
  //   que erra mas e o comportamento que ja existia.
  const estimado = DIMS_POR_TIPO[tipo || 'outros'] || DIMS_POR_TIPO.outros
  const fabrica = medidaPadrao(dims?.formato, dims?.idioma)
  const w = Number(dims?.largura_cm) || 0
  const h = Number(dims?.altura_cm) || 0
  const l = Number(dims?.comprimento_cm) || 0
  const d = w > 0 && h > 0 && l > 0
    ? { w, h, l }
    : fabrica
      ? { w: fabrica.largura_cm, h: fabrica.altura_cm, l: fabrica.comprimento_cm }
      : estimado
  // Peso: o do cadastro vence; depois o de fabrica; so entao os 300 g de
  // ultimo recurso, que e numero velho e nao medido.
  const kg = pesoG && pesoG > 0 ? pesoG / 1000 : fabrica ? fabrica.peso_g / 1000 : 0.3
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

export async function cotarFrete(fromCep: string, toCep: string, itens: ItemFrete[], max = MAX_OPCOES): Promise<OpcaoFrete[]> {
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
    .slice(0, max)
}
