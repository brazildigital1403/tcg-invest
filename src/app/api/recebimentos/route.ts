import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { normalizarPrazo } from '@/lib/comissao'
import { classificarConta } from '@/lib/connect-status'

/**
 * GET   /api/recebimentos -> le a conta na Stripe e SINCRONIZA o status
 * PATCH /api/recebimentos -> troca o CEP de envio / prazo de repasse
 *
 * ★ E A MESMA COISA QUE /api/lojas/[id]/connect, para quem NAO TEM LOJA
 * (24/09/2026, Quadro #389). 70 dos 100 anuncios ativos sao de pessoa fisica:
 * 18 pessoas, R$ 27.877 parados, e nenhuma delas tinha por onde ativar
 * recebimento -- aquela rota exige um `lojaId`.
 *
 * ★ QUEM TEM LOJA CONTINUA USANDO A ROTA DA LOJA. As duas convivem porque o
 * `resolverRecebedor` ja sabe escolher: conta da loja quando ela tem uma, conta
 * do dono quando nao tem. Nada foi movido de lugar.
 *
 * Auth: Bearer do PROPRIO usuario. Nao existe versao de admin aqui -- conta
 * Connect e dado pessoal, e o admin nao precisa dela para trabalhar.
 *
 * ★ A ESCRITA E TODA DAQUI. `users` nao da GRANT UPDATE para `authenticated`,
 * entao nenhuma dessas colunas e alcancavel pelo navegador: e o que impede
 * alguem de marcar a propria conta como liberada.
 */

const SELECT = 'id, email, name, username, cep, suspended_at, stripe_connect_account_id, stripe_connect_status, connect_charges_enabled, connect_payouts_enabled, repasse_prazo'

function stripeClient(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null
  // A versao fixada e a mesma dos outros 10 arquivos de Stripe do repo. O cast
  // existe porque os TIPOS do pacote instalado estao atras dela -- sem ele,
  // este arquivo entraria como erro novo no `tsc`, junto dos que ja carregam
  // esse mesmo erro. Trocar a versao aqui divergiria do resto do Connect.
  const apiVersion = '2025-03-31.basil' as Stripe.StripeConfig['apiVersion']
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion })
}

function soDigitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
}

