// Autoteste das funcoes puras do leilao (src/lib/leilao.ts e leilao-taxas.ts).
// Rodar: node scripts/leilao-selftest.mjs
// Transpila os .ts com o typescript do proprio repo para uma pasta temporaria
// (sem dependencia nova) e confere incrementos, formatacao, slug e taxas.

import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import ts from 'typescript'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = mkdtempSync(join(tmpdir(), 'leilao-selftest-'))

for (const nome of ['comissao', 'leilao', 'leilao-taxas']) {
  const src = readFileSync(join(raiz, 'src/lib', `${nome}.ts`), 'utf8')
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/from '\.\/(comissao|leilao|leilao-taxas)'/g, "from './$1.mjs'")
  writeFileSync(join(tmp, `${nome}.mjs`), out)
}

const L = await import(pathToFileURL(join(tmp, 'leilao.mjs')).href)
const T = await import(pathToFileURL(join(tmp, 'leilao-taxas.mjs')).href)

let n = 0
const ok = (fn, nome) => {
  fn()
  n++
  if (nome) console.log('ok ', nome)
}

try {
  ok(() => {
    const casos = [
      [0, 100], [1999, 100], [2000, 200], [4999, 200], [5000, 500], [9999, 500],
      [10000, 1000], [24999, 1000], [25000, 2000], [49999, 2000], [50000, 5000],
      [99999, 5000], [100000, 10000], [249999, 10000], [250000, 20000],
      [499999, 20000], [500000, 50000], [999999, 50000], [1000000, 100000], [5000000, 100000],
    ]
    for (const [atual, inc] of casos) assert.equal(L.incrementoCents(atual), inc, `incremento(${atual})`)
  }, 'incrementoCents (fronteiras da tabela)')

  ok(() => {
    assert.equal(L.minimoProximoCents({ lanceInicialCents: 1000, precoAtualCents: null, nLances: 0 }), 1000)
    assert.equal(L.minimoProximoCents({ lanceInicialCents: 1000, precoAtualCents: 1900, nLances: 3 }), 2000)
    assert.equal(L.minimoProximoCents({ lanceInicialCents: 1000, precoAtualCents: 2000, nLances: 4 }), 2200)
  }, 'minimoProximoCents')

  ok(() => {
    const s = 1000, m = 60 * s, h = 60 * m, d = 24 * h
    assert.equal(L.formatarTempoRestante(3 * d + 4 * h + 5 * m), '3d 4h')
    assert.equal(L.formatarTempoRestante(5 * h + 12 * m + 30 * s), '5h 12min')
    assert.equal(L.formatarTempoRestante(24 * h), '24h 0min')
    assert.equal(L.formatarTempoRestante(h), '1h 0min')
    assert.equal(L.formatarTempoRestante(42 * m + 10 * s), '42min 10s')
    assert.equal(L.formatarTempoRestante(10 * m), '10min 0s')
    assert.equal(L.formatarTempoRestante(8 * m + 41 * s + 999), '08:41')
    assert.equal(L.formatarTempoRestante(9 * s), '00:09')
    assert.equal(L.formatarTempoRestante(-5000), '00:00')
  }, 'formatarTempoRestante')

  ok(() => {
    const base = { status: 'ativo', iniciaEm: '2026-09-27T20:00:00Z', terminaEm: '2026-09-27T20:01:00Z', softCloseSeg: 10 }
    assert.equal(L.statusPublico(base, Date.parse('2026-09-27T19:59:00Z')), 'em_breve')
    assert.equal(L.statusPublico(base, Date.parse('2026-09-27T20:00:30Z')), 'ao_vivo')
    assert.equal(L.statusPublico(base, Date.parse('2026-09-27T20:00:55Z')), 'encerrando')
    assert.equal(L.statusPublico(base, Date.parse('2026-09-27T20:01:01Z')), 'encerrado')
    assert.equal(L.statusPublico({ ...base, status: 'aguardando_pagamento' }), 'arrematado')
    assert.equal(L.statusPublico({ ...base, status: 'sem_lances' }), 'sem_lances')
  }, 'statusPublico')

  ok(() => {
    assert.equal(L.mascararApelido('joana'), 'j***a')
    assert.equal(L.mascararApelido('J'), '***')
    assert.equal(L.mascararApelido(null), '***')
  }, 'mascararApelido')

  ok(() => {
    assert.equal(L.slugLote('Charizard ex 199/165', 'PSA', '10', 'k3x9qa'), 'charizard-ex-199-165-psa-10-k3x9qa')
    assert.equal(L.slugLote('Pikachu Ilustrador Pokémon', null, null, 'ab12cd'), 'pikachu-ilustrador-pokemon-ab12cd')
    assert.equal(L.slugLote('Évoli (Eevee)', 'CGC', '9.5', 'zz99zz'), 'evoli-eevee-cgc-9-5-zz99zz')
    assert.equal(L.codigoDoSlug('charizard-ex-199-165-psa-10-k3x9qa'), 'k3x9qa')
    assert.equal(L.codigoDoSlug('K3X9QA'), 'k3x9qa')
    assert.equal(L.codigoDoSlug('charizard-ex'), null)
    assert.equal(L.codigoDoSlug(''), null)
  }, 'slugLote / codigoDoSlug')

  ok(() => {
    const nb = (s) => s.replace(/ /g, ' ')
    assert.equal(nb(L.formatarBRL(123456)), 'R$ 1.234,56')
    assert.equal(nb(L.horarioBrasilia('2026-09-28T00:30:00Z')), '27/09/2026, 21:30 (Brasília)')
    const e = L.erroDoLance('abaixo_minimo:1500')
    assert.equal(e.codigo, 'abaixo_minimo')
    assert.equal(e.status, 409)
    assert.equal(e.minimoCents, 1500)
    assert.equal(nb(e.mensagem), 'Outro lance chegou primeiro. Lance mínimo agora: R$ 15,00.')
    assert.equal(L.erroDoLance('ERROR: leilao_fechado').codigo, 'leilao_fechado')
    assert.equal(L.erroDoLance('xyz').status, 500)
    for (const c of ['nao_autenticado', 'cadastro_incompleto', 'leilao_fechado', 'proprio_leilao', 'suspenso']) {
      const msg = L.erroDoLance(c).mensagem
      assert.ok(!/\b(pra|pro|num|numa)\b/i.test(msg), `contracao em ${c}`)
    }
  }, 'formatarBRL / horarioBrasilia / erros')

  const esperado = {
    5000: { comissao: 390, protecao: 250, metodo: 240, paga: 5490, recebe: 4610, fee: 880 },
    30000: { comissao: 2137, protecao: 1500, metodo: 1440, paga: 32940, recebe: 27863, fee: 5077 },
    200000: { comissao: 14020, protecao: 10000, metodo: 9600, paga: 219600, recebe: 185980, fee: 33620 },
  }
  for (const [preco, e] of Object.entries(esperado)) {
    ok(() => {
      const a = T.calcularArremate(Number(preco))
      assert.equal(a.comissaoVendedorCents, e.comissao)
      assert.equal(a.protecaoCents, e.protecao)
      assert.equal(a.custoMetodoCents, e.metodo)
      assert.equal(a.compradorPagaCents, e.paga)
      assert.equal(a.vendedorRecebeCents, e.recebe)
      assert.equal(a.applicationFeeCents, e.fee)
      assert.equal(a.bynxBrutoCents, e.fee)
      assert.equal(a.compradorPagaCents - a.applicationFeeCents, a.vendedorRecebeCents)
      // Invariante: o metodo nao muda o liquido do vendedor.
      assert.equal(T.calcularArremate(Number(preco), 'pix').vendedorRecebeCents, a.vendedorRecebeCents)
      console.log(
        `ok  arremate R$ ${Number(preco) / 100}: comprador ${a.compradorPagaCents} | vendedor ${a.vendedorRecebeCents}` +
          ` | fee ${a.applicationFeeCents} | stripe~ ${a.custoStripeEstimadoCents} | bynx liq~ ${a.bynxLiquidoEstimadoCents}`
      )
    })
  }

  ok(() => {
    assert.equal(T.protecaoCompradorCents(1000), 200) // minimo R$ 2
    assert.equal(T.comissaoVendedorLeilaoCents(1999), 140) // sem a fixa abaixo de R$ 20
    assert.equal(T.calcularArremate(0).compradorPagaCents, 0)
  }, 'taxas: minimo da protecao e fixa so a partir de R$ 20')

  console.log(`\n${n} blocos ok`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
