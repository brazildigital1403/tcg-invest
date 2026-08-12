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

function isSocial(block: BlogBlock): block is SocialBlock {
  return block.type === 'instagram' || block.type === 'tiktok'
}

// Agrupa blocos consecutivos de instagram/tiktok — cada grupo vira uma grade
// de ate 3 colunas (pedido do Du). Um social isolado entre outros blocos
// continua sozinho, sem grade.
function groupRuns(blocks: BlogBlock[]): (BlogBlock | SocialBlock[])[] {
  const runs: (BlogBlock | SocialBlock[])[] = []
  let current: SocialBlock[] = []
  for (const block of blocks) {
    if (isSocial(block)) {
      current.push(block)
      continue
    }
    if (current.length) {
      runs.push(current)
      current = []
    }
    runs.push(block)
  }
  if (current.length) runs.push(current)
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
        if (Array.isArray(run)) {
          // Um so: mantem o tamanho de sempre, sem estourar a largura do texto.
          if (run.length === 1) {
            return <SocialBlockView key={run[0].id} block={run[0]} />
          }
          // Varios seguidos: grade de ate 3 colunas. O embed do Instagram exige
          // min-width:326px pra nao quebrar, entao a grade estoura a largura
          // da coluna de texto (760px) pra caber 3 de verdade.
          return (
            <div key={`social-${i}`} className="bx-social-grid-breakout">
              <div className="bx-social-grid">
                {run.map((block) => (
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
