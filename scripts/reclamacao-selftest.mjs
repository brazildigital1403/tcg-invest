// Autoteste das funcoes puras da Protecao Bynx (src/lib/leilao-reclamacao.ts).
// Rodar: node scripts/reclamacao-selftest.mjs
// Transpila o .ts com o typescript do proprio repo (sem dependencia nova).

import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import ts from 'typescript'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = mkdtempSync(join(tmpdir(), 'reclamacao-selftest-'))
const src = readFileSync(join(raiz, 'src/lib/leilao-reclamacao.ts'), 'utf8')
writeFileSync(join(tmp, 'r.mjs'), ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText)

const R = await import(pathToFileURL(join(tmp, 'r.mjs')).href)
const srcE = readFileSync(join(raiz, 'src/lib/estornoLancamento.ts'), 'utf8')
writeFileSync(join(tmp, 'e.mjs'), ts.transpileModule(srcE, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText)
const E = await import(pathToFileURL(join(tmp, 'e.mjs')).href)
const srcP = readFileSync(join(raiz, 'src/lib/painelPedidos.ts'), 'utf8')
writeFileSync(join(tmp, 'p.mjs'), ts.transpileModule(srcP, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace("from './leilao-reclamacao'", "from './r.mjs'"))
const P = await import(pathToFileURL(join(tmp, 'p.mjs')).href)
const DIA = 24 * 60 * 60 * 1000
const t = iso => new Date(iso).getTime()

let n = 0
const ok = (fn, nome) => { fn(); n++; console.log('ok ', nome) }

try {
  ok(() => {
    // Decisao do Du (28/09): prazos encurtados para caber no repasse de 30 dias.
    assert.equal(R.DIAS_UTEIS_ENVIO, 3)
    assert.equal(R.DIAS_RECLAMAR, 7)
    assert.equal(R.DIAS_POSTAR_DEVOLUCAO, 7)
    assert.equal(R.DIAS_UTEIS_CONTESTAR, 2)
    assert.equal(R.VALOR_FOTO_ENVIO_CENTS, 15000)
    assert.equal(R.DIAS_UTEIS_LOJA, 2)
    assert.equal(R.DIAS_UTEIS_DECISAO, 2)
    assert.equal(R.DIAS_AVISO_RECEBIMENTO, 6)
    assert.equal(R.DIAS_FECHAMENTO_AUTO, 10)
    assert.match(R.TEXTO_PROTECAO, /até 7 dias depois da entrega/)
    assert.match(R.TEXTO_PROTECAO, /até 2 dias úteis/)
    // O SQL nao importa a constante: o intervalo do trigger e da RPC espelha.
    const sql = readFileSync(join(raiz, 'supabase/migrations/20260928170000_leilao_arrependimento.sql'), 'utf8')
    const intervalos = [...sql.matchAll(/interval '(\d+) days'/g)].map(m => Number(m[1]))
    assert.deepEqual(intervalos, [R.DIAS_RECLAMAR, R.DIAS_RECLAMAR, R.DIAS_RECLAMAR], 'SQL fora de sincronia com DIAS_RECLAMAR')
  }, 'constantes da politica (3/7/2/2, aviso 6, fecha 10, postar 7, contestar 2) e espelho no SQL')

  ok(() => {
    // Sexta 25/09/2026 10h BRT -> 3 dias uteis = quarta 30/09 23:59:59.999 BRT
    assert.equal(R.somarDiasUteis('2026-09-25T13:00:00Z', 3).toISOString(), '2026-10-01T02:59:59.999Z')
    // Sexta 23h BRT (ja sabado em UTC) conta como sexta
    assert.equal(R.somarDiasUteis('2026-09-26T02:00:00Z', 3).toISOString(), '2026-10-01T02:59:59.999Z')
    // Sabado conta a partir de segunda
    assert.equal(R.somarDiasUteis('2026-09-26T15:00:00Z', 1).toISOString(), '2026-09-29T02:59:59.999Z')
    // Feriado fixo: 12/10/2026 (segunda) pula. Sexta 09/10 + 1 util = terca 13/10
    assert.equal(R.somarDiasUteis('2026-10-09T15:00:00Z', 1).toISOString(), '2026-10-14T02:59:59.999Z')
    // Natal + Ano Novo: 24/12/2026 (quinta) + 3 -> 28, 29, 30 (25 e sexta feriado)
    assert.equal(R.somarDiasUteis('2026-12-24T15:00:00Z', 3).toISOString(), '2026-12-31T02:59:59.999Z')
    // 0 dias = fim do proprio dia
    assert.equal(R.somarDiasUteis('2026-09-25T13:00:00Z', 0).toISOString(), '2026-09-26T02:59:59.999Z')
    assert.equal(R.somarDiasUteis('nao e data', 3), null)
    assert.equal(R.somarDiasUteis('2026-09-25T13:00:00Z', -1), null)
  }, 'somarDiasUteis (fim de semana, feriado fixo, virada de dia em Brasilia)')

  ok(() => {
    assert.equal(R.fmtPrazo('2026-10-01T02:59:59.999Z'), '30/09 às 23:59')
    assert.equal(R.fmtPrazo(null), '')
  }, 'fmtPrazo em Brasilia')

  ok(() => {
    const agora = t('2026-09-27T12:00:00Z')
    assert.deepEqual(R.podeReclamar({ status: 'enviado', ehLeilao: false }, agora), { pode: false, motivo: 'nao_e_leilao' })
    assert.deepEqual(R.podeReclamar({ status: 'enviado', ehLeilao: true }, agora), { pode: true, ate: null })
    assert.deepEqual(R.podeReclamar({ status: 'pago', ehLeilao: true }, agora), { pode: false, motivo: 'status' })
    assert.deepEqual(R.podeReclamar({ status: 'enviado', ehLeilao: true, reclamacao_aberta: true }, agora), { pode: false, motivo: 'ja_aberta' })
    // Entregue ha 6 dias: pode; ha 8: nao (janela de 7 desde 10/10).
    const e4 = R.podeReclamar({ status: 'entregue', ehLeilao: true, entregue_em: new Date(agora - 6 * DIA).toISOString() }, agora)
    assert.equal(e4.pode, true)
    assert.equal(e4.ate.getTime(), agora + DIA)
    assert.equal(R.podeReclamar({ status: 'entregue', ehLeilao: true, entregue_em: new Date(agora - 7 * DIA).toISOString() }, agora).pode, true, 'limite exato')
    assert.deepEqual(R.podeReclamar({ status: 'entregue', ehLeilao: true, entregue_em: new Date(agora - 8 * DIA).toISOString() }, agora),
      { pode: false, motivo: 'prazo_encerrado' })
    // prazo gravado pelo trigger vence o calculado
    assert.equal(R.podeReclamar({ status: 'entregue', ehLeilao: true, entregue_em: new Date(agora - 20 * DIA).toISOString(),
      prazo_reclamacao_ate: new Date(agora + 1000).toISOString() }, agora).pode, true)
    assert.deepEqual(R.podeReclamar({ status: 'entregue', ehLeilao: true }, agora), { pode: false, motivo: 'prazo_encerrado' })
    assert.deepEqual(R.podeReclamar({ status: 'reembolsado', ehLeilao: true }, agora), { pode: false, motivo: 'status' })
  }, 'podeReclamar')

  ok(() => {
    const pago = '2026-09-25T13:00:00Z' // sexta
    const limite = t('2026-10-01T02:59:59.999Z')
    const p = { status: 'pago', ehLeilao: true, pago_em: pago }
    const antes = R.podeCancelarPorAtraso(p, limite)
    assert.equal(antes.pode, false)
    assert.equal(antes.motivo, 'no_prazo')
    assert.equal(antes.liberaEm.getTime(), limite + 1)
    assert.deepEqual(R.podeCancelarPorAtraso(p, limite + 1), { pode: true })
    assert.equal(R.podeCancelarPorAtraso({ ...p, status: 'enviado' }, limite + 1).pode, false)
    assert.equal(R.podeCancelarPorAtraso({ ...p, ehLeilao: false }, limite + 1).motivo, 'nao_e_leilao')
    assert.equal(R.podeCancelarPorAtraso({ status: 'pago', ehLeilao: true }, limite + 1).pode, false)
  }, 'podeCancelarPorAtraso (3 dias uteis depois do pagamento)')

  ok(() => {
    const env = t('2026-09-01T12:00:00Z')
    const p = { status: 'enviado', ehLeilao: true, enviado_em: new Date(env).toISOString() }
    assert.equal(R.acaoRecebimento(p, env + 6 * DIA - 1), null)
    assert.equal(R.acaoRecebimento(p, env + 6 * DIA), 'avisar')
    assert.equal(R.acaoRecebimento({ ...p, aviso_recebimento_em: 'x' }, env + 7 * DIA), null)
    assert.equal(R.acaoRecebimento({ ...p, aviso_recebimento_em: 'x' }, env + 10 * DIA - 1), null)
    assert.equal(R.acaoRecebimento(p, env + 10 * DIA), 'fechar')
    assert.equal(R.acaoRecebimento({ ...p, aviso_recebimento_em: 'x' }, env + 10 * DIA), 'fechar')
    assert.equal(R.acaoRecebimento({ ...p, reclamacao_aberta: true }, env + 30 * DIA), null, 'reclamacao trava')
    assert.equal(R.acaoRecebimento({ ...p, status: 'entregue' }, env + 30 * DIA), null)
    assert.equal(R.acaoRecebimento({ ...p, ehLeilao: false }, env + 30 * DIA), null)
  }, 'acaoRecebimento (aviso dia 6, fecha dia 10, reclamacao trava)')

  // ★ PIOR CASO x REPASSE DE 30 DIAS. Cada etapa no limite: a loja envia no
  // ultimo minuto, o comprador nao confirma (fechamento automatico), reclama no
  // ultimo dia, a loja responde no ultimo dia util e a Bynx decide no ultimo
  // dia util. A data final e a da decisao (o estorno sai nela).
  const cadeia = pago => {
    const envio = R.somarDiasUteis(pago, R.DIAS_UTEIS_ENVIO)
    const entregue = R.somarDias(envio, R.DIAS_FECHAMENTO_AUTO)
    const reclama = R.somarDias(entregue, R.DIAS_RECLAMAR)
    const loja = R.somarDiasUteis(reclama, R.DIAS_UTEIS_LOJA)
    const decisao = R.somarDiasUteis(loja, R.DIAS_UTEIS_DECISAO)
    return { envio, entregue, reclama, loja, decisao }
  }
  const diaBrt = ms => Math.floor((ms - 3 * 60 * 60 * 1000) / DIA)
  const diasCivis = (a, b) => diaBrt(t(b)) - diaBrt(t(a))

  ok(() => {
    // Sexta 09/10/2026, vespera do feriado fixo de segunda 12/10.
    const pago = '2026-10-09T13:00:00Z'
    const c = cadeia(pago)
    assert.equal(R.fmtPrazo(c.envio), '15/10 às 23:59')    // 13, 14, 15 (12 e feriado)
    assert.equal(R.fmtPrazo(c.entregue), '25/10 às 23:59')  // envio + 10
    assert.equal(R.fmtPrazo(c.reclama), '01/11 às 23:59')   // entrega + 7
    assert.equal(R.fmtPrazo(c.loja), '04/11 às 23:59')      // 03, 04 (02/11 e feriado)
    assert.equal(R.fmtPrazo(c.decisao), '06/11 às 23:59')   // 05, 06
    // Cabe em 30: decisao 28 dias civis depois do pagamento.
    assert.equal(diasCivis(pago, c.decisao), 28)
    assert.ok(t(c.decisao) <= t(pago) + 30 * DIA)
  }, 'pior caso na sexta antes de feriado: decisao em pagamento + 28 dias (cabe em 30)')

  ok(() => {
    // Varredura de 10 anos (2026-2035), pagamento as 10h de cada dia.
    let pior = 0, piorPago = null, acima = 0, total = 0
    for (let ms = t('2026-01-01T13:00:00Z'); ms < t('2036-01-01T13:00:00Z'); ms += DIA) {
      const d = diasCivis(ms, cadeia(ms).decisao)
      total++
      if (d > 30) acima++
      if (d > pior) { pior = d; piorPago = new Date(ms).toISOString() }
    }
    // Decisao do Du (28/09): fecha em 10, Bynx decide em 2 dias uteis. Com a
    // janela de 7 dias (10/10) o pior caso real em 10 anos subiu de 28 para 30
    // dias civis: ainda nenhuma data passa do repasse de 30, mas sem folga.
    // O arrependimento NAO entra nesta cadeia: depende do transito de volta e
    // passa de 30 (risco do repasse em aberto no Quadro).
    console.log(`    pior caso: ${pior} dias civis (pago ${piorPago}); ${acima} de ${total} datas de pagamento passam de 30`)
    assert.equal(acima, 0, `${acima} datas passam de 30 dias (pior ${pior}, pago ${piorPago})`)
    // Trava de regressao: alongar qualquer prazo sem rever o repasse quebra aqui.
    assert.ok(pior <= 30)
  }, 'pior caso em 10 anos de calendario: cabe no repasse de 30 dias')

  ok(() => {
    const prazo = '2026-10-01T02:59:59.999Z'
    const r = { status: 'aguardando_loja', prazo_loja_ate: prazo }
    assert.equal(R.lojaPodeResponder(r, t(prazo)), true)
    assert.equal(R.lojaPodeResponder(r, t(prazo) + 1), false)
    assert.equal(R.lojaSemResposta(r, t(prazo)), false)
    assert.equal(R.lojaSemResposta(r, t(prazo) + 1), true)
    assert.equal(R.podeDecidir(r, t(prazo)), false)
    assert.equal(R.podeDecidir(r, t(prazo) + 1), true)
    assert.equal(R.podeDecidir({ ...r, status: 'em_analise' }, 0), true)
    assert.equal(R.podeDecidir({ ...r, status: 'resolvida' }, t(prazo) + 1), false)
    assert.equal(R.lojaPodeResponder({ ...r, status: 'em_analise' }, 0), false)
  }, 'prazo da loja e silencio')

  ok(() => {
    const agora = 10
    const r = { status: 'em_analise', prazo_loja_ate: '2020-01-01T00:00:00Z' }
    assert.deepEqual(R.planejarDecisao({ r, decisao: 'estorno_total', restanteCents: 7490, agora }), { ok: true, status: 'resolvida', valorCents: 7490 })
    assert.deepEqual(R.planejarDecisao({ r, decisao: 'estorno_parcial', valorCents: 1500, restanteCents: 7490, agora }), { ok: true, status: 'resolvida', valorCents: 1500 })
    assert.equal(R.planejarDecisao({ r, decisao: 'estorno_parcial', valorCents: 7490, restanteCents: 7490, agora }).ok, false)
    assert.equal(R.planejarDecisao({ r, decisao: 'estorno_parcial', valorCents: 0, restanteCents: 7490, agora }).ok, false)
    assert.equal(R.planejarDecisao({ r, decisao: 'estorno_parcial', valorCents: 10.5, restanteCents: 7490, agora }).ok, false)
    assert.deepEqual(R.planejarDecisao({ r, decisao: 'devolucao', restanteCents: 7490, agora }), { ok: true, status: 'aguardando_devolucao', valorCents: 0 })
    const dev = { ...r, status: 'aguardando_devolucao' }
    assert.deepEqual(R.planejarDecisao({ r: dev, decisao: 'devolucao', restanteCents: 5990, agora }), { ok: true, status: 'resolvida', valorCents: 5990 })
    assert.equal(R.planejarDecisao({ r: dev, decisao: 'estorno_parcial', valorCents: 100, restanteCents: 5990, agora }).ok, false)
    assert.deepEqual(R.planejarDecisao({ r: dev, decisao: 'improcedente', restanteCents: 5990, agora }), { ok: true, status: 'improcedente', valorCents: 0 })
    assert.deepEqual(R.planejarDecisao({ r, decisao: 'improcedente', restanteCents: 0, agora }), { ok: true, status: 'improcedente', valorCents: 0 })
    assert.equal(R.planejarDecisao({ r, decisao: 'estorno_total', restanteCents: 0, agora }).ok, false)
    assert.equal(R.planejarDecisao({ r, decisao: 'sorteio', restanteCents: 7490, agora }).ok, false)
    assert.equal(R.planejarDecisao({ r: { ...r, status: 'resolvida' }, decisao: 'estorno_total', restanteCents: 7490, agora }).ok, false)
    const noPrazo = { status: 'aguardando_loja', prazo_loja_ate: '2099-01-01T00:00:00Z' }
    assert.equal(R.planejarDecisao({ r: noPrazo, decisao: 'estorno_total', restanteCents: 7490, agora }).ok, false)
  }, 'planejarDecisao (4 decisoes, devolucao em 2 passos, travas)')

  ok(() => {
    assert.equal(R.validarVideoUrl(''), null)
    assert.equal(R.validarVideoUrl(null), null)
    assert.equal(R.validarVideoUrl('https://youtu.be/abc'), 'https://youtu.be/abc')
    assert.equal(R.validarVideoUrl('http://youtu.be/abc'), false)
    assert.equal(R.validarVideoUrl('javascript:alert(1)'), false)
    assert.equal(R.validarVideoUrl('https://x.com/' + 'a'.repeat(600)), false)
    assert.equal(R.validarDescricao('curta'), null)
    assert.equal(R.validarDescricao('  descricao ok aqui  '), 'descricao ok aqui')
    assert.equal(R.ehMotivo('danificado'), true)
    assert.equal(R.ehMotivo('outro'), false)
    assert.equal(R.ehMotivo('toString'), false, 'propriedade herdada nao e motivo')
    assert.equal(R.ehRespostaLoja('provas'), true)
    assert.equal(R.ehRespostaLoja('constructor'), false)
    assert.equal(R.motivoExigeFoto('nao_chegou'), false)
    assert.equal(R.motivoExigeFoto('suspeita_falsificacao'), true)
    assert.equal(R.motivoExigeFoto('arrependimento'), false)
    assert.equal(R.ehMotivo('arrependimento'), false, 'arrependimento tem rota propria')
    assert.equal(R.LISTA_MOTIVOS.includes('arrependimento'), false)
    assert.equal(R.MOTIVOS.arrependimento, 'Desistência da compra')
  }, 'validacao de video, descricao e motivo')

  ok(() => {
    const pasta = 'ped/usr/'
    const tres = ['ped/usr/verso-1.webp', 'ped/usr/frente-2.webp', 'ped/usr/embalagem-3.webp']
    assert.deepEqual(R.validarFotos(tres, pasta, true), { ok: true, fotos: ['ped/usr/frente-2.webp', 'ped/usr/verso-1.webp', 'ped/usr/embalagem-3.webp'] })
    assert.equal(R.validarFotos(tres.slice(0, 2), pasta, true).ok, false)
    assert.deepEqual(R.validarFotos([], pasta, false), { ok: true, fotos: [] })
    assert.equal(R.validarFotos(['outro/usr/frente-1.webp'], pasta, false).ok, false, 'pasta de outro pedido')
    assert.equal(R.validarFotos(['ped/usr/../x/frente-1.webp'], pasta, false).ok, false)
    assert.equal(R.validarFotos(['ped/usr/selfie-1.webp'], pasta, false).ok, false)
    assert.equal(R.validarFotos(['ped/usr/frente-1.webp', 'ped/usr/frente-2.webp'], pasta, false).ok, false)
    assert.equal(R.validarFotos('nao e lista', pasta, true).ok, false)
  }, 'validarFotos (pasta, slot, repeticao, obrigatoriedade)')

  ok(() => {
    const base = { totalCents: 7490, reembolsadoBancoCents: 0, refundDestaChaveCents: 0 }
    // Sem charge legivel: so o banco.
    assert.equal(R.restanteEstornavel({ ...base, charge: null }), 7490)
    assert.equal(R.restanteEstornavel({ ...base, reembolsadoBancoCents: 1500, charge: null }), 5990)
    // Estorno manual de 2000 no dashboard: o banco nao ve, a Stripe sim.
    assert.equal(R.restanteEstornavel({ ...base, charge: { amount: 7490, amountRefunded: 2000 } }), 5490)
    // Retry: o refund desta chave (7490) ja esta na charge -> restante volta a 7490.
    assert.equal(R.restanteEstornavel({ ...base, charge: { amount: 7490, amountRefunded: 7490 }, refundDestaChaveCents: 7490 }), 7490)
    // Totalmente estornado por fora: nada a estornar.
    assert.equal(R.restanteEstornavel({ ...base, charge: { amount: 7490, amountRefunded: 7490 } }), 0)
    // Vence o menor: banco ja registrou 1500, Stripe mostra 1500.
    assert.equal(R.restanteEstornavel({ ...base, reembolsadoBancoCents: 1500, charge: { amount: 7490, amountRefunded: 1500 } }), 5990)
  }, 'restanteEstornavel (Stripe x banco, estorno manual, retry)')

  ok(() => {
    assert.deepEqual(R.conferirRefund({ amount: 7490, status: 'succeeded' }, 7490), { ok: true })
    assert.deepEqual(R.conferirRefund({ amount: 7490, status: 'pending' }, 7490), { ok: true })
    assert.deepEqual(R.conferirRefund({ amount: 7490, status: 'succeeded' }, null), { ok: true })
    const dif = R.conferirRefund({ amount: 1500, status: 'succeeded' }, 7490)
    assert.equal(dif.ok, false); assert.equal(dif.http, 409)
    assert.match(dif.erro, /R\$ 15,00/); assert.match(dif.erro, /R\$ 74,90/)
    for (const st of ['failed', 'canceled', 'requires_action', null]) {
      const r = R.conferirRefund({ amount: 7490, status: st }, 7490)
      assert.equal(r.ok, false, String(st)); assert.equal(r.http, 502)
    }
  }, 'conferirRefund (valor diferente -> 409, status ruim -> 502)')

  ok(() => {
    const V = E.valorLancamentoAposEstorno
    // Venda de loja: charge 100,00, taxa da Bynx 8,80. Parcial 30% e depois 20%
    // (amount_refunded cumulativo 3000 -> 5000): sobra 50% da taxa ORIGINAL.
    let atual = 8.8
    atual = V({ amount: 10000, amountRefunded: 3000, applicationFeeAmount: 880, atualReais: atual })
    assert.equal(atual, 6.16)
    atual = V({ amount: 10000, amountRefunded: 5000, applicationFeeAmount: 880, atualReais: atual })
    assert.equal(atual, 4.4, 'o 2o parcial nao pode reduzir em dobro (bug antigo dava 3,08)')
    atual = V({ amount: 10000, amountRefunded: 10000, applicationFeeAmount: 880, atualReais: atual })
    assert.equal(atual, 0)
    // Evento antigo reentregue fora de ordem nao devolve receita.
    assert.equal(V({ amount: 10000, amountRefunded: 3000, applicationFeeAmount: 880, atualReais: 4.4 }), 4.4)
    // Cobranca direta (assinatura): sem application_fee, a base e o amount.
    assert.equal(V({ amount: 2990, amountRefunded: 1495, applicationFeeAmount: null, atualReais: 29.9 }), 14.95)
    assert.equal(V({ amount: 0, amountRefunded: 0, applicationFeeAmount: null, atualReais: 0 }), 0)
  }, 'valorLancamentoAposEstorno (base original, parciais cumulativos, fora de ordem)')

  ok(() => {
    const agora = t('2026-10-10T15:00:00Z')
    const iso = d => new Date(agora + d * DIA).toISOString()
    // podeDesistir
    assert.deepEqual(R.podeDesistir({ status: 'pago', ehLeilao: false }, agora), { pode: false, motivo: 'nao_e_leilao' })
    assert.deepEqual(R.podeDesistir({ status: 'pago', ehLeilao: true }, agora), { pode: true, modo: 'antes_do_envio', ate: null })
    assert.deepEqual(R.podeDesistir({ status: 'cancelando', ehLeilao: true }, agora), { pode: true, modo: 'antes_do_envio', ate: null })
    assert.deepEqual(R.podeDesistir({ status: 'pago', ehLeilao: true, em_disputa: true }, agora), { pode: false, motivo: 'em_disputa' })
    assert.deepEqual(R.podeDesistir({ status: 'enviado', ehLeilao: true }, agora), { pode: true, modo: 'devolucao', ate: null })
    const e6 = R.podeDesistir({ status: 'entregue', ehLeilao: true, entregue_em: iso(-6) }, agora)
    assert.equal(e6.pode && e6.modo, 'devolucao')
    assert.equal(e6.ate.getTime(), agora + DIA)
    assert.deepEqual(R.podeDesistir({ status: 'entregue', ehLeilao: true, entregue_em: iso(-8) }, agora), { pode: false, motivo: 'prazo_encerrado' })
    assert.deepEqual(R.podeDesistir({ status: 'enviado', ehLeilao: true, reclamacao_aberta: true }, agora), { pode: false, motivo: 'ja_aberta' })
    assert.deepEqual(R.podeDesistir({ status: 'reembolsado', ehLeilao: true }, agora), { pode: false, motivo: 'status' })
    // prazos
    assert.equal(R.prazoPostagem(agora).getTime(), agora + 7 * DIA)
    // Sexta 09/10 12h BRT + 2 uteis: segunda 12/10 e feriado -> terca 13, quarta 14 (fim do dia)
    assert.equal(R.prazoContestacao('2026-10-09T15:00:00Z').toISOString(), '2026-10-15T02:59:59.999Z')
  }, 'podeDesistir, prazoPostagem, prazoContestacao')

  ok(() => {
    // Exemplo da UPU (S10): SS123456785GB, digito 5.
    assert.equal(R.validarRastreio('SS123456785GB'), 'SS123456785GB')
    assert.equal(R.validarRastreio(' ss 123 456 785 gb '), 'SS123456785GB', 'normaliza espaco e caixa')
    assert.equal(R.validarRastreio('SS123456784GB'), null, 'digito errado')
    assert.equal(R.validarRastreio('SS12345678GB'), null, 'curto')
    assert.equal(R.validarRastreio('1S123456785GB'), null)
    assert.equal(R.validarRastreio(null), null)
    // dv 10 -> 0 e dv 11 -> 5
    const dvDe = d8 => { const p = [8, 6, 4, 2, 3, 5, 9, 7]; return 11 - [...d8].reduce((a, c, i) => a + Number(c) * p[i], 0) % 11 }
    let achou10 = null, achou11 = null
    for (let i = 0; i < 100000 && !(achou10 && achou11); i++) {
      const d8 = String(i).padStart(8, '0')
      const dv = dvDe(d8)
      if (dv === 10 && !achou10) achou10 = d8
      if (dv === 11 && !achou11) achou11 = d8
    }
    assert.equal(R.validarRastreio(`AA${achou10}0BR`), `AA${achou10}0BR`)
    assert.equal(R.validarRastreio(`AA${achou11}5BR`), `AA${achou11}5BR`)
  }, 'validarRastreio (S10, digito, 10->0, 11->5)')

  ok(() => {
    const agora = t('2026-10-10T15:00:00Z')
    const iso = d => new Date(agora + d * DIA).toISOString()
    const base = { motivo: 'arrependimento', status: 'aguardando_devolucao', postar_ate: iso(3) }
    assert.equal(R.podeInformarPostagem(base, agora), true)
    assert.equal(R.podeInformarPostagem({ ...base, postar_ate: iso(-1) }, agora), false, 'passou do prazo')
    assert.equal(R.podeInformarPostagem({ ...base, devolucao_postada_em: iso(-1) }, agora), false, 'ja postou')
    assert.equal(R.podeInformarPostagem({ ...base, motivo: 'danificado' }, agora), false)
    // contestacao
    assert.equal(R.lojaPodeContestar(base, agora), false, 'antes da postagem nao contesta')
    const postada = { ...base, devolucao_postada_em: iso(-2) }
    assert.equal(R.lojaPodeContestar(postada, agora), true, 'postada, sem entrega marcada')
    assert.equal(R.lojaPodeContestar({ ...postada, devolucao_entregue_em: iso(-1), contestar_ate: iso(1) }, agora), true)
    assert.equal(R.lojaPodeContestar({ ...postada, devolucao_entregue_em: iso(-3), contestar_ate: iso(-1) }, agora), false, 'janela passou')
    assert.equal(R.lojaPodeContestar({ ...postada, contestada_em: iso(0) }, agora), false, 'ja contestou')
    assert.equal(R.lojaPodeContestar({ ...postada, status: 'em_analise' }, agora), false)
    // cron
    assert.equal(R.acaoDevolucao(base, agora), null, 'no prazo de postar')
    assert.equal(R.acaoDevolucao({ ...base, postar_ate: iso(-0.01) }, agora), 'expirar')
    assert.equal(R.acaoDevolucao(postada, agora), null, 'postada, sem entrega: espera')
    assert.equal(R.acaoDevolucao({ ...postada, postar_ate: iso(-5) }, agora), null, 'postou a tempo nao expira depois')
    assert.equal(R.acaoDevolucao({ ...postada, devolucao_entregue_em: iso(-1), contestar_ate: iso(1) }, agora), null)
    assert.equal(R.acaoDevolucao({ ...postada, devolucao_entregue_em: iso(-3), contestar_ate: iso(-0.01) }, agora), 'estornar')
    assert.equal(R.acaoDevolucao({ ...postada, devolucao_entregue_em: iso(-3), contestar_ate: iso(-1), contestada_em: iso(-2) }, agora), null, 'contestada vai para a Bynx')
    assert.equal(R.acaoDevolucao({ ...base, motivo: 'nao_chegou', postar_ate: iso(-1) }, agora), null, 'reclamacao comum nao expira por aqui')
    assert.equal(R.acaoDevolucao({ ...base, status: 'resolvida', postar_ate: iso(-1) }, agora), null)
  }, 'podeInformarPostagem, lojaPodeContestar, acaoDevolucao')

  ok(() => {
    assert.equal(R.exigeFotoEnvio({ ehLeilao: true, valor_item_cents: 15000 }), true, 'limite exato')
    assert.equal(R.exigeFotoEnvio({ ehLeilao: true, valor_item_cents: 14999 }), false)
    assert.equal(R.exigeFotoEnvio({ ehLeilao: false, valor_item_cents: 90000 }), false, 'marketplace nao muda')
    assert.equal(R.exigeFotoEnvio({ ehLeilao: true, valor_item_cents: null }), false)
    const pasta = 'ped/envio/'
    assert.deepEqual(R.validarFotosEnvio(['ped/envio/verso-1.webp', 'ped/envio/frente-2.webp'], pasta, true),
      { ok: true, fotos: ['ped/envio/frente-2.webp', 'ped/envio/verso-1.webp'] })
    assert.equal(R.validarFotosEnvio(['ped/envio/frente-2.webp'], pasta, true).ok, false, 'falta o verso')
    assert.deepEqual(R.validarFotosEnvio([], pasta, false), { ok: true, fotos: [] })
    assert.equal(R.validarFotosEnvio(['ped/outro/frente-1.webp'], pasta, false).ok, false, 'fora da pasta')
    assert.equal(R.validarFotosEnvio(['ped/envio/../x/frente-1.webp'], pasta, false).ok, false)
    assert.equal(R.validarFotosEnvio(['ped/envio/embalagem-1.webp'], pasta, false).ok, false, 'slot desconhecido')
    assert.equal(R.validarFotosEnvio(['ped/envio/frente-1.webp', 'ped/envio/frente-2.webp'], pasta, false).ok, false, 'repetida')
  }, 'exigeFotoEnvio e validarFotosEnvio')

  ok(() => {
    const agora = t('2026-10-11T15:00:00Z')
    const iso = d => new Date(agora + d * DIA).toISOString()
    const C = (p, r = null) => P.classificarCaso({ created_at: iso(-5), ...p }, r, agora)
    // pedido sem ocorrencia
    let c = C({ status: 'pago', leilao_id: 'x', pago_em: iso(-1) })
    assert.equal(c.aba, 'sua_vez'); assert.equal(c.acao, 'enviar'); assert.equal(c.botao, 'enviar'); assert.equal(c.tipo, 'leilao')
    assert.ok(c.prazo, 'leilao pago tem prazo de envio')
    c = C({ status: 'pago', pago_em: iso(-2) })
    assert.equal(c.tipo, 'venda'); assert.equal(c.prazo, null, 'venda direta sem prazo de envio')
    c = C({ status: 'pago', leilao_id: 'x', pago_em: iso(-9) })
    assert.equal(c.urgencia, 'vencido')
    assert.equal(C({ status: 'cancelando' }).aba, 'bynx')
    c = C({ status: 'enviado', leilao_id: 'x', enviado_em: iso(-2) })
    assert.equal(c.aba, 'comprador'); assert.equal(c.acao, 'confirmar_recebimento'); assert.equal(c.fechaEm.getTime(), agora + 8 * DIA)
    assert.equal(C({ status: 'enviado', enviado_em: iso(-2) }).fechaEm, null, 'venda direta nao fecha sozinha')
    assert.equal(C({ status: 'entregue' }).aba, 'concluidos')
    assert.equal(C({ status: 'reembolsado' }).acao, 'reembolsado')
    assert.equal(C({ status: 'cancelado' }).acao, 'cancelado')
    // reclamacao
    const rec = { motivo: 'nao_chegou', status: 'aguardando_loja', prazo_loja_ate: iso(0.5) }
    c = C({ status: 'enviado', leilao_id: 'x' }, rec)
    assert.equal(c.aba, 'sua_vez'); assert.equal(c.acao, 'responder'); assert.equal(c.urgencia, 'hoje'); assert.equal(c.ocorrencia, 'reclamacao')
    c = C({ status: 'enviado', leilao_id: 'x' }, { ...rec, prazo_loja_ate: iso(-1) })
    assert.equal(c.aba, 'bynx'); assert.equal(c.urgencia, 'vencido')
    c = C({ status: 'entregue', leilao_id: 'x' }, { ...rec, status: 'em_analise', prazo_decisao_ate: iso(2) })
    assert.equal(c.aba, 'bynx'); assert.equal(c.acao, 'decidir')
    assert.equal(C({ status: 'entregue', leilao_id: 'x' }, { ...rec, status: 'aguardando_devolucao' }).acao, 'devolucao_bynx')
    c = C({ status: 'entregue', leilao_id: 'x' }, { ...rec, status: 'resolvida' })
    assert.equal(c.aba, 'concluidos', 'reclamacao fechada: manda o pedido'); assert.equal(c.ocorrencia, 'reclamacao')
    // desistencia
    const des = { motivo: 'arrependimento', status: 'aguardando_devolucao', prazo_loja_ate: iso(7), postar_ate: iso(7) }
    c = C({ status: 'entregue', leilao_id: 'x' }, des)
    assert.equal(c.aba, 'comprador'); assert.equal(c.acao, 'postar'); assert.equal(c.ocorrencia, 'desistencia')
    c = C({ status: 'entregue', leilao_id: 'x' }, { ...des, devolucao_postada_em: iso(-1) })
    assert.equal(c.aba, 'comprador'); assert.equal(c.quem, 'correios'); assert.equal(c.botao, 'conferir_cedo')
    c = C({ status: 'entregue', leilao_id: 'x' }, { ...des, devolucao_postada_em: iso(-3), devolucao_entregue_em: iso(-1), contestar_ate: iso(1.5) })
    assert.equal(c.aba, 'sua_vez'); assert.equal(c.acao, 'conferir'); assert.equal(c.botao, 'conferir')
    c = C({ status: 'entregue', leilao_id: 'x' }, { ...des, devolucao_postada_em: iso(-5), devolucao_entregue_em: iso(-4), contestar_ate: iso(-1) })
    assert.equal(c.aba, 'bynx'); assert.equal(c.acao, 'estorno')
    c = C({ status: 'entregue', leilao_id: 'x' }, { ...des, status: 'em_analise', contestada_em: iso(-1), prazo_decisao_ate: iso(2) })
    assert.equal(c.aba, 'bynx'); assert.equal(c.acao, 'decidir')
    // ocorrencia que manda: a aberta, senao a mais recente
    const lista = [{ status: 'resolvida', created_at: iso(-1) }, { status: 'em_analise', created_at: iso(-3) }]
    assert.equal(P.ocorrenciaDoPedido(lista).status, 'em_analise')
    assert.equal(P.ocorrenciaDoPedido([{ status: 'resolvida', created_at: iso(-3) }, { status: 'improcedente', created_at: iso(-1) }]).status, 'improcedente')
    assert.equal(P.ocorrenciaDoPedido([]), null)
    // ordem: prazo mais proximo primeiro, sem prazo no fim
    const a = C({ status: 'pago', leilao_id: 'x', pago_em: iso(-5) }), b = C({ status: 'pago', leilao_id: 'x', pago_em: iso(0) })
    assert.ok(a.ordem < b.ordem)
    assert.ok(C({ status: 'enviado', enviado_em: iso(-1) }).ordem > a.ordem)
    // textos auxiliares
    assert.equal(P.faltam(new Date(agora + 3.2 * DIA), agora), 'faltam 3 dias')
    assert.equal(P.faltam(new Date(agora + 1.2 * DIA), agora), 'falta 1 dia')
    assert.equal(P.faltam(new Date(agora + 0.5 * DIA), agora), null)
    assert.equal(P.diasDesde(iso(-2.5), agora), 2)
  }, 'classificarCaso: aba, quem age, prazo e ordem do painel da loja')

  console.log(`\n${n} blocos ok`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
