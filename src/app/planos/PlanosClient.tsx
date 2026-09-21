'use client'

/**
 * Lado interativo da /planos.
 *
 * ★ POR QUE EXISTE (20/09/2026). Ate 20/09 o preco da Bynx nao tinha URL: ele
 * morava numa ancora `#planos` na setima secao da home, sem link no header, no
 * rodape ou em nenhum item de menu. Nove enderecos obvios davam 404.
 *
 * ★ E resolve a segunda quebra: os CTAs de plano da home nao passam `next`,
 * entao quem JA ESTAVA LOGADO e clicava em "Assinar Pro" recebia o formulario
 * de cadastro na cara. Aqui o clique decide pelo estado real da sessao.
 *
 * ★ REDESENHO DE 20/09 (opcao 1, escolhida pelo Du). O toggle Mensal|Anual
 * entrou porque o desconto do anual existia calculado e escondido numa nota de
 * 11px: 9 das 19 paginas brasileiras auditadas mostram a economia em REAIS, e o
 * padrao de ticket baixo no Brasil e anunciar o anual como "12x de X".
 * Os cards ficaram 3 (e nao 4): o anual virou um estado do Pro, nao um tier
 * concorrente. A copy troca palavra fria (dashboard, portfolio) por palavra do
 * hobby -- "fichario" e a mais valiosa em PT-BR no nicho.
 */

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { PLAN_PRECOS } from '@/lib/plan'
import { IconArrowRight } from '@/components/ui/Icons'

const PLUS = PLAN_PRECOS.plus.mensal
const MENSAL = PLAN_PRECOS.pro.mensal
const ANUAL = PLAN_PRECOS.pro_anual.anual
const ECONOMIA = MENSAL * 12 - ANUAL
const MESES_GRATIS = Math.floor(ECONOMIA / MENSAL)

const brl = (v: number) => v.toFixed(2).replace('.', ',')
const brlInt = (v: number) => v.toFixed(0)

type Tier = 'free' | 'plus' | 'pro'
type Ciclo = 'mensal' | 'anual'

