'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type World = 'app' | 'loja' | 'admin'

const HREF: Record<World, string> = {
  app: '/minha-colecao',
  loja: '/minha-loja',
  admin: '/admin',
}
const LABEL: Record<World, string> = { app: 'App', loja: 'Loja', admin: 'Admin' }

// Cor da aba ATIVA = identidade do mundo atual
const ACTIVE_STYLE: Record<World, React.CSSProperties> = {
  app:   { background: 'var(--bx-brand)', color: 'var(--bx-brand-ink)' },
  loja:  { background: 'linear-gradient(135deg, #60a5fa, #a855f7)', color: '#fff' },
  admin: { background: 'linear-gradient(135deg, #64748b, #334155)', color: '#fff' },
}

let _adminCache: boolean | null = null

export default function WorldSwitcher({
  current,
  temLoja = false,
  compact = false,
  mb = 0,
}: {
  current: World
  temLoja?: boolean
  compact?: boolean
  mb?: number
}) {
  const [isAdmin, setIsAdmin] = useState<boolean>(_adminCache ?? (current === 'admin'))

  useEffect(() => {
    if (_adminCache !== null) { setIsAdmin(_adminCache); return }
    try {
      const cached = sessionStorage.getItem('bx_is_admin')
      if (cached !== null) { _adminCache = cached === '1'; setIsAdmin(_adminCache); return }
    } catch {}
    let alive = true
    fetch('/api/admin/status')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        _adminCache = !!d.isAdmin
        setIsAdmin(_adminCache)
        try { sessionStorage.setItem('bx_is_admin', _adminCache ? '1' : '0') } catch {}
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const worlds: World[] = []
  worlds.push('app')
  if (temLoja || current === 'loja') worlds.push('loja')
  if (isAdmin || current === 'admin') worlds.push('admin')

  if (worlds.length < 2) return null

  const seg: React.CSSProperties = {
    display: 'flex', gap: 3,
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)',
    borderRadius: 999, padding: compact ? 2 : 3,
  }
  const tabBase: React.CSSProperties = {
    flex: compact ? '0 0 auto' : 1,
    textAlign: 'center',
    padding: compact ? '5px 11px' : '7px 10px',
    borderRadius: 999,
    fontSize: compact ? 11.5 : 12.5,
    fontWeight: 700,
    color: 'var(--bx-text-2)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  }

  return (
    <div style={{ marginBottom: mb }}>
      <div style={seg}>
        {worlds.map((w) =>
          w === current ? (
            <span key={w} style={{ ...tabBase, ...ACTIVE_STYLE[w] }}>{LABEL[w]}</span>
          ) : (
            <Link key={w} href={HREF[w]} style={tabBase}>{LABEL[w]}</Link>
          )
        )}
      </div>
    </div>
  )
}
