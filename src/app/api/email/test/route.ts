import { NextRequest, NextResponse } from 'next/server'
import {
  sendWelcomeEmail,
  sendTrialExpiring5Email,
  sendTrialExpiring7Email,
  sendPurchaseConfirmationEmail,
  sendPaymentFailedEmail,
  sendDisputeAdminEmail,
  sendMasterSetUnlockedEmail,
  sendConnectAtivoEmail,
  sendConnectPendenciaEmail,
} from '@/lib/email'

// Rota de teste — dispara templates para um email especifico
// Uso: GET /api/email/test?email=seu@email.com&secret=CRON_SECRET&template=all
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const to = req.nextUrl.searchParams.get('email')
  const template = req.nextUrl.searchParams.get('template') || 'all'

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!to) {
    return NextResponse.json({ error: 'email param required' }, { status: 400 })
  }

  const nome = 'Eduardo'
  const results: Record<string, string> = {}

  try {
    if (template === 'all' || template === 'welcome') {
      await sendWelcomeEmail(to, nome)
      results.welcome = 'enviado'
    }
    if (template === 'all' || template === 'trial5') {
      await sendTrialExpiring5Email(to, nome)
      results.trial5 = 'enviado'
    }
    if (template === 'all' || template === 'trial7') {
      await sendTrialExpiring7Email(to, nome)
      results.trial7 = 'enviado'
    }
    if (template === 'all' || template === 'pro_mensal') {
      await sendPurchaseConfirmationEmail(to, nome, 'pro_mensal')
      results.pro_mensal = 'enviado'
    }
    if (template === 'all' || template === 'pro_anual') {
      await sendPurchaseConfirmationEmail(to, nome, 'pro_anual')
      results.pro_anual = 'enviado'
    }
    if (template === 'all' || template === 'separadores') {
      await sendPurchaseConfirmationEmail(to, nome, 'separadores')
      results.separadores = 'enviado'
    }
    if (template === 'all' || template === 'scan_popular') {
      await sendPurchaseConfirmationEmail(to, nome, 'scan_popular')
      results.scan_popular = 'enviado'
    }
    if (template === 'all' || template === 'payment_failed') {
      await sendPaymentFailedEmail(to, nome)
      results.payment_failed = 'enviado'
    }
    if (template === 'all' || template === 'dispute') {
      await sendDisputeAdminEmail({
        to,
        charge: 'ch_TESTE123456',
        reason: 'fraudulent',
        amount: 2990,
        currency: 'brl',
        status: 'needs_response',
        customer: 'cus_TESTE',
      })
      results.dispute = 'enviado'
    }
    if (template === 'all' || template === 'master_set') {
      await sendMasterSetUnlockedEmail(to, nome, 'Caos Ascendente', 'cri')
      results.master_set = 'enviado'
    }
    if (template === 'all' || template === 'connect_ativo') {
      await sendConnectAtivoEmail({
        to,
        nomeUser: nome,
        nomeLoja: 'Bynx',
        lojaId: 'cb58e63a-4aca-48c6-ac8e-2bbaa1165d18',
      })
      results.connect_ativo = 'enviado'
    }
    if (template === 'all' || template === 'connect_pendencia') {
      await sendConnectPendenciaEmail({
        to,
        nomeUser: nome,
        nomeLoja: 'Bynx',
        lojaId: 'cb58e63a-4aca-48c6-ac8e-2bbaa1165d18',
        qtdPendencias: 2,
      })
      results.connect_pendencia = 'enviado'
    }

    return NextResponse.json({ ok: true, to, results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, results }, { status: 500 })
  }
}
