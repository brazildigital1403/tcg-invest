// scripts/estender-bordas.mjs
// Extensao DETERMINISTICA da arte de uma carta pra pagina inteira.
//
// Motivo: em arte "flat" com faixas (ceu + colina + gramado), nenhum prompt
// garante que a linha do horizonte da pagina caia na MESMA altura em que ela
// toca a borda da carta — medimos 90px de degrau na Mew ex depois de 8
// tentativas. Esticando os pixels da propria borda (edge clamp), o
// alinhamento deixa de ser sorte e vira geometria: cada linha da pagina
// nasce da cor daquela mesma linha na carta.
//
// USO: node scripts/estender-bordas.mjs <paginaId> [--corte 0.55]
//   --corte: fracao da altura da carta ate onde a ARTE e limpa (antes do
//            texto de ataque). Abaixo disso a pagina repete a ultima linha
//            boa — a area fica escondida pela carta fisica de qualquer jeito.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const paginaId = args.find(a => !a.startsWith('--'))
const iCorte = args.indexOf('--corte')
const CORTE = iCorte >= 0 ? Number(args[iCorte + 1]) : 0.55
if (!paginaId) { console.error('uso: node scripts/estender-bordas.mjs <paginaId>'); process.exit(1) }

const res = await fetch(`http://localhost:3000/api/paginas-lendarias/sheet?preview_artes=1`)
const { paginas } = await res.json()
const pagina = paginas.find(p => p.id === paginaId)
if (!pagina) { console.error('pagina nao existe'); process.exit(1) }
const carta = pagina.cartas.find(c => c.heroi) || pagina.cartas[0]
const url = carta.image_large || carta.image_small

const W = 1792, H = 2400
const cw = Math.round(W * 0.31)
const ch = Math.round(cw * 88 / 63)
const left = Math.round((W - cw) / 2)
const top = Math.round((H - ch) / 2)

// A imagem da carta traz a MOLDURA prateada nas beiradas — esticar ela
// gerava listras cinza (v1 deste script). Recorta a janela de arte interna
// e guarda o offset pra posicionar no lugar exato dentro do bolso.
const MARGEM = 0.045
const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
const meta = await sharp(buf).metadata()
const arteBuf = await sharp(buf).extract({
  left: Math.round(meta.width * MARGEM),
  top: Math.round(meta.height * MARGEM),
  width: Math.round(meta.width * (1 - MARGEM * 2)),
  height: Math.round(meta.height * (1 - MARGEM * 2)),
}).toBuffer()

const aw = Math.round(cw * (1 - MARGEM * 2))
const ah = Math.round(ch * (1 - MARGEM * 2))
const aLeft = left + Math.round(cw * MARGEM)
const aTop = top + Math.round(ch * MARGEM)
const cartaPx = await sharp(arteBuf).resize(aw, ah, { fit: 'fill' }).removeAlpha().raw().toBuffer()

// ultima linha de arte limpa (acima do texto de ataque)
const yLimite = Math.min(ah - 1, Math.round(ah * CORTE))

const out = Buffer.alloc(W * H * 3)
for (let y = 0; y < H; y++) {
  // linha da arte correspondente a esta linha da pagina (clamp vertical)
  const yc = Math.max(0, Math.min(yLimite, y - aTop))
  for (let x = 0; x < W; x++) {
    // coluna da arte correspondente (clamp horizontal)
    const xc = Math.max(0, Math.min(aw - 1, x - aLeft))
    const s = (yc * aw + xc) * 3
    const d = (y * W + x) * 3
    out[d] = cartaPx[s]; out[d + 1] = cartaPx[s + 1]; out[d + 2] = cartaPx[s + 2]
  }
}

const dest = path.join(ROOT, 'public', 'paginas-lendarias', `${paginaId}.webp`)
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 88 }).toFile(dest)
console.log(`extensao deterministica: ${dest}`)
