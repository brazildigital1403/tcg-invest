// Videos do YouTube na home do Poke Creators Club (23/11/2026, mockup "Videos do Club", desenho A).
// O navegador nunca le a tabela: tudo vem da funcao club_videos_lista (leitura publica, so o
// publicado, no maximo 6, do mais novo para o mais antigo). A capa vive no bucket club-fotos.

export type VideoClub = {
  /** ID do video no YouTube (11 caracteres). */
  id: string
  titulo: string
  tipo: 'encontro' | 'aula'
  /** Duracao em segundos. */
  duracao: number
  /** Data de publicacao, AAAA-MM-DD. */
  data: string
  capa: string | null
}

export const CANAL_YOUTUBE = 'https://www.youtube.com/@Pok%C3%A9CreatorsClub'

/** So abre link do YouTube montado a partir de um ID valido; qualquer outra coisa vira "sem link". */
export const linkVideo = (id: string) => /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : null

export function duracaoTexto(seg: number): string {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  const dois = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${m}:${dois(s)}`
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** "23 nov", ou "23 nov 2025" quando nao e do ano corrente. Usa a data como veio, sem fuso. */
export function dataVideoTexto(iso: string, anoAtual: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return ''
  return `${d} ${MESES[m - 1]}${a !== anoAtual ? ` ${a}` : ''}`
}
