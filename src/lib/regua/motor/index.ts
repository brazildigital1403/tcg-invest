/**
 * Motor da regua de e-mail: porta de entrada para rotas e admin.
 *
 * - Eventos (cron /api/cron-regua): E02, E03, E04, E05, E06, E07, E08, E09, E15, E16, E20.
 * - Editoriais (POST /api/admin/regua/disparo): E01, E10 (Radar), E11, E12, E17, E18, E19.
 * - Variantes (E01B, E03B, E04B, E06B, E17B): saem no gatilho do principal, para
 *   o publico que ele nao cobre. Nao tem gatilho nem disparo proprio.
 * - Leilao (E13, E14): `enviarAvisoLeilao`, para o modulo do leilao chamar.
 *
 * Chave geral: REGUA_ATIVA (ver config.ts). Desligada = simulacao.
 */
import { BLOQUEIO_ENVIO, PUBLICO_TEXTO, ehEditorial } from './editoriais'
import { E06_PRIMEIRA, E15_TOQUES, INICIO } from './config'

export { reguaAtiva, modoAtual, e02Substitui, e05Substitui } from './config'
export { rodarEventos, contarEvento, enviarE02Agora, ORDEM_EVENTOS } from './eventos'
export { dispararEditorial, edicaoExemplo, ehEditorial, ErroDisparo, EDITORIAIS, BLOQUEIO_ENVIO, type Publico } from './editoriais'
export { enviarAvisoLeilao } from './leilao'
export { criarContexto } from './contexto'

export type TipoGatilho = 'evento' | 'editorial' | 'leilao'

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

/**
 * Gatilho e publico de cada template, em texto, para o /admin/regua.
 * `principal`: a variante sai no gatilho (e no disparo) deste template.
 */
