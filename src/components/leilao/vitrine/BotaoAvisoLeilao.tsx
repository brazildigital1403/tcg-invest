'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'

/** "Quero ser avisado do proximo leilao". Sem conta, abre o login e volta para a vitrine. */
export default function BotaoAvisoLeilao() {
  const { openLogin } = useAuthModal()
  const [ativo, setAtivo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token
      if (!token) return
      const r = await fetch('/api/leiloes/aviso', { headers: { Authorization: `Bearer ${token}` } })
      const j = await r.json().catch(() => null)
      if (vivo && r.ok && j?.ativo) setAtivo(true)
    }).catch(() => { /* sem estado: o botao continua disponivel */ })
    return () => { vivo = false }
  }, [])

  async function pedir() {
    setErro(null)
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) { openLogin({ next: '/leiloes' }); return }
    setEnviando(true)
    try {
      const r = await fetch('/api/leiloes/aviso', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.error || 'Não foi possível salvar. Tente de novo.'); return }
      setAtivo(true)
    } catch {
      setErro('A conexão falhou. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  if (ativo) return <p role="status" className="vt-aviso-ok">Pronto. Você recebe um e-mail quando o próximo leilão for marcado.</p>
  return (
    <>
      <button type="button" onClick={pedir} disabled={enviando} className="vt-cta" style={{ border: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
        {enviando ? 'Salvando...' : 'Quero ser avisado do próximo leilão'}
      </button>
      {erro && <p role="alert" className="vt-aviso-erro">{erro}</p>}
    </>
  )
}
