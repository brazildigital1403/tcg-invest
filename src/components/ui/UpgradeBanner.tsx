'use client'

/**
 * Banner de upgrade das telas de Colecao e Mercado.
 *
 * ★ REESCRITO EM 20/09/2026 pela skill bynx-ui. O que estava errado:
 *   - cor cravada em hex (#f59e0b / #ef4444 / rgba(245,158,11,...)): nao herdava
 *     o acento da loja e nao sobrevive ao tema claro dormente do globals.css;
 *   - botao de 31px de altura (padding 9px) num publico majoritariamente mobile,
 *     contra os 44px da regra da casa;
 *   - nenhum motion, e nenhum respeito a prefers-reduced-motion;
 *   - texto sobre o gradiente em '#000' solto, nao no token --bx-brand-ink;
 *   - dois precos ERRADOS: o anual de R$ 249 anunciado como "R$ 14,91/mes"
 *     (e 20,75) e como "2 MESES GRATIS" (sao ~3). Agora tudo sai de plan.ts;
 *   - dois botoes competindo e nenhuma saida para comparar planos.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { IconArrowRight, IconWarning } from '@/components/ui/Icons'
import { supabase } from '@/lib/supabaseClient'
import { getUserPlan } from '@/lib/isPro'
import { PLAN_PRECOS } from '@/lib/plan'

// Precos de plan.ts. A mesma conta escrita a mao em dois lugares sempre diverge
// de um dos dois -- foi exatamente o que aconteceu com o "R$ 14,91/mes".
const MENSAL = PLAN_PRECOS.pro.mensal
const ANUAL = PLAN_PRECOS.pro_anual.anual
const MESES_GRATIS = Math.floor((MENSAL * 12 - ANUAL) / MENSAL)
const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

// Cadeado: nao existe em Icons.tsx. SVG outline inline, no mesmo estilo dos 54.
function IconLock({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 20 20' fill='none' aria-hidden='true'>
      <rect x='4' y='9' width='12' height='8' rx='1.6' stroke='currentColor' strokeWidth='1.5' />
      <path d='M7 9V6.5a3 3 0 016 0V9' stroke='currentColor' strokeWidth='1.5' />
    </svg>
  )
}

interface Props {
  tipo: 'cartas' | 'marketplace'
  /** Quantas cartas (ou anuncios) a pessoa ja tem. Vira a prova antes da oferta. */
  quantidade?: number
}

