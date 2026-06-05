// Rotulo de set para exibicao: troca o prefixo "Liga BR" por "Set".
// "Liga BR — MEP" -> "Set MEP" ; "Liga BR" -> "Set" ; demais nomes inalterados.
export function setLabel(s?: string | null): string {
  if (!s) return ''
  return s.replace(/^Liga BR\s*[—-]\s*/i, 'Set ').replace(/^Liga BR\b/i, 'Set')
}
