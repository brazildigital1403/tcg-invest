import type { CSSProperties } from 'react'
import type { Identificacao } from '@/lib/vendedorIdentificado'

/**
 * "Vendido por" (#470): nome e CNPJ ou CPF de quem vende, igual em todas as
 * telas de compra. Recebe a identificacao ja montada no servidor -- o CPF
 * chega aqui mascarado, menos no pedido de quem comprou.
 *
 * `separado`: linha fina em cima, para entrar no fim de um card que ja existe
 * (o da loja, no produto e no anuncio). Sem ele, e um bloco solto.
 */
export default function VendidoPor({
  ident,
  separado = false,
  nota,
  style,
}: {
  ident: Identificacao | null
  separado?: boolean
  nota?: string
  style?: CSSProperties
}) {
  if (!ident) return null
  return (
    <div style={{ ...(separado ? S.separado : S.solto), ...style }}>
      <span style={S.rotulo}>Vendido por</span>
      <span style={S.nome}>{ident.nome}</span>
      {ident.documento && <span style={S.doc}>{ident.documento}</span>}
      {nota && <span style={S.nota}>{nota}</span>}
    </div>
  )
}

const base: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }

const S: Record<string, CSSProperties> = {
  separado: { ...base, borderTop: '1px solid var(--bx-border)', marginTop: 12, paddingTop: 11 },
  solto: {
    ...base, background: 'var(--bx-bg-elev)', border: '1px solid var(--bx-border)',
    borderRadius: 12, padding: '11px 14px',
  },
  rotulo: { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--bx-text-3)' },
  nome: { fontSize: 13.5, fontWeight: 700, color: 'var(--bx-text)', overflowWrap: 'anywhere' },
  doc: { fontSize: 12.5, color: 'var(--bx-text-2)', fontVariantNumeric: 'tabular-nums' },
  nota: { fontSize: 11.5, color: 'var(--bx-text-3)', lineHeight: 1.45, marginTop: 2 },
}
