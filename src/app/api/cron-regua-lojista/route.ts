import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  sendLojaSemCaraEmail, sendLojaSemFotoEmail, sendLojaVitrineVaziaEmail,
  sendRecebimentosParadosEmail, sendLojaPerdeuProEmail, sendLojaResumoMensalEmail,
  sendLojaReativacaoEmail,
} from '@/lib/email'

export const maxDuration = 60

/**
 * GET /api/cron-regua-lojista  — a regua de comunicacao do lojista.
 *
 * ★ POR QUE EXISTE (12/09/2026). Medido nas 10 lojas ativas: 9 sem nenhuma
 * foto, 7 com a vitrine vazia, 7 que nunca abriram os recebimentos, 8 sem um
 * unico pedido -- e TRES que nunca receberam nenhuma notificacao da Bynx, em
 * 30 a 52 dias de casa. Dos 37 emails da casa, 11 eram de loja e TODOS
 * reativos: so saiam depois de um evento. Uma loja que cadastra e para nunca
 * gera evento nenhum, entao nunca recebia nada. Quanto mais parada a loja,
 * mais calada a plataforma -- exatamente ao contrario do que deveria.
 *
 * ★ GATILHO E ESTADO, NAO CALENDARIO. O dia so decide QUANDO OLHAR; o que
 * decide o envio e o buraco que ainda existe na hora. Nao ha fila agendada:
 * quem tapou o buraco ontem nao recebe o email hoje.
 *
 * ★ UM PASSO POR LOJA POR EXECUCAO, e na ordem de gravidade. Dois buracos
 * abertos nao viram dois emails no mesmo dia.
 *
 * ★ TETO SEMANAL. No maximo um email de regua por lojista a cada 7 dias. O
 * SINO nao tem teto (e gratuito e nao incomoda), o EMAIL tem. Transacional
 * -- venda, pedido, envio, reembolso -- passa por fora dos dois e nunca e
 * suprimido: ninguem pode abrir mao do aviso de uma venda que aconteceu.
 *
 * ★ TODO EMAIL DAQUI E NURTURE (`enviarNurture`), entao respeita
 * `email_optout_nurture` e leva o descadastro. Errei isso no primeiro disparo
 * e dois emails sairam sem saida; esta rota nao repete.
 *
 * Auth: Bearer ${CRON_SECRET}. `?dry=1` mostra o que faria.
 */

const TETO_DIAS = 7
/** Idade minima da loja pra cada passo. Ver a regua no artefato de 12/09. */
const D_SEM_CARA = 2, D_SEM_FOTO = 4, D_VITRINE = 6, D_CONNECT = 8
const D_REATIVACAO = 60
/** Recebimentos parados volta a cada 30 dias: e dinheiro parado, insiste. */
const REPETE_CONNECT_DIAS = 30
const FOTOS_DO_PLANO: Record<string, number> = { pro: 5, premium: 10 }

type Loja = {
  id: string; nome: string; slug: string; owner_user_id: string
  plano: string; plano_expira_em: string | null; created_at: string; updated_at: string | null
  logo_url: string | null; descricao: string | null; fotos: string[] | null
  connect_charges_enabled: boolean | null
  instagram: string | null; facebook: string | null; tiktok: string | null
  youtube: string | null; twitter: string | null; discord: string | null
}

type Passo = {
  chave: string
  titulo: string
  mensagem: string
  link: string
  /** Manda o email; o sino e responsabilidade do motor. */
  email: (u: { email: string; name: string | null }) => Promise<unknown>
  /** Quantos dias ate poder repetir. 0 = uma vez e so. */
  repete?: number
}

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  )
}

