import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento da /pokedex-pokemon-tcg (1200x630). Linguagem da
 * /cartas-graduadas; a direita, o mesmo mockup de busca do hero da pagina
 * ("charizard", 4 cartas de eras diferentes com a raridade de cada uma).
 *
 * ★ NUNCA quebra: fonte, logo e cartas vem de fora. Se alguma falhar, a imagem
 * sai sem ela em vez de derrubar a rota ou o build.
 *
 * Sem contagem de cartas/sets e sem preco: a pagina le isso da landing_stats()
 * e muda toda semana; a imagem fica semanas em cache nas redes. O H1 da pagina
 * termina em "pra Pokemon TCG" -- a imagem corta antes pra nao levar a contracao.
 */

export const alt = 'Pokédex Pokémon TCG da Bynx: a mais completa do Brasil, com preço em reais por variante'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CARTA = (id: string) => `https://images.pokemontcg.io/${id}.png`
const AMBAR = '#f59e0b'

// Cartas e cores de raridade do mockup do hero da pagina. A 4a de la
// (swsh1/19, rotulada Charizard-V) e na verdade o Orbeetle -- fica de fora.
const CARTAS = [
  { id: 'base1/4', nome: 'Charizard', raridade: 'Holo · Base Set', cor: '#ef4444' },
  { id: 'swsh3/20', nome: 'Charizard VMAX', raridade: 'Rare Holo VMAX', cor: '#f59e0b' },
  { id: 'sv3pt5/199', nome: 'Charizard ex', raridade: 'Special Illustration', cor: '#a855f7' },
]

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

export default async function Image() {
  const [f700, f900, logo, ...imgs] = await Promise.allSettled([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    ...CARTAS.map(c => baixar(CARTA(c.id))),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]

  const logoSrc = png(logo)
  const CW = 150, CH = 209

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 78% 45%, rgba(245,158,11,0.30), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 98% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />

        {/* Mockup da busca na Pokedex */}
        <div
          style={{
            position: 'absolute', left: 672, top: 70, width: 600, display: 'flex', flexDirection: 'column',
            borderRadius: 22, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(13,15,20,0.94)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.7), 0 0 70px rgba(245,158,11,0.22)', transform: 'rotate(-3deg)', overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ display: 'flex', width: 11, height: 11, borderRadius: 99, background: '#ef4444', marginRight: 7 }} />
            <div style={{ display: 'flex', width: 11, height: 11, borderRadius: 99, background: '#f59e0b', marginRight: 7 }} />
            <div style={{ display: 'flex', width: 11, height: 11, borderRadius: 99, background: '#22c55e', marginRight: 16 }} />
            <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>bynx.gg/pokedex</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '18px 20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(245,158,11,0.45)', marginBottom: 12 }}>
              {/* Lupa em div: o <circle> do svg saiu cortado no satori */}
              <div style={{ display: 'flex', position: 'relative', width: 24, height: 24 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, width: 17, height: 17, borderRadius: 99, border: '2.5px solid rgba(255,255,255,0.65)', display: 'flex' }} />
                <div style={{ position: 'absolute', left: 13, top: 17, width: 10, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.65)', transform: 'rotate(45deg)', display: 'flex' }} />
              </div>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#fff', marginLeft: 12 }}>charizard</div>
            </div>
            <div style={{ display: 'flex', marginBottom: 16 }}>
              <div style={{ display: 'flex', fontSize: 14, fontWeight: 700, color: AMBAR, padding: '5px 12px', borderRadius: 99, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', marginRight: 8 }}>Tipo: Fogo</div>
              <div style={{ display: 'flex', fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)', padding: '5px 12px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.14)', marginRight: 8 }}>Raridade: Todas</div>
              <div style={{ display: 'flex', fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)', padding: '5px 12px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.14)' }}>Preço em R$</div>
            </div>
            <div style={{ display: 'flex' }}>
              {CARTAS.map((c, i) => {
                const src = png(imgs[i])
                return (
                  <div key={c.id} style={{ display: 'flex', flexDirection: 'column', width: CW + 12, marginRight: i < 2 ? 12 : 0, padding: 6, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', width: CW, height: CH, borderRadius: 7, overflow: 'hidden', background: '#0b0d12' }}>
                      {src && <img src={src} width={CW} height={CH} />}
                    </div>
                    <div style={{ display: 'flex', fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 8 }}>{c.nome}</div>
                    <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 5, fontSize: 11, fontWeight: 700, color: c.cor, padding: '2px 7px', borderRadius: 99, border: `1px solid ${c.cor}66` }}>{c.raridade}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 590, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 78, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>A Pokédex mais</span>
            <span style={{ color: AMBAR }}>completa</span>
            <span style={{ color: AMBAR }}>do Brasil</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            Cartas Pokémon TCG em português, com preço em reais por variante
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/pokedex-pokemon-tcg
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
