import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/lojas/[id]/upload-foto  — STUB
 *
 * Este endpoint é um STUB do Passo 7. A implementação real vem no Passo 10
 * (Upload de fotos via Supabase Storage).
 *
 * O que o stub faz:
 *   - Valida Bearer token e ownership (mesmo schema dos outros endpoints)
 *   - Retorna 501 Not Implemented com mensagem clara pro frontend
 *
 * Por que existir agora:
 *   - Manter o contrato da API estável (frontend pode chamar sem quebrar)
 *   - Sinalizar no roadmap que esse endpoint é reservado
 *   - Permitir que dashboards de erro/monitoramento já tracks essa rota
 *
 * Plano pro Passo 10:
 *   - Aceitar multipart/form-data com file field
 *   - Validar: tipo MIME (jpg/png/webp), tamanho (<5MB), limite por plano
 *     (Pro=5 fotos, Premium=10 fotos)
 *   - Upload pro bucket 'loja-fotos' do Supabase Storage
 *   - Gerar URL pública e adicionar ao array fotos[] da loja
 *   - Retornar { url, foto_id }
 */

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params

    // ─── Auth ──────────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const sb = supabaseAdmin()
    const { data: { user }, error: authErr } = await sb.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    // ─── Ownership check (mesmo se stub, validamos pra já testar o schema) ─
    const { data: lojas } = await sb
      .from('lojas')
      .select('id, owner_user_id')
      .eq('id', id)
      .limit(1)

    const loja = lojas?.[0]
    if (!loja) return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
    if (loja.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Você não é o dono desta loja' }, { status: 403 })
    }

    // ─── Stub ──────────────────────────────────────────────
    return NextResponse.json({
      error: 'Upload de fotos ainda não disponível',
      message: 'Esta funcionalidade será liberada em breve. Por enquanto, use URLs externas nas fotos da loja.',
      status: 'not_implemented',
    }, { status: 501 })

  } catch (err: any) {
    console.error('[api/lojas/[id]/upload-foto] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}