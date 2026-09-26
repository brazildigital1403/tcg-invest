// Painel admin de UMA solicitacao do servico de bancada.
//
// GET  -> tudo para trabalhar o pedido: solicitacao, cliente, cartas, linha do
//         tempo e midias ja com link assinado (10 min, bucket privado).
// POST -> uma acao por vez, { acao, ... }:
//   orcar           aguardando_orcamento|orcado -> orcado | recusado_bynx
//   status          qualquer transicao de TRANSICOES_ADMIN (custodia na chegada,
//                   rastreio de volta no envio)
//   pagamento       marca Pix combinado fora do site
//   laudo           grava o laudo de uma carta
//   midia_url       URL assinada para o admin subir foto/video/laudo
//   midia_confirmar confere o arquivo no bucket e registra
// Toda mudanca de status filtra pelo status atual no update: duas abas
// abertas nao passam a mesma transicao duas vezes.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { sbAdmin, erro, registrarEvento, notificarCliente, BUCKET_SERVICOS } from '@/lib/servicosServer'
import { TRANSICOES_ADMIN, STATUS_SERVICO, MIDIAS_ADMIN, CAMPOS_LAUDO } from '@/lib/servicos'

export const dynamic = 'force-dynamic'

const MIMES_ADMIN = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'application/pdf']
const MAX_ADMIN_BYTES = 50 * 1024 * 1024
const CENTS_MAX = 100_000_000

