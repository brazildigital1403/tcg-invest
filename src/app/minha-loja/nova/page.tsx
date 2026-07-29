'use client'

import { CSSProperties, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import FormLoja, { LojaFormData } from '@/components/lojas/FormLoja'
import { IconStar } from '@/components/ui/Icons'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { LOJA_HOME } from '../[id]/_shared'

// ─── Página ───────────────────────────────────────────────────────────────────

export default function NovaLojaPage() {
  const router = useRouter()

  const [estado, setEstado] = useState<'loading' | 'pronto' | 'nao_logado'>('loading')
  const [userId, setUserId] = useState<string | null>(null)
  const [temOutrasLojas, setTemOutrasLojas] = useState(false)

  useEffect(() => {
    let alive = true

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!alive) return

      if (!user) {
        setEstado('nao_logado')
        router.replace('/?next=/minha-loja/nova')
        return
      }

      setUserId(user.id)

      // Verifica se user já tem outras lojas (pra mostrar botão "voltar")
      const { data: lojasCheck } = await supabase
        .from('lojas')
        .select('id')
        .eq('owner_user_id', user.id)
        .limit(1)

      if (!alive) return
      setTemOutrasLojas(!!lojasCheck && lojasCheck.length > 0)
      setEstado('pronto')
    }

    load()
    return () => { alive = false }
  }, [router])

  // ─── Handler ─────────────────────────────────────────────────

  function onLojaCriada(novaLoja: LojaFormData) {
    // Redireciona pra /minha-loja/[id] da loja recém-criada
    if (novaLoja.id) {
      router.replace(`/minha-loja/${novaLoja.id}`)
    } else {
      router.replace('/minha-loja')
    }
  }

  // ─── Render ──────────────────────────────────────────────────

  if (estado === 'loading' || estado === 'nao_logado') {
    return (
      <>
        <div style={S.loadingWrap}>
          <p style={S.loadingText}>Carregando…</p>
        </div>
      </>
    )
  }

  return (
    <>
      <div style={S.page}>
        {/* Sempre visivel (mesmo no mobile): a nav da loja fica escondida
            de proposito nesta tela (modo minimal do layout), entao a trilha
            e a UNICA saida quando o usuario ja tem outra loja e desiste. */}
        {temOutrasLojas && <Breadcrumb items={[LOJA_HOME, { name: 'Nova loja', href: '/minha-loja/nova' }]} />}

        {/* ─── Header ───────────────────────────────────── */}
        <header style={S.header}>
          <h1 style={S.title}>
            {temOutrasLojas ? 'Nova loja' : 'Cadastre sua loja'}
          </h1>
          <p style={S.subtitle}>
            {temOutrasLojas
              ? 'Adicione mais uma loja ao seu portfólio no Guia de Lojistas.'
              : 'Cadastre sua loja no Guia de Lojistas da Bynx e seja encontrado por milhares de colecionadores.'}
          </p>
        </header>

        {/* ─── Banner trial Pro ─────────────────────────── */}
        <BannerBeneficios />

        {/* ─── Form ─────────────────────────────────────── */}
        <FormLoja userId={userId!} onSaved={onLojaCriada} />
      </div>
    </>
  )
}

// ─── Banner ───────────────────────────────────────────────────────────────────

function BannerBeneficios() {
  return (
    <div style={S.banner}>
      <div style={S.bannerBadge}><IconStar size={12} /> Novo cadastro</div>
      <h3 style={S.bannerTitle}>14 dias de Pro grátis ao cadastrar sua loja</h3>
      <p style={S.bannerText}>
        Teste todos os recursos do plano Pro sem compromisso: até 5 fotos, redes sociais,
        especialidades ilimitadas e destaque na listagem. Ao fim do trial, sua loja
        continua ativa no plano Básico (gratuito para sempre).
      </p>
      <ul style={S.bannerList}>
        <li>✓ Sem cartão de crédito</li>
        <li>✓ Cancele quando quiser</li>
        <li>✓ Loja passa por aprovação do time Bynx antes de aparecer</li>
      </ul>
    </div>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  page: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '24px 20px 64px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },


  header: {
    paddingBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    margin: 0,
    letterSpacing: '-0.02em',
    color: '#f0f0f0',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    margin: '6px 0 0',
    lineHeight: 1.5,
  },

  loadingWrap: {
    minHeight: '60vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },

  // Banner trial
  banner: {
    background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(168,85,247,0.06))',
    border: '1px solid rgba(96,165,250,0.2)',
    borderRadius: 16,
    padding: 24,
  },
  bannerBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    background: 'rgba(96,165,250,0.15)',
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 6,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#f0f0f0',
    margin: '0 0 8px',
    letterSpacing: '-0.02em',
  },
  bannerText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.6,
    margin: 0,
  },
  bannerList: {
    listStyle: 'none',
    padding: 0,
    margin: '14px 0 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
}
