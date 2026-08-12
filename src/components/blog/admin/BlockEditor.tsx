'use client'

import { useState } from 'react'
import RichTextEditor from './RichTextEditor'
import { uploadFotoBlog } from '@/lib/uploadFoto'
import type { BlogBlock } from '@/lib/blogBlocks'
import { IconImage, IconPlay, IconTag, IconLink, IconTrash, IconArrowUp, IconArrowDown, IconPlus } from '@/components/ui/Icons'

const TXT = 'var(--bx-text)'
const TXT2 = 'var(--bx-text-2)'
const TXT3 = 'var(--bx-text-3)'
const SURF = 'var(--bx-surface)'
const SURF2 = 'var(--bx-surface-2)'
const BORD = 'var(--bx-border)'

function uid(): string {
  return `blk_${Math.random().toString(36).slice(2, 10)}`
}

function newBlock(type: BlogBlock['type']): BlogBlock {
  const id = uid()
  switch (type) {
    case 'heading': return { id, type, level: 2, text: '' }
    case 'paragraph': return { id, type, html: '' }
    case 'image': return { id, type, url: '', alt: '' }
    case 'youtube': return { id, type, videoId: '' }
    case 'instagram': return { id, type, url: '' }
    case 'tiktok': return { id, type, url: '' }
    case 'product': return { id, type, mode: 'affiliate', url: '' }
    case 'quote': return { id, type, text: '' }
  }
}

function parseYouTubeId(input: string): string {
  const trimmed = input.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed
  try {
    const u = new URL(trimmed)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    if (u.searchParams.get('v')) return u.searchParams.get('v')!
    const shortsMatch = u.pathname.match(/\/(shorts|embed)\/([a-zA-Z0-9_-]{11})/)
    if (shortsMatch) return shortsMatch[2]
  } catch {
    // nao era URL valida, cai no vazio abaixo
  }
  return ''
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
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
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const BLOCK_LABELS: Record<BlogBlock['type'], string> = {
  heading: 'Título de seção',
  paragraph: 'Parágrafo',
  image: 'Imagem',
  youtube: 'Vídeo do YouTube',
  instagram: 'Post do Instagram',
  tiktok: 'Vídeo do TikTok',
  product: 'Produto / afiliado',
  quote: 'Citação',
}

function BlockFields({ block, onChange }: { block: BlogBlock; onChange: (b: BlogBlock) => void }) {
  const [uploading, setUploading] = useState(false)

  switch (block.type) {
    case 'heading':
      return (
        <div style={{ display: 'flex', gap: 10 }}>
          <select
            value={block.level}
            onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 2 | 3 })}
            style={{ ...inputStyle, width: 90, flexShrink: 0 }}
          >
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
          <input
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="Texto do título"
            style={inputStyle}
          />
        </div>
      )

    case 'paragraph':
      return <RichTextEditor html={block.html} onChange={(html) => onChange({ ...block, html })} />

    case 'image':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {block.url && (
            <img src={block.url} alt={block.alt} style={{ maxWidth: 220, borderRadius: 8, display: 'block' }} />
          )}
          <label style={{ ...labelStyle, marginBottom: 0 }}>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: uploading ? 'default' : 'pointer',
                background: SURF2, border: `1px solid ${BORD}`, borderRadius: 8, padding: '8px 12px', color: TXT2, fontWeight: 700, fontSize: 13,
              }}
            >
              <IconImage size={15} />
              {uploading ? 'Enviando...' : block.url ? 'Trocar imagem' : 'Enviar imagem'}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setUploading(true)
                try {
                  const { url } = await uploadFotoBlog(file)
                  onChange({ ...block, url })
                } catch (err: any) {
                  window.alert(err?.message || 'Erro ao enviar imagem')
                } finally {
                  setUploading(false)
                }
              }}
            />
          </label>
          <input
            value={block.alt}
            onChange={(e) => onChange({ ...block, alt: e.target.value })}
            placeholder="Texto alternativo (alt) — obrigatório pra SEO e acessibilidade"
            style={inputStyle}
          />
          <input
            value={block.caption || ''}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
            placeholder="Legenda (opcional)"
            style={inputStyle}
          />
        </div>
      )

    case 'youtube':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            defaultValue={block.videoId}
            onBlur={(e) => onChange({ ...block, videoId: parseYouTubeId(e.target.value) })}
            placeholder="Cole a URL do vídeo (youtube.com/watch?v=... ou youtu.be/...)"
            style={inputStyle}
          />
          {block.videoId && <span style={{ fontSize: 12, color: TXT3 }}>ID detectado: {block.videoId}</span>}
          <input
            value={block.caption || ''}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
            placeholder="Legenda (opcional)"
            style={inputStyle}
          />
        </div>
      )

    case 'instagram':
      return (
        <input
          value={block.url}
          onChange={(e) => onChange({ ...block, url: e.target.value })}
          placeholder="URL do post (https://www.instagram.com/p/...)"
          style={inputStyle}
        />
      )

    case 'tiktok':
      return (
        <input
          value={block.url}
          onChange={(e) => onChange({ ...block, url: e.target.value })}
          placeholder="URL do vídeo (https://www.tiktok.com/@.../video/...)"
          style={inputStyle}
        />
      )

    case 'product':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => onChange({ id: block.id, type: 'product', mode: 'card' })}
              style={{ ...inputStyle, width: 'auto', cursor: 'pointer', background: block.mode === 'card' ? 'var(--ac-grad)' : SURF2, color: block.mode === 'card' ? 'var(--bx-brand-ink)' : TXT2, fontWeight: 700 }}
            >
              Carta da Bynx
            </button>
            <button
              type="button"
              onClick={() => onChange({ id: block.id, type: 'product', mode: 'affiliate', url: '' })}
              style={{ ...inputStyle, width: 'auto', cursor: 'pointer', background: block.mode === 'affiliate' ? 'var(--ac-grad)' : SURF2, color: block.mode === 'affiliate' ? 'var(--bx-brand-ink)' : TXT2, fontWeight: 700 }}
            >
              Link de afiliado
            </button>
          </div>

          {block.mode === 'card' ? (
            <input
              value={block.cardSlug || block.cardId || ''}
              onChange={(e) => onChange({ ...block, cardSlug: e.target.value, cardId: undefined })}
              placeholder="Slug ou ID da carta (copie da URL /carta/...)"
              style={inputStyle}
            />
          ) : (
            <>
              <input
                value={block.url || ''}
                onChange={(e) => onChange({ ...block, url: e.target.value })}
                placeholder="URL do link de afiliado (Mercado Livre etc.)"
                style={inputStyle}
              />
              <input
                value={block.title || ''}
                onChange={(e) => onChange({ ...block, title: e.target.value })}
                placeholder="Título do produto"
                style={inputStyle}
              />
              <input
                value={block.imageUrl || ''}
                onChange={(e) => onChange({ ...block, imageUrl: e.target.value })}
                placeholder="URL da imagem (opcional)"
                style={inputStyle}
              />
              <input
                value={block.priceLabel || ''}
                onChange={(e) => onChange({ ...block, priceLabel: e.target.value })}
                placeholder="Preço/nota (opcional, ex: A partir de R$ 89,90)"
                style={inputStyle}
              />
            </>
          )}
        </div>
      )

    case 'quote':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="Texto da citação"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <input
            value={block.attribution || ''}
            onChange={(e) => onChange({ ...block, attribution: e.target.value })}
            placeholder="Atribuição (opcional)"
            style={inputStyle}
          />
        </div>
      )
  }
}