function cents(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n <= CENTS_MAX ? n : NaN
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  try {
    const { id } = await ctx.params
    const sb = sbAdmin()
    const { data: solRows } = await sb.from('servico_solicitacoes').select('*').eq('id', id).limit(1)
    const sol = solRows?.[0]
    if (!sol) return erro(404, 'Solicitação não encontrada')

    const [{ data: user }, { data: itens }, { data: eventos }, { data: midias }] = await Promise.all([
      sb.from('users').select('id, name, email').eq('id', sol.user_id).limit(1),
      sb.from('servico_itens').select('*').eq('solicitacao_id', id).order('created_at'),
      sb.from('servico_eventos').select('*').eq('solicitacao_id', id).order('created_at'),
      sb.from('servico_midias').select('*').eq('solicitacao_id', id).order('created_at'),
    ])

    const paths = (midias || []).map(m => m.path)
    const { data: assinadas } = paths.length
      ? await sb.storage.from(BUCKET_SERVICOS).createSignedUrls(paths, 600)
      : { data: [] as { path: string | null; signedUrl: string }[] }
    const urlPor = new Map((assinadas || []).map(a => [a.path, a.signedUrl]))

    return NextResponse.json({
      solicitacao: sol,
      cliente: user?.[0] || null,
      itens: itens || [],
      eventos: eventos || [],
      midias: (midias || []).map(m => ({ ...m, url: urlPor.get(m.path) || null })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[admin/servicos/id GET]', e instanceof Error ? e.message : e)
    return erro(500, 'Erro ao carregar')
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return erro(400, 'Dados inválidos')
    const sb = sbAdmin()

    const { data: solRows } = await sb.from('servico_solicitacoes').select('id, status').eq('id', id).limit(1)
    const sol = solRows?.[0]
    if (!sol) return erro(404, 'Solicitação não encontrada')

    // ── Orcar ──────────────────────────────────────────────────────────────
    if (body.acao === 'orcar') {
      if (!['aguardando_orcamento', 'orcado'].includes(sol.status)) return erro(409, 'Só dá para orçar antes do aceite')
      const { data: itens } = await sb.from('servico_itens').select('id').eq('solicitacao_id', id)
      const decisoes = new Map<string, { aceito: boolean; motivo: string | null }>()
      for (const d of (Array.isArray(body.itens) ? body.itens : []) as { id?: unknown; aceito?: unknown; recusa_motivo?: unknown }[]) {
        decisoes.set(String(d.id), { aceito: d.aceito !== false, motivo: typeof d.recusa_motivo === 'string' ? d.recusa_motivo.trim().slice(0, 300) : null })
      }
      const recusadas = (itens || []).filter(i => decisoes.get(i.id)?.aceito === false)
      if (recusadas.some(i => !decisoes.get(i.id)?.motivo)) return erro(400, 'Diga o motivo de cada carta recusada')
      const todasRecusadas = recusadas.length === (itens || []).length

      const orc = cents(body.orcamento_cents)
      const seguro = cents(body.seguro_cents)
      const frete = cents(body.frete_volta_cents)
      if ([orc, seguro, frete].some(v => Number.isNaN(v))) return erro(400, 'Valor inválido')
      if (!todasRecusadas && !orc) return erro(400, 'Informe o valor do serviço')
      const total = todasRecusadas ? null : (orc || 0) + (seguro || 0) + (frete || 0)
      const para = todasRecusadas ? 'recusado_bynx' : 'orcado'

      for (const i of itens || []) {
        const d = decisoes.get(i.id)
        await sb.from('servico_itens').update(
          d?.aceito === false ? { aceito: false, recusa_motivo: d.motivo } : { aceito: null, recusa_motivo: null },
        ).eq('id', i.id)
      }
      const { data, error } = await sb.from('servico_solicitacoes').update({
        status: para,
        orcamento_cents: todasRecusadas ? null : orc,
        seguro_cents: todasRecusadas ? null : seguro,
        frete_volta_cents: todasRecusadas ? null : frete,
        total_cents: total,
        orcamento_obs: typeof body.obs === 'string' ? body.obs.trim().slice(0, 2000) || null : null,
        orcado_em: new Date().toISOString(),
      }).eq('id', id).eq('status', sol.status).select('id')
      if (error) throw new Error(error.message)
      if (!data?.length) return erro(409, 'O pedido mudou enquanto você orçava. Recarregue.')
      await registrarEvento(id, para, todasRecusadas
        ? 'Nenhuma carta pode ser tratada'
        : `Orçamento de R$ ${((total || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${recusadas.length ? `, ${recusadas.length} ${recusadas.length === 1 ? 'carta recusada' : 'cartas recusadas'}` : ''}`)
      // Re-orcar (orcado -> orcado) tambem avisa: o cliente precisa ver o valor novo.
      await notificarCliente(id, para)
      return NextResponse.json({ ok: true, status: para })
    }

    // ── Mudar status ───────────────────────────────────────────────────────
    if (body.acao === 'status') {
      const para = String(body.para || '')
      if (!(TRANSICOES_ADMIN[sol.status] || []).includes(para)) {
        return erro(409, `Não dá para ir de "${STATUS_SERVICO[sol.status]}" para "${STATUS_SERVICO[para] || para}"`)
      }
      const nota = typeof body.nota === 'string' ? body.nota.trim().slice(0, 500) : ''
      const extra: Record<string, unknown> = {}

      if (para === 'enviada') {
        const codigo = String(body.rastreio_volta || '').toUpperCase().replace(/[\s.-]/g, '')
        if (!/^[A-Z0-9]{8,30}$/.test(codigo)) return erro(400, 'Informe o código de rastreio da volta')
        extra.rastreio_volta = codigo
        const lacre = String(body.lacre_volta || '').trim().slice(0, 40)
        if (lacre) extra.lacre_volta = lacre
      }

      const { data, error } = await sb.from('servico_solicitacoes').update({ status: para, ...extra })
        .eq('id', id).eq('status', sol.status).select('id')
      if (error) throw new Error(error.message)
      if (!data?.length) return erro(409, 'O pedido mudou em outra aba. Recarregue.')

      // Chegada: cada carta aceita ganha o numero de custodia (BX-R-0001...).
      // Proximo numero = maior existente + 1; o unique da coluna segura corrida.
      if (para === 'recebida') {
        const { data: sem } = await sb.from('servico_itens').select('id, aceito, custodia')
          .eq('solicitacao_id', id).is('custodia', null).order('created_at')
        for (const it of (sem || []).filter(i => i.aceito !== false)) {
          for (let tentativa = 0; tentativa < 3; tentativa++) {
            const { data: ult } = await sb.from('servico_itens').select('custodia').not('custodia', 'is', null)
              .order('custodia', { ascending: false }).limit(1)
            const n = Number(String(ult?.[0]?.custodia || 'BX-R-0000').replace(/\D/g, '')) + 1
            const { error: e2 } = await sb.from('servico_itens').update({ custodia: `BX-R-${String(n).padStart(4, '0')}` }).eq('id', it.id)
            if (!e2) break
          }
        }
      }

      const notaFinal = [
        para === 'aceito' ? 'Aceite registrado pelo admin' : '',
        para === 'enviada' ? `Rastreio de volta: ${extra.rastreio_volta}` : '',
        nota,
      ].filter(Boolean).join('. ')
      await registrarEvento(id, para, notaFinal || undefined)
      if (para === 'aceito' || para === 'recebida' || para === 'pronta' || para === 'enviada') await notificarCliente(id, para)
      return NextResponse.json({ ok: true, status: para })
    }

    // ── Pagamento (Pix combinado fora do site) ──────────────────────────────
    if (body.acao === 'pagamento') {
      if (!['orcado', 'aceito', 'recebida', 'em_bancada', 'descansando', 'pronta'].includes(sol.status)) return erro(409, 'Pagamento não se aplica a este status')
      const { error } = await sb.from('servico_solicitacoes')
        .update({ pagamento_metodo: 'pix_manual', pago_em: new Date().toISOString() }).eq('id', id)
      if (error) throw new Error(error.message)
      await registrarEvento(id, sol.status, 'Pagamento via Pix confirmado')
      return NextResponse.json({ ok: true })
    }

    // ── Laudo de uma carta ─────────────────────────────────────────────────
    if (body.acao === 'laudo') {
      const itemId = String(body.item_id || '')
      const entrada = (body.laudo && typeof body.laudo === 'object' ? body.laudo : {}) as Record<string, unknown>
      const laudo: Record<string, string> = {}
      for (const c of CAMPOS_LAUDO) {
        const v = entrada[c.k]
        if (typeof v === 'string' && v.trim()) laudo[c.k] = v.trim().slice(0, c.k === 'caderno' ? 2000 : 200)
      }
      const { data, error } = await sb.from('servico_itens')
        .update({ laudo: Object.keys(laudo).length ? laudo : null }).eq('id', itemId).eq('solicitacao_id', id).select('id')
      if (error) throw new Error(error.message)
      if (!data?.length) return erro(404, 'Carta não encontrada neste pedido')
      return NextResponse.json({ ok: true })
    }

    // ── Midia do admin: URL de upload ──────────────────────────────────────
    if (body.acao === 'midia_url' || body.acao === 'midia_confirmar') {
      const tipo = String(body.tipo || '')
      const def = MIDIAS_ADMIN.find(m => m.tipo === tipo)
      if (!def) return erro(400, 'Tipo de arquivo inválido')
      const itemId = def.porItem ? String(body.item_id || '') : null
      if (itemId) {
        const { data: it } = await sb.from('servico_itens').select('id').eq('id', itemId).eq('solicitacao_id', id).limit(1)
        if (!it?.[0]) return erro(404, 'Carta não encontrada neste pedido')
      }

      if (body.acao === 'midia_url') {
        const mime = String(body.mime || '')
        if (!MIMES_ADMIN.includes(mime)) return erro(400, 'Formato não aceito')
        const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'application/pdf': 'pdf' }[mime]
        const path = `${id}/admin/${tipo}-${crypto.randomUUID()}.${ext}`
        const { data, error } = await sb.storage.from(BUCKET_SERVICOS).createSignedUploadUrl(path)
        if (error || !data) throw new Error(error?.message || 'sem url')
        return NextResponse.json({ path: data.path, token: data.token })
      }

      const path = String(body.path || '')
      const nome = path.slice(`${id}/admin/`.length)
      if (!path.startsWith(`${id}/admin/${tipo}-`) || !/^[a-z_]+-[0-9a-f-]{36}\.(jpg|png|webp|mp4|mov|pdf)$/.test(nome)) return erro(400, 'Caminho inválido')
      const { data: lista } = await sb.storage.from(BUCKET_SERVICOS).list(`${id}/admin`, { search: nome, limit: 1 })
      const obj = lista?.find(o => o.name === nome)
      if (!obj) return erro(400, 'O arquivo não chegou no armazenamento')
      const tamanho = Number(obj.metadata?.size || 0)
      const mime = String(obj.metadata?.mimetype || '')
      if (!MIMES_ADMIN.includes(mime) || tamanho <= 0 || tamanho > MAX_ADMIN_BYTES) {
        await sb.storage.from(BUCKET_SERVICOS).remove([path]).catch(() => {})
        return erro(400, 'Arquivo fora do formato ou acima de 50 MB')
      }
      const { error } = await sb.from('servico_midias').upsert(
        { solicitacao_id: id, item_id: itemId, tipo, path, mime, tamanho },
        { onConflict: 'path', ignoreDuplicates: true },
      )
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    return erro(400, 'Ação desconhecida')
  } catch (e) {
    console.error('[admin/servicos/id POST]', e instanceof Error ? e.message : e)
    return erro(500, 'Erro interno')
  }
}
