// src/app/api/admin/parceiros/route.ts
//
// Admin — lista e criacao de parceiros do programa de cupom.
//
// POST cria (ou vincula) o cupom na Stripe ANTES de gravar no banco — ordem
// da casa com dinheiro: provedor primeiro. Se o codigo ja existe na Stripe
// (caso WESLLEY15, criado a mao no dashboard), vincula em vez de criar.

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// GET /api/admin/parceiros — lista com pendente agregado
export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  try {
    const supabase = supabaseAdmin()

    const { data: parceiros, error } = await supabase
      .from('parceiros')
      .select('id, nome, cupom_code, desconto_pct, comissao_primeira_pct, comissao_primeira_cap_cents, comissao_renovacao_pct, recorrente_meses, pix_chave, ativo, criado_em')
      .order('criado_em', { ascending: true })

    if (error) {
      console.error('[admin/parceiros] erro listando:', error.message)
      return NextResponse.json({ error: 'Erro ao listar (migration aplicada?)' }, { status: 500 })
    }

    const { data: pendentes } = await supabase
      .from('parceiro_comissoes')
      .select('parceiro_id, tipo, comissao_cents')
      .is('fechamento_id', null)

    const porParceiro: Record<string, { pendenteCents: number; vendas: number }> = {}
    for (const l of pendentes || []) {
      const agg = porParceiro[l.parceiro_id] || { pendenteCents: 0, vendas: 0 }
      agg.pendenteCents += Number(l.comissao_cents)
      if (l.tipo === 'venda') agg.vendas += 1
      porParceiro[l.parceiro_id] = agg
    }

    return NextResponse.json({
      parceiros: (parceiros || []).map(p => ({
        ...p,
        pendenteCents: porParceiro[p.id]?.pendenteCents || 0,
        vendasCiclo: porParceiro[p.id]?.vendas || 0,
      })),
    })
  } catch (err: any) {
    console.error('[admin/parceiros] unexpected:', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST /api/admin/parceiros — cria parceiro + cupom
export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe não configurado' }, { status: 503 })
    }
    const body = await req.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()
    const nome = String(body.nome || '').trim()
    const cupomCode = String(body.cupom_code || '').trim().toUpperCase()
    const descontoPct = Number(body.desconto_pct ?? 15)
    const comissaoPrimeiraPct = Number(body.comissao_primeira_pct ?? 100)
    const comissaoRenovacaoPct = Number(body.comissao_renovacao_pct ?? 20)
    const recorrenteMeses = Number(body.recorrente_meses ?? 12)
    // Teto da 1a cobranca em reais (default R$ 100 — regra da casa pro anual).
    // null explicito = sem teto (decisao consciente do admin).
    const capPrimeiraCents = body.cap_primeira_reais === null
      ? null
      : Math.round(Number(body.cap_primeira_reais ?? 100) * 100)
    const pixChave = String(body.pix_chave || '').trim() || null

    if (!email || !nome || !cupomCode) {
      return NextResponse.json({ error: 'email, nome e cupom_code são obrigatórios' }, { status: 400 })
    }
    if (!/^[A-Z0-9]{3,30}$/.test(cupomCode)) {
      return NextResponse.json({ error: 'Código do cupom: só letras e números, 3 a 30 caracteres' }, { status: 400 })
    }
    // Validacao integral ANTES de tocar a Stripe.
    if (![descontoPct, comissaoPrimeiraPct, comissaoRenovacaoPct, recorrenteMeses].every(Number.isInteger)) {
      return NextResponse.json({ error: 'Percentuais e meses devem ser números inteiros' }, { status: 400 })
    }
    if (descontoPct < 1 || descontoPct > 100) {
      return NextResponse.json({ error: 'Desconto deve estar entre 1 e 100 (a Stripe rejeita 0%)' }, { status: 400 })
    }
    if (comissaoPrimeiraPct < 0 || comissaoPrimeiraPct > 100 || comissaoRenovacaoPct < 0 || comissaoRenovacaoPct > 100) {
      return NextResponse.json({ error: 'Comissões devem estar entre 0 e 100' }, { status: 400 })
    }
    if (recorrenteMeses < 1 || recorrenteMeses > 36) {
      return NextResponse.json({ error: 'Meses de recorrência: entre 1 e 36' }, { status: 400 })
    }
    if (capPrimeiraCents !== null && (!Number.isFinite(capPrimeiraCents) || capPrimeiraCents < 100)) {
      return NextResponse.json({ error: 'Teto da 1ª cobrança: mínimo R$ 1 (ou vazio pra sem teto)' }, { status: 400 })
    }

    const supabase = supabaseAdmin()

    // Resolve a conta Bynx do parceiro — ele precisa ter conta (e vai ter:
    // a permuta do Pro Anual ja exige).
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .eq('email', email)
      .limit(1)
    if (!users?.[0]) {
      return NextResponse.json({ error: `Nenhuma conta Bynx com o email ${email}. O parceiro precisa criar a conta primeiro.` }, { status: 404 })
    }
    const userId = users[0].id

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' as Stripe.StripeConfig['apiVersion'] })

    // 1) Stripe primeiro. Codigo ja existe (criado no dashboard)? So vincula
    // com o coupon COMPATIVEL com o combinado E confirmacao explicita — sem
    // isso, um promo de campanha antiga viraria comissao de parceiro.
    let promotionCode: Stripe.PromotionCode | null = null
    const existentes = await stripe.promotionCodes.list({ code: cupomCode, limit: 1 })
    if (existentes.data[0]) {
      const existente = existentes.data[0]
      const coupon = typeof existente.coupon === 'object' ? existente.coupon : null
      const divergencias: string[] = []
      if (!existente.active) divergencias.push('o promotion code está inativo na Stripe')
      if (!coupon || coupon.percent_off == null) divergencias.push('o coupon não é percentual (amount_off?)')
      else if (Number(coupon.percent_off) !== descontoPct) divergencias.push(`desconto na Stripe é ${coupon.percent_off}%, aqui ${descontoPct}%`)
      if (coupon && coupon.duration !== 'once') divergencias.push(`duration na Stripe é '${coupon.duration}', o padrão da parceria é 'once'`)

      if (divergencias.length) {
        return NextResponse.json({
          error: `Já existe um cupom ${cupomCode} na Stripe e ele diverge do combinado: ${divergencias.join('; ')}. Resolva na Stripe ou use outro código.`,
          promoExistente: { id: existente.id, ativo: existente.active, percentOff: coupon?.percent_off ?? null, duration: coupon?.duration ?? null },
        }, { status: 409 })
      }
      if (body.confirmar_vinculo !== true) {
        return NextResponse.json({
          error: `Já existe um cupom ${cupomCode} na Stripe (compatível com o combinado). Confirme o vínculo pra usar ele.`,
          precisaConfirmar: true,
          promoExistente: { id: existente.id, ativo: existente.active, percentOff: coupon?.percent_off ?? null, duration: coupon?.duration ?? null },
        }, { status: 409 })
      }
      promotionCode = existente
    } else {
      // Cria coupon restrito aos products dos planos de usuario + promotion code.
      const priceEnvs = ['STRIPE_PRICE_MENSAL', 'STRIPE_PRICE_PLUS', 'STRIPE_PRICE_ANUAL']
      const productIds: string[] = []
      for (const env of priceEnvs) {
        const priceId = process.env[env]
        if (!priceId) continue
        try {
          const price = await stripe.prices.retrieve(priceId)
          const prod = typeof price.product === 'string' ? price.product : price.product?.id
          if (prod && !productIds.includes(prod)) productIds.push(prod)
        } catch (err: any) {
          console.warn(`[admin/parceiros] não resolvi product de ${env}: ${err?.message}`)
        }
      }
      const coupon = await stripe.coupons.create({
        percent_off: descontoPct,
        duration: 'once',
        name: `Parceria ${nome}`,
        ...(productIds.length ? { applies_to: { products: productIds } } : {}),
      })
      promotionCode = await stripe.promotionCodes.create({ coupon: coupon.id, code: cupomCode })
    }

    const couponId = typeof promotionCode.coupon === 'string' ? promotionCode.coupon : promotionCode.coupon?.id || null

    // 2) Banco depois.
    const { data: inserted, error } = await supabase
      .from('parceiros')
      .insert({
        user_id: userId,
        nome,
        cupom_code: cupomCode,
        stripe_coupon_id: couponId,
        stripe_promotion_code_id: promotionCode.id,
        desconto_pct: descontoPct,
        comissao_primeira_pct: comissaoPrimeiraPct,
        comissao_primeira_cap_cents: capPrimeiraCents,
        comissao_renovacao_pct: comissaoRenovacaoPct,
        recorrente_meses: recorrenteMeses,
        pix_chave: pixChave,
      })
      .select('id')
      .limit(1)

    if (error) {
      // Promo na Stripe sem linha no banco e inofensivo (cupom sem comissao),
      // mas o admin precisa saber pra tentar de novo.
      console.error(`[admin/parceiros] CRITICAL: promo ${promotionCode.id} criado/vinculado na Stripe mas insert falhou:`, error.message)
      const msg = error.code === '23505'
        ? 'Já existe parceiro com esse user, código ou promotion code'
        : `Insert falhou (migration aplicada?): ${error.message}`
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // Detalhes do promo pro admin conferir na tela (duration, percent_off).
    const couponObj = typeof promotionCode.coupon === 'object' ? promotionCode.coupon : null

    return NextResponse.json({
      ok: true,
      parceiroId: inserted?.[0]?.id,
      vinculadoExistente: !!existentes.data[0],
      stripe: {
        promotionCodeId: promotionCode.id,
        ativo: promotionCode.active,
        percentOff: couponObj?.percent_off ?? null,
        duration: couponObj?.duration ?? null,
      },
    })
  } catch (err: any) {
    console.error('[admin/parceiros] unexpected:', err?.message)
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 })
  }
}
