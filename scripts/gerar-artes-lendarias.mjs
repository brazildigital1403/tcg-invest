// scripts/gerar-artes-lendarias.mjs
// Gera as artes continuas (nivel 2) das Paginas Lendarias com o Nano Banana
// (Gemini image). Le o catalogo vivo da API do app, manda a(s) carta(s) como
// referencia, recebe a cena estendida e salva em public/paginas-lendarias/,
// atualizando o manifest src/lib/paginas-lendarias-artes.json.
//
// USO (com o dev server rodando em localhost:3000):
//   GEMINI_API_KEY=xxx node scripts/gerar-artes-lendarias.mjs [opcoes]
//   (sem a env, o script procura GEMINI_API_KEY no .env.local / .env)
//
// Opcoes:
//   --pagina moonbreon[,gengar-vmax]  so estas paginas (default: todas)
//   --force                           regenera mesmo quem ja tem arte
//   --model gemini-3.1-flash-image    troca o modelo (default gemini-3-pro-image)
//   --size 1K|2K|4K                   resolucao (default 2K)
//   --base http://localhost:3000      origem da API do catalogo
//   --dry                             mostra o plano sem chamar a API
//
// Custo de referencia (conferir a tabela atual): nano banana pro ~US$0,13
// por imagem em 1K/2K; flash ~US$0,04. As 19 paginas ~US$2,50 no pro.
//
// A carta REAL cobre o retangulo central da pagina (30% x 30%) — o prompt
// pede cena continua tambem ali, porque e a costura nas bordas do bolso que
// vende o efeito. Nada de texto/logo/moldura na arte.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'public', 'paginas-lendarias')
const MANIFEST = path.join(ROOT, 'src', 'lib', 'paginas-lendarias-artes.json')

// ─── Args ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null
}
const SO_PAGINAS = typeof flag('pagina') === 'string' ? flag('pagina').split(',').map(s => s.trim()) : null
const FORCE = args.includes('--force')
const DRY = args.includes('--dry')
const MODEL = typeof flag('model') === 'string' ? flag('model') : 'gemini-3-pro-image'
const SIZE = typeof flag('size') === 'string' ? flag('size') : '2K'
const BASE = typeof flag('base') === 'string' ? flag('base') : 'http://localhost:3000'

// ─── API key: env primeiro, senao .env.local/.env ───────────────────────────

