import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notify } from '@/lib/notify'
import { sendTrialLojaExpirandoEmail, sendTrialLojaExpirouEmail } from '@/lib/email'

/**
 * GET /api/cron-loja-trial  (Vercel Cron, ver vercel.json)
 *
 * Termina o trial Pro da loja: avisa antes e rebaixa pro Basico no dia.
 *
 * ★ POR QUE EXISTE (12/09/2026). A loja nascia com `plano: 'pro'` e o
 * comentario dizia "trial Pro 14 dias" -- mas NADA, em lugar nenhum, a
 * rebaixava depois. Medido antes de escrever: 11 lojas em Pro/Premium sem
 * nenhuma assinatura, a mais antiga ha 109 DIAS, e o FAQ publico prometendo
 * "ao fim do trial, sua loja continua ativa no plano Basico". Prometia e nao
 * executava.
 *
 * O Du perguntou o que abriu isso: "como ele e cobrado se nao tem cartao
 * cadastrado?". Nao era cobrado -- nunca foi. `stripe_subscription_id` e nulo
 * nas 12 lojas. O `trial_period_days: 14` que existe no checkout de assinatura
 * e outra coisa, e ninguem chegou lá.
 *
 * ★ `plano_expira_em` NULL E PERMANENTE, E ISSO E DELIBERADO. A semantica ja
 * era essa no /api/admin/lojas/[id]/plano ("dias null -> NULL, permanente") e
 * agora vale pro cadastro tambem. Regra do Du: "apenas se eu for pelo admin e
 * liberar o PRO ou PREMIUM, aí sim deixar sem expirar -- nesse caso e decisao
 * minha com a loja". Por isso a varredura exige `plano_expira_em is not null`:
 * plano concedido a mao nunca e tocado por rotina.
 *
 * E essa semantica NAO e invencao minha, ela ja estava em uso: das 11 lojas em
 * Pro/Premium, 10 estao com `plano_expira_em` nulo e a Castle Games esta com
 * prazo de verdade (premium ate 30/11/2026), posto a mao no admin. O unico
 * candidato da varredura hoje e ela, e so em 30/11 -- nas outras 10 o cron nao
 * mexe. Dar prazo pra elas e decisao do Du, nao efeito colateral desta rota.
 *
 * ★ QUEM ASSINA TAMBEM NAO E TOCADO: `stripe_subscription_id is null` no
 * filtro. Quem paga tem o ciclo governado pelo webhook da Stripe, nao por aqui
 * -- rebaixar um assinante em dia seria o pior erro possivel desta rota.
 *
 * Auth: Bearer ${CRON_SECRET}.
 */

/** Aviso antes do fim. 3 dias da tempo de decidir sem virar cobranca. */
const DIAS_DE_AVISO = 3

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  )
}

