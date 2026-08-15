// src/app/api/master-sets/[setId]/sheet/route.ts
// Folha de um master set. Bearer opcional (visitante sem conta tambem le).
//
// AMOSTRA GRATIS (decisao do Du, 14/08): bloqueado devolve as 2 PRIMEIRAS
// paginas (18 cartas) em vez de 1. Motivo: o master set converteu 3 pessoas
// em 318 usuarios, entao o paywall estava defendendo ~R$ 40 e, em troca,
// quase ninguem chegava a ver a feature. 2 paginas mostram o fichario
// funcionando de verdade; imprimir e o resto do set seguem pagos.
//
// Usa get_master_set_sheet_v2, que devolve o preco BRL por carta (a v1
// continua servindo quem so precisa da folha de impressao).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  try {
    const { setId } = await params

    let userId: string | null = null
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (token) {
      const auth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user } } = await auth.auth.getUser(token)
      userId = user?.id || null
    }

    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const { data: det, error: detErr } = await svc.rpc('get_master_set_detail', { p_set_id: setId, p_user_id: userId })
    if (detErr) {
      console.error('[master-sets/sheet] detail', detErr.message)
      return NextResponse.json({ error: 'Erro ao carregar master set' }, { status: 500 })
    }
    const detail = det?.[0]
    if (!detail) return NextResponse.json({ error: 'Master set nao encontrado' }, { status: 404 })

    const { data: cards, error: cardsErr } = await svc.rpc('get_master_set_sheet_v2', { p_set_id: setId, p_user_id: userId })
    if (cardsErr) {
      console.error('[master-sets/sheet] cards', cardsErr.message)
      return NextResponse.json({ error: 'Erro ao carregar cartas' }, { status: 500 })
    }

    const all = cards || []
    const locked = !detail.unlocked
    // 2 paginas x 9 bolsos. O front recebe detail.total_cartas separado, entao
    // sabe o tamanho real do set e mostra as paginas restantes como bloqueadas
    // -- sem isso pareceria que o set acabou na pagina 2.
    const AMOSTRA = 18
    return NextResponse.json({
      detail,
      cards: locked ? all.slice(0, AMOSTRA) : all,
      locked,
    })
  } catch (err: any) {
    console.error('[master-sets/sheet] CRITICAL:', err.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
