'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { uploadFotoMarketplace, deletarFotoMarketplace, MARKETPLACE_FOTOS_MAX } from '@/lib/uploadFoto'

const LABEL: CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)', marginBottom: 8,
}

interface Props {
  userId: string
  isPro: boolean
  fotos: string[]
  setFotos: (f: string[]) => void
}

export default function MarketplaceFotosInput({ userId, isPro, fotos, setFotos }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setErro(null)
    const restantes = MARKETPLACE_FOTOS_MAX - fotos.length
    const lista = Array.from(files).slice(0, Math.max(0, restantes))
    if (lista.length === 0) return
    setUploading(true)
    const novas: string[] = []
    for (const file of lista) {
      try {
        const url = await uploadFotoMarketplace(userId, file)
        novas.push(url)
      } catch (e: any) {
        setErro(e?.message || 'Erro ao enviar foto.')
      }
    }
    if (novas.length) setFotos([...fotos, ...novas])
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function removerFoto(url: string) {
    setFotos(fotos.filter(f => f !== url))
    try { await deletarFotoMarketplace(url) } catch { /* best-effort */ }
  }

  if (!isPro) {
    return (
      <div>
        <label style={LABEL}>Fotos reais</label>
        <button type="button" onClick={() => { window.location.href = '/minha-conta' }}
          style={{ width: '100%', textAlign: 'left', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>🔒</span>
          <span>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#f0f0f0' }}>Fotos reais é um recurso PRO</span>
            <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3, lineHeight: 1.4 }}>Anúncios com foto real da carta vendem mais. Suba suas próprias fotos sendo PRO.</span>
            <span style={{ display: 'inline-block', fontSize: 11, color: '#f59e0b', fontWeight: 700, marginTop: 7 }}>Seja PRO →</span>
          </span>
        </button>
      </div>
    )
  }

  const podeAdicionar = fotos.length < MARKETPLACE_FOTOS_MAX
  return (
    <div>
      <label style={LABEL}>
        Fotos reais
        <span style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#000', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5, marginLeft: 6 }}>PRO</span>
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {fotos.map((url) => (
          <div key={url} style={{ width: 64, height: 88, borderRadius: 10, overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.12)' }}>
            <img src={url} alt="Foto da carta" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button type="button" onClick={() => removerFoto(url)}
              style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
          </div>
        ))}
        {podeAdicionar && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            style={{ width: 64, height: 88, borderRadius: 10, border: '1.5px dashed rgba(245,158,11,0.5)', background: 'transparent', cursor: uploading ? 'default' : 'pointer', color: '#f59e0b', fontSize: 9, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, fontFamily: 'inherit' }}>
            {uploading ? <span>enviando…</span> : <><span style={{ fontSize: 22, lineHeight: 1, fontWeight: 300 }}>+</span>adicionar</>}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
        onChange={(e) => handleFiles(e.target.files)} />
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 7 }}>
        Até {MARKETPLACE_FOTOS_MAX} fotos · mostre a carta real (frente, verso, cantos)
      </p>
      {erro && <p style={{ fontSize: 10, color: '#ef4444', marginTop: 5 }}>{erro}</p>}
    </div>
  )
}
