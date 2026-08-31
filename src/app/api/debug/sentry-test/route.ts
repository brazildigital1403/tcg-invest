import { NextRequest, NextResponse } from 'next/server'

/**
 * Disparo manual de erro pra validar o Sentry ponta a ponta.
 *
 * ★ TEMPORARIA. Criada em 30/08/2026 pra provar duas coisas de uma vez:
 *   1. o alerta continua chegando depois do beforeSend (src/lib/sentryScrub.ts);
 *   2. o header Authorization NAO aparece no evento -- que e o ponto do fix.
 * Remover assim que a verificacao estiver feita.
 *
 * PROTEGIDA de proposito: rota que lanca erro e um jeito barato de inflar a
 * cota do Sentry e enterrar alerta de verdade em ruido. Exige o header
 * `x-debug-key` batendo com CRON_SECRET (segredo que ja existe no ambiente,
 * pra nao criar mais um). Sem ele, 404 -- nao 401: quem sonda a rota nao
 * aprende que ela existe.
 */

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const chave = req.headers.get('x-debug-key')
  const esperado = process.env.CRON_SECRET

  if (!esperado || chave !== esperado) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const marca = req.nextUrl.searchParams.get('marca') || 'sem-marca'

  // Erro de verdade, nao capturado: e assim que o SDK do Next reporta sozinho.
  throw new Error(
    `[TESTE BYNX] Disparo manual pra validar o Sentry apos o beforeSend (marca: ${marca}). ` +
    `Se este evento chegou COM o header Authorization visivel, o filtro falhou.`
  )
}
