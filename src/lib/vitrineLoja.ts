import 'server-only'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { GRADUADORA_MAP, notaCurta } from '@/lib/graduadoras'

/**
 * Itens da vitrine de uma loja — CARTAS (marketplace) + PRODUTOS (loja_produtos)
 * no mesmo formato.
 *
 * ★ POR QUE ISTO VIVE NO SERVIDOR (03/09/2026): antes a vitrine buscava no
 * BROWSER, dentro de `AnunciosLoja` ('use client'). Resultado: o Google recebia
 * a pagina da loja **sem nada do que ela vende** — a lista inteira era invisivel
 * pro crawler. O produto ate ganhou pagina propria indexavel, mas a vitrine que
 * leva ate ela nao existia no HTML.
 *
 * ★ E POR QUE O MAPEAMENTO VEM JUNTO: se o servidor buscasse e o componente
 * montasse o item, a regra de badge/href/preco existiria em dois lugares — o
 * padrao que mais gerou bug nesta operacao. Aqui a vitrine tem UMA fonte.
 *
 * ★ SERVICE ROLE EXIGE FILTRO EXPLICITO. A RLS de `loja_produtos`
 * (`ativo AND estoque > 0`) NAO se aplica ao service role. Sem o where, a
 * vitrine mostraria produto despublicado. Mesma pegadinha do sitemap.
 */

export type ItemVitrine = {
  id: string
  tipo: string
  nome: string
  imagem: string | null
  preco: number
  /** Badges: carta -> variante/condicao · produto -> estoque */
  badges: string[]
  /** Destino do CTA de compra. */
  href: string
  /** Pagina de detalhe. So produto tem uma; carta ainda nao. */
  detalhe: string | null
  ehCarta: boolean
}

const VARIANTE_LABEL: Record<string, string> = {
  normal: 'Normal', foil: 'Foil', promo: 'Promo', reverse: 'Reverse', pokeball: 'Pokeball',
}

/**
 * Badges da carta. NUNCA inventa condicao.
 *
 * ★ O bug que isto conserta (03/09/2026): carta graduada grava `condicao: null`
 * (o formulario nao pede condicao de slab). O codigo antigo fazia
 * `c.condicao || 'NM'` e o resultado era **uma PSA 10 aparecendo na vitrine
 * publica como "Normal · NM"**: o slab sumia e a carta ganhava uma condicao que
 * ninguem declarou — justo o atributo que mais move o preco de uma carta.
 *
 * Agora: graduada mostra a graduadora e a nota (mesmo formato do /marketplace,
 * via `GRADUADORA_MAP`/`notaCurta`); crua mostra a condicao SE existir.
 */
function badgesDaCarta(c: {
  variante: string | null
  condicao: string | null
  graduada: boolean | null
  graduadora: string | null
  nota: number | null
  black_label: boolean | null
}): string[] {
  const out = [VARIANTE_LABEL[c.variante || 'normal'] || 'Normal']

  if (c.graduada && c.graduadora) {
    const g = GRADUADORA_MAP[c.graduadora]
    const nome = g?.curto || c.graduadora.toUpperCase()
    const n = notaCurta(c.nota, !!c.black_label)
    out.push(n ? `${nome} ${n}` : nome)
    return out
  }

  // Sem graduacao: so mostra condicao se o vendedor declarou.
  if (c.condicao) out.push(c.condicao)
  return out
}

export async function buscarItensDaVitrine(
  ownerUserId: string | null,
  lojaId: string | null,
): Promise<ItemVitrine[]> {
  const db = getServiceSupabase()
  if (!db) return []

  const [cartas, produtos] = await Promise.all([
    ownerUserId
      ? db
          .from('marketplace')
          .select('id, card_name, card_image, price, variante, condicao, graduada, graduadora, nota, black_label')
          .eq('user_id', ownerUserId)
          .eq('status', 'disponivel')
          // ★ `removido_em` NAO pode faltar. A moderacao do admin so seta esse
          // campo — nao mexe no `status` (ver api/admin/marketplace/moderar).
          // Sem este filtro, anuncio REMOVIDO continua na vitrine publica e
          // comprável. Era o caso ate 03/09; o erro foi meu, neste arquivo.
          .is('removido_em', null)
          .order('created_at', { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
    lojaId
      ? db
          .from('loja_produtos')
          .select('id, slug, tipo, nome, preco_cents, estoque, fotos')
          .eq('loja_id', lojaId)
          .eq('ativo', true)
          .gt('estoque', 0)
          .order('created_at', { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
  ])

  // Falha aqui NAO pode virar vitrine vazia silenciosa: a loja pareceria nao ter
  // nada a venda. Loga alto e devolve o que deu certo.
  if (cartas.error) console.error('[vitrine] cartas:', cartas.error.message)
  if (produtos.error) console.error('[vitrine] produtos:', produtos.error.message)

  const itensCarta: ItemVitrine[] = (cartas.data || []).map(c => ({
    id: c.id,
    tipo: 'carta',
    nome: c.card_name || '',
    imagem: c.card_image,
    preco: Number(c.price) || 0,
    badges: badgesDaCarta(c),
    href: `/checkout/${c.id}`,
    detalhe: null,
    ehCarta: true,
  }))

  const itensProduto: ItemVitrine[] = (produtos.data || []).map(p => ({
    id: p.id,
    tipo: p.tipo,
    nome: p.nome,
    imagem: Array.isArray(p.fotos) && p.fotos.length ? p.fotos[0] : null,
    preco: (p.preco_cents || 0) / 100,
    badges: [p.estoque > 1 ? `${p.estoque} em estoque` : 'Última unidade'],
    href: `/checkout/${p.id}?tipo=produto`,
    detalhe: `/produto/${p.slug || p.id}`,
    ehCarta: false,
  }))

  return [...itensCarta, ...itensProduto]
}
