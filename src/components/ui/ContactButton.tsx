'use client'

/**
 * Botao cliente "Fale conosco" que abre o ContactModal global (modal de opcoes).
 * Uso em paginas server (ex.: /sobre): <ContactButton label="..." />
 */

import { useContactModal } from '@/components/ui/ContactModalProvider'

export default function ContactButton({
  label = 'Fale conosco',
  style,
}: {
  label?: string
  style?: React.CSSProperties
}) {
  const { openContactModal } = useContactModal()
  return (
    <button
      onClick={openContactModal}
      style={{
        background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
        border: 'none',
        color: '#000',
        padding: '12px 28px',
        borderRadius: 12,
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {label}
    </button>
  )
}
