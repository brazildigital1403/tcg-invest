import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { cotarFrete, pacoteDeCarta, pacoteDeProduto, type ItemFrete } from '@/lib/melhor-envio'
import { criarLimitador, ipDaRequest } from '@/lib/rateLimit'

/**
 * POST /api/frete/cotar
 * body: { tipo: 'marketplace' | 'produto', id, cep }
 *
 * Cota o frete por CEP pro anuncio (carta) ou produto. So faz sentido quando a
 * loja esta em frete_modo='calculado'. Read-only (sem Bearer): e so um preco
 * estimado, sem efeito colateral, e a cotacao do Melhor Envio e gratis. O
 * checkout RE-COTA no servidor na hora de fechar (nunca confia no preco do
 * cliente).
 *
 * ★ POR QUE TEM RATE LIMIT mesmo sendo read-only e gratis: cada chamada gasta
 * duas coisas que NAO sao nossas nem infinitas — a cota do token central da
 * Bynx no Melhor Envio (um IP abusando queima a cota de TODAS as lojas) e uma
 * conexao do Postgres por request (2 queries). Foi exatamente esse segundo
 * vetor que derrubou o site em 29/07: rota publica sem teto empilhando conexao
 * ate o pool estourar.
 */

// 30 cotacoes por IP por minuto. No checkout o comprador troca CEP e reconsulta
// algumas vezes; 30 cobre isso com folga e ainda barra varredura.
const limitador = criarLimitador({ janelaMs: 60_000, max: 30 })

function digits(s: string) { return String(s || '').replace(/\D/g, '') }

export async function POST(req: NextRequest) {
  try {
    const ip = ipDaRequest(req)
    if (ip) {
      limitador.gc()
      if (limitador.excedeu(ip)) {
        return NextResponse.json(
          { error: 'Muitas consultas de frete. Aguarde alguns segundos.' },
          { status: 429 }
        )
      }
    }

    const sb = getServiceSupabase()
    if (!sb) return NextResponse.json({ error: 'Servico indisponivel.' }, { status: 503 })

    const body = await req.json().catch(() => null)
    const tipo = body?.tipo === 'produto' ? 'produto' : 'marketplace'
    const id = body?.id
    const cep = digits(body?.cep)
    // A cotacao precisa do MESMO volume que o checkout vai cobrar, senao o
    // comprador ve um frete de 1 unidade e paga o de 3.
    const qtdRaw = Math.floor(Number(body?.quantidade))
    const qtd = Number.isFinite(qtdRaw) && qtdRaw > 0 ? Math.min(qtdRaw, 99) : 1
    if (!id) return NextResponse.json({ error: 'Anuncio invalido.' }, { status: 400 })
    if (cep.length !== 8) return NextResponse.json({ error: 'CEP invalido.' }, { status: 400 })

    let lojaCep: string | null = null
    let modo = 'fixo'
    let pacote: ItemFrete | null = null

    if (tipo === 'produto') {
      const { data: prods } = await sb
        .from('loja_produtos')
        .select('id, loja_id, preco_cents, peso_g, tipo')
        .eq('id', id)
        .limit(1)
      const prod = prods?.[0]
      if (!prod) return NextResponse.json({ error: 'Produto nao encontrado.' }, { status: 404 })

      const { data: ljs } = await sb.from('lojas').select('cep, frete_modo').eq('id', prod.loja_id).limit(1)
      const loja = ljs?.[0]
      lojaCep = loja?.cep ?? null
      modo = loja?.frete_modo ?? 'fixo'
      pacote = pacoteDeProduto(prod.peso_g, prod.tipo, prod.preco_cents, qtd)
    } else {
      const { data: ans } = await sb
        .from('marketplace')
        .select('id, user_id, price')
        .eq('id', id)
        .limit(1)
      const an = ans?.[0]
      if (!an) return NextResponse.json({ error: 'Anuncio nao encontrado.' }, { status: 404 })

      const { data: ljs } = await sb
        .from('lojas')
        .select('cep, frete_modo')
        .eq('owner_user_id', an.user_id)
        .eq('status', 'ativa')
        .limit(1)
      const loja = ljs?.[0]
      lojaCep = loja?.cep ?? null
      modo = loja?.frete_modo ?? 'fixo'
      pacote = pacoteDeCarta(Math.round(Number(an.price) * 100))
    }

    if (modo !== 'calculado') {
      return NextResponse.json({ error: 'Essa loja usa frete fixo.' }, { status: 409 })
    }
    if (!lojaCep || digits(lojaCep).length !== 8) {
      return NextResponse.json({ error: 'A loja ainda nao configurou o CEP de origem.' }, { status: 409 })
    }

    const opcoes = await cotarFrete(lojaCep, cep, [pacote])
    if (opcoes.length === 0) {
      return NextResponse.json({ error: 'Nenhuma opcao de frete pra esse CEP.' }, { status: 422 })
    }
    return NextResponse.json({ opcoes })
  } catch (err) {
    console.error('[frete cotar] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Nao consegui calcular o frete agora.' }, { status: 502 })
  }
}