type Loja = {
  id: string; nome: string; slug: string; plano: string
  plano_expira_em: string; owner_user_id: string
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const sb = supabaseAdmin()

  try {
    const { data, error } = await sb
      .from('lojas')
      .select('id, nome, slug, plano, plano_expira_em, owner_user_id')
      .in('plano', ['pro', 'premium'])
      .not('plano_expira_em', 'is', null)   // NULL = permanente, nao se toca
      .is('stripe_subscription_id', null)   // quem paga e governado pelo webhook
      .limit(500)

    // ★ Falha de leitura NAO pode virar "nada a fazer": o cron passaria a
    //   reportar ok todo dia enquanto os trials nunca terminam -- que e
    //   exatamente o estado que esta rota vem consertar.
    if (error) {
      console.error('[loja-trial] leitura', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const lojas = (data || []) as Loja[]
    const agora = Date.now()
    const expirar: Loja[] = []
    const avisar: Array<Loja & { dias: number }> = []

    for (const l of lojas) {
      const fim = new Date(l.plano_expira_em).getTime()
      if (!Number.isFinite(fim)) continue
      const dias = Math.ceil((fim - agora) / 86400_000)
      if (dias <= 0) expirar.push(l)
      else if (dias <= DIAS_DE_AVISO) avisar.push({ ...l, dias })
    }

    if (dry) {
      return NextResponse.json({
        ok: true, dry: true, candidatas: lojas.length,
        expirariam: expirar.map(l => ({ slug: l.slug, plano: l.plano, venceu_em: l.plano_expira_em })),
        avisaria: avisar.map(l => ({ slug: l.slug, dias: l.dias })),
      })
    }

    const donos = [...new Set([...expirar, ...avisar].map(l => l.owner_user_id))]
    const { data: usrs } = donos.length
      ? await sb.from('users').select('id, name, email').in('id', donos)
      : { data: [] as Array<{ id: string; name: string | null; email: string | null }> }
    const pessoa = new Map((usrs || []).map(u => [u.id, u]))

    // ── 1. AVISO, ate 3 dias antes ──────────────────────────────────────────
    // Dedup pelo sino, com a data de expiracao na chave: se o Du empurrar o
    // prazo no admin, a loja volta a poder ser avisada.
    let avisadas = 0
    for (const l of avisar) {
      const marca = `${l.id}:${l.plano_expira_em}`
      const { count } = await sb
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'aviso')
        .eq('data->>marco_trial', marca)
      if ((count || 0) > 0) continue

      await notify(
        l.owner_user_id, 'aviso',
        'Seu plano Pro termina em breve',
        `O período Pro da ${l.nome} termina ${l.dias === 1 ? 'amanhã' : `em ${l.dias} dias`}. Depois disso a loja segue no ar, no plano Básico.`,
        { link: `/minha-loja/${l.id}/plano`, loja_id: l.id, marco_trial: marca },
      )
      const u = pessoa.get(l.owner_user_id)
      if (u?.email) {
        await sendTrialLojaExpirandoEmail({
          to: u.email, nome: u.name || '', loja: l.nome, lojaId: l.id, dias: l.dias,
        }).catch(e => console.error('[loja-trial] email aviso', l.slug, e?.message))
      }
      avisadas++
    }

    // ── 2. REBAIXAMENTO ─────────────────────────────────────────────────────
    const rebaixadas: string[] = []
    for (const l of expirar) {
      // ★ UPDATE condicional: `plano_expira_em` e o token de versao. Se o Du
      //   empurrou o prazo ou concedeu permanente entre a leitura e a escrita,
      //   nada e gravado. Zero linhas aqui NAO e erro -- e a corrida perdida,
      //   e perder e o resultado certo.
      const { data: mexeu, error: errUp } = await sb
        .from('lojas')
        .update({ plano: 'basico', plano_expira_em: null })
        .eq('id', l.id)
        .eq('plano_expira_em', l.plano_expira_em)
        .eq('plano', l.plano)
        .is('stripe_subscription_id', null)
        .select('id')

      if (errUp) { console.error('[loja-trial] update', l.slug, errUp.message); continue }
      if (!mexeu?.length) { console.log('[loja-trial] mudou no meio:', l.slug); continue }

      rebaixadas.push(l.slug)

      await notify(
        l.owner_user_id, 'aviso',
        'Sua loja está no plano Básico',
        `O período Pro da ${l.nome} terminou. A loja continua no ar; a galeria de fotos e o selo Pro saíram da página pública.`,
        { link: `/minha-loja/${l.id}/plano`, loja_id: l.id },
      )
      const u = pessoa.get(l.owner_user_id)
      if (u?.email) {
        await sendTrialLojaExpirouEmail({
          to: u.email, nome: u.name || '', loja: l.nome, lojaId: l.id,
        }).catch(e => console.error('[loja-trial] email fim', l.slug, e?.message))
      }
    }

    return NextResponse.json({
      ok: true, candidatas: lojas.length,
      rebaixadas: rebaixadas.length, slugs: rebaixadas, avisadas,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message || 'erro' }, { status: 500 })
  }
}
