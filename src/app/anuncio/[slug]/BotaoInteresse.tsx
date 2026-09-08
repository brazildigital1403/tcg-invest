'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { manifestarInteresse } from '@/lib/marketplaceInteresse'
import { useAppModal } from '@/components/ui/useAppModal'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { IconChat } from '@/components/ui/Icons'

/**
 * "Tenho interesse" da pagina publica do anuncio.
 *
 * ★ POR QUE ESTE BOTAO EXISTE (07/09/2026, decisao do Du): anuncio de
 * COLECIONADOR nao tem como ser comprado na hora -- sem loja nao ha Connect,
 * nem frete, nem rastreio. Mostrar "Comprar agora" ali prometia o que quebra
 * no fim. Agora carta de loja compra e carta de colecionador negocia, e a
 * diferenca fica visivel: e o que da motivo pro vendedor abrir a loja dele.
 *
 * ★ E POR QUE A CONVERSA ABRE AQUI MESMO. No /marketplace o fluxo termina em
 * `router.push('/marketplace?conversa=ID')` -- quem estava na pagina da carta
 * era jogado de volta pro app logado e perdia o contexto. Aqui a mesma
 * query entra na URL ATUAL (`replace`, sem recarregar), e o `ChatDock`
 * montado nesta pagina abre sozinho. Um clique, mesma tela.
 */
export default function BotaoInteresse({
  anuncioId,
  nomeCarta,
  preco,
}: {
  anuncioId: string
  nomeCarta: string
  preco: string
}) {
  const router = useRouter()
  const { showConfirm, showAlert } = useAppModal()
  const { openLogin } = useAuthModal()
  const [carregando, setCarregando] = useState(false)

  async function onClick() {
    if (carregando) return
    const { data } = await supabase.auth.getUser()
    if (!data?.user) {
      // Sem sessao: abre o login NA PROPRIA PAGINA em vez de mandar pra /login
      // e perder o anuncio que a pessoa estava vendo.
      openLogin()
      return
    }

    const ok = await showConfirm({
      message: `Deseja manifestar interesse em "${nomeCarta}" por ${preco}?`,
      confirmLabel: 'Sim, tenho interesse',
      description: 'Você vai conversar com o vendedor aqui pela plataforma.',
    })
    if (!ok) return

    setCarregando(true)
    const deuCerto = await manifestarInteresse(anuncioId)
    setCarregando(false)

    if (!deuCerto) {
      showAlert('Não consegui registrar seu interesse. A carta pode já estar reservada.', 'warning')
      return
    }
    // `replace` e nao `push`: o estado "com conversa aberta" nao merece uma
    // entrada no historico -- o voltar tem que sair do anuncio, nao fechar o
    // chat.
    router.replace(`?conversa=${anuncioId}`, { scroll: false })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={carregando}
      className="bx-compra-cta"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: '100%', minHeight: 48, boxSizing: 'border-box', padding: '12px 20px',
        background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)',
        fontWeight: 800, fontSize: 15, borderRadius: 12,
        border: 'none', cursor: carregando ? 'wait' : 'pointer',
        fontFamily: 'inherit', opacity: carregando ? 0.7 : 1,
      }}
    >
      <IconChat size={18} /> {carregando ? 'Enviando...' : 'Tenho interesse'}
    </button>
  )
}
