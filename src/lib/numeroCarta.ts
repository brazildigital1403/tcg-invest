/**
 * Numero da carta sobre o total do set, no formato em que a carta e impressa.
 *
 * O total sai com o MESMO numero de digitos do numero: a carta japonesa (e a
 * inglesa moderna) imprime "001/053", e o catalogo guardava "001" com total 53,
 * entao a tela mostrava "001/53" (auditoria de sets, 14/10/2026). Numero sem
 * zero a esquerda continua como esta ("1/102"). Galeria repete as letras
 * (TG01/TG30, GG59/GG70); promo com hifen (SWSH039, 076/SV-P) nao mexe.
 */
export function totalNoFormatoDoNumero(numero: string, total: number | string): string {
  const t = String(total)
  if (!/^\d+$/.test(t)) return t
  if (/^\d+$/.test(numero)) return t.padStart(numero.length, '0')
  // Galerias (TG01/TG30, GG59/GG70): a carta repete as letras no total.
  const galeria = numero.match(/^([A-Z]{1,3})(\d+)$/)
  if (galeria) return galeria[1] + t.padStart(galeria[2].length, '0')
  return t
}

export function numeroSobreTotal(numero: string | number, total: number | string | null | undefined): string {
  const n = String(numero)
  if (total === null || total === undefined || total === '') return n
  return `${n}/${totalNoFormatoDoNumero(n, total)}`
}
