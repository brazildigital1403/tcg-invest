'use client'

/**
 * Lado interativo da /planos.
 *
 * ★ POR QUE EXISTE (20/09/2026). Ate aqui o preco da Bynx nao tinha endereco:
 * ele morava numa ancora `#planos` na setima secao da home, sem link no header,
 * no rodape ou em nenhum item de menu do app. Nove URLs obvias (/planos,
 * /precos, /pro, /assinar...) devolviam 404, entao nao dava pra mandar ninguem
 * direto pra oferta -- nem por link, nem por anuncio, nem pelo Google.
 *
 * ★ E resolve a segunda quebra: os CTAs de plano da home nao passam `next`,
 * entao quem JA ESTAVA LOGADO e clicava em "Assinar Pro" recebia o formulario
 * de cadastro na cara. Aqui o clique decide pelo estado real da sessao:
 * logado vai pro checkout, deslogado abre o cadastro ja com o plano escolhido.
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { CardsPlanos, TabelaPlanos, type PlanoTier } from '@/components/ui/PlanosBlocos'

// tier da UI -> nome do plano que /api/stripe/checkout entende
const PLANO_CHECKOUT: Record<Exclude<PlanoTier, 'free'>, 'plus' | 'mensal' | 'anual'> = {
  plus: 'plus',
  pro: 'mensal',
  pro_anual: 'anual',
}

export default function PlanosClient() {
  const { openSignup } = useAuthModal()
  const [logado, setLogado] = useState<boolean | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState<PlanoTier | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLogado(!!data.session?.user))
  }, [])

  async function selecionar(tier: PlanoTier) {
    setErro('')

    // Deslogado: abre o cadastro com o plano ja escolhido. O AuthModal leva o
    // `plan` ate o pos-cadastro, que manda pro checkout no fim.
    if (!logado) {
      openSignup({ plan: tier === 'free' ? 'free' : PLANO_CHECKOUT[tier], next: '/minha-colecao' })
      return
    }

    // Logado no Free: nao ha o que cobrar, so leva pra colecao.
    if (tier === 'free') {
      window.location.href = '/minha-colecao'
      return
    }

    setCarregando(tier)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        // A sessao venceu entre o load e o clique.
        openSignup({ plan: PLANO_CHECKOUT[tier], next: '/planos' })
        setCarregando(null)
        return
      }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plano: PLANO_CHECKOUT[tier] }),
      })
      const data = await res.json()
      if (!res.ok || !data?.url) {
        setErro(data?.error || 'Não foi possível abrir o pagamento agora. Tente de novo em instantes.')
        setCarregando(null)
        return
      }
      window.location.href = data.url
    } catch {
      setErro('Não foi possível abrir o pagamento agora. Tente de novo em instantes.')
      setCarregando(null)
    }
  }

  return (
    <>
      <CardsPlanos onSelectPlan={selecionar} loggedIn={!!logado} />

      {carregando && (
        <p style={{ marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
          Abrindo o pagamento...
        </p>
      )}
      {erro && (
        <p
          role="alert"
          style={{
            marginTop: 16, fontSize: 13, color: '#ef4444', textAlign: 'center',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 12, padding: '10px 14px',
          }}
        >
          {erro}
        </p>
      )}

      <div style={{ marginTop: 40 }}>
        <TabelaPlanos onSelectPlan={selecionar} />
      </div>
    </>
  )
}
