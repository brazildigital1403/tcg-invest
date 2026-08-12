'use client'

import Link from 'next/link'
import PostForm from '@/components/blog/admin/PostForm'

export default function NovoPostPage() {
  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <Link href="/admin/blog" style={{ fontSize: 13, color: 'var(--bx-text-3)', textDecoration: 'none' }}>
        ← Voltar
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--bx-text)', margin: '8px 0 20px' }}>Novo post</h1>
      <PostForm />
    </div>
  )
}
