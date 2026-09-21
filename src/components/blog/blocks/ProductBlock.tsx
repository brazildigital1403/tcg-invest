import Link from 'next/link'
import CardItem from '@/components/ui/CardItem'
import { fetchCardSummary } from '@/lib/blog'
import { REL_AFILIADO } from '@/lib/blogBlocks'
import type { BlogBlock } from '@/lib/blogBlocks'

type Block = Extract<BlogBlock, { type: 'product' }>

const AMARELO = '#FFE600'
const ML_DARK = '#1a1a2e'

// `inGrid`: renderizado dentro da grade de cartas do BlockRenderer -- a grade
// ja controla largura e espacamento, entao o bloco nao poe margem nem teto.
export default async function ProductBlock({ block, inGrid = false }: { block: Block; inGrid?: boolean }) {
  if (block.mode === 'card') {
    const card = await fetchCardSummary(block.cardSlug || block.cardId || '')
    if (!card) return null
    const href = `/carta/${card.slug || card.id}`
    // Sem o preco o CardItem readonly cai em "Sem preço disponível". Foil so
    // quando a carta nao tem preco normal (set todo holo guarda em preco_*).
    const variante = !card.preco_min && !card.preco_medio && (card.preco_foil_min || card.preco_foil_medio) ? 'foil' : 'normal'
    return (
      <div style={inGrid ? undefined : { margin: '24px 0', maxWidth: 220 }}>
        <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
          <CardItem
            mode="readonly"
            card={{
              id: card.id,
              name: card.name,
              image_small: card.image_small || undefined,
              image_large: card.image_large || undefined,
              set_name: card.set_name || undefined,
              number: card.number || undefined,
              rarity: card.rarity || undefined,
              price: {
                preco_min: card.preco_min,
                preco_medio: card.preco_medio,
                preco_max: card.preco_max,
                preco_foil_min: card.preco_foil_min,
                preco_foil_medio: card.preco_foil_medio,
                preco_foil_max: card.preco_foil_max,
              },
            }}
            variante={variante}
          />
        </Link>
      </div>
    )
  }

  // mode === 'affiliate' — link de parceria (ex.: Mercado Livre). rel e o
  // aviso de divulgacao sao fixos no componente, nunca configuraveis pelo
  // editor (mesmo tratamento de MercadoLivre.tsx:16).
  if (!block.url) return null
  return (
    <div style={{ margin: '20px 0 28px' }}>
      <a
        href={block.url}
        target="_blank"
        rel={REL_AFILIADO}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          textDecoration: 'none',
          background: 'linear-gradient(90deg, rgba(255,230,0,0.06), rgba(255,230,0,0.02))',
          border: '1px solid rgba(255,230,0,0.22)',
          borderRadius: 12,
          padding: '14px 16px',
        }}
      >
        {block.imageUrl ? (
          <img
            src={block.imageUrl}
            alt={block.title || 'Produto'}
            style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 9, flexShrink: 0 }}
          />
        ) : (
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 9,
              background: AMARELO,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 8h16v11a1 1 0 01-1 1H5a1 1 0 01-1-1V8z" stroke={ML_DARK} strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M8 8V6a4 4 0 018 0v2" stroke={ML_DARK} strokeWidth="1.7" />
            </svg>
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#f5f5f5', marginBottom: 2 }}>
            {block.title || 'Produto recomendado'}
          </span>
          {block.priceLabel && (
            <span style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{block.priceLabel}</span>
          )}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            background: AMARELO,
            color: ML_DARK,
            fontWeight: 800,
            fontSize: 13,
            borderRadius: 9,
            padding: '10px 16px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Ver produto &rarr;
        </span>
      </a>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', margin: '6px 2px 0' }}>
        Link de parceria — publicidade
      </p>
    </div>
  )
}
