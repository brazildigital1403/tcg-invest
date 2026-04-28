import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'

// POST /api/admin/pokedex/invalidate
//
// Invalida o cache da Pokédex em TODAS as instâncias serverless do Vercel.
// Próxima request a /api/pokedex e /api/pokedex/species vai re-executar a
// query no Supabase e popular o cache de novo.
//
// Quando chamar:
//   - Após rodar scan-sets / scan-cid (novos cards entram no DB)
//   - Após editar manualmente cartas no admin (raro)
//   - Em caso de bug visual relatado por usuário ("ta faltando carta X")

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  try {
    revalidateTag('pokedex')
    return NextResponse.json({
      ok: true,
      message: 'Cache da Pokédex invalidado. Próxima request vai re-popular.',
    })
  } catch (err: any) {
    console.error('[admin/pokedex/invalidate]', err.message)
    return NextResponse.json({ error: 'Erro ao invalidar cache' }, { status: 500 })
  }
}
