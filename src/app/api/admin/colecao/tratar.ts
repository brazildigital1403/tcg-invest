// src/app/api/admin/colecao/tratar.ts
//
// Album do Club no /admin (21/11/2026). Mesmo padrao dos avisos: o admin e cookie de senha, sem
// conta no Supabase, entao a rota usa as funcoes *_interno pela chave de servico, com autor nulo
// ("Admin Bynx"). As regras ficam no banco; aqui so a forma dos dados e as datas (o campo
// datetime-local vem em horario de Brasilia e vira ISO).
//
// GET ?slug=                                              -> painel (v2): edicoes + a escolhida com as cartas e a regra de cada uma
// POST multipart {id, numero, arte}                       -> sobe a arte da carta
// POST {acao:'edicao', id, dados}                         -> club_colecao_salvar_interno
// POST {acao:'estado', id, como, dados?}                  -> club_colecao_estado_v2_interno (publicar | recolher | encerrar)
// POST {acao:'edicao_criar', dados}                       -> club_colecao_criar_interno (edicao nova, em rascunho)
// POST {acao:'carta_criar', id, dados}                    -> club_carta_criar_interno (numero, missao, regra, rosto da missao)
// POST {acao:'carta_regra', id, numero, dados}            -> club_carta_regra_salvar_interno (so em rascunho)
// POST {acao:'carta_apagar', id, numero}                  -> club_carta_apagar_interno (so em rascunho e sem dono)
// POST {acao:'carta', id, numero, dados}                  -> club_carta_salvar_interno
// POST {acao:'previa', id, numeros, ids}                  -> club_colecao_previa_lote_interno
// POST {acao:'conceder', id, numeros, ids, origem, nota}  -> club_colecao_conceder_tokens_interno
// POST {acao:'desfazer', lote}                            -> club_colecao_desfazer_lote_interno
// POST {acao:'historico', id}                             -> club_colecao_historico_interno
// POST {acao:'pedidos', id}                               -> club_retiradas_admin_interno
// POST {acao:'pedido', numero, status, nota?}             -> club_retirada_status_interno

// A rota (route.ts) so confere o cookie do admin e entrega para ca: assim a logica da para ser exercitada
// sem a sessao do Admin (a conferencia na prova usa uma rota temporaria).

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deDatetimeLocal } from '@/lib/pcc/albumAdmin'
import { MAX_ARTE, subirArte } from '@/lib/pcc/albumArte'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const STATUS_PEDIDO = ['solicitada', 'combinada', 'postada', 'entregue', 'cancelada']
const TEXTOS_CARTA = ['nome', 'tipo', 'raridade', 'texto_efeito', 'homenageado', 'como_ganhar'] as const
// O banco aceita carta de 1 a 99 (o teto de 12 saiu na Fase 2). A regra de cada edicao (total previsto) fica la.
const MAX_NUMERO = 99
const TEXTOS_MISSAO = ['missao_titulo', 'missao_icone', 'missao_botao', 'missao_href'] as const

/** A regra da missao como o Admin manda: tipo, parametro e "so vale depois da abertura". O banco valida o conteudo. */
function regraDoCorpo(d: Record<string, unknown>, p: Record<string, unknown>): boolean {
  if ('regra_tipo' in d) {
    if (typeof d.regra_tipo !== 'string') return false
    p.regra_tipo = d.regra_tipo
  }
  if ('regra_param' in d) {
    if (!d.regra_param || typeof d.regra_param !== 'object' || Array.isArray(d.regra_param)) return false
    p.regra_param = d.regra_param
  }
  if ('regra_desde_abertura' in d) {
    if (typeof d.regra_desde_abertura !== 'boolean') return false
    p.regra_desde_abertura = d.regra_desde_abertura
  }
  for (const campo of TEXTOS_MISSAO) {
    if (!(campo in d)) continue
    if (typeof d[campo] !== 'string' && d[campo] !== null) return false
    p[campo] = d[campo]
  }
  if ('como_ganhar' in d) {
    if (typeof d.como_ganhar !== 'string') return false
    p.como_ganhar = d.como_ganhar
  }
  return true
}

