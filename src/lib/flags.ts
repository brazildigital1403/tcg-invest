// Feature flags de ambiente.
//
// LORCANA_ENABLED: liga as rotas /lorcana/* e o seletor de jogo. Producao NAO
// tem a coluna `game` ate a F8 — com a flag desligada, as rotas devolvem 404
// antes de qualquer query e o seletor nao monta. So o .env.prova (branch)
// define NEXT_PUBLIC_LORCANA_ENABLED=1. Ligar em producao e passo da F8,
// depois das migrations — decisao do Du, nunca default.
export const LORCANA_ENABLED = process.env.NEXT_PUBLIC_LORCANA_ENABLED === '1'
