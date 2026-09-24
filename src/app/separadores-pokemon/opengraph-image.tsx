import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento da /separadores-pokemon (1200x630). Linguagem da
 * /cartas-graduadas; a direita, a mesma previa de folha A4 do hero da pagina
 * (Gen I, #001 a #009, arte oficial).
 *
 * ★ NUNCA quebra: fonte, logo e artes vem de fora. Se alguma falhar, a imagem
 * sai sem ela (a celula fica so com numero e nome) em vez de derrubar a rota.
 *
 * Sem o preco na imagem: o R$ 14,90 esta cravado no page.tsx, sem constante;
 * se mudar la, a imagem nao acompanharia.
 */

export const alt = 'Separadores Pokémon TCG da Bynx: divisórias customizadas para imprimir e organizar o fichário'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const ARTE = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
const AMBAR = '#f59e0b'

// Mesmos 9 da previa do hero da pagina.
const KANTO = [
  { id: 1, nome: 'Bulbasaur' }, { id: 2, nome: 'Ivysaur' }, { id: 3, nome: 'Venusaur' },
  { id: 4, nome: 'Charmander' }, { id: 5, nome: 'Charmeleon' }, { id: 6, nome: 'Charizard' },
  { id: 7, nome: 'Squirtle' }, { id: 8, nome: 'Wartortle' }, { id: 9, nome: 'Blastoise' },
]

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

export default async function Image() {
  const [f700, f900, logo, ...artes] = await Promise.allSettled([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    ...KANTO.map(p => baixar(ARTE(p.id))),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]

  const logoSrc = png(logo)
  const CEL_W = 138, CEL_H = 150, GAP = 10

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 78% 45%, rgba(245,158,11,0.32), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 98% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />

        {/* Folha A4 de separadores */}
        <div
          style={{
            position: 'absolute', left: 700, top: 52, display: 'flex', flexDirection: 'column', padding: 18,
            borderRadius: 20, background: 'rgba(13,15,20,0.95)', border: '1px solid rgba(255,255,255,0.16)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.7), 0 0 70px rgba(245,158,11,0.25)', transform: 'rotate(4deg)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 20, fontWeight: 900, color: AMBAR }}>Gen I · Kanto</div>
              <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>Pokémon #001 a #009</div>
            </div>
            <div style={{ display: 'flex', fontSize: 16, fontWeight: 900, letterSpacing: 2, color: 'rgba(255,255,255,0.6)' }}>BYNX</div>
          </div>
          {[0, 1, 2].map(linha => (
            <div key={linha} style={{ display: 'flex', marginBottom: linha < 2 ? GAP : 0 }}>
              {KANTO.slice(linha * 3, linha * 3 + 3).map((p, col) => {
                const src = png(artes[linha * 3 + col])
                return (
                  <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: CEL_W, height: CEL_H, marginRight: col < 2 ? GAP : 0, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', paddingTop: 6 }}>
                    <div style={{ display: 'flex', width: 92, height: 92 }}>
                      {src && <img src={src} width={92} height={92} />}
                    </div>
                    <div style={{ display: 'flex', fontSize: 12, fontWeight: 700, color: AMBAR, marginTop: 4 }}>#{String(p.id).padStart(3, '0')}</div>
                    <div style={{ display: 'flex', fontSize: 15, fontWeight: 900, color: '#fff' }}>{p.nome}</div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 600, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 78, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Separadores</span>
            <span>Pokémon</span>
            <span style={{ color: AMBAR }}>customizados</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            Escolha as gerações, imprima ou salve em PDF e organize o seu fichário
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/separadores-pokemon
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
