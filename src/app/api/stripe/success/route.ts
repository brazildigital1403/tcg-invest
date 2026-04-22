import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.redirect(`${APP}/minha-conta`)

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-03-31.basil' })
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return NextResponse.redirect(`${APP}/minha-conta`)
    }

    const plano = session.metadata?.plano || ''

    // Créditos de scan → Minha Coleção
    if (plano.startsWith('scan_')) {
      const creditos = session.metadata?.creditos || '0'
      return NextResponse.redirect(`${APP}/minha-colecao?scan_creditos=${creditos}`)
    }

    // Separadores → Página de separadores
    if (plano === 'separadores') {
      return NextResponse.redirect(`${APP}/separadores?desbloqueado=1`)
    }

    // Pro → Página de celebração
    // O webhook já faz a atualização no banco de dados
    const planoFinal = plano === 'pro_anual' ? 'anual' : 'mensal'
    return NextResponse.redirect(`${APP}/pro-ativado?plano=${planoFinal}`)

  } catch (err: any) {
    console.error('[stripe/success]', err.message)
    return NextResponse.redirect(`${APP}/minha-conta`)
  }
}