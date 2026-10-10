// GET /api/servicos/capas -- as fotos da lista /servicos, de UMA vez, so do DONO.
//
// Para cada pedido do usuario (os mesmos 50 mais recentes que a lista le), a
// carta da capa e a primeira aceita (ou a primeira, se todas foram recusadas),
// na ordem de criacao -- a mesma regra do titulo do card. Devolve:
//   oficial  imagem do catalogo pelo card_id (URL publica e estavel: pode passar
//            pelo next/image). Sem card_id, null. Nunca casar por nome.
//   cliente  a foto de frente que o cliente enviou (URL assinada, 10 min).
//   antes / depois  entrada difusa frente e saida difusa frente (assinadas),
//            SO em restauracao/completo com a carta pronta (status de relatorio
//            menos devolvida_sem_servico): antes disso a saida e rascunho.
//   entrada  se ja existe foto de entrada da bancada (so o booleano).
//
// Custo: 4 leituras + 1 createSignedUrls em lote. As fotos assinadas vao para
// <img> simples no cliente, FORA do otimizador da Vercel (decisao do Du): a URL
// muda a cada 10 min e cada carga viraria uma transformacao nova.
// Nenhum path de bucket sai daqui, so a URL assinada.

import { NextRequest, NextResponse } from 'next/server'
import { sbAdmin, usuarioDoToken, BUCKET_SERVICOS } from '@/lib/servicosServer'
import { STATUS_RELATORIO } from '@/lib/servicos'

export const dynamic = 'force-dynamic'

const VALIDADE_S = 600
const MIMES_FOTO = ['image/jpeg', 'image/png', 'image/webp']
const SEM_CACHE = { 'Cache-Control': 'no-store' }

interface CapaServico {
  oficial: string | null
  cliente: string | null
  antes: string | null
  depois: string | null
  entrada: boolean
}

export async function GET(req: NextRequest) {
  try {
    const user = await usuarioDoToken(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401, headers: SEM_CACHE })

    const sb = sbAdmin()
    const { data: sols, error: e0 } = await sb.from('servico_solicitacoes')
      .select('id, servico, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (e0) throw new Error(e0.message)
    if (!sols?.length) return NextResponse.json({ capas: {} }, { headers: SEM_CACHE })

    const ids = sols.map(s => s.id)
    const [{ data: itens, error: e1 }, { data: midias, error: e2 }] = await Promise.all([
      sb.from('servico_itens').select('id, solicitacao_id, card_id, game, aceito, created_at').in('solicitacao_id', ids).order('created_at'),
      sb.from('servico_midias').select('item_id, tipo, posicao, path, mime, created_at')
        .in('solicitacao_id', ids)
        .in('tipo', ['cliente_frente', 'entrada_difusa', 'saida_difusa'])
        .order('created_at'),
    ])
    if (e1 || e2) throw new Error((e1 || e2)!.message)

    // Carta da capa de cada pedido.
    const capaDe = new Map<string, { id: string; card_id: string | null; game: string | null }>()
    for (const sid of ids) {
      const doPedido = (itens || []).filter(i => i.solicitacao_id === sid)
      const it = doPedido.find(i => i.aceito !== false) || doPedido[0]
      if (it) capaDe.set(sid, it)
    }

    // Imagem oficial pelo card_id (busca por chave, so Pokemon por enquanto).
    const cardIds = [...new Set([...capaDe.values()].filter(i => i.card_id && (!i.game || i.game === 'pokemon')).map(i => i.card_id!))]
    const imgPor = new Map<string, string>()
    if (cardIds.length) {
      const { data: cards, error: e3 } = await sb.from('pokemon_cards').select('id, image_small').in('id', cardIds)
      if (e3) console.error('[servicos/capas] catalogo', e3.message)
      for (const c of cards || []) if (c.image_small) imgPor.set(c.id, c.image_small)
    }

    // Foto mais recente de cada slot da carta da capa (a refeita vale).
    const itemCapa = new Set([...capaDe.values()].map(i => i.id))
    const ultima = new Map<string, string>()
    for (const m of midias || []) {
      if (!m.item_id || !itemCapa.has(m.item_id) || !MIMES_FOTO.includes(m.mime)) continue
      if (m.tipo !== 'cliente_frente' && (m.posicao || 'frente') !== 'frente') continue
      ultima.set(`${m.item_id}:${m.tipo}`, m.path)
    }

    const statusPar = (STATUS_RELATORIO as readonly string[]).filter(s => s !== 'devolvida_sem_servico')
    const querPar = (s: { servico: string; status: string }) => s.servico !== 'pre_grading' && statusPar.includes(s.status)

    // So assina o que vai aparecer.
    const paths = new Set<string>()
    for (const s of sols) {
      const it = capaDe.get(s.id)
      if (!it) continue
      const fr = ultima.get(`${it.id}:cliente_frente`)
      if (fr) paths.add(fr)
      if (querPar(s)) {
        const a = ultima.get(`${it.id}:entrada_difusa`), d = ultima.get(`${it.id}:saida_difusa`)
        if (a && d) { paths.add(a); paths.add(d) }
      }
    }
    const urlPor = new Map<string, string>()
    if (paths.size) {
      const { data: assinadas, error: e4 } = await sb.storage.from(BUCKET_SERVICOS).createSignedUrls([...paths], VALIDADE_S)
      if (e4) console.error('[servicos/capas] assinatura', e4.message)
      for (const a of assinadas || []) if (a.path && a.signedUrl) urlPor.set(a.path, a.signedUrl)
    }
    const url = (p: string | undefined) => (p ? urlPor.get(p) || null : null)

    const capas: Record<string, CapaServico> = {}
    for (const s of sols) {
      const it = capaDe.get(s.id)
      if (!it) continue
      const par = querPar(s)
      const antes = par ? url(ultima.get(`${it.id}:entrada_difusa`)) : null
      const depois = par ? url(ultima.get(`${it.id}:saida_difusa`)) : null
      capas[s.id] = {
        oficial: it.card_id ? imgPor.get(it.card_id) || null : null,
        cliente: url(ultima.get(`${it.id}:cliente_frente`)),
        // Par incompleto nao aparece.
        antes: antes && depois ? antes : null,
        depois: antes && depois ? depois : null,
        entrada: (midias || []).some(m => m.item_id === it.id && m.tipo === 'entrada_difusa'),
      }
    }
    return NextResponse.json({ capas, validadeS: VALIDADE_S }, { headers: SEM_CACHE })
  } catch (e) {
    console.error('[servicos/capas GET]', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500, headers: SEM_CACHE })
  }
}