const falha = (codigo: string, status = 400, detalhe?: string | null) =>
  NextResponse.json({ error: codigo, ...(detalhe ? { detalhe } : {}) }, { status })

type Corpo = {
  acao?: string; id?: unknown; numero?: unknown; numeros?: unknown; ids?: unknown; origem?: unknown
  nota?: unknown; lote?: unknown; como?: unknown; dados?: unknown; status?: unknown
}

const ehId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const inteiroOuNulo = (v: unknown): number | null | undefined => {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) ? n : undefined
}
function numerosValidos(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_NUMERO) return null
  if (!v.every(n => Number.isInteger(n) && n >= 1 && n <= MAX_NUMERO)) return null
  return Array.from(new Set(v as number[]))
}
function idsValidos(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length > 200) return null
  return v.every(t => typeof t === 'string' && t.length > 0 && t.length <= 200) ? (v as string[]) : null
}

/** GET: o painel da edicao. */
export async function tratarGet(req: NextRequest, sb: SupabaseClient) {
  const slug = req.nextUrl.searchParams.get('slug')
  const { data, error } = await sb.rpc('club_colecao_painel_v2_interno', { p_slug: slug && SLUG.test(slug) ? slug : null })
  if (error) return falha(error.message, 500)
  return NextResponse.json({ painel: data })
}

