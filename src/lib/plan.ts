// src/lib/plan.ts
// Fonte UNICA de verdade dos planos da Bynx.
// PURO: nao importa supabase nem nada de DB -> usavel no server e no client, e testavel.
// Tiers canonicos: free | plus | pro | pro_anual
// Aliases legados aceitos no campo users.plano: 'mensal' -> pro, 'anual' -> pro_anual.

export type PlanTier = 'free' | 'plus' | 'pro' | 'pro_anual'

export interface PlanCaps {
  tier: PlanTier
  label: string
  isPaid: boolean              // plus, pro, pro_anual
  isPro: boolean               // features Pro de verdade: pro, pro_anual (e trial)
  limiteCartas: number         // soft cap de cartas na colecao
  limitePastas: number         // pastas (fichario)
  limiteAnuncios: number       // anuncios ativos no marketplace
  podeDashboard: boolean       // tela Dashboard
  pokedexCompleta: boolean     // Pokedex LOGADA in-app (publica nao e afetada)
  podeExportar: boolean        // exportar PDF / CSV
  scansMes: number             // creditos de Scan IA por mes
  separadoresLiberados: boolean// separadores liberados (vs avulso)
  masterSetsLiberados: boolean // todos os Master Sets liberados (vs avulso)
}

// Precos de referencia (centralizados; a UI e o Stripe leem daqui)
export const PLAN_PRECOS = {
  plus:      { mensal: 14.90 },
  pro:       { mensal: 29.90 },
  pro_anual: { anual:  249.00 },
} as const

const MATRIZ: Record<PlanTier, Omit<PlanCaps, 'tier'>> = {
  free: {
    label: 'Grátis',
    isPaid: false, isPro: false,
    limiteCartas: 100, limitePastas: 1, limiteAnuncios: 3,
    podeDashboard: false, pokedexCompleta: false, podeExportar: false,
    scansMes: 0, separadoresLiberados: false, masterSetsLiberados: false,
  },
  plus: {
    label: 'Plus',
    isPaid: true, isPro: false,
    limiteCartas: 500, limitePastas: Infinity, limiteAnuncios: Infinity,
    podeDashboard: true, pokedexCompleta: true, podeExportar: false,
    scansMes: 0, separadoresLiberados: false, masterSetsLiberados: false,
  },
  pro: {
    label: 'Pro',
    isPaid: true, isPro: true,
    limiteCartas: Infinity, limitePastas: Infinity, limiteAnuncios: Infinity,
    podeDashboard: true, pokedexCompleta: true, podeExportar: true,
    scansMes: 10, separadoresLiberados: true, masterSetsLiberados: false,
  },
  pro_anual: {
    label: 'Pro Anual',
    isPaid: true, isPro: true,
    limiteCartas: Infinity, limitePastas: Infinity, limiteAnuncios: Infinity,
    podeDashboard: true, pokedexCompleta: true, podeExportar: true,
    scansMes: 10, separadoresLiberados: true, masterSetsLiberados: true,
  },
}

// Normaliza o valor cru de users.plano (incl. aliases legados) -> tier canonico.
export function normalizeTier(plano: string | null | undefined): PlanTier {
  switch ((plano || '').toLowerCase().trim()) {
    case 'plus': return 'plus'
    case 'pro':
    case 'mensal': return 'pro'
    case 'pro_anual':
    case 'anual': return 'pro_anual'
    default: return 'free'
  }
}

// Capabilities de um tier.
export function getPlanCaps(tier: PlanTier): PlanCaps {
  return { tier, ...MATRIZ[tier] }
}

export interface ResolvedPlan {
  caps: PlanCaps
  tier: PlanTier
  isTrial: boolean
  trialDaysLeft: number
  isPaid: boolean
  isPro: boolean
}

// Resolve a partir de uma linha crua de users.
// Regra do trial reverso: durante o trial ativo, acesso Pro COMPLETO (caps de 'pro').
export function resolvePlan(row: {
  is_pro?: boolean | null
  plano?: string | null
  pro_expira_em?: string | null
  trial_expires_at?: string | null
} | null | undefined): ResolvedPlan {
  const now = Date.now()
  const tier = normalizeTier(row?.plano)
  const hasExpiry = !!row?.pro_expira_em
  const proValido = hasExpiry ? new Date(row!.pro_expira_em as string).getTime() > now : false
  // Assinatura ativa: COM expiry vale a data (Stripe sempre seta, inclusive Plus, que
  // tem is_pro=false); SEM expiry vale a flag is_pro (grant manual via admin). Assim,
  // plano "sujo" (ex.: 'mensal' sem expiry e sem is_pro, deixado por revoke incompleto)
  // NAO conta como pago.
  const assinaturaAtiva = hasExpiry ? proValido : !!row?.is_pro

  // 1) Plano pago ativo (plus, pro, pro_anual)
  if (tier !== 'free' && assinaturaAtiva) {
    const caps = getPlanCaps(tier)
    return { caps, tier, isTrial: false, trialDaysLeft: 0, isPaid: true, isPro: caps.isPro }
  }

  // 2) Compat: is_pro marcado mas plano nao-canonico (free/null) -> trata como pro
  if (assinaturaAtiva && !!row?.is_pro && tier === 'free') {
    const caps = getPlanCaps('pro')
    return { caps, tier: 'pro', isTrial: false, trialDaysLeft: 0, isPaid: true, isPro: true }
  }

  // 3) Trial reverso ativo -> Pro completo
  if (row?.trial_expires_at) {
    const exp = new Date(row.trial_expires_at).getTime()
    if (exp > now) {
      const daysLeft = Math.ceil((exp - now) / 86400000)
      const caps = getPlanCaps('pro')
      return { caps, tier: 'pro', isTrial: true, trialDaysLeft: daysLeft, isPaid: false, isPro: true }
    }
  }

  // 4) Free
  const caps = getPlanCaps('free')
  return { caps, tier: 'free', isTrial: false, trialDaysLeft: 0, isPaid: false, isPro: false }
}
