import type { BlogBlock } from '@/lib/blogBlocks'

type Block = Extract<BlogBlock, { type: 'quote' }>

export default function QuoteBlock({ block }: { block: Block }) {
  return (
    <blockquote
      style={{
        margin: '24px 0',
        padding: '16px 20px',
        borderLeft: '3px solid var(--ac-1)',
        background: 'var(--bx-surface)',
        borderRadius: '0 12px 12px 0',
      }}
    >
      <p style={{ fontSize: 17, fontStyle: 'italic', lineHeight: 1.6, color: 'var(--bx-text)', margin: 0 }}>
        &ldquo;{block.text}&rdquo;
      </p>
      {block.attribution && (
        <cite style={{ display: 'block', fontSize: 13, color: 'var(--bx-text-3)', marginTop: 8, fontStyle: 'normal' }}>
          — {block.attribution}
        </cite>
      )}
    </blockquote>
  )
}