export default function UpgradeBanner({ tipo, quantidade }: Props) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  const [shouldRender, setShouldRender] = useState<boolean | null>(null)

  useEffect(() => {
    // Auto-protecao: mesmo se o caller esquecer de checar, este componente
    // NUNCA renderiza para Pro nem para trial ativo. Defesa em camadas.
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setShouldRender(false); return }

      const planInfo = await getUserPlan(user.id)
      if (planInfo.isPro) { setShouldRender(false); return }

      if (planInfo.trialDaysLeft > 0 && planInfo.trialDaysLeft <= 2) {
        setTrialDaysLeft(planInfo.trialDaysLeft)
      }
      setShouldRender(true)
    }
    init()
  }, [])

  if (shouldRender === null) return null
  if (!shouldRender) return null

  async function handleCheckout() {
    setErro('')
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setErro('Sua sessão expirou. Entre de novo para continuar.')
        setLoading(false)
        return
      }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plano: 'mensal' }),
      })
      const data = await res.json()
      if (!res.ok || !data?.url) {
        // Era um alert() do navegador. Erro de pagamento merece ficar na tela.
        setErro(data?.error || 'Não foi possível abrir o pagamento agora. Tente de novo em instantes.')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setErro('Não foi possível abrir o pagamento agora. Tente de novo em instantes.')
      setLoading(false)
    }
  }

  const urgente = trialDaysLeft !== null

  // A prova vem antes da oferta: o numero que a pessoa ja construiu.
  const titulo = tipo === 'marketplace'
    ? <>Você chegou ao limite de <span style={S.amt}>3 anúncios</span> ativos.</>
    : quantidade && quantidade > 0
      ? <>Você já catalogou <span style={S.amt}>{quantidade} carta{quantidade !== 1 ? 's' : ''}</span> na Bynx.</>
      : <>Sua coleção está começando.</>

  const descricao = tipo === 'marketplace'
    ? 'No Pro os anúncios são ilimitados, e a carta que você quer vender aparece para todo mundo.'
    : urgente
      ? 'O que sai do ar é a câmera, o dashboard e a exportação. Assine para não perder o ritmo.'
      : 'No Pro, a câmera faz esse trabalho: aponte para a carta e ela entra com nome, variante e preço.'

  const travados = tipo === 'marketplace'
    ? ['Anúncios ilimitados', 'Cartas ilimitadas', 'Scan com IA']
    : ['Scan com IA', 'Cartas ilimitadas', 'Exportar CSV e PDF']

  return (
    <div style={S.wrap}>
      {urgente && (
        <div style={S.urg}>
          <IconWarning size={15} color='var(--bx-red)' />
          <span>
            <strong style={S.urgStrong}>
              Seu trial Pro termina em {trialDaysLeft} dia{trialDaysLeft !== 1 ? 's' : ''}.
            </strong>{' '}
            Depois disso o Scan para.
          </span>
        </div>
      )}

      <div style={S.top}>
        <p style={S.titulo}>{titulo}</p>
        <p style={S.desc}>{descricao}</p>

        <div style={S.chips}>
          {travados.map(t => (
            <span key={t} style={S.chip}><IconLock /> {t}</span>
          ))}
        </div>
      </div>

      <div style={S.actions}>
        <div style={S.row}>
          <button
            onClick={handleCheckout}
            disabled={loading}
            className='bx-upg-cta'
            style={{ ...S.btnPrimary, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.75 : 1 }}
          >
            {loading ? 'Abrindo...' : (
              <>
                {urgente ? 'Manter o Pro' : 'Assinar Pro'} · {brl(MENSAL)}
                <IconArrowRight size={15} color='currentColor' />
              </>
            )}
          </button>
          <Link href='/planos' className='bx-upg-ghost' style={S.btnGhost}>
            Comparar planos
          </Link>
        </div>

        <p style={S.foot}>
          No anual sai por {brl(ANUAL / 12)}/mês — <span style={S.save}>{MESES_GRATIS} meses grátis</span>
        </p>

        {erro && <p role='alert' style={S.erro}>{erro}</p>}
      </div>

      <style>{`
        .bx-upg-cta { transition: transform .15s ease, box-shadow .15s ease; }
        .bx-upg-cta:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 26px -12px rgba(var(--ac-1-rgb), 0.8); }
        .bx-upg-ghost { transition: border-color .15s ease, color .15s ease, background .15s ease; }
        .bx-upg-ghost:hover { border-color: var(--bx-border-2); color: var(--bx-text); background: var(--bx-surface-2); }
        @media (prefers-reduced-motion: reduce) {
          .bx-upg-cta, .bx-upg-ghost { transition: none; }
          .bx-upg-cta:hover:not(:disabled) { transform: none; }
        }
      `}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    margin: '8px 0 24px',
    background: 'var(--bx-surface)',
    border: '1px solid var(--bx-border)',
    borderRadius: 16,
    overflow: 'hidden',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  urg: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 20px',
    background: 'rgba(239,68,68,0.07)',
    borderBottom: '1px solid rgba(239,68,68,0.2)',
    fontSize: 12.5, color: 'var(--bx-text-2)', lineHeight: 1.45,
  },
  urgStrong: { color: 'var(--bx-red)', fontWeight: 700 },
  top: {
    padding: '18px 20px 16px',
    background: 'radial-gradient(120% 140% at 0% 0%, rgba(var(--ac-1-rgb),0.10), transparent 62%)',
  },
  titulo: { fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.3, margin: '0 0 7px', color: 'var(--bx-text)' },
  amt: { background: 'var(--ac-grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  desc: { fontSize: 13.5, color: 'var(--bx-text-2)', lineHeight: 1.55, margin: 0 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, margin: '14px 0 0' },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 11.5, fontWeight: 600, color: 'var(--bx-text-2)',
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)',
    borderRadius: 100, padding: '5px 11px',
  },
  actions: {
    display: 'flex', flexDirection: 'column', gap: 9,
    padding: '14px 20px 16px',
    borderTop: '1px solid var(--bx-border)',
    background: 'var(--bx-surface)',
  },
  row: { display: 'flex', gap: 9, alignItems: 'stretch', flexWrap: 'wrap' },
  btnPrimary: {
    flex: 1, minWidth: 190, minHeight: 44,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)',
    border: 'none', borderRadius: 12, padding: '0 16px',
    fontFamily: 'inherit', fontWeight: 800, fontSize: 14,
  },
  btnGhost: {
    minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 16px', background: 'transparent', color: 'var(--bx-text-2)',
    border: '1px solid var(--bx-border)', borderRadius: 12,
    fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5,
    whiteSpace: 'nowrap', textDecoration: 'none',
  },
  foot: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 11.5, color: 'var(--bx-text-3)', margin: '2px 0 0', textAlign: 'center' },
  save: { color: 'var(--bx-green)', fontWeight: 700 },
  erro: {
    margin: '4px 0 0', fontSize: 12.5, color: 'var(--bx-red)', textAlign: 'center',
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 10, padding: '8px 12px', lineHeight: 1.45,
  },
}
