import Link from 'next/link'
import type { PostDaCarta } from '@/lib/blogCartaIndex'

/**
 * "No blog da Bynx" dentro da pagina publica da carta (Fase 2 do #490).
 * Server component: os links saem no HTML, que e o que o Google e os modelos
 * de IA leem. Nao renderiza nada quando nao ha post que case.
 */
export default function BlogDaCarta({ posts }: { posts: PostDaCarta[] }) {
  if (!posts.length) return null
  return (
    <section aria-labelledby="blog-da-carta" style={{ margin: '4px 0 22px' }}>
      <h2
        id="blog-da-carta"
        style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--bx-text-3)', margin: '0 0 10px' }}
      >
        No blog da Bynx
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {posts.map(p => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            style={{
              display: 'block',
              background: 'var(--bx-surface)',
              border: '1px solid var(--bx-border)',
              borderRadius: 12,
              padding: '12px 14px',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--bx-text)', margin: 0 }}>{p.titulo}</p>
            {p.resumo && (
              <p style={{ fontSize: 12.5, color: 'var(--bx-text-2)', margin: '4px 0 0', lineHeight: 1.45 }}>{p.resumo}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
