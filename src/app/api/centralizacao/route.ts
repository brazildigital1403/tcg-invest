// /api/centralizacao -- previa de centralizacao do usuario logado.
//
// GET  ?acao=status               limite do dia (24 h corridas) e quando libera
// GET  ?acao=candidatos&numero=   cartas do catalogo com aquele numero impresso
// GET  ?acao=carta&id=            uma carta (quando a previa vem da Colecao)
// POST { acao: 'medir', ... }     grava UMA medicao (sem foto)
// POST { acao: 'imagem', ... }    resposta de "a imagem do catalogo e a da sua carta?"
//
// ★ O limite mora aqui, nao na tela: 20 medicoes por 24 h corridas no Gratis e
//   no Plus, ilimitado no Pro (resolvePlan + caps.centralizacaoDia). Quem
//   chega no limite ve quando libera: 24 h depois da medicao mais antiga da
//   janela.
// ★ A tabela centralizacao_previas e fechada (so service_role). Nada aqui le a
//   pokemon_cards_all em varredura: candidatos usam o indice de number_norm +
//   set_total (12 buffers medidos em 12/10/2026), e a carta e conferida pela PK.
// ★ "Nenhuma destas" e "a imagem nao bate" caem na fila de cartas do admin
//   (card_requests, origem 'previa'). Nada da comunidade muda o catalogo sozinho.

import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { resolvePlan } from '@/lib/plan'
import { ALGORITMO_PREVIA, faixaDe, lerNumeroImpresso } from '@/lib/centralizacao/previa'

export const dynamic = 'force-dynamic'

const DIA_MS = 24 * 60 * 60 * 1000
/** Precos em reais por variante, no formato que o CardItem le (CardPrice). */
const COLUNAS_PRECO = ['normal', 'foil', 'promo', 'reverse', 'pokeball']
  .flatMap(v => (v === 'normal' ? ['preco_normal', 'preco_min', 'preco_medio', 'preco_max'] : [`preco_${v}`, `preco_${v}_min`, `preco_${v}_medio`, `preco_${v}_max`]))
  .join(', ')
/** Pergunta da imagem: no maximo 3 por 24 h por pessoa. */
const PERGUNTAS_DIA = 3

const erro = (status: number, msg: string, extra?: Record<string, unknown>) =>
  NextResponse.json({ error: msg, ...extra }, { status })

type Db = NonNullable<ReturnType<typeof getServiceSupabase>>

async function usuario(req: NextRequest, db: Db) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data } = await db.auth.getUser(token)
  return data?.user ?? null
}

/** Limite do plano e uso nas ultimas 24 h. */
async function situacao(db: Db, userId: string) {
  const { data: u } = await db.from('users').select('is_pro, plano, pro_expira_em, trial_expires_at').eq('id', userId).limit(1)
  const limite = resolvePlan(u?.[0]).caps.centralizacaoDia
  const desde = new Date(Date.now() - DIA_MS).toISOString()
  const { data: janela, error } = await db.from('centralizacao_previas')
    .select('created_at, imagem_ok')
    .eq('user_id', userId).gte('created_at', desde)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  const usadas = janela?.length ?? 0
  const ilimitado = !Number.isFinite(limite)
  // Bloqueado: libera 24 h depois da medicao que ocupa a vaga mais antiga.
  const bloqueado = !ilimitado && usadas >= limite
  const liberaEm = bloqueado && janela?.length
    ? new Date(new Date(janela[usadas - limite].created_at).getTime() + DIA_MS).toISOString()
    : null
  const perguntas = (janela || []).filter(r => r.imagem_ok !== null).length
  return {
    limite: ilimitado ? null : limite,
    usadas,
    restantes: ilimitado ? null : Math.max(0, limite - usadas),
    bloqueado,
    liberaEm,
    perguntar: perguntas < PERGUNTAS_DIA,
  }
}

export async function GET(req: NextRequest) {
  const db = getServiceSupabase()
  if (!db) return erro(500, 'Configuração ausente')
  const user = await usuario(req, db)
  if (!user) return erro(401, 'Entre na sua conta.')
  const acao = req.nextUrl.searchParams.get('acao')

  try {
    if (acao === 'status') return NextResponse.json(await situacao(db, user.id))

    // Carta vinda da Colecao (o navegador nao le o catalogo direto).
    if (acao === 'carta') {
      const id = (req.nextUrl.searchParams.get('id') || '').slice(0, 200)
      if (!id) return erro(400, 'Carta inválida')
      const { data, error } = await db.from('pokemon_cards')
        .select('id, name, name_pt, number, set_name, set_total, idioma, image_small')
        .eq('id', id).limit(1)
      if (error) throw new Error(error.message)
      if (!data?.[0]) return erro(404, 'Carta não encontrada no catálogo.')
      return NextResponse.json({ carta: data[0] })
    }

    if (acao === 'candidatos') {
      const num = lerNumeroImpresso(req.nextUrl.searchParams.get('numero') || '')
      if (!num) return erro(400, 'Digite o número como está na carta, por exemplo 025/198.')
      // Preco em reais vem da mesma linha (o CardItem mostra o menor preco da
      // variante): nenhuma consulta a mais, so colunas a mais no mesmo indice.
      const { data, error } = await db.from('pokemon_cards')
        .select(`id, name, name_pt, number, set_name, set_total, idioma, image_small, ${COLUNAS_PRECO}`)
        .eq('number_norm', num.norm).eq('set_total', num.total)
        .limit(40)
      if (error) throw new Error(error.message)
      return NextResponse.json({ numero: num.texto, cartas: data || [] })
    }

    return erro(400, 'Ação desconhecida')
  } catch (e) {
    console.error('[centralizacao GET]', e instanceof Error ? e.message : e)
    return erro(500, 'Não foi possível consultar agora.')
  }
}

