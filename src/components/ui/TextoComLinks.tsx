'use client'

/**
 * Renderiza texto livre com URL clicavel. Par do `textoComLinksHtml` (e-mail):
 * mesma segmentacao, mesma regra de link interno/externo.
 *
 * Usado na thread do ticket (/suporte/[id] e /admin/tickets/[id]) e na previa
 * do modal "Falar com o usuario". Quebra de linha e preservada pelo `pre-wrap`
 * de quem chama -- este componente so troca URL por <a>.
 */

import { segmentarLinks } from '@/lib/textoComLinks'

interface Props {
  texto: string
  /** Cor do link. Default: ambar do app. */
  cor?: string
}

export default function TextoComLinks({ texto, cor = '#f59e0b' }: Props) {
  const segs = segmentarLinks(texto)
  return (
    <>
      {segs.map((seg, i) =>
        seg.tipo === 'texto' ? (
          <span key={i}>{seg.valor}</span>
        ) : (
          <a
            key={i}
            href={seg.href}
            target={seg.interno ? undefined : '_blank'}
            rel={seg.interno ? undefined : 'noopener'}
            style={{
              color: cor, fontWeight: 600,
              textDecoration: 'underline', textDecorationColor: `${cor}66`, textUnderlineOffset: 3,
              wordBreak: 'break-all', transition: 'color 0.15s ease',
            }}
          >
            {seg.valor}
          </a>
        )
      )}
    </>
  )
}
