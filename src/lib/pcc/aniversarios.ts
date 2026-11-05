// Aniversariantes do Poke Creators Club (05/11/2026). Datas sempre em Brasilia e
// sem ano. O navegador nunca le a tabela: tudo vem das funcoes club_aniversario*.

export type Aniversariante = {
  instagram: string; dia: number; mes: number
  foto_path: string | null; pokemon: string | null; eu: boolean
}

export type ListaAniversarios = {
  lista: Aniversariante[]
  sugestao: { instagram: string; pokemon: string | null } | null
}

export type Proximo = Aniversariante & { emDias: number; diaExibido: number }

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function hojeBrasilia(agora = new Date()): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora).split('-').map(Number)
  return { ano, mes, dia }
}

export const bissexto = (ano: number) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0

/** 29/02 aparece em 28/02 quando o ano nao e bissexto. */
export const diaNoAno = (dia: number, mes: number, ano: number) => (mes === 2 && dia === 29 && !bissexto(ano) ? 28 : dia)

export function diasDoMes(mes: number): number {
  return mes === 2 ? 29 : [4, 6, 9, 11].includes(mes) ? 30 : 31
}

/** Lista ordenada a partir de hoje, com quantos dias faltam para cada pessoa. */
export function ordenarProximos(lista: Aniversariante[], hoje = hojeBrasilia()): Proximo[] {
  const base = Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia)
  return lista.map(p => {
    let ano = hoje.ano
    let dia = diaNoAno(p.dia, p.mes, ano)
    if (Date.UTC(ano, p.mes - 1, dia) < base) { ano += 1; dia = diaNoAno(p.dia, p.mes, ano) }
    return { ...p, diaExibido: dia, emDias: Math.round((Date.UTC(ano, p.mes - 1, dia) - base) / 86_400_000) }
  }).sort((a, b) => a.emDias - b.emDias || a.instagram.localeCompare(b.instagram))
}

export const quandoTexto = (emDias: number) => (emDias === 0 ? 'Hoje' : emDias === 1 ? 'amanhã' : `em ${emDias} dias`)

export const instagramUrl = (instagram: string) => `https://instagram.com/${instagram}`

export function erroAniversario(msg: string | undefined | null): string {
  const m = msg || ''
  if (m.includes('nao_logado')) return 'Entre na sua conta para continuar.'
  if (m.includes('instagram_invalido')) return 'Confira o seu @. Use letras, números, ponto ou sublinhado.'
  if (m.includes('instagram_ja_usado')) return 'Esse @ já está na lista com outra conta.'
  if (m.includes('data_invalida')) return 'Essa data não existe. Confira o dia e o mês.'
  if (m.includes('aceite_obrigatorio')) return 'Marque o aviso para entrar na lista.'
  if (m.includes('foto_invalida')) return 'Não conseguimos usar esta foto. Escolha outra.'
  return 'Não conseguimos salvar. Tente de novo.'
}
