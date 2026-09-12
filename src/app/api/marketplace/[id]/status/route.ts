import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

/**
 * POST /api/marketplace/[id]/status   body: { acao }
 *
 * O unico lugar por onde o status de um anuncio muda por acao de usuario.
 *
 * ★ POR QUE ISTO EXISTE (12/09/2026). Ate aqui, 13 pontos do BROWSER escreviam
 * `status` direto na tabela (marketplace/page.tsx, ChatDock, NegociacoesTab,
 * marketplaceInteresse). Isso criava dois problemas de raiz unica:
 *
 * 1. SEGURANCA. A policy de UPDATE tem o ramo
 *    `role = authenticated AND status = 'disponivel' AND uid <> user_id`,
 *    que existe pro "Tenho interesse" mas NAO restringe o status de DESTINO --
 *    e o WITH CHECK so exige `buyer_id = auth.uid()`. Com o grant de coluna em
 *    `status` e `buyer_id`, qualquer logado escrevia QUALQUER status em
 *    QUALQUER anuncio disponivel alheio: `cancelado` tira a carta do ar,
 *    `vendido` a torna imune a regra de 72h. Nenhuma das regras de transicao
 *    abaixo existia -- o cliente escrevia o que quisesse.
 *
 * 2. CACHE. A /carta virou ISR de 7 DIAS em 10/09 (corte de custo da Vercel) e
 *    ela exibe as ofertas do marketplace, inclusive no JSON-LD. Cliente nao
 *    chama `revalidatePath`, entao cancelar ou reservar deixava a pagina
 *    anunciando ao Google uma oferta que nao existe mais, por ate uma semana.
 *
 * Com a escrita aqui dentro, as duas se resolvem: a regra de quem-pode-o-que
 * passa a existir, e cada transicao fura o cache da carta.
 *
 * ★ O QUE ESTA ROTA NAO FAZ, de proposito:
 *  - `transferirCartaAoComprador` continua no cliente, ANTES de chamar
 *    `concluir`. A ordem "carta na colecao primeiro, so entao concluido" foi
 *    decisao deliberada -- antes o fluxo concluia mesmo tendo perdido a carta
 *    no caminho. Mover isso pra ca e outro trabalho, com risco de carta sumir
 *    da colecao de alguem.
 *  - `dispararMarco` (email + sino) segue como esta: ele JA e uma rota de
 *    servidor (/marco), chamada logo depois.
 *  - confirmacao e alerta ficam no cliente, que e onde UI mora.
 *
 * Auth: Bearer <access_token> do usuario (mesmo padrao da /marco).
 */

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  )
}

type Acao = 'reservar' | 'enviar' | 'concluir' | 'liberar' | 'cancelar'

type Anuncio = {
  id: string; user_id: string; buyer_id: string | null
  status: string; card_id: string | null; slug: string | null
}

/**
 * A maquina de estados, explicita.
 *
 * `de` e a lista de status de ORIGEM aceitos -- e ela tambem e a guarda de
 * corrida: o UPDATE leva `.in('status', de)`, entao duas abas clicando ao
 * mesmo tempo so deixam a primeira passar.
 *
 * `pode` responde "esta pessoa tem o papel certo pra esta transicao?".
 */
