/**
 * Vitrine do E21 (Halloween na Bynx), lida do banco NA HORA do disparo.
 *
 * Mesma regra do botao "Comprar" do /marketplace:
 * - anuncio de carta: disponivel e nao removido. Se o dono tem loja ativa e
 *   visivel, vale o recebimento da LOJA; senao, o da pessoa (Connect liberado
 *   + CEP com 8 digitos, igual a `public_users.vende_online`). Nunca os dois.
 * - produto de loja: ativo, estoque > 0, loja ativa e visivel com recebimento.
 * "Tenho interesse" fica de fora. Dedup por id (o destaque do Mercado repete
 * itens; aqui cada anuncio entra uma vez). A Caixa para Toploader sai da grade
 * e vira o bloco proprio.
 */
import { GRADUADORA_MAP, notaCurta } from '@/lib/graduadoras'
import { SLUG_CAIXA_E21, type DadosE21, type ItemE21 } from '@/lib/regua/templates/E21'
import type { Contexto } from './contexto'

const TIPO_PRODUTO: Record<string, string> = { selado: 'Selado', acessorio: 'Acessório' }

export async function carregarVitrineHalloween(ctx: Contexto): Promise<DadosE21> {
  const { data: lojas, error: e1 } = await ctx.c.from('lojas')
    .select('id, owner_user_id, nome, connect_charges_enabled')
    .eq('status', 'ativa').neq('oculta', true)
  if (e1) throw new Error(`[regua] E21 lojas: ${e1.message}`)
  const lojaDoDono = new Map((lojas || []).map((l) => [l.owner_user_id as string, l]))
  const lojaPorId = new Map((lojas || []).map((l) => [l.id as string, l]))

  const { data: anuncios, error: e2 } = await ctx.c.from('marketplace')
    .select('id, slug, user_id, card_name, card_image, fotos, price, condicao, graduada, graduadora, nota, black_label')
    .is('removido_em', null).eq('status', 'disponivel')
  if (e2) throw new Error(`[regua] E21 anuncios: ${e2.message}`)

  const pessoas = [...new Set((anuncios || []).map((a) => a.user_id as string).filter((id) => !lojaDoDono.has(id)))]
  const vendePessoa = new Map<string, { nome: string; vende: boolean }>()
  if (pessoas.length) {
    const { data: us, error: e3 } = await ctx.c.from('users').select('id, name, cep, connect_charges_enabled').in('id', pessoas)
    if (e3) throw new Error(`[regua] E21 vendedores: ${e3.message}`)
    for (const u of us || []) {
      const cep = String(u.cep || '').replace(/\D/g, '')
      vendePessoa.set(u.id, { nome: String(u.name || '').trim().split(/\s+/)[0] || 'Vendedor', vende: u.connect_charges_enabled === true && cep.length === 8 })
    }
  }

  const vistos = new Set<string>()
  const cartas: ItemE21[] = []
  for (const a of anuncios || []) {
    if (vistos.has(a.id)) continue
    const loja = lojaDoDono.get(a.user_id)
    const p = vendePessoa.get(a.user_id)
    const vende = loja ? loja.connect_charges_enabled === true : !!p?.vende
    if (!vende || !(Number(a.price) > 0)) continue
    vistos.add(a.id)
    const g = a.graduada && a.graduadora ? GRADUADORA_MAP[a.graduadora] : null
    const detalhe = g ? `${g.curto} ${notaCurta(a.nota, a.black_label)}`.trim() : (a.condicao || 'NM')
    const foto = Array.isArray(a.fotos) ? a.fotos.find(Boolean) : null
    cartas.push({
      tipo: 'carta', nome: a.card_name, detalhe,
      vendedor: loja ? String(loja.nome) : (p?.nome ?? 'Vendedor'),
      preco: Number(a.price), imagem: a.card_image || foto || null,
      caminho: `/anuncio/${encodeURIComponent(a.slug || a.id)}`,
    })
  }
  cartas.sort((x, y) => y.preco - x.preco)

  let caixa: ItemE21 | null = null
  const produtos: ItemE21[] = []
  if (lojaPorId.size) {
    const { data: lp, error: e4 } = await ctx.c.from('loja_produtos')
      .select('id, slug, tipo, nome, preco_cents, estoque, fotos, loja_id')
      .eq('ativo', true).gt('estoque', 0).in('loja_id', [...lojaPorId.keys()])
    if (e4) throw new Error(`[regua] E21 produtos: ${e4.message}`)
    for (const p of lp || []) {
      const l = lojaPorId.get(p.loja_id)
      if (!l || l.connect_charges_enabled !== true || vistos.has(p.id) || !(p.preco_cents > 0)) continue
      vistos.add(p.id)
      const item: ItemE21 = {
        tipo: 'produto', nome: p.nome, detalhe: TIPO_PRODUTO[p.tipo] ?? 'Produto',
        vendedor: String(l.nome), preco: p.preco_cents / 100,
        imagem: Array.isArray(p.fotos) ? (p.fotos.find(Boolean) ?? null) : null,
        caminho: `/produto/${encodeURIComponent(p.slug || p.id)}`,
      }
      if (p.slug === SLUG_CAIXA_E21) caixa = item
      else produtos.push(item)
    }
  }
  produtos.sort((x, y) => y.preco - x.preco)

  const itens = [...produtos, ...cartas]
  if (itens.length === 0) throw new Error('[regua] E21: nenhum item com Comprar agora.')
  return { itens, caixa }
}
