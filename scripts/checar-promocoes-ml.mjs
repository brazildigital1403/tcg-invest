// Confere as promocoes da Selecao Bynx (ml_afiliado_produtos) contra o que o
// Mercado Livre mostra HOJE: link vivo, produto em destaque na landing do
// afiliado, titulo e preco. Roda antes de todo disparo da regua.
//
//   node --env-file=.env.local scripts/checar-promocoes-ml.mjs            (so le e lista)
//   node --env-file=.env.local scripts/checar-promocoes-ml.mjs --aplicar  (grava preco novo e desliga o que sumiu)
//   ... --chave email                                                      (so uma vitrine)
//
// O link curto (meli.la) cai na landing social do afiliado, que traz o produto
// em destaque como "polycard" com title.text e price.current_price.value (o
// preco grande da pagina, com o desconto do Pix quando ha). Sem polycard em
// destaque = produto pausado, esgotado ou link morto: desliga.
import { createClient } from '@supabase/supabase-js'

const APLICAR = process.argv.includes('--aplicar')
const CHAVE = (() => { const i = process.argv.indexOf('--chave'); return i > -1 ? process.argv[i + 1] : null })()
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
let q = sb.from('ml_afiliado_produtos').select('id, chave, titulo, preco, url, ordem, ativo').eq('ativo', true).order('chave').order('ordem')
if (CHAVE) q = q.eq('chave', CHAVE)
const { data: linhas, error } = await q
if (error) { console.error('banco:', error.message); process.exit(1) }

const brl = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const numero = (t) => Number(String(t || '').replace(/\./g, '').replace(',', '.'))

async function lerLanding(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'pt-BR' }, redirect: 'follow' })
  const html = await r.text()
  const i = html.indexOf('card-featured')
  if (r.status !== 200) return { status: r.status, final: r.url }
  if (i < 0) return { status: r.status, final: r.url, destaque: null }
  // O polycard do destaque vem logo depois da marca "card-featured".
  const seg = html.slice(i, i + 8000)
  const wid = seg.match(/wid=(MLB\d+)/)?.[1] || null
  const titulo = seg.match(/"title":\{"text":"([^"]+)"/)?.[1]?.replace(/\\u002F/g, '/') || null
  const atual = seg.match(/"current_price":\{"value":([0-9.]+)/)?.[1]
  const anterior = seg.match(/"previous_price":\{"value":([0-9.]+)/)?.[1]
  const ultimas = seg.match(/[ÚU]LTIMAS? (\d+)/)?.[1] || null
  const pix = /OFF no Pix/.test(seg)
  if (!titulo && !atual) return { status: r.status, final: r.url, destaque: null }
  return { status: r.status, final: r.url, destaque: { wid, titulo, atual: atual ? Number(atual) : null, anterior: anterior ? Number(anterior) : null, ultimas, pix } }
}

const porUrl = new Map()
const saida = []
for (const l of linhas) {
  if (!porUrl.has(l.url)) {
    try { porUrl.set(l.url, await lerLanding(l.url)) } catch (e) { porUrl.set(l.url, { erro: e.message }) }
    await new Promise((r) => setTimeout(r, 400))
  }
  const v = porUrl.get(l.url)
  let veredito, novoPreco = null
  if (v.erro) veredito = `ERRO ${v.erro}`
  else if (v.status !== 200) veredito = `FORA DO AR (HTTP ${v.status})`
  else if (!v.destaque) veredito = 'SEM PRODUTO (pausado, esgotado ou link morto)'
  else {
    const antes = numero(l.preco)
    const agora = v.destaque.atual
    if (agora == null) veredito = 'SEM PRECO na pagina'
    else if (Math.abs(agora - antes) < 0.005) veredito = 'ok'
    else { veredito = `PRECO ${brl(antes)} -> ${brl(agora)}`; novoPreco = brl(agora) }
    if (v.destaque.ultimas) veredito += ` | ultimas ${v.destaque.ultimas}`
  }
  saida.push({ id: l.id, chave: l.chave, ordem: l.ordem, titulo: l.titulo.slice(0, 48), preco: l.preco, veredito, novoPreco, morto: !v.erro && (v.status !== 200 || !v.destaque), tituloML: v.destaque?.titulo?.slice(0, 48) || '' })
}
console.table(saida.map(({ id, chave, ordem, titulo, preco, veredito }) => ({ id, chave, ordem, titulo, preco, veredito })))

const mudaram = saida.filter((s) => s.novoPreco), mortos = saida.filter((s) => s.morto)
console.log(`\n${saida.length} ativas, ${saida.filter((s) => s.veredito.startsWith('ok')).length} ok, ${mudaram.length} com preco diferente, ${mortos.length} sem produto.`)
if (!APLICAR) { console.log('Nada gravado (use --aplicar).'); process.exit(0) }
for (const s of mudaram) {
  const { error } = await sb.from('ml_afiliado_produtos').update({ preco: s.novoPreco, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', s.id)
  console.log(error ? `  erro ao gravar ${s.id}: ${error.message}` : `  #${s.id} preco -> ${s.novoPreco}`)
}
for (const s of mortos) {
  const { error } = await sb.from('ml_afiliado_produtos').update({ ativo: false, updated_at: new Date().toISOString() }).eq('id', s.id)
  console.log(error ? `  erro ao desligar ${s.id}: ${error.message}` : `  #${s.id} desligada (${s.veredito})`)
}
process.exit(0)
