'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { METAS_ATIVO } from '@/lib/metas'

/**
 * Quem enxerga a entrada das Metas (#368): todo mundo com a flag
 * NEXT_PUBLIC_METAS_ATIVO=1; com ela desligada, so a sessao de admin -- o
 * jeito do Du testar sem abrir para ninguem antes da remedicao da Pokedex
 * (#369). Uma regra so para o atalho da Minha Colecao e o item do menu.
 *
 * "E admin?" reaproveita o sinal do WorldSwitcher (App|Loja|Admin):
 * /api/admin/status, com o cache de sessao `bx_is_admin` que ele ja grava.
 * A sessao de admin e um cookie POR NAVEGADOR: em outro navegador, ou sem ter
 * entrado no /admin, a entrada fica escondida.
 */
const semAssinatura = () => () => {}
function lerCacheAdmin(): string | null {
  try { return sessionStorage.getItem('bx_is_admin') } catch { return null }
}

export function useMetasVisivel(): boolean {
  // No servidor o snapshot e null (nao sabe quem e admin): o primeiro render
  // casa com o HTML.
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

  return METAS_ATIVO || cache === '1' || adminPelaApi
}
