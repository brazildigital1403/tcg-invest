import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento da /pokedex (1200x630). Mesma familia visual da
 * /cartas-graduadas: fundo escuro, brilho ambar e vermelho, destaque ambar.
 *
 * Composicao: grade de fichas da Pokedex (arte oficial + numero nacional),
 * inclinada e sangrando pra fora da borda -- a leitura e "todos os Pokemon".
 *
 * ★ NUNCA quebra: fonte, logo e artes vem de fora. Se alguma falhar, a ficha
 * sai sem a arte em vez de derrubar a rota ou o build.
 * ★ Sem numero de catalogo cravado: a pagina diz "1.025", mas isso muda com
 * geracao nova. A imagem fala "todos".
 */

export const alt = 'Pokédex da Bynx: todos os Pokémon e as cartas de cada um, com preço em reais'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const ARTE = (dex: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dex}.png`
const AMBAR = '#f59e0b'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

// Ordem da grade (3 colunas). Pikachu no centro, com brilho.
const FICHAS: { dex: number; nome: string }[] = [
  { dex: 1, nome: 'Bulbasaur' },
  { dex: 4, nome: 'Charmander' },
  { dex: 7, nome: 'Squirtle' },
  { dex: 133, nome: 'Eevee' },
  { dex: 25, nome: 'Pikachu' },
  { dex: 94, nome: 'Gengar' },
  { dex: 150, nome: 'Mewtwo' },
  { dex: 151, nome: 'Mew' },
  { dex: 6, nome: 'Charizard' },
  { dex: 54, nome: 'Psyduck' },
  { dex: 384, nome: 'Rayquaza' },
  { dex: 197, nome: 'Umbreon' },
]

export default async function Image() {
  const [f700, f900, logo, ...artes] = await Promise.allSettled([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    ...FICHAS.map(f => baixar(ARTE(f.dex))),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]
  const logoSrc = png(logo)

  const linhas = [0, 1, 2, 3].map(i => FICHAS.slice(i * 3, i * 3 + 3).map((f, j) => ({ ...f, img: png(artes[i * 3 + j]) })))

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 80% 48%, rgba(245,158,11,0.32), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 100% 0%, rgba(239,68,68,0.26), rgba(8,10,15,0) 45%)' }} />

        {/* Grade inclinada de fichas */}
        <div style={{ position: 'absolute', left: 640, top: -118, display: 'flex', flexDirection: 'column', transform: 'rotate(-9deg)' }}>
          {linhas.map((linha, i) => (
            <div key={i} style={{ display: 'flex', marginBottom: 16 }}>
              {linha.map(f => {
                const destaque = f.dex === 25
                return (
                  <div
                    key={f.dex}
                    style={{
                      width: 170, height: 196, marginRight: 16, borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      background: destaque ? 'linear-gradient(160deg, rgba(245,158,11,0.26), rgba(239,68,68,0.12))' : 'linear-gradient(160deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03))',
                      border: destaque ? `2px solid ${AMBAR}` : '1px solid rgba(255,255,255,0.12)',
                      boxShadow: destaque ? '0 0 50px rgba(245,158,11,0.55)' : '0 20px 40px rgba(0,0,0,0.45)',
                    }}
                  >
                    {f.img ? <img src={f.img} width={122} height={122} /> : <div style={{ display: 'flex', width: 122, height: 122 }} />}
                    <div style={{ display: 'flex', fontSize: 17, fontWeight: 900, color: AMBAR, marginTop: 6 }}>#{String(f.dex).padStart(3, '0')}</div>
                    <div style={{ display: 'flex', fontSize: 19, fontWeight: 700, color: '#fff' }}>{f.nome}</div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        {/* Sombra da esquerda: a grade some antes de encostar no texto */}
        <div style={{ position: 'absolute', left: 520, top: 0, width: 220, height: 630, display: 'flex', background: 'linear-gradient(90deg, #080a0f, rgba(8,10,15,0))' }} />

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 580, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 80, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Todos os</span>
            <span>Pokémon e</span>
            <span style={{ color: AMBAR }}>suas cartas</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            Escolha um Pokémon e veja cada carta dele, com preço em reais
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)', background: '#080a0f' }}>
            bynx.gg/pokedex
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
