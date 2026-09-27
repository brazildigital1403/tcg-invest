import { randomInt } from 'node:crypto'
import { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { GRADUADORAS } from '@/lib/graduadoras'
import { slugLote } from '@/lib/leilao'
import { validarLote } from '@/lib/leilao-painel'
import {
  contextoPainel, json, prefixoFotos, UUID_RE, COLUNAS_LOTE_PAINEL,
} from '../../_comum'

/**
 * /api/lojas/[id]/leiloes/[rodadaId]/lotes — lotes de uma rodada em rascunho.
 *
 * POST   { card_id, fotos: [frente, verso], condicao, idioma, graduadora?, nota?,
 *          descricao?, lance_inicial_cents, duracao_seg } -> cria no fim da fila
 * DELETE ?lote_id= -> remove (so lote em rascunho de rodada em rascunho)
 *
 * ★ A CARTA VEM SO PELO card_id. Nome, numero, set, imagem e slug sao lidos
 *   aqui, por PK, no catalogo (pokemon_cards) -- a tela nunca decide o que o
 *   comprador ve como "carta". Leitura por PK: 1 linha pelo indice, sem varrer
 *   a tabela.
 * ★ FOTOS: so URL da pasta leiloes/{lojaId}/ do bucket (subida pela rota
 *   /leiloes/foto). Frente e verso, as duas obrigatorias.
 * ★ ORDEM: max + 1. Duas inclusoes juntas batem no indice unico
 *   (rodada_id, ordem) e a segunda tenta de novo; o codigo (unico) idem.
 * ★ CORRIDA COM O AGENDAR: a rodada e conferida em rascunho antes e DEPOIS do
 *   insert. Se o agendar passou no meio, o lote recem-criado e removido e a
 *   rota responde 409 -- rodada agendada nao fica com lote em rascunho (o
 *   motor nao encerra rodada assim).
 */

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; rodadaId: string }> }

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz'
function novoCodigo(): string {
  let s = ''
  for (let i = 0; i < 6; i++) s += BASE36[randomInt(36)]
  return s
}

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

    const st = await statusRodada(c.sb, lojaId, rodadaId)
    if (!st) return json(404, { error: 'Rodada não encontrada.' })
    if (st !== 'rascunho') return json(409, { error: 'Só é possível adicionar lote com a rodada em rascunho.' })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json(400, { error: 'Requisição inválida.' })
    const v = validarLote(body as Record<string, unknown>, {
      fotosPermitidas: prefixoFotos(c.sb, lojaId),
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

    let criado: Record<string, unknown> | null = null
    for (let tentativa = 0; tentativa < 3 && !criado; tentativa++) {
      const { data: ult, error: eOrd } = await c.sb
        .from('leiloes')
        .select('ordem')
        .eq('rodada_id', rodadaId)
        .order('ordem', { ascending: false })
        .limit(1)
      if (eOrd) throw new Error(`ordem: ${eOrd.message}`)
      const ordem = (Number((ult?.[0] as { ordem?: number } | undefined)?.ordem) || 0) + 1
      const codigo = novoCodigo()

      const { data, error } = await c.sb
        .from('leiloes')
        .insert({
          codigo,
          slug: slugLote(String(carta.slug || nome), l.graduadora, l.nota, codigo),
          rodada_id: rodadaId,
          ordem,
          vendedor_user_id: c.loja.owner_user_id,
          loja_id: lojaId,
          card_id: String(carta.id),
          card_slug: carta.slug ? String(carta.slug) : null,
          card_name: nome,
          card_numero: numero,
          set_nome: carta.set_name ? String(carta.set_name) : null,
          card_image: (carta.image_large || carta.image_small || null) as string | null,
          fotos: l.fotos,
          condicao: l.condicao,
          idioma: l.idioma,
          graduadora: l.graduadora,
          nota: l.nota,
          descricao: l.descricao,
          lance_inicial_cents: l.lanceInicialCents,
          duracao_seg: l.duracaoSeg,
          soft_close_seg: 10,
          status: 'rascunho',
        })
        .select(COLUNAS_LOTE_PAINEL)
        .single()
      if (!error && data) {
        criado = data as unknown as Record<string, unknown>
        break
      }
      if (error?.code !== '23505') {
        console.error('[lojas/leiloes/lotes POST] insert', error?.code, error?.message)
        return json(500, { error: 'Erro ao adicionar o lote.' })
      }
    }
    if (!criado) return json(409, { error: 'Muitas alterações ao mesmo tempo. Tente de novo.' })

    // O agendar pode ter passado entre a primeira conferencia e o insert.
    const depois = await statusRodada(c.sb, lojaId, rodadaId)
    if (depois !== 'rascunho') {
      await c.sb.from('leiloes').delete().eq('id', criado.id as string).eq('status', 'rascunho')
      return json(409, { error: 'A rodada saiu do rascunho enquanto o lote era salvo. Nada foi adicionado.' })
    }
    return json(200, { ok: true, lote: criado })
  } catch (err) {
    console.error('[lojas/leiloes/lotes POST] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
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
      .select('id')
    if (error) {
      console.error('[lojas/leiloes/lotes DELETE]', error.code, error.message)
      return json(500, { error: 'Erro ao remover o lote.' })
    }
    if (!data || data.length === 0) return json(404, { error: 'Lote não encontrado.' })
    return json(200, { ok: true })
  } catch (err) {
    console.error('[lojas/leiloes/lotes DELETE] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