function BlockCard({
  block,
  onChange,
  onRemove,
  onMove,
  isFirst,
  isLast,
}: {
  block: BlogBlock
  onChange: (b: BlogBlock) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  isFirst: boolean
  isLast: boolean
}) {
  const iconBtn: React.CSSProperties = {
    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 7, border: `1px solid ${BORD}`, background: SURF2, color: TXT3, cursor: 'pointer',
  }
  return (
    <div style={{ border: `1px solid ${BORD}`, borderRadius: 12, padding: 14, background: SURF, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: TXT3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {BLOCK_LABELS[block.type]}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" disabled={isFirst} onClick={() => onMove(-1)} style={{ ...iconBtn, opacity: isFirst ? 0.35 : 1 }} title="Mover pra cima">
            <IconArrowUp size={14} />
          </button>
          <button type="button" disabled={isLast} onClick={() => onMove(1)} style={{ ...iconBtn, opacity: isLast ? 0.35 : 1 }} title="Mover pra baixo">
            <IconArrowDown size={14} />
          </button>
          <button type="button" onClick={onRemove} style={{ ...iconBtn, color: 'var(--bx-red)' }} title="Remover bloco">
            <IconTrash size={14} />
          </button>
        </div>
      </div>
      <BlockFields block={block} onChange={onChange} />
    </div>
  )
}

const ADD_OPTIONS: { type: BlogBlock['type']; label: string; Icon: any }[] = [
  { type: 'heading', label: 'Título', Icon: IconTag },
  { type: 'paragraph', label: 'Parágrafo', Icon: IconTag },
  { type: 'image', label: 'Imagem', Icon: IconImage },
  { type: 'youtube', label: 'YouTube', Icon: IconPlay },
  { type: 'instagram', label: 'Instagram', Icon: IconLink },
  { type: 'tiktok', label: 'TikTok', Icon: IconLink },
  { type: 'product', label: 'Produto/afiliado', Icon: IconTag },
  { type: 'quote', label: 'Citação', Icon: IconTag },
]

export default function BlockEditor({ blocks, onChange }: { blocks: BlogBlock[]; onChange: (b: BlogBlock[]) => void }) {
  function update(i: number, block: BlogBlock) {
    const next = [...blocks]
    next[i] = block
    onChange(next)
  }
  function remove(i: number) {
    onChange(blocks.filter((_, idx) => idx !== i))
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= blocks.length) return
    const next = [...blocks]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  function add(type: BlogBlock['type']) {
    onChange([...blocks, newBlock(type)])
  }

  return (
    <div>
      {blocks.map((block, i) => (
        <BlockCard
          key={block.id}
          block={block}
          onChange={(b) => update(i, b)}
          onRemove={() => remove(i)}
          onMove={(dir) => move(i, dir)}
          isFirst={i === 0}
          isLast={i === blocks.length - 1}
        />
      ))}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        {ADD_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            type="button"
            onClick={() => add(opt.type)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700,
              padding: '8px 13px', borderRadius: 9, border: `1px dashed ${BORD}`, background: SURF2, color: TXT2, cursor: 'pointer',
            }}
          >
            <IconPlus size={14} />
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