function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1, color: 'var(--ac-1)' }}>
      <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function Cross() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1, color: 'var(--bx-text-faint)' }}>
      <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function PlanosClient() {
  const { openSignup } = useAuthModal()
  const [ciclo, setCiclo] = useState<Ciclo>('anual')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState<Tier | null>(null)

  async function selecionar(tier: Tier) {
    setErro('')

    const { data: { session } } = await supabase.auth.getSession()
    const logado = !!session?.access_token

    if (tier === 'free') {
      if (logado) { window.location.href = '/minha-colecao'; return }
      openSignup({ plan: 'free', next: '/minha-colecao' })
      return
    }

    const plano = tier === 'plus' ? 'plus' : ciclo === 'anual' ? 'anual' : 'mensal'

    // Deslogado: abre o cadastro com o plano ja escolhido. O AuthModal leva o
    // `plan` ate o pos-cadastro, que manda pro checkout no fim.
    if (!logado) {
      openSignup({ plan: plano, next: '/minha-colecao' })
      return
    }

    setCarregando(tier)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ plano }),
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

  const anual = ciclo === 'anual'
  const precoPro = anual ? ANUAL / 12 : MENSAL

  return (
    <>
      {/* ── Toggle de ciclo ── */}
      <div style={S.toggleWrap}>
        <div style={S.toggle} role="group" aria-label="Ciclo de cobrança">
          <button
            onClick={() => setCiclo('mensal')}
            aria-pressed={!anual}
            style={{ ...S.tgBtn, ...(anual ? {} : S.tgOn) }}
          >
            Mensal
          </button>
          <button
            onClick={() => setCiclo('anual')}
            aria-pressed={anual}
            style={{ ...S.tgBtn, ...(anual ? S.tgOn : {}) }}
          >
            Anual <span style={S.eco}>economize R$ {brlInt(ECONOMIA)}</span>
          </button>
        </div>
        <p style={S.tgNota}>
          {anual
            ? `O Pro Anual sai por 12x de R$ ${brl(ANUAL / 12)} — cerca de ${MESES_GRATIS} meses grátis no ano.`
            : 'Sem fidelidade. Você cancela quando quiser.'}
        </p>
      </div>

      {/* ── Cards ── */}
      <div style={S.tiers}>
        {/* Grátis */}
        <div style={S.tier}>
          <p style={S.tname}>Grátis</p>
          <div style={S.tprice}><span style={S.num}>Grátis</span></div>
          <p style={S.tnote}>para sempre, sem cartão</p>
          <ul style={S.feats}>
            <li style={S.li}><Check /> Até 100 cartas na coleção</li>
            <li style={S.li}><Check /> Preços em reais do mercado brasileiro</li>
            <li style={S.li}><Check /> 1 pasta no fichário e perfil público</li>
            <li style={S.li}><Check /> 3 anúncios no Mercado</li>
            <li style={{ ...S.li, color: 'var(--bx-text-faint)' }}><Cross /> Sem Scan, sem exportar</li>
          </ul>
          <button onClick={() => selecionar('free')} style={{ ...S.btn, ...S.btnGhost }}>
            Começar grátis
          </button>
        </div>

        {/* Plus */}
        <div style={S.tier}>
          <p style={S.tname}>Plus</p>
          <div style={S.tprice}>
            <span style={S.cur}>R$</span><span style={S.num}>{brl(PLUS)}</span><span style={S.per}>/mês</span>
          </div>
          <p style={S.tnote}>para quem está crescendo a coleção</p>
          <ul style={S.feats}>
            <li style={S.pre}>Tudo do Grátis, e mais:</li>
            <li style={S.li}><Check /> <b>Scan com IA</b> — 100 scans por mês</li>
            <li style={S.li}><Check /> Até 500 cartas na coleção</li>
            <li style={S.li}><Check /> Quanto sua coleção vale, atualizado</li>
            <li style={S.li}><Check /> Pokédex completa</li>
            <li style={S.li}><Check /> Pastas do fichário e anúncios ilimitados</li>
          </ul>
          <button
            onClick={() => selecionar('plus')}
            disabled={carregando === 'plus'}
            style={{ ...S.btn, ...S.btnGhost, cursor: carregando === 'plus' ? 'wait' : 'pointer' }}
          >
            {carregando === 'plus' ? 'Abrindo...' : 'Assinar Plus'}
          </button>
        </div>

        {/* Pro */}
        <div style={{ ...S.tier, ...S.tierFeat }}>
          <div style={S.ribbon}>Mais escolhido</div>
          <p style={{ ...S.tname, color: 'var(--ac-1)' }}>Pro</p>
          <div style={S.tprice}>
            <span style={S.cur}>R$</span><span style={S.num}>{brl(precoPro)}</span><span style={S.per}>/mês</span>
          </div>
          <p style={S.tnote}>
            {anual ? `12x no anual · R$ ${brl(MENSAL)} no mensal` : `ou R$ ${brl(ANUAL / 12)}/mês no anual`}
          </p>
          <ul style={S.feats}>
            <li style={S.pre}>Tudo do Plus, e mais:</li>
            <li style={S.li}><Check /> <b>Scan com IA ilimitado</b></li>
            <li style={S.li}><Check /> Cartas ilimitadas</li>
            <li style={S.li}><Check /> Histórico de preço de cada carta</li>
            <li style={S.li}><Check /> Exportar em CSV e PDF</li>
            <li style={S.li}><Check /> Separadores de fichário liberados</li>
            {anual && <li style={S.li}><Check /> Master Sets e Páginas Lendárias</li>}
          </ul>
          <button
            onClick={() => selecionar('pro')}
            disabled={carregando === 'pro'}
            className="bx-planos-cta"
            style={{ ...S.btn, ...S.btnFill, cursor: carregando === 'pro' ? 'wait' : 'pointer' }}
          >
            {carregando === 'pro' ? 'Abrindo...' : <>Assinar Pro <IconArrowRight size={15} color="currentColor" /></>}
          </button>
        </div>
      </div>

      {erro && <p role="alert" style={S.erro}>{erro}</p>}

      <style>{`
        .bx-planos-cta { transition: transform .15s ease, box-shadow .15s ease; }
        .bx-planos-cta:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 28px -14px rgba(var(--ac-1-rgb), .9); }
        @media (prefers-reduced-motion: reduce) {
          .bx-planos-cta { transition: none; }
          .bx-planos-cta:hover:not(:disabled) { transform: none; }
        }
      `}</style>
    </>
  )
}

