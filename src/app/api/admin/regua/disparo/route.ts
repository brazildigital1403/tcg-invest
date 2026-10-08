import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { temTemplate } from '@/lib/regua/registro'
import {
  GATILHOS, ErroDisparo, contarEvento, dispararEditorial, edicaoExemplo, ehEditorial, modoAtual, type Publico,
} from '@/lib/regua/motor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Disparo e contagem da regua para o /admin/regua (requireAdmin).
 *
 * GET  ?template=EXX
 *   Contagem SECA (nao grava, nao envia): quem bate no gatilho hoje, quantos
 *   passam nas regras e a contagem por motivo de exclusao. Evento: ignora o
 *   calendario (mostra "se fosse o dia"). Editorial: com a edicao de exemplo.
 *   Devolve tambem gatilho, publico, bloqueio, a edicao de partida e o modo.
 *
 * POST { template, edicao, publico, acao: 'simular'|'enviar', confirmacao }
 *   So EDITORIAIS (E01, E10, E11, E12, E17, E18, E19).
 *   - simular: conta e monta 3 amostras; nao grava nada.
 *   - enviar: exige REGUA_ATIVA=1, template sem bloqueio e
 *     confirmacao === "ENVIAR <template>" (a pagina pede duas confirmacoes).
 *   publico: { tipo: 'segmento', onda?: 1|2|3 } | { tipo: 'emails', emails: [...] }
 */

export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const id = (req.nextUrl.searchParams.get('template') || '').toUpperCase()
  if (!temTemplate(id)) return NextResponse.json({ error: 'template inexistente' }, { status: 400 })
  const info = GATILHOS[id]
  const base = { template: id, modo: modoAtual(), ...info, edicao: ehEditorial(id) ? edicaoExemplo(id) : null }
  try {
    if (info.tipo === 'leilao') return NextResponse.json({ ...base, contagem: null })
    if (info.tipo === 'evento') return NextResponse.json({ ...base, contagem: await contarEvento(id, true) })
    const r = await dispararEditorial({ template: id, edicao: edicaoExemplo(id), publico: { tipo: 'segmento' }, acao: 'simular' })
    return NextResponse.json({ ...base, contagem: r })
  } catch (e) {
    const msg = (e as Error)?.message || 'erro'
    console.error('[admin/regua] contagem', id, msg)
    return NextResponse.json({ ...base, contagem: null, erro: msg }, { status: e instanceof ErroDisparo ? 400 : 500 })
  }
}

function lerPublico(v: unknown): Publico | null {
  if (!v || typeof v !== 'object') return { tipo: 'segmento' }
  const p = v as { tipo?: unknown; onda?: unknown; emails?: unknown }
  if (p.tipo === 'emails') {
    if (!Array.isArray(p.emails)) return null
    return { tipo: 'emails', emails: p.emails.filter((e): e is string => typeof e === 'string') }
  }
  const onda = p.onda === 1 || p.onda === 2 || p.onda === 3 ? p.onda : undefined
  return { tipo: 'segmento', ...(onda ? { onda } : {}) }
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'corpo inválido' }, { status: 400 })
  }
  const template = String(body.template || '').toUpperCase()
  if (!ehEditorial(template)) return NextResponse.json({ error: 'Só os editoriais têm disparo pelo admin.' }, { status: 400 })
  const acao = body.acao === 'enviar' ? 'enviar' : body.acao === 'simular' ? 'simular' : null
  if (!acao) return NextResponse.json({ error: "acao deve ser 'simular' ou 'enviar'" }, { status: 400 })
  const edicao = body.edicao && typeof body.edicao === 'object' && !Array.isArray(body.edicao) ? body.edicao as Record<string, unknown> : {}
  const publico = lerPublico(body.publico)
  if (!publico) return NextResponse.json({ error: 'publico inválido' }, { status: 400 })
  if (acao === 'enviar' && body.confirmacao !== `ENVIAR ${template}`) {
    return NextResponse.json({ error: `Confirmação ausente: envie confirmacao = "ENVIAR ${template}".` }, { status: 400 })
  }
  try {
    const r = await dispararEditorial({ template, edicao, publico, acao })
    console.log(`[admin/regua] ${acao} ${template}: ${JSON.stringify({ publico: publico.tipo, elegiveis: r.elegiveis, motivos: r.motivos, envio: r.envio && { e: r.envio.enviados, s: r.envio.simulados, x: r.envio.falhas }, incompleto: r.incompleto })}`)
    return NextResponse.json(r)
  } catch (e) {
    const msg = (e as Error)?.message || 'erro'
    console.error('[admin/regua] disparo', template, msg)
    return NextResponse.json({ error: msg }, { status: e instanceof ErroDisparo ? 400 : 500 })
  }
}
