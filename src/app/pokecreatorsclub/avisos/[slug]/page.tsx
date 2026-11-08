import type { Metadata } from 'next'
import { getServiceSupabase } from '@/lib/supabaseServer'
import AvisoClient from './AvisoClient'

// Pagina de um aviso do Club (08/11/2026, quadros V03 a V08 e D9). O conteudo
// vem no navegador, so com sessao. A previa do link no WhatsApp mostra so o
// titulo, como a Agenda; rascunho e arquivado nao tem previa.

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const sb = getServiceSupabase()
  let titulo: string | null = null
  if (sb && /^[a-z0-9-]{1,90}$/.test(slug)) {
    const { data } = await sb.from('club_avisos').select('titulo').eq('slug', slug).eq('status', 'publicado').maybeSingle()
    titulo = data?.titulo ?? null
  }
  return {
    title: titulo ? `${titulo} | Avisos do Club` : 'Avisos do Club',
    description: titulo ? 'Aviso da organização do Poké Creators Club.' : 'Avisos do Poké Creators Club.',
    robots: { index: false, follow: false },
  }
}

export default async function AvisoPage({ params }: Props) {
  const { slug } = await params
  return <AvisoClient slug={slug} />
}