const S: Record<string, React.CSSProperties> = {
  toggleWrap: { textAlign: 'center', marginBottom: 28 },
  toggle: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)',
    borderRadius: 100, padding: 4,
  },
  tgBtn: {
    minHeight: 44, padding: '0 18px', borderRadius: 100, border: 'none',
    background: 'transparent', color: 'var(--bx-text-3)', fontFamily: 'inherit',
    fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 7,
    transition: 'background .15s ease, color .15s ease',
  },
  tgOn: { background: 'var(--bx-surface-3)', color: 'var(--bx-text)' },
  eco: {
    fontSize: 10.5, fontWeight: 800, color: 'var(--bx-green)',
    background: 'rgba(34,197,94,0.12)', borderRadius: 100, padding: '2px 7px',
  },
  tgNota: { fontSize: 12, color: 'var(--bx-text-3)', margin: '12px 0 0', lineHeight: 1.5 },

  tiers: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))', gap: 14, textAlign: 'left' },
  tier: {
    position: 'relative', background: 'var(--bx-surface)', border: '1px solid var(--bx-border)',
    borderRadius: 18, padding: '24px 20px 22px', display: 'flex', flexDirection: 'column', minWidth: 0,
  },
  tierFeat: {
    background: 'linear-gradient(180deg, rgba(var(--ac-1-rgb),0.07), rgba(14,17,23,0.6))',
    borderColor: 'rgba(var(--ac-1-rgb),0.5)',
    boxShadow: '0 0 0 1px rgba(var(--ac-1-rgb),0.22), 0 18px 50px -22px rgba(var(--ac-1-rgb),0.4)',
  },
  ribbon: {
    position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', fontSize: 10, fontWeight: 800,
    letterSpacing: '0.07em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: 100, whiteSpace: 'nowrap',
  },
  tname: { fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--bx-text-3)', margin: '0 0 12px' },
  tprice: { display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 2 },
  cur: { fontSize: 15, fontWeight: 700, color: 'var(--bx-text-3)' },
  num: { fontSize: 33, fontWeight: 900, letterSpacing: '-0.035em', lineHeight: 1 },
  per: { fontSize: 13, color: 'var(--bx-text-3)', fontWeight: 500 },
  tnote: { fontSize: 11.5, color: 'var(--bx-text-faint)', minHeight: 16, margin: '0 0 18px' },
  feats: { listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 9, flex: 1 },
  li: { display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.38, color: 'var(--bx-text-2)' },
  pre: { color: 'var(--bx-text-3)', fontSize: 12, fontWeight: 700 },
  btn: {
    minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '0 18px', borderRadius: 12, fontFamily: 'inherit', fontWeight: 800, fontSize: 14,
    border: '1px solid transparent', width: '100%',
  },
  btnGhost: { background: 'var(--bx-surface-2)', borderColor: 'var(--bx-border)', color: 'var(--bx-text-2)', fontWeight: 700, cursor: 'pointer' },
  btnFill: { background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', border: 'none' },
  erro: {
    marginTop: 18, fontSize: 13, color: 'var(--bx-red)', textAlign: 'center',
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 12, padding: '10px 14px',
  },
}