function acharChave() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    const m = fs.readFileSync(p, 'utf8').match(/^GEMINI_API_KEY=["']?([^"'\r\n]+)/m)
    if (m) return m[1]
  }
  return null
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

const SLOT_NOMES = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

function montarPrompt(pagina) {
  const varias = pagina.cartas.length > 1
  const base = [
    'You are painting the background of an "extended art" trading card binder page.',
    'Create ONE full-page portrait painting (3:4) that seamlessly EXTENDS the scene of the provided official card artwork(s): same environment, lighting, color palette, rendering style and brush feel. It must look like the illustration simply continues beyond the card borders.',
    'STRICT RULES: pure scenery continuation only. Do NOT paint any card, card frame, borders, text, letters, numbers, logos or watermarks. Do NOT duplicate the main creature(s) anywhere outside where their card sits - the page shows their WORLD, not copies of them.',
  ]
  if (varias) {
    const posicoes = pagina.cartas
      .map(c => `- slot ${SLOT_NOMES[c.slot]}: artwork of reference image ${pagina.cartas.indexOf(c) + 1}`)
      .join('\n')
    base.push(
      'This page holds a 3x3 grid of card pockets (each pocket is 30% of page width, 29.6% of page height, with small gaps). Real cards will be placed over these regions:',
      posicoes,
      'The scenery painted under and around each of those regions must continue that specific card\'s environment at its edges, and all regions must blend into one coherent unified scene across the whole page.',
    )
  } else {
    base.push(
      'The real card will be placed over the exact center of the page, covering a central rectangle of about 30% width x 30% height. The scenery touching the edges of that central rectangle must line up naturally with the borders of the card\'s artwork, so the physical card melts into the page.',
    )
  }
  base.push(`Scene direction (Portuguese): ${pagina.tema}`)
  return base.join('\n')
}

// ─── Gemini ─────────────────────────────────────────────────────────────────

async function baixarCarta(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`carta ${url}: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const mime = res.headers.get('content-type') || 'image/png'
  return { mime, b64: buf.toString('base64') }
}

async function chamarGemini(chave, prompt, imagens, tentativa = 0) {
  // imageConfig e o nome GA de 2025; algumas versoes novas usam responseFormat.
  // Cascata: imageConfig -> responseFormat -> sem config (o modelo escolhe).
  const configs = [
    { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:4', imageSize: SIZE } },
    { responseModalities: ['IMAGE'], responseFormat: { image: { aspectRatio: '3:4', imageSize: SIZE } } },
    { responseModalities: ['IMAGE'] },
  ]
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        ...imagens.map(img => ({ inline_data: { mime_type: img.mime, data: img.b64 } })),
      ],
    }],
    generationConfig: configs[Math.min(tentativa, configs.length - 1)],
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify(body),
    }
  )
  const txt = await res.text()
  if (!res.ok) {
    // 400 de campo desconhecido -> tenta a proxima forma de config
    if (res.status === 400 && tentativa < 2 && /imageConfig|responseFormat|Unknown name/i.test(txt)) {
      console.log(`  config rejeitada (forma ${tentativa + 1}), tentando a proxima...`)
      return chamarGemini(chave, prompt, imagens, tentativa + 1)
    }
    throw new Error(`Gemini HTTP ${res.status}: ${txt.slice(0, 300)}`)
  }
  const json = JSON.parse(txt)
  const parts = json?.candidates?.[0]?.content?.parts || []
  for (const p of parts) {
    const d = p.inlineData || p.inline_data
    if (d?.data) return Buffer.from(d.data, 'base64')
  }
  const bloqueio = json?.candidates?.[0]?.finishReason || json?.promptFeedback?.blockReason
  throw new Error(`resposta sem imagem${bloqueio ? ` (${bloqueio})` : ''}`)
}

async function comBackoff(fn, rotulo) {
  for (let i = 0; i < 3; i++) {
    try { return await fn() } catch (e) {
      const transitorio = /HTTP (429|5\d\d)/.test(e.message)
      if (!transitorio || i === 2) throw e
      const espera = (i + 1) * 15000
      console.log(`  ${rotulo}: ${e.message.slice(0, 120)} — retry em ${espera / 1000}s`)
      await new Promise(r => setTimeout(r, espera))
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`modelo: ${MODEL} · size: ${SIZE} · base: ${BASE}${DRY ? ' · DRY RUN' : ''}`)

  const chave = DRY ? 'dry' : acharChave()
  if (!chave) {
    console.error('GEMINI_API_KEY nao encontrada (env, .env.local ou .env). Aborta.')
    process.exit(1)
  }

  let sheet
  try {
    const res = await fetch(`${BASE}/api/paginas-lendarias/sheet`)
    sheet = await res.json()
    if (!res.ok || !sheet.paginas) throw new Error(sheet.error || `HTTP ${res.status}`)
  } catch (e) {
    console.error(`Nao consegui ler o catalogo em ${BASE} — o dev server esta rodando? (${e.message})`)
    process.exit(1)
  }

  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {}
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const fila = sheet.paginas
    .filter(p => !SO_PAGINAS || SO_PAGINAS.includes(p.id))
    .filter(p => FORCE || !manifest[p.id])

  if (fila.length === 0) {
    console.log('Nada a gerar (tudo ja tem arte; use --force pra regenerar).')
    return
  }
  console.log(`${fila.length} pagina(s) na fila: ${fila.map(p => p.id).join(', ')}\n`)

  let ok = 0, falha = 0
  for (const pagina of fila) {
    const rotulo = `[${pagina.id}]`
    try {
      // Referencias: o heroi primeiro; nas paginas multi-carta vao todas
      // (ordem = ordem do array, que o prompt referencia por indice).
      const refs = pagina.cartas.length > 1
        ? pagina.cartas
        : pagina.cartas.filter(c => c.heroi)
      const urls = refs.map(c => c.image_large || c.image_small).filter(Boolean)
      if (urls.length === 0) throw new Error('nenhuma imagem de referencia')

      console.log(`${rotulo} ${pagina.nome} — ${urls.length} referencia(s)`)
      if (DRY) {
        console.log(`  prompt:\n${montarPrompt(pagina).split('\n').map(l => '    ' + l).join('\n')}`)
        ok++
        continue
      }

      const imagens = []
      for (const u of urls) imagens.push(await baixarCarta(u))

      const bruto = await comBackoff(
        () => chamarGemini(chave, montarPrompt(pagina), imagens),
        rotulo
      )

      const arquivo = path.join(OUT_DIR, `${pagina.id}.webp`)
      const img = sharp(bruto)
      const meta = await img.metadata()
      await img.webp({ quality: 88 }).toFile(arquivo)
      const kb = Math.round(fs.statSync(arquivo).size / 1024)

      manifest[pagina.id] = `/paginas-lendarias/${pagina.id}.webp`
      fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')

      console.log(`  ok: ${meta.width}x${meta.height} -> ${arquivo} (${kb} KB)`)
      ok++
      await new Promise(r => setTimeout(r, 2000))
    } catch (e) {
      console.error(`  FALHOU: ${e.message}`)
      falha++
    }
  }

  console.log(`\n${ok} gerada(s), ${falha} falha(s).`)
  if (ok > 0 && !DRY) {
    console.log('Manifest atualizado — recarregue /paginas-lendarias pra ver.')
    console.log('Conferir cada arte antes de commitar: a costura no retangulo central e o que importa.')
  }
}

main().catch(e => { console.error('CRITICAL:', e); process.exit(1) })
