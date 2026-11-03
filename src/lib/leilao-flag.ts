/**
 * Ativa o leilao. Desligado por padrao: as rotas /leiloes e /api/leiloes
 * respondem 404 enquanto NEXT_PUBLIC_LEILAO_ATIVO nao for '1'.
 */
export const LEILAO_ATIVO = process.env.NEXT_PUBLIC_LEILAO_ATIVO === '1'

/**
 * Leilao com prazo (1, 3, 5 ou 7 dias). Fica desligado ate a migration
 * 20261103030000 rodar em producao: sem ela, a loja nao consegue publicar, e a
 * tela nao pode prometer um prazo que nao existe. A prova liga pelo launch.json.
 */
export const LEILAO_PRAZO_ATIVO = process.env.NEXT_PUBLIC_LEILAO_PRAZO === '1'
