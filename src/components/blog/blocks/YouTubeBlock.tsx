'use client'

import { useState } from 'react'
import { IconPlay } from '@/components/ui/Icons'
import type { BlogBlock } from '@/lib/blogBlocks'

type Block = Extract<BlogBlock, { type: 'youtube' }>

export default function YouTubeBlock({ block }: { block: Block }) {
  const [playing, setPlaying] = useState(false)

  return (
    <figure style={{ margin: '24px 0' }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: 14,
          overflow: 'hidden',
          background: '#000',
        }}
      >
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${block.videoId}?autoplay=1`}
            title={block.caption || 'Vídeo do YouTube'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            aria-label="Reproduzir vídeo"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              border: 0,
              padding: 0,
              cursor: 'pointer',
              backgroundImage: `url(https://i.ytimg.com/vi/${block.videoId}/hqdefault.jpg)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <span
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.25)',
              }}
            >
              <span
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  background: 'var(--ac-grad)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                }}
              >
                <IconPlay size={30} color="#0a0a0a" strokeWidth={2} />
              </span>
            </span>
          </button>
        )}
      </div>
      {block.caption && (
        <figcaption style={{ fontSize: 12, color: 'var(--bx-text-3)', textAlign: 'center', marginTop: 8 }}>
          {block.caption}
        </figcaption>
      )}
    </figure>
  )
}
