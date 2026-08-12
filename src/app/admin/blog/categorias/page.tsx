'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { IconTrash, IconPlus } from '@/components/ui/Icons'

const TXT = 'var(--bx-text)'
const TXT2 = 'var(--bx-text-2)'
const TXT3 = 'var(--bx-text-3)'
const SURF = 'var(--bx-surface)'
const SURF2 = 'var(--bx-surface-2)'
const BORD = 'var(--bx-border)'

type Categoria = { id: string; slug: string; name: string; description: string | null }

export default function CategoriasBlogPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/admin/blog/categorias')
    const data = await res.json().catch(() => ({}))
    setCategorias(data.categorias || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function criar() {
    if (!nome.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/blog/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nome, description: descricao }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao criar categoria')
      setNome('')
      setDescricao('')
      load()
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar categoria')
    } finally {
      setSaving(false)
    }
  }

  async function remover(id: string, name: string) {
    if (!window.confirm(`Excluir a categoria "${name}"? Os posts dessa categoria ficam sem categoria.`)) return
    await fetch(`/api/admin/blog/categorias/${id}`, { method: 'DELETE' })
    load()
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${BORD}`, background: SURF2, color: TXT, fontSize: 14 }

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <Link href="/admin/blog" style={{ fontSize: 13, color: TXT3, textDecoration: 'none' }}>
        ← Voltar
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: TXT, margin: '8px 0 20px' }}>Categorias do blog</h1>

      <div style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
        {error && <p style={{ color: 'var(--bx-red)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da categoria" style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição (opcional)" style={inputStyle} />
          <button
            onClick={criar}
            disabled={saving || !nome.trim()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: 'var(--bx-brand-ink)', background: 'var(--ac-grad)', border: 'none', borderRadius: 9, padding: '9px 16px', cursor: 'pointer', flexShrink: 0, opacity: saving ? 0.6 : 1 }}
          >
            <IconPlus size={14} /> Criar
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {categorias.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: SURF, border: `1px solid ${BORD}`, borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: TXT, margin: 0 }}>{c.name}</p>
              {c.description && <p style={{ fontSize: 12, color: TXT3, margin: '2px 0 0' }}>{c.description}</p>}
            </div>
            <button onClick={() => remover(c.id, c.name)} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${BORD}`, background: 'none', color: 'var(--bx-red)', cursor: 'pointer' }}>
              <IconTrash size={14} />
            </button>
          </div>
        ))}
        {categorias.length === 0 && <p style={{ color: TXT3, fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhuma categoria ainda.</p>}
      </div>
    </div>
  )
}
