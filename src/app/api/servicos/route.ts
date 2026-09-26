// POST /api/servicos -- cria a solicitacao de orcamento (restauracao / pre-grading).
//
// Recebe servico, prazo, contato e as cartas (sem arquivo). Grava solicitacao +
// itens + evento inicial e devolve, por carta, uma URL assinada para cada foto.
// O navegador sobe as fotos direto no bucket privado e depois chama
// POST /api/servicos/[id]/fotos para confirmar. So com frente e verso de todas
// as cartas confirmados a solicitacao e dada como completa (e o admin e avisado).

import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { criarLimitador, ipDaRequest } from '@/lib/rateLimit'
import { MAX_CARTAS_POR_SOLICITACAO, QUEIXAS, OBJETIVOS, GRADUADORAS_ALVO } from '@/lib/servicos'
import {
  sbAdmin, usuarioDoToken, erro, registrarEvento, caminhoFoto, urlDeUpload, numeroSolicitacao,
  FOTO_MIMES, SLOTS, SLOTS_OBRIGATORIOS, type Slot,
} from '@/lib/servicosServer'

export const dynamic = 'force-dynamic'

const limitador = criarLimitador({ janelaMs: 10 * 60_000, max: 10 })
/** Teto por conta em 24h: speed-bump contra envio em loop enchendo o bucket. */
const MAX_POR_DIA = 5
const SERVICOS_OK = ['restauracao', 'pre_grading', 'completo']
const VALOR_MAX_CENTS = 100_000_000 // R$ 1 milhao por carta: acima disso e digitacao errada

interface CartaEntrada {
  nome?: unknown
  card_id?: unknown
  queixas?: unknown
  obs?: unknown
  valor_declarado_cents?: unknown
  fotos?: unknown
}

