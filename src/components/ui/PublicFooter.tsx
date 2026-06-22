'use client'

/**
 * Footer público único — usado em todas as páginas sem AppLayout.
 *
 * Botão "Fale conosco" abre o ContactModal global via hook (não navega).
 * Demais links são âncoras normais.
 *
 * Uso:
 *
 *   import PublicFooter from '@/components/ui/PublicFooter'
 *
 *   <PublicFooter />
 *
 * Requer que <ContactModalProvider> esteja montado em algum ancestral
 * (já está no layout root).
 */

import { useContactModal } from './ContactModalProvider'

interface Props {
  /** Quando true, esconde a borda superior (útil em páginas curtas). Default: false */
  hideTopBorder?: boolean
}

export default function PublicFooter({ hideTopBorder = false }: Props) {
  const { openContactModal } = useContactModal()

  return (
    <footer
      style={{
        background: '#080a0f',
        borderTop: hideTopBorder ? 'none' : '1px solid rgba(255,255,255,0.06)',
        padding: '40px 24px',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.25)',
        fontSize: 13,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <button
          onClick={openContactModal}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 13,
            cursor: 'pointer',
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          Fale conosco
        </button>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
        <a
          href="/sobre"
          style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontSize: 13 }}
        >
          Sobre
        </a>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
        <a
          href="/faq"
          style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontSize: 13 }}
        >
          FAQ
        </a>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
        <a
          href="/privacidade"
          style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontSize: 13 }}
        >
          Privacidade
        </a>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
        <a
          href="/termos"
          style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontSize: 13 }}
        >
          Termos de uso
        </a>
      </div>
      <p style={{ margin: 0 }}>
        © 2026 <strong>Bynx</strong> · Feito para colecionadores brasileiros de Pokémon TCG
      </p>
    </footer>
  )
}