const num = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null

export async function POST(req: NextRequest) {
  const db = getServiceSupabase()
  if (!db) return erro(500, 'Configuração ausente')
  const user = await usuario(req, db)
  if (!user) return erro(401, 'Entre na sua conta.')
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return erro(400, 'Dados inválidos')

  try {
    // ── medicao ──
    if (body.acao === 'medir') {
      const sit = await situacao(db, user.id)
      if (sit.bloqueado) return erro(429, 'Você chegou ao limite de medições de hoje.', { liberaEm: sit.liberaEm })

      const origem = body.origem === 'colecao' ? 'colecao' : 'avulso'
      const escolha = body.escolha === 'nenhuma' ? 'nenhuma' : 'carta'
      const lr = num(body.lr, 50, 100), tb = num(body.tb, 50, 100)
      if (lr == null || tb == null) return erro(400, 'Medição inválida')
      const confianca = num(body.confianca, 0, 1)
      const candidatosN = num(body.candidatos_n, 0, 500)
      const numeroDigitado = typeof body.numero_digitado === 'string' ? body.numero_digitado.trim().slice(0, 40) || null : null

      let cardId: string | null = null
      if (escolha === 'carta') {
        cardId = typeof body.card_id === 'string' ? body.card_id.slice(0, 200) : null
        if (!cardId) return erro(400, 'Escolha a carta.')
        const { data: c } = await db.from('pokemon_cards').select('id').eq('id', cardId).limit(1)
        if (!c?.[0]) return erro(400, 'Carta não encontrada no catálogo.')
      }

      const pior = Math.max(lr, tb)
      const { data: ins, error } = await db.from('centralizacao_previas').insert({
        user_id: user.id, card_id: cardId, origem, escolha,
        numero_digitado: numeroDigitado, candidatos_n: candidatosN,
        lr: Math.round(lr * 10) / 10, tb: Math.round(tb * 10) / 10, pior: Math.round(pior * 10) / 10,
        faixa: faixaDe(pior), confianca: confianca == null ? null : Math.round(confianca * 100) / 100,
        ajustou_cantos: body.ajustou_cantos === true, algoritmo: ALGORITMO_PREVIA,
      }).select('id').single()
      if (error || !ins) throw new Error(error?.message || 'insert')

      // "Nenhuma destas": carta faltando, com o numero ja estruturado.
      if (escolha === 'nenhuma') {
        const { error: e2 } = await db.from('card_requests').insert({
          tipo: 'faltando', numero: numeroDigitado, termo_busca: numeroDigitado,
          origem: 'previa', previa_id: ins.id, user_id: user.id,
          descricao: candidatosN ? `Nenhuma das ${candidatosN} cartas com esse número era a da pessoa.` : 'Nenhuma carta no catálogo com esse número.',
        })
        if (e2) console.error('[centralizacao] card_requests faltando', e2.message)
      }

      const depois = await situacao(db, user.id)
      return NextResponse.json({ ok: true, id: ins.id, situacao: depois })
    }

    // ── "a imagem do catalogo e a da sua carta?" ──
    if (body.acao === 'imagem') {
      const id = typeof body.previa_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.previa_id) ? body.previa_id : null
      if (!id || typeof body.ok !== 'boolean') return erro(400, 'Resposta inválida')
      const sit = await situacao(db, user.id)
      if (!sit.perguntar) return NextResponse.json({ ok: true, ignorada: true })
      // So a propria medicao, recente e ainda sem resposta.
      const { data, error } = await db.from('centralizacao_previas')
        .update({ imagem_ok: body.ok })
        .eq('id', id).eq('user_id', user.id).is('imagem_ok', null)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .select('id, card_id')
      if (error) throw new Error(error.message)
      const linha = data?.[0]
      if (linha && body.ok === false && linha.card_id) {
        const { error: e2 } = await db.from('card_requests').insert({
          tipo: 'erro', erro_tipo: 'imagem', card_id: linha.card_id,
          origem: 'previa', previa_id: linha.id, user_id: user.id,
          descricao: 'Na prévia de centralização, a pessoa disse que a imagem do catálogo não é a da carta dela.',
        })
        if (e2) console.error('[centralizacao] card_requests imagem', e2.message)
      }
      return NextResponse.json({ ok: true })
    }

    return erro(400, 'Ação desconhecida')
  } catch (e) {
    console.error('[centralizacao POST]', e instanceof Error ? e.message : e)
    return erro(500, 'Não foi possível gravar agora.')
  }
}
