'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { uploadFotoMarketplace, deletarFotoMarketplace, MARKETPLACE_FOTOS_MAX } from '@/lib/uploadFoto'
import { IconKey } from '@/components/ui/Icons'

const LABEL: CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)', marginBottom: 8,
}

interface Props {
  userId: string
  isPro: boolean
  fotos: string[]
  setFotos: (f: string[]) => void
  /** Carta graduada: os espacos pedem slab e certificado em vez dos cantos. */
  graduada?: boolean
}

export default function MarketplaceFotosInput({ userId, isPro, fotos, setFotos, graduada = false }: Props) {
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
          <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#f59e0b' }}><IconKey size={15} /></span>
          <span>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#f0f0f0' }}>Fotos reais é um recurso PRO</span>
            <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3, lineHeight: 1.4 }}>Anúncios com foto real da carta vendem mais. Suba suas próprias fotos sendo PRO.</span>
            <span style={{ display: 'inline-block', fontSize: 11, color: '#f59e0b', fontWeight: 700, marginTop: 7 }}>Seja PRO →</span>
          </span>
        </button>
      </div>
    )
  }

  // Espacos com nome (mockup "Anunciar carta: celular", 22/09/2026): diz o que
  // fotografar em vez de um "+ adicionar" solto. Qualquer espaco vazio abre o
  // seletor; a foto entra no primeiro livre.
  const rotulos = graduada ? ['Frente', 'Verso', 'Slab', 'Certificado'] : ['Frente', 'Verso', 'Canto', 'Canto']
  const vazios = Array.from({ length: Math.max(0, MARKETPLACE_FOTOS_MAX - fotos.length) }, (_, i) => rotulos[fotos.length + i] || 'Foto')
  return (
    <div>
      <label style={LABEL}>
        Fotos reais
        <span style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#000', fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 6, marginLeft: 8, letterSpacing: 0 }}>PRO</span>
      </label>
      <div className="bx-fotos-grade">
        {fotos.map((url, i) => (
          <div key={url} className="bx-fotos-slot" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Foto ${i + 1} da carta`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {/* 30px e nao 44: sobre a miniatura, 44 cobriria a propria foto (excecao medida da bynx-ui). */}
            <button type="button" onClick={() => removerFoto(url)} aria-label={`Remover foto ${i + 1}`}
              style={{ position: 'absolute', top: 4, right: 4, width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
          </div>
        ))}
        {vazios.map((rot, i) => (
          <button key={`v${i}`} type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="bx-fotos-slot"
            style={{ border: `1px dashed ${i === 0 ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.18)'}`, background: i === 0 ? 'rgba(245,158,11,0.05)' : 'transparent', color: i === 0 ? '#f59e0b' : 'rgba(255,255,255,0.4)', cursor: uploading ? 'default' : 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {uploading && i === 0 ? 'Enviando…' : <>{i === 0 && <span style={{ fontSize: 20, lineHeight: 1, fontWeight: 400 }}>+</span>}{rot}</>}
          </button>
        ))}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
        onChange={(e) => handleFiles(e.target.files)} />
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 7 }}>
        Até {MARKETPLACE_FOTOS_MAX} fotos. Anúncio com foto real passa mais confiança.
      </p>
      {erro && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 5 }}>{erro}</p>}
      <style>{`
        .bx-fotos-grade { display: grid; grid-template-columns: repeat(4, minmax(0, 96px)); gap: 8px; }
        .bx-fotos-slot { position: relative; aspect-ratio: 3 / 4; border-radius: 12px; overflow: hidden; min-width: 0; transition: background .15s ease, border-color .15s ease; }
        @media (max-width: 560px) { .bx-fotos-grade { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; } }
      `}</style>
    </div>
  )
}
