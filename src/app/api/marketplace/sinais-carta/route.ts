import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { criarLimitador, ipDaRequest } from '@/lib/rateLimit'

/**
 * /api/marketplace/sinais-carta — unico caminho de escrita dos sinais de
 * "carta procurada" e "carta acessada". Chama a RPC registrar_sinal_carta
 * (service_role); as 3 tabelas estao trancadas de proposito (RLS ligada,
 * zero policy) pra ninguem conseguir inflar o contador escrevendo direto
 * com a anon key, driblando o gate de humanidade e a cota.
 *
 * ★ ESTA ROTA DEPENDE DE `/api/` CONTINUAR NO DISALLOW DO src/app/robots.ts.
 * E isso que impede o renderizador do Googlebot de disparar o beacon nas
 * ~66,9k paginas de carta -- o WRS nao busca subrecurso bloqueado por
 * robots.txt. Mover este endpoint pra fora de /api/, ou afrouxar aquele
 * disallow, reabre a escrita pro crawler SEM NENHUM ALARME: o sinal so vai
 * ficando uniforme, e "mais acessada" vira "cadencia de recrawl do Google".
 *
 * Responde 204 SEMPRE (aceito ou descartado) pra um scraper nao descobrir
 * por tentativa e erro qual camada o barrou. Mas 204 e contrato com o
 * cliente, nao desculpa pra nao logar: todo descarte vai pro console com
 * amostragem, senao "a tabela esta vazia" apareceria semanas depois com a
 * hipotese errada.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIPOS = new Set(['view_pub', 'view_app', 'busca_troca', 'busca_colecao'])
const RE_CARD_ID = /^[A-Za-z0-9][A-Za-z0-9._!?-]{1,127}$/
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Fallback do helper quando crypto.randomUUID nao existe (webview antiga). */
const RE_VID_FALLBACK = /^[0-9a-f]{8,}-[0-9a-f]{2,}$/i

// Fronteira \b nos tokens genericos: /bot/i cru casa com "CUBOT", marca real
// de Android barato vendido no Brasil -- excluiria usuario legitimo calado.
const RE_UA_SUSPEITO = /\b(bot|crawler|spider|slurp|scrap)\b|googleother|inspectiontool|meta-externalagent|facebookexternalhit|bingbot|yandex|oai-searchbot|chatgpt-user|claudebot|perplexitybot|headless|phantom|puppeteer|playwright|python-requests|curl\/|wget|okhttp|node-fetch|lighthouse/i

const ORIGENS_ACEITAS = new Set([
  'https://bynx.gg',
  'https://www.bynx.gg',
  ...(process.env.NEXT_PUBLIC_SITE_URL ? [process.env.NEXT_PUBLIC_SITE_URL] : []),
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000'] : []),
])

// 20/min cobre com folga 10 aberturas de carta numa sessao humana.
const limitador = criarLimitador({ janelaMs: 60_000, max: 20 })

let contadorDescarte = 0
function logDescarte(motivo: string) {
  contadorDescarte++
  if (contadorDescarte % 20 === 1) {
    console.warn(`[api/marketplace/sinais-carta] descartado: ${motivo} (${contadorDescarte} ate agora)`)
  }
}

const vazio = () => new NextResponse(null, { status: 204 })

export async function POST(req: NextRequest) {
  // Ordem: do mais barato pro mais caro, tudo antes de tocar o Postgres.
  if (!req.headers.get('content-type')?.includes('application/json')) {
    logDescarte('content-type')
    return vazio()
  }

  const origin = req.headers.get('origin')
  if (!origin || !ORIGENS_ACEITAS.has(origin)) {
    logDescarte(`origin ${origin || 'ausente'}`)
    return vazio()
  }

  // sec-fetch-site e sinal POSITIVO OPCIONAL: se veio e nao e same-origin,
  // rejeita; se nao veio, aceita -- iOS Safari 15.x e webviews antigas nao
  // mandam, e exigir derrubaria em silencio um recorte inteiro do publico
  // mobile brasileiro.
  const sfs = req.headers.get('sec-fetch-site')
  if (sfs && sfs !== 'same-origin') {
    logDescarte(`sec-fetch-site ${sfs}`)
    return vazio()
  }

  const ua = req.headers.get('user-agent') || ''
  if (ua.length < 15) {
    logDescarte('user-agent implausivel')
    return vazio()
  }
  // UA suspeito NAO e rejeitado: entra como origem=2, que o rollup exclui do
  // ranking mas conta em n_suspeito. Sem isso, "quanto bot esta batendo?"
  // nao tem resposta possivel e a defesa vira fe em vez de engenharia.
  const uaSuspeito = RE_UA_SUSPEITO.test(ua)

  limitador.gc()
  const ip = ipDaRequest(req)
  if (ip && limitador.excedeu(ip)) {
    logDescarte('rate limit')
    return vazio()
  }

  const body = await req.json().catch(() => null)
  const tipo = body?.tipo
  const cardId = body?.cardId
  const vid = body?.vid
  const origemCliente = body?.origem

  if (!TIPOS.has(tipo)) { logDescarte('tipo'); return vazio() }
  if (typeof cardId !== 'string' || !RE_CARD_ID.test(cardId)) { logDescarte('cardId'); return vazio() }
  if (typeof vid !== 'string' || (!RE_UUID.test(vid) && !RE_VID_FALLBACK.test(vid))) { logDescarte('vid'); return vazio() }
  if (![0, 1, 3].includes(origemCliente)) { logDescarte('origem'); return vazio() }

  // O IP NAO entra no hash e NAO e gravado: sob CGNAT e no handoff wifi->4G
  // ele rotaciona no meio da navegacao, e a mesma pessoa viraria varios
  // "visitantes" -- vies sistematico a favor de quem tem rede instavel, que
  // e justamente o usuario mobile brasileiro.
  const diaBRT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const visitante = createHash('sha256').update(`${vid}:${diaBRT}`).digest('hex').slice(0, 16)

  const sb = getServiceSupabase()
  if (!sb) {
    console.error('[api/marketplace/sinais-carta] service supabase indisponivel')
    return vazio()
  }

  const { error } = await sb.rpc('registrar_sinal_carta', {
    p_tipo: tipo,
    p_card_id: cardId,
    p_visitante: visitante,
    p_origem: uaSuspeito ? 2 : origemCliente,
  })
  // Nunca devolver error.message do Postgres pro cliente.
  if (error) console.error('[api/marketplace/sinais-carta] rpc:', error.message)

  return vazio()
}
