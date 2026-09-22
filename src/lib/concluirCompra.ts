import { supabase } from '@/lib/supabaseClient'
import { trackFirstCardAdded } from '@/lib/analytics'

/**
 * Transferencia da carta quando o comprador confirma o recebimento.
 *
 * ★ Existia COPIADA em tres telas (ChatDock, NegociacoesTab e o card do
 * /marketplace), e as tres carregavam os mesmos dois defeitos -- que e
 * exatamente o motivo de virar funcao unica: o proximo lugar que concluir uma
 * compra chama daqui em vez de recriar o bug.
 *
 * O que estava errado (24/08/2026):
 *
 * 1. **A carta entrava na colecao sem vinculo com o catalogo.** O insert
 *    gravava so nome/imagem/link, sem `card_id` nem `pokemon_api_id`. Toda
 *    compra concluida criava uma carta orfa: sem preco, sem pagina de carta,
 *    e realimentando a fila de anuncios quebrados -- anunciar de volta uma
 *    carta sem vinculo produz outro anuncio sem vinculo.
 *
 * 2. **A baixa no vendedor casava por `card_name`.** Quem tinha a mesma carta
 *    em duas variantes (normal e foil) podia perder a errada, e quem tinha 3
 *    copias perdia as 3 -- a linha inteira era deletada em vez de decrementada.
 *
 * Detalhe que obriga cuidado: `user_cards` tem indice unico parcial
 * `(user_id, pokemon_api_id) WHERE pokemon_api_id IS NOT NULL AND graduada =
 * false`. Passar a preencher o `pokemon_api_id` sem tratar isso faria o insert
 * FALHAR pra quem ja tem a carta -- e o erro passava calado, concluindo a
 * venda sem entregar a carta. Por isso: carta comum ja existente soma
 * quantidade; graduada insere (dois slabs sao itens distintos).
 *
 * Retorna `ok: false` quando a carta nao entrou na colecao. Nesse caso o
 * chamador NAO deve marcar o anuncio como concluido.
 */

export type AnuncioParaConcluir = {
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
  subnotas?: any
  idioma?: string | null
}

export async function transferirCartaAoComprador(
  anuncio: AnuncioParaConcluir,
  compradorId: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  // Confiavel desde o fix do AnunciarModal, que so grava id existente na view
  // `pokemon_cards` (ou seja, carta viva e nao oculta).
  const catalogoId: string | null = anuncio.card_id || null
  const ehGraduada = !!anuncio.graduada
  const variante = anuncio.variante || 'normal'

  // A graduacao precisa vir junto, e nao e cosmetico: sem `graduada: true` a
  // carta entraria como CRUA e passaria a disputar o indice unico parcial,
  // quebrando o insert de quem ja tem a versao normal da mesma carta.
  const dadosCarta: Record<string, any> = {
    user_id: compradorId,
    card_id: catalogoId,
    pokemon_api_id: catalogoId,
    card_name: anuncio.card_name,
    card_image: anuncio.card_image || null,
    card_link: anuncio.card_link || null,
    variante,
    graduada: ehGraduada,
    graduadora: ehGraduada ? (anuncio.graduadora || null) : null,
    nota: ehGraduada ? (anuncio.nota ?? null) : null,
    black_label: ehGraduada ? !!anuncio.black_label : false,
    cert_graduacao: ehGraduada ? (anuncio.cert_graduacao || null) : null,
    subnotas: ehGraduada ? (anuncio.subnotas || null) : null,
  }
  if (anuncio.idioma) dadosCarta.idioma = anuncio.idioma

  // ── Entra na colecao do comprador ───────────────────────────────────────
  let somou = false
  if (catalogoId && !ehGraduada) {
    const { data: ja } = await supabase
      .from('user_cards')
      .select('id, quantity')
      .eq('user_id', compradorId)
      .eq('pokemon_api_id', catalogoId)
      .eq('graduada', false)
      .limit(1)
    const linha = ja?.[0] as any
    if (linha) {
      const { error } = await supabase
        .from('user_cards')
        .update({ quantity: (linha.quantity || 1) + 1 })
        .eq('id', linha.id)
      if (error) return { ok: false, erro: error.message }
      somou = true
    }
  }

  if (!somou) {
    const { error } = await supabase.from('user_cards').insert(dadosCarta)
    if (error) return { ok: false, erro: error.message }
  }

  trackFirstCardAdded(compradorId)

  // ── Baixa no estoque do vendedor: NAO e mais aqui (22/09/2026) ───────────
  // Rodava com a sessao do COMPRADOR, e a RLS de user_cards so deixa cada um
  // mexer nas proprias linhas: o update/delete na linha do vendedor afetava 0
  // linhas, sem erro, e o vendedor seguia com a carta. Agora a rota
  // /api/marketplace/[id]/status faz a baixa no `concluir`, com a chave de
  // servico (src/lib/transferirCartaServidor.ts).

  // ── Rastro da transacao: REMOVIDO (22/09/2026) ──────────────────────────
  // O insert em `transactions` nunca gravou uma linha sequer: a tabela tem RLS
  // ligada com policy so de SELECT, entao a escrita pelo navegador era barrada
  // em silencio (0 linhas na tabela desde sempre). Ninguem le a tabela: o
  // "Ultimas transacoes" do dashboard financeiro monta a lista de `pedidos`, e
  // o unico leitor era o badge do admin, que por isso mostrava sempre zero.
  // Se um dia a compra negociada precisar de historico proprio (#379), ele
  // nasce no servidor, na rota que conclui, nao aqui.

  return { ok: true }
}
