// POST /api/servicos/[id]/fotos -- confirma as fotos que o navegador subiu.
//
// Body: { fotos: [{ item_id, slot, path }] }. Para cada uma, confere que o
// caminho e desta solicitacao/carta/slot, que o objeto EXISTE no bucket e que
// tipo e tamanho batem; so entao registra em servico_midias. Arquivo fora da
// regra e apagado do bucket. Idempotente: confirmar de novo nao duplica.
//
// Quando frente e verso de todas as cartas estao registradas, a solicitacao
// fica completa e o admin recebe um e-mail -- uma vez so (marcado por evento).

import { NextRequest, NextResponse } from 'next/server'
import { sendNovaSolicitacaoServicoAdminEmail } from '@/lib/email'
import {
  sbAdmin, carregarAutorizado, erro, registrarEvento, numeroSolicitacao,
  BUCKET_SERVICOS, FOTO_MAX_BYTES, FOTO_MIMES, SLOTS, SLOTS_OBRIGATORIOS, TIPO_POR_SLOT, type Slot,
} from '@/lib/servicosServer'

export const dynamic = 'force-dynamic'

const NOMES_SERVICO: Record<string, string> = {
  restauracao: 'Restauração',
  pre_grading: 'Pré-grading',
  completo: 'Restauração + pré-grading',
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const auth = await carregarAutorizado(req, id)
    if (!auth.ok) return auth.resposta
    if (auth.sol.status !== 'aguardando_orcamento') return erro(409, 'Este pedido já foi orçado')

    const body = await req.json().catch(() => null)
    const fotos = Array.isArray(body?.fotos) ? body.fotos.slice(0, 80) : []
    if (!fotos.length) return erro(400, 'Nenhuma foto informada')

    const sb = sbAdmin()
    const { data: itens } = await sb.from('servico_itens').select('id, nome, queixas, valor_declarado_cents').eq('solicitacao_id', id)
    const itensIds = new Set((itens || []).map(i => i.id))

    const rejeitadas: string[] = []
    for (const f of fotos as { item_id?: unknown; slot?: unknown; path?: unknown }[]) {
      const itemId = String(f.item_id || '')
      const slot = String(f.slot || '') as Slot
      const path = String(f.path || '')
      if (!itensIds.has(itemId) || !SLOTS.includes(slot)) { rejeitadas.push(path); continue }

      // O caminho precisa ser exatamente o que a rota emitiu para esta carta e slot.
      const pasta = `${id}/${itemId}`
      const nome = path.slice(pasta.length + 1)
      if (!path.startsWith(`${pasta}/${slot}-`) || !/^[a-z]+-[0-9a-f-]{36}\.(webp|jpg|png)$/.test(nome)) {
        rejeitadas.push(path); continue
      }

      const { data: lista } = await sb.storage.from(BUCKET_SERVICOS).list(pasta, { search: nome, limit: 1 })
      const obj = lista?.find(o => o.name === nome)
      if (!obj) { rejeitadas.push(path); continue }

      const tamanho = Number(obj.metadata?.size || 0)
      const mime = String(obj.metadata?.mimetype || '')
      if (!FOTO_MIMES.includes(mime) || tamanho <= 0 || tamanho > FOTO_MAX_BYTES) {
        await sb.storage.from(BUCKET_SERVICOS).remove([path]).catch(() => {})
        rejeitadas.push(path); continue
      }

      const { error } = await sb.from('servico_midias').upsert(
        { solicitacao_id: id, item_id: itemId, tipo: TIPO_POR_SLOT[slot], path, mime, tamanho },
        { onConflict: 'path', ignoreDuplicates: true },
      )
      if (error) { console.error('[servicos/fotos] midia', error.message); rejeitadas.push(path) }
    }

    // Completa = frente e verso registrados em todas as cartas.
    const { data: midias } = await sb.from('servico_midias').select('item_id, tipo').eq('solicitacao_id', id)
    const tipos = new Map<string, Set<string>>()
    for (const m of midias || []) {
      if (!m.item_id) continue
      if (!tipos.has(m.item_id)) tipos.set(m.item_id, new Set())
      tipos.get(m.item_id)!.add(m.tipo)
    }
    const completa = (itens || []).every(i => SLOTS_OBRIGATORIOS.every(s => tipos.get(i.id)?.has(TIPO_POR_SLOT[s])))

    if (completa) {
      // Aviso ao admin uma vez so: o evento 'fotos_completas' e a trava.
      const { count } = await sb
        .from('servico_eventos')
        .select('id', { count: 'exact', head: true })
        .eq('solicitacao_id', id)
        .eq('status', 'fotos_completas')
      if (!count) {
        await registrarEvento(id, 'fotos_completas', 'Fotos recebidas, aguardando orçamento')
        const destino = process.env.ADMIN_EMAIL
        if (destino) {
          const { data: sol } = await sb.from('servico_solicitacoes').select('whatsapp').eq('id', id).limit(1)
          const { data: u } = await sb.from('users').select('name, email').eq('id', auth.sol.user_id).limit(1)
          await sendNovaSolicitacaoServicoAdminEmail({
            to: destino,
            numero: numeroSolicitacao(auth.sol.numero),
            servico: NOMES_SERVICO[auth.sol.servico] || auth.sol.servico,
            userEmail: u?.[0]?.email || auth.user?.email || '',
            userName: u?.[0]?.name || undefined,
            whatsapp: sol?.[0]?.whatsapp || null,
            cartas: (itens || []).map(i => ({ nome: i.nome, valor: i.valor_declarado_cents / 100, queixas: i.queixas || [] })),
            valorTotal: (itens || []).reduce((s, i) => s + i.valor_declarado_cents, 0) / 100,
          }).catch(e => console.error('[servicos/fotos] email admin', e?.message))
        }
      }
    }

    return NextResponse.json({ ok: true, completa, rejeitadas })
  } catch (e) {
    console.error('[servicos/fotos]', e instanceof Error ? e.message : e)
    return erro(500, 'Erro interno')
  }
}
