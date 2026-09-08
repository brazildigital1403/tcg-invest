import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { notify } from '@/lib/notify'
import { sendNegociacaoExpiradaEmail, sendNegociacaoExpirandoEmail } from '@/lib/email'
import { STATUS_EXPIRAVEIS, HORAS_ATE_LIBERAR } from '@/lib/marketplaceStatus'

/**
 * GET /api/cron-marketplace-expira  (Vercel Cron, ver vercel.json)
 *
 * Devolve ao marketplace o anuncio que ficou parado numa negociacao.
 *
 * ★ POR QUE EXISTE (08/09/2026). O comprador clicava "Tenho interesse", o
 * anuncio saia do ar, e se ninguem cancelasse ele NUNCA voltava. Medido em
 * producao no dia: 5 anuncios presos ha 2.164h, 1.624h, 807h, 175h e 31h --
 * dois deles sem UMA mensagem trocada. Nao havia nem como saber ha quanto
 * tempo: a tabela so tinha `created_at`, a data do anuncio. Por isso a
 * migration do `status_em` veio antes desta rota.
 *
 * ★ 72H, E O NUMERO SAIU DO DADO. Os mortos estavam parados ha 7 a 90 dias; o
 * unico vivo, ha 31h -- uma negociacao de R$ 1.900 com mensagem de dois dias
 * antes. 24h mataria justamente essa. Qualquer corte entre 3 e 7 dias separa
 * os dois grupos; 72h fica no meio com folga de dias de cada lado.
 *
 * ★ O RELOGIO E `greatest(status_em, ultima mensagem)`. So `status_em` nao
 * serve: a conversa pode estar viva com o status parado ha dias, e expirar no
 * meio dela seria o pior erro possivel. So a ultima mensagem tambem nao: dois
 * dos cinco travados tem ZERO mensagem e ficariam presos pra sempre.
 *
 * Auth: Bearer ${CRON_SECRET}.
 */

/** Aviso antes do corte. Quem esta com a bola tem 24h pra reagir. */
const HORAS_NUDGE = HORAS_ATE_LIBERAR - 24

/** Teto de revalidacao por rodada -- resolver slug toca a view pokemon_cards. */
const MAX_REVALIDATE = 20

