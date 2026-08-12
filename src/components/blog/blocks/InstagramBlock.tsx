'use client'

import LazyEmbedScript from './LazyEmbedScript'
import type { BlogBlock } from '@/lib/blogBlocks'

type Block = Extract<BlogBlock, { type: 'instagram' }>

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } }
  }
}

export default function InstagramBlock({ block }: { block: Block }) {
  return (
    <div style={{ margin: '24px 0', display: 'flex', justifyContent: 'center' }}>
      <LazyEmbedScript
        src="https://www.instagram.com/embed.js"
        onLoaded={() => window.instgrm?.Embeds.process()}
      >
        <blockquote
          className="instagram-media"
          data-instgrm-permalink={block.url}
          data-instgrm-version="14"
          style={{ minWidth: 326, width: '100%', maxWidth: 540, margin: 0, background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 14 }}
        >
          <a href={block.url} target="_blank" rel="noopener noreferrer">
            Ver publicação no Instagram
          </a>
        </blockquote>
      </LazyEmbedScript>
    </div>
  )
}
