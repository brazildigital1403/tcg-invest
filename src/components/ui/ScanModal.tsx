'use client'
import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const SURFACE = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 } as const

interface ScannedCard {
  name: string
  number?: string
  set?: string
  hp?: string
  selected: boolean
}

interface Props {
  userId: string
  onClose: () => void
  onAdded: () => void
}

export default function ScanModal({ userId, onClose, onAdded }: Props) {
  const [step, setStep] = useState<'capture' | 'scanning' | 'confirm' | 'adding'>('capture')
  const [preview, setPreview] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<string>('image/jpeg')
  const [cards, setCards] = useState<ScannedCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [addedCount, setAddedCount] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // ── Câmera ──────────────────────────────────────────────────────────────────

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraActive(true)
    } catch {
      setError('Não foi possível acessar a câmera. Tente fazer upload de uma foto.')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    const video = videoRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setPreview(dataUrl)
    setMediaType('image/jpeg')
    stopCamera()
  }

  // ── Upload de arquivo ────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const type = file.type || 'image/jpeg'
    setMediaType(type)
    const reader = new FileReader()
    reader.onload = ev => {
      setPreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  // ── Comprime imagem antes de enviar ────────────────────────────────────────────

  function compressImage(dataUrl: string, maxWidth = 1280, quality = 0.8): Promise<{ base64: string; mediaType: string }> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height)
        const compressed = canvas.toDataURL('image/jpeg', quality)
        resolve({ base64: compressed.split(',')[1], mediaType: 'image/jpeg' })
      }
      img.src = dataUrl
    })
  }

  // ── Scan via Claude Vision ───────────────────────────────────────────────────

  async function handleScan() {
    if (!preview) return
    setStep('scanning')
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Sessão expirada')

      // Comprime imagem antes de enviar (reduz de vários MB para ~200KB)
      const { base64, mediaType: compressedType } = await compressImage(preview)

      const res = await fetch('/api/scan-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image: base64, mediaType: compressedType }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Erro ao escanear')
      if (!data.cards?.length) {
        setError('Nenhuma carta identificada. Tente uma foto mais clara e próxima das cartas.')
        setStep('capture')
        return
      }

      setCards(data.cards.map((c: any) => ({ ...c, selected: true })))
      setStep('confirm')
    } catch (err: any) {
      setError(err.message || 'Erro ao processar imagem')
      setStep('capture')
    }
  }

  // ── Adicionar cartas confirmadas ─────────────────────────────────────────────

  async function handleAdd() {
    const selected = cards.filter(c => c.selected)
    if (!selected.length) return
    setStep('adding')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let added = 0
    for (const card of selected) {
      // Monta card_name com número se disponível
      const cardName = card.number
        ? `${card.name} (${card.number})`
        : card.name

      // Verifica se já existe
      const { data: existing } = await supabase
        .from('user_cards')
        .select('id, quantity')
        .eq('user_id', user.id)
        .ilike('card_name', cardName)
        .limit(1)
        .single()
        .catch(() => ({ data: null }))

      if (existing) {
        await supabase.from('user_cards')
          .update({ quantity: (existing.quantity || 1) + 1 })
          .eq('id', existing.id)
      } else {
        await supabase.from('user_cards').insert({
          user_id: user.id,
          card_name: cardName,
          card_id: card.number || null,
          set_name: card.set || null,
          variante: 'normal',
          quantity: 1,
          card_image: null,
          card_link: null,
          rarity: null,
        })
      }
      added++
    }

    setAddedCount(added)
    onAdded()
  }

  const selectedCount = cards.filter(c => c.selected).length

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
      backdropFilter: 'blur(8px)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 560, background: '#0d0f14',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24,
        boxShadow: '0 32px 100px rgba(0,0,0,0.7)', overflow: 'hidden',
        color: '#f0f0f0',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              📷
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700 }}>Escanear cartas</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                {step === 'capture' && 'Tire uma foto ou envie uma imagem'}
                {step === 'scanning' && 'Analisando com IA...'}
                {step === 'confirm' && `${cards.length} carta${cards.length !== 1 ? 's' : ''} identificada${cards.length !== 1 ? 's' : ''}`}
                {step === 'adding' && 'Adicionando à coleção...'}
              </p>
            </div>
          </div>
          <button onClick={() => { stopCamera(); onClose() }}
            style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 28 }}>

          {/* ── STEP: CAPTURE ── */}
          {(step === 'capture' || step === 'scanning') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Erro */}
              {error && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#ef4444' }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Preview ou câmera */}
              {preview ? (
                <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
                  <img src={preview} alt="Preview" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', background: '#000', borderRadius: 12 }} />
                  {step === 'capture' && (
                    <button onClick={() => { setPreview(null); setError(null) }}
                      style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
                      Trocar foto
                    </button>
                  )}
                </div>
              ) : cameraActive ? (
                <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
                  <video ref={videoRef} style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} playsInline muted />
                  <div style={{ position: 'absolute', inset: 0, border: '3px solid rgba(245,158,11,0.4)', borderRadius: 12, pointerEvents: 'none' }}>
                    {/* Guias de enquadramento */}
                    <div style={{ position: 'absolute', top: '10%', left: '10%', width: 24, height: 24, borderTop: '2px solid #f59e0b', borderLeft: '2px solid #f59e0b' }} />
                    <div style={{ position: 'absolute', top: '10%', right: '10%', width: 24, height: 24, borderTop: '2px solid #f59e0b', borderRight: '2px solid #f59e0b' }} />
                    <div style={{ position: 'absolute', bottom: '10%', left: '10%', width: 24, height: 24, borderBottom: '2px solid #f59e0b', borderLeft: '2px solid #f59e0b' }} />
                    <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 24, height: 24, borderBottom: '2px solid #f59e0b', borderRight: '2px solid #f59e0b' }} />
                  </div>
                </div>
              ) : (
                // Placeholder quando sem câmera e sem preview
                <div style={{ ...SURFACE, padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 48, opacity: 0.3 }}>📷</div>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                    Fotografe suas cartas organizadas em uma binder ou mesa
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                    Quanto mais visíveis as cartas, melhor o reconhecimento
                  </p>
                </div>
              )}

              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {/* Botões de captura */}
              {step === 'capture' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!preview && (
                    <>
                      {cameraActive ? (
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={capturePhoto}
                            style={{ flex: 1, background: BRAND, border: 'none', color: '#000', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 0 20px rgba(245,158,11,0.3)' }}>
                            📸 Tirar foto
                          </button>
                          <button onClick={stopCamera}
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', padding: '14px 18px', borderRadius: 12, cursor: 'pointer', fontSize: 14 }}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button onClick={startCamera}
                          style={{ width: '100%', background: BRAND, border: 'none', color: '#000', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 0 20px rgba(245,158,11,0.3)' }}>
                          📷 Usar câmera
                        </button>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>ou</span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                      </div>

                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                      <button onClick={() => fileInputRef.current?.click()}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '13px', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                        🖼️ Carregar imagem da galeria
                      </button>
                    </>
                  )}

                  {/* Botão analisar */}
                  {preview && (
                    <button onClick={handleScan}
                      style={{ width: '100%', background: BRAND, border: 'none', color: '#000', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 0 24px rgba(245,158,11,0.35)' }}>
                      🔍 Analisar cartas com IA →
                    </button>
                  )}
                </div>
              )}

              {/* Loading scan */}
              {step === 'scanning' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 0' }}>
                  <div style={{ width: 48, height: 48, border: '3px solid rgba(245,158,11,0.2)', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Analisando com Claude Vision...</p>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Identificando cartas Pokémon na imagem</p>
                  </div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                </div>
              )}

              {/* Dicas */}
              {step === 'capture' && !preview && !cameraActive && (
                <div style={{ ...SURFACE, padding: '14px 16px' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>💡 Dicas para melhor resultado:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[
                      'Organize as cartas sem sobreposição',
                      'Boa iluminação, sem reflexos',
                      'Foto de cima, cartas paralelas à câmera',
                      'Quanto mais próximo, melhor a leitura',
                    ].map(t => (
                      <p key={t} style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>• {t}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: CONFIRM ── */}
          {step === 'confirm' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                Confirme as cartas identificadas. Desmarque as que estiverem incorretas.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                {cards.map((card, i) => (
                  <label key={i} style={{
                    ...SURFACE, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer', opacity: card.selected ? 1 : 0.45,
                    transition: 'opacity 0.15s',
                    background: card.selected ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${card.selected ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                    <input type="checkbox" checked={card.selected}
                      onChange={() => setCards(prev => prev.map((c, j) => j === i ? { ...c, selected: !c.selected } : c))}
                      style={{ width: 18, height: 18, accentColor: '#f59e0b', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0' }}>
                        {card.name}{card.number ? ` (${card.number})` : ''}
                      </p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        {[card.set, card.hp ? `HP ${card.hp}` : null].filter(Boolean).join(' · ') || 'Set não identificado'}
                      </p>
                    </div>
                    <span style={{ fontSize: 18 }}>{card.selected ? '✅' : '⬜'}</span>
                  </label>
                ))}
              </div>

              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                ℹ️ Cartas adicionadas sem imagem — vincule o link depois para buscar preços
              </p>
            </div>
          )}

          {/* ── STEP: ADDING ── */}
          {step === 'adding' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 0' }}>
              {addedCount === 0 ? (
                <>
                  <div style={{ width: 48, height: 48, border: '3px solid rgba(245,158,11,0.2)', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontSize: 15, fontWeight: 600 }}>Adicionando à coleção...</p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 56 }}>🎉</div>
                  <p style={{ fontSize: 18, fontWeight: 800 }}>{addedCount} carta{addedCount !== 1 ? 's' : ''} adicionada{addedCount !== 1 ? 's' : ''}!</p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
                    Agora vincule os links da LigaPokemon para buscar os preços reais.
                  </p>
                  <button onClick={onClose}
                    style={{ background: BRAND, border: 'none', color: '#000', padding: '13px 32px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    Ver coleção →
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === 'capture' || step === 'confirm') && (
          <div style={{ padding: '14px 28px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
            {step === 'capture' ? (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Powered by Claude Vision ✦</p>
            ) : (
              <p style={{ fontSize: 13, color: selectedCount > 0 ? '#f59e0b' : 'rgba(255,255,255,0.3)', fontWeight: selectedCount > 0 ? 600 : 400 }}>
                {selectedCount} de {cards.length} selecionada{selectedCount !== 1 ? 's' : ''}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { stopCamera(); onClose() }}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', padding: '10px 20px', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              {step === 'confirm' && (
                <button onClick={handleAdd} disabled={selectedCount === 0}
                  style={{ background: selectedCount > 0 ? BRAND : 'rgba(255,255,255,0.06)', border: 'none', color: selectedCount > 0 ? '#000' : 'rgba(255,255,255,0.3)', padding: '10px 24px', borderRadius: 10, fontSize: 13, cursor: selectedCount > 0 ? 'pointer' : 'default', fontWeight: 700, transition: 'all 0.2s' }}>
                  Adicionar {selectedCount > 0 ? `(${selectedCount})` : ''} →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}