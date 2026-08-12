import Link from 'next/link'
import Image from 'next/image'
import { IconCalendar, IconClock, IconTag } from '@/components/ui/Icons'
import type { BlogListItem } from '@/lib/blog'

function fmtData(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PostCard({ post }: { post: BlogListItem }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        background: 'var(--bx-surface)',
        border: '1px solid var(--bx-border)',
        borderRadius: 16,
        overflow: 'hidden',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
      }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: 'var(--bx-surface-2)' }}>
        {post.cover_image_url ? (
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 380px"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.25 }}>
            <IconTag size={32} />
          </div>
        )}
        {post.category && (
          <span
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              background: 'var(--ac-grad)',
              color: 'var(--bx-brand-ink)',
              fontSize: 11,
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: 999,
            }}
          >
            {post.category.name}
          </span>
        )}
      </div>
      <div style={{ padding: 16 }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', margin: '0 0 8px', color: 'var(--bx-text)', lineHeight: 1.3 }}>
          {post.title}
        </h3>
        {post.excerpt && (
          <p style={{ fontSize: 13, color: 'var(--bx-text-3)', lineHeight: 1.5, margin: '0 0 12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {post.excerpt}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--bx-text-faint)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <IconCalendar size={13} />
            {fmtData(post.published_at)}
          </span>
          {!!post.reading_minutes && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <IconClock size={13} />
              {post.reading_minutes} min
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
