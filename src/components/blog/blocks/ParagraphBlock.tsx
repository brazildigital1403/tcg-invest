import type { BlogBlock } from '@/lib/blogBlocks'

type Block = Extract<BlogBlock, { type: 'paragraph' }>

// html ja vem sanitizado no save (src/lib/blogBlocks.ts) — gerado pelo Tiptap,
// so tags de texto rico (p/strong/em/a/ul/li/blockquote).
export default function ParagraphBlock({ block }: { block: Block }) {
  return (
    <div
      className="bx-blog-rich"
      style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--bx-text-2)', margin: '0 0 18px' }}
      dangerouslySetInnerHTML={{ __html: block.html }}
    />
  )
}
