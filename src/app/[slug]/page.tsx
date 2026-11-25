// bynx.gg/<slug> -> redireciona para o destino cadastrado em links_curtos (admin).
//
// E uma PAGE, nao um route handler, de proposito: so em page o notFound()
// renderiza a 404 da Bynx (src/app/not-found.tsx). Em route handler ele devolve
// 404 vazio -- e esta rota na raiz recebe TODO caminho de um segmento que
// nenhuma pagina real atende, entao quem digita /naoexiste tem que continuar
// vendo a mesma 404 de antes.
//
// Custo por acerto: 1 leitura pela chave primaria + 1 update do contador. Bot
// varrendo /wp-admin e afins so faz a leitura; formato invalido nem chega la.

import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { SLUG_RE, SLUGS_RESERVADOS } from '@/lib/linksCurtos'

export const dynamic = 'force-dynamic'

// bynx.gg/@arroba (Meu link do Club, 25/11/2026): o @ de um membro do Club vira o link dele. Conta a
// visita (sem guardar IP nem user-agent) e leva a /?ref=CODIGO, o fluxo de indicacao que ja existe.
// Robo e user-agent vazio nao contam. O navegador interno do Instagram NAO e robo: e quem toca na bio.
const ARROBA_RE = /^@[a-z0-9._]{1,30}$/
const CODIGO_RE = /^BYN[A-HJ-NP-Z2-9]{5}$/
const ROBO_RE = /bot|crawl|spider|slurp|facebookexternalhit|facebot|meta-externalagent|whatsapp|telegram|curl|wget|headless|lighthouse|python-requests|node-fetch|go-http-client|axios/i

async function seguirArroba(arroba: string): Promise<never> {
  if (!ARROBA_RE.test(arroba)) notFound()
  const db = getServiceSupabase()
  if (!db) notFound()
  const ua = (await headers()).get('user-agent') || ''
  const { data, error } = await db.rpc('club_link_resolver_interno', { p_arroba: arroba, p_contar: !!ua && !ROBO_RE.test(ua) })
  if (error || typeof data !== 'string' || !CODIGO_RE.test(data)) notFound()
  redirect(`/?ref=${data}&utm_source=club&utm_medium=link&utm_campaign=meu-link`)
}

export default async function LinkCurtoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: bruto } = await params
  const slug = (bruto || '').toLowerCase()
  let decodificado = slug
  try { decodificado = decodeURIComponent(slug) } catch { /* fica como veio: o formato recusa */ }
  if (decodificado.startsWith('@')) await seguirArroba(decodificado)
  if (!SLUG_RE.test(slug) || SLUGS_RESERVADOS.has(slug)) notFound()

  const db = getServiceSupabase()
  if (!db) notFound()

  const { data } = await db
    .from('links_curtos')
    .select('destino, ativo, cliques')
    .eq('slug', slug)
    .maybeSingle()
  if (!data || !data.ativo) notFound()

  // Contador e metrica, nao dinheiro: sem RPC, a corrida entre dois cliques
  // no mesmo milissegundo perde no maximo 1.
  await db.from('links_curtos').update({ cliques: (data.cliques ?? 0) + 1 }).eq('slug', slug)

  redirect(data.destino as string)
}
