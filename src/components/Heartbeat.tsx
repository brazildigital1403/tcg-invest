'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

// Heartbeat de "ultima atividade".
// A sessao do Supabase vive no localStorage (client), entao o middleware no
// servidor nunca a enxerga — quem registra atividade tem que ser o client.
// Aqui chamamos a RPC touch_last_seen() (SECURITY DEFINER) que atualiza apenas
// a propria linha via auth.uid(). Throttle de 10min via localStorage pra nao
// bater no banco a cada navegacao. Falha nunca quebra a navegacao (silencioso).

const SEEN_KEY = 'bynx_last_seen_ping'
const THROTTLE_MS = 10 * 60 * 1000 // 10 min

async function ping() {
  try {
    const last = Number(localStorage.getItem(SEEN_KEY) || 0)
    if (Date.now() - last < THROTTLE_MS) return

    // So grava se houver sessao (usuario logado)
    const { data } = await supabase.auth.getSession()
    if (!data.session) return

    const { error } = await supabase.rpc('touch_last_seen')
    if (!error) localStorage.setItem(SEEN_KEY, String(Date.now()))
  } catch {
    // silencioso de proposito
  }
}

export default function Heartbeat() {
  useEffect(() => {
    ping()

    // Re-dispara ao logar / renovar token (respeitando o throttle)
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') ping()
    })

    // Re-dispara quando a aba volta ao foco (atividade real do usuario)
    const onVisible = () => {
      if (document.visibilityState === 'visible') ping()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      sub.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}