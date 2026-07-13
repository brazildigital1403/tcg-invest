import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/lojas/[id]/track-click
 *
 * Registra um clique nos CTAs da página pública da loja (WhatsApp, Instagram,
 * Facebook, Website ou Maps). Usado pela feature "Analytics do Premium".
 *
 * AUTH: Pública (SEM Bearer token). Aceita cliques anônimos porque a página
 * de loja é pública.
 *
 * HARDENING (S42):
 *   - Guard de formato UUID: id malformado (probing/bot) → 404 limpo, sem tocar o banco.
 *   - user_id NUNCA vem de header do cliente (x-user-id era spoofável) → sempre null.
 *     (Atribuição confiável de logado exigiria verificar o token — fica como follow-up.)
 *   - Rate-limit por IP em memória (gate de rajada) → 429 em loop.
 *     OBS: em serverless é POR-INSTÂNCIA (não global) — é um speed-bump; a blindagem
 *     definitiva é o rate-limit de edge do Vercel Firewall (roadmap anti-scraping).
 *   - Dedup anti-inflação: o mesmo (loja_id, ip, tipo) em <=60s conta como 1 clique.
 *
 * Body JSON:
 *   { tipo: 'whatsapp' | 'instagram' | 'facebook' | 'website' | 'maps' }
 *
 * Retornos:
 *   201 → { success: true }            (clique registrado ou deduplicado)
 *   400 → body inválido / tipo inválido
 *   404 → loja não encontrada, inativa ou id malformado
 *   429 → rate-limit por IP estourado
 *   500 → erro interno (silenciado no frontend — nunca bloquear UX)
 *
 * O frontend deve chamar esse endpoint com `navigator.sendBeacon` ou
 * `fetch` com `keepalive: true` pra não bloquear a abertura do link externo.
 */

const TIPOS_VALIDOS = ['whatsapp', 'instagram', 'facebook', 'website', 'maps', 'view'] as const
type TipoClique = typeof TIPOS_VALIDOS[number]

// Formato UUID canônico — lojas.id é uuid. Id fora desse formato nem chega ao banco.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── Rate-limit em memória (gate de rajada por IP) ─────────────────────────
// S42: corta loops óbvios. Em serverless é POR-INSTÂNCIA (não global), então é
// um speed-bump; a blindagem global é o rate-limit de edge (Vercel Firewall).
const RL_WINDOW_MS = 60_000   // janela de 1 min
const RL_MAX = 30             // máx. cliques por IP por janela
const rlHits = new Map<string, { count: number; resetAt: number }>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rlHits.get(ip)
  if (!entry || now > entry.resetAt) {
    rlHits.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RL_MAX
}

// Limpeza preguiçosa pro Map não crescer infinito numa instância quente
function gcRateLimit() {
  if (rlHits.size < 5000) return
  const now = Date.now()
  for (const [k, v] of rlHits) {
    if (now > v.resetAt) rlHits.delete(k)
  }
}

// Janela de dedup: mesmo (loja_id, ip, tipo) dentro disso = clique único
const DEDUP_WINDOW_MS = 60_000

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params

    // ─── Guard de formato UUID ─────────────────────────────
    // Id malformado (probing/bot) → 404 limpo, sem erro de uuid no banco nem log.
    if (!UUID_RE.test(lojaId)) {
      return NextResponse.json({ error: 'Loja não encontrada ou inativa' }, { status: 404 })
    }

    // ─── IP (usado no rate-limit e no dedup) ───────────────
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      null

    // ─── Gate de rajada por IP ─────────────────────────────
    if (ip) {
      gcRateLimit()
      if (rateLimited(ip)) {
        return NextResponse.json(
          { error: 'Muitos cliques. Tente novamente em instantes.' },
          { status: 429 }
        )
      }
    }

    // ─── Body ──────────────────────────────────────────────
    let body: Record<string, any>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
    }

    const tipo = String(body.tipo || '').toLowerCase().trim() as TipoClique
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({
        error: `Tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}`,
      }, { status: 400 })
    }

    const sb = supabaseAdmin()

    // ─── Valida que a loja existe e está ativa ─────────────
    const { data: lojas, error: lojaErr } = await sb
      .from('lojas')
      .select('id, status')
      .eq('id', lojaId)
      .limit(1)

    if (lojaErr) {
      console.error('[api/lojas/[id]/track-click] erro ao buscar loja', lojaErr)
      return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }

    const loja = lojas?.[0]
    if (!loja || loja.status !== 'ativa') {
      return NextResponse.json({ error: 'Loja não encontrada ou inativa' }, { status: 404 })
    }

    // ─── Metadados opcionais ───────────────────────────────
    const userAgent = req.headers.get('user-agent') || null
    const referrer  = (body && Object.prototype.hasOwnProperty.call(body, 'referrer'))
      ? (typeof body.referrer === 'string' && body.referrer.trim() ? body.referrer.trim() : null)
      : (req.headers.get('referer') || null)

    // S42: NÃO lemos x-user-id (header do cliente, spoofável). user_id sempre null.
    // Atribuição confiável de logado exigiria verificar o token de auth (follow-up).

    // ─── Dedup anti-inflação: mesmo (loja, ip, tipo) em <=60s → ignora ───
    if (ip) {
      const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString()
      const { data: recent } = await sb
        .from('loja_cliques')
        .select('id')
        .eq('loja_id', lojaId)
        .eq('tipo', tipo)
        .eq('ip', ip)
        .gte('created_at', since)
        .limit(1)

      if (recent && recent.length > 0) {
        // Já contabilizado recentemente — não infla. Frontend vê sucesso.
        return NextResponse.json({ success: true, deduped: true }, { status: 201 })
      }
    }

    // ─── Insert ────────────────────────────────────────────
    const { error: insertErr } = await sb.from('loja_cliques').insert({
      loja_id: lojaId,
      tipo,
      user_id: null,   // S42: nunca confiar em header x-user-id (spoofável)
      user_agent: userAgent,
      referrer,
      ip,
    })

    if (insertErr) {
      console.error('[api/lojas/[id]/track-click] erro ao inserir', insertErr)
      return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })

  } catch (err: any) {
    console.error('[api/lojas/[id]/track-click] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