/** POST: as acoes (JSON) e o envio da arte (multipart). */
export async function tratarPost(req: NextRequest, sb: SupabaseClient) {
  // Arte da carta: multipart. O tipo vem do conteudo da imagem (albumArte.ts), nao do que o navegador disse.
  if ((req.headers.get('content-type') || '').startsWith('multipart/form-data')) {
    const form = await req.formData().catch(() => null)
    const id = form?.get('id')
    const numero = Number(form?.get('numero'))
    const arte = form?.get('arte')
    if (!ehId(id) || !Number.isInteger(numero) || numero < 1 || numero > MAX_NUMERO || !(arte instanceof File)) return falha('dados_invalidos')
    if (arte.size > MAX_ARTE) return falha('arte_tamanho')
    const r = await subirArte(sb, { colecaoId: id, numero, bytes: new Uint8Array(await arte.arrayBuffer()) })
    if (!r.ok) return falha(r.erro, r.status)
    return NextResponse.json({ carta: r.carta, campos: r.campos })
  }

  const body = (await req.json().catch(() => ({}))) as Corpo

  if (body.acao === 'edicao') {
    if (!ehId(body.id)) return falha('dados_invalidos')
    const d = objeto(body.dados)
    const p: Record<string, unknown> = {}
    if (typeof d.titulo === 'string') p.titulo = d.titulo
    if ('tiragem_fisica' in d) p.tiragem_fisica = d.tiragem_fisica === null || d.tiragem_fisica === '' ? null : String(d.tiragem_fisica)
    for (const campo of ['abre_em', 'fecha_em', 'pedir_set_ate'] as const) {
      if (!(campo in d)) continue
      const iso = typeof d[campo] === 'string' ? deDatetimeLocal(d[campo] as string) : null
      if (!iso) return falha('data_invalida')
      p[campo] = iso
    }
    const { data, error } = await sb.rpc('club_colecao_salvar_interno', { p_colecao: body.id, p, p_autor: null })
    if (error) return falha(error.message, 400, error.details)
    return NextResponse.json({ edicao: data })
  }

  if (body.acao === 'estado') {
    if (!ehId(body.id) || !['publicar', 'recolher', 'encerrar'].includes(String(body.como))) return falha('acao_invalida')
    const d = objeto(body.dados)
    const p: Record<string, unknown> = {}
    if (typeof d.abre_em === 'string' && d.abre_em) {
      const iso = deDatetimeLocal(d.abre_em)
      if (!iso) return falha('data_invalida')
      p.abre_em = iso
    }
    for (const campo of ['dias', 'dias_pedido'] as const) {
      const n = inteiroOuNulo(d[campo])
      if (n === undefined && d[campo] !== undefined) return falha('prazo_invalido')
      if (typeof n === 'number') p[campo] = n
    }
    const { data, error } = await sb.rpc('club_colecao_estado_v2_interno', {
      p_colecao: body.id, p_acao: body.como, p_autor: null, p_dados: Object.keys(p).length ? p : null,
    })
    if (error) return falha(error.message, 400, error.details)
    return NextResponse.json({ edicao: data })
  }

  if (body.acao === 'carta') {
    const numero = Number(body.numero)
    if (!ehId(body.id) || !Number.isInteger(numero) || numero < 1 || numero > MAX_NUMERO) return falha('dados_invalidos')
    const d = objeto(body.dados)
    const p: Record<string, unknown> = {}
    for (const campo of TEXTOS_CARTA) {
      if (!(campo in d)) continue
      if (typeof d[campo] !== 'string' && d[campo] !== null) return falha('dados_invalidos')
      p[campo] = d[campo]
    }
    if ('previa' in d) {
      if (typeof d.previa !== 'boolean') return falha('previa_invalida')
      p.previa = d.previa
    }
    // O caminho da arte nunca vem do navegador (o envio e a rota multipart): aqui so da para tirar a arte.
    if ('arte_path' in d) {
      if (d.arte_path !== null) return falha('dados_invalidos')
      p.arte_path = null
    }
    const { data, error } = await sb.rpc('club_carta_salvar_interno', { p_colecao: body.id, p_numero: numero, p, p_autor: null })
    if (error) return falha(error.message, 400, error.details)
    const r = data as { carta: unknown; campos: string[]; arte_anterior: string | null }
    if (r.arte_anterior) await sb.storage.from('club-colecao').remove([r.arte_anterior])
    return NextResponse.json({ carta: r.carta, campos: r.campos })
  }

  if (body.acao === 'edicao_criar') {
    const d = objeto(body.dados)
    const p: Record<string, unknown> = {}
    for (const campo of ['slug', 'titulo', 'papel', 'trilha'] as const) {
      if (typeof d[campo] === 'string') p[campo] = d[campo]
    }
    for (const campo of ['total_previsto', 'tiragem_fisica'] as const) {
      const n = inteiroOuNulo(d[campo])
      if (n === undefined && d[campo] !== undefined) return falha(campo === 'total_previsto' ? 'total_invalido' : 'tiragem_invalida')
      if (typeof n === 'number') p[campo] = String(n)
    }
    const { data, error } = await sb.rpc('club_colecao_criar_interno', { p, p_autor: null })
    if (error) return falha(error.message, 400, error.details)
    return NextResponse.json({ edicao: data })
  }

  if (body.acao === 'carta_criar') {
    if (!ehId(body.id)) return falha('dados_invalidos')
    const d = objeto(body.dados)
    const numero = Number(d.numero)
    if (!Number.isInteger(numero) || numero < 1 || numero > MAX_NUMERO) return falha('numero_invalido')
    const p: Record<string, unknown> = { numero: String(numero) }
    if (typeof d.missao === 'string') p.missao = d.missao
    if ('secreta' in d) {
      if (typeof d.secreta !== 'boolean') return falha('secreta_invalida')
      p.secreta = d.secreta
    }
    if (!regraDoCorpo(d, p)) return falha('dados_invalidos')
    const { data, error } = await sb.rpc('club_carta_criar_interno', { p_colecao: body.id, p, p_autor: null })
    if (error) return falha(error.message, 400, error.details)
    return NextResponse.json({ carta: data })
  }

  if (body.acao === 'carta_regra') {
    const numero = Number(body.numero)
    if (!ehId(body.id) || !Number.isInteger(numero) || numero < 1 || numero > MAX_NUMERO) return falha('dados_invalidos')
    const p: Record<string, unknown> = {}
    if (!regraDoCorpo(objeto(body.dados), p)) return falha('dados_invalidos')
    const { data, error } = await sb.rpc('club_carta_regra_salvar_interno', { p_colecao: body.id, p_numero: numero, p, p_autor: null })
    if (error) return falha(error.message, 400, error.details)
    return NextResponse.json({ regra: data })
  }

  if (body.acao === 'carta_apagar') {
    const numero = Number(body.numero)
    if (!ehId(body.id) || !Number.isInteger(numero) || numero < 1 || numero > MAX_NUMERO) return falha('dados_invalidos')
    const { data, error } = await sb.rpc('club_carta_apagar_interno', { p_colecao: body.id, p_numero: numero, p_autor: null })
    if (error) return falha(error.message, 400, error.details)
    const r = data as { numero: number; arte_anterior: string | null }
    if (r.arte_anterior) await sb.storage.from('club-colecao').remove([r.arte_anterior])
    return NextResponse.json({ apagada: r.numero })
  }

  if (body.acao === 'previa' || body.acao === 'conceder') {
    const numeros = numerosValidos(body.numeros)
    const ids = idsValidos(body.ids)
    if (!ehId(body.id) || !numeros || !ids) return falha('dados_invalidos')
    if (body.acao === 'previa') {
      const { data, error } = await sb.rpc('club_colecao_previa_lote_interno', { p_colecao: body.id, p_numeros: numeros, p_ids: ids })
      if (error) return falha(error.message, 400, error.details)
      return NextResponse.json({ previa: data })
    }
    if (body.origem !== 'manual' && body.origem !== 'brinde') return falha('origem_invalida')
    // A camiseta entrega so as cartas da Base (decisao de 21/11/2026): em capitulo, brinde e recusado.
    if (body.origem === 'brinde') {
      const { data: ed, error: eEd } = await sb.from('club_colecoes').select('papel').eq('id', body.id).maybeSingle()
      if (eEd) return falha(eEd.message, 500)
      if (!ed) return falha('edicao_nao_encontrada')
      if (ed.papel !== 'base') return falha('brinde_so_na_base')
    }
    const nota = typeof body.nota === 'string' ? body.nota.trim().slice(0, 200) : ''
    const { data, error } = await sb.rpc('club_colecao_conceder_tokens_interno', {
      p_colecao: body.id, p_numeros: numeros, p_ids: ids, p_origem: body.origem, p_autor: null, p_nota: nota || null,
    })
    if (error) return falha(error.message, 400, error.details)
    return NextResponse.json({ resultado: data })
  }

  if (body.acao === 'desfazer') {
    if (!ehId(body.lote)) return falha('dados_invalidos')
    const { data, error } = await sb.rpc('club_colecao_desfazer_lote_interno', { p_lote: body.lote, p_autor: null })
    if (error) return falha(error.message, 400, error.details)
    return NextResponse.json({ resultado: data })
  }

  if (body.acao === 'historico') {
    if (!ehId(body.id)) return falha('dados_invalidos')
    const { data, error } = await sb.rpc('club_colecao_historico_interno', { p_colecao: body.id, p_limite: 80 })
    if (error) return falha(error.message, 400, error.details)
    return NextResponse.json({ historico: data })
  }

  if (body.acao === 'pedidos') {
    if (!ehId(body.id)) return falha('dados_invalidos')
    const { data, error } = await sb.rpc('club_retiradas_admin_interno', { p_colecao: body.id })
    if (error) return falha(error.message, 400, error.details)
    return NextResponse.json({ pedidos: data })
  }

  if (body.acao === 'pedido') {
    const numero = Number(body.numero)
    if (!Number.isInteger(numero) || numero < 1 || typeof body.status !== 'string' || !STATUS_PEDIDO.includes(body.status)) return falha('dados_invalidos')
    // Nota ausente mantem a que ja existe; texto vazio apaga.
    const nota = typeof body.nota === 'string' ? body.nota : null
    const { data, error } = await sb.rpc('club_retirada_status_interno', { p_numero: numero, p_status: body.status, p_nota: nota, p_autor: null })
    if (error) return falha(error.message, 400, error.details)
    return NextResponse.json({ pedido: data })
  }

  return falha('Ação inválida')
}
