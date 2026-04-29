'use client'

import type { CSSProperties, ReactNode, AnchorHTMLAttributes } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { trackLojaClique } from '@/lib/analytics'

type TipoClique = 'whatsapp' | 'instagram' | 'facebook' | 'website' | 'maps'

/**
 * Link público que registra um clique via API antes de navegar.
 *
 * Uso:
 *   <TrackedLink lojaId={loja.id} tipo="whatsapp" href={waLink} target="_blank">
 *     Falar no WhatsApp
 *   </TrackedLink>
 *
 * Comportamento:
 *   - Dispara fetch('/api/lojas/[id]/track-click') em background (fire-and-forget)
 *   - Usa `keepalive: true` pra garantir que o request termine mesmo se o user
 *     navegar pra outra página
 *   - NÃO bloqueia a navegação — se o track falhar, o link abre igual
 *   - Se user estiver logado, envia header `x-user-id` pra analytics mais rico
 *
 * Feature do Passo 7 — Passo 11 usa esses dados pra mostrar analytics aos
 * lojistas Premium (views vs cliques, gráficos de CTAs mais clicados, etc).
 */

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'onClick'> {
  lojaId: string
  tipo: TipoClique
  href: string
  children: ReactNode
  style?: CSSProperties
}

export default function TrackedLink({ lojaId, tipo, href, children, ...rest }: Props) {
  async function handleClick() {
    // GTM/GA4 — dispara primeiro (síncrono, instantâneo) pra garantir que vá
    // mesmo se a navegação for super rápida e abortar o fetch abaixo
    trackLojaClique(lojaId, tipo)

    // Fire-and-forget. NÃO aguardamos nada antes do browser seguir o link.
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.user?.id) headers['x-user-id'] = session.user.id

      // keepalive garante que o request termina mesmo se a aba fechar/navegar
      fetch(`/api/lojas/${lojaId}/track-click`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tipo }),
        keepalive: true,
      }).catch(() => { /* silent fail — nunca bloqueia UX */ })
    } catch {
      // silent fail — tracking não pode quebrar o clique do usuário
    }
  }

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}