type Alvo = {
  id: string; slug: string | null; card_id: string | null; card_name: string | null
  price: number | null; status: string; status_em: string
  user_id: string; buyer_id: string | null
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // `?dry=1` roda sem escrever nada. E como esta rota foi conferida na
  // primeira vez: listar o que expiraria antes de deixar expirar.
  const dry = req.nextUrl.searchParams.get('dry') === '1'

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  )

  try {
    const { data: travados, error } = await sb
      .from('marketplace')
      .select('id, slug, card_id, card_name, price, status, status_em, user_id, buyer_id')
      // Lista EXPLICITA, nunca `status <> disponivel`: nao ha check constraint
      // em `status` e o cliente consegue escrever nele, entao a negacao
      // varreria qualquer lixo. `enviado` e `vendido` ficam de fora -- a carta
      // ja saiu pelo correio, republicar convidaria uma segunda venda.
      .in('status', STATUS_EXPIRAVEIS as unknown as string[])
      .is('removido_em', null)
      .limit(500)

    // ★ Falha NAO pode virar "nada a expirar" em silencio: o cron passaria a
    //   reportar ok=true todo dia enquanto os anuncios apodrecem.
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const alvos = (travados || []) as Alvo[]
    if (alvos.length === 0) return NextResponse.json({ ok: true, dry, candidatos: 0 })

    const ids = alvos.map(a => a.id)

    // Ultima mensagem por anuncio -- a outra metade do relogio.
    const { data: msgs } = await sb
      .from('marketplace_mensagens')
      .select('anuncio_id, created_at')
      .in('anuncio_id', ids)
    const ultimaMsg = new Map<string, number>()
    for (const m of msgs || []) {
      const t = new Date(m.created_at as string).getTime()
      const atual = ultimaMsg.get(m.anuncio_id as string) || 0
      if (t > atual) ultimaMsg.set(m.anuncio_id as string, t)
    }

    // ★ GUARDA DO PEDIDO VIVO. Hoje o checkout de carta cria o pedido SEM
    //   reservar o anuncio, entao os dois caminhos nao se cruzam -- mas isso e
    //   detalhe de outro fluxo, que muda sem avisar este. Explicito.
    const { data: pedidos } = await sb
      .from('pedidos')
      .select('marketplace_id')
      .in('marketplace_id', ids)
      .in('status', ['aguardando_pagamento', 'pago', 'enviado'])
    const comPedido = new Set((pedidos || []).map(p => p.marketplace_id as string))

    const agora = Date.now()
    const expirar: Array<Alvo & { horas: number }> = []
    const avisar: Array<Alvo & { horas: number }> = []

    for (const a of alvos) {
      if (comPedido.has(a.id)) continue
      const base = Math.max(new Date(a.status_em).getTime(), ultimaMsg.get(a.id) || 0)
      if (!Number.isFinite(base)) continue
      const horas = (agora - base) / 3600_000
      if (horas >= HORAS_ATE_LIBERAR) expirar.push({ ...a, horas: Math.round(horas) })
      else if (horas >= HORAS_NUDGE) avisar.push({ ...a, horas: Math.round(horas) })
    }

    if (dry) {
      return NextResponse.json({
        ok: true, dry: true, candidatos: alvos.length,
        expirariam: expirar.map(a => ({ slug: a.slug, status: a.status, horas: a.horas })),
        avisaria: avisar.map(a => ({ slug: a.slug, horas: a.horas })),
      })
    }

    // ── contatos ────────────────────────────────────────────────────────────
    const userIds = [...new Set([
      ...expirar.flatMap(a => [a.user_id, a.buyer_id]),
      ...avisar.flatMap(a => [a.user_id, a.buyer_id]),
    ].filter(Boolean))] as string[]
    const { data: usrs } = userIds.length
      ? await sb.from('users').select('id, name, email').in('id', userIds)
      : { data: [] as any[] }
    const pessoa = new Map((usrs || []).map(u => [u.id as string, u]))

    // ── 1. AVISO, 24h antes ─────────────────────────────────────────────────
    // Dedup pelo proprio sino: sem isto o cron de 6 em 6h avisaria 4x por dia.
    // A chave inclui `status_em`, entao uma negociacao que reiniciou o relogio
    // volta a poder ser avisada.
    let avisados = 0
    for (const a of avisar) {
      const marca = `${a.id}:${a.status_em}`
      const { count } = await sb
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'aviso')
        .eq('data->>marco_expira', marca)
      if ((count || 0) > 0) continue

      const restam = Math.max(1, Math.round(HORAS_ATE_LIBERAR - a.horas))
      for (const uid of [a.user_id, a.buyer_id].filter(Boolean) as string[]) {
        await notify(
          uid, 'aviso',
          'Negociação prestes a expirar',
          `A negociação de "${a.card_name || 'uma carta'}" está sem resposta. Em ${restam}h o anúncio volta para o marketplace.`,
          { link: `/marketplace?conversa=${a.id}`, anuncio_id: a.id, marco_expira: marca },
        )
        // Sino E email: publico mobile que nao abre o app todo dia so ve o
        // sino depois -- e depois pode ser tarde. O CTA leva a CONVERSA, que
        // e onde a pessoa reinicia o relogio respondendo.
        const u = pessoa.get(uid)
        if (u?.email) {
          await sendNegociacaoExpirandoEmail({
            to: u.email, nome: u.name || '',
            cardName: a.card_name || 'a carta', price: a.price,
            anuncioId: a.id, horasRestantes: restam,
          }).catch(e => console.error('[expira] email aviso', e?.message))
        }
      }
      avisados++
    }

    // ── 2. EXPIRACAO ────────────────────────────────────────────────────────
    const soltos: string[] = []
    const cartasPraRevalidar = new Set<string>()

    for (const a of expirar) {
      // ★ UPDATE CONDICIONAL. `status_em` muda sempre que `status` muda (o
      //   trigger garante), entao ele serve de token de versao de graca: se
      //   alguem concluiu a venda entre a leitura e agora, nada e escrito.
      const { data: mexeu, error: errUp } = await sb
        .from('marketplace')
        .update({ status: 'disponivel', buyer_id: null })
        .eq('id', a.id)
        .eq('status', a.status)
        .eq('status_em', a.status_em)
        .is('removido_em', null)
        .select('id')

      if (errUp) { console.error('[expira] update', a.slug, errUp.message); continue }
      // Zero linhas nao e erro: e a corrida perdida, e perder e o certo.
      if (!mexeu || mexeu.length === 0) { console.log('[expira] mudou no meio:', a.slug); continue }

      soltos.push(a.slug || a.id)
      if (a.card_id) cartasPraRevalidar.add(a.card_id)

      for (const papel of ['vendedor', 'comprador'] as const) {
        const uid = papel === 'vendedor' ? a.user_id : a.buyer_id
        if (!uid) continue
        const u = pessoa.get(uid)
        await notify(
          uid, 'cancelado',
          papel === 'vendedor' ? 'Seu anúncio voltou ao marketplace' : 'A carta voltou a ficar disponível',
          papel === 'vendedor'
            ? `A negociação de "${a.card_name || 'sua carta'}" ficou ${a.horas}h sem resposta e o anúncio foi liberado.`
            : `A negociação de "${a.card_name || 'a carta'}" ficou ${a.horas}h parada e o anúncio não está mais reservado para você.`,
          { link: `/anuncio/${a.slug || a.id}`, anuncio_id: a.id },
        )
        if (u?.email) {
          // Email nao pode derrubar a rodada: o estoque ja voltou ao ar.
          await sendNegociacaoExpiradaEmail({
            to: u.email, nome: u.name || '', papel,
            cardName: a.card_name || 'a carta', price: a.price,
            anuncioSlug: a.slug || a.id, horas: a.horas,
          }).catch(e => console.error('[expira] email', papel, e?.message))
        }
      }
    }

    // ── 3. FURAR O ISR DA CARTA ─────────────────────────────────────────────
    // A /carta e a UNICA superficie cacheada (24h); vitrine e /anuncio sao
    // force-dynamic e se atualizam sozinhas. `revalidatePath` direto, nao a
    // rota /api/revalidate -- aquela e a porta pra quem esta FORA do app.
    // NUNCA revalidar a arvore: seriam 66,9 mil paginas de carta de volta pra
    // fila de render, que e o cenario de 29/07.
    let revalidadas = 0
    if (cartasPraRevalidar.size > 0) {
      const alvo = [...cartasPraRevalidar].slice(0, MAX_REVALIDATE)
      const { data: cartas } = await sb.from('pokemon_cards').select('id, slug').in('id', alvo)
      for (const c of cartas || []) {
        if (!c.slug) continue
        try { revalidatePath(`/carta/${c.slug}`); revalidadas++ }
        catch (e: any) { console.error('[expira] revalidate', c.slug, e?.message) }
      }
    }

    return NextResponse.json({
      ok: true, candidatos: alvos.length,
      liberados: soltos.length, slugs: soltos, avisados, revalidadas,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'erro' }, { status: 500 })
  }
}
