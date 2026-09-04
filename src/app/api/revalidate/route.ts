import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { MAX_SLUGS, separarSlugs } from '@/lib/revalidateSlugs'

/**
 * POST /api/revalidate
 * Auth: header `Authorization: Bearer ${CRON_SECRET}`
 * body: { slugs: string[] }  ->  invalida /carta/{slug} de cada um
 *
 * Fura o ISR de 24h da pagina publica de carta quando o preco muda. Ate hoje
 * (04/09/2026) esta rota era so uma PROMESSA: o comentario em
 * `src/app/carta/[id]/page.tsx` dizia "on-demand revalidate via
 * /api/revalidate quando scan atualiza preco" e a rota nunca existiu. Na
 * pratica o preco que o scan atualiza podia ficar 24h velho justamente na
 * pagina que o Google indexa com o preco no snippet.
 *
 * ★ POR QUE ELA MONTA O CAMINHO EM VEZ DE ACEITAR UM `path` PRONTO.
 * Esta e a decisao de seguranca da rota, nao um detalhe de estilo. Uma rota
 * que aceitasse path livre poderia ser chamada com `/` ou com o tipo
 * `layout`, e isso invalida a arvore inteira de uma vez: as 66.897 paginas de
 * carta voltariam a ser renderizadas sob demanda, cada uma segurando lambda e
 * conexao do Postgres. E exatamente o cenario que derrubou a Bynx em
 * 29/07/2026 — rota sem cache sob varredura de crawler ate o pool estourar.
 * Aqui o unico caminho alcancavel e `/carta/{slug}`, uma pagina por vez, e o
 * slug so passa se casar com o formato que o `pkmn_slugify` produz.
 *
 * ★ E POR QUE TEM TETO POR CHAMADA. Invalidar em massa tem o mesmo efeito de
 * invalidar a arvore, so que devagar. 200 por chamada mantem o custo em
 * "algumas centenas de re-renderizacoes espalhadas no tempo", que e o volume
 * de um dia de varredura (teto de 700 req/dia).
 *
 * NAO invalida nada de anuncio ainda: em 04/09 a pagina de carta nao le
 * `marketplace`. Quando o bloco de ofertas entrar, quem muta anuncio no
 * servidor chama `revalidatePath` direto — nao precisa passar por aqui, que e
 * a porta pra quem esta FORA da aplicacao (o scan roda em outra maquina).
 */

// Sem cache proprio: a rota existe justamente pra mexer no cache dos outros.
export const dynamic = 'force-dynamic'

// A rota nao faz IO: so marca entradas como velhas. Se passar disso, e falha.
export const maxDuration = 10

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const brutos: unknown[] = Array.isArray(body?.slugs) ? body.slugs : []
  if (brutos.length === 0) {
    return NextResponse.json({ error: 'Mande { slugs: [...] }.' }, { status: 400 })
  }
  if (brutos.length > MAX_SLUGS) {
    return NextResponse.json(
      { error: `Maximo ${MAX_SLUGS} slugs por chamada (recebi ${brutos.length}).` },
      { status: 413 },
    )
  }

  const { validos, rejeitados } = separarSlugs(brutos)

  // Slug fora do formato e sinal de chamador quebrado, nao de carta que sumiu:
  // responder 400 faz o erro aparecer no scan em vez de virar invalidacao
  // silenciosamente incompleta.
  if (rejeitados.length > 0) {
    return NextResponse.json(
      { error: 'Slug em formato invalido.', rejeitados: rejeitados.slice(0, 10) },
      { status: 400 },
    )
  }

  const unicos = [...new Set(validos)]
  for (const slug of unicos) {
    revalidatePath(`/carta/${slug}`)
  }

  console.log(`[revalidate] ${unicos.length} carta(s) invalidada(s)`)
  return NextResponse.json({ ok: true, invalidadas: unicos.length })
}
