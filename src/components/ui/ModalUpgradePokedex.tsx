'use client'

import { IconPokedex } from '@/components/ui/Icons'
import ModalUpgrade from '@/components/ui/ModalUpgrade'

interface Props {
  pokemonName: string
  onClose: () => void
  onUpgrade: () => void
}

export default function ModalUpgradePokedex({ pokemonName, onClose, onUpgrade }: Props) {
  return (
    <ModalUpgrade
      icon={<IconPokedex size={26} color="#f59e0b" />}
      eyebrow="Pokédex completa"
      title={`Veja todas as cartas do ${pokemonName}.`}
      sub="Abra qualquer Pokémon e veja todas as variantes com preço em reais."
      feats={[
        'Detalhe e cotação de cada carta',
        `Informações sobre o ${pokemonName}`,
        'Normal, Foil, Reverse e Promo',
        'Acompanhe o valor da sua coleção',
      ]}
      pricePill="A partir de 14,90/mês no Plus"
      onClose={onClose}
      onUpgrade={onUpgrade}
    />
  )
}