const dias = (desde: string | null | undefined): number =>
  desde ? (Date.now() - new Date(desde).getTime()) / 86400_000 : 0

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const db = sb()
  const hoje = new Date()
  const diaDoMes = Number(
    new Intl.DateTimeFormat('pt-BR', { day: 'numeric', timeZone: 'America/Sao_Paulo' }).format(hoje),
  )

  try {
    const { data, error } = await db
      .from('lojas')
      .select('id, nome, slug, owner_user_id, plano, plano_expira_em, created_at, updated_at, logo_url, descricao, fotos, connect_charges_enabled, instagram, facebook, tiktok, youtube, twitter, discord')
      .eq('status', 'ativa')
      .neq('oculta', true)
      .limit(500)

    // ★ Falha de leitura NAO vira "nada a fazer": o cron reportaria ok todo dia
    //   enquanto a regua inteira nao acontece -- que e o estado que ele veio
    //   consertar.
    if (error) {
      console.error('[regua] leitura', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const lojas = (data || []) as Loja[]
    const planejado: Array<{ loja: Loja; passo: Passo }> = []

    for (const l of lojas) {
      const idade = dias(l.created_at)

      const [anun, prod, pedidos] = await Promise.all([
        db.from('marketplace').select('id, card_name, price', { count: 'exact' })
          .eq('user_id', l.owner_user_id).eq('status', 'disponivel').is('removido_em', null).limit(1),
        db.from('loja_produtos').select('id', { count: 'exact', head: true })
          .eq('loja_id', l.id).gt('estoque', 0).eq('ativo', true),
        db.from('pedidos').select('id', { count: 'exact', head: true }).eq('loja_id', l.id),
      ])
      if (anun.error || prod.error) {
        console.error('[regua] contagem', l.slug, anun.error?.message || prod.error?.message)
        continue
      }
      const nAnun = anun.count || 0, nProd = prod.count || 0
      const itens = nAnun + nProd
      const exemplo = anun.data?.[0] as { card_name?: string; price?: number } | undefined

      const nFotos = (l.fotos || []).filter(Boolean).length
      const redes = [l.instagram, l.facebook, l.tiktok, l.youtube, l.twitter, l.discord].filter(Boolean).length
      const semCara: string[] = []
      if (!l.logo_url) semCara.push('o logo')
      if ((l.descricao || '').trim().length < 40) semCara.push('a descrição')
      if (redes === 0) semCara.push('as redes sociais')

      const quantos = nAnun > 0 && nProd > 0 ? `${itens} itens`
        : nAnun > 0 ? `${nAnun} ${nAnun === 1 ? 'anúncio' : 'anúncios'}`
        : `${nProd} ${nProd === 1 ? 'produto' : 'produtos'}`
      const base = `/minha-loja/${l.id}`

      // ── A fila, em ordem de GRAVIDADE. O primeiro que casar leva o dia. ──
      const fila: Array<Passo | null> = [
        // Dia 1 do mes: o resumo abre na frente. E o unico que a loja QUER
        // receber, e e ele que faz os outros serem abertos.
        diaDoMes === 1 && idade >= 30 ? {
          chave: `resumo:${hoje.getUTCFullYear()}-${hoje.getUTCMonth() + 1}`,
          titulo: 'O mês da sua loja',
          mensagem: `Veja como foi o movimento da ${l.nome} no mês passado.`,
          link: `${base}/analytics`,
          repete: 0,
          email: async (u) => {
            const desde = new Date(Date.now() - 30 * 86400_000).toISOString()
            const { count } = await db.from('loja_cliques')
              .select('id', { count: 'exact', head: true }).eq('loja_id', l.id).gte('created_at', desde)
            const mes = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' })
              .format(new Date(Date.now() - 15 * 86400_000))
            return sendLojaResumoMensalEmail({
              to: u.email, nome: u.name || '', loja: l.nome, lojaId: l.id, mes,
              cliques: count || 0, itens, pedidos: pedidos.count || 0, premium: l.plano === 'premium',
            })
          },
        } : null,

        // 1. Dinheiro parado: tem item no ar e nao consegue receber.
        itens > 0 && !l.connect_charges_enabled && idade >= D_CONNECT ? {
          chave: `connect:${l.id}`,
          titulo: 'Ninguém consegue comprar de você',
          mensagem: `A ${l.nome} tem ${quantos} à venda, mas sem o botão de comprar: os recebimentos nunca foram ativados.`,
          link: `${base}/pagamentos`,
          repete: REPETE_CONNECT_DIAS,
          email: (u) => sendRecebimentosParadosEmail({
            to: u.email, nome: u.name || '', loja: l.nome, lojaId: l.id, quantos, total: itens,
            exemplo: exemplo?.card_name || null,
            exemploPreco: typeof exemplo?.price === 'number'
              ? `R$ ${exemplo.price.toFixed(2).replace('.', ',')}` : null,
          }),
        } : null,

        // 2. Vitrine vazia: sem item nenhum outro passo importa.
        itens === 0 && idade >= D_VITRINE ? {
          chave: `vitrine:${l.id}`,
          titulo: 'A sua vitrine está vazia',
          mensagem: `A ${l.nome} está no Guia de Lojas, mas não tem nada à venda.`,
          link: `${base}/produtos`,
          repete: 0,
          email: (u) => sendLojaVitrineVaziaEmail({ to: u.email, nome: u.name || '', loja: l.nome, lojaId: l.id }),
        } : null,

        // 3. Sem cara: o mais barato de resolver, muda a pagina na hora.
        semCara.length > 0 && idade >= D_SEM_CARA ? {
          chave: `semcara:${l.id}`,
          titulo: 'A sua página está sem cara',
          mensagem: `Falta ${semCara.join(', ')} na ${l.nome}.`,
          link: `${base}/vitrine`,
          repete: 0,
          email: (u) => sendLojaSemCaraEmail({
            to: u.email, nome: u.name || '', loja: l.nome, lojaId: l.id, falta: semCara,
            logoUrl: l.logo_url, temDescricao: (l.descricao || '').trim().length >= 40,
          }),
        } : null,

        // 4. Paga por foto e nao usa nenhuma.
        nFotos === 0 && FOTOS_DO_PLANO[l.plano] && idade >= D_SEM_FOTO ? {
          chave: `semfoto:${l.id}`,
          titulo: `Você tem ${FOTOS_DO_PLANO[l.plano]} fotos sobrando`,
          mensagem: `O plano da ${l.nome} libera ${FOTOS_DO_PLANO[l.plano]} fotos na página pública e nenhuma está no ar.`,
          link: `${base}/vitrine`,
          repete: 0,
          email: (u) => sendLojaSemFotoEmail({
            to: u.email, nome: u.name || '', loja: l.nome, lojaId: l.id, limite: FOTOS_DO_PLANO[l.plano],
          }),
        } : null,

        // 5. Parada de vez. Uma vez e so -- insistir com quem nao volta
        //    nao recupera ninguem e queima o dominio de quem ainda le.
        idade >= D_REATIVACAO && dias(l.updated_at) >= D_REATIVACAO && itens === 0 ? {
          chave: `reativa:${l.id}`,
          titulo: 'A sua loja está parada',
          mensagem: `Faz ${Math.round(dias(l.updated_at))} dias sem movimento na ${l.nome}.`,
          link: base,
          repete: 0,
          email: (u) => sendLojaReativacaoEmail({
            to: u.email, nome: u.name || '', loja: l.nome, lojaId: l.id, dias: Math.round(dias(l.updated_at)),
          }),
        } : null,
      ]

      const passo = fila.find(Boolean) as Passo | undefined
      if (passo) planejado.push({ loja: l, passo })
    }

    if (dry) {
      return NextResponse.json({
        ok: true, dry: true, lojas: lojas.length,
        planejado: planejado.map(x => ({ loja: x.loja.slug, passo: x.passo.chave, titulo: x.passo.titulo })),
      })
    }

    const donos = [...new Set(planejado.map(x => x.loja.owner_user_id))]
    const { data: usrs } = donos.length
      ? await db.from('users').select('id, name, email').in('id', donos)
      : { data: [] as Array<{ id: string; name: string | null; email: string | null }> }
    const pessoa = new Map((usrs || []).map(u => [u.id, u]))

    let sinos = 0, emails = 0, pulados = 0
    for (const { loja: l, passo } of planejado) {
      // ── dedup do passo ──────────────────────────────────────────────────
      const { data: antes } = await db
        .from('notifications')
        .select('created_at')
        .eq('user_id', l.owner_user_id)
        .eq('data->>regua', passo.chave)
        .order('created_at', { ascending: false })
        .limit(1)
      const ultimo = antes?.[0]?.created_at as string | undefined
      if (ultimo) {
        const esperou = dias(ultimo)
        if (!passo.repete || esperou < passo.repete) { pulados++; continue }
      }

      // ★ Insert direto em vez de `notify`: preciso do id de volta pra, se o
      //   email sair, MARCAR ESTA MESMA linha. A primeira versao criava uma
      //   notificacao separada "Email enviado" so pra contar o teto -- que
      //   apareceria no sino do lojista como lixo. Consertado antes de subir.
      const { data: sino } = await db.from('notifications').insert({
        user_id: l.owner_user_id, type: 'aviso', read: false,
        title: passo.titulo, message: passo.mensagem,
        data: { link: passo.link, loja_id: l.id, regua: passo.chave },
      }).select('id').limit(1)
      sinos++

      // ── teto semanal, SO do email ───────────────────────────────────────
      const { data: recente } = await db
        .from('notifications')
        .select('created_at')
        .eq('user_id', l.owner_user_id)
        .not('data->>regua_email', 'is', null)
        .gte('created_at', new Date(Date.now() - TETO_DIAS * 86400_000).toISOString())
        .limit(1)
      if (recente?.length) { continue }

      const u = pessoa.get(l.owner_user_id)
      if (!u?.email) continue
      try {
        await passo.email({ email: u.email, name: u.name })
        // O teto mora na PROPRIA notificacao do passo: nada novo aparece no
        // sino, e a consulta do teto le exatamente as linhas que geraram email.
        const id = sino?.[0]?.id
        if (id) {
          await db.from('notifications').update({
            data: { link: passo.link, loja_id: l.id, regua: passo.chave, regua_email: passo.chave },
          }).eq('id', id)
        }
        emails++
      } catch (e) {
        console.error('[regua] email', l.slug, passo.chave, (e as Error)?.message)
      }
    }

    return NextResponse.json({ ok: true, lojas: lojas.length, sinos, emails, pulados })
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message || 'erro' }, { status: 500 })
  }
}
