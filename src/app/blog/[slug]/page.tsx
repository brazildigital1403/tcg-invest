/**
 * src/app/blog/[slug]/page.tsx
 *
 * Post do blog — server component, mesmo padrao das outras paginas publicas
 * (bx-gutter + Breadcrumb + PublicFooter, generateMetadata + JSON-LD inline,
 * ISR via revalidate). Ver src/app/pokemon/[name]/page.tsx pro precedente.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import Breadcrumb from '@/components/ui/Breadcrumb'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import BlockRenderer from '@/components/blog/BlockRenderer'
import { IconCalendar, IconClock } from '@/components/ui/Icons'
import { fetchPublishedPost } from '@/lib/blog'

export const revalidate = 3600
export const maxDuration = 20

export async function generateStaticParams() {
  return []
}

export const dynamicParams = true

function fmtData(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await fetchPublishedPost(slug)

  if (!post) {
    return {
      title: 'Post não encontrado',
      description: 'Este post não foi encontrado no blog da Bynx.',
      alternates: { canonical: `https://bynx.gg/blog/${slug}` },
      robots: { index: false, follow: false },
    }
  }

  const title = post.seo_title || post.title
  const description = post.seo_description || post.excerpt || `${post.title} — Blog Bynx sobre Pokémon TCG.`
  const ogImage = post.cover_image_url || 'https://bynx.gg/og-image.jpg'

  return {
    title,
    description,
    alternates: { canonical: `https://bynx.gg/blog/${slug}` },
    openGraph: {
      title: `${title} | Bynx`,
      description,
      url: `https://bynx.gg/blog/${slug}`,
      type: 'article',
      siteName: 'Bynx',
      locale: 'pt_BR',
      images: [{ url: ogImage, alt: post.title }],
      publishedTime: post.published_at || undefined,
      modifiedTime: post.updated_at,
    },
    twitter: {
      card: 'summary_large_image',
      site: '@bynxgg',
      title: `${title} | Bynx`,
      description,
      images: [ogImage],
    },
    keywords: post.tags,
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await fetchPublishedPost(slug)
  if (!post) notFound()

  const breadcrumbItems = [
    { name: 'Início', href: '/' },
    { name: 'Blog', href: '/blog' },
    ...(post.category ? [{ name: post.category.name, href: `/blog?categoria=${post.category.slug}` }] : []),
    { name: post.title, href: `/blog/${post.slug}` },
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
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || post.seo_description || undefined,
    image: post.cover_image_url ? [post.cover_image_url] : undefined,
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at,
    author: { '@type': 'Organization', name: 'Bynx' },
    publisher: {
      '@type': 'Organization',
      name: 'Bynx',
      logo: { '@type': 'ImageObject', url: 'https://bynx.gg/logo_BYNX.png' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://bynx.gg/blog/${post.slug}` },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div style={{ minHeight: '100vh', background: 'var(--bx-bg)', color: 'var(--bx-text)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <PublicHeader />

        <main className="bx-gutter" style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 80px' }}>
          <Breadcrumb items={breadcrumbItems} />

          {post.category && (
            <Link
              href={`/blog?categoria=${post.category.slug}`}
              style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: 'var(--ac-1)', background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 999, padding: '5px 12px', textDecoration: 'none', marginTop: 18, marginBottom: 10 }}
            >
              {post.category.name}
            </Link>
          )}

          <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 14px' }}>
            {post.title}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--bx-text-3)', marginBottom: 24 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconCalendar size={14} />
              {fmtData(post.published_at)}
            </span>
            {!!post.reading_minutes && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconClock size={14} />
                {post.reading_minutes} min de leitura
              </span>
            )}
          </div>

          {post.cover_image_url && (
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 16, overflow: 'hidden', marginBottom: 28 }}>
              <Image src={post.cover_image_url} alt={post.title} fill priority sizes="760px" style={{ objectFit: 'cover' }} />
            </div>
          )}

          <BlockRenderer blocks={post.content} />

          {post.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--bx-border)' }}>
              {post.tags.map((tag) => (
                <span key={tag} style={{ fontSize: 12, color: 'var(--bx-text-3)', background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 999, padding: '4px 12px' }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div style={{ textAlign: 'center', paddingTop: 48, marginTop: 24 }}>
            <Link
              href="/"
              style={{ background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', padding: '12px 28px', borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}
            >
              Criar conta grátis na Bynx →
            </Link>
          </div>
        </main>
        <PublicFooter />
      </div>
    </>
  )
}
