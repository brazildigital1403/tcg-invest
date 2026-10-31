/**
 * Ativa o leilao. Desligado por padrao: as rotas /leiloes e /api/leiloes
 * respondem 404 enquanto NEXT_PUBLIC_LEILAO_ATIVO nao for '1'.
 */
export const LEILAO_ATIVO = process.env.NEXT_PUBLIC_LEILAO_ATIVO === '1'
