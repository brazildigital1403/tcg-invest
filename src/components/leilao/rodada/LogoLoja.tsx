import Image from 'next/image'
import type { CSSProperties } from 'react'

/** Logo da loja, ou a inicial do nome num quadrado (sem logo cadastrado). */
export default function LogoLoja({ nome, logoUrl, tam }: { nome: string; logoUrl: string | null; tam: number }) {
  const base: CSSProperties = { width: tam, height: tam, flex: `0 0 ${tam}px`, borderRadius: 10, objectFit: 'cover' }
  if (logoUrl) return <Image src={logoUrl} alt="" width={tam} height={tam} sizes={`${tam}px`} style={base} />
  return (
    <span
      aria-hidden
      style={{
        ...base, display: 'grid', placeItems: 'center', background: 'var(--bx-surface-3)',
        border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)', fontWeight: 800, fontSize: Math.round(tam * 0.34),
      }}
    >
      {(nome.trim().charAt(0) || '?').toLocaleUpperCase('pt-BR')}
    </span>
  )
}