export const GATILHOS: Record<string, { tipo: TipoGatilho; gatilho: string; publico: string; bloqueio?: string; principal?: string }> = {
  E01: { tipo: 'editorial', gatilho: 'Calendário, 3 ondas (20/10, 22/10, 27/10). Disparo pelo admin.', publico: PUBLICO_TEXTO.E01 },
  E01B: { tipo: 'editorial', principal: 'E01', gatilho: 'Sai no disparo do E01 (mesmas ondas). Dedup com E01 e E11 em 365 dias.', publico: 'Aceitaram novidades, cadastro até 31/08, 0 cartas.' },
  E02: { tipo: 'evento', gatilho: `Cadastro (na hora, pelo /api/email/welcome; o cron cobre as últimas 48h). A partir de ${fmt(INICIO.E02)}, no lugar do welcome antigo.`, publico: 'Todo cadastro novo com teste do Pro (Coleção).' },
  E03: { tipo: 'evento', gatilho: `24h a 48h após o cadastro. A partir de ${fmt(INICIO.E03)}.`, publico: 'Todos com conta (Coleção), 0 a 4 cartas (5 a 9 recebe o E03B; 10+ sai).' },
  E03B: { tipo: 'evento', principal: 'E03', gatilho: `O mesmo do E03: 24h a 48h após o cadastro. A partir de ${fmt(INICIO.E03)}.`, publico: '5 a 9 cartas (Coleção). Quem recebe o E03B não recebe o E03.' },
  E04: { tipo: 'evento', gatilho: `72h a 96h após o cadastro, sem meta. A partir de ${fmt(INICIO.E04)}.`, publico: 'Todos com conta (Coleção), com carta em alta de 7 dias num set da coleção (0 cartas recebe o E04B).' },
  E04B: { tipo: 'evento', principal: 'E04', gatilho: `O mesmo do E04: 72h a 96h após o cadastro, sem meta. A partir de ${fmt(INICIO.E04)}.`, publico: '0 cartas (Coleção). Quem recebe o E04B não recebe o E04.' },
  E05: { tipo: 'evento', gatilho: `Trial acaba em 12h a 36h. A partir de ${fmt(INICIO.E05)}, no lugar dos avisos D-2 e D-1.`, publico: 'Trial sem assinatura (Coleção). Sem dado para montar, sai o aviso antigo de último dia.' },
  E06: { tipo: 'evento', gatilho: `Sexta quinzenal a partir de ${fmt(E06_PRIMEIRA)}.`, publico: '5+ cartas, caso "uma carta salvou a semana". Semana calma (nada mexeu ou saldo abaixo de 3%) recebe o E06B; acima de 3% sem o caso "salvou" fica sem e-mail.' },
  E06B: { tipo: 'evento', principal: 'E06', gatilho: `A mesma sexta quinzenal do E06, a partir de ${fmt(E06_PRIMEIRA)}. Mesma chave: E06 ou E06B.`, publico: '5+ cartas, semana calma: nada mexeu ou o saldo dos 7 dias ficou abaixo de 3% do começo (Coleção).' },
  E07: { tipo: 'evento', gatilho: `Meta com até 3 faltando (ou 90%+ com até 9) e 1+ à venda. Uma vez por meta. A partir de ${fmt(INICIO.E07)}.`, publico: 'Quem tem meta (Coleção).' },
  E08: { tipo: 'evento', gatilho: `Digest diário (no tick das 19h30): carta com 15% e R$ 10 em 7 dias. 1/dia, 3/semana. A partir de ${fmt(INICIO.E08)}.`, publico: 'Quem tem coleção (Coleção).' },
  E09: { tipo: 'evento', gatilho: `Anúncio novo (26h) com compra no site e abaixo do menor preço, de set que a pessoa monta. 1 vez por carta, 1/dia, 2/semana. A partir de ${fmt(INICIO.E09)}.`, publico: 'Aceitaram novidades com Mercado ligado.' },
  E10: { tipo: 'editorial', gatilho: 'Quarta 19h30, quinzenal. Disparo pelo admin com a edição.', publico: PUBLICO_TEXTO.E10 },
  E11: { tipo: 'editorial', gatilho: 'Mesmas ondas do E01. Disparo pelo admin.', publico: PUBLICO_TEXTO.E11 },
  E12: { tipo: 'editorial', gatilho: 'Calendário (proposta 03/12). Disparo pelo admin.', publico: PUBLICO_TEXTO.E12 },
  E13: { tipo: 'leilao', gatilho: 'Lance superado em lote com mais de 10 minutos. Chamado pelo módulo do leilão.', publico: 'Quem deu lance (transacional).', bloqueio: 'O leilão ainda não está em produção.' },
  E14: { tipo: 'leilao', gatilho: 'Fim do lote: ganhador na hora + 24h; perdedor 1h depois. Chamado pelo módulo do leilão.', publico: 'Participantes do lote (transacional).', bloqueio: 'O leilão ainda não está em produção.' },
  E15: { tipo: 'evento', gatilho: `Toques em ${E15_TOQUES.map(fmt).join(', ')}. Quem clica sai.`, publico: 'Aceitaram novidades, 30+ dias sem acesso, com coleção e carta que subiu em 30 dias.' },
  E16: { tipo: 'evento', gatilho: `A partir de ${fmt(INICIO.E16)}: 60 dias de log e nenhum clique em 60 dias.`, publico: 'Aceitaram novidades. Sem clique em 14 dias depois do E16, sai do marketing.' },
  E17: { tipo: 'editorial', gatilho: 'Ter 15/12. Disparo pelo admin.', publico: PUBLICO_TEXTO.E17 },
  E17B: { tipo: 'editorial', principal: 'E17', gatilho: 'Sai no disparo do E17 (ter 15/12), mesma chave e17:2026.', publico: '1 a 9 cartas (Coleção). 0 cartas não recebe.' },
  E18: { tipo: 'editorial', gatilho: 'Sex 27/11. Disparo pelo admin com as ofertas.', publico: PUBLICO_TEXTO.E18 },
  E19: { tipo: 'editorial', gatilho: 'Ter 03/11. Disparo pelo admin.', publico: PUBLICO_TEXTO.E19 },
  E20: { tipo: 'evento', gatilho: `A partir de ${fmt(INICIO.E20)}, a cada 30 dias.`, publico: 'Aceitaram novidades com Mercado ligado, 10+ cartas, nenhum anúncio, 1+ repetida.' },
}

for (const id of Object.keys(GATILHOS)) {
  const base = GATILHOS[id].principal ?? id
  const b = ehEditorial(base) ? BLOQUEIO_ENVIO[base] : undefined
  if (b) GATILHOS[id].bloqueio = b
}
