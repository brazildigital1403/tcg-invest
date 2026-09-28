// Painel admin de UMA solicitacao do servico de bancada.
//
// GET  -> tudo para trabalhar o pedido: solicitacao, cliente, cartas, linha do
//         tempo e midias ja com link assinado (10 min, bucket privado).
// POST -> uma acao por vez, { acao, ... }:
//   orcar           aguardando_orcamento|orcado -> orcado | recusado_bynx
//   status          qualquer transicao de TRANSICOES_ADMIN (custodia na chegada,
//                   rastreio de volta no envio)
//   pagamento       marca Pix combinado fora do site
//   estornar        estorno de uma etapa paga: cartao na Stripe (primeiro) e
//                   depois no banco; Pix so registra a devolucao feita no banco
//   laudo           grava o laudo de uma carta
//   ficha           ficha de condicao de entrada ou saida de uma carta
//   procedimentos   rascunho da proposta de tratamento de uma carta
//   enviar_proposta recebida -> proposta (exige ficha, fotos e video de entrada)
//   midia_url       URL assinada para o admin subir foto/video/laudo
//   midia_confirmar confere o arquivo no bucket e registra
// Toda mudanca de status filtra pelo status atual no update: duas abas
// abertas nao passam a mesma transicao duas vezes.

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { requireAdmin } from '@/lib/admin-auth'
import {
  sbAdmin, erro, registrarEvento, notificarCliente, BUCKET_SERVICOS, sincronizarPagamentos, pagamentosDoPedido,
  confirmarPagamento, aposConfirmarPagamento, aposEstorno, notificarAdmin, pendencias, ROTULO_ETAPA, type EtapaPagamento,
} from '@/lib/servicosServer'
import {
  TRANSICOES_ADMIN, STATUS_SERVICO, MIDIAS_ADMIN, CAMPOS_LAUDO, RISCOS,
  validarFicha, lerFaixaNota, lerGraduadora, STATUS_EXPRESSO_EM_ANDAMENTO, brl,
} from '@/lib/servicos'

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

    const [{ data: user }, { data: itens }, { data: eventos }, { data: midias }, { data: procs }] = await Promise.all([
      sb.from('users').select('id, name, email').eq('id', sol.user_id).limit(1),
      sb.from('servico_itens').select('*').eq('solicitacao_id', id).order('created_at'),
      sb.from('servico_eventos').select('*').eq('solicitacao_id', id).order('created_at'),
      sb.from('servico_midias').select('*').eq('solicitacao_id', id).order('created_at'),
      sb.from('servico_procedimentos').select('*').eq('solicitacao_id', id).order('ordem'),
    ])

    // Pedido padrao atras de um expresso do mesmo cliente: a fila da bancada
    // manda terminar e enviar o expresso antes.
    const { data: expressos } = sol.prazo === 'padrao'
      ? await sb.from('servico_solicitacoes').select('id, numero').eq('user_id', sol.user_id).eq('prazo', 'expresso')
        .in('status', [...STATUS_EXPRESSO_EM_ANDAMENTO]).order('numero').limit(3)
      : { data: [] as { id: string; numero: number }[] }

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
      procedimentos: procs || [],
      fila_expresso: (expressos || []).map(e => ({ id: e.id, numero: e.numero })),
      pagamentos: await pagamentosDoPedido(id),
      pendencias_entrada: ['recebida'].includes(sol.status) ? await pendencias(sb, id, sol.servico, 'entrada') : [],
      pendencias_saida: ['em_bancada', 'descansando'].includes(sol.status) ? await pendencias(sb, id, sol.servico, 'saida') : [],
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

    const { data: solRows } = await sb.from('servico_solicitacoes').select('id, status, pago_em, servico, proposta_aceita_em').eq('id', id).limit(1)
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
      // Etapas de pagamento nascem (ou se ajustam, se ainda nao pagas) com o orcamento.
      if (para === 'orcado') await sincronizarPagamentos(id)
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

      // Bancada: pre-grading vai direto da chegada (nao ha tratamento a propor),
      // com a entrada completa; restauracao/completo so depois da proposta decidida.
      if (para === 'em_bancada' && sol.status === 'recebida') {
        if (sol.servico !== 'pre_grading') return erro(409, 'Envie a proposta de tratamento antes da bancada')
        const f = await pendencias(sb, id, sol.servico, 'entrada')
        if (f.length) return erro(409, `Falta: ${f.join(', ')}`)
        const integral = (await pagamentosDoPedido(id)).find(l => l.etapa === 'integral')
        if (integral && !integral.pago_em) return erro(409, 'Confirme o pagamento antes da bancada')
      }
      if (para === 'em_bancada' && sol.status === 'proposta') {
        if (!sol.proposta_aceita_em) return erro(409, 'O cliente ainda não decidiu a proposta')
        const { count } = await sb.from('servico_procedimentos').select('id', { count: 'exact', head: true })
          .eq('solicitacao_id', id).eq('decisao', 'aprovado')
        if (!count) return erro(409, 'Nenhum procedimento foi aprovado: devolva a carta sem serviço')
        // Nenhum trabalho comeca sem o servico pago (decisao do Du, 27/09/2026).
        const servico = (await pagamentosDoPedido(id)).find(l => l.etapa === 'servico')
        if (servico && !servico.pago_em) return erro(409, 'Confirme o pagamento do serviço antes da bancada')
      }
      if (para === 'pronta') {
        const f = await pendencias(sb, id, sol.servico, 'saida')
        if (f.length) return erro(409, `Falta: ${f.join(', ')}`)
      }

      if (para === 'enviada') {
        // Carta so volta depois do Pix registrado (decisao do Du, 26/09/2026).
        if (!sol.pago_em) return erro(409, 'Registre o pagamento antes de enviar a carta de volta')
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
      if (!['orcado', 'aceito', 'recebida', 'proposta', 'em_bancada', 'descansando', 'pronta'].includes(sol.status)) return erro(409, 'Pagamento não se aplica a este status')
      // Pedido com etapas (fatia 3): confirma a etapa pedida, so na transicao.
      const linhas = await pagamentosDoPedido(id)
      if (linhas.length) {
        const etapa = String(body.etapa || '') as EtapaPagamento
        if (!linhas.some(l => l.etapa === etapa)) return erro(400, 'Etapa de pagamento inválida')
        const r = await confirmarPagamento(id, etapa, 'pix_manual')
        if (!r.ok) return erro(409, 'Esta etapa já está paga')
        await aposConfirmarPagamento(id, sol.status, etapa, 'pix_manual')
        return NextResponse.json({ ok: true, tudoPago: r.tudoPago })
      }
      // Pedido antigo, sem etapas: um pagamento so. So na transicao "nao pago -> pago".
      const { data: marcou, error } = await sb.from('servico_solicitacoes')
        .update({ pagamento_metodo: 'pix_manual', pago_em: new Date().toISOString() })
        .eq('id', id).is('pago_em', null).select('id')
      if (error) throw new Error(error.message)
      if (!marcou?.length) return erro(409, 'Este pedido já está com o pagamento registrado')
      await registrarEvento(id, sol.status, 'Pagamento via Pix confirmado')
      return NextResponse.json({ ok: true })
    }

    // ── Estorno de uma etapa paga ───────────────────────────────────────────
    if (body.acao === 'estornar') return await estornar(id, sol.status, body)

    // ── Ficha de condicao (entrada ou saida) ───────────────────────────────
    if (body.acao === 'ficha') {
      const lado = body.lado === 'saida' ? 'saida' : 'entrada'
      const v = validarFicha(body.ficha)
      if (!v.ok) return erro(400, v.erro)
      const { data, error } = await sb.from('servico_itens')
        .update(lado === 'entrada'
          ? { ficha_entrada: v.ficha, ficha_entrada_em: new Date().toISOString() }
          : { ficha_saida: v.ficha, ficha_saida_em: new Date().toISOString() })
        .eq('id', String(body.item_id || '')).eq('solicitacao_id', id).select('id')
      if (error) throw new Error(error.message)
      if (!data?.length) return erro(404, 'Carta não encontrada neste pedido')
      return NextResponse.json({ ok: true })
    }

    // ── Rascunho da proposta de uma carta ──────────────────────────────────
    if (body.acao === 'procedimentos') {
      if (sol.status !== 'recebida') return erro(409, 'A proposta só pode ser editada antes de ir para o cliente')
      const itemId = String(body.item_id || '')
      const { data: it } = await sb.from('servico_itens').select('id').eq('id', itemId).eq('solicitacao_id', id).limit(1)
      if (!it?.[0]) return erro(404, 'Carta não encontrada neste pedido')
      const t = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
      const lista = (Array.isArray(body.procedimentos) ? body.procedimentos : []).slice(0, 10) as Record<string, unknown>[]
      const linhas = []
      for (let k = 0; k < lista.length; k++) {
        const p = lista[k]
        const problema = t(p.problema), procedimento = t(p.procedimento), risco = String(p.risco || '')
        if (!problema || !procedimento) return erro(400, `Procedimento ${k + 1}: preencha o problema e o procedimento`)
        if (!RISCOS.some(r => r.id === risco)) return erro(400, `Procedimento ${k + 1}: escolha o risco`)
        linhas.push({
          solicitacao_id: id, item_id: itemId, ordem: k + 1, problema, procedimento, risco,
          objetivo: t(p.objetivo) || null, resultado_esperado: t(p.resultado_esperado) || null,
          risco_descricao: t(p.risco_descricao) || null, alternativa: t(p.alternativa) || 'Não realizar a intervenção',
        })
      }
      await sb.from('servico_procedimentos').delete().eq('item_id', itemId).eq('decisao', 'pendente')
      if (linhas.length) {
        const { error } = await sb.from('servico_procedimentos').insert(linhas)
        if (error) throw new Error(error.message)
      }
      return NextResponse.json({ ok: true })
    }

    // ── Cobrar o servico (com valor conferido/ajustado) ────────────────────
    // Depois da resposta da proposta e antes do Pix do servico. Ajusta o valor
    // da etapa (e o orcamento/total do pedido, pra tudo bater) e envia a
    // cobranca. Pode repetir enquanto o servico nao foi pago (reenvia com o
    // valor novo).
    if (body.acao === 'cobrar_servico') {
      if (sol.status !== 'proposta' || !sol.proposta_aceita_em) return erro(409, 'A cobrança do serviço sai depois da resposta da proposta')
      const valor = cents(body.valor_cents)
      if (valor == null || Number.isNaN(valor) || valor <= 0) return erro(400, 'Informe o valor do serviço')
      const { count } = await sb.from('servico_procedimentos').select('id', { count: 'exact', head: true })
        .eq('solicitacao_id', id).eq('decisao', 'aprovado')
      if (!count) return erro(409, 'Nenhum procedimento aprovado: devolva a carta sem serviço')
      const { data: mudou, error } = await sb.from('servico_pagamentos').update({ valor_cents: valor })
        .eq('solicitacao_id', id).eq('etapa', 'servico').is('pago_em', null).select('id')
      if (error) throw new Error(error.message)
      if (!mudou?.length) return erro(409, 'O serviço já está pago ou este pedido não tem a etapa de serviço')
      const { data: cur } = await sb.from('servico_solicitacoes').select('seguro_cents, frete_volta_cents').eq('id', id).limit(1)
      await sb.from('servico_solicitacoes').update({
        orcamento_cents: valor,
        total_cents: valor + (cur?.[0]?.seguro_cents || 0) + (cur?.[0]?.frete_volta_cents || 0),
      }).eq('id', id)
      await registrarEvento(id, 'cobranca_servico', `Cobrança do serviço enviada: R$ ${(valor / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
      await notificarCliente(id, 'cobrar_servico')
      return NextResponse.json({ ok: true })
    }

    // ── Enviar a proposta ao cliente ───────────────────────────────────────
    if (body.acao === 'enviar_proposta') {
      if (sol.status !== 'recebida') return erro(409, 'A proposta sai depois da chegada da carta')
      if (sol.servico === 'pre_grading') return erro(409, 'Pré-grading não tem proposta de tratamento: leve direto para a bancada')
      const faltas = await pendencias(sb, id, sol.servico, 'entrada')
      const [{ data: itens }, { data: procs }] = await Promise.all([
        sb.from('servico_itens').select('id, aceito').eq('solicitacao_id', id).order('created_at'),
        sb.from('servico_procedimentos').select('item_id').eq('solicitacao_id', id),
      ])
      const ativos = (itens || []).filter(i => i.aceito !== false)
      ativos.forEach((it, k) => {
        if (!(procs || []).some(p => p.item_id === it.id)) faltas.push(`Proposta${ativos.length > 1 ? ` da carta ${k + 1}` : ''}`)
      })
      if (faltas.length) return erro(409, `Falta: ${faltas.join(', ')}`)
      const { data, error } = await sb.from('servico_solicitacoes')
        .update({ status: 'proposta', proposta_enviada_em: new Date().toISOString() })
        .eq('id', id).eq('status', 'recebida').select('id')
      if (error) throw new Error(error.message)
      if (!data?.length) return erro(409, 'O pedido mudou em outra aba. Recarregue.')
      await registrarEvento(id, 'proposta', 'Proposta de tratamento enviada ao cliente')
      await notificarCliente(id, 'proposta')
      return NextResponse.json({ ok: true, status: 'proposta' })
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
      // Faixa e intervalo ("8 a 9", "8,5 a 9"), nunca nota unica; graduadora da
      // lista. Salvar pela metade continua valendo: o que falta so trava o "pronta".
      if (laudo.faixa_nota) {
        const f = lerFaixaNota(laudo.faixa_nota)
        if (!f) return erro(400, 'Faixa provável no formato "8 a 9" (ou "8,5 a 9"), de 1 a 10, com o menor valor primeiro. Nota única não vale.')
        laudo.faixa_nota = f.texto
      }
      if (laudo.graduadora) {
        const g = lerGraduadora(laudo.graduadora)
        if (!g) return erro(400, 'Escolha a graduadora recomendada na lista')
        laudo.graduadora = g
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
      const posicao = typeof body.posicao === 'string' && /^[a-z_]{1,40}$/.test(body.posicao) ? body.posicao : null
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
        { solicitacao_id: id, item_id: itemId, tipo, posicao, path, mime, tamanho },
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

// ── Estorno (fatia 6) ────────────────────────────────────────────────────────
//
// ★ ORDEM: provedor antes do banco. O refund nasce na Stripe e SO DEPOIS o
//   reembolsado_cents e somado. Se a gravacao falhar depois do refund, o erro diz
//   que o dinheiro SAIU e nada e repetido: a conciliacao do webhook (charge.refunded)
//   iguala o banco ao total da Stripe sozinha.
// ★ IDEMPOTENCIA em tres camadas:
//   1. Chave da Stripe presa ao estado ANTERIOR (pagamento + total ja estornado).
//      Dois cliques a partir do mesmo estado caem na mesma chave: mesmo valor ->
//      o mesmo refund volta; valor diferente -> a Stripe recusa a chave. Nunca
//      nascem dois refunds do mesmo estado.
//   2. Antes de criar, confere o total ja estornado NA STRIPE. Se for maior que o
//      do banco, ha estorno ainda nao conciliado: recusa (o estado do banco esta
//      velho e a chave do item 1 nao protegeria).
//   3. O update so soma onde reembolsado_cents ainda e o valor lido. Quem perdeu
//      a corrida (outro clique, ou o webhook) nao registra evento nem e-mail.
// ★ O motivo nao tem coluna: vai na metadata do refund (fica na Stripe), no log e
//   no e-mail interno. Nunca na linha do tempo (o cliente le a linha do tempo).
// ★ Estorno nunca muda o status do pedido. A decisao fica com o admin.

const reaisE = (c: number) => `R$ ${brl(c / 100)}`

async function estornar(id: string, statusAtual: string, body: Record<string, unknown>) {
  const sb = sbAdmin()
  const pagamentoId = String(body.pagamento_id || '')
  const motivo = typeof body.motivo === 'string' ? body.motivo.trim().replace(/\s+/g, ' ').slice(0, 300) : ''
  if (!/^[0-9a-f-]{36}$/i.test(pagamentoId)) return erro(400, 'Etapa de pagamento inválida')
  if (motivo.length < 3) return erro(400, 'Diga o motivo do estorno')

  const { data: pl, error: eP } = await sb.from('servico_pagamentos')
    .select('id, etapa, valor_cents, metodo, pago_em, stripe_payment_intent_id, reembolsado_cents')
    .eq('id', pagamentoId).eq('solicitacao_id', id).limit(1)
  if (eP) throw new Error(eP.message)
  const pg = pl?.[0]
  if (!pg) return erro(404, 'Etapa de pagamento não encontrada neste pedido')
  if (!pg.pago_em) return erro(409, 'Esta etapa não foi paga: não há o que estornar')

  const ja = Number(pg.reembolsado_cents || 0)
  const restante = pg.valor_cents - ja
  if (restante <= 0) return erro(409, 'Esta etapa já foi estornada por inteiro')
  const bruto = body.valor_cents
  const valor = bruto === undefined || bruto === null || bruto === '' ? restante : cents(bruto)
  if (valor === null || Number.isNaN(valor) || valor <= 0) return erro(400, 'Valor do estorno inválido')
  if (valor > restante) return erro(400, `O máximo que ainda dá para estornar nesta etapa é ${reaisE(restante)}`)
  const novoTotal = ja + valor
  const rotulo = ROTULO_ETAPA[pg.etapa as EtapaPagamento] || pg.etapa
  const tag = `[admin/servicos/estorno] pedido ${id} pagamento ${pg.id} etapa ${pg.etapa}`

  // ── Pix: a Bynx devolve pelo banco; aqui so se registra ────────────────────
  if (pg.metodo === 'pix_manual') {
    if (body.pix_devolvido !== true) {
      return erro(409, 'Estorno de Pix é manual: devolva o valor pelo banco e depois registre aqui a devolução.')
    }
    const agora = new Date().toISOString()
    const { data: gravou, error } = await sb.from('servico_pagamentos')
      .update({ reembolsado_cents: novoTotal, reembolsado_em: agora })
      .eq('id', pg.id).eq('reembolsado_cents', ja).select('id')
    if (error) throw new Error(error.message)
    if (!gravou?.length) return erro(409, 'O pagamento mudou em outra aba. Recarregue e confira antes de registrar de novo.')
    console.log(`${tag}: devolucao Pix registrada ${valor} (total ${novoTotal}/${pg.valor_cents}) -- motivo: ${motivo}`)
    await aposEstorno(id, statusAtual, valor, 'pix_manual', agora)
    await notificarAdmin(id, 'Devolução por Pix registrada:', [
      `${reaisE(valor)} de ${rotulo.toLowerCase()} (total devolvido ${reaisE(novoTotal)} de ${reaisE(pg.valor_cents)}).`,
      `Motivo: ${motivo}`,
    ])
    return NextResponse.json({ ok: true, reembolsado_cents: novoTotal })
  }

  if (pg.metodo !== 'stripe' || !pg.stripe_payment_intent_id) {
    return erro(409, 'Esta etapa não tem pagamento com cartão registrado na Stripe')
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error(`${tag}: STRIPE_SECRET_KEY ausente`)
    return erro(503, 'Stripe indisponível no momento. Nada foi estornado.')
  }
  const apiVersion = '2025-03-31.basil' as Stripe.StripeConfig['apiVersion']
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion })
  const piId = pg.stripe_payment_intent_id as string

  // ── Camada 2: o banco esta em dia com a Stripe? ────────────────────────────
  try {
    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge'] })
    const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null
    if (pi.status !== 'succeeded' || !charge) {
      console.error(`${tag}: PI ${piId} status ${pi.status}, sem charge -- recusado`)
      return erro(409, 'O pagamento na Stripe não está concluído. Confira no painel da Stripe. Nada foi estornado.')
    }
    if (pi.metadata?.pagamento_id && pi.metadata.pagamento_id !== pg.id) {
      console.error(`${tag}: PI ${piId} aponta para outro pagamento (${pi.metadata.pagamento_id}) -- recusado`)
      return erro(409, 'Este pagamento da Stripe pertence a outra etapa. Confira antes de estornar. Nada foi estornado.')
    }
    if ((charge.amount_refunded || 0) !== ja) {
      console.error(`${tag}: Stripe ja estornou ${charge.amount_refunded}, o banco diz ${ja} -- recusado ate conciliar`)
      return erro(409, `A Stripe mostra ${reaisE(charge.amount_refunded || 0)} já estornado nesta etapa e o painel mostra ${reaisE(ja)}. Aguarde a conciliação (alguns segundos) e recarregue antes de estornar de novo. Nada foi estornado agora.`)
    }
  } catch (e) {
    const code = (e as { code?: string })?.code
    console.error(`${tag}: falha lendo o PI ${piId}:`, code || '', e instanceof Error ? e.message : e)
    return erro(502, code === 'resource_missing'
      ? 'Este pagamento não existe na conta da Stripe configurada (conta ou modo diferente). Nada foi estornado.'
      : 'Não foi possível falar com a Stripe agora. Nada foi estornado. Tente de novo.')
  }

  // ── Provedor primeiro ──────────────────────────────────────────────────────
  let refund: Stripe.Refund
  try {
    refund = await stripe.refunds.create({
      payment_intent: piId,
      amount: valor,
      reason: 'requested_by_customer',
      metadata: { solicitacao_id: id, pagamento_id: String(pg.id), etapa: String(pg.etapa), origem: 'painel_admin', motivo },
    }, {
      // Camada 1: presa ao estado anterior, nao ao valor pedido.
      idempotencyKey: `servico-estorno:${pg.id}:de-${ja}`,
    })
  } catch (e) {
    const err = e as { code?: string; type?: string; message?: string }
    console.error(`${tag}: Stripe recusou o refund de ${valor}:`, err.type || '', err.code || '', err.message || e)
    if (err.type === 'StripeIdempotencyError') {
      return erro(409, 'Outro estorno desta etapa foi pedido ao mesmo tempo com outro valor. Recarregue e confira antes de tentar de novo. Nada foi estornado agora.')
    }
    return erro(502, `A Stripe recusou o estorno${err.message ? `: ${err.message}` : ''}. Nada foi estornado.`)
  }
  if (refund.status === 'failed' || refund.status === 'canceled') {
    console.error(`${tag}: refund ${refund.id} nasceu ${refund.status} -- nada gravado`)
    return erro(502, `A Stripe não concluiu o estorno (status ${refund.status}). Nada foi registrado. Confira no painel da Stripe.`)
  }

  // ── Banco depois, so na transicao ──────────────────────────────────────────
  const agora = new Date().toISOString()
  const saiu = `O estorno de ${reaisE(valor)} SAIU na Stripe (refund ${refund.id})`
  const { data: gravou, error: eU } = await sb.from('servico_pagamentos')
    .update({ reembolsado_cents: novoTotal, reembolsado_em: agora, stripe_refund_id: refund.id })
    .eq('id', pg.id).eq('reembolsado_cents', ja).select('id')
  if (eU) {
    console.error(`${tag}: CRITICAL refund ${refund.id} de ${valor} criado no PI ${piId}, mas o banco falhou: ${eU.message}`)
    return erro(500, `${saiu}, mas não foi gravado no painel. NÃO estorne de novo: confira na Stripe. A conciliação automática deve registrar em instantes.`)
  }
  if (!gravou?.length) {
    // Outro clique (mesma chave, mesmo refund) ou o webhook gravou antes.
    const { data: agoraL, error: eR } = await sb.from('servico_pagamentos')
      .select('reembolsado_cents').eq('id', pg.id).limit(1)
    const atual = Number(agoraL?.[0]?.reembolsado_cents || 0)
    if (!eR && atual >= novoTotal) {
      console.log(`${tag}: refund ${refund.id} ja estava registrado (total ${atual}) -- sem evento duplicado`)
      await notificarAdmin(id, 'Estorno no cartão:', [
        `${reaisE(valor)} de ${rotulo.toLowerCase()} (refund ${refund.id}), já registrado por outra aba ou pela conciliação.`,
        `Motivo: ${motivo}`,
      ])
      return NextResponse.json({ ok: true, ja_registrado: true, reembolsado_cents: atual })
    }
    console.error(`${tag}: CRITICAL refund ${refund.id} de ${valor} criado no PI ${piId}, banco em ${atual} (esperado ${ja}) -- conferir`)
    return erro(409, `${saiu}, mas o pagamento mudou no meio e o painel não somou. NÃO estorne de novo: confira na Stripe e recarregue.`)
  }

  console.log(`${tag}: ESTORNADO ${valor} refund ${refund.id} status ${refund.status} (total ${novoTotal}/${pg.valor_cents}) -- motivo: ${motivo}`)
  await aposEstorno(id, statusAtual, valor, 'stripe', agora)
  await notificarAdmin(id, 'Estorno no cartão:', [
    `${reaisE(valor)} de ${rotulo.toLowerCase()} (total estornado ${reaisE(novoTotal)} de ${reaisE(pg.valor_cents)}).`,
    `Motivo: ${motivo}`,
    `Refund: ${refund.id} (${refund.status})`,
    `PaymentIntent: ${piId}`,
  ])
  return NextResponse.json({ ok: true, reembolsado_cents: novoTotal, refund_status: refund.status })
}
