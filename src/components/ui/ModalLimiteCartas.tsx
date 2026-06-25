'use client'

import { IconCollection } from '@/components/ui/Icons'
import ModalUpgrade from '@/components/ui/ModalUpgrade'

interface Props {
  onClose: () => void
  onUpgrade: () => void
}

export default function ModalLimiteCartas({ onClose, onUpgrade }: Props) {
  return (
    <ModalUpgrade
      icon={<IconCollection size={26} color="#f59e0b" />}
      eyebrow="Limite do plano grátis"
      title="Sua coleção chegou a 100 cartas."
      sub="Continue guardando tudo sem parar — o Plus libera até 500 e o Pro deixa ilimitado."
      feats={[
        'Plus · até 500 cartas — 14,90/mês',
        'Pro · cartas ilimitadas — 29,90/mês',
        'Tudo organizado, com valor em reais',
      ]}
      onClose={onClose}
      onUpgrade={onUpgrade}
    />
  )
}
