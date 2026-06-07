'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAppModal } from '@/components/ui/useAppModal'
import { IconClose } from '@/components/ui/Icons'

type PastaLite = { id: string; nome: string; descricao: string | null; imagem_url: string | null }

export default function PastaFormModal({
  userId, mode, pasta, onClose, onSaved,
}: {
  userId: string
  mode: 'create' | 'edit'
  pasta?: PastaLite
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const { showAlert } = useAppModal()
  const [nome, setNome] = useState(pasta?.nome || '')
  const [descricao, setDescricao] = useState(pasta?.descricao || '')
  const [preview, setPreview] = useState<string | null>(pasta?.imagem_url || null)
  const [file, setFile] = useState<File | null>(null)
  const [removeImg, setRemoveImg] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  function pickFile(f: File | null) {
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      showAlert('Use uma imagem JPG, PNG ou WEBP.', 'error'); return
    }
    if (f.size > 5 * 1024 * 1024) {
      showAlert('A imagem precisa ter no máximo 5 MB.', 'error'); return
    }
    setFile(f)
    setRemoveImg(false)
    setPreview(URL.createObjectURL(f))
  }

  function clearImage() {
    setFile(null)
    setPreview(null)
    setRemoveImg(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSave() {
    const nomeT = nome.trim()
    if (nomeT.length < 1 || nomeT.length > 60) { showAlert('O nome precisa ter entre 1 e 60 caracteres.', 'error'); return }
    if (descricao.length > 140) { showAlert('A descrição pode ter no máximo 140 caracteres.', 'error'); return }

    setSaving(true)
    try {
      let pastaId = pasta?.id || ''

      // 1) cria ou atualiza nome/descricao
      if (mode === 'create') {
        const { data, error } = await supabase
          .from('pastas')
          .insert({ user_id: userId, nome: nomeT, descricao: descricao.trim() || null })
          .select('id')
          .single()
        if (error || !data) throw error || new Error('insert falhou')
        pastaId = data.id
      } else {
        const { error } = await supabase
          .from('pastas')
          .update({ nome: nomeT, descricao: descricao.trim() || null })
          .eq('id', pastaId)
        if (error) throw error
      }

      // 2) imagem de capa
      if (file) {
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
        const path = `${userId}/${pastaId}-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('pastas').upload(path, file, { upsert: true, contentType: file.type })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('pastas').getPublicUrl(path)
        const { error: uErr } = await supabase.from('pastas').update({ imagem_url: pub.publicUrl }).eq('id', pastaId)
        if (uErr) throw uErr
      } else if (removeImg && mode === 'edit') {
        await supabase.from('pastas').update({ imagem_url: null }).eq('id', pastaId)
      }

      onSaved(pastaId)
    } catch (err: any) {
      console.error('[pasta form] save error:', err?.message || err)
      const msg = String(err?.message || '')
      if (msg.includes('PRO_REQUIRED_PASTAS')) {
        showAlert('No plano Free voce pode ter 1 Pasta. Faca upgrade para o Pro e tenha pastas ilimitadas.', 'warning')
      } else {
        showAlert('Erro ao salvar a Pasta. Tente novamente.', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d0f14', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, width: '100%', maxWidth: 460, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 16, fontWeight: 700 }}>{mode === 'create' ? 'Nova Pasta' : 'Editar Pasta'}</p>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, width: 30, height: 30, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconClose size={14} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Capa */}
          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 8 }}>Capa (opcional)</label>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => pickFile(e.target.files?.[0] || null)} />
            <div
              onClick={() => fileRef.current?.click()}
              style={{ position: 'relative', height: 150, borderRadius: 14, overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: preview ? '#0d0f14' : 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {preview ? (
                <img src={preview} alt="capa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                  <p style={{ fontSize: 26, marginBottom: 4 }}>🖼️</p>
                  <p style={{ fontSize: 13 }}>Escolher imagem</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>JPG, PNG ou WEBP · até 5 MB</p>
                </div>
              )}
              {preview && (
                <button
                  onClick={(e) => { e.stopPropagation(); clearImage() }}
                  title="Remover capa"
                  style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <IconClose size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Nome */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Nome</label>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{nome.length}/60</span>
            </div>
            <input
              value={nome}
              maxLength={60}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Charizards, Base Set, Favoritas..."
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#f0f0f0', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          {/* Descrição */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Descrição (opcional)</label>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{descricao.length}/140</span>
            </div>
            <textarea
              value={descricao}
              maxLength={140}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Uma frase sobre essa pasta..."
              rows={3}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#f0f0f0', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} disabled={saving} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', padding: '10px 18px', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || nome.trim().length === 0}
            style={{ background: (saving || nome.trim().length === 0) ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: (saving || nome.trim().length === 0) ? 'rgba(255,255,255,0.3)' : '#000', padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: (saving || nome.trim().length === 0) ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
          >
            {saving ? 'Salvando...' : (mode === 'create' ? 'Criar Pasta' : 'Salvar')}
          </button>
        </div>
      </div>
    </div>
  )
}