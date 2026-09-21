'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { IconTarget } from '@/components/ui/Icons'
import { METAS_ATIVO } from '@/lib/metas'

/**
 * Atalho para as Metas no topo da Minha Colecao (#368).
 *
 * Com a flag desligada so o admin ve -- e o jeito do Du testar sem digitar a
 * URL, sem abrir para ninguem antes da remedicao da Pokedex (#369). Com a flag
 * ligada, aparece para todos.
 *
 * O "e admin?" reaproveita o mesmo sinal do WorldSwitcher (App|Loja|Admin):
 * /api/admin/status, com o cache de sessao `bx_is_admin` que ele ja grava.
 */
// Snapshot do cache de sessao. No servidor e null (nao sabe quem e admin), e
// o primeiro render casa com o HTML.
const semAssinatura = () => () => {}
function lerCacheAdmin(): string | null {
  try { return sessionStorage.getItem('bx_is_admin') } catch { return null }
}

export default function AtalhoMetas() {
  const cache = useSyncExternalStore(semAssinatura, lerCacheAdmin, () => null)
  const [adminPelaApi, setAdminPelaApi] = useState(false)

  useEffect(() => {
    if (METAS_ATIVO || cache !== null) return
    let ativo = true
    fetch('/api/admin/status')
      .then(r => r.json())
      .then(d => { if (ativo && d?.isAdmin) setAdminPelaApi(true) })
      .catch(() => {})
    return () => { ativo = false }
  }, [cache])

  const visivel = METAS_ATIVO || cache === '1' || adminPelaApi
  if (!visivel) return null
  return (
    <Link
      href="/metas"
      prefetch={false}
      style={{ background: 'rgba(var(--ac-1-rgb), 0.08)', border: '1px solid rgba(var(--ac-1-rgb), 0.2)', color: 'var(--ac-1)', padding: '8px 14px', minHeight: 44, boxSizing: 'border-box', borderRadius: 10, fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
    >
      <IconTarget size={14} color="currentColor" />
      Metas
    </Link>
  )
}
