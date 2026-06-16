'use client'

import { useState } from 'react'

export default function MarketplaceFotosGaleria({ fotos, cardName }: { fotos: string[]; cardName: string }) {
  const [i, setI] = useState(0)
  const lista = (fotos || []).filter(Boolean)
  if (lista.length === 0) return null
  const idx = ((i % lista.length) + lista.length) % lista.length
  const multi = lista.length > 1

  return (
    <div
      onClick={multi ? (e) => { e.stopPropagation(); setI(idx + 1) } : undefined}
      style={{ position: 'relative', width: '100%', paddingBottom: '139%', overflow: 'hidden', background: 'rgba(255,255,255,0.04)', cursor: multi ? 'pointer' : 'default' }}
    >
      <img
        src={lista[idx]}
        alt={cardName}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />

      {multi && (
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
          {lista.map((_, k) => (
            <span key={k} style={{ width: 5, height: 5, borderRadius: '50%', background: k === idx ? '#f59e0b' : 'rgba(255,255,255,0.5)', boxShadow: '0 1px 2px rgba(0,0,0,0.4)' }} />
          ))}
        </div>
      )}

      <span style={{ position: 'absolute', bottom: 8, right: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(255,255,255,0.2)', padding: '3px 7px', borderRadius: 7, backdropFilter: 'blur(4px)' }}>
        📷 Foto real
      </span>
    </div>
  )
}
