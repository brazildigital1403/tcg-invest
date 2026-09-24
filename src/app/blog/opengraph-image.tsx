import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento do /blog (1200x630). Mesma familia visual da
 * /cartas-graduadas.
 *
 * Composicao: tres cards de post em cascata, capa com arte de carta e texto
 * como barras -- le como "revista", sem inventar manchete.
 *
 * ★ NUNCA quebra: fonte, logo e artes vem de fora. Se alguma falhar, a capa
 * sai vazia em vez de derrubar a rota ou o build.
 * ★ So vale pro indice /blog: cada /blog/[slug] ja declara a propria
 * og:image (capa do post), que vence esta.
 * ★ Sem titulo de post nem categoria real: os dois vem do banco e mudam.
 */

export const alt = 'Blog Bynx: cartas, sets, mercado e coleção de Pokémon TCG no Brasil'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CARTA = (id: string) => `https://images.pokemontcg.io/${id}.png`
const AMBAR = '#f59e0b'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

// Ordem do DOM = profundidade: o ultimo fica na frente.
const POSTS = [
  { id: 'me2/125', left: 900, top: 36, rot: 7, frente: false, linhas: [210, 150] },
  { id: 'sv9/187', left: 780, top: 150, rot: 2, frente: false, linhas: [230, 170] },
  { id: 'sv8pt5/146', left: 650, top: 262, rot: -4, frente: true, linhas: [250, 190] },
]
const CW = 310
const CAPA_H = 150

export default async function Image() {
  const [f700, f900, logo, ...capas] = await Promise.allSettled([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    ...POSTS.map(p => baixar(CARTA(p.id))),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]
  const logoSrc = png(logo)

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 76% 50%, rgba(245,158,11,0.32), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 100% 0%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />

        {POSTS.map((p, i) => {
          const img = png(capas[i])
          return (
            <div
              key={p.id}
              style={{
                position: 'absolute', left: p.left, top: p.top, width: CW, display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden',
                background: '#0d0f14', border: p.frente ? '1px solid rgba(245,158,11,0.6)' : '1px solid rgba(255,255,255,0.13)',
                boxShadow: p.frente ? '0 30px 60px rgba(0,0,0,0.7), 0 0 50px rgba(245,158,11,0.35)' : '0 30px 60px rgba(0,0,0,0.7)',
                transform: `rotate(${p.rot}deg)`,
              }}
            >
              {/* Capa: recorte da arte da carta (a carta sobe, so a ilustracao aparece) */}
              <div style={{ position: 'relative', display: 'flex', width: CW, height: CAPA_H, overflow: 'hidden', background: '#1a1d24' }}>
                {img && <img src={img} width={CW} height={Math.round(CW * 1.395)} style={{ position: 'absolute', left: 0, top: -62 }} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', padding: '14px 16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="2.5" width="14" height="15" rx="1.5" stroke={AMBAR} strokeWidth="1.6" />
                    <path d="M6 6.5h8M6 9.5h8M6 12.5h5" stroke={AMBAR} strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <div style={{ display: 'flex', width: 70, height: 9, borderRadius: 99, marginLeft: 8, background: 'rgba(245,158,11,0.55)' }} />
                </div>
                <div style={{ display: 'flex', width: p.linhas[0], height: 14, borderRadius: 99, marginTop: 12, background: 'rgba(255,255,255,0.75)' }} />
                <div style={{ display: 'flex', width: p.linhas[1], height: 14, borderRadius: 99, marginTop: 9, background: 'rgba(255,255,255,0.75)' }} />
                <div style={{ display: 'flex', width: 120, height: 9, borderRadius: 99, marginTop: 14, background: 'rgba(255,255,255,0.2)' }} />
              </div>
            </div>
          )
        })}

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 560, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 80, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Tudo sobre</span>
            <span style={{ color: AMBAR }}>Pokémon TCG</span>
            <span>no Brasil</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3, flexDirection: 'column' }}>
            <span>Cartas, sets, mercado e coleção</span>
            <span>no Blog Bynx</span>
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/blog
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
