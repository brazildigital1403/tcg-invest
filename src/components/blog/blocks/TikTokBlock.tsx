'use client'

import LazyEmbedScript from './LazyEmbedScript'
import type { BlogBlock } from '@/lib/blogBlocks'

type Block = Extract<BlogBlock, { type: 'tiktok' }>

export default function TikTokBlock({ block }: { block: Block }) {
  return (
    <div style={{ margin: '24px 0', display: 'flex', justifyContent: 'center' }}>
      {/* TikTok nao documenta uma API de reprocessar embeds adicionados depois
          do primeiro load do script — dedupe=false injeta o embed.js de novo
          por bloco (leve, idempotente, escaneia o DOM e monta o iframe). */}
      <LazyEmbedScript
        src="https://www.tiktok.com/embed.js"
        dedupe={false}
        onLoaded={() => {}}
      >
        <blockquote
          className="tiktok-embed"
          cite={block.url}
          style={{ maxWidth: 605, minWidth: 325, margin: 0 }}
        >
          <a href={block.url} target="_blank" rel="noopener noreferrer">
            Ver vídeo no TikTok
          </a>
        </blockquote>
      </LazyEmbedScript>
    </div>
  )
}
