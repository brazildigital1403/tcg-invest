// scripts/preview-lendaria.mjs
// Compoe a arte de uma Pagina Lendaria com a(s) CARTA(S) reais por cima, na
// posicao dos bolsos — e o unico jeito honesto de julgar o encaixe.
//
// A URL da carta vem da API do app (que le do banco), NUNCA montada na mao:
// 4 cartas do catalogo (me3-94, me2pt5-276/284/290) usam images.scrydex.com
// em vez de pokemontcg.io, e URL chutada devolve o VERSO da carta.
//
// USO: node scripts/preview-lendaria.mjs <paginaId> [--out caminho.webp]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const paginaId = args.find(a => !a.startsWith('--'))
if (!paginaId) { console.error('uso: node scripts/preview-lendaria.mjs <paginaId>'); process.exit(1) }

const outIdx = args.indexOf('--out')
const OUT = outIdx >= 0 ? args[outIdx + 1] : path.join(ROOT, `preview-${paginaId}.webp`)
const BASE = 'http://localhost:3000'

const res = await fetch(`${BASE}/api/paginas-lendarias/sheet?preview_artes=1`)
if (!res.ok) { console.error(`API ${res.status} — dev server rodando?`); process.exit(1) }
const { paginas } = await res.json()
const pagina = paginas.find(p => p.id === paginaId)
if (!pagina) { console.error(`pagina ${paginaId} nao existe no catalogo`); process.exit(1) }

const arte = path.join(ROOT, 'public', 'paginas-lendarias', `${paginaId}.webp`)
if (!fs.existsSync(arte)) { console.error(`arte nao gerada: ${arte}`); process.exit(1) }

const W = 1792, H = 2400
const uma = pagina.cartas.length === 1
// mesma geometria do fichario: bolso = 30% da largura; pagina de 1 carta
// senta no centro, multi-carta na grade 3x3.
const cw = Math.round(W * (uma ? 0.31 : 0.30))
const ch = Math.round(cw * 88 / 63)
const r = 18, bw = 6

const camadas = []
for (const c of pagina.cartas) {
  const url = c.image_large || c.image_small
  if (!url) { console.warn(`carta ${c.card_id} sem imagem — pulando`); continue }
  const resp = await fetch(url)
  if (!resp.ok) { console.warn(`carta ${c.card_id}: HTTP ${resp.status} em ${url}`); continue }
  const buf = Buffer.from(await resp.arrayBuffer())

  const mask = Buffer.from(`<svg width="${cw}" height="${ch}"><rect width="${cw}" height="${ch}" rx="${r}" fill="#fff"/></svg>`)
  const card = await sharp(buf).resize(cw, ch, { fit: 'fill' }).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
  const borda = Buffer.from(`<svg width="${cw + bw * 2}" height="${ch + bw * 2}"><rect width="100%" height="100%" rx="${r + bw}" fill="rgba(255,255,255,0.9)"/></svg>`)
  const comBorda = await sharp(borda).composite([{ input: card, left: bw, top: bw }]).png().toBuffer()

  const left = uma
    ? Math.round((W - cw) / 2) - bw
    : Math.round(W * 0.05 + (c.slot % 3) * (W * 0.315)) - bw
  const top = uma
    ? Math.round((H - ch) / 2) - bw
    : Math.round(H * 0.04 + Math.floor(c.slot / 3) * (H * 0.316)) - bw
  camadas.push({ input: comBorda, left, top })
}

await sharp(arte).composite(camadas).webp({ quality: 82 }).toFile(OUT)
console.log(`preview: ${OUT} (${pagina.nome}, ${camadas.length} carta(s))`)
