'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { IconEdit, IconTrash, IconPlus, IconArticle } from '@/components/ui/Icons'

const TXT = 'var(--bx-text)'
const TXT2 = 'var(--bx-text-2)'
const TXT3 = 'var(--bx-text-3)'
const SURF = 'var(--bx-surface)'
const SURF2 = 'var(--bx-surface-2)'
const BORD = 'var(--bx-border)'
const AC = 'var(--ac-1)'

type Post = {
  id: string
  slug: string
  title: string
  status: 'draft' | 'published'
  published_at: string | null
  cover_image_url: string | null
  updated_at: string
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [counts, setCounts] = useState<{ draft: number; published: number }>({ draft: 0, published: 0 })
  const [status, setStatus] = useState<'all' | 'draft' | 'published'>('all')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (status !== 'all') params.set('status', status)
    if (q) params.set('q', q)
    const res = await fetch(`/api/admin/blog/posts?${params}`)
    const data = await res.json().catch(() => ({}))
    setPosts(data.posts || [])
    setCounts(data.counts || { draft: 0, published: 0 })
    setLoading(false)
  }, [status, q])

  useEffect(() => {
    load()
  }, [load])

  async function remove(id: string, title: string) {
    if (!window.confirm(`Excluir o post "${title}"? Essa ação não pode ser desfeita.`)) return
    await fetch(`/api/admin/blog/posts/${id}`, { method: 'DELETE' })
    load()
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${BORD}`,
    background: active ? 'var(--ac-grad)' : SURF2, color: active ? 'var(--bx-brand-ink)' : TXT2,
  })

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: TXT, margin: 0 }}>Blog</h1>
          <p style={{ fontSize: 13, color: TXT3, margin: '4px 0 0' }}>
            {counts.published} publicado{counts.published === 1 ? '' : 's'} · {counts.draft} rascunho{counts.draft === 1 ? '' : 's'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/admin/blog/categorias" style={{ fontSize: 13, fontWeight: 700, color: TXT2, background: SURF2, border: `1px solid ${BORD}`, borderRadius: 10, padding: '10px 16px', textDecoration: 'none' }}>
            Categorias
          </Link>
          <Link href="/admin/blog/novo" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: 'var(--bx-brand-ink)', background: 'var(--ac-grad)', borderRadius: 10, padding: '10px 16px', textDecoration: 'none' }}>
            <IconPlus size={14} /> Novo post
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <button onClick={() => setStatus('all')} style={tabStyle(status === 'all')}>Todos</button>
        <button onClick={() => setStatus('published')} style={tabStyle(status === 'published')}>Publicados</button>
        <button onClick={() => setStatus('draft')} style={tabStyle(status === 'draft')}>Rascunhos</button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por título..."
          style={{ marginLeft: 'auto', minWidth: 200, padding: '8px 12px', borderRadius: 9, border: `1px solid ${BORD}`, background: SURF2, color: TXT, fontSize: 13 }}
        />
      </div>

      {loading ? (
        <p style={{ color: TXT3, textAlign: 'center', padding: 40 }}>Carregando...</p>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: TXT3 }}>
          <IconArticle size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
          <p>Nenhum post ainda.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {posts.map((post) => (
            <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: SURF, border: `1px solid ${BORD}`, borderRadius: 12, padding: 12 }}>
              <div style={{ width: 56, height: 40, borderRadius: 7, background: SURF2, flexShrink: 0, overflow: 'hidden' }}>
                {post.cover_image_url && (
                  // thumbnail simples — nao precisa de otimizacao do next/image na lista admin
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: TXT, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {post.title}
                </p>
                <p style={{ fontSize: 12, color: TXT3, margin: '2px 0 0' }}>/blog/{post.slug}</p>
              </div>
              <span
                style={{
                  fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999, flexShrink: 0,
                  background: post.status === 'published' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
                  color: post.status === 'published' ? 'var(--bx-green)' : TXT3,
                }}
              >
                {post.status === 'published' ? 'Publicado' : 'Rascunho'}
              </span>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <Link href={`/admin/blog/${post.id}/editar`} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${BORD}`, color: AC, textDecoration: 'none' }}>
                  <IconEdit size={15} />
                </Link>
                <button onClick={() => remove(post.id, post.title)} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${BORD}`, background: 'none', color: 'var(--bx-red)', cursor: 'pointer' }}>
                  <IconTrash size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
