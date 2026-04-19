import { createClient } from '@supabase/supabase-js'
import { Metadata } from 'next'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

interface Props {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  try {
    // Busca por username primeiro, depois por UUID
    let user: any = null

    const { data: byUsername } = await supabaseAdmin
      .from('users')
      .select('id, name, username')
      .eq('username', id)
      .maybeSingle()

    if (byUsername) {
      user = byUsername
    } else {
      const { data: byId } = await supabaseAdmin
        .from('users')
        .select('id, name, username')
        .eq('id', id)
        .maybeSingle()
      user = byId
    }

    if (!user) {
      return {
        title: 'Perfil não encontrado — Bynx',
        description: 'Este perfil não existe ou foi removido.',
      }
    }

    // Busca cartas e patrimônio
    const [{ count: cardCount }, { data: cards }] = await Promise.all([
      supabaseAdmin
        .from('user_cards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabaseAdmin
        .from('user_cards')
        .select('card_name, variante, card_image')
        .eq('user_id', user.id)
        .limit(1),
    ])

    const total = cardCount || 0
    const handle = user.username ? `@${user.username}` : ''
    const firstName = user.name?.split(' ')[0] || user.name || 'Colecionador'

    const title = `${user.name} ${handle} — Bynx`

    const description = total > 0
      ? `${firstName} tem ${total} carta${total !== 1 ? 's' : ''} Pokémon TCG organizada${total !== 1 ? 's' : ''} no Bynx. Veja a coleção completa.`
      : `Perfil de ${user.name} no Bynx — ferramenta de organização para colecionadores de Pokémon TCG.`

    const cardImage = cards?.[0]?.card_image || null
    const ogImage = cardImage || 'https://bynx.gg/og-image.jpg'

    const profileUrl = `https://bynx.gg/perfil/${user.username || user.id}`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: profileUrl,
        siteName: 'Bynx',
        locale: 'pt_BR',
        type: 'profile',
        images: [
          {
            url: ogImage,
            width: 400,
            height: 560,
            alt: `Coleção de ${user.name} no Bynx`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
        site: '@bynxgg',
      },
      alternates: {
        canonical: profileUrl,
      },
    }
  } catch {
    return {
      title: 'Perfil — Bynx',
      description: 'Organize e valorize sua coleção Pokémon TCG no Bynx.',
    }
  }
}

export default function PerfilLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}