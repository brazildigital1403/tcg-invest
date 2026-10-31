import { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { GRADUADORAS } from '@/lib/graduadoras'
import { slugBaseLote } from '@/lib/leilao'
import { validarLote, erroDoPainel, caminhoFotoLeilao } from '@/lib/leilao-painel'
import {
  contextoPainel, json, origemSupabase, UUID_RE, COLUNAS_LOTE_PAINEL,
} from '../../_comum'

/**
 * /api/lojas/[id]/leiloes/[rodadaId]/lotes — lotes de uma rodada em rascunho.
 *
 * POST   { card_id, fotos: [frente, verso], condicao, idioma, graduadora?, nota?,
 *          descricao?, lance_inicial_cents, duracao_seg } -> cria no fim da fila
 * DELETE ?lote_id= -> remove (so lote em rascunho de rodada em rascunho) e
 *          apaga do bucket as fotos dele que sejam da pasta leiloes/{lojaId}/
 *
 * ★ A CARTA VEM SO PELO card_id. Nome, numero, set, imagem e slug sao lidos
 *   aqui, por PK, no catalogo (pokemon_cards) -- a tela nunca decide o que o
 *   comprador ve como "carta". Leitura por PK: 1 linha pelo indice, sem varrer
 *   a tabela.
 * ★ FOTOS: so URL publica da pasta leiloes/{lojaId}/ do bucket, no formato
 *   exato que a rota /leiloes/foto devolve (fotoLeilaoValida: mesmo origin do
 *   Supabase, sem query/hash/"..", nome {uuid}.ext). Frente e verso.
 * ★ INSERT PELA RPC leilao_adicionar_lote (migration 20260928120000): trava a
 *   rodada (for update), exige rascunho, calcula ordem = max + 1 e insere na
 *   mesma transacao. O agendar trava a mesma linha, entao nao ha janela em
 *   que uma rodada agendada ganhe lote em rascunho, e duas inclusoes juntas
 *   enfileiram em vez de bater no indice unico (rodada_id, ordem). O codigo
 *   do lote nasce no banco e fecha o slug. Rodada inexistente, de outra loja
 *   ou fora do rascunho: quem responde e a RPC (404 / 409).
 */

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; rodadaId: string }> }

const GRADUADORAS_SLUGS = GRADUADORAS.map(g => g.slug)

async function statusRodada(sb: SupabaseClient, lojaId: string, rodadaId: string): Promise<string | null> {
  const { data, error } = await sb
    .from('leilao_rodadas')
    .select('status')
    .eq('id', rodadaId)
    .eq('loja_id', lojaId)
    .limit(1)
  if (error) throw new Error(`rodada: ${error.message}`)
  return (data?.[0] as { status?: string } | undefined)?.status ?? null
}

