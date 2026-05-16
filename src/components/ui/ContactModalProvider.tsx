'use client'

/**
 * Provider global do modal "Fale conosco".
 *
 * Vive no layout root (src/app/layout.tsx) e disponibiliza um hook
 * `useContactModal()` que qualquer componente cliente pode usar pra abrir
 * o modal de qualquer lugar do app.
 *
 * Uso:
 *
 *   import { useContactModal } from '@/components/ui/ContactModalProvider'
 *
 *   const { openContactModal } = useContactModal()
 *   <button onClick={openContactModal}>Fale conosco</button>
 *
 * Padrão idêntico ao AuthModalProvider (S31).
 */

import { createContext, useCallback, useContext, useState, ReactNode } from 'react'
import ContactModal from './ContactModal'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ContactModalContextValue {
  openContactModal: () => void
  closeContactModal: () => void
  isContactOpen: boolean
}

const ContactModalContext = createContext<ContactModalContextValue | null>(null)

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useContactModal(): ContactModalContextValue {
  const ctx = useContext(ContactModalContext)
  if (!ctx) {
    // Fallback no-op pra SSR / componentes fora do Provider.
    return {
      openContactModal: () => {},
      closeContactModal: () => {},
      isContactOpen: false,
    }
  }
  return ctx
}

// ─── Provider ────────────────────────────────────────────────────────────────

export default function ContactModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openContactModal  = useCallback(() => setIsOpen(true),  [])
  const closeContactModal = useCallback(() => setIsOpen(false), [])

  const value: ContactModalContextValue = {
    openContactModal,
    closeContactModal,
    isContactOpen: isOpen,
  }

  return (
    <ContactModalContext.Provider value={value}>
      {children}
      {isOpen && <ContactModal onClose={closeContactModal} />}
    </ContactModalContext.Provider>
  )
}
