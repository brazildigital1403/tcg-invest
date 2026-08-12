'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

/**
 * Wrapper do Tiptap pro bloco "paragrafo" do editor de post. Headless por
 * padrao — skinado aqui com os tokens de cor do site (--bx-*, --ac-*), nao
 * com o CSS do Tiptap. Unica dependencia externa nova do blog (ver plano de
 * implementacao).
 */
export default function RichTextEditor({
  html,
  onChange,
}: {
  html: string
  onChange: (html: string) => void
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
    ],
    content: html,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  if (!editor) return null

  const btnStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 13,
    fontWeight: 700,
    padding: '5px 10px',
    borderRadius: 7,
    border: '1px solid var(--bx-border)',
    background: active ? 'var(--ac-grad)' : 'var(--bx-surface-2)',
    color: active ? 'var(--bx-brand-ink)' : 'var(--bx-text-2)',
    cursor: 'pointer',
  })

  return (
    <div style={{ border: '1px solid var(--bx-border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: 8, borderBottom: '1px solid var(--bx-border)', background: 'var(--bx-surface)' }}>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} style={btnStyle(editor.isActive('bold'))}>
          Negrito
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} style={btnStyle(editor.isActive('italic'))}>
          Itálico
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} style={btnStyle(editor.isActive('bulletList'))}>
          Lista
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} style={btnStyle(editor.isActive('orderedList'))}>
          Lista numerada
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt('URL do link:')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          style={btnStyle(editor.isActive('link'))}
        >
          Link
        </button>
      </div>
      <div style={{ padding: '10px 14px' }}>
        <style>{`
          .bx-tiptap .ProseMirror { outline: none; min-height: 120px; font-size: 15px; line-height: 1.7; color: var(--bx-text); }
          .bx-tiptap .ProseMirror p { margin: 0 0 10px; }
          .bx-tiptap .ProseMirror a { color: var(--ac-1); }
          .bx-tiptap .ProseMirror ul, .bx-tiptap .ProseMirror ol { padding-left: 22px; margin: 0 0 10px; }
        `}</style>
        <div className="bx-tiptap">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
