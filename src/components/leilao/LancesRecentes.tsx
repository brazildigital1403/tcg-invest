'use client'

import { useEffect, useState } from 'react'
import { formatarBRL } from '@/lib/leilao'
import type { LancePublico } from '@/lib/leilao-rodada'

/**
 * Lances recentes do lote com prazo. Quem acompanha ve a disputa ate o fim.
 * Atualiza a cada 15 s com a aba visivel. Falha mantem o que esta na tela.
 */
export default function LancesRecentes({ loteId, aberto }: { loteId: string; aberto: boolean }) {
  const [lances, setLances] = useState<LancePublico[] | null>(null)

  useEffect(() => {
    let vivo = true
    const buscar = () => {
      if (document.visibilityState !== 'visible') return
      fetch(`/api/leiloes/${loteId}/lances`)
        .then(r => (r.ok ? r.json() : null))
        .then(j => { if (vivo && j?.lances) setLances(j.lances) })
        .catch(() => {})
    }
    buscar()
    if (!aberto) return () => { vivo = false }
    const id = setInterval(buscar, 15_000)
    return () => { vivo = false; clearInterval(id) }
  }, [loteId, aberto])

  if (!lances) return null
  return (
    <section aria-label="Lances recentes" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--bx-text)' }}>Lances recentes</h2>
      {lances.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--bx-text-2)' }}>Nenhum lance ainda.</p>
      ) : lances.map((l, i) => (
        <div
          key={l.id}
          style={{
            display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 8, fontSize: 13,
            fontVariantNumeric: 'tabular-nums', color: 'var(--bx-text-2)',
            background: i === 0 ? 'rgba(var(--ac-1-rgb), 0.1)' : 'var(--bx-surface)',
          }}
        >
          <span>{l.apelido}{i === 0 ? ' · lance atual' : ''}</span>
          <b style={{ color: 'var(--bx-text)' }}>{formatarBRL(l.valorCents)}</b>
        </div>
      ))}
    </section>
  )
}
