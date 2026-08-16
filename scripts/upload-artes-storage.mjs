// scripts/upload-artes-storage.mjs
// Sobe as artes CHEIAS das Paginas Lendarias pro Supabase Storage (bucket
// publico 'paginas-lendarias') e reescreve o manifest pra apontar pra la.
// Motivo: 52 fulls = ~30MB que nao pertencem a um repo publico; as versoes
// leves (-lp/-mini) continuam em /public no git.
//
// USO: node scripts/upload-artes-storage.mjs
// Chave: SUPABASE_SERVICE_KEY via env ou .env.local (lida em runtime,
// nunca impressa).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'public', 'paginas-lendarias')
const MANIFEST = path.join(ROOT, 'src', 'lib', 'paginas-lendarias-artes.json')
const PROJETO = 'https://hvkcwfcvizrvhkerupfc.supabase.co'
const BUCKET = 'paginas-lendarias'

function acharChave() {
  if (process.env.SUPABASE_SERVICE_KEY) return process.env.SUPABASE_SERVICE_KEY
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    const m = fs.readFileSync(p, 'utf8').match(/^SUPABASE_SERVICE_KEY=["']?([^"'\r\n]+)/m)
    if (m) return m[1]
  }
  return null
}

const chave = acharChave()
if (!chave) { console.error('SUPABASE_SERVICE_KEY nao encontrada. Aborta.'); process.exit(1) }

const fulls = fs.readdirSync(DIR).filter(f => f.endsWith('.webp') && !f.includes('-lp') && !f.includes('-mini'))
console.log(`${fulls.length} artes cheias pra subir`)

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
let ok = 0, falha = 0
for (const f of fulls) {
  const id = f.replace('.webp', '')
  try {
    const res = await fetch(`${PROJETO}/storage/v1/object/${BUCKET}/${f}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'image/webp',
        'x-upsert': 'true',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: fs.readFileSync(path.join(DIR, f)),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`)
    // ?v= fura o cache immutable de 1 ano quando a arte e regenerada com o
    // mesmo nome (aprendido no redesign da kanto-151, 16/08)
    manifest[id] = `${PROJETO}/storage/v1/object/public/${BUCKET}/${f}?v=${Date.now()}`
    ok++
  } catch (e) {
    console.error(`  FALHOU ${id}: ${e.message}`)
    falha++
  }
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
console.log(`${ok} subidas, ${falha} falhas. Manifest atualizado com URLs do Storage.`)
