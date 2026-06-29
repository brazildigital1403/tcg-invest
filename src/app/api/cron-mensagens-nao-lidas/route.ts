import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendMensagensNaoLidasEmail } from '@/lib/email'

/**
 * GET /api/cron-mensagens-nao-lidas  (Vercel Cron, ver vercel.json)
 *
 * Para cada usuario com mensagens do marketplace nao lidas ha mais de 24h
 * (e ainda nao avisadas por email), envia UM email resumindo a contagem e
 * marca essas mensagens como email_nao_lida_enviada=true (nao reenvia).
 *
 * Auth: Bearer ${CRON_SECRET}.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  )

  const corte = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  try {
    // mensagens nao lidas, > 24h, ainda nao avisadas, com o anuncio embutido
    const { data: msgs, error } = await sb
      .from('marketplace_mensagens')
      .select('id, anuncio_id, sender_id, marketplace(user_id, buyer_id, card_name, status)')
      .is('read_at', null)
      .eq('email_nao_lida_enviada', false)
      .lt('created_at', corte)
      .limit(2000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    type Acc = { qtd: number; msgIds: string[]; anuncioId: string }
    const porDest = new Map<string, Acc>()
    const msgIdsTocadas: string[] = []

    for (const m of msgs || []) {
      const anuncio: any = Array.isArray(m.marketplace) ? m.marketplace[0] : m.marketplace
      if (!anuncio) continue
      const status = anuncio.status as string
      // ignora conversas encerradas
      if (status === 'concluido' || status === 'cancelado') {
        msgIdsTocadas.push(m.id) // marca como avisada pra nao reprocessar
        continue
      }
      const destino =
        m.sender_id === anuncio.user_id ? anuncio.buyer_id : anuncio.user_id
      if (!destino) continue

      const acc = porDest.get(destino) || { qtd: 0, msgIds: [], anuncioId: m.anuncio_id }
      acc.qtd += 1
      acc.msgIds.push(m.id)
      porDest.set(destino, acc)
    }

    // emails + nomes dos destinatarios
    const destIds = [...porDest.keys()]
    let enviados = 0
    if (destIds.length > 0) {
      const { data: usrs } = await sb.from('users').select('id, name, email').in('id', destIds)
      const byId = new Map((usrs || []).map((u) => [u.id, u]))

      for (const [destId, acc] of porDest) {
        const u = byId.get(destId)
        if (u?.email) {
          await sendMensagensNaoLidasEmail({
            to: u.email, name: u.name || '', qtd: acc.qtd, anuncioId: acc.anuncioId,
          }).catch(() => {})
          enviados++
        }
        msgIdsTocadas.push(...acc.msgIds)
      }
    }

    // marca todas as mensagens processadas (enviadas ou de conversas encerradas)
    if (msgIdsTocadas.length > 0) {
      for (let i = 0; i < msgIdsTocadas.length; i += 200) {
        const lote = msgIdsTocadas.slice(i, i + 200)
        await sb
          .from('marketplace_mensagens')
          .update({ email_nao_lida_enviada: true })
          .in('id', lote)
      }
    }

    return NextResponse.json({
      ok: true, candidatas: msgs?.length || 0, destinatarios: destIds.length, enviados,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'erro' }, { status: 500 })
  }
}