/** Autentica pelo Bearer e devolve a linha do proprio usuario. */
async function autenticar(req: NextRequest) {
  const db = getServiceSupabase()
  if (!db) return { error: NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 }) }

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { error: NextResponse.json({ error: 'Faça login.' }, { status: 401 }) }

  const { data: authData } = await db.auth.getUser(token)
  const uid = authData?.user?.id
  if (!uid) return { error: NextResponse.json({ error: 'Sessão expirada. Entre de novo.' }, { status: 401 }) }

  const { data: linhas } = await db.from('users').select(SELECT).eq('id', uid).limit(1)
  const user = linhas?.[0]
  if (!user) return { error: NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 }) }

  return { db, user }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await autenticar(req)
    if ('error' in auth) return auth.error
    const { db, user } = auth

    // Loja ativa do usuario: quem tem loja gerencia recebimento POR LA, e esta
    // tela so aponta o caminho em vez de abrir uma segunda conta paralela.
    const { data: lojas } = await db
      .from('lojas')
      .select('id, nome, stripe_connect_account_id')
      .eq('owner_user_id', user.id)
      .eq('status', 'ativa')
      .order('created_at', { ascending: true })
      .limit(1)
    const loja = lojas?.[0] || null

    // Quantos anuncios estao no ar esperando por isso. O numero e o argumento.
    const { count: anuncios } = await db
      .from('marketplace')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'disponivel')
      .is('removido_em', null)

    const base = {
      cep: user.cep ?? null,
      repasse_prazo: normalizarPrazo(user.repasse_prazo),
      anuncios_no_ar: anuncios || 0,
      loja: loja ? { id: loja.id, nome: loja.nome, tem_conta_propria: !!loja.stripe_connect_account_id } : null,
    }

    const accountId: string | null = user.stripe_connect_account_id || null
    if (!accountId) {
      return NextResponse.json({
        ...base,
        status: 'nao_iniciado',
        charges_enabled: false,
        payouts_enabled: false,
        pendencias: [],
      })
    }

    const stripe = stripeClient()
    if (!stripe) return NextResponse.json({ error: 'Pagamentos indisponíveis no momento.' }, { status: 500 })

    const acc = await stripe.accounts.retrieve(accountId)
    // Mesma classificacao do webhook: se divergisse, a tela diria uma coisa e o
    // banco guardaria outra.
    const c = classificarConta(acc)

    const patch: Record<string, unknown> = {
      stripe_connect_status: c.status,
      connect_charges_enabled: c.charges,
      connect_payouts_enabled: c.payouts,
      connect_requirements: c.requirements,
      updated_at: new Date().toISOString(),
    }
    if (c.status === 'ativo' && user.stripe_connect_status !== 'ativo') {
      patch.connect_onboarded_em = new Date().toISOString()
    }
    const { error: upErr } = await db.from('users').update(patch).eq('id', user.id)
    if (upErr) console.error('[recebimentos GET] falha ao sincronizar:', upErr.message)

    return NextResponse.json({
      ...base,
      status: c.status,
      charges_enabled: c.charges,
      payouts_enabled: c.payouts,
      details_submitted: c.detalhesEnviados,
      pendencias: c.pendencias,
      disabled_reason: c.disabledReason,
    })
  } catch (err) {
    console.error('[recebimentos GET] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro ao consultar a conta.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await autenticar(req)
    if ('error' in auth) return auth.error
    const { db, user } = auth

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
    }

    const temCep = 'cep' in body
    const temPrazo = 'repasse_prazo' in body
    if (!temCep && !temPrazo) {
      return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    // ── CEP de envio ─────────────────────────────────────────────────────
    // ★ NAO E DETALHE DE CADASTRO: e a ORIGEM da cotacao de frete. Quem vende
    // de casa nao tem painel de frete fixo, entao sem CEP o checkout nao fecha
    // -- por isso ele e requisito para vender, nao um campo opcional.
    if (temCep) {
      const cd = soDigitos(body.cep)
      if (cd.length !== 8) {
        return NextResponse.json({ error: 'CEP inválido. Use 8 dígitos.' }, { status: 400 })
      }
      patch.cep = cd
    }

    // ── Prazo de repasse ─────────────────────────────────────────────────
    // ORDEM IMPORTA (mesma licao da loja): o prazo define a COMISSAO (14d =
    // 4,99% / 30d = 3,99%). Gravar antes de a Stripe aceitar cobraria a taxa
    // cara entregando o prazo lento. A Stripe BR ainda impoe piso de 30 dias
    // para conta nova, entao 14 costuma voltar 409 -- com mensagem clara.
    if (temPrazo) {
      const prazo = body.repasse_prazo
      if (prazo !== 14 && prazo !== 30) {
        return NextResponse.json({ error: 'Prazo inválido. Use 14 ou 30.' }, { status: 400 })
      }
      const accountId: string | null = user.stripe_connect_account_id || null
      if (accountId) {
        const stripe = stripeClient()
        if (stripe) {
          try {
            // 'daily' porque a Stripe BR nao aceita 'weekly'.
            await stripe.accounts.update(accountId, {
              settings: { payouts: { schedule: { interval: 'daily', delay_days: prazo } } },
            })
          } catch (e) {
            const msg = (e as Error)?.message || ''
            console.warn('[recebimentos PATCH] schedule recusado:', msg)
            const ehPiso = /lower this merchant's delay|delay below/i.test(msg)
            return NextResponse.json(
              {
                error: ehPiso
                  ? `A Stripe ainda não libera repasse em ${prazo} dias para a sua conta. Com histórico de vendas, esse prazo pode cair.`
                  : 'Não foi possível alterar o prazo agora. Tente de novo mais tarde.',
                repasse_prazo: normalizarPrazo(user.repasse_prazo),
              },
              { status: 409 }
            )
          }
        }
      }
      patch.repasse_prazo = prazo
    }

    const { error: upErr } = await db.from('users').update(patch).eq('id', user.id)
    if (upErr) {
      console.error('[recebimentos PATCH] falha ao salvar:', upErr.message)
      return NextResponse.json({ error: 'Erro ao salvar.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ...patch })
  } catch (err) {
    console.error('[recebimentos PATCH] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
