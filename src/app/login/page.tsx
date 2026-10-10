'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginRedirect() {
  const router = useRouter()

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        router.replace('/dashboard-financeiro')
      } else {
        // Abre o modal de login na home e, se a pessoa veio de uma pagina
        // interna (carta, anuncio), volta pra ela depois (08/10/2026).
        let next = ''
        try {
          const ref = document.referrer ? new URL(document.referrer) : null
          if (ref && ref.origin === window.location.origin && ref.pathname !== '/' && ref.pathname !== '/login') {
            next = `&next=${encodeURIComponent(ref.pathname + ref.search)}`
          }
        } catch { /* referrer invalido: segue sem next */ }
        router.replace(`/?auth=login${next}`)
      }
    }
    check()
  }, [])

  return null
}