/**
 * src/app/blog/page.tsx
 *
 * Listagem do blog. Filtro por categoria via ?categoria=slug (v1 nao tem rota
 * propria de categoria, so o filtro — ver plano de implementacao).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import Breadcrumb from '@/components/ui/Breadcrumb'
import PublicFooter from '@/components/ui/PublicFooter'
import PostCard from '@/components/blog/PostCard'
import { fetchPublishedPostsList, fetchCategories } from '@/lib/blog'

export const revalidate = 3600

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>
}): Promise<Metadata> {
  const { categoria } = await searchParams
  const categorias = categoria ? await fetchCategories() : []
  const cat = categorias.find((c) => c.slug === categoria)

  const title = cat ? `${cat.name} — Blog Bynx` : 'Blog Bynx — Pokémon TCG, preços e coleção'
  const description = cat?.description
    || 'Conteúdo sobre Pokémon TCG: quanto valem as cartas, novidades de sets, como cuidar da coleção e o mercado brasileiro em reais.'

  return {
    title,
    description,
    alternates: { canonical: cat ? `https://bynx.gg/blog?categoria=${cat.slug}` : 'https://bynx.gg/blog' },
    openGraph: {
      title,
      description,
      url: 'https://bynx.gg/blog',
      type: 'website',
      siteName: 'Bynx',
      locale: 'pt_BR',
      images: [{ url: 'https://bynx.gg/og-image.jpg', alt: title }],
    },
  }
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; page?: string }>
}) {
  const { categoria, page } = await searchParams
  const pageNum = Math.max(1, Number(page) || 1)

  const [{ posts, totalPages }, categorias] = await Promise.all([
    fetchPublishedPostsList({ categorySlug: categoria, page: pageNum }),
    fetchCategories(),
  ])

  const breadcrumbItems = [
    { name: 'Início', href: '/' },
    { name: 'Blog', href: '/blog' },
  ]
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `https://bynx.gg${it.href}`,
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div style={{ minHeight: '100vh', background: 'var(--bx-bg)', color: 'var(--bx-text)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <header
          className="bx-gutter"
          style={{
            borderBottom: '1px solid var(--bx-border)',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(8,10,15,0.95)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Link href="/" style={{ textDecoration: 'none' }}>
            <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
          </Link>
          <Link
            href="/pokedex"
            style={{ background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', padding: '8px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
          >
            Ver Pokédex
          </Link>
        </header>

        <main className="bx-gutter" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px' }}>
          <Breadcrumb items={breadcrumbItems} />

          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 8 }}>
            Blog Bynx
          </h1>
          <p style={{ fontSize: 15, color: 'var(--bx-text-2)', marginBottom: 26, maxWidth: 640 }}>
            Cartas, sets, mercado e coleção — tudo sobre Pokémon TCG no Brasil.
          </p>

          {categorias.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 30 }}>
              <Link
                href="/blog"
                style={{
                  fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 999, textDecoration: 'none',
                  background: !categoria ? 'var(--ac-grad)' : 'var(--bx-surface)',
                  color: !categoria ? 'var(--bx-brand-ink)' : 'var(--bx-text-2)',
                  border: '1px solid var(--bx-border)',
                }}
              >
                Tudo
              </Link>
              {categorias.map((c) => (
                <Link
                  key={c.id}
                  href={`/blog?categoria=${c.slug}`}
                  style={{
                    fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 999, textDecoration: 'none',
                    background: categoria === c.slug ? 'var(--ac-grad)' : 'var(--bx-surface)',
                    color: categoria === c.slug ? 'var(--bx-brand-ink)' : 'var(--bx-text-2)',
                    border: '1px solid var(--bx-border)',
                  }}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}

          {posts.length === 0 ? (
            <p style={{ color: 'var(--bx-text-3)', padding: '40px 0', textAlign: 'center' }}>
              Nenhum post por aqui ainda.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 36 }}>
              {pageNum > 1 && (
                <Link
                  href={`/blog?${new URLSearchParams({ ...(categoria ? { categoria } : {}), page: String(pageNum - 1) })}`}
                  style={{ fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 10, background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', color: 'var(--bx-text)', textDecoration: 'none' }}
                >
                  ← Anterior
                </Link>
              )}
              <span style={{ fontSize: 13, color: 'var(--bx-text-3)', alignSelf: 'center' }}>
                Página {pageNum} de {totalPages}
              </span>
              {pageNum < totalPages && (
                <Link
                  href={`/blog?${new URLSearchParams({ ...(categoria ? { categoria } : {}), page: String(pageNum + 1) })}`}
                  style={{ fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 10, background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', color: 'var(--bx-text)', textDecoration: 'none' }}
                >
                  Próxima →
                </Link>
              )}
            </div>
          )}
        </main>
        <PublicFooter />
      </div>
    </>
  )
}