function texto(v: unknown, max: number) {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

export async function POST(req: NextRequest) {
  try {
    const ip = ipDaRequest(req)
    if (ip && limitador.excedeu(ip)) return erro(429, 'Muitas tentativas. Aguarde alguns minutos.')

    const user = await usuarioDoToken(req)
    if (!user) return erro(401, 'Entre na sua conta para pedir o orçamento.')

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return erro(400, 'Dados inválidos')

    const servico = String(body.servico || '')
    if (!SERVICOS_OK.includes(servico)) return erro(400, 'Serviço inválido')
    const prazo = body.prazo === 'expresso' ? 'expresso' : 'padrao'
    if (body.ciente !== true) return erro(400, 'Marque a ciência sobre recusa')

    // Objetivo do colecionador (fase 2): obrigatorio. Graduacao pede a graduadora.
    const objetivo = String(body.objetivo || '')
    if (!OBJETIVOS.some(o => o.id === objetivo)) return erro(400, 'Conte o objetivo do serviço')
    const objetivoOutro = objetivo === 'outro' ? texto(body.objetivo_outro, 200) : ''
    if (objetivo === 'outro' && !objetivoOutro) return erro(400, 'Conte qual é o objetivo')
    const graduadora = objetivo === 'graduacao' ? String(body.graduadora_alvo || '') : ''
    if (objetivo === 'graduacao' && !(GRADUADORAS_ALVO as readonly string[]).includes(graduadora)) return erro(400, 'Escolha a graduadora')

    const whatsDigitos = typeof body.whatsapp === 'string' ? body.whatsapp.replace(/\D/g, '') : ''
    if (whatsDigitos && !/^[1-9][1-9]9[0-9]{8}$/.test(whatsDigitos)) return erro(400, 'WhatsApp inválido')

    const cartas = Array.isArray(body.cartas) ? (body.cartas as CartaEntrada[]) : []
    if (cartas.length < 1 || cartas.length > MAX_CARTAS_POR_SOLICITACAO) {
      return erro(400, `Envie de 1 a ${MAX_CARTAS_POR_SOLICITACAO} cartas`)
    }

    const queixasOk = new Set<string>(QUEIXAS)
    const itens: {
      nome: string; card_id: string | null; queixas: string[]; obs: string | null
      valor_declarado_cents: number; fotos: Partial<Record<Slot, string>>
    }[] = []

    for (let i = 0; i < cartas.length; i++) {
      const c = cartas[i]
      const n = i + 1
      const nome = texto(c.nome, 200)
      if (!nome) return erro(400, `Falta o nome da carta ${n}`)
      const valor = Number(c.valor_declarado_cents)
      if (!Number.isInteger(valor) || valor <= 0 || valor > VALOR_MAX_CENTS) return erro(400, `Valor declarado inválido na carta ${n}`)
      const fotosIn = (c.fotos && typeof c.fotos === 'object' ? c.fotos : {}) as Record<string, unknown>
      const fotos: Partial<Record<Slot, string>> = {}
      for (const s of SLOTS) {
        const mime = fotosIn[s]
        if (mime == null) continue
        if (typeof mime !== 'string' || !FOTO_MIMES.includes(mime)) return erro(400, `Formato de foto inválido na carta ${n}`)
        fotos[s] = mime
      }
      for (const s of SLOTS_OBRIGATORIOS) if (!fotos[s]) return erro(400, `Falta a foto ${s} da carta ${n}`)
      itens.push({
        nome,
        card_id: texto(c.card_id, 80) || null,
        queixas: Array.isArray(c.queixas) ? c.queixas.filter((q): q is string => typeof q === 'string' && queixasOk.has(q)) : [],
        obs: texto(c.obs, 500) || null,
        valor_declarado_cents: valor,
        fotos,
      })
    }

    const sb = sbAdmin()

    const desde = new Date(Date.now() - 24 * 3600_000).toISOString()
    const { count } = await sb
      .from('servico_solicitacoes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', desde)
    if ((count ?? 0) >= MAX_POR_DIA) {
      return erro(429, 'Você já enviou vários pedidos hoje. Aguarde o orçamento ou fale com a gente.')
    }

    const { data: solRows, error: solErr } = await sb
      .from('servico_solicitacoes')
      .insert({
        user_id: user.id,
        servico,
        prazo,
        valor_declarado_cents: itens.reduce((s, it) => s + it.valor_declarado_cents, 0),
        whatsapp: whatsDigitos || null,
        whatsapp_consentido: !!whatsDigitos && body.whatsapp_consentido === true,
        objetivo,
        objetivo_outro: objetivoOutro || null,
        graduadora_alvo: graduadora || null,
      })
      .select('id, numero')
      .limit(1)
    const sol = solRows?.[0]
    if (solErr || !sol) {
      console.error('[servicos POST] solicitacao', solErr?.message)
      return erro(500, 'Não conseguimos registrar o pedido. Tente de novo.')
    }

    // Um insert por carta (no maximo 20): a ordem liga cada item as fotos
    // daquela carta, e o retorno de insert em lote nao garante ordem.
    const itensRows: { id: string }[] = []
    for (const it of itens) {
      const { data, error } = await sb
        .from('servico_itens')
        .insert({
          solicitacao_id: sol.id,
          nome: it.nome,
          card_id: it.card_id,
          queixas: it.queixas,
          obs: it.obs,
          valor_declarado_cents: it.valor_declarado_cents,
        })
        .select('id')
        .limit(1)
      if (error || !data?.[0]) {
        // Sem os itens a solicitacao nao serve: desfaz (cascade leva os itens ja gravados).
        await sb.from('servico_solicitacoes').delete().eq('id', sol.id)
        console.error('[servicos POST] item', error?.message)
        return erro(500, 'Não conseguimos registrar as cartas. Tente de novo.')
      }
      itensRows.push(data[0])
    }

    await registrarEvento(sol.id, 'aguardando_orcamento', 'Pedido criado, aguardando as fotos')

        const uploads: { idx: number; item_id: string; slot: Slot; path: string; token: string }[] = []
    for (let i = 0; i < itens.length; i++) {
      for (const [slot, mime] of Object.entries(itens[i].fotos) as [Slot, string][]) {
        const u = await urlDeUpload(caminhoFoto(sol.id, itensRows[i].id, slot, mime))
        uploads.push({ idx: i, item_id: itensRows[i].id, slot, ...u })
      }
    }

    return NextResponse.json({ id: sol.id, numero: numeroSolicitacao(sol.numero), uploads })
  } catch (e) {
    console.error('[servicos POST]', e instanceof Error ? e.message : e)
    return erro(500, 'Erro interno')
  }
}
