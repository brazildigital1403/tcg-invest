/** Loja da rodada como a pagina entrega (sem id do dono). */
export interface LojaDaRodada {
  slug: string
  nome: string | null
  logoUrl: string | null
  verificada: boolean
}

/** Reputacao lida no servidor (ver buscarReputacaoLoja). Sem id de ninguem. */
export interface ReputacaoDaRodada {
  media: number | null
  total: number
  rodadas: number | null
}
