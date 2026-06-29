// Catalogo de graduadoras (constante no front -> render instantaneo no grid, sem query por carta).
// O banco guarda so o slug em user_cards.graduadora; cor/nome/flags vem daqui.

export interface Graduadora {
  slug: string
  nome: string        // nome completo (exibicao no modal)
  curto: string       // sigla (selo/slab)
  cor: string         // cor da marca (selo, moldura, brilho)
  temSubnota: boolean // exibe os 4 campos de subnota
  temBlackLabel: boolean
  pais: 'br' | 'intl'
}

export const GRADUADORAS: Graduadora[] = [
  // Internacionais
  { slug: 'psa',  nome: 'PSA · Professional Sports Authenticator', curto: 'PSA',  cor: '#e4002b', temSubnota: true,  temBlackLabel: false, pais: 'intl' },
  { slug: 'bgs',  nome: 'BGS · Beckett Grading Services',          curto: 'BGS',  cor: '#c8a04b', temSubnota: true,  temBlackLabel: true,  pais: 'intl' },
  { slug: 'cgc',  nome: 'CGC · Certified Guaranty Company',        curto: 'CGC',  cor: '#1f6fb2', temSubnota: true,  temBlackLabel: false, pais: 'intl' },
  { slug: 'ace',  nome: 'ACE Grading',                             curto: 'ACE',  cor: '#0ea5e9', temSubnota: true,  temBlackLabel: false, pais: 'intl' },
  { slug: 'ags',  nome: 'AGS · AI Grading',                        curto: 'AGS',  cor: '#64748b', temSubnota: true,  temBlackLabel: false, pais: 'intl' },
  { slug: 'tag',  nome: 'TAG · Technical Authentication & Grading', curto: 'TAG',  cor: '#52525b', temSubnota: true,  temBlackLabel: false, pais: 'intl' },
  // Nacionais
  { slug: 'mgs',  nome: 'MGS · ManaFix Grading System',            curto: 'MGS',  cor: '#8b5cf6', temSubnota: true,  temBlackLabel: false, pais: 'br' },
  { slug: 'capy', nome: 'Capy Grading',                            curto: 'Capy', cor: '#e0902a', temSubnota: true,  temBlackLabel: false, pais: 'br' },
  { slug: 'gba',  nome: 'GBA · Grupo Brasileiro de Autenticação',  curto: 'GBA',  cor: '#16a34a', temSubnota: false, temBlackLabel: false, pais: 'br' },
  { slug: 'tbn',  nome: 'TBN Grading',                             curto: 'TBN',  cor: '#ef4444', temSubnota: false, temBlackLabel: false, pais: 'br' },
]

export const GRADUADORA_MAP: Record<string, Graduadora> =
  Object.fromEntries(GRADUADORAS.map(g => [g.slug, g]))

// Tier nomeado a partir da graduadora + nota + black label.
export function tierNome(slug: string | null | undefined, nota: number | null | undefined, blackLabel?: boolean): string {
  if (blackLabel) return 'Black Label'
  const n = Number(nota)
  if (!n) return ''
  const usaPristine = slug === 'bgs' || slug === 'cgc' || slug === 'ags'
  if (n >= 10)  return usaPristine ? 'Pristine' : 'Gem Mint'
  if (n >= 9.5) return 'Gem Mint'
  if (n >= 9)   return 'Mint'
  if (n >= 8)   return 'NM-MT'
  if (n >= 7)   return 'Near Mint'
  if (n >= 5)   return 'EX'
  return 'Played'
}

// Nota "top" -> ganha brilho no grid e no slab.
export function isNotaTop(nota: number | null | undefined, blackLabel?: boolean): boolean {
  return !!blackLabel || Number(nota) >= 10
}

// Rotulo curto da nota pro selo/slab (BL pra Black Label).
export function notaCurta(nota: number | null | undefined, blackLabel?: boolean): string {
  if (blackLabel) return 'BL'
  const n = Number(nota)
  if (!n) return ''
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
