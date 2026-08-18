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
const TIGHT = args.includes('--tight')

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
    'The reference image(s) are cropped scenes from illustration artwork. Create ONE full-page portrait painting (3:4) that seamlessly EXTENDS that scene in every direction: same environment, lighting, color palette, rendering style and brush feel. It must look like the original illustration simply continues across the whole page.',
    'STRICT RULES - the output is pure scenery, edge to edge:',
    '- NO trading card, card frame, rounded rectangle, or floating panel anywhere.',
    '- NO text, letters, numbers, logos, watermarks or symbols of any kind.',
    '- NO grid lines, ruled lines, dividers or border marks - the pocket grid is physical, never painted.',
    '- NO rectangular or rounded-rectangle shape of ANY kind: no panel, window, glow outline, vignette or lighter/darker rectangle in the middle. The center of the page is ordinary continuous scenery, indistinguishable from the rest.',
    '- Do NOT paint the main creature(s) again - the page shows their WORLD, not them.',
  ]
  if (pagina.cartas.length === 1) {
    // Outpainting de verdade (correcao 15/08, feedback do Du): o input e um
    // canvas 3:4 com a ARTE DA CARTA ja colada no retangulo central. O
    // modelo nao inventa uma cena do tema — ele CONTINUA a pintura a partir
    // das bordas do fragmento, como nas referencias da concorrencia.
    return [
      'The attached image is a canvas with a painted fragment at its exact center. ALL the flat gray around it is UNPAINTED PLACEHOLDER.',
      'OUTPAINT: replace 100% of the gray placeholder with the seamless continuation of the painting — top, sides AND bottom, edge to edge. Not one pixel of flat gray or empty darkness may remain.',
      'CONTINUITY IS THE WHOLE JOB: the first centimeters around the fragment must be an EXACT continuation of the pixels at each of its four borders — the same objects, lines, gradients and light sources extended outward, so no seam or boundary is visible. Do NOT invent a different scene, angle or environment around it; the fragment dictates everything.',
      'SAME ZOOM, NEVER WIDER: the page is the SAME framing simply STRETCHED — identical plane, depth and camera distance as the fragment. Think of it as the same photograph printed larger, not a zoomed-out shot. The scene must NOT open up: do NOT add mountains, horizons, lakes, rivers, paths, buildings, trees, crowds or any landscape element that is not already touching the fragment edges. If the fragment shows a patch of hill and sky, the page shows MORE OF THAT SAME hill and sky and nothing else. Empty, calm areas are correct and desirable.',
      pagina.corpoContinua
        ? 'The creature is CUT OFF at the fragment borders: CONTINUE only its cut body parts outward, AT THE EXACT SAME SCALE as they appear inside the fragment — a leg cut at the border finishes just below it, a wing tip finishes just above it. The creature must occupy barely more area than the fragment itself; it must NOT grow into a page-sized giant behind the fragment. THE BORDER PIXELS DICTATE THE COLORS: sample the exact hues and patterns where each part touches the edge (rainbow-holographic stays rainbow-holographic, sparkles stay). EVERYTHING ELSE on the page is pure BACKGROUND continuation only. Never paint a second copy of the creature.'
        : 'The creature must stay ENTIRELY inside the central fragment: never redraw it, never extend any part of its body into the outpainted area (the fragment region will be covered by the physical card).',
      'The fragment is a CROPPED PAINTING, not a trading card: never paint a white border, margin, frame or card shape around it — its edges must dissolve directly into the surrounding scene.',
      'The OUTPUT IS THE ARTWORK ITSELF, bleeding to all four edges of the canvas. NEVER render a photograph of a framed picture, a canvas hanging on a wall, a poster, a mockup, a border, a passe-partout, a shadow or any wall\\room around the art.',
      'STRICT RULES: no card, no frame, no border, no panel or rectangle shapes, no text, letters, numbers, logos or watermarks anywhere.',
      `Mood hint (Portuguese, secondary to the fragment itself): ${pagina.tema}`,
    ].join('\n')
  }
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

