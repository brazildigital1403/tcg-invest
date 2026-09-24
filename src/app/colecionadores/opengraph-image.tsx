import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento da /colecionadores (1200x630). Linguagem da
 * /cartas-graduadas; a direita, o mesmo mockup de colecao do hero da pagina
 * (as 3 cartas do 151 com a variante de cada uma).
 *
 * ★ NUNCA quebra: fonte, logo e cartas vem de fora. Se alguma falhar, a imagem
 * sai sem ela em vez de derrubar a rota ou o build.
 *
 * Sem contagem de cartas e sem valor de patrimonio: a pagina le esses numeros
 * da landing_stats() e eles mudam; a imagem fica semanas em cache nas redes.
 */

export const alt = 'Bynx para colecionadores: a sua coleção Pokémon TCG com preço em reais por variante'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CARTA = (id: string) => `https://images.pokemontcg.io/${id}.png`

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

export default async function Image() {
  const [f700, f900, logo, c1, c2, c3] = await Promise.allSettled([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    baixar(CARTA('sv3pt5/183')),
    baixar(CARTA('sv3pt5/25')),
    baixar(CARTA('sv3pt5/150')),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]

  const logoSrc = png(logo)
  const cartas = [
    { nome: 'Charizard ex', variante: 'Foil', img: png(c1) },
    { nome: 'Pikachu ex', variante: 'Normal', img: png(c2) },
    { nome: 'Mewtwo ex', variante: 'Foil', img: png(c3) },
  ]

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 78% 45%, rgba(245,158,11,0.30), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 98% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />

        {/* Mockup da colecao, inclinado, sangrando pela direita */}
        <div
          style={{
            position: 'absolute', left: 676, top: 92, width: 580, display: 'flex', flexDirection: 'column',
            borderRadius: 22, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(13,15,20,0.92)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.7), 0 0 70px rgba(245,158,11,0.22)', transform: 'rotate(-4deg)', overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ display: 'flex', width: 11, height: 11, borderRadius: 99, background: '#ef4444', marginRight: 7 }} />
            <div style={{ display: 'flex', width: 11, height: 11, borderRadius: 99, background: '#f59e0b', marginRight: 7 }} />
            <div style={{ display: 'flex', width: 11, height: 11, borderRadius: 99, background: '#22c55e', marginRight: 16 }} />
            <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>bynx.gg/minha-colecao</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 22px 24px' }}>
            <div style={{ display: 'flex', fontSize: 14, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>
              Minha coleção
            </div>
            <div style={{ display: 'flex' }}>
              {cartas.map((c, i) => (
                <div key={c.nome} style={{ display: 'flex', flexDirection: 'column', width: 164, marginRight: i < 2 ? 14 : 0, padding: 9, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', width: 146, height: 204, borderRadius: 8, overflow: 'hidden', background: '#0b0d12' }}>
                    {c.img && <img src={c.img} width={146} height={204} />}
                  </div>
                  <div style={{ display: 'flex', fontSize: 17, fontWeight: 900, color: '#fff', marginTop: 10 }}>{c.nome}</div>
                  <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 6, fontSize: 13, fontWeight: 700, color: '#f59e0b', padding: '3px 9px', borderRadius: 99, border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.10)' }}>
                    {c.variante}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 600, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 72, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Sua coleção</span>
            <span>merece mais que</span>
            <span style={{ color: '#f59e0b' }}>uma planilha.</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            Catalogue, valorize e compartilhe as suas cartas Pokémon TCG
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/colecionadores
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
