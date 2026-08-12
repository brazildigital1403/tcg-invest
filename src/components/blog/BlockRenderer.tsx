import type { BlogBlock } from '@/lib/blogBlocks'
import HeadingBlock from './blocks/HeadingBlock'
import ParagraphBlock from './blocks/ParagraphBlock'
import ImageBlock from './blocks/ImageBlock'
import QuoteBlock from './blocks/QuoteBlock'
import ProductBlock from './blocks/ProductBlock'
import YouTubeBlock from './blocks/YouTubeBlock'
import InstagramBlock from './blocks/InstagramBlock'
import TikTokBlock from './blocks/TikTokBlock'

// Server component — despacha por tipo. So os blocos que realmente precisam
// de interatividade (embeds externos) sao 'use client'; o resto renderiza no
// servidor junto do resto da pagina.
export default function BlockRenderer({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <div className="bx-blog-content">
      {blocks.map((block) => {
        switch (block.type) {
          case 'heading':
            return <HeadingBlock key={block.id} block={block} />
          case 'paragraph':
            return <ParagraphBlock key={block.id} block={block} />
          case 'image':
            return <ImageBlock key={block.id} block={block} />
          case 'quote':
            return <QuoteBlock key={block.id} block={block} />
          case 'product':
            return <ProductBlock key={block.id} block={block} />
          case 'youtube':
            return <YouTubeBlock key={block.id} block={block} />
          case 'instagram':
            return <InstagramBlock key={block.id} block={block} />
          case 'tiktok':
            return <TikTokBlock key={block.id} block={block} />
          default:
            return null
        }
      })}
    </div>
  )
}
