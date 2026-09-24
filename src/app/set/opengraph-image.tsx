import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento do /set (1200x630), indice de todas as colecoes.
 * Mesma familia visual da /cartas-graduadas.
 *
 * Composicao: parede inclinada de logos de set, do Base Set as expansoes
 * Mega Evolution, com o 151 aceso no meio. E o que a pagina e: uma biblioteca.
 *
 * ★ NUNCA quebra: fonte, logo e logos de set vem de fora. Se algum falhar, o
 * ladrilho sai vazio em vez de derrubar a rota ou o build.
 * ★ Sem contagem de sets/cartas: o title calcula ao vivo, e a imagem e gerada
 * no build -- numero aqui envelheceria no dia seguinte. Nada de banco aqui.
 */

export const alt = 'Todos os sets Pokémon TCG na Bynx, do Base Set às expansões mais recentes'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const LOGO_SET = (id: string) => `https://images.pokemontcg.io/${id}/logo.png`
const AMBAR = '#f59e0b'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

// 3 colunas x 4 linhas. O 151 (centro da 1a linha) e o destaque; a ultima
// linha sangra pra fora da borda de proposito.
// (xy1 saiu: o logo do XY e escuro e some no fundo.)
const SETS = ['base1', 'sv3pt5', 'swsh7', 'swsh9', 'sv8', 'me1', 'sm12', 'sv8pt5', 'swsh12pt5', 'me2', 'sv10', 'sv4pt5']
const DESTAQUE = 'sv3pt5'

export default async function Image() {
  const [f700, f900, logo, ...logos] = await Promise.allSettled([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    ...SETS.map(s => baixar(LOGO_SET(s))),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]
  const logoSrc = png(logo)
  const linhas = [0, 1, 2, 3].map(i => SETS.slice(i * 3, i * 3 + 3).map((id, j) => ({ id, img: png(logos[i * 3 + j]) })))

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 82% 50%, rgba(245,158,11,0.30), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 96% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />

        <div style={{ position: 'absolute', left: 630, top: 34, display: 'flex', flexDirection: 'column', transform: 'rotate(8deg)' }}>
          {linhas.map((linha, i) => (
            <div key={i} style={{ display: 'flex', marginBottom: 18, marginLeft: i % 2 ? 60 : 0 }}>
              {linha.map(s => {
                const d = s.id === DESTAQUE
                return (
                  <div
                    key={s.id}
                    style={{
                      width: 190, height: 128, marginRight: 18, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: d ? 'linear-gradient(160deg, rgba(245,158,11,0.24), rgba(239,68,68,0.10))' : 'linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))',
                      border: d ? `2px solid ${AMBAR}` : '1px solid rgba(255,255,255,0.13)',
                      boxShadow: d ? '0 0 55px rgba(245,158,11,0.55)' : '0 20px 40px rgba(0,0,0,0.45)',
                    }}
                  >
                    {s.img && <img src={s.img} width={156} height={90} style={{ objectFit: 'contain' }} />}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 520, top: 0, width: 200, height: 630, display: 'flex', background: 'linear-gradient(90deg, #080a0f, rgba(8,10,15,0))' }} />

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 580, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 80, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Todos os</span>
            <span style={{ color: AMBAR }}>sets Pokémon</span>
            <span>TCG</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            Do Base Set de 1999 às expansões mais recentes, com preço em reais
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/set
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
