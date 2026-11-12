import Image from 'next/image'
import Link from 'next/link'
import type { BlogBlock } from '@/lib/blogBlocks'

type Block = Extract<BlogBlock, { type: 'image' }>

export default function ImageBlock({ block }: { block: Block }) {
  const img = (
    <Image
      src={block.url}
      alt={block.alt}
      width={900}
      height={600}
      sizes="(max-width: 768px) 100vw, 820px"
      style={{ width: '100%', height: 'auto', borderRadius: 14, display: 'block' }}
    />
  )

  // Link interno navega pelo Next; externo abre em outra aba.
  const href = block.href
  const linked = !href
    ? img
    : href.startsWith('/')
      ? <Link href={href} style={{ display: 'block' }}>{img}</Link>
      : <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>{img}</a>

  return (
    <figure style={{ margin: '24px 0' }}>
      {linked}
      {block.caption && (
        <figcaption style={{ fontSize: 12, color: 'var(--bx-text-3)', textAlign: 'center', marginTop: 8 }}>
          {block.caption}
        </figcaption>
      )}
    </figure>
  )
}
