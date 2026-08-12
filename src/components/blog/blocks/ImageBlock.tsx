import Image from 'next/image'
import type { BlogBlock } from '@/lib/blogBlocks'

type Block = Extract<BlogBlock, { type: 'image' }>

export default function ImageBlock({ block }: { block: Block }) {
  return (
    <figure style={{ margin: '24px 0' }}>
      <Image
        src={block.url}
        alt={block.alt}
        width={900}
        height={600}
        sizes="(max-width: 768px) 100vw, 820px"
        style={{ width: '100%', height: 'auto', borderRadius: 14, display: 'block' }}
      />
      {block.caption && (
        <figcaption style={{ fontSize: 12, color: 'var(--bx-text-3)', textAlign: 'center', marginTop: 8 }}>
          {block.caption}
        </figcaption>
      )}
    </figure>
  )
}
