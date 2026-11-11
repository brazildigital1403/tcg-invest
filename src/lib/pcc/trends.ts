// Trends do Poke Creators Club (11/11/2026, mockup "Trends na home"). A home mostra o
// que o grupo esta fazendo agora: cada trend e um carrossel com o post de cada
// creator, na ordem combinada. O navegador nunca le as tabelas: tudo vem da funcao
// club_trends_lista (leitura publica, so do que esta publicado).

export type TrendPost = {
  nome: string
  /** Nome da pessoa por tras do perfil, quando e diferente do nome do card. */
  pessoa: string | null
  tipo: 'post' | 'reel'
  link: string
  /** Caminho da capa no bucket club-fotos; sem capa, o card usa a inicial do nome. */
  capa: string | null
}

export type Trend = {
  id: string
  slug: string
  titulo: string
  /** Rotulo curto do chip e do filtro (Halloween). */
  tema: string
  postaram: number
  total: number
  /** Quem ainda vai postar: aparece so como nome, no ultimo card. */
  aguardando: string[]
  posts: TrendPost[]
}

export const BUCKET_CAPAS = 'club-fotos'

/** So abre link de Instagram vindo do banco; qualquer outra coisa vira "sem link". */
export const linkSeguro = (url: string) => /^https:\/\/(www\.)?instagram\.com\//.test(url) ? url : null
