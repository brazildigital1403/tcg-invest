'use client'

// Landing pos-confirmacao de e-mail.
// O link do e-mail de confirmacao aponta pra ca (emailRedirectTo do signUp),
// carregando ?plan= e ?next=. Aqui:
//   - espera a sessao ser lida da URL (Supabase detectSessionInUrl),
//   - se o plano e pago (plus/mensal/anual) -> cria o Stripe Checkout e redireciona,
//   - senao -> manda pro destino (next) ou dashboard.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function sanitizeNext(raw: string | null): string {
  if (!raw) return '/dashboard-financeiro'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard-financeiro'
  return raw
}

export default function PosCadastro() {
  const router = useRouter()
  const [msg, setMsg] = useState('Ativando sua conta...')

  useEffect(() => {
    let cancel = false

    async function run() {
      const params = new URLSearchParams(window.location.search)
      const plan = params.get('plan') || ''
      const next = sanitizeNext(params.get('next'))
      const paid = plan === 'plus' || plan === 'mensal' || plan === 'anual'

      // Espera a sessao aparecer (o Supabase processa o token da URL de forma assincrona).
      let session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] = null
      for (let i = 0; i < 12 && !cancel; i++) {
        const { data } = await supabase.auth.getSession()
        if (data.session) { session = data.session; break }
        await new Promise(r => setTimeout(r, 300))
      }
      if (cancel) return

      // Sem sessao (link expirado, ja usado, etc.) -> pede login.
      if (!session) { router.replace('/?auth=login'); return }

      // Plano pago -> Stripe Checkout.
      if (paid && session.access_token) {
        setMsg('Redirecionando para o pagamento...')
        try {
          const res = await fetch('/api/stripe/checkout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ plano: plan }),
          })
          const d = await res.json()
          if (d.url) { window.location.href = d.url; return }
        } catch { /* cai no destino padrao abaixo */ }
      }

      // Free ou falha no checkout -> destino/dashboard.
      router.replace(next)
    }

    run()
    return () => { cancel = true }
  }, [router])

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080a0f', color: '#f0f0f0', fontFamily: "'DM Sans', system-ui, sans-serif", padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, margin: '0 auto 18px', border: '3px solid rgba(245,158,11,0.2)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'bxspin 0.8s linear infinite' }} />
        <p style={{ fontSize: 15, fontWeight: 700 }}>{msg}</p>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.42)', marginTop: 6 }}>Só um instante — não feche esta janela.</p>
      </div>
      <style>{'@keyframes bxspin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
