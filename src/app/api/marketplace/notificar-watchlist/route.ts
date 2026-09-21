import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { notify } from '@/lib/notify'

/**
 * POST /api/marketplace/notificar-watchlist
 *
 * Watchlist Fase 2: dispara logo depois de um anuncio novo ser criado no
 * Marketplace, avisando quem tem aquela carta na watchlist -- nao so quem
 * acompanha variacao de preco (isso o cron-notificacoes ja faz). Chamado
 * pelo client (AnunciarModal) fire-and-forget depois do insert em
 * `marketplace` dar certo; falha aqui nunca deve travar o fluxo de anunciar.
 *
 * Le o anuncio pelo ID em vez de confiar em card_id vindo do client -- so
 * notifica quem acompanha uma carta de um anuncio que realmente existe e
 * pertence a quem chamou.
 */
export async function POST(req: NextRequest) {
  try {
    const sb = getServiceSupabase()
    if (!sb) return NextResponse.json({ error: 'Servico indisponivel.' }, { status: 503 })

    const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!bearer) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    const { data: authData, error: authErr } = await sb.auth.getUser(bearer)
    if (authErr || !authData?.user) return NextResponse.json({ error: 'Token invalido.' }, { status: 401 })
    const vendedorId = authData.user.id

    const body = await req.json().catch(() => null)
    const anuncioId = body?.anuncio_id
    if (!anuncioId) return NextResponse.json({ error: 'anuncio_id obrigatorio.' }, { status: 400 })

    const { data: anuncio } = await sb
      .from('marketplace')
      .select('id, slug, user_id, card_id, card_name, price, status, idioma')
      .eq('id', anuncioId)
      .maybeSingle()

    if (!anuncio || anuncio.user_id !== vendedorId || anuncio.status !== 'disponivel' || !anuncio.card_id) {
      return NextResponse.json({ notificados: 0 })
    }

    const { data: watchersTodos } = await sb
      .from('watchlist')
      .select('user_id, target_price')
      .eq('card_id', anuncio.card_id)
      .neq('user_id', vendedorId)

    // ★ TETO DE PRECO (21/09/2026, Radar das Metas #368). `target_price`
    // existia na tabela e nenhum codigo lia. Agora: com teto, so avisa se o
    // anuncio sai por ate aquele valor.
    const preco = Number(anuncio.price) || 0
    const tetoDe = new Map((watchersTodos || []).map(w => [w.user_id, w.target_price == null ? null : Number(w.target_price)]))
    const watchers = (watchersTodos || []).filter(w => w.target_price == null || preco <= Number(w.target_price))

    const cleanNome = (raw: string) =>
      (raw || '')
        .replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
        .replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()
    const nome = cleanNome(anuncio.card_name || '')
    const fmtBRL = (v: number) => Number(v || 0).toFixed(2).replace('.', ',')

    let notificados = 0
    for (const w of watchers) {
      const { data: existing } = await sb
        .from('notifications')
        .select('id')
        .eq('user_id', w.user_id)
        .eq('type', 'watch_listada')
        .eq('data->>anuncio_id', anuncioId)
        .limit(1)
      if (existing && existing.length > 0) continue

      const ok = await notify(
        w.user_id,
        'watch_listada',
        `${nome} apareceu no Marketplace`,
        `Por R$ ${fmtBRL(anuncio.price)} — uma carta que você acompanha.`,
        // `link` e o que o sino usa para navegar (AppLayout.abrirNotif). Sem
        // ele o aviso abria e nao levava a lugar nenhum (corrigido 21/09).
        { anuncio_id: anuncioId, card_id: anuncio.card_id, price: anuncio.price, link: `/anuncio/${anuncio.slug || anuncioId}` }
      )
      if (ok) notificados++
    }

    // ── Radar das Metas (#368, passo 5) ──────────────────────────────────
    // Quem tem uma meta que inclui esta carta e AINDA NAO a tem tambem e
    // avisado. Metas sao poucas linhas; o cruzamento e feito aqui, sem varrer
    // o catalogo: uma leitura da carta pelo id e duas da tabela de metas.
    notificados += await avisarMetas(sb, anuncio, vendedorId, nome, fmtBRL, new Set(watchersTodos?.map(w => w.user_id) || []), tetoDe)

    return NextResponse.json({ notificados })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

type Sb = NonNullable<ReturnType<typeof getServiceSupabase>>

async function avisarMetas(
  sb: Sb,
  anuncio: { id: string; slug: string | null; card_id: string; price: number; idioma?: string | null },
  vendedorId: string,
  nome: string,
  fmtBRL: (v: number) => string,
  jaTratados: Set<string>,
  tetoDe: Map<string, number | null>,
): Promise<number> {
  const { data: carta } = await sb
    .from('pokemon_cards')
    .select('set_id, base_pokemon_names, regiao')
    .eq('id', anuncio.card_id)
    .maybeSingle()
  if (!carta) return 0

  const nomes: string[] = Array.isArray(carta.base_pokemon_names) ? carta.base_pokemon_names : []
  const [porSet, porPokemon] = await Promise.all([
    carta.set_id
      ? sb.from('metas_colecao').select('id, user_id, tipo, alvo, regiao, idioma').eq('tipo', 'set').eq('alvo', carta.set_id).is('concluida_em', null)
      : Promise.resolve({ data: [] as any[] }),
    nomes.length
      ? sb.from('metas_colecao').select('id, user_id, tipo, alvo, regiao, idioma').eq('tipo', 'pokemon').in('alvo', nomes).is('concluida_em', null)
      : Promise.resolve({ data: [] as any[] }),
  ])
  const metas = [...(porSet.data || []), ...(porPokemon.data || [])]
    .filter(m => m.user_id !== vendedorId && !jaTratados.has(m.user_id))
    .filter(m => m.tipo === 'set' || m.regiao == null || m.regiao === carta.regiao)
  if (metas.length === 0) return 0

  // Quem ja tem a carta nao e avisado (respeitando o idioma da meta).
  const userIds = [...new Set(metas.map(m => m.user_id))]
  const { data: donos } = await sb
    .from('user_cards')
    .select('user_id, idioma')
    .eq('pokemon_api_id', anuncio.card_id)
    .in('user_id', userIds)
  const idiomasDe = new Map<string, Set<string>>()
  for (const d of donos || []) {
    const s = idiomasDe.get(d.user_id) || new Set<string>()
    s.add(d.idioma || 'pt'); idiomasDe.set(d.user_id, s)
  }

  const preco = Number(anuncio.price) || 0
  const avisados = new Set<string>()
  let n = 0
  for (const m of metas) {
    if (avisados.has(m.user_id)) continue
    const tem = idiomasDe.get(m.user_id)
    if (tem && (m.idioma == null || tem.has(m.idioma))) continue
    // Meta com idioma so quer a carta naquele idioma: anuncio em outro idioma
    // nao completa a meta, entao nao avisa.
    if (m.idioma && (anuncio.idioma || 'pt') !== m.idioma) continue
    const teto = tetoDe.get(m.user_id)
    if (teto != null && preco > teto) continue

    const { data: existing } = await sb
      .from('notifications')
      .select('id')
      .eq('user_id', m.user_id)
      .eq('type', 'watch_listada')
      .eq('data->>anuncio_id', anuncio.id)
      .limit(1)
    if (existing && existing.length > 0) { avisados.add(m.user_id); continue }

    const titulo = m.tipo === 'pokemon' ? `Todos os ${m.alvo}` : 'sua coleção'
    const ok = await notify(
      m.user_id,
      'watch_listada',
      `${nome} apareceu no Marketplace`,
      `Por R$ ${fmtBRL(preco)} — falta na sua meta ${m.tipo === 'pokemon' ? `"${titulo}"` : 'de coleção'}.`,
      { anuncio_id: anuncio.id, card_id: anuncio.card_id, price: preco, origem: 'meta', meta_id: m.id, link: `/anuncio/${anuncio.slug || anuncio.id}` }
    )
    avisados.add(m.user_id)
    if (ok) n++
  }
  return n
}
