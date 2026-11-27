import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import type { ListaFeed } from '@/lib/pcc/feed'
import FeedClient from './FeedClient'

// Feed do Poke Creators Club (26/11/2026). Decisao do Du: aberto a todos, inclusive ao Google.
// A primeira pagina de "Recentes" vem renderizada do servidor (pagina so client-side chega vazia
// para o Google), lida como visitante pela club_feed_lista; o resto e lido no navegador.
//
// PENDENTE DO DU antes de producao (E9 do plano): o intervalo de atualizacao abaixo, a entrada no
// sitemap e o robots. Falha de leitura NUNCA vira lista vazia guardada: com throw, o Next mantem a
// versao anterior e tenta de novo na proxima visita.
export const revalidate = 300

const titulo = 'Feed do Club'
const descricao = 'Os posts dos creators do Poké Creators Club, para descobrir e apoiar.'

export const metadata: Metadata = {
  title: titulo,
  description: descricao,
  alternates: { canonical: 'https://bynx.gg/pokecreatorsclub/feed' },
  openGraph: { title: titulo, description: descricao, url: 'https://bynx.gg/pokecreatorsclub/feed', siteName: 'Bynx', locale: 'pt_BR', type: 'website' },
  twitter: { card: 'summary_large_image', title: titulo, description: descricao },
}

async function listaInicial(): Promise<ListaFeed> {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await sb.rpc('club_feed_lista', { p_aba: 'recentes', p_limite: 20 })
  if (error) throw new Error(`club_feed_lista: ${error.message}`)
  return data as ListaFeed
}

export default async function FeedPage() {
  const inicial = await listaInicial()
  return <FeedClient inicial={inicial} />
}
