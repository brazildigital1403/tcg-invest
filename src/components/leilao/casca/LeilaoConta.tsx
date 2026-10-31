'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { IconClose, IconDashboard, IconHistory, IconLogout, IconShield, IconWallet } from '@/components/ui/Icons'
import { urlHome, urlMeusLances } from '@/lib/leilao-urls'

/**
 * Canto direito do cabecalho do Bynx Leiloes.
 *
 * Deslogado: "Entrar" abre o modal de login com `next` = a pagina atual com a
 * query (?aba=...). Sem `next`, o modal manda para /dashboard-financeiro e
 * tira a pessoa da ferramenta. Logado: avatar que abre a folha com Meus lances, Arremates a
 * pagar, Ir para o app Bynx e Sair. No pagamento, so "Pagamento protegido".
 *
 * A sessao vive no navegador (supabase-js); o servidor nao sabe quem olha.
 * Enquanto resolve, fica uma vaga do mesmo tamanho (sem pulo de layout).
 */

/** Destino de "Ir para o app Bynx" para quem esta logado. */
const APP_BYNX = '/dashboard-financeiro'

/** Mesmo seletor do trap de foco da folha de lance (LanceAoVivo). */
const FOCAVEIS = 'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

function iniciais(u: User): string {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  const nome = [meta.full_name, meta.name, meta.nome].find(v => typeof v === 'string' && v.trim()) as string | undefined
  const base = (nome ?? u.email ?? '').trim()
  if (!base) return '?'
  const partes = base.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  const duas = partes.length >= 2 ? partes[0][0] + partes[partes.length - 1][0] : base.slice(0, 2)
  return duas.toUpperCase()
}

function nomeExibido(u: User): string {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  const nome = [meta.full_name, meta.name, meta.nome].find(v => typeof v === 'string' && v.trim()) as string | undefined
  return nome?.trim() || 'Sua conta'
}

export default function LeilaoConta() {
  const pathname = usePathname() || ''
  const { openLogin } = useAuthModal()
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [aberta, setAberta] = useState(false)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const folhaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let vivo = true
    supabase.auth.getSession().then(({ data }) => {
      if (vivo) setUser(data.session?.user ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null))
    return () => {
      vivo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const fechar = useCallback((devolverFoco = true) => {
    setAberta(false)
    if (devolverFoco) setTimeout(() => botaoRef.current?.focus(), 0)
  }, [])

  // Trocou de pagina: a folha fecha sozinha. O clique no item tambem fecha
  // (fecharNoClique), porque o destino pode ser a propria pagina (Meus lances
  // estando em Meus lances, ou so a ancora #ml-a_pagar) e ai o pathname nao muda.
  const [rotaVista, setRotaVista] = useState(pathname)
  if (rotaVista !== pathname) {
    setRotaVista(pathname)
    setAberta(false)
  }

  useEffect(() => {
    if (!aberta) return
    const t = setTimeout(() => folhaRef.current?.focus(), 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        fechar()
        return
      }
      if (e.key !== 'Tab') return
      // Trap de foco (mesmo laco da LanceAoVivo): Tab e Shift+Tab ciclam dentro da folha.
      const raiz = folhaRef.current
      if (!raiz) return
      const focaveis = Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
        el => el.getClientRects().length > 0
      )
      if (!focaveis.length) {
        e.preventDefault()
        raiz.focus()
        return
      }
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      const ativo = document.activeElement as HTMLElement | null
      const dentro = !!ativo && raiz.contains(ativo) && ativo !== raiz
      if (e.shiftKey && (!dentro || ativo === primeiro)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (!dentro || ativo === ultimo)) {
        e.preventDefault()
        primeiro.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
    }
  }, [aberta, fechar])

  const fecharNoClique = () => fechar(false)

  async function sair() {
    setAberta(false)
    try {
      await supabase.auth.signOut()
    } finally {
      // Recarrega a pagina atual: a ferramenta segue aberta, agora deslogada.
      window.location.reload()
    }
  }

  if (pathname.endsWith('/pagar')) {
    return (
      <span className="lc-protegido">
        <IconShield size={14} />
        Pagamento protegido
      </span>
    )
  }

  if (user === undefined) return <span className="lc-vaga" aria-hidden />

  if (!user) {
    return (
      <button type="button" className="lc-entrar" onClick={() => openLogin({ next: (pathname || urlHome()) + window.location.search })}>
        Entrar
      </button>
    )
  }

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        className="lc-avatar-btn"
        aria-haspopup="dialog"
        aria-expanded={aberta}
        aria-label="Sua conta"
        onClick={() => setAberta(a => !a)}
      >
        <span className="lc-avatar" aria-hidden>{iniciais(user)}</span>
      </button>

      {aberta && (
        <div
          className="lc-folha-fundo"
          onClick={e => {
            if (e.target === e.currentTarget) fechar()
          }}
        >
          <div ref={folhaRef} className="lc-folha" role="dialog" aria-modal="true" aria-label="Sua conta" tabIndex={-1}>
            <div className="lc-folha-topo">
              <span className="lc-avatar" aria-hidden>{iniciais(user)}</span>
              <span className="lc-folha-nome">
                {nomeExibido(user)}
                {user.email && <span className="lc-folha-email">{user.email}</span>}
              </span>
              <button type="button" className="lc-fechar" aria-label="Fechar" onClick={() => fechar()}>
                <IconClose size={18} />
              </button>
            </div>
            <Link href={urlMeusLances()} prefetch={false} className="lc-item" onClick={fecharNoClique}>
              <IconHistory size={18} />
              Meus lances
            </Link>
            <Link href={urlMeusLances('pagar')} prefetch={false} className="lc-item" onClick={fecharNoClique}>
              <IconWallet size={18} />
              Arremates a pagar
            </Link>
            <Link href={APP_BYNX} prefetch={false} className="lc-item" onClick={fecharNoClique}>
              <IconDashboard size={18} />
              Ir para o app Bynx
            </Link>
            <div className="lc-sep" />
            <button type="button" className="lc-item lc-item-sair" onClick={sair}>
              <IconLogout size={18} />
              Sair
            </button>
          </div>
        </div>
      )}
    </>
  )
}
