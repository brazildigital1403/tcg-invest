import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/lojas
 * Cria uma nova loja para o usuário autenticado.
 *
 * Body JSON (campos whitelistados):
 *   nome, slug, descricao, tipo, especialidades, cidade, estado, endereco, cep,
 *   whatsapp, instagram, facebook, website, tiktok, youtube, twitter, discord,
 *   logo_url, banner_url, fotos, eventos,
 *   seo_title, seo_description
 *
 * Setados automaticamente pelo servidor:
 *   owner_user_id = user.id (do Bearer token)
 *   status        = 'pendente' (aguarda moderação do admin)
 *   plano         = 'pro'      (trial de 14 dias)
 *   plano_expira_em = agora + 14d  (NULL so quando o admin concede permanente)
 *   verificada    = false
 *
 * Regras:
 *   - User pode ter MÚLTIPLAS lojas (limite ilimitado)
 *   - Slug único globalmente
 *   - Slug deve casar com /^[a-z0-9]+(-[a-z0-9]+)*$/ (3-50 chars)
 *
 * Retornos:
 *   201 → { loja }
 *   400 → body inválido / slug inválido / campos obrigatórios faltando
 *   401 → sem token ou token inválido
 *   409 → slug já existe
 *   500 → erro interno
 */

// Campos permitidos no body (whitelist rigorosa)
const ALLOWED_FIELDS = new Set([
  'nome', 'slug', 'descricao', 'tipo', 'especialidades',
  'cidade', 'estado', 'endereco', 'cep',
  'whatsapp', 'instagram', 'facebook', 'website',
  'tiktok', 'youtube', 'twitter', 'discord',
  'logo_url', 'banner_url', 'fotos', 'eventos',
  'seo_title', 'seo_description',
])

const REQUIRED_FIELDS = ['nome', 'slug', 'cidade', 'estado', 'whatsapp', 'tipo', 'especialidades'] as const

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    // ─── Auth ──────────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const sb = supabaseAdmin()
    const { data: { user }, error: authErr } = await sb.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    // ─── Body ──────────────────────────────────────────────
    let body: Record<string, any>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
    }

    // ─── Filtra whitelist ──────────────────────────────────
    const filteredBody: Record<string, any> = {}
    for (const key of Object.keys(body)) {
      if (ALLOWED_FIELDS.has(key)) filteredBody[key] = body[key]
    }

    // ─── Validações ────────────────────────────────────────
    for (const field of REQUIRED_FIELDS) {
      const v = filteredBody[field]
      if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
        return NextResponse.json({ error: `Campo obrigatório faltando: ${field}` }, { status: 400 })
      }
      if (Array.isArray(v) && v.length === 0) {
        return NextResponse.json({ error: `Campo obrigatório faltando: ${field}` }, { status: 400 })
      }
    }

    // Slug
    const slug = String(filteredBody.slug).toLowerCase().trim()
    if (slug.length < 3 || slug.length > 50) {
      return NextResponse.json({ error: 'Slug deve ter entre 3 e 50 caracteres' }, { status: 400 })
    }
    if (!SLUG_REGEX.test(slug)) {
      return NextResponse.json({
        error: 'Slug deve conter apenas letras minúsculas, números e hífens (ex: loja-do-joao)',
      }, { status: 400 })
    }
    filteredBody.slug = slug

    // Tipo
    if (!['fisica', 'online', 'ambas'].includes(filteredBody.tipo)) {
      return NextResponse.json({ error: 'Tipo deve ser: fisica, online ou ambas' }, { status: 400 })
    }

    // Especialidades precisa ser array não vazio
    if (!Array.isArray(filteredBody.especialidades) || filteredBody.especialidades.length === 0) {
      return NextResponse.json({ error: 'Especialidades deve ser um array com ao menos 1 jogo' }, { status: 400 })
    }

    // ─── Verifica unicidade do slug ───────────────────────
    // OBS: User pode ter múltiplas lojas. NÃO bloqueamos por owner_user_id.
    const { data: slugCheck } = await sb
      .from('lojas')
      .select('id')
      .eq('slug', slug)
      .limit(1)

    if (slugCheck && slugCheck.length > 0) {
      return NextResponse.json({
        error: 'Esse slug já está em uso. Tente outro.',
      }, { status: 409 })
    }

    // ─── Insert ────────────────────────────────────────────
    const payload = {
      ...filteredBody,
      owner_user_id: user.id,
      status: 'pendente',
      plano: 'pro',
      // ★ A DATA DE FIM DO TRIAL PASSOU A SER GRAVADA (12/09/2026). O comentario
      //   aqui dizia "trial Pro 14 dias" e a loja nascia Pro SEM nenhuma data:
      //   nada, em lugar nenhum, a rebaixava depois. Resultado medido antes de
      //   consertar -- 11 lojas em Pro/Premium sem assinatura, a mais antiga ha
      //   109 DIAS, e o FAQ prometendo "ao fim do trial sua loja continua no
      //   plano Basico". Prometia e nao executava.
      //
      //   ★ SEMANTICA DE `plano_expira_em`, que o admin ja usava e agora vale
      //   pro cadastro tambem:
      //     data  -> expira nela (trial)
      //     NULL  -> PERMANENTE, decisao do Du no /admin/lojas
      //   Por isso a expiracao nunca toca em NULL: plano liberado a mao fica.
      plano_expira_em: new Date(Date.now() + 14 * 24 * 3600_000).toISOString(),
      verificada: false,
    }

    const { data: inserted, error: insertErr } = await sb
      .from('lojas')
      .insert(payload)
      .select('*')
      .limit(1)

    if (insertErr) {
      console.error('[api/lojas POST] erro ao inserir', insertErr)
      return NextResponse.json({ error: 'Erro ao criar loja: ' + insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ loja: inserted?.[0] }, { status: 201 })

  } catch (err: any) {
    console.error('[api/lojas POST] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
