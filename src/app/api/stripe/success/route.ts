// src/app/api/stripe/success/route.ts
//
// Redireciona o cliente apos o checkout E — como REDE DE SEGURANCA — garante
// o ACESSO na hora (fallback idempotente), caso o webhook nao dispare.
//
// O fallback faz SO o SET de acesso (is_pro/plano/plano de loja/desbloqueios),
// que e idempotente (repetir = mesmo resultado). Creditos de scan (aditivos),
// lancamento financeiro (PI unico) e emails continuam SO no webhook, pra evitar
// duplicidade. Se o webhook rodar depois (ou via resend), ele faz o backfill.

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServiceSupabase } from '@/lib/supabaseServer'

const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

function periodEndFromSub(sub: Stripe.Subscription): number | null {
  const itemEnd = sub.items?.data?.[0]?.current_period_end as number | undefined
  if (typeof itemEnd === 'number' && Number.isFinite(itemEnd)) return itemEnd
  const subEnd = (sub as any).current_period_end as number | undefined
  if (typeof subEnd === 'number' && Number.isFinite(subEnd)) return subEnd
  return null
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.redirect(`${APP}/minha-conta`)

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[stripe/success] STRIPE_SECRET_KEY ausente')
    return NextResponse.redirect(`${APP}/minha-conta`)
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' })
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // Para Lojista: payment_status pode vir 'no_payment_required' durante trial.
    const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
    if (!paid) {
      return NextResponse.redirect(`${APP}/minha-conta`)
    }

    const plano = session.metadata?.plano || ''
    const userId = session.metadata?.userId

    // ─────────────────────────────────────────────────────────────────────
    // FALLBACK DE PROVISIONAMENTO (idempotente) — libera o acesso na hora.
    // Nunca lanca: se falhar, apenas loga e segue pro redirect (webhook faz
    // o backfill quando processar o evento).
    // ─────────────────────────────────────────────────────────────────────
    if (userId) {
      const sb = getServiceSupabase()
      if (sb) {
        try {
          if (plano === 'separadores') {
            await sb.from('users').update({
              separadores_desbloqueado: true,
              ...(session.customer ? { stripe_customer_id: session.customer as string } : {}),
            }).eq('id', userId)

          } else if (plano === 'master_set' && session.metadata?.setId) {
            await sb.from('user_master_sets').upsert({
              user_id: userId,
              set_id: session.metadata.setId,
              source: 'stripe',
            }, { onConflict: 'user_id,set_id' })
            if (session.customer) {
              await sb.from('users').update({ stripe_customer_id: session.customer as string }).eq('id', userId)
            }

          } else if (plano.startsWith('lojista_') && session.subscription && session.metadata?.lojaId) {
            const tier = plano.startsWith('lojista_premium_') ? 'premium' : 'pro'
            const sub = await stripe.subscriptions.retrieve(session.subscription as string)
            const trialEnd = (sub as any).trial_end as number | undefined
            const pe = trialEnd && Number.isFinite(trialEnd) ? trialEnd : periodEndFromSub(sub)
            const expira = pe ? new Date(pe * 1000).toISOString() : null
            await sb.from('lojas').update({
              plano: tier,
              ...(expira ? { plano_expira_em: expira } : {}),
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
            }).eq('id', session.metadata.lojaId)

          } else if (session.subscription && !plano.startsWith('scan_')) {
            // Pro / Plus usuario (assinatura)
            const sub = await stripe.subscriptions.retrieve(session.subscription as string)
            const priceId = sub.items.data[0]?.price.id
            const isPlus = priceId === process.env.STRIPE_PRICE_PLUS
            const planoDb = isPlus ? 'plus' : (priceId === process.env.STRIPE_PRICE_ANUAL ? 'anual' : 'mensal')
            const pe = periodEndFromSub(sub)
            const proExpiraEm = pe ? new Date(pe * 1000).toISOString() : null
            await sb.from('users').update({
              is_pro: !isPlus,
              plano: planoDb,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              ...(proExpiraEm ? { pro_expira_em: proExpiraEm } : {}),
            }).eq('id', userId)
          }
        } catch (e: any) {
          console.error('[stripe/success] fallback provisioning falhou (webhook faz backfill):', e?.message)
        }
      }
    }

    // ─── Redirects (comportamento existente) ───────────────────────────────

    // Pacote de Scan
    if (plano.startsWith('scan_')) {
      const creditos = session.metadata?.creditos || '0'
      return NextResponse.redirect(`${APP}/minha-colecao?scan_creditos=${creditos}`)
    }

    // Separadores
    if (plano === 'separadores') {
      return NextResponse.redirect(`${APP}/separadores?desbloqueado=1`)
    }

    // Master Set
    if (plano === 'master_set') {
      const setId = session.metadata?.setId
      return NextResponse.redirect(setId ? `${APP}/master-sets/${setId}?desbloqueado=1` : `${APP}/master-sets`)
    }

    // Lojista
    if (plano.startsWith('lojista_')) {
      const lojaId = session.metadata?.lojaId
      const tier = plano.startsWith('lojista_premium_') ? 'premium' : 'pro'
      if (lojaId) {
        return NextResponse.redirect(`${APP}/minha-loja/${lojaId}?plano_ativado=${tier}`)
      }
      return NextResponse.redirect(`${APP}/minha-loja`)
    }

    // Pro usuario
    const planoFinal = plano === 'pro_anual' ? 'anual' : 'mensal'
    return NextResponse.redirect(`${APP}/pro-ativado?plano=${planoFinal}`)

  } catch (err: any) {
    console.error('[stripe/success] CRITICAL:', err.message)
    return NextResponse.redirect(`${APP}/minha-conta`)
  }
}
