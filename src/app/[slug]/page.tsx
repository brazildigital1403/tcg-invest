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

import { notFound, redirect } from 'next/navigation'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { SLUG_RE, SLUGS_RESERVADOS } from '@/lib/linksCurtos'

export const dynamic = 'force-dynamic'

export default async function LinkCurtoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: bruto } = await params
  const slug = (bruto || '').toLowerCase()
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
