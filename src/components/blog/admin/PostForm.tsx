'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BlockEditor from './BlockEditor'
import { uploadFotoBlog } from '@/lib/uploadFoto'
import { IconImage, IconCheck } from '@/components/ui/Icons'
import type { BlogBlock } from '@/lib/blogBlocks'

const TXT = 'var(--bx-text)'
const TXT2 = 'var(--bx-text-2)'
const TXT3 = 'var(--bx-text-3)'
const SURF = 'var(--bx-surface)'
const SURF2 = 'var(--bx-surface-2)'
const BORD = 'var(--bx-border)'

type Categoria = { id: string; slug: string; name: string }

export type PostFormData = {
  id?: string
  title: string
  slug: string
  excerpt: string
  cover_image_url: string
  content: BlogBlock[]
  category_id: string | null
  tags: string[]
  status: 'draft' | 'published'
  seo_title: string
  seo_description: string
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 13px',
  borderRadius: 9,
  border: `1px solid ${BORD}`,
  background: SURF2,
  color: TXT,
  fontSize: 14,
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: TXT3,
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

function slugifyPreview(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function PostForm({ initialData, isEditMode }: { initialData?: PostFormData; isEditMode?: boolean }) {
  const router = useRouter()
  const [data, setData] = useState<PostFormData>(
    initialData || {
      title: '', slug: '', excerpt: '', cover_image_url: '', content: [],
      category_id: null, tags: [], status: 'draft', seo_title: '', seo_description: '',
    },
  )
  const [slugTouched, setSlugTouched] = useState(!!initialData?.slug)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/blog/categorias')
      .then((r) => r.json())
      .then((d) => setCategorias(d.categorias || []))
      .catch(() => {})
  }, [])

  function set<K extends keyof PostFormData>(key: K, value: PostFormData[K]) {
    setData((d) => ({ ...d, [key]: value }))
  }

  // nextStatus omitido = so salva o conteudo, sem tocar no status atual do
  // post (e o que "Salvar alteracoes" faz — nunca despublica por engano).
  // Passado, e uma troca deliberada (Publicar/Despublicar).
  async function save(nextStatus?: 'draft' | 'published') {
    setSaving(true)
    setError(null)
    setSavedMsg(null)
    try {
      const payload: Record<string, unknown> = { ...data }
      delete payload.status
      if (nextStatus) payload.status = nextStatus

      const url = isEditMode ? `/api/admin/blog/posts/${data.id}` : '/api/admin/blog/posts'
      const method = isEditMode ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Erro ao salvar')

      if (!isEditMode) {
        // Post novo: segue direto pra edicao dele, ja com o status escolhido.
        router.push(`/admin/blog/${json.id}/editar`)
        router.refresh()
        return
      }

      // Edicao: fica na tela (nao navega embora), so confirma o que aconteceu.
      if (nextStatus) set('status', nextStatus)
      setSavedMsg(
        nextStatus === 'published' ? 'Post publicado.'
        : nextStatus === 'draft' ? 'Post despublicado — voltou a rascunho, saiu do ar.'
        : 'Alterações salvas.'
      )
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const btnPrimary: React.CSSProperties = {
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', fontWeight: 800, fontSize: 14,
    padding: '11px 22px', borderRadius: 10, border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
  }
  const btnSecondary: React.CSSProperties = {
    background: SURF2, color: TXT2, fontWeight: 700, fontSize: 14,
    padding: '11px 22px', borderRadius: 10, border: `1px solid ${BORD}`, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
  }

  return (
    <div style={{ maxWidth: 780 }}>
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--bx-red)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Título</label>
        <input
          value={data.title}
          onChange={(e) => {
            const title = e.target.value
            set('title', title)
            if (!slugTouched) set('slug', slugifyPreview(title))
          }}
          placeholder="Título do post"
          style={{ ...inputStyle, fontSize: 18, fontWeight: 700 }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Slug (URL)</label>
        <input
          value={data.slug}
          onChange={(e) => {
            setSlugTouched(true)
            set('slug', slugifyPreview(e.target.value))
          }}
          placeholder="url-do-post"
          style={inputStyle}
        />
        <span style={{ fontSize: 12, color: TXT3 }}>bynx.gg/blog/{data.slug || '...'}</span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Resumo (excerpt)</label>
        <textarea
          value={data.excerpt}
          onChange={(e) => set('excerpt', e.target.value)}
          placeholder="Resumo curto — aparece na listagem e vira meta description se você não sobrescrever nas opções de SEO"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Imagem de capa (também usada como imagem de compartilhamento)</label>
        {data.cover_image_url && (
          <img src={data.cover_image_url} alt="" style={{ width: '100%', maxWidth: 380, borderRadius: 10, display: 'block', marginBottom: 8 }} />
        )}
        <label>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: uploadingCover ? 'default' : 'pointer', background: SURF2, border: `1px solid ${BORD}`, borderRadius: 9, padding: '9px 14px', color: TXT2, fontWeight: 700, fontSize: 13 }}>
            <IconImage size={15} />
            {uploadingCover ? 'Enviando...' : data.cover_image_url ? 'Trocar capa' : 'Enviar capa'}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploadingCover}
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setUploadingCover(true)
              try {
                const { url } = await uploadFotoBlog(file)
                set('cover_image_url', url)
              } catch (err: any) {
                window.alert(err?.message || 'Erro ao enviar imagem')
              } finally {
                setUploadingCover(false)
              }
            }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Categoria</label>
          <select value={data.category_id || ''} onChange={(e) => set('category_id', e.target.value || null)} style={inputStyle}>
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Tags</label>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tagInput.trim()) {
                e.preventDefault()
                set('tags', [...new Set([...data.tags, tagInput.trim().toLowerCase()])])
                setTagInput('')
              }
            }}
            placeholder="digite e aperte Enter"
            style={inputStyle}
          />
          {data.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {data.tags.map((tag) => (
                <span
                  key={tag}
                  onClick={() => set('tags', data.tags.filter((t) => t !== tag))}
                  style={{ fontSize: 12, color: TXT2, background: SURF2, border: `1px solid ${BORD}`, borderRadius: 999, padding: '3px 10px', cursor: 'pointer' }}
                  title="Clique pra remover"
                >
                  #{tag} ×
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 26, marginBottom: 12 }}>
        <label style={labelStyle}>Conteúdo</label>
        <BlockEditor blocks={data.content} onChange={(content) => set('content', content)} />
      </div>

      <details style={{ marginBottom: 24 }}>
        <summary style={{ ...labelStyle, cursor: 'pointer', display: 'inline-block' }}>Opções de SEO (opcional)</summary>
        <div style={{ marginTop: 10 }}>
          <label style={labelStyle}>Título de SEO (sobrescreve o título)</label>
          <input value={data.seo_title} onChange={(e) => set('seo_title', e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
          <label style={labelStyle}>Descrição de SEO (sobrescreve o resumo)</label>
          <textarea value={data.seo_description} onChange={(e) => set('seo_description', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </details>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 16, borderTop: `1px solid ${BORD}`, flexWrap: 'wrap' }}>
        {isEditMode ? (
          <>
            {/* Salva o conteudo sem tocar no status — nunca tira um post do ar sozinho. */}
            <button type="button" disabled={saving} onClick={() => save()} style={btnPrimary}>
              Salvar alterações
            </button>
            {data.status === 'draft' ? (
              <button type="button" disabled={saving} onClick={() => save('published')} style={btnSecondary}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconCheck size={15} />
                  Publicar
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (window.confirm('Despublicar este post? Ele sai do ar imediatamente.')) save('draft')
                }}
                style={{ ...btnSecondary, color: 'var(--bx-red)' }}
              >
                Despublicar
              </button>
            )}
            {savedMsg && (
              <span style={{ fontSize: 13, color: 'var(--bx-green)', fontWeight: 600 }}>{savedMsg}</span>
            )}
          </>
        ) : (
          <>
            <button type="button" disabled={saving} onClick={() => save('draft')} style={btnSecondary}>
              Salvar rascunho
            </button>
            <button type="button" disabled={saving} onClick={() => save('published')} style={btnPrimary}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconCheck size={15} />
                Publicar
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
