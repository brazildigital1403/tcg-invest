import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import type { Destaques, ListaFeed } from '@/lib/pcc/feed'
import FeedClient from './FeedClient'

// Feed do Poke Creators Club (26/11/2026). Decisao do Du: aberto a todos, inclusive ao Google.
// A primeira pagina de "Recentes" e os destaques (chegaram e escolha da semana) vem renderizados do servidor (pagina so client-side chega vazia
// para o Google), lida como visitante pela club_feed_lista; o resto e lido no navegador.
//
// Decisao do Du em 27/11/2026: pagina indexavel, no sitemap (lib/sitemap-core.ts) e atualizada a
// cada 5 minutos. Falha de leitura NUNCA vira lista vazia guardada: com throw, o Next mantem a
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

async function leituraInicial(): Promise<{ lista: ListaFeed; destaques: Destaques }> {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const [l, d] = await Promise.all([
    sb.rpc('club_feed_lista', { p_aba: 'recentes', p_limite: 20 }),
    sb.rpc('club_feed_destaques'),
  ])
  if (l.error) throw new Error(`club_feed_lista: ${l.error.message}`)
  if (d.error) throw new Error(`club_feed_destaques: ${d.error.message}`)
  return { lista: l.data as ListaFeed, destaques: d.data as Destaques }
}

export default async function FeedPage() {
  const { lista, destaques } = await leituraInicial()
  return <FeedClient inicial={lista} destaquesIniciais={destaques} />
}
