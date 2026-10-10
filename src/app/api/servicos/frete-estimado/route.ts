// POST /api/servicos/frete-estimado -- previsao do frete de volta no formulario.
//
// So para quem esta logado: o destino e o CEP do cadastro, lido aqui no
// servidor (nunca vem do navegador). Cota o envelope A4 da volta e devolve a
// opcao mais barata (no expresso, so SEDEX), separando frete e valor declarado.
// Nao grava nada. O valor final continua sendo o do orcamento.

import { NextRequest, NextResponse } from 'next/server'
import { criarLimitador, ipDaRequest } from '@/lib/rateLimit'
import { SERVICOS, EXPRESSO_SERVICOS, MAX_CARTAS_POR_SOLICITACAO, type ServicoId } from '@/lib/servicos'
import { sbAdmin, usuarioDoToken, erro, cotarVoltaServico } from '@/lib/servicosServer'

export const dynamic = 'force-dynamic'

const limitador = criarLimitador({ janelaMs: 10 * 60_000, max: 20 })

export async function POST(req: NextRequest) {
  const ip = ipDaRequest(req)
  if (ip && limitador.excedeu(ip)) return erro(429, 'Muitas tentativas. Aguarde alguns minutos.')
  const user = await usuarioDoToken(req)
  if (!user) return erro(401, 'Entre na sua conta para estimar o frete.')

  const body = await req.json().catch(() => null)
  const servico = String(body?.servico || '') as ServicoId
  if (!SERVICOS.some(s => s.id === servico)) return erro(400, 'Serviço inválido')
  const cartas = Math.min(MAX_CARTAS_POR_SOLICITACAO, Math.max(1, Math.floor(Number(body?.cartas)) || 1))
  const valor = Math.max(0, Math.round(Number(body?.valor_declarado_cents) || 0))
  const expresso = body?.prazo === 'expresso' && EXPRESSO_SERVICOS.includes(servico)

  const { data: us } = await sbAdmin().from('users').select('cep').eq('id', user.id).limit(1)
  const cep = String(us?.[0]?.cep || '').replace(/\D/g, '')
  if (cep.length !== 8) return NextResponse.json({ sem_cep: true }, { headers: { 'Cache-Control': 'no-store' } })

  try {
    const [o] = await cotarVoltaServico({ servico, cartas, valorDeclaradoCents: valor, expresso, cepDestino: cep })
    if (!o) return NextResponse.json({ sem_opcao: true }, { headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.json({
      frete_cents: o.freteCents, valor_declarado_cents: o.valorDeclaradoCents, servico_frete: `${o.empresa} ${o.nome}`.trim(), prazo_dias: o.prazoDias,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[servicos/frete-estimado]', e instanceof Error ? e.message : e)
    return erro(502, 'Não foi possível estimar o frete agora.')
  }
}