async function baixarCarta(url, recorte) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`carta ${url}: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())

  // Mandar a CARTA inteira faz o modelo pintar uma carta no meio da cena
  // (aconteceu na primeira Moonbreon: moldura + texto embaralhado). Recorte
  // generico da janela de arte das full arts: fora a faixa do nome (topo) e
  // a caixa de ataque (base), sobra a cena. 6% laterais, 12% topo, corta em
  // 68% da altura.
  const meta = await sharp(buf).metadata()
  const w = meta.width || 0, h = meta.height || 0
  if (!w || !h) throw new Error(`imagem sem dimensao: ${url}`)
  // tight: layouts com caixa de texto DENTRO da janela de arte (Amazing
  // Rare, V alt, VSTAR) — recorte generoso leva texto junto e o modelo
  // pinta "uma carta". Corta so o miolo visual.
  // tight alargado (16/08): 34% de altura deixava o fragmento pequeno demais
  // e o modelo inventava cena em vez de continuar. 42% mantem o texto de
  // ataque fora (comeca ~55-58% nos layouts V\VMAX) com mais contexto.
  const t = recorte || (TIGHT ? { l: 0.10, t: 0.14, w: 0.80, h: 0.42 } : { l: 0.06, t: 0.12, w: 0.88, h: 0.56 })
  const fragmento = await sharp(buf)
    .extract({
      left: Math.round(w * t.l),
      top: Math.round(h * t.t),
      width: Math.round(w * t.w),
      height: Math.round(h * t.h),
    })
    .png()
    .toBuffer()
  return { mime: 'image/png', b64: fragmento.toString('base64') }
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
      // Pagina de 1 carta: input vira canvas com a arte colada no bolso
      // central (outpainting). Multi-carta segue o fluxo de referencias.
      const outpaint = pagina.cartas.length === 1
      if (DRY) {
        console.log(`  prompt:\n${montarPrompt(pagina).split('\n').map(l => '    ' + l).join('\n')}`)
        ok++
        continue
      }

      let imagens = []
      for (const u of urls) imagens.push(await baixarCarta(u, pagina.recorte))
      if (outpaint) {
        const W = 1536, H = 2048
        // ALINHAMENTO POR CONSTRUCAO (17/08): com fragmentoCarta, o canvas
        // recebe a arte INTEIRA da carta na proporcao e posicao EXATAS que a
        // carta fisica ocupa no bolso (31% da largura, 63x88). Assim o
        // horizonte e cada elemento ja nascem no lugar certo e o modelo so
        // precisa continuar pra fora — some o degrau que nenhum prompt
        // resolvia. Sem a flag, segue o recorte menor de sempre.
        const cw = pagina.fragmentoCarta ? Math.round(W * 0.31) : Math.round(W * 0.30)
        const ch = pagina.fragmentoCarta ? Math.round(cw * 88 / 63) : Math.round(H * 0.295)
        const frag = await sharp(Buffer.from(imagens[0].b64, 'base64'))
          .resize(cw, ch, { fit: 'fill' }).png().toBuffer()
        const base = await sharp({ create: { width: W, height: H, channels: 3, background: '#8a8a8a' } })
          .composite([{ input: frag, left: Math.round((W - cw) / 2), top: Math.round((H - ch) / 2) }])
          .png().toBuffer()
        imagens = [{ mime: 'image/png', b64: base.toString('base64') }]
      }

      let bruto = await comBackoff(
        () => chamarGemini(chave, montarPrompt(pagina), imagens),
        rotulo
      )

      // Guarda anti-cinza: se sobrou placeholder sem pintar (aconteceu no
      // mega-charizard-x e squirtle-151), rejeita e tenta mais uma vez.
      const stats = await sharp(bruto).resize(64, 85, { fit: 'fill' }).removeAlpha().raw().toBuffer()
      let cinza = 0
      for (let px = 0; px < stats.length; px += 3) {
        const r = stats[px], g = stats[px + 1], b = stats[px + 2]
        if (Math.abs(r - 138) < 14 && Math.abs(g - 138) < 14 && Math.abs(b - 138) < 14) cinza++
      }
      if (cinza / (stats.length / 3) > 0.04) {
        console.log(`  ${Math.round(cinza / (stats.length / 3) * 100)}% de cinza sem pintar — regenerando 1x...`)
        const bruto2 = await comBackoff(
          () => chamarGemini(chave, montarPrompt(pagina), imagens),
          rotulo + ' (retry cinza)'
        )
        if (bruto2) bruto = bruto2
      }

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
