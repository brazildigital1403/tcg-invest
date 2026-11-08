import type { Metadata } from 'next'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { dataPorExtenso, type Evento } from '@/lib/pcc/agenda'
import EventoClient from './EventoClient'

// Pagina de um evento da Agenda do Club (08/11/2026, quadros E05 a E10 e D6).
// O conteudo vem no navegador, so com sessao. A previa do link no WhatsApp
// mostra so titulo e data (decisao do wireframe E08); rascunho nao tem previa.

type Props = { params: Promise<{ slug: string }> }

async function previa(slug: string): Promise<{ titulo: string; data: string } | null> {
  const sb = getServiceSupabase()
  if (!sb || !/^[a-z0-9-]{1,80}$/.test(slug)) return null
  const { data } = await sb.from('club_eventos')
    .select('titulo, inicio_data, fim_data, hora_inicio, hora_fim, status')
    .eq('slug', slug).neq('status', 'rascunho').maybeSingle()
  if (!data) return null
  const e = { ...data, hora_inicio: data.hora_inicio?.slice(0, 5) ?? null, hora_fim: data.hora_fim?.slice(0, 5) ?? null } as Evento
  const quando = data.status === 'cancelado' ? 'Cancelado' : data.status === 'adiado' ? 'Adiado, nova data em breve' : dataPorExtenso(e)
  return { titulo: data.titulo, data: quando }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const p = await previa(slug)
  return {
    title: p ? `${p.titulo} | Agenda do Club` : 'Agenda do Club',
    description: p ? p.data : 'Agenda do Poké Creators Club.',
    robots: { index: false, follow: false },
  }
}

export default async function EventoPage({ params }: Props) {
  const { slug } = await params
  return <EventoClient slug={slug} />
}
