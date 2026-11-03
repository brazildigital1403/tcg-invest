/**
 * Ativa o leilao. Desligado por padrao: as rotas /leiloes e /api/leiloes
 * respondem 404 enquanto NEXT_PUBLIC_LEILAO_ATIVO nao for '1'.
 */
export const LEILAO_ATIVO = process.env.NEXT_PUBLIC_LEILAO_ATIVO === '1'

/**
 * Leilao com prazo (1, 3, 5 ou 7 dias). Ligado: a migration 20261103030000 rodou
 * em producao em 03/11/2026. '0' desliga so o texto da home que promete o prazo.
 */
export const LEILAO_PRAZO_ATIVO = process.env.NEXT_PUBLIC_LEILAO_PRAZO !== '0'
