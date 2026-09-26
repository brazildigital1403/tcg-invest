'use client'

// Video do YouTube que so carrega o iframe no toque (mesma logica do
// YouTubeBlock do blog). Ate la e uma imagem: o player pesa ~1 MB e a maioria
// de quem abre a pagina no celular nao aperta play.

import { useState } from 'react'
import Image from 'next/image'
import { IconPlay } from '@/components/ui/Icons'

export default function VideoLazy({ videoId, titulo, duracao }: { videoId: string; titulo: string; duracao?: string | null }) {
  const [tocando, setTocando] = useState(false)

  return (
    <div className="sv-video">
      {tocando ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={titulo}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button type="button" className="sv-video-btn" onClick={() => setTocando(true)} aria-label={`Assistir: ${titulo}`}>
          <Image src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" fill sizes="(max-width: 600px) 100vw, 560px" unoptimized />
          <span className="sv-video-play">
            <span><IconPlay size={30} strokeWidth={1.8} /></span>
            {duracao ? `Assistir · ${duracao}` : 'Assistir'}
          </span>
        </button>
      )}
    </div>
  )
}
