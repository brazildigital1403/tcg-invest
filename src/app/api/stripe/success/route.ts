// src/app/api/stripe/success/route.ts
//
// R7-PAY Commit 1 — Refatoração 30/abril/2026
//
// Mudanças vs v1:
// - Adiciona redirect para fluxo Lojista → /minha-loja/[lojaId]?plano_ativado=...
// - Mantém comportamento existente para Scan, Separadores e Pro

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

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

    // Para Lojista: payment_status pode vir 'no_payment_required' durante trial
    // (Stripe não cobra no trial). Aceitamos paid OU no_payment_required.
    const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
    if (!paid) {
      return NextResponse.redirect(`${APP}/minha-conta`)
    }

    const plano = session.metadata?.plano || ''

    // ─── Pacote de Scan ────────────────────────────────────────────────
    if (plano.startsWith('scan_')) {
      const creditos = session.metadata?.creditos || '0'
      return NextResponse.redirect(`${APP}/minha-colecao?scan_creditos=${creditos}`)
    }

    // ─── Separadores ───────────────────────────────────────────────────
    if (plano === 'separadores') {
      return NextResponse.redirect(`${APP}/separadores?desbloqueado=1`)
    }

    // ─── Lojista ───────────────────────────────────────────────────────
    if (plano.startsWith('lojista_')) {
      const lojaId = session.metadata?.lojaId
      const tier = plano.startsWith('lojista_premium_') ? 'premium' : 'pro'
      if (lojaId) {
        return NextResponse.redirect(`${APP}/minha-loja/${lojaId}?plano_ativado=${tier}`)
      }
      return NextResponse.redirect(`${APP}/minha-loja`)
    }

    // ─── Pro usuário ───────────────────────────────────────────────────
    const planoFinal = plano === 'pro_anual' ? 'anual' : 'mensal'
    return NextResponse.redirect(`${APP}/pro-ativado?plano=${planoFinal}`)

  } catch (err: any) {
    console.error('[stripe/success] CRITICAL:', err.message)
    return NextResponse.redirect(`${APP}/minha-conta`)
  }
}
