import type { SupabaseClient } from '@supabase/supabase-js'
import { promoveuOrigem } from '@/lib/origemCarta'

/**
 * Movimento da carta vendida entre colecoes, do lado do SERVIDOR (chave de
 * servico). Criado em 22/09/2026 para dois buracos:
 *
 * 1. #371 -- a compra pelo checkout da Stripe nunca punha a carta na colecao
 *    de quem comprou nem tirava da de quem vendeu. O webhook marcava o anuncio
 *    como vendido e parava ai. Agora /api/pedidos/[id]/receber chama as duas
 *    funcoes quando o comprador confirma o recebimento.
 *
 * 2. A baixa do VENDEDOR na compra negociada rodava no navegador do comprador
 *    (concluirCompra.ts). A RLS de user_cards so deixa cada um mexer nas
 *    proprias linhas, entao o update/delete na linha do vendedor afetava 0
 *    linhas, calado -- o vendedor seguia com a carta. Agora a rota de status
 *    chama `baixarDoVendedor` no `concluir`, depois da transicao atomica.
 *
 * As regras de casamento sao as mesmas de concluirCompra.ts (que explica o
 * porque de cada uma): carta comum ja existente soma quantidade (o indice
 * unico parcial de user_cards derrubaria o insert), graduada entra como item
 * a parte, e a baixa casa por vinculo + variante + graduacao.
 *
 * Com a chave de servico o trigger de limite de cartas (#374) deixa passar:
 * carta comprada sempre entra, nunca bate no limite do plano.
 */

export type CartaVendida = {
  user_id: string
  card_id?: string | null
  card_name: string
  card_image?: string | null
  card_link?: string | null
  variante?: string | null
  graduada?: boolean | null
  graduadora?: string | null
  nota?: number | null
  black_label?: boolean | null
  cert_graduacao?: string | null
  subnotas?: unknown
  idioma?: string | null
}

/** Colunas de `marketplace` que as duas funcoes precisam. */
export const COLUNAS_CARTA_VENDIDA =
  'user_id, card_id, card_name, card_image, card_link, variante, graduada, graduadora, nota, black_label, cert_graduacao, subnotas, idioma'

export async function adicionarAoComprador(
  sb: SupabaseClient,
  carta: CartaVendida,
  compradorId: string,
): Promise<{ ok: true; somou: boolean } | { ok: false; erro: string }> {
  const catalogoId = carta.card_id || null
  const ehGraduada = !!carta.graduada
  const variante = carta.variante || 'normal'

  if (catalogoId && !ehGraduada) {
    const { data: ja, error: errBusca } = await sb
      .from('user_cards')
      .select('id, quantity, origem')
      .eq('user_id', compradorId)
      .eq('pokemon_api_id', catalogoId)
      .eq('graduada', false)
      .limit(1)
    if (errBusca) return { ok: false, erro: errBusca.message }
    const linha = ja?.[0] as { id: string; quantity: number | null; origem: string | null } | undefined
    if (linha) {
      // A copia comprada verifica a linha inteira -- o pedido foi pago dentro
      // da Bynx. So sobe: linha ja em `compra` nao muda.
      const patch: Record<string, unknown> = { quantity: (linha.quantity || 1) + 1 }
      if (promoveuOrigem(linha.origem, 'compra')) {
        patch.origem = 'compra'
        patch.origem_em = new Date().toISOString()
      }
      const { error } = await sb.from('user_cards').update(patch).eq('id', linha.id)
      if (error) return { ok: false, erro: error.message }
      return { ok: true, somou: true }
    }
  }

  const dados: Record<string, unknown> = {
    user_id: compradorId,
    card_id: catalogoId,
    pokemon_api_id: catalogoId,
    card_name: carta.card_name,
    card_image: carta.card_image || null,
    card_link: carta.card_link || null,
    variante,
    quantity: 1,
    graduada: ehGraduada,
    graduadora: ehGraduada ? (carta.graduadora || null) : null,
    nota: ehGraduada ? (carta.nota ?? null) : null,
    black_label: ehGraduada ? !!carta.black_label : false,
    cert_graduacao: ehGraduada ? (carta.cert_graduacao || null) : null,
    subnotas: ehGraduada ? (carta.subnotas || null) : null,
    // Compra paga na Bynx: nasce verificada. Ver src/lib/origemCarta.ts.
    origem: 'compra',
    origem_em: new Date().toISOString(),
  }
  if (carta.idioma) dados.idioma = carta.idioma

  const { error } = await sb.from('user_cards').insert(dados)
  if (error) return { ok: false, erro: error.message }
  return { ok: true, somou: false }
}

export async function baixarDoVendedor(
  sb: SupabaseClient,
  carta: CartaVendida,
): Promise<{ ok: true; achou: boolean } | { ok: false; erro: string }> {
  const catalogoId = carta.card_id || null
  const ehGraduada = !!carta.graduada
  const variante = carta.variante || 'normal'

  let busca = sb.from('user_cards').select('id, quantity').eq('user_id', carta.user_id)
  busca = catalogoId ? busca.eq('pokemon_api_id', catalogoId) : busca.eq('card_name', carta.card_name)
  // Graduada: o certificado identifica o slab exato quando existe.
  if (ehGraduada && carta.cert_graduacao) busca = busca.eq('cert_graduacao', carta.cert_graduacao)

  const { data, error: errBusca } = await busca.eq('variante', variante).eq('graduada', ehGraduada).limit(1)
  if (errBusca) return { ok: false, erro: errBusca.message }

  const linha = data?.[0] as { id: string; quantity: number | null } | undefined
  // Nao achar e aceitavel: o vendedor pode ter anunciado sem ter a carta na
  // colecao, ou ja ter tirado. A venda nao depende disso.
  if (!linha) return { ok: true, achou: false }

  const { error } = (linha.quantity || 1) > 1
    ? await sb.from('user_cards').update({ quantity: (linha.quantity || 1) - 1 }).eq('id', linha.id)
    : await sb.from('user_cards').delete().eq('id', linha.id)
  if (error) return { ok: false, erro: error.message }
  return { ok: true, achou: true }
}
