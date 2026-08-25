// src/app/api/paginas-lendarias/sheet/route.ts
// Folha do fichario lendario. Bearer opcional (visitante ve a amostra gratis).
//
// O catalogo das 19 paginas vive em src/lib/paginas-lendarias.ts (codigo, nao
// tabela). Aqui a gente hidrata cada carta com imagem/preco do pokemon_cards
// (lookup por PK, 30 ids — sem risco de seq scan) e resolve o que o usuario
// pode ver:
//   liberada = pagina gratis
//            | plano com paginasLendariasLiberadas (pro_anual)
//            | compra do pacote ('*' em user_paginas_lendarias)
//            | compra avulsa da pagina
//
// A tabela user_paginas_lendarias pode NAO existir ainda (migration
// 20260815_paginas_lendarias.sql aguarda aprovacao do Du). Erro na leitura
// dela vira "nenhuma compra" de proposito — a amostra gratis e o plano anual
// continuam funcionando sem o schema novo.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PAGINAS_LENDARIAS, PL_PRECOS, PL_PACOTE, cardIdsLendarios } from '@/lib/paginas-lendarias'
import { resolvePlan } from '@/lib/plan'

export const dynamic = 'force-dynamic'

interface CartaOut {
  card_id: string
  slot: number
  heroi: boolean
  nome: string
  numero: string
  set_name: string
  image_small: string | null
  image_large: string | null
  preco: number | null
  owned: boolean
}

export async function GET(req: NextRequest) {
  try {
    // Modo de revisao de arte, SO em dev local: ?preview_artes=1 libera as
    // paginas pra conferir a arte aplicada no fichario sem entitlement.
    // Em producao o parametro e ignorado (NODE_ENV === 'production').
    const souDev = process.env.NODE_ENV === 'development'
    const previewArtes = souDev
      && req.nextUrl.searchParams.get('preview_artes') === '1'

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

    const ids = cardIdsLendarios()

    const { data: cardsRaw, error: cardsErr } = await svc
      .from('pokemon_cards')
      .select('id, name, number, set_name, image_small, image_large, preco_min, preco_foil_min, preco_promo_min')
      .in('id', ids)
    if (cardsErr) {
      console.error('[paginas-lendarias/sheet] cards', cardsErr.message)
      return NextResponse.json({ error: 'Erro ao carregar cartas' }, { status: 500 })
    }
    const porId = new Map((cardsRaw || []).map((c: any) => [c.id, c]))

    // Colecao do usuario: quais das 30 ele ja tem
    const owned = new Set<string>()
    if (userId) {
      const { data: uc } = await svc
        .from('user_cards')
        .select('card_id')
        .eq('user_id', userId)
        .in('card_id', ids)
      for (const r of uc || []) owned.add(r.card_id)
    }

    // Plano (pro_anual libera tudo) + compras avulsas/pacote
    let planoLibera = false
    let pacote = false
    const compradas = new Set<string>()
    if (userId) {
      const { data: uRow } = await svc
        .from('users')
        .select('is_pro, plano, pro_expira_em, trial_expires_at')
        .eq('id', userId)
        .limit(1)
      planoLibera = resolvePlan(uRow?.[0]).caps.paginasLendariasLiberadas

      // Tabela pode nao existir ainda — falha aqui NAO derruba a rota nem vira
      // cache podre (rota force-dynamic, sem unstable_cache): so significa
      // "sem compras registradas".
      const { data: upl, error: uplErr } = await svc
        .from('user_paginas_lendarias')
        .select('pagina_id')
        .eq('user_id', userId)
      if (uplErr) {
        console.warn('[paginas-lendarias/sheet] user_paginas_lendarias indisponivel (migration pendente?):', uplErr.message)
      } else {
        for (const r of upl || []) {
          if (r.pagina_id === PL_PACOTE) pacote = true
          else compradas.add(r.pagina_id)
        }
      }
    }

    const paginas = PAGINAS_LENDARIAS
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map(p => {
        const liberada = previewArtes || !!p.gratis || planoLibera || pacote || compradas.has(p.id)
        const cartas: CartaOut[] = p.cartas.map(c => {
          const row: any = porId.get(c.cardId) || null
          const preco = row
            ? Math.max(row.preco_min || 0, row.preco_foil_min || 0, row.preco_promo_min || 0) || null
            : null
          return {
            card_id: c.cardId,
            slot: c.slot,
            heroi: !!c.heroi,
            nome: row?.name || c.cardId,
            numero: row?.number || '',
            set_name: row?.set_name || '',
            image_small: row?.image_small || null,
            image_large: row?.image_large || null,
            preco,
            owned: owned.has(c.cardId),
          }
        })
        return {
          id: p.id,
          nome: p.nome,
          sub: p.sub,
          ordem: p.ordem,
          gratis: !!p.gratis,
          // `tema` e o BRIEFING DE GERACAO da arte (o prompt), nao copy de
          // produto — ja vazou pra UI e pro email de compra. So sai em dev,
          // porque scripts/gerar-artes-lendarias.mjs le o catalogo por aqui.
          ...(souDev ? { tema: p.tema } : {}),
          arte_url: p.arteUrl || null,
          liberada,
          cartas,
        }
      })

    return NextResponse.json({
      paginas,
      pacote: pacote || planoLibera,
      via_anual: planoLibera,
      preco_avulsa: PL_PRECOS.avulsa,
      preco_pacote: PL_PRECOS.pacote,
      logado: !!userId,
    })
  } catch (err: any) {
    console.error('[paginas-lendarias/sheet] CRITICAL:', err.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
