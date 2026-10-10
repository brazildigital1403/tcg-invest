// Regra de senha da Bynx = a regra configurada no Auth do Supabase (8+,
// minuscula, MAIUSCULA, numero e simbolo; senha vazada e recusada la).
// Uma fonte so: cadastro (AuthModal) e nova senha (/reset-password). Em
// 08/10/2026 a tela de nova senha tinha um medidor proprio mais frouxo,
// dizia 'Forte' para senha que o Auth recusava e escondia o 422 atras de
// 'O link pode ter expirado' (caso da Heloisa).
// Espelha a politica do Supabase Auth: 8+ chars com minuscula, maiuscula, numero e simbolo.
export function senhaChecks(s: string) {
  return {
    len: s.length >= 8,
    lower: /[a-z]/.test(s),
    upper: /[A-Z]/.test(s),
    num: /[0-9]/.test(s),
    sym: /[^a-zA-Z0-9]/.test(s),
  }
}
export function senhaValida(s: string) {
  const c = senhaChecks(s)
  return c.len && c.lower && c.upper && c.num && c.sym
}

/** Mensagem unica para a regra, usada no cadastro e na nova senha. */
export const SENHA_REGRA_MSG = 'Senha fraca. Use 8+ caracteres com maiúscula, minúscula, número e símbolo.'

/** O Auth do Supabase devolve estes textos quando a regra nao e cumprida. */
export function ehErroDeRegraDeSenha(msg: string) {
  return /should contain at least one character|password should|weak|easy to guess|pwned|known to be|leaked/i.test(msg || '')
}
