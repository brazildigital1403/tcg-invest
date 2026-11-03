import { NextRequest } from 'next/server'
import { GRADUADORAS } from '@/lib/graduadoras'
import { slugBaseLote } from '@/lib/leilao'
import { DIAS_LOTE, validarLote, erroDoPainel } from '@/lib/leilao-painel'
import { separarEndereco } from '@/lib/etiquetaReversa'
import { contextoPainel, json, origemSupabase, recebimentoDaLoja, UUID_RE, COLUNAS_LOTE_PAINEL } from '../_comum'

/**
 * /api/lojas/[id]/leiloes/lotes: leilao com prazo, um lote sem rodada.
 *
 * GET    -> lotes da loja, os abertos primeiro
 * POST   { card_id, fotos, condicao, idioma, graduadora?, nota?, descricao?,
 *          lance_inicial_cents, dias } -> publica e abre na hora
 * DELETE ?lote_id= -> cancela, so sem lance
 *
 * A carta vem so pelo card_id, lida por PK, como na rodada. O que trava agendar
 * uma rodada trava aqui: sem recebimento o comprador nao paga, e sem endereco a
 * devolucao nao tem para onde voltar.
 */

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Params) {
  try {
    const { id: lojaId } = await ctx.params
    const c = await contextoPainel(req, lojaId)
    if (!c.ok) return c.res
    const [{ data, error }, recebimento] = await Promise.all([
      c.sb.from('leiloes').select(COLUNAS_LOTE_PAINEL).eq('loja_id', lojaId).is('rodada_id', null)
        .order('created_at', { ascending: false }).limit(100),
      recebimentoDaLoja(c.sb, c.loja),
    ])
    if (error) {
      console.error('[lojas/leiloes/lotes-prazo GET]', error.code, error.message)
      return json(500, { error: 'Erro ao carregar os leilões.' })
    }
    return json(200, { lotes: data ?? [], recebimento, enderecoOk: !!separarEndereco(c.loja.endereco).rua })
  } catch (err) {
    console.error('[lojas/leiloes/lotes-prazo GET] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}

export async function POST(req: NextRequest, ctx: Params) {
  try {
    const { id: lojaId } = await ctx.params
    const c = await contextoPainel(req, lojaId)
    if (!c.ok) return c.res
    if (c.loja.status !== 'ativa') return json(403, { error: 'Sua loja precisa estar ativa.' })
    const rec = await recebimentoDaLoja(c.sb, c.loja)
    if (!rec.podeReceber) return json(409, { error: rec.motivo })
    if (!separarEndereco(c.loja.endereco).rua) {
      return json(409, { error: 'Para publicar, cadastre o endereço para devoluções em Minha vitrine.' })
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return json(400, { error: 'Requisição inválida.' })
    const dias = Number(body.dias)
    if (!(DIAS_LOTE as readonly number[]).includes(dias)) return json(400, { error: 'Escolha por quantos dias o leilão fica aberto.' })
    const v = validarLote(body, {
      fotosDaLoja: { origemSupabase: origemSupabase(c.sb), lojaId },
      graduadorasValidas: GRADUADORAS.map(g => g.slug),
      prazo: true,
    })
    if (!v.ok) return json(400, { error: v.erro })
    const l = v.valor

    const { data: cartas, error: eCarta } = await c.sb
      .from('pokemon_cards')
      .select('id, slug, name, number, set_name, set_total, image_small, image_large')
      .eq('id', l.cardId)
      .limit(1)
    if (eCarta) {
      console.error('[lojas/leiloes/lotes-prazo POST] carta', eCarta.code, eCarta.message)
      return json(500, { error: 'Erro ao ler a carta do catálogo.' })
    }
    const carta = cartas?.[0] as Record<string, unknown> | undefined
    const nome = String(carta?.name ?? '').trim()
    if (!carta || !nome) return json(400, { error: 'Carta não encontrada no catálogo.' })

    const { data: novoId, error: eRpc } = await c.sb.rpc('leilao_criar_lote_prazo', {
      p_loja: lojaId,
      p_dias: dias,
      p_lote: {
        card_id: String(carta.id),
        card_slug: carta.slug ? String(carta.slug) : null,
        card_name: nome,
        card_numero: carta.number ? String(carta.number) + (carta.set_total ? `/${carta.set_total}` : '') : null,
        set_nome: carta.set_name ? String(carta.set_name) : null,
        card_image: (carta.image_large || carta.image_small || null) as string | null,
        slug_base: slugBaseLote(String(carta.slug || nome), l.graduadora, l.nota),
        fotos: l.fotos,
        condicao: l.condicao,
        idioma: l.idioma,
        graduadora: l.graduadora,
        nota: l.nota,
        descricao: l.descricao,
        lance_inicial_cents: l.lanceInicialCents,
      },
    })
    if (eRpc) {
      const e = erroDoPainel(eRpc.message)
      if (e.status === 500) console.error('[lojas/leiloes/lotes-prazo POST] rpc', eRpc.code, eRpc.message)
      return json(e.status, { error: e.status === 500 ? 'Erro ao publicar o leilão.' : e.mensagem })
    }
    return json(200, { ok: true, id: novoId })
  } catch (err) {
    console.error('[lojas/leiloes/lotes-prazo POST] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}

export async function DELETE(req: NextRequest, ctx: Params) {
  try {
    const { id: lojaId } = await ctx.params
    const c = await contextoPainel(req, lojaId)
    if (!c.ok) return c.res
    const loteId = new URL(req.url).searchParams.get('lote_id') || ''
    if (!UUID_RE.test(loteId)) return json(404, { error: 'Leilão não encontrado.' })
    const { data, error } = await c.sb.rpc('leilao_cancelar_lote_prazo', { p_lote: loteId, p_loja: lojaId })
    if (error) {
      console.error('[lojas/leiloes/lotes-prazo DELETE]', error.code, error.message)
      return json(500, { error: 'Erro ao cancelar.' })
    }
    if (data === 'ok') return json(200, { ok: true })
    if (data === 'tem_lance') return json(409, { error: 'Este leilão já recebeu lance e não pode ser cancelado.' })
    if (data === 'fechado') return json(409, { error: 'Este leilão já terminou.' })
    return json(404, { error: 'Leilão não encontrado.' })
  } catch (err) {
    console.error('[lojas/leiloes/lotes-prazo DELETE] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
