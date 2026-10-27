// src/app/api/eventos/lembrete/route.ts
//
// "Me lembra do código": a pessoa deixa o e-mail na landing da oferta de
// evento e recebe o código do cupom para usar até o prazo.
//
// Por que existe (17/10/2026): na TCG CON foram 59 visitas e 0 cadastro; na
// Poke Fan Fest, 63 visitas e 0 cadastro nas primeiras 7 horas. Quem clica no
// anuncio esta no evento, com o celular na mao, e nao preenche CPF em pe. Sem
// este passo, quem sai da pagina some para sempre -- e a oferta vale ate
// domingo a noite.
//
// O lead vive em `campanha_convites` (mesma tabela da campanha Presente), com
// `campanha` = id da oferta e `origem` = 'landing'. Nada de tabela nova. A
// chave unica (campanha, email) torna o pedido idempotente, e o reenvio tem
// janela minima para nao virar maquina de spam contra a cota da Resend.
//
// Rota PUBLICA e sem auth: rate limit por IP, e-mail validado e normalizado,
// oferta validada pela lista (nunca texto livre do cliente).

import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { criarLimitador, ipDaRequest } from '@/lib/rateLimit'
import { ehOfertaEvento, ofertaEvento, ofertaEventoAtiva } from '@/lib/ofertasEvento'
import { sendCupomEventoEmail } from '@/lib/email'

// 8 pedidos por IP a cada 10 min: folga para quem erra o e-mail, aperto para script.
const limitador = criarLimitador({ janelaMs: 10 * 60_000, max: 8 })
/** Mesmo e-mail, mesma oferta: so reenvia depois desta janela. */
const REENVIO_MS = 10 * 60_000
const MAX_EMAIL = 254

function emailValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
}

export async function POST(req: NextRequest) {
  try {
    const ip = ipDaRequest(req)
    if (ip) {
      limitador.gc()
      if (limitador.excedeu(ip)) {
        return NextResponse.json({ error: 'Muitos pedidos seguidos. Aguarde alguns minutos.' }, { status: 429 })
      }
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
    }

    const { oferta } = body as { oferta?: unknown }
    if (!ehOfertaEvento(oferta)) {
      return NextResponse.json({ error: 'Oferta inválida.' }, { status: 400 })
    }
    const ofe = ofertaEvento(oferta)
    // Oferta sem landing (modal de Halloween) e so para quem esta logado:
    // mandar o codigo por e-mail para qualquer um vazaria o cupom.
    if ('semLanding' in ofe && ofe.semLanding) {
      return NextResponse.json({ error: 'Oferta inválida.' }, { status: 400 })
    }
    if (!ofertaEventoAtiva(oferta)) {
      return NextResponse.json({ error: 'A oferta encerrou.', code: 'OFERTA_ENCERRADA' }, { status: 410 })
    }

    const email = String((body as { email?: unknown }).email ?? '')
      .replace(/[\r\n]+/g, '')
      .trim()
      .toLowerCase()
      .slice(0, MAX_EMAIL)
    if (!emailValido(email)) {
      return NextResponse.json({ error: 'Confira o e-mail digitado.', campo: 'email' }, { status: 400 })
    }

    const sb = getServiceSupabase()
    if (!sb) return NextResponse.json({ error: 'Serviço indisponível. Tente de novo em instantes.' }, { status: 503 })

    const agora = new Date()
    const { data: existente, error: selErr } = await sb
      .from('campanha_convites')
      .select('id, lead_criado_em')
      .eq('campanha', ofe.id)
      .eq('email', email)
      .limit(1)
    if (selErr) console.error('[eventos/lembrete] select falhou:', selErr.message)

    const lead = existente?.[0] as { id: string; lead_criado_em: string | null } | undefined
    if (lead?.lead_criado_em && agora.getTime() - Date.parse(lead.lead_criado_em) < REENVIO_MS) {
      // Ja mandamos ha pouco. Responde como sucesso: a pessoa nao precisa saber
      // da janela, e o e-mail dela ja esta na caixa.
      return NextResponse.json({ ok: true, repetido: true })
    }

    if (lead) {
      const { error } = await sb
        .from('campanha_convites')
        .update({ lead_criado_em: agora.toISOString(), origem: 'landing' })
        .eq('id', lead.id)
      if (error) console.error('[eventos/lembrete] update falhou:', error.message)
    } else {
      const { error } = await sb
        .from('campanha_convites')
        .insert({ campanha: ofe.id, nome: '', email, origem: 'landing', lead_criado_em: agora.toISOString() })
      // Corrida entre dois cliques cai na chave unica: o lead existe, segue o envio.
      if (error && error.code !== '23505') console.error('[eventos/lembrete] insert falhou:', error.message)
    }

    const res = await sendCupomEventoEmail({ to: email, oferta })
    if (res.error) {
      return NextResponse.json({ error: 'Não conseguimos enviar o e-mail. Confira o endereço e tente de novo.' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[eventos/lembrete] CRITICAL:', e?.message)
    return NextResponse.json({ error: 'Não conseguimos enviar o e-mail. Tente de novo em instantes.' }, { status: 500 })
  }
}
