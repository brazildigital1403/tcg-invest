'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import PostForm, { type PostFormData } from '@/components/blog/admin/PostForm'

type Estado = 'carregando' | 'nao_encontrado' | 'erro' | 'pronto'

export default function EditarPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [estado, setEstado] = useState<Estado>('carregando')
  const [data, setData] = useState<PostFormData | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/blog/posts/${id}`)
        if (res.status === 404) {
          if (alive) setEstado('nao_encontrado')
          return
        }
        if (!res.ok) throw new Error('erro')
        const post = await res.json()
        if (!alive) return
        setData({
          id: post.id,
          title: post.title || '',
          slug: post.slug || '',
          excerpt: post.excerpt || '',
          cover_image_url: post.cover_image_url || '',
          content: post.content || [],
          category_id: post.category_id || null,
          tags: post.tags || [],
          status: post.status,
          seo_title: post.seo_title || '',
          seo_description: post.seo_description || '',
        })
        setEstado('pronto')
      } catch {
        if (alive) setEstado('erro')
      }
    })()
    return () => { alive = false }
  }, [id])

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <Link href="/admin/blog" style={{ fontSize: 13, color: 'var(--bx-text-3)', textDecoration: 'none' }}>
        ← Voltar
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--bx-text)', margin: '8px 0 20px' }}>Editar post</h1>

      {estado === 'carregando' && <p style={{ color: 'var(--bx-text-3)' }}>Carregando...</p>}
      {estado === 'nao_encontrado' && <p style={{ color: 'var(--bx-text-3)' }}>Post não encontrado.</p>}
      {estado === 'erro' && <p style={{ color: 'var(--bx-red)' }}>Erro ao carregar o post.</p>}
      {estado === 'pronto' && data && <PostForm initialData={data} isEditMode />}
    </div>
  )
}
