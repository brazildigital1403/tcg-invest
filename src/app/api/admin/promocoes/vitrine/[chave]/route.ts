// PUT /api/admin/promocoes/vitrine/[chave]  { titulo, subtitulo, url, ativo }
//
// Upsert do cabecalho da vitrine em ml_afiliado_links (PK = chave). No site o
// modulo SO aparece se existir link ativo para a chave ou para o 'default'.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { chaveValida, validarLink } from '@/lib/promocoes'
import { revalidarChaves, supabaseAdmin } from '@/lib/promocoesServer'

export const dynamic = 'force-dynamic'

function textoOpcional(v: unknown, max: number): string | null {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, max) : null
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ chave: string }> }) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  try {
    const { chave } = await ctx.params
    if (!chaveValida(chave)) return NextResponse.json({ error: 'Vitrine inválida' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const link = validarLink(String(body.url ?? ''))
    if (!link.ok) return NextResponse.json({ error: `Link "ver tudo": ${link.erro}` }, { status: 400 })

    const sb = supabaseAdmin()
    const linha = {
      chave,
      url: link.url,
      titulo: textoOpcional(body.titulo, 80),
      subtitulo: textoOpcional(body.subtitulo, 160),
      ativo: body.ativo !== false,
    }
    const { data, error } = await sb
      .from('ml_afiliado_links').upsert(linha, { onConflict: 'chave' })
      .select('chave, url, titulo, subtitulo, ativo').maybeSingle()
    if (error) {
      console.error('[admin/promocoes] erro no cabecalho:', error.message)
      return NextResponse.json({ error: 'Erro ao salvar o cabeçalho' }, { status: 500 })
    }

    const cache = revalidarChaves([chave])
    return NextResponse.json({ ok: true, link: data, cache })
  } catch (err) {
    console.error('[admin/promocoes] unexpected:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
