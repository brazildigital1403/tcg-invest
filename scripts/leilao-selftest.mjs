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

for (const nome of ['comissao', 'leilao', 'leilao-taxas', 'leilao-avisos', 'email-lote', 'leilao-painel', 'leilao-rodada', 'leilao-urls']) {
  const src = readFileSync(join(raiz, 'src/lib', `${nome}.ts`), 'utf8')
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/from '\.\/(comissao|leilao|leilao-taxas|leilao-avisos|leilao-urls)'/g, "from './$1.mjs'")
  writeFileSync(join(tmp, `${nome}.mjs`), out)
}

const L = await import(pathToFileURL(join(tmp, 'leilao.mjs')).href)
const T = await import(pathToFileURL(join(tmp, 'leilao-taxas.mjs')).href)
const A = await import(pathToFileURL(join(tmp, 'leilao-avisos.mjs')).href)
const EL = await import(pathToFileURL(join(tmp, 'email-lote.mjs')).href)
const P = await import(pathToFileURL(join(tmp, 'leilao-painel.mjs')).href)
const R = await import(pathToFileURL(join(tmp, 'leilao-rodada.mjs')).href)
const U = await import(pathToFileURL(join(tmp, 'leilao-urls.mjs')).href)

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
    assert.equal(L.mascararApelido('jo'), '***')
    assert.equal(L.mascararApelido('  ana '), 'a***a')
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
    assert.equal(L.horarioBrasilia('2026-09-28T03:05:00Z'), '28/09/2026, 00:05 (Brasília)')
    assert.equal(L.dataBrasiliaISO('2026-09-28T00:30:00Z'), '2026-09-27')
    const e = L.erroDoLance('abaixo_minimo:1500')
    assert.equal(e.codigo, 'abaixo_minimo')
    assert.equal(e.status, 409)
    assert.equal(e.minimoCents, 1500)
    assert.equal(nb(e.mensagem), 'O lance mínimo agora é R$ 15,00.')
    // Minimo subiu em relacao ao que a tela mostrava: outro lance chegou antes.
    assert.equal(
      nb(L.erroDoLance('abaixo_minimo:1500', { vistoCents: 1200 }).mensagem),
      'Outro lance chegou primeiro. Lance mínimo agora: R$ 15,00.'
    )
    // Mesmo minimo que a tela mostrava: o valor digitado ficou abaixo.
    assert.equal(
      nb(L.erroDoLance('abaixo_minimo:1500', { vistoCents: 1500 }).mensagem),
      'O valor informado está abaixo do lance mínimo de R$ 15,00.'
    )
    assert.equal(L.erroDoLance('ERROR: leilao_fechado').codigo, 'leilao_fechado')
    assert.equal(L.erroDoLance('xyz').status, 500)
    for (const [c, st] of [['pedido_invalido', 400], ['idem_invalido', 400], ['nao_autenticado', 401]]) {
      assert.equal(L.erroDoLance(c).codigo, c)
      assert.equal(L.erroDoLance(c).status, st)
    }
    const jwt = L.erroDoLance('JWT expired', { httpStatus: 401, pgCode: 'PGRST301' })
    assert.equal(jwt.codigo, 'sessao_expirada')
    assert.equal(jwt.status, 401)
    assert.equal(jwt.mensagem, 'Sua sessão expirou. Entre de novo para dar lance.')
    assert.equal(L.erroDoLance('canceling statement due to lock timeout', { pgCode: '55P03' }).status, 503)
    const codigos = [
      'nao_autenticado', 'pedido_invalido', 'cadastro_incompleto', 'suspenso',
      'leilao_fechado', 'idem_invalido', 'proprio_leilao',
    ]
    for (const c of codigos) {
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

  ok(() => {
    // Pix: sem estimativa de custo, nunca "zero".
    const p = T.calcularArremate(5000, 'pix')
    assert.equal(p.custoStripeEstimadoCents, null)
    assert.equal(p.bynxLiquidoEstimadoCents, null)
    assert.equal(typeof T.calcularArremate(5000).bynxLiquidoEstimadoCents, 'number')
  }, 'pix: custo e liquido Bynx sem estimativa (null)')

  ok(() => {
    // Pedido de 3 lotes: fixa de R$ 0,40 e minimo de R$ 2 UMA vez, sobre o total.
    const precos = [1000, 1500, 2500] // 50,00 no total
    const ped = T.calcularPedidoLeilao(precos)
    assert.equal(ped.precoCents, 5000)
    assert.equal(ped.nLotes, 3)
    assert.equal(ped.comissaoVendedorCents, 350 + 40) // 6,99% de 50 + UMA fixa
    assert.equal(ped.protecaoCents, 250) // 5% de 50 (acima do minimo)
    assert.equal(ped.custoMetodoCents, 240) // 4,8% de 50
    assert.equal(ped.compradorPagaCents, 5000 + 250 + 240)
    assert.equal(ped.vendedorRecebeCents, 5000 - 390)
    assert.equal(ped.compradorPagaCents - ped.applicationFeeCents, ped.vendedorRecebeCents)
    // Igual a um lote so do mesmo valor total: a conta nao depende de quantos itens.
    const um = T.calcularArremate(5000)
    for (const k of ['comissaoVendedorCents', 'protecaoCents', 'custoMetodoCents', 'compradorPagaCents', 'vendedorRecebeCents', 'applicationFeeCents']) {
      assert.equal(ped[k], um[k], k)
    }
    // Somar 3 arremates separados cobraria a fixa 3x e o minimo 3x: o pedido cobra menos.
    const separados = precos.map(p => T.calcularArremate(p))
    const somaFixas = separados.reduce((a, x) => a + x.comissaoVendedorCents, 0)
    const somaProtecao = separados.reduce((a, x) => a + x.protecaoCents, 0)
    assert.ok(ped.comissaoVendedorCents <= somaFixas, 'comissao por pedido <= soma por item')
    assert.equal(somaProtecao, 200 + 200 + 200) // cada item cairia no minimo
    assert.ok(ped.protecaoCents < somaProtecao, 'minimo da protecao uma vez so')
    // Invariante: metodo nao muda o liquido do vendedor, tambem no pedido.
    assert.equal(T.calcularPedidoLeilao(precos, 'pix').vendedorRecebeCents, ped.vendedorRecebeCents)
    assert.equal(T.calcularPedidoLeilao(precos, 'pix').bynxLiquidoEstimadoCents, null)
  }, 'pedido de 3 lotes: fixa e minimo uma vez por pedido')

  ok(() => {
    // 3 lotes pequenos (R$ 5 cada = R$ 15): abaixo de R$ 20 nao ha fixa; protecao no minimo UMA vez.
    const ped = T.calcularPedidoLeilao([500, 500, 500])
    assert.equal(ped.comissaoVendedorCents, 105)
    assert.equal(ped.protecaoCents, 200)
    // Invalidos nao entram; pedido vazio zera.
    assert.equal(T.calcularPedidoLeilao([1000, 0, -5, NaN]).nLotes, 1)
    assert.equal(T.calcularPedidoLeilao([]).compradorPagaCents, 0)
  }, 'pedido de 3 lotes pequenos e entradas invalidas')

  ok(() => {
    const agora = Date.parse('2026-09-28T12:00:00Z')
    const s = Math.floor(agora / 1000)
    const h = 3600 * 1000
    const m = 60 * 1000
    // Prazo de 48h: a sessao para no teto de 24h da Stripe (menos a folga).
    assert.equal(L.expiraSessaoLeilao(agora + 48 * h, agora), s + 24 * 3600 - 60)
    // Prazo de 5h: a sessao vence em pagar_ate + 14 min (dentro da carencia de 15 do tick).
    assert.equal(L.expiraSessaoLeilao(agora + 5 * h, agora), s + 5 * 3600 + 14 * 60)
    assert.equal(L.SESSAO_ALEM_DO_PRAZO_SEG, 14 * 60)
    // Prazo de 23h50: a extensao esbarra no teto de 24h da Stripe.
    assert.equal(L.expiraSessaoLeilao(agora + 23 * h + 50 * m, agora), s + 24 * 3600 - 60)
    // 30 min ate o prazo: antes recusava, agora cabe (30 + 14 >= 31).
    assert.equal(L.expiraSessaoLeilao(agora + 30 * m, agora), s + 44 * 60)
    // Limite: 17 min ate o prazo -> 31 min de sessao, o minimo com folga.
    assert.equal(L.expiraSessaoLeilao(agora + 17 * m, agora), s + 31 * 60)
    // 16 min ate o prazo: nem com a extensao cabe o minimo da Stripe.
    assert.equal(L.expiraSessaoLeilao(agora + 16 * m, agora), null)
    // Prazo vencido (mesmo dentro da carencia): nao abre.
    assert.equal(L.expiraSessaoLeilao(agora - 5 * m, agora), null)
    assert.equal(L.expiraSessaoLeilao(agora, agora), null)
    assert.equal(L.expiraSessaoLeilao(agora - h, agora), null)
    assert.equal(L.expiraSessaoLeilao(NaN, agora), null)
    // Nunca passa de pagar_ate + 14 min em nenhum prazo.
    for (let min = 17; min <= 48 * 60; min += 7) {
      const e = L.expiraSessaoLeilao(agora + min * m, agora)
      assert.ok(e != null && e <= s + min * 60 + 14 * 60 && e >= s + 31 * 60, `prazo ${min} min -> ${e}`)
    }
  }, 'expires_at da sessao: ate pagar_ate + 14 min, minimo 30 min e teto 24h da Stripe')

  ok(() => {
    // O pedido gravado fecha com a Stripe: total - liquido = application_fee.
    for (const [preco, frete] of [[5000, 2000], [1500, 0], [123456, 3590]]) {
      const a = T.calcularArremate(preco)
      const acrescimo = a.protecaoCents + a.custoMetodoCents
      const total = preco + acrescimo + frete
      const liquido = a.vendedorRecebeCents + frete
      assert.equal(total, a.compradorPagaCents + frete)
      assert.equal(total - liquido, a.applicationFeeCents)
    }
  }, 'pedido do arremate: total - liquido = application_fee (frete integral)')

  // ─── Avisos (fatia 3): matriz, debounce e ultimos 15 min ─────────────────
  {
    const agora = Date.parse('2026-09-28T15:00:00Z')
    const min = 60 * 1000
    const iso = (t) => new Date(t).toISOString()
    const lote = (o = {}) => ({
      id: 'L1', slug: 'charizard-ex-abc123', card_name: 'Charizard ex', status: 'ativo',
      termina_em: iso(agora + 60 * min), pagar_ate: null, lider_user_id: 'U9',
      vendedor_user_id: 'V1', preco_atual_cents: 5000, ...o,
    })
    const ev = (id, tipo, o = {}) => ({
      id, leilao_id: 'L1', tipo, user_id: 'U1', payload: {}, created_at: iso(agora),
      tentativas: 1, sino_em: null, email_em: null, ultimo_email_superado_em: null, ...o,
    })
    const plano = (evs, l = lote()) => A.planejarAvisos(evs, new Map([[l.id, l]]), agora)

    ok(() => {
      assert.equal(A.prazoCurtoBrasilia('2026-09-30T00:30:00Z'), '29/09 21:30')
      assert.equal(A.prazoCurtoBrasilia('2026-01-01T03:00:00Z'), '01/01 00:00')
      assert.equal(A.prazoCurtoBrasilia(null), '')
      assert.equal(A.prazoCurtoBrasilia('lixo'), '')
      assert.equal(A.linkLote('x-abc123'), '/leiloes/x-abc123')
    }, 'avisos: prazo curto em Brasilia e link do lote')

    ok(() => {
      const [p] = plano([ev(1, 'superado', { payload: { preco_cents: 5000, minimo_proximo_cents: 5500 } })])
      assert.equal(p.sinos.length, 1)
      assert.equal(p.sinos[0].user_id, 'U1')
      assert.equal(p.sinos[0].data.link, '/leiloes/charizard-ex-abc123')
      assert.equal(p.emails.length, 1)
      assert.equal(p.emails[0].modelo, 'superado')
      assert.equal(p.emails[0].minimoProximoCents, 5500)
      // Preco mudou depois do evento: o minimo do payload envelheceu e sai.
      const [q] = plano([ev(1, 'superado', { payload: { preco_cents: 4000, minimo_proximo_cents: 4400 } })])
      assert.equal(q.emails[0].minimoProximoCents, undefined)
    }, 'avisos: superado -> sino + e-mail')

    ok(() => {
      // Ultimos 15 min: so sino.
      let [p] = plano([ev(1, 'superado')], lote({ termina_em: iso(agora + 14 * min) }))
      assert.equal(p.sinos.length, 1)
      assert.equal(p.emails.length, 0)
      ;[p] = plano([ev(1, 'superado')], lote({ termina_em: iso(agora + 15 * min) }))
      assert.equal(p.emails.length, 1)
      // Lote ao vivo de 60s: nunca e-mail.
      ;[p] = plano([ev(1, 'superado')], lote({ termina_em: iso(agora + 40 * 1000) }))
      assert.equal(p.emails.length, 0)
      // Debounce: e-mail de superado ha 9 min -> so sino; ha 10 min -> e-mail.
      ;[p] = plano([ev(1, 'superado', { ultimo_email_superado_em: iso(agora - 9 * min) })])
      assert.equal(p.sinos.length, 1)
      assert.equal(p.emails.length, 0)
      ;[p] = plano([ev(1, 'superado', { ultimo_email_superado_em: iso(agora - 10 * min) })])
      assert.equal(p.emails.length, 1)
      // Lote ja fechado: so sino.
      ;[p] = plano([ev(1, 'superado')], lote({ status: 'aguardando_pagamento' }))
      assert.equal(p.emails.length, 0)
      // Retry com e-mail ja enviado: nao reenvia.
      ;[p] = plano([ev(1, 'superado', { email_em: iso(agora - min) })])
      assert.equal(p.emails.length, 0)
    }, 'avisos: superado sem e-mail nos ultimos 15 min e debounce de 10 min')

    ok(() => {
      // Tres superados do mesmo usuario + lote no mesmo lote de eventos: um aviso so.
      const ps = plano([ev(1, 'superado'), ev(2, 'superado', { user_id: 'U2' }), ev(3, 'superado'), ev(4, 'superado')])
      assert.deepEqual(ps.map(p => p.sinos.length), [0, 1, 0, 1])
      assert.deepEqual(ps.map(p => p.emails.length), [0, 1, 0, 1])
      // Quem voltou a liderar nao recebe nada.
      const [p] = plano([ev(1, 'superado')], lote({ lider_user_id: 'U1' }))
      assert.equal(p.sinos.length + p.emails.length, 0)
    }, 'avisos: superados agrupados por usuario + lote')

    ok(() => {
      const pagar = '2026-09-30T00:30:00Z'
      let [p] = plano([ev(1, 'venceu')], lote({ status: 'aguardando_pagamento', lider_user_id: 'U1', pagar_ate: pagar }))
      assert.equal(p.sinos.length, 1)
      assert.equal(p.sinos[0].title, 'Você venceu: Charizard ex')
      assert.equal(p.sinos[0].message, 'Pague até 29/09 21:30 (Brasília).')
      assert.equal(p.emails.length, 1)
      assert.equal(p.emails[0].modelo, 'venceu')
      assert.equal(p.emails[0].pagarAte, pagar)
      // Ja pago (vendido): nada.
      ;[p] = plano([ev(1, 'venceu')], lote({ status: 'vendido', lider_user_id: 'U1' }))
      assert.equal(p.sinos.length + p.emails.length, 0)
    }, 'avisos: venceu -> sino + e-mail com prazo, so se ainda aguarda pagamento')

    ok(() => {
      let [p] = plano([ev(1, 'encerrado', { user_id: null, payload: { resultado: 'sem_lances' } })],
        lote({ status: 'sem_lances', lider_user_id: null }))
      assert.equal(p.sinos[0].user_id, 'V1')
      assert.equal(p.emails[0].modelo, 'sem_lances')
      assert.equal(p.emails[0].userId, 'V1')
      // Encerrado com vencedor: quem avisa e o 'venceu'.
      ;[p] = plano([ev(1, 'encerrado', { user_id: null, payload: { resultado: 'aguardando_pagamento' } })],
        lote({ status: 'aguardando_pagamento' }))
      assert.equal(p.sinos.length + p.emails.length, 0)
    }, 'avisos: encerrado sem lances -> vendedor')

    ok(() => {
      let [p] = plano([ev(1, 'calote')], lote({ status: 'calote', lider_user_id: 'U1' }))
      assert.deepEqual(p.sinos.map(s => s.user_id), ['U1', 'V1'])
      assert.deepEqual(p.emails.map(e => e.modelo), ['calote_vencedor', 'calote_vendedor'])
      // Pagamento tardio reverteu para vendido: nada sai.
      ;[p] = plano([ev(1, 'calote')], lote({ status: 'vendido' }))
      assert.equal(p.sinos.length + p.emails.length, 0)
    }, 'avisos: calote -> vencedor e vendedor, so se ainda em calote')

    ok(() => {
      for (const t of ['pago', 'reembolsado', 'iniciado', 'teto_ajustado', 'erro_tick']) {
        const [p] = plano([ev(1, t)])
        assert.equal(p.sinos.length + p.emails.length, 0, t)
      }
      const [p] = A.planejarAvisos([ev(1, 'venceu')], new Map(), agora)
      assert.equal(p.nota, 'sem_lote')
      assert.ok(A.emailEnviavel('a@b.co'))
      assert.ok(!A.emailEnviavel('sem-arroba'))
      assert.ok(!A.emailEnviavel(null))
      assert.ok(!A.emailEnviavel('a b@c.com'))
      // Copy sem contracao e sem emoji.
      const textos = plano([ev(1, 'calote')], lote({ status: 'calote', lider_user_id: 'U1' }))[0].sinos
        .concat(plano([ev(1, 'venceu')], lote({ status: 'aguardando_pagamento', lider_user_id: 'U1', pagar_ate: iso(agora) }))[0].sinos)
        .concat(plano([ev(1, 'superado')])[0].sinos)
        .flatMap(s => [s.title, s.message])
      for (const t of textos) {
        assert.ok(!/\b(pra|pro|num|numa)\b/i.test(t), `contracao: ${t}`)
        assert.ok(!/\p{Extended_Pictographic}/u.test(t), `emoji: ${t}`)
      }
    }, 'avisos: tipos sem aviso, e-mail enviavel, copy limpa')

    ok(() => {
      // Rodada cancelada (leilao_cancelar_rodada, 20260928130000): so sino ao seguidor.
      let [p] = plano([ev(1, 'cancelado', { user_id: 'S1', payload: { motivo: 'x' } })], lote({ status: 'cancelado' }))
      assert.equal(p.sinos.length, 1)
      assert.equal(p.sinos[0].user_id, 'S1')
      assert.equal(p.sinos[0].title, 'Leilão cancelado')
      assert.match(p.sinos[0].message, /Charizard ex/)
      assert.equal(p.sinos[0].data.link, '/leiloes/charizard-ex-abc123')
      assert.equal(p.emails.length, 0, 'cancelado nunca manda e-mail')
      // Retry sem e-mail marcado: continua sem e-mail.
      ;[p] = plano([ev(1, 'cancelado', { user_id: 'S1', tentativas: 3 })], lote({ status: 'cancelado' }))
      assert.equal(p.emails.length, 0)
      // Lote que nao esta mais cancelado (estado mudou): nada.
      ;[p] = plano([ev(1, 'cancelado', { user_id: 'S1' })], lote({ status: 'agendado' }))
      assert.equal(p.sinos.length + p.emails.length, 0)
      // Sem usuario: nada.
      ;[p] = plano([ev(1, 'cancelado', { user_id: null })], lote({ status: 'cancelado' }))
      assert.equal(p.nota, 'sem_usuario')
      // Varios seguidores do mesmo lote: um sino para cada (nao agrupa como superado).
      const ps = plano([ev(1, 'cancelado', { user_id: 'S1' }), ev(2, 'cancelado', { user_id: 'S2' })], lote({ status: 'cancelado' }))
      assert.deepEqual(ps.map(x => x.sinos[0]?.user_id), ['S1', 'S2'])
      for (const t of [p.sinos, ps[0].sinos].flat().flatMap(s => [s.title, s.message])) {
        assert.ok(!/\b(pra|pro|num|numa)\b/i.test(t), `contracao: ${t}`)
        assert.ok(!/\p{Extended_Pictographic}/u.test(t), `emoji: ${t}`)
      }
    }, 'avisos: cancelado -> so sino ao seguidor, sem e-mail')
  }

  // ─── email-lote: grupo nunca partido, isolamento do endereco ruim ─────────
  {
    const mk = (to, grupo, extra = {}) => ({ to, subject: 's', html: 'h', grupo, ...extra })
    // Remetente falso: recusa (validation_error) todo lote com "ruim", aceita o resto.
    const falso = (opt = {}) => {
      const log = []
      return {
        log,
        lote: async itens => {
          log.push(['lote', itens.map(i => i.to)])
          if (opt.lote) return opt.lote(itens)
          return itens.some(i => i.to.startsWith('ruim'))
            ? { ok: false, nome: 'validation_error', erro: 'Invalid `to` field' }
            : { ok: true }
        },
        um: async item => {
          log.push(['um', item.to, item.chave])
          if (opt.um) return opt.um(item)
          return item.to.startsWith('ruim')
            ? { ok: false, nome: 'validation_error', erro: 'Invalid `to` field' }
            : { ok: true }
        },
      }
    }

    await (async () => {
      const g = EL.empacotar(EL.agrupar([mk('a', 1), mk('b', 1), mk('c', 2), mk('d', 3), mk('e', 3)]), 3)
      assert.deepEqual(g, [[[0, 1], [2]], [[3, 4]]])
      const g2 = EL.empacotar(EL.agrupar([mk('a', 1), mk('b', 2), mk('c', 2), mk('d', 2)]), 3)
      assert.deepEqual(g2, [[[0]], [[1, 2, 3]]])
      n++; console.log('ok ', 'email-lote: grupo inteiro no mesmo lote')
    })()

    await (async () => {
      const itens = [mk('a', 1), mk('b', 1), mk('c', 2), mk('ruim', 3, { chave: 'k3' }), mk('e', 4), mk('f', 5)]
      const r = falso()
      const res = await EL.enviarIsolando(itens, r)
      assert.deepEqual(res.map(x => x.ok), [true, true, true, false, true, true])
      assert.match(res[3].erro, /^validation_error/)
      // O ruim so saiu com erro depois de isolado e tentado sozinho, com chave.
      assert.deepEqual(r.log.filter(l => l[0] === 'um'), [['um', 'ruim', 'k3']])
      n++; console.log('ok ', 'email-lote: recusa de conteudo isola so o culpado')
    })()

    await (async () => {
      // Erro que nao e de conteudo: lote inteiro falha, sem divisao.
      const r = falso({ lote: async () => ({ ok: false, nome: 'rate_limit_exceeded', erro: 'x' }) })
      const res = await EL.enviarIsolando([mk('a', 1), mk('b', 2), mk('c', 3)], r)
      assert.ok(res.every(x => !x.ok && x.erro.startsWith('rate_limit_exceeded')))
      assert.equal(r.log.length, 1)
      // Excecao do provedor vira erro, nao derruba.
      const r2 = falso({ lote: async () => { throw new Error('rede') } })
      const res2 = await EL.enviarIsolando([mk('a', 1), mk('b', 2)], r2)
      assert.ok(res2.every(x => !x.ok && x.erro === 'rede'))
      n++; console.log('ok ', 'email-lote: erro transitorio nao divide')
    })()

    await (async () => {
      // Grupo com 2 e-mails, um ruim: dentro do grupo cai para um a um.
      const r = falso()
      const res = await EL.enviarIsolando([mk('a', 1), mk('ruim', 1), mk('c', 2)], r)
      assert.deepEqual(res.map(x => x.ok), [true, false, true])
      // unitario: fora do lote, com chave; chave ja usada conta como enviado.
      const r2 = falso({ um: async i => i.to === 'x' ? { ok: false, nome: 'invalid_idempotent_request', erro: 'x' } : { ok: true } })
      const res2 = await EL.enviarIsolando([mk('x', 7, { unitario: true, chave: 'k7' }), mk('y', 8)], r2)
      assert.deepEqual(res2.map(x => x.ok), [true, true])
      assert.deepEqual(r2.log, [['um', 'y', undefined], ['um', 'x', 'k7']])
      n++; console.log('ok ', 'email-lote: grupo com item ruim e envio unitario com chave')
    })()

    await (async () => {
      // Sem tempo: nada chamado depois do corte; pausa entre chamadas.
      let chamadas = 0
      const pausas = []
      const r = falso({ lote: async () => { chamadas++; return { ok: true } } })
      const res = await EL.enviarIsolando(
        [mk('a', 1), mk('b', 1), mk('c', 2), mk('d', 2)], r,
        { tamanho: 2, deveParar: () => chamadas >= 1, pausaMs: 500, esperar: async ms => { pausas.push(ms) } })
      assert.deepEqual(res.map(x => x.ok ? 'ok' : x.erro), ['ok', 'ok', 'sem_tempo', 'sem_tempo'])
      assert.deepEqual(pausas, [])
      let c2 = 0
      const r2 = falso({ lote: async () => { c2++; return { ok: true } } })
      await EL.enviarIsolando([mk('a', 1), mk('b', 1), mk('c', 2), mk('d', 2)], r2,
        { tamanho: 2, pausaMs: 500, esperar: async ms => { pausas.push(ms) } })
      assert.equal(c2, 2)
      assert.deepEqual(pausas, [500])
      n++; console.log('ok ', 'email-lote: orcamento de tempo e pausa')
    })()
  }

  // ─── Painel da loja (fatia 5) ─────────────────────────────────────────────
  ok(() => {
    assert.equal(P.sugestaoLanceInicialCents(100), 6000)
    assert.equal(P.sugestaoLanceInicialCents(10.99), 600)
    assert.equal(P.sugestaoLanceInicialCents(0.5), 100)
    assert.equal(P.sugestaoLanceInicialCents(0), null)
    assert.equal(P.sugestaoLanceInicialCents(null), null)
    assert.equal(P.sugestaoLanceInicialCents(NaN), null)
  }, 'painel: sugestao 60% do menor preco, sem preco nao sugere')

  ok(() => {
    assert.equal(P.reaisParaCents('1.234,56'), 123456)
    assert.equal(P.reaisParaCents('12,5'), 1250)
    assert.equal(P.reaisParaCents('12'), 1200)
    assert.equal(P.reaisParaCents('12.50'), 1250)
    assert.equal(P.reaisParaCents('1.000'), 100000)
    assert.equal(P.reaisParaCents('R$ 60,00'), 6000)
    assert.equal(P.reaisParaCents(''), null)
    assert.equal(P.reaisParaCents('0'), null)
  }, 'painel: reais digitados para centavos')

  ok(() => {
    assert.equal(P.brasiliaParaISO('2026-09-28', '21:30'), '2026-09-29T00:30:00.000Z')
    assert.equal(P.brasiliaParaISO('2026-12-31', '23:59'), '2027-01-01T02:59:00.000Z')
    assert.equal(P.brasiliaParaISO('2026-02-31', '10:00'), null)
    assert.equal(P.brasiliaParaISO('2026-09-28', '24:00'), null)
    assert.equal(P.brasiliaParaISO('28/09/2026', '10:00'), null)
    assert.deepEqual(P.isoParaBrasilia('2026-09-29T00:30:00.000Z'), { data: '2026-09-28', hora: '21:30' })
    assert.deepEqual(P.isoParaBrasilia(null), { data: '', hora: '' })
    const ida = P.brasiliaParaISO('2026-01-01', '00:05')
    const volta = P.isoParaBrasilia(ida)
    assert.deepEqual(volta, { data: '2026-01-01', hora: '00:05' })
  }, 'painel: horario de Brasilia ida e volta')

  ok(() => {
    assert.equal(P.validarRodada({ titulo: 'ab' }, false).ok, false)
    const r = P.validarRodada({ titulo: '  Live de sexta  ', link_transmissao: 'https://instagram.com/loja' }, false)
    assert.equal(r.ok, true)
    assert.equal(r.valor.titulo, 'Live de sexta')
    assert.equal(P.validarRodada({ link_transmissao: 'http://x.com' }, true).ok, false)
    assert.equal(P.validarRodada({ link_transmissao: 'javascript:alert(1)' }, true).ok, false)
    assert.equal(P.validarRodada({ inicia_em: 'ontem' }, true).ok, false)
    const limpa = P.validarRodada({ inicia_em: '', link_transmissao: '' }, true)
    assert.equal(limpa.valor.iniciaEm, null)
    assert.equal(limpa.valor.linkTransmissao, null)
    for (const l of ['https://youtube.com/live/x', 'https://www.youtube.com/watch?v=1', 'https://m.youtube.com/x',
      'https://youtu.be/abc', 'https://www.instagram.com/loja/live', 'https://twitch.tv/loja',
      'https://m.twitch.tv/loja', 'https://www.tiktok.com/@loja/live']) {
      assert.equal(P.linkValido(l), true, l)
    }
    for (const l of ['https://evil.test/live', 'https://youtube.com.evil.test/x', 'https://notyoutube.com/x',
      'https://studio.youtube.com/x', 'https://u:p@youtube.com/x', 'https://youtube.com:8443/x', 'http://youtube.com/x']) {
      assert.equal(P.linkValido(l), false, l)
    }
    const agora = Date.parse('2026-09-28T12:00:00Z')
    assert.equal(P.validarRodada({ inicia_em: '2026-11-27T12:00:00Z' }, true, agora).ok, true)
    assert.equal(P.validarRodada({ inicia_em: '2026-11-27T12:00:01Z' }, true, agora).ok, false)
  }, 'painel: validacao da rodada (hosts da transmissao, inicio ate 60 dias)')

  ok(() => {
    const LJ = '11111111-2222-4333-8444-555555555555'
    const pasta = `https://abc.supabase.co/storage/v1/object/public/loja-fotos/leiloes/${LJ}/`
    const opts = { fotosDaLoja: { origemSupabase: 'https://abc.supabase.co', lojaId: LJ }, graduadorasValidas: ['psa', 'cgc'] }
    const base = {
      card_id: 'sv3pt5-199',
      fotos: [`${pasta}0f8b6c1e-1a2b-4c3d-8e4f-000000000001.webp`, `${pasta}0f8b6c1e-1a2b-4c3d-8e4f-000000000002.jpg`],
      condicao: 'nm', idioma: 'EN', lance_inicial_cents: 1000, duracao_seg: 45,
    }
    const r = P.validarLote(base, opts)
    assert.equal(r.ok, true)
    assert.equal(r.valor.condicao, 'NM')
    assert.equal(r.valor.idioma, 'en')
    assert.equal(r.valor.graduadora, null)
    assert.equal(P.validarLote({ ...base, fotos: [base.fotos[0]] }, opts).ok, false)
    assert.equal(P.validarLote({ ...base, fotos: [base.fotos[0], base.fotos[0]] }, opts).ok, false)
    assert.equal(P.validarLote({ ...base, fotos: ['https://outro.test/a.webp', base.fotos[1]] }, opts).ok, false)
    assert.equal(P.validarLote({ ...base, condicao: 'LP' }, opts).ok, false)
    assert.equal(P.validarLote({ ...base, condicao: 'M' }, opts).ok, true)
    assert.equal(P.validarLote({ ...base, duracao_seg: 20 }, opts).ok, false)
    assert.equal(P.validarLote({ ...base, lance_inicial_cents: 99 }, opts).ok, false)
    assert.equal(P.validarLote({ ...base, lance_inicial_cents: 10.5 }, opts).ok, false)
    assert.equal(P.validarLote({ ...base, card_id: '' }, opts).ok, false)
    assert.equal(P.validarLote({ ...base, graduadora: 'bgs', nota: '9' }, opts).ok, false)
    assert.equal(P.validarLote({ ...base, graduadora: 'psa' }, opts).ok, false)
    assert.equal(P.validarLote({ ...base, nota: '9' }, opts).ok, false)
    const g = P.validarLote({ ...base, graduadora: 'PSA', nota: '9,5' }, opts)
    assert.equal(g.ok, true)
    assert.equal(g.valor.graduadora, 'psa')
    assert.equal(g.valor.nota, '9.5')
    assert.equal(P.validarLote({ ...base, graduadora: 'psa', nota: '11' }, opts).ok, false)
    assert.equal(P.validarLote({ ...base, fotos: ['qualquer', 'coisa'] }, { ...opts, fotosDaLoja: null }).ok, true)
  }, 'painel: validacao do lote (fotos, condicao, graduacao, lance, duracao)')

  ok(() => {
    const LJ = '11111111-2222-4333-8444-555555555555'
    const OUTRA = '99999999-2222-4333-8444-555555555555'
    const O = 'https://abc.supabase.co'
    const nome = '0f8b6c1e-1a2b-4c3d-8e4f-000000000001'
    const pasta = `${O}/storage/v1/object/public/loja-fotos/leiloes/${LJ}/`
    const v = u => P.fotoLeilaoValida(u, O, LJ)
    assert.equal(v(`${pasta}${nome}.webp`), true)
    assert.equal(v(`${pasta}${nome}.jpeg`), true)
    assert.equal(v(`${pasta}${nome}.png`), true)
    assert.equal(v(`${pasta}${nome}.gif`), false, 'extensao fora da lista')
    assert.equal(v(`${pasta}foto.webp`), false, 'nome que nao e uuid')
    assert.equal(v(`${pasta}../${OUTRA}/${nome}.webp`), false, '../')
    assert.equal(v(`${pasta}%2e%2e/${OUTRA}/${nome}.webp`), false, '%2e')
    assert.equal(v(`${pasta}%2E%2E%2F${nome}.webp`), false, '%2E maiusculo')
    assert.equal(v(`${pasta}x%2f${nome}.webp`), false, '%2f')
    assert.equal(v(`${O}/storage/v1/object/public/loja-fotos/leiloes/${OUTRA}/${nome}.webp`), false, 'outra loja')
    assert.equal(v(`${O}/storage/v1/object/public/outro-bucket/leiloes/${LJ}/${nome}.webp`), false, 'outro bucket')
    assert.equal(v(`${O}/storage/v1/object/public/loja-fotos/produtos/${LJ}/${nome}.webp`), false, 'outra pasta')
    assert.equal(v(`${pasta}${nome}.webp?download=1`), false, 'query')
    assert.equal(v(`${pasta}${nome}.webp#x`), false, 'hash')
    assert.equal(v(`https://evil.test/storage/v1/object/public/loja-fotos/leiloes/${LJ}/${nome}.webp`), false, 'outro host')
    assert.equal(v(`https://abc.supabase.co.evil.test/storage/v1/object/public/loja-fotos/leiloes/${LJ}/${nome}.webp`), false, 'host sufixo')
    assert.equal(v(`https://u:p@abc.supabase.co/storage/v1/object/public/loja-fotos/leiloes/${LJ}/${nome}.webp`), false, 'credencial')
    assert.equal(v(`http://abc.supabase.co/storage/v1/object/public/loja-fotos/leiloes/${LJ}/${nome}.webp`), false, 'http')
    assert.equal(v(`${pasta}${nome}.webp `), false, 'espaco')
    assert.equal(v(`${pasta.replace('/leiloes/', '//leiloes/')}${nome}.webp`), false, 'barra dupla')
    assert.equal(P.fotoLeilaoValida(`${pasta}${nome}.webp`, O, 'nao-uuid'), false, 'loja invalida')
  }, 'painel: URL da foto so da pasta da loja (../, %2e, outra loja, outro bucket, query)')

  ok(() => {
    const LJ = '11111111-2222-4333-8444-555555555555'
    const OUTRA = '99999999-2222-4333-8444-555555555555'
    const O = 'https://abc.supabase.co'
    const nome = '0f8b6c1e-1a2b-4c3d-8e4f-000000000001'
    const url = `${O}/storage/v1/object/public/loja-fotos/leiloes/${LJ}/${nome}.webp`
    assert.equal(P.caminhoFotoLeilao(url, O, LJ), `leiloes/${LJ}/${nome}.webp`)
    assert.equal(P.caminhoFotoLeilao(url, O, OUTRA), null, 'foto de outra loja')
    assert.equal(P.caminhoFotoLeilao(url.replace(`/${LJ}/`, `/${LJ}/../${OUTRA}/`), O, LJ), null, '../')
    assert.equal(P.caminhoFotoLeilao('https://images.pokemontcg.io/x.png', O, LJ), null, 'imagem do catalogo')
    assert.equal(P.caminhoFotoLeilao(url, 'https://outro.supabase.co', LJ), null, 'outro host')
    assert.equal(P.caminhoFotoLeilao('', O, LJ), null)
  }, 'painel: caminho da foto para apagar (so da pasta da loja)')

  ok(() => {
    const agora = Date.parse('2026-09-28T12:00:00Z')
    const em = s => new Date(agora + s * 1000).toISOString()
    assert.equal(P.intervaloPolling(null, agora), 5000)
    assert.equal(P.intervaloPolling(em(31), agora), 5000)
    assert.equal(P.intervaloPolling(em(30), agora), 2000)
    assert.equal(P.intervaloPolling(em(1), agora), 2000)
    assert.equal(P.intervaloPolling(em(-3), agora), 2000, 'vencido: fechamento a caminho')
    assert.equal(P.intervaloPolling('lixo', agora), 5000)
  }, 'painel ao vivo: polling 5s, 2s nos ultimos 30s')

  ok(() => {
    const r = P.resultadoDoLote
    assert.equal(r('agendado', null), 'na_fila')
    assert.equal(r('ativo', null), 'no_ar')
    assert.equal(r('aguardando_pagamento', 'aguardando_pagamento'), 'aguardando_pagamento')
    assert.equal(r('vendido', 'pago'), 'pago')
    assert.equal(r('vendido', null), 'pago')
    assert.equal(r('vendido', 'enviado'), 'enviado')
    assert.equal(r('vendido', 'entregue'), 'entregue')
    assert.equal(r('calote', null), 'calote')
    assert.equal(r('sem_lances', null), 'sem_lances')
    assert.equal(r('cancelado', 'reembolsado'), 'cancelado')
    for (const k of Object.keys(P.ROTULO_RESULTADO)) {
      const t = P.ROTULO_RESULTADO[k].label
      assert.ok(!/\b(pra|pro|num|numa)\b/i.test(t), `contracao: ${t}`)
    }
    const ped = (id, status, dia, leilao = 'L1') => ({ id, numero: 1, status, created_at: `2026-09-${dia}T12:00:00Z`, leilao_id: leilao })
    const lista = [ped('A', 'cancelado', 28), ped('B', 'aguardando_pagamento', 29), ped('C', 'pago', 27, 'L2')]
    assert.equal(P.pedidoDoLote('L1', null, lista)?.id, 'B', 'mais recente nao cancelado')
    assert.equal(P.pedidoDoLote('L1', 'C', lista)?.id, 'C', 'pedido_id do lote vence')
    assert.equal(P.pedidoDoLote('L1', null, [ped('A', 'cancelado', 28)])?.id, 'A', 'so cancelado')
    assert.equal(P.pedidoDoLote('L3', null, lista), null)
    const t = P.totaisRodada([
      { status: 'vendido', preco_atual_cents: 10000 },
      { status: 'aguardando_pagamento', preco_atual_cents: 5000 },
      { status: 'calote', preco_atual_cents: 2000 },
      { status: 'sem_lances', preco_atual_cents: null },
      { status: 'cancelado', preco_atual_cents: 3000 },
      { status: 'ativo', preco_atual_cents: 1500 },
    ])
    assert.deepEqual(t, { arrematadoCents: 17000, pagoCents: 10000, nArrematados: 3, nPagos: 1 })
  }, 'painel ao vivo: resultado por lote, pedido do lote e totais')

  ok(() => {
    const agora = Date.parse('2026-09-28T12:00:00Z')
    const ok2 = { fotos: ['a', 'b'] }
    assert.deepEqual(P.pendenciasAgendar({ iniciaEm: '2026-09-28T12:10:00Z', lotes: [ok2], podeReceber: true }, agora), [])
    const p = P.pendenciasAgendar({ iniciaEm: '2026-09-28T12:09:59Z', lotes: [{ fotos: ['a'] }, { fotos: null }], podeReceber: false }, agora)
    assert.equal(p.length, 3)
    assert.match(p[0], /2 lotes/)
    assert.match(p[1], /10 minutos/)
    assert.equal(P.pendenciasAgendar({ iniciaEm: null, lotes: [], podeReceber: true }, agora).length, 2)
  }, 'painel: pendencias antes de agendar')

  ok(() => {
    assert.equal(P.erroDoPainel('lote_sem_fotos:b500').status, 409)
    assert.equal(P.erroDoPainel('rodada_nao_encontrada').status, 404)
    assert.equal(P.erroDoPainel('inicio_cedo').status, 409)
    assert.equal(P.erroDoPainel('ordem_invalida').status, 409)
    assert.equal(P.erroDoPainel('deadlock detected').status, 500)
  }, 'painel: erros das RPCs')

  // ─── Rodada publica (src/lib/leilao-rodada.ts) ───
  const loteR = (o = {}) => ({
    id: 'x', codigo: 'abc123', slug: 's-abc123', rodadaId: 'r', ordem: 1, lojaId: null, cardId: null, cardSlug: null,
    cardName: 'Pikachu', cardNumero: null, setNome: null, cardImage: null, fotos: [], condicao: null, idioma: null,
    graduadora: null, nota: null, descricao: null, lanceInicialCents: 1000, precoAtualCents: null, liderApelido: null,
    nLances: 0, nParticipantes: 0, duracaoSeg: 60, softCloseSeg: 10, iniciaEm: null, terminaEm: null, prorrogacoes: 0,
    status: 'agendado', encerradoEm: null, versao: 0, game: 'pokemon', ...o,
  })

  ok(() => {
    assert.equal(R.numeroDaRodada('42'), 42)
    assert.equal(R.numeroDaRodada(' 7 '), 7)
    assert.equal(R.numeroDaRodada('042'), 42, 'zero a esquerda: a pagina redireciona 308 para o canonico')
    assert.equal(R.numeroDaRodada('0007'), 7)
    assert.equal(R.numeroDaRodada('000000000000000000000042'), 42)
    for (const v of ['0', '000', '-1', '1.5', 'abc', '', null, undefined, '1e3', '9999999999999999', '4 2', '+4']) {
      assert.equal(R.numeroDaRodada(v), null, `numero(${v})`)
    }
    assert.notEqual(String(R.numeroDaRodada('042')), '042', 'canonico difere do param -> 308')
    assert.equal(R.urlRodada(42), '/leiloes/rodada/42')
    assert.equal(R.tituloRodada({ titulo: '  ', numero: 3 }), 'Rodada #3')
    assert.equal(R.tituloRodada({ titulo: 'Live de sexta', numero: 3 }), 'Live de sexta')
  }, 'rodada: numero, url e titulo')

  ok(() => {
    assert.equal(R.deveIndexarRodada('agendada'), true)
    assert.equal(R.deveIndexarRodada('ao_vivo'), true)
    for (const st of ['encerrada', 'cancelada', 'rascunho']) assert.equal(R.deveIndexarRodada(st), false)
    const r = R.rodadaPublicaDeLinha({
      id: 'u', numero: '12', loja_id: null, titulo: '', descricao: null, modo: 'ao_vivo', status: 'xpto',
      inicia_em: '2026-09-28T12:00:00Z', link_transmissao: 'https://youtube.com/x', vendedor_user_id: 'segredo',
    })
    assert.equal(r.numero, 12)
    assert.equal(r.titulo, null)
    assert.equal(r.status, 'rascunho')
    assert.ok(!('vendedorUserId' in r) && !JSON.stringify(r).includes('segredo'), 'vendedor nao sai')
    assert.ok(!R.COLUNAS_RODADA.includes('vendedor_user_id'))
    assert.ok(!R.COLUNAS_LOTE_RODADA.includes('vendedor_user_id') && !R.COLUNAS_LOTE_RODADA.includes('lider_maximo'))
    const cols = R.COLUNAS_LOTE_RODADA.split(', ')
    assert.ok(!cols.includes('fotos') && !cols.includes('lider_apelido') && cols.includes('card_image'), 'polling enxuto')
    assert.deepEqual(R.COLUNAS_LOTE_ATIVO_EXTRA.split(', ').sort(), ['fotos', 'lider_apelido'])
    assert.equal(R.rotuloTituloRodada('ao_vivo'), 'leilão ao vivo')
    assert.equal(R.rotuloTituloRodada('agendada'), 'leilão agendado')
    assert.equal(R.rotuloTituloRodada('encerrada'), 'resultado do leilão')
    for (const st of ['agendada', 'encerrada', 'cancelada']) assert.ok(!R.rotuloTituloRodada(st).includes('ao vivo'), st)
  }, 'rodada: indexacao, mapeador e colunas publicas')

  ok(() => {
    const lotes = [
      loteR({ id: 'c', ordem: 3, status: 'agendado' }),
      loteR({ id: 'a', ordem: 1, status: 'aguardando_pagamento', precoAtualCents: 12000, nLances: 4 }),
      loteR({ id: 'b', ordem: 2, status: 'ativo' }),
      loteR({ id: 'd', ordem: 4, status: 'agendado' }),
      loteR({ id: 'e', ordem: 5, status: 'cancelado' }),
    ]
    const s1 = R.separarLotesRodada(lotes)
    assert.equal(s1.ativo.id, 'b')
    assert.deepEqual(s1.proximos.map(l => l.id), ['c', 'd'])
    assert.deepEqual(s1.encerrados.map(l => l.id), ['a', 'e'])
    assert.equal(R.separarLotesRodada([]).ativo, null)
  }, 'rodada: separar no ar, fila e encerrados pela ordem')

  ok(() => {
    const brl = L.formatarBRL(12000)
    assert.deepEqual(R.resultadoLoteRodada({ status: 'aguardando_pagamento', precoAtualCents: 12000, nLances: 3 }),
      { tipo: 'arrematado', texto: `Arrematado por ${brl}` })
    assert.equal(R.resultadoLoteRodada({ status: 'vendido', precoAtualCents: 12000, nLances: 1 }).tipo, 'arrematado')
    assert.deepEqual(R.resultadoLoteRodada({ status: 'sem_lances', precoAtualCents: null, nLances: 0 }),
      { tipo: 'sem_lances', texto: 'Sem lances' })
    assert.equal(R.resultadoLoteRodada({ status: 'cancelado', precoAtualCents: null, nLances: 0 }).texto, 'Cancelado')
    assert.equal(R.resultadoLoteRodada({ status: 'ativo', precoAtualCents: 100, nLances: 1 }), null)
    assert.equal(R.resultadoLoteRodada({ status: 'agendado', precoAtualCents: null, nLances: 0 }), null)
    for (const st of ['aguardando_pagamento', 'sem_lances', 'cancelado']) {
      const t = R.resultadoLoteRodada({ status: st, precoAtualCents: 500, nLances: 1 }).texto
      assert.ok(!/\b(pra|pro|num|numa)\b/i.test(t), `contracao: ${t}`)
      assert.ok(!/\p{Extended_Pictographic}/u.test(t), `emoji: ${t}`)
    }
  }, 'rodada: resultado do lote encerrado')

  ok(() => {
    const novos = [loteR({ id: 'a', status: 'sem_lances' }), loteR({ id: 'b', status: 'ativo' })]
    assert.equal(R.loteQueFechou('a', novos).id, 'a')
    assert.equal(R.loteQueFechou('b', novos), null, 'ainda ativo')
    assert.equal(R.loteQueFechou(null, novos), null)
    assert.equal(R.loteQueFechou('z', novos), null, 'sumiu')
    assert.equal(R.loteQueFechou('a', [loteR({ id: 'a', status: 'agendado' })]), null, 'voltou para a fila nao e resultado')
    const t0 = Date.parse('2026-09-28T12:00:00Z')
    const iso = ms => new Date(t0 + ms).toISOString()
    assert.equal(R.resultadoRecente(iso(0), t0 + 3000), true)
    assert.equal(R.resultadoRecente(iso(0), t0 + 9999), true)
    assert.equal(R.resultadoRecente(iso(0), t0 + 10000), false, 'aba voltando do fundo')
    assert.equal(R.resultadoRecente(iso(0), t0 + 120000), false)
    assert.equal(R.resultadoRecente(null, t0), true, 'sem encerrado_em nao esconde')
  }, 'rodada: lote que fechou entre duas leituras')

  ok(() => {
    const v1 = R.versaoRodada('ao_vivo', [{ versao: 3 }, { versao: 1 }])
    const v2 = R.versaoRodada('ao_vivo', [{ versao: 4 }, { versao: 1 }])
    const v3 = R.versaoRodada('encerrada', [{ versao: 4 }, { versao: 1 }])
    assert.ok(v2 > v1 && v3 > v2)
    assert.ok(R.versaoRodada('agendada', [{ versao: 1 }]) > R.versaoRodada('encerrada', [{ versao: 0 }]), 'lote vence rank')
    assert.equal(R.versaoRodada('agendada', []), 1)
  }, 'rodada: versao so cresce')

  ok(() => {
    const agora = Date.parse('2026-09-28T12:00:00Z')
    const em = s => new Date(agora + s * 1000).toISOString()
    assert.equal(R.intervaloPollRodada('agendada', null, agora), 30000)
    assert.equal(R.intervaloPollRodada('agendada', null, agora, null), 30000, 'sem horario')
    assert.equal(R.intervaloPollRodada('agendada', null, agora, em(600)), 30000, 'longe do inicio')
    assert.equal(R.intervaloPollRodada('agendada', null, agora, em(31)), 30000)
    assert.equal(R.intervaloPollRodada('agendada', null, agora, em(30)), 3000, '30s do inicio')
    assert.equal(R.intervaloPollRodada('agendada', null, agora, em(5)), 3000)
    assert.equal(R.intervaloPollRodada('agendada', null, agora, em(-20)), 3000, 'horario passou, servidor ainda nao abriu')
    assert.equal(R.intervaloPollRodada('ao_vivo', em(40), agora), 3000)
    assert.equal(R.intervaloPollRodada('ao_vivo', em(16), agora), 3000)
    assert.equal(R.intervaloPollRodada('ao_vivo', em(15), agora), 2000)
    assert.equal(R.intervaloPollRodada('ao_vivo', em(-3), agora), 2000, 'relogio zerado espera o fecho')
    assert.equal(R.intervaloPollRodada('ao_vivo', null, agora), 3000, 'entre lotes')
    assert.equal(R.intervaloPollRodada('encerrada', em(5), agora), null)
    assert.equal(R.intervaloPollRodada('cancelada', null, agora), null)
  }, 'rodada: intervalo do polling')

  // ─── URLs e transmissao (src/lib/leilao-urls.ts) ───
  ok(() => {
    assert.equal(U.urlHome(), '/leiloes')
    assert.equal(U.urlHome('ao-vivo'), '/leiloes', 'aba padrao sem query: canonico')
    assert.equal(U.urlHome('agenda'), '/leiloes?aba=agenda')
    assert.equal(U.urlHome('como-funciona'), '/leiloes?aba=como-funciona')
    assert.equal(U.abaValida('encerrados'), 'encerrados')
    for (const v of ['', null, undefined, 'xpto', 'AGENDA']) assert.equal(U.abaValida(v), 'ao-vivo', `aba(${v})`)
    assert.equal(U.urlLote('charizard-ex-abc123'), '/leiloes/charizard-ex-abc123')
    assert.equal(U.urlPagar('charizard-ex-abc123'), '/leiloes/charizard-ex-abc123/pagar')
    assert.equal(U.urlPagar('x-abc123', { cancelado: true }), '/leiloes/x-abc123/pagar?cancelado=1')
    assert.equal(U.urlRodada(42), '/leiloes/rodada/42')
    assert.equal(R.urlRodada, U.urlRodada, 'leilao-rodada reexporta a mesma funcao')
    assert.equal(U.urlMeusLances(), '/leiloes/meus-lances')
    assert.equal(U.urlMeusLances('pagar'), '/leiloes/meus-lances?aba=pagar')
    assert.equal(A.linkLote('x-abc123'), U.urlLote('x-abc123'), 'sino usa a mesma url')
    assert.equal(U.urlLote('a/b'), '/leiloes/a%2Fb', 'slug nunca abre caminho novo')
  }, 'urls: home, abas, lote, pagar, rodada, meus lances')

  ok(() => {
    const id = 'dQw4w9WgXcQ'
    const validos = [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtube.com/watch?v=${id}&t=30s`,
      `https://m.youtube.com/watch?feature=share&v=${id}`,
      `http://www.youtube.com/watch?v=${id}`,
      `www.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`,
      `https://youtu.be/${id}?si=abc`,
      `https://www.youtube.com/live/${id}`,
      `https://www.youtube.com/live/${id}?feature=shared`,
      `https://youtube.com/embed/${id}`,
      `https://www.youtube-nocookie.com/embed/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `  https://youtu.be/${id}  `,
    ]
    for (const v of validos) {
      assert.equal(U.idVideoYoutube(v), id, v)
      assert.equal(U.embedYoutube(v), `https://www.youtube-nocookie.com/embed/${id}`, v)
    }
    const invalidos = [
      'https://www.youtube.com/@vulcanocards',
      'https://www.youtube.com/@vulcanocards/live',
      'https://www.youtube.com/channel/UC1234567890',
      'https://www.youtube.com/c/Vulcano',
      'https://www.youtube.com/watch',
      'https://www.youtube.com/watch?v=curto',
      `https://www.youtube.com/watch?v=${id}x`,
      'https://www.instagram.com/vulcanocards/live/',
      `https://evil.test/watch?v=${id}`,
      `https://youtube.com.evil.test/watch?v=${id}`,
      `https://u:p@www.youtube.com/watch?v=${id}`,
      `javascript:alert(1)//youtu.be/${id}`,
      `https://youtu.be/`,
      '', null, undefined, 'nao e link',
    ]
    for (const v of invalidos) assert.equal(U.idVideoYoutube(v), null, `invalido: ${v}`)
    assert.equal(U.embedYoutube('https://www.youtube.com/@loja/live'), null, 'canal: so botao')
  }, 'transmissao: parser do YouTube (video vira embed, canal vira botao)')

  console.log(`\n${n} blocos ok`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
