import type { BlogBlock } from '@/lib/blogBlocks'

type Block = Extract<BlogBlock, { type: 'heading' }>

export default function HeadingBlock({ block }: { block: Block }) {
  const style = {
    fontWeight: 900,
    letterSpacing: '-0.03em',
    color: 'var(--bx-text)',
    margin: '34px 0 14px',
    scrollMarginTop: 90,
  } as const

  if (block.level === 2) {
    return <h2 id={anchorId(block.text)} style={{ ...style, fontSize: 26 }}>{block.text}</h2>
  }
  return <h3 id={anchorId(block.text)} style={{ ...style, fontSize: 20, margin: '26px 0 10px' }}>{block.text}</h3>
}

function anchorId(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}