const REGRAS: Record<Acao, {
  de: string[]
  para: string
  pode: (a: Anuncio, uid: string) => boolean
  buyer: 'uid' | 'null' | 'mantem'
  erro: string
}> = {
  // Qualquer logado que NAO seja o dono. E o "Tenho interesse".
  reservar: {
    de: ['disponivel'], para: 'reservado', buyer: 'uid',
    pode: (a, uid) => a.user_id !== uid,
    erro: 'Voce nao pode reservar o proprio anuncio',
  },
  // So o vendedor confirma que despachou.
  enviar: {
    de: ['reservado', 'em_negociacao'], para: 'enviado', buyer: 'mantem',
    pode: (a, uid) => a.user_id === uid,
    erro: 'So o vendedor confirma o envio',
  },
  // So o comprador confirma que recebeu.
  concluir: {
    de: ['enviado'], para: 'concluido', buyer: 'mantem',
    pode: (a, uid) => a.buyer_id === uid,
    erro: 'So o comprador confirma o recebimento',
  },
  // Desistir da negociacao: os dois lados podem, e a carta volta pra vitrine.
  liberar: {
    de: ['reservado', 'em_negociacao'], para: 'disponivel', buyer: 'null',
    pode: (a, uid) => a.user_id === uid || a.buyer_id === uid,
    erro: 'So quem esta na negociacao pode cancela-la',
  },
  // Tirar o proprio anuncio do ar. So o dono.
  cancelar: {
    de: ['disponivel', 'reservado', 'em_negociacao'], para: 'cancelado', buyer: 'null',
    pode: (a, uid) => a.user_id === uid,
    erro: 'So o dono cancela o anuncio',
  },
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const acao = (body as { acao?: Acao })?.acao

    if (!acao || !(acao in REGRAS)) {
      return NextResponse.json({ error: 'acao invalida' }, { status: 400 })
    }
    const regra = REGRAS[acao]

    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const sb = supabaseAdmin()
    const { data: authData, error: authErr } = await sb.auth.getUser(token)
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: 'Token invalido' }, { status: 401 })
    }
    const uid = authData.user.id

    const { data: anuncio, error: errBusca } = await sb
      .from('marketplace')
      .select('id, user_id, buyer_id, status, card_id, slug')
      .eq('id', id)
      .is('removido_em', null)
      .maybeSingle()

    // ★ Falha de LEITURA nao pode virar 404: "nao achei" e "nao consegui
    //   perguntar" sao coisas diferentes, e o cliente trataria as duas como
    //   anuncio inexistente.
    if (errBusca) {
      console.error('[status] busca', id, errBusca.message)
      return NextResponse.json({ error: 'Falha ao ler o anuncio' }, { status: 500 })
    }
    if (!anuncio) return NextResponse.json({ error: 'Anuncio nao encontrado' }, { status: 404 })

    const a = anuncio as Anuncio

    if (!regra.pode(a, uid)) {
      return NextResponse.json({ error: regra.erro }, { status: 403 })
    }
    if (!regra.de.includes(a.status)) {
      return NextResponse.json(
        { error: `Este anuncio esta como "${a.status}" e nao aceita essa acao agora.` },
        { status: 409 },
      )
    }

    const patch: Record<string, unknown> = { status: regra.para }
    if (regra.buyer === 'uid') patch.buyer_id = uid
    if (regra.buyer === 'null') patch.buyer_id = null

    // ★ `.in('status', regra.de)` de novo aqui, e nao so na checagem acima: e o
    //   que fecha a corrida entre a leitura e a escrita. Duas abas clicando em
    //   "Tenho interesse" no mesmo segundo -- so a primeira grava.
    const { data: mexeu, error: errUp } = await sb
      .from('marketplace')
      .update(patch)
      .eq('id', id)
      .in('status', regra.de)
      .is('removido_em', null)
      .select('id, status, slug, card_id')

    if (errUp) {
      console.error('[status]', acao, id, errUp.message)
      return NextResponse.json({ error: 'Falha ao atualizar' }, { status: 500 })
    }
    if (!mexeu || mexeu.length === 0) {
      return NextResponse.json(
        { error: 'Alguem mexeu neste anuncio agora. Atualize a pagina.' },
        { status: 409 },
      )
    }

    // ── Fura o ISR da carta ─────────────────────────────────────────────────
    // A /carta e a unica superficie cacheada que mostra oferta (7 dias desde
    // 10/09); vitrine e /anuncio sao force-dynamic e se atualizam sozinhas.
    // `revalidatePath` direto, nao a rota /api/revalidate -- aquela e a porta
    // pra quem esta FORA do app. E NUNCA a arvore: invalidar tudo devolveria as
    // ~68,9 mil paginas de carta pra fila de render, que e o cenario de 29/07.
    if (a.card_id) {
      try {
        const { data: carta } = await sb
          .from('pokemon_cards').select('slug').eq('id', a.card_id).maybeSingle()
        if (carta?.slug) revalidatePath(`/carta/${carta.slug}`)
      } catch (e) {
        // Cache velho e ruim, mas nao desfaz a acao do usuario: ele ja
        // reservou/cancelou. Loga e segue.
        console.error('[status] revalidate', id, (e as Error)?.message)
      }
    }

    return NextResponse.json({ ok: true, status: regra.para })
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message || 'erro' }, { status: 500 })
  }
}
