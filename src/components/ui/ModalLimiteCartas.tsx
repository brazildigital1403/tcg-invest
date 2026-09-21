'use client'

import { IconCollection } from '@/components/ui/Icons'
import ModalUpgrade from '@/components/ui/ModalUpgrade'
import { PLAN_PRECOS } from '@/lib/plan'

interface Props {
  onClose: () => void
  onUpgrade: () => void
  /** Limite do plano que bateu. 100 = Gratis, 500 = Plus. */
  limite?: number
}

const brl = (v: number) => v.toFixed(2).replace('.', ',')

// ★ Dizia sempre "100 cartas" (21/09/2026). Com o limite valendo no banco, o
// Plus que chega nas 500 via este mesmo modal -- e lia o numero do Gratis,
// com a oferta do proprio plano que ja paga. Agora o texto segue o limite.
export default function ModalLimiteCartas({ onClose, onUpgrade, limite = 100 }: Props) {
  const ehPlus = limite >= 500
  return (
    <ModalUpgrade
      icon={<IconCollection size={26} color="var(--ac-1)" />}
      eyebrow={ehPlus ? 'Limite do plano Plus' : 'Limite do plano Grátis'}
      title={`Sua coleção chegou a ${limite} cartas.`}
      sub={ehPlus
        ? 'As cartas que você já tem continuam todas lá. O Pro deixa a coleção sem limite.'
        : 'As cartas que você já tem continuam todas lá. O Plus libera até 500 e o Pro deixa ilimitado.'}
      feats={ehPlus
        ? [
            `Pro · cartas ilimitadas — ${brl(PLAN_PRECOS.pro.mensal)}/mês`,
            `Pro Anual · ${brl(PLAN_PRECOS.pro_anual.anual)}/ano`,
            'Tudo organizado, com valor em reais',
          ]
        : [
            `Plus · até 500 cartas — ${brl(PLAN_PRECOS.plus.mensal)}/mês`,
            `Pro · cartas ilimitadas — ${brl(PLAN_PRECOS.pro.mensal)}/mês`,
            'Tudo organizado, com valor em reais',
          ]}
      onClose={onClose}
      onUpgrade={onUpgrade}
    />
  )
}
