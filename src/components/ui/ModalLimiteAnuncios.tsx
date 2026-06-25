'use client'

import { IconMarketplace } from '@/components/ui/Icons'
import ModalUpgrade from '@/components/ui/ModalUpgrade'

interface Props {
  onClose: () => void
  onUpgrade: () => void
}

export default function ModalLimiteAnuncios({ onClose, onUpgrade }: Props) {
  return (
    <ModalUpgrade
      icon={<IconMarketplace size={26} color="#f59e0b" />}
      eyebrow="Limite de anúncios"
      title="Anuncie sem limite."
      sub="O plano Grátis permite 3 anúncios ativos. Plus e Pro liberam quantos você quiser."
      feats={[
        'Anúncios ilimitados no Marketplace',
        'Mais cartas à venda, mais vendas',
        'Preço de referência em cada anúncio',
      ]}
      pricePill="A partir de 14,90/mês no Plus"
      onClose={onClose}
      onUpgrade={onUpgrade}
    />
  )
}
