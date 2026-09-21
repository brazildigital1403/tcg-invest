/**
 * Textos das Metas que precisam ser IGUAIS em todo lugar: a tela, a lista e o
 * aviso do Radar no sino (servidor). Sem dependencia de Supabase de proposito,
 * para a rota do servidor importar daqui. A mesma conta em dois lugares sempre
 * diverge -- o "Todos os X" ja estava repetido na rota do Radar.
 */

export const LIMITE_METAS = 50

const IDIOMA_NOME: Record<string, string> = {
  pt: 'português', en: 'inglês', jp: 'japonês', cn: 'chinês', kr: 'coreano',
  es: 'espanhol', fr: 'francês', de: 'alemão', it: 'italiano',
}

export function nomeIdioma(idioma: string | null | undefined): string | null {
  return idioma ? (IDIOMA_NOME[idioma] ?? null) : null
}

/**
 * Nome da meta. Pokemon no singular e sem artigo ("Todas as cartas de
 * Charizard" -- "Charizards" quebra em nome composto, "Mr. Mimes"); colecao
 * com o prefixo "Colecao", sem repetir quando o set ja comeca com ele.
 */
export function tituloMeta(tipo: 'pokemon' | 'set', alvo: string, nomeSet?: string | null): string {
  if (tipo === 'pokemon') return `Todas as cartas de ${alvo}`
  const nome = (nomeSet || alvo).trim()
  return /^cole[çc][ãa]o\b/i.test(nome) ? nome : `Coleção ${nome}`
}

export type ResumoMeta = { total: number; tenho: number; vt: number; vtenho: number; falta: number }

/**
 * A frase que le as duas barras. Sem ela "32% das cartas e 97% do valor"
 * parecia erro (o que o Du viu em 21/09). Retorna destaque + complemento.
 */
export function fraseLeitura(r: ResumoMeta, brl: (v: number) => string): { forte: string; resto: string } {
  const faltam = r.total - r.tenho
  const pc = r.total > 0 ? Math.round((r.tenho / r.total) * 100) : 0
  const pv = r.vt > 0 ? Math.round((r.vtenho / r.vt) * 100) : 0
  const cartas = (n: number) => `${n} ${n === 1 ? 'carta' : 'cartas'}`
  if (faltam <= 0) return { forte: 'Meta completa.', resto: 'Você tem todas as cartas.' }
  if (r.tenho === 0) return { forte: 'Sua meta começa aqui.', resto: 'Tem alguma destas? Marque as que você já tem.' }
  if (faltam <= 3) return { forte: 'Falta pouco:', resto: `só ${cartas(faltam)} para completar, somando ${brl(r.falta)}.` }
  if (pv - pc >= 15) {
    // "so" apenas quando o que falta e menor que o que a pessoa ja tem;
    // em meta cara ("R$ 213 mil") soaria ironico.
    const so = r.falta < r.vtenho ? 'só ' : ''
    return { forte: 'Você já tem as cartas mais valiosas.', resto: `As ${faltam} que faltam somam ${so}${brl(r.falta)}.` }
  }
  if (pc - pv >= 15) return { forte: 'As cartas mais caras ainda faltam.', resto: `Você tem ${pc}% das cartas, mas elas são ${pv}% do valor.` }
  return { forte: 'Cartas e valor andando juntos.', resto: `Faltam ${cartas(faltam)}, somando ${brl(r.falta)}.` }
}