export async function POST(req: NextRequest, ctx: Params) {
  try {
    const { id: lojaId, rodadaId } = await ctx.params
    const c = await contextoPainel(req, lojaId)
    if (!c.ok) return c.res
    if (!UUID_RE.test(rodadaId)) return json(404, { error: 'Rodada não encontrada.' })
    if (c.loja.status !== 'ativa') return json(403, { error: 'Sua loja precisa estar ativa.' })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json(400, { error: 'Requisição inválida.' })
    const v = validarLote(body as Record<string, unknown>, {
      fotosDaLoja: { origemSupabase: origemSupabase(c.sb), lojaId },
      graduadorasValidas: GRADUADORAS_SLUGS,
    })
    if (!v.ok) return json(400, { error: v.erro })
    const l = v.valor

    // Carta do catalogo, por PK.
    const { data: cartas, error: eCarta } = await c.sb
      .from('pokemon_cards')
      .select('id, slug, name, number, set_name, set_total, image_small, image_large')
      .eq('id', l.cardId)
      .limit(1)
    if (eCarta) {
      console.error('[lojas/leiloes/lotes POST] carta', eCarta.code, eCarta.message)
      return json(500, { error: 'Erro ao ler a carta do catálogo.' })
    }
    const carta = cartas?.[0] as Record<string, unknown> | undefined
    if (!carta) return json(400, { error: 'Carta não encontrada no catálogo.' })

    const nome = String(carta.name ?? '').trim()
    if (!nome) return json(400, { error: 'Carta sem nome no catálogo.' })
    const numero = carta.number
      ? String(carta.number) + (carta.set_total ? `/${carta.set_total}` : '')
      : null

    // Insert sob a trava da rodada (leilao_adicionar_lote): confere rascunho,
    // calcula a ordem e grava na mesma transacao -- o agendar espera.
    const { data: novoId, error: eRpc } = await c.sb.rpc('leilao_adicionar_lote', {
      p_rodada: rodadaId,
      p_loja: lojaId,
      p_lote: {
        card_id: String(carta.id),
        card_slug: carta.slug ? String(carta.slug) : null,
        card_name: nome,
        card_numero: numero,
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
        duracao_seg: l.duracaoSeg,
      },
    })
    if (eRpc) {
      if (/\brodada_nao_rascunho\b/.test(eRpc.message)) {
        return json(409, { error: 'Só é possível adicionar lote com a rodada em rascunho.' })
      }
      const e = erroDoPainel(eRpc.message)
      if (e.status === 500) console.error('[lojas/leiloes/lotes POST] rpc', eRpc.code, eRpc.message)
      return json(e.status, { error: e.status === 500 ? 'Erro ao adicionar o lote.' : e.mensagem })
    }

    const { data: criadoRows, error: eLer } = await c.sb
      .from('leiloes')
      .select(COLUNAS_LOTE_PAINEL)
      .eq('id', String(novoId))
      .limit(1)
    if (eLer) throw new Error(`lote criado: ${eLer.message}`)
    const criado = criadoRows?.[0] ?? null
    return json(200, { ok: true, lote: criado })
  } catch (err) {
    console.error('[lojas/leiloes/lotes POST] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}

/**
 * Apaga do bucket as fotos do lote removido. So o que passa em
 * caminhoFotoLeilao (mesma validacao de fotoLeilaoValida: pasta
 * leiloes/{lojaId}/ desta loja, nome {uuid}.ext) vira caminho; o resto e
 * ignorado. Foto que outro lote da loja ainda usa fica. Qualquer falha so
 * loga: o lote ja foi removido e a resposta nao muda por causa do arquivo.
 */
async function apagarFotos(sb: SupabaseClient, lojaId: string, fotos: unknown) {
  try {
    const urls = Array.isArray(fotos) ? fotos.filter((u): u is string => typeof u === 'string') : []
    const origem = origemSupabase(sb)
    const alvos: string[] = []
    for (const url of new Set(urls)) {
      const caminho = caminhoFotoLeilao(url, origem, lojaId)
      if (!caminho) continue
      const { data: emUso, error } = await sb
        .from('leiloes')
        .select('id')
        .eq('loja_id', lojaId)
        // jsonb: o filtro vai como JSON ("cs.[...]"), nao como array do Postgres.
        .contains('fotos', JSON.stringify([url]))
        .limit(1)
      if (error) {
        console.error('[lojas/leiloes/lotes DELETE] conferir foto', error.code, error.message)
        continue
      }
      if (emUso && emUso.length > 0) continue
      alvos.push(caminho)
    }
    if (alvos.length === 0) return
    const { error } = await sb.storage.from('loja-fotos').remove(alvos)
    if (error) console.error('[lojas/leiloes/lotes DELETE] apagar fotos', alvos.length, error.message)
  } catch (err) {
    console.error('[lojas/leiloes/lotes DELETE] apagar fotos erro:', (err as Error)?.message)
  }
}

export async function DELETE(req: NextRequest, ctx: Params) {
  try {
    const { id: lojaId, rodadaId } = await ctx.params
    const c = await contextoPainel(req, lojaId)
    if (!c.ok) return c.res
    if (!UUID_RE.test(rodadaId)) return json(404, { error: 'Rodada não encontrada.' })

    const loteId = new URL(req.url).searchParams.get('lote_id') || ''
    if (!UUID_RE.test(loteId)) return json(400, { error: 'Lote não informado.' })

    const st = await statusRodada(c.sb, lojaId, rodadaId)
    if (!st) return json(404, { error: 'Rodada não encontrada.' })
    if (st !== 'rascunho') {
      return json(409, { error: 'Só é possível remover lote com a rodada em rascunho. Para desistir, cancele a rodada.' })
    }

    // Lote em rascunho nao tem lance, evento nem pedido: remover e seguro.
    const { data, error } = await c.sb
      .from('leiloes')
      .delete()
      .eq('id', loteId)
      .eq('rodada_id', rodadaId)
      .eq('loja_id', lojaId)
      .eq('status', 'rascunho')
      .select('id, fotos')
    if (error) {
      console.error('[lojas/leiloes/lotes DELETE]', error.code, error.message)
      return json(500, { error: 'Erro ao remover o lote.' })
    }
    if (!data || data.length === 0) return json(404, { error: 'Lote não encontrado.' })

    await apagarFotos(c.sb, lojaId, (data[0] as { fotos?: unknown }).fotos)
    return json(200, { ok: true })
  } catch (err) {
    console.error('[lojas/leiloes/lotes DELETE] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
