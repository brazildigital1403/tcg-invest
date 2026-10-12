'use client'

// Linha "Medir centralizacao" em Minha Conta > Compras & Creditos: quantas
// medicoes da previa a pessoa usou nas ultimas 24 h e, travada, quando libera.
// Le a mesma rota que aplica o limite (/api/centralizacao?acao=status), entao
// o numero aqui nunca diverge do que a tela de medicao mostra.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type Situacao = { limite: number | null; usadas: number; bloqueado: boolean; liberaEm: string | null }

const hora = (iso: string) => {
  const d = new Date(iso)
  const fmt = (o: Intl.DateTimeFormatOptions) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', ...o })
  const hoje = fmt({ day: '2-digit', month: '2-digit' }) === new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
  return `${hoje ? '' : `${fmt({ day: '2-digit', month: '2-digit' })} `}${fmt({ hour: '2-digit', minute: '2-digit' })}`
}

export default function UsoCentralizacao() {
  const [sit, setSit] = useState<Situacao | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return
      const r = await fetch('/api/centralizacao?acao=status', { headers: { Authorization: `Bearer ${data.session.access_token}` } })
      if (r.ok && vivo) setSit(await r.json())
    })()
    return () => { vivo = false }
  }, [])

  const ilimitado = sit?.limite == null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '16px 0', borderBottom: '1px solid var(--bx-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
            <rect x="4" y="2" width="12" height="16" rx="1.5" stroke="var(--bx-text-2)" strokeWidth="1.3" />
            <rect x="6.5" y="4.5" width="7" height="11" rx="0.5" stroke="var(--bx-text-2)" strokeWidth="1.3" strokeDasharray="2 1.5" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Medir centralização</p>
          <p style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>
            {!sit ? 'Prévia pela foto da frente da carta'
              : ilimitado ? <>Prévia pela foto · <strong style={{ color: 'var(--ac-1)' }}>ilimitado no seu plano</strong></>
              : sit.bloqueado && sit.liberaEm ? <>{sit.usadas} de {sit.limite} nas últimas 24 horas · <strong style={{ color: 'var(--bx-red)' }}>libera às {hora(sit.liberaEm)}</strong></>
              : <>Prévia pela foto · <strong style={{ color: 'var(--ac-1)' }}>{sit.usadas} de {sit.limite} nas últimas 24 horas</strong></>}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {sit && !ilimitado && (
          <Link href="/planos" style={{ color: 'var(--bx-text-2)', padding: '8px 4px', fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Ilimitado no Pro</Link>
        )}
        <Link href="/centralizacao" style={{ background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)', padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Medir
        </Link>
      </div>
    </div>
  )
}
