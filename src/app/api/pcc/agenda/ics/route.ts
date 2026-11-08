// src/app/api/pcc/agenda/ics/route.ts
//
// Arquivo .ics de um evento da Agenda do Club (08/11/2026). Gerado no servidor
// porque, criado no navegador, o Safari do iPhone nao abre a agenda.
//
// A sessao do Club vive no navegador (localStorage), entao a navegacao direta
// nao leva login. Por isso sao dois passos:
//   POST {slug} com Bearer  -> confere a conta e devolve um link assinado de 5 min
//   GET ?slug&exp&sig       -> confere a assinatura e entrega o text/calendar
// O link nao carrega nada da pessoa, so o evento e a validade.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { diaSeguinte, diasDoEvento, somaHora } from '@/lib/pcc/agenda'

export const runtime = 'nodejs'

const VALIDADE_MS = 5 * 60 * 1000
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

// Chave derivada da chave de servico, so para este fim.
function assinar(slug: string, exp: number): string | null {
  const base = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) return null
  const chave = createHmac('sha256', base).update('pcc-agenda-ics-v1').digest()
  return createHmac('sha256', chave).update(`${slug}.${exp}`).digest('hex')
}

export async function POST(req: NextRequest) {
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'indisponivel' }, { status: 503 })
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'nao_logado' }, { status: 401 })
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'nao_logado' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { slug?: string }
  const slug = typeof body.slug === 'string' ? body.slug : ''
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: 'evento_nao_encontrado' }, { status: 404 })
  const { data: e } = await sb.from('club_eventos').select('slug').eq('slug', slug).eq('status', 'publicado').maybeSingle()
  if (!e) return NextResponse.json({ error: 'evento_nao_encontrado' }, { status: 404 })

  const exp = Date.now() + VALIDADE_MS
  const sig = assinar(slug, exp)
  if (!sig) return NextResponse.json({ error: 'indisponivel' }, { status: 503 })
  return NextResponse.json({ url: `/api/pcc/agenda/ics?slug=${slug}&exp=${exp}&sig=${sig}` })
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const slug = q.get('slug') || ''
  const exp = Number(q.get('exp'))
  const sig = q.get('sig') || ''
  const certa = SLUG_RE.test(slug) && Number.isFinite(exp) ? assinar(slug, exp) : null
  // Assinatura sempre hex de 64: fora disso nem chega ao timingSafeEqual (que
  // lancaria com Buffers de tamanhos diferentes).
  const ok = !!certa && /^[0-9a-f]{64}$/.test(sig) && timingSafeEqual(Buffer.from(sig), Buffer.from(certa)) && exp > Date.now()
  if (!ok) return new NextResponse('Link expirado. Volte ao evento e toque de novo em Adicionar à agenda.', { status: 410, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

  const sb = getServiceSupabase()
  if (!sb) return new NextResponse('Indisponível', { status: 503 })
  const { data: e } = await sb.from('club_eventos')
    .select('id, slug, titulo, descricao, formato, local_nome, cidade, uf, link_url, inicio_data, fim_data, hora_inicio, hora_fim, updated_at')
    .eq('slug', slug).eq('status', 'publicado').maybeSingle()
  if (!e) return new NextResponse('Evento não encontrado', { status: 404 })

  const origem = req.nextUrl.origin
  const d = (iso: string) => iso.replace(/-/g, '')
  const h = (t: string) => t.slice(0, 5).replace(':', '') + '00'
  const carimbo = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const linhas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bynx//Agenda do Club//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    // Brasil sem horario de verao desde 2019: um fuso fixo de -03:00.
    'BEGIN:VTIMEZONE', 'TZID:America/Sao_Paulo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0300', 'TZOFFSETTO:-0300', 'TZNAME:-03', 'END:STANDARD', 'END:VTIMEZONE',
    'BEGIN:VEVENT', `UID:${e.id}@bynx.gg`, `DTSTAMP:${carimbo}`,
  ]
  if (e.hora_inicio) {
    // O horario vale para cada dia: varios dias viram um bloco diario (RRULE).
    const fimHora = e.hora_fim ? e.hora_fim.slice(0, 5) : somaHora(e.hora_inicio.slice(0, 5), 1)
    // Fim antes do inicio: o bloco termina no dia seguinte (live das 22h a 1h).
    const fimDia = fimHora < e.hora_inicio.slice(0, 5) ? diaSeguinte(e.inicio_data) : e.inicio_data
    linhas.push(`DTSTART;TZID=America/Sao_Paulo:${d(e.inicio_data)}T${h(e.hora_inicio)}`, `DTEND;TZID=America/Sao_Paulo:${d(fimDia)}T${h(fimHora)}`)
    const n = diasDoEvento(e)
    if (n > 1) linhas.push(`RRULE:FREQ=DAILY;COUNT=${n}`)
  } else {
    linhas.push(`DTSTART;VALUE=DATE:${d(e.inicio_data)}`, `DTEND;VALUE=DATE:${d(diaSeguinte(e.fim_data))}`)
  }
  const url = `${origem}/pokecreatorsclub/agenda/${e.slug}`
  linhas.push(
    `SUMMARY:${esc(e.titulo)}`,
    `DESCRIPTION:${esc([e.descricao, e.link_url, `Agenda do Club: ${url}`].filter(Boolean).join('\n\n'))}`,
    `URL:${url}`,
  )
  if (e.formato === 'presencial') linhas.push(`LOCATION:${esc([e.local_nome, e.cidade, e.uf].filter(Boolean).join(', '))}`)
  // Com horario: 1 hora antes. Dia inteiro: as 9h do dia (um -PT1H cairia as 23h da vespera).
  linhas.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.titulo)}`, e.hora_inicio ? 'TRIGGER:-PT1H' : 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR')

  return new NextResponse(linhas.map(dobrar).join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${e.slug}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

// Texto do iCalendar: escapa \ ; , e quebra de linha.
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n')

// Linhas com mais de 75 bytes continuam na seguinte com um espaco (RFC 5545).
function dobrar(linha: string): string {
  const partes: string[] = []
  let atual = ''
  for (const ch of linha) {
    if (Buffer.byteLength(atual + ch) > 74) { partes.push(atual); atual = ' ' + ch } else atual += ch
  }
  partes.push(atual)
  return partes.join('\r\n')
}
