import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento dos /master-sets (1200x630). Mesma familia
 * visual da /cartas-graduadas.
 *
 * Composicao: a primeira pagina de um fichario do 151, numeros 001 a 009.
 * Bolsos com carta = ja estao na colecao (marcados). Bolsos vazios mostram a
 * amostra apagada e o numero -- e o que a pagina promete: imprimir e
 * preencher so o que falta.
 *
 * ★ NUNCA quebra: fonte, logo e artes vem de fora. Se alguma falhar, o bolso
 * sai vazio em vez de derrubar a rota ou o build.
 * ★ Sem preco (R$ 9,99 avulso) e sem contagem de sets: os dois mudam.
 */

export const alt = 'Master Sets da Bynx: suas cartas já vêm marcadas, imprima e preencha só o que falta'
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

// 151 (sv3pt5), 001 a 009. `tem` = ja na colecao.
const BOLSOS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({ n, tem: [1, 3, 4, 6, 7].includes(n) }))
const PW = 104
const PH = 145

// ★ Check desenhado com borda (L girado), nao com <svg>: o mesmo svg repetido
// dentro do fichario girado saia sem o traco em parte dos selos.
function Check() {
  return (
    <div style={{ position: 'absolute', right: 6, top: 6, width: 30, height: 30, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }}>
      <div style={{ display: 'flex', width: 8, height: 14, marginTop: -3, borderRight: '3px solid #000', borderBottom: '3px solid #000', transform: 'rotate(45deg)' }} />
    </div>
  )
}

export default async function Image() {
  const [f700, f900, logo, ...cartas] = await Promise.allSettled([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    ...BOLSOS.map(b => baixar(CARTA(`sv3pt5/${b.n}`))),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]
  const logoSrc = png(logo)
  const linhas = [0, 1, 2].map(i => BOLSOS.slice(i * 3, i * 3 + 3).map((b, j) => ({ ...b, img: png(cartas[i * 3 + j]) })))
  const pct = Math.round((BOLSOS.filter(b => b.tem).length / BOLSOS.length) * 100)

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 76% 45%, rgba(245,158,11,0.34), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 100% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />

        {/* Fichario */}
        <div style={{ position: 'absolute', left: 700, top: 44, display: 'flex', flexDirection: 'column', padding: '22px 24px 20px 30px', borderRadius: 24, background: 'linear-gradient(160deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 40px 80px rgba(0,0,0,0.65)', transform: 'rotate(4deg)' }}>
          {linhas.map((linha, i) => (
            <div key={i} style={{ display: 'flex', marginBottom: 12 }}>
              {linha.map(b => (
                <div
                  key={b.n}
                  style={{
                    position: 'relative', width: PW + 10, height: PH + 10, marginRight: 12, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: b.tem ? '#0b0d12' : 'rgba(8,10,15,0.6)',
                    border: b.tem ? '1px solid rgba(245,158,11,0.5)' : '2px dashed rgba(255,255,255,0.22)',
                  }}
                >
                  {b.img && <img src={b.img} width={PW} height={PH} style={{ borderRadius: 7, opacity: b.tem ? 1 : 0.16 }} />}
                  {!b.tem && (
                    <div style={{ position: 'absolute', left: 0, top: 0, width: PW + 10, height: PH + 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: 'rgba(255,255,255,0.75)' }}>
                      {String(b.n).padStart(3, '0')}
                    </div>
                  )}
                  {b.tem && <Check />}
                </div>
              ))}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
            <div style={{ display: 'flex', fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginRight: 14 }}>Sua coleção</div>
            <div style={{ display: 'flex', width: 250, height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', width: `${pct}%`, height: 10, borderRadius: 99, background: 'linear-gradient(90deg, #f59e0b, #ef4444)' }} />
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 590, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 80, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Complete</span>
            <div style={{ display: 'flex' }}>
              <span>o</span>
              <span style={{ color: AMBAR, marginLeft: 22 }}>master set</span>
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            Suas cartas já vêm marcadas: imprima e preencha só o que falta
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/master-sets
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
