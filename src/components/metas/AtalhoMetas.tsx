'use client'

import Link from 'next/link'
import { IconTarget } from '@/components/ui/Icons'
import { useMetasVisivel } from '@/components/metas/useMetasVisivel'

/** Atalho para as Metas no topo da Minha Colecao (#368). Visibilidade: useMetasVisivel. */
export default function AtalhoMetas() {
  const visivel = useMetasVisivel()
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
