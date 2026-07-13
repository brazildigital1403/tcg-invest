'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

/**
 * Registra uma VISITA (tipo='view') na pagina da loja.
 * - Client-side: bots que nao rodam JS nao contam (filtro natural).
 * - NAO conta o proprio dono visitando a propria loja.
 * - Dedup por sessao (1 view por loja por sessao) + dedup por IP no backend (60s).
 * - Envia document.referrer pra registrar a ORIGEM real da visita.
 * Renderiza null (so efeito colateral).
 */
export default function TrackViewLoja({ lojaId, ownerUserId }: { lojaId: string; ownerUserId: string | null }) {
  useEffect(() => {
    let ativo = true
    ;(async () => {
      const chave = `viewed-loja-${lojaId}`
      try { if (sessionStorage.getItem(chave)) return } catch { /* noop */ }

      const { data } = await supabase.auth.getUser()
      if (!ativo) return
      // dono nao conta como visita
      if (data.user?.id && data.user.id === ownerUserId) return

      try { sessionStorage.setItem(chave, '1') } catch { /* noop */ }

      fetch(`/api/lojas/${lojaId}/track-click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'view', referrer: document.referrer || null }),
        keepalive: true,
      }).catch(() => { /* fire-and-forget */ })
    })()
    return () => { ativo = false }
  }, [lojaId, ownerUserId])

  return null
}
