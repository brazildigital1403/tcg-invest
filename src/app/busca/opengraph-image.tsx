import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento da /busca (1200x630). Mesma familia visual da
 * /cartas-graduadas.
 *
 * Composicao: a propria tela -- campo de busca com "Charizard" digitado,
 * tres resultados de eras diferentes e as buscas populares embaixo.
 *
 * ★ NUNCA quebra: fonte, logo e artes vem de fora. Se alguma falhar, o
 * resultado sai sem a carta em vez de derrubar a rota ou o build.
 * ★ Sem preco nos resultados (barra neutra no lugar): preco cravado em
 * imagem gerada no build envelhece. Sem "66 mil" pelo mesmo motivo.
 * ★ POPULARES espelha a lista da page.tsx (nao exportada). Se virar export,
 * importar de la.
 */

export const alt = 'Busca da Bynx: encontre qualquer carta Pokémon TCG e veja o preço em reais'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CARTA = (id: string) => `https://images.pokemontcg.io/${id}.png`
const AMBAR = '#f59e0b'
const POPULARES = ['Pikachu', 'Mewtwo', 'Umbreon', 'Gengar']

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

const RESULTADOS = [
  { id: 'base1/4', nome: 'Charizard', sub: 'Base Set' },
  { id: 'swsh3/20', nome: 'Charizard VMAX', sub: 'Darkness Ablaze' },
  { id: 'sv3pt5/199', nome: 'Charizard ex', sub: '151' },
]

export default async function Image() {
  const [f700, f900, logo, ...cartas] = await Promise.allSettled([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    ...RESULTADOS.map(r => baixar(CARTA(r.id))),
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
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 78% 55%, rgba(245,158,11,0.32), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 100% 0%, rgba(239,68,68,0.26), rgba(8,10,15,0) 45%)' }} />

        {/* Painel da busca */}
        <div style={{ position: 'absolute', left: 640, top: 70, width: 520, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 76, borderRadius: 18, background: '#11141c', border: '2px solid rgba(245,158,11,0.55)', boxShadow: '0 0 45px rgba(245,158,11,0.30)', padding: '0 10px 0 22px' }}>
            <svg width="30" height="30" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="5.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" />
              <path d="M13 13l3.5 3.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <div style={{ display: 'flex', marginLeft: 14, fontSize: 30, fontWeight: 700, color: '#fff' }}>Charizard</div>
            <div style={{ display: 'flex', width: 3, height: 34, marginLeft: 4, background: AMBAR, marginRight: 'auto' }} />
            <div style={{ display: 'flex', alignItems: 'center', height: 56, padding: '0 26px', borderRadius: 13, background: 'linear-gradient(135deg, #f59e0b, #ef4444)', fontSize: 22, fontWeight: 900, color: '#000' }}>Buscar</div>
          </div>

          <div style={{ display: 'flex', marginTop: 22 }}>
            {RESULTADOS.map((r, i) => {
              const img = png(cartas[i])
              const d = i === 2
              return (
                <div key={r.id} style={{ display: 'flex', flexDirection: 'column', width: 162, marginRight: i < 2 ? 17 : 0, padding: 9, borderRadius: 14, background: d ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.04)', border: d ? '1px solid rgba(245,158,11,0.55)' : '1px solid rgba(255,255,255,0.10)' }}>
                  {img ? <img src={img} width={144} height={201} style={{ borderRadius: 8 }} /> : <div style={{ display: 'flex', width: 144, height: 201 }} />}
                  <div style={{ display: 'flex', fontSize: 17, fontWeight: 900, color: '#fff', marginTop: 8 }}>{r.nome}</div>
                  <div style={{ display: 'flex', fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>{r.sub}</div>
                  <div style={{ display: 'flex', width: 70, height: 12, borderRadius: 99, marginTop: 8, background: d ? 'rgba(245,158,11,0.6)' : 'rgba(255,255,255,0.18)' }} />
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
            <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>Buscas populares</div>
            <div style={{ display: 'flex' }}>
              {POPULARES.map(p => (
                <div key={p} style={{ display: 'flex', fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.78)', padding: '7px 16px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', marginRight: 10 }}>{p}</div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 550, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 80, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Busque</span>
            <span>qualquer</span>
            <span style={{ color: AMBAR }}>carta</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            Digite o Pokémon ou a carta e veja o preço em reais
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/busca
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
