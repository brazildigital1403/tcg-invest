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
const DIA = 24 * 60 * 60 * 1000
const t = iso => new Date(iso).getTime()

let n = 0
const ok = (fn, nome) => { fn(); n++; console.log('ok ', nome) }

try {
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
    // Entregue ha 6 dias: pode; ha 8: nao.
    const e6 = R.podeReclamar({ status: 'entregue', ehLeilao: true, entregue_em: new Date(agora - 6 * DIA).toISOString() }, agora)
    assert.equal(e6.pode, true)
    assert.equal(e6.ate.getTime(), agora + DIA)
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
    assert.equal(R.acaoRecebimento(p, env + 13 * DIA), null)
    assert.equal(R.acaoRecebimento(p, env + 14 * DIA), 'avisar')
    assert.equal(R.acaoRecebimento({ ...p, aviso_recebimento_em: 'x' }, env + 15 * DIA), null)
    assert.equal(R.acaoRecebimento(p, env + 21 * DIA), 'fechar')
    assert.equal(R.acaoRecebimento({ ...p, aviso_recebimento_em: 'x' }, env + 21 * DIA), 'fechar')
    assert.equal(R.acaoRecebimento({ ...p, reclamacao_aberta: true }, env + 30 * DIA), null, 'reclamacao trava')
    assert.equal(R.acaoRecebimento({ ...p, status: 'entregue' }, env + 30 * DIA), null)
    assert.equal(R.acaoRecebimento({ ...p, ehLeilao: false }, env + 30 * DIA), null)
  }, 'acaoRecebimento (aviso dia 14, fecha dia 21, reclamacao trava)')

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
    assert.equal(R.motivoExigeFoto('nao_chegou'), false)
    assert.equal(R.motivoExigeFoto('suspeita_falsificacao'), true)
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

  console.log(`\n${n} blocos ok`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
