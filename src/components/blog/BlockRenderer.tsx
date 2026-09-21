import type { BlogBlock } from '@/lib/blogBlocks'
import HeadingBlock from './blocks/HeadingBlock'
import ParagraphBlock from './blocks/ParagraphBlock'
import ImageBlock from './blocks/ImageBlock'
import QuoteBlock from './blocks/QuoteBlock'
import ProductBlock from './blocks/ProductBlock'
import YouTubeBlock from './blocks/YouTubeBlock'
import InstagramBlock from './blocks/InstagramBlock'
import TikTokBlock from './blocks/TikTokBlock'

type SocialBlock = Extract<BlogBlock, { type: 'instagram' | 'tiktok' }>
type ProductBlockData = Extract<BlogBlock, { type: 'product' }>

function isSocial(block: BlogBlock): block is SocialBlock {
  return block.type === 'instagram' || block.type === 'tiktok'
}

function isCard(block: BlogBlock): block is ProductBlockData {
  return block.type === 'product' && block.mode === 'card'
}

type Run = BlogBlock | { kind: 'social'; blocks: SocialBlock[] } | { kind: 'cards'; blocks: ProductBlockData[] }

// Agrupa blocos consecutivos de instagram/tiktok — cada grupo vira uma grade
// de ate 3 colunas (pedido do Du). Um social isolado entre outros blocos
// continua sozinho, sem grade. Cartas (produto modo carta) seguidas ganham o
// mesmo tratamento: grade de 3 colunas de CardItem.
function groupRuns(blocks: BlogBlock[]): Run[] {
  const runs: Run[] = []
  let current: { kind: 'social'; blocks: SocialBlock[] } | { kind: 'cards'; blocks: ProductBlockData[] } | null = null
  const flush = () => {
    if (current) runs.push(current)
    current = null
  }
  for (const block of blocks) {
    if (isSocial(block)) {
      if (current?.kind !== 'social') { flush(); current = { kind: 'social', blocks: [] } }
      current.blocks.push(block)
      continue
    }
    if (isCard(block)) {
      if (current?.kind !== 'cards') { flush(); current = { kind: 'cards', blocks: [] } }
      current.blocks.push(block)
      continue
    }
    flush()
    runs.push(block)
  }
  flush()
  return runs
}

function SocialBlockView({ block }: { block: SocialBlock }) {
  return block.type === 'instagram' ? <InstagramBlock block={block} /> : <TikTokBlock block={block} />
}

// Server component — despacha por tipo. So os blocos que realmente precisam
// de interatividade (embeds externos) sao 'use client'; o resto renderiza no
// servidor junto do resto da pagina.
export default function BlockRenderer({ blocks }: { blocks: BlogBlock[] }) {
  const runs = groupRuns(blocks)

  return (
    <div className="bx-blog-content">
      {runs.map((run, i) => {
        if ('kind' in run && run.kind === 'cards') {
          if (run.blocks.length === 1) {
            return <ProductBlock key={run.blocks[0].id} block={run.blocks[0]} />
          }
          return (
            <div key={`cards-${i}`} className="bx-blog-cards">
              {run.blocks.map((block) => (
                <ProductBlock key={block.id} block={block} inGrid />
              ))}
            </div>
          )
        }

        if ('kind' in run) {
          const group = run.blocks
          // Um so: mantem o tamanho de sempre, sem estourar a largura do texto.
          if (group.length === 1) {
            return <SocialBlockView key={group[0].id} block={group[0]} />
          }
          // Varios seguidos: grade de ate 3 colunas. O embed do Instagram exige
          // min-width:326px pra nao quebrar, entao a grade estoura a largura
          // da coluna de texto (760px) pra caber 3 de verdade.
          return (
            <div key={`social-${i}`} className="bx-social-grid-breakout">
              <div className="bx-social-grid">
                {group.map((block) => (
                  <SocialBlockView key={block.id} block={block} />
                ))}
              </div>
            </div>
          )
        }

        const block = run
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
          default:
            return null
        }
      })}
    </div>
  )
}
