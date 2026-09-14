import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento do /destaque (1200x630), Colecionadores em
 * Destaque. Mesma familia visual da /cartas-graduadas.
 *
 * Composicao: o placar da pagina -- abas "Maior coleção" / "Mais completo" e
 * cinco linhas, com o top 3 no degrade ambar-vermelho igual ao DestaqueClient.
 *
 * ★ NUNCA quebra: fonte, logo e arte vem de fora; os icones sao SVG inline.
 * ★ Sem nome e sem numero de ninguem: o ranking vem do banco (perfis
 * publicos) e muda toda hora. Nome e valor sao barras neutras -- a imagem
 * nao expoe usuario e nao envelhece.
 */

export const alt = 'Colecionadores em Destaque na Bynx: quem mais coleciona e quem está mais perto de completar os sets'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const FONTE_700 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf'
const FONTE_900 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAC5thTg.ttf'
const ARTE_EEVEE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png'
const AMBAR = '#f59e0b'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

// Larguras das barras de nome e valor (so desenho, nenhum dado).
const LINHAS = [
  { nome: 170, valor: 74 },
  { nome: 140, valor: 66 },
  { nome: 190, valor: 60 },
  { nome: 120, valor: 52 },
  { nome: 156, valor: 46 },
]

function Bone({ top }: { top: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
      <path d="M10 3C6.7 3 4 5.7 4 9" stroke={top ? '#1a0e00' : 'rgba(255,255,255,0.5)'} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10 3C13.3 3 16 5.7 16 9" stroke={top ? '#1a0e00' : 'rgba(255,255,255,0.5)'} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M2 9h16" stroke={top ? '#1a0e00' : 'rgba(255,255,255,0.5)'} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6 9v5a4 4 0 008 0V9" stroke={top ? '#1a0e00' : 'rgba(255,255,255,0.5)'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default async function Image() {
  const [f700, f900, logo, arte] = await Promise.allSettled([
    baixar(FONTE_700),
    baixar(FONTE_900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    baixar(ARTE_EEVEE),
  ])

  const png = (r: PromiseSettledResult<ArrayBuffer | Buffer>) => { const v = ok(r); return v ? dataUri(v, 'image/png') : null }
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]
  const logoSrc = png(logo)
  const arteSrc = png(arte)

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 78% 40%, rgba(245,158,11,0.34), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 96% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />
        {arteSrc && <img src={arteSrc} width={300} height={300} style={{ position: 'absolute', right: -30, top: -40, opacity: 0.6 }} />}

        <div style={{ position: 'absolute', left: 705, top: 92, width: 440, display: 'flex', flexDirection: 'column', padding: 18, borderRadius: 24, background: 'rgba(13,15,20,0.94)', border: '1px solid rgba(255,255,255,0.13)', boxShadow: '0 40px 80px rgba(0,0,0,0.65)', transform: 'rotate(-3deg)' }}>
          <div style={{ display: 'flex', padding: 5, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 14 }}>
            <div style={{ display: 'flex', flex: 1, justifyContent: 'center', padding: '10px 0', borderRadius: 10, fontSize: 18, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.09)' }}>Maior coleção</div>
            <div style={{ display: 'flex', flex: 1, justifyContent: 'center', padding: '10px 0', borderRadius: 10, fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Mais completo</div>
          </div>
          {LINHAS.map((l, i) => {
            const top3 = i < 3
            return (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', padding: '11px 14px', marginBottom: i < 4 ? 9 : 0, borderRadius: 14,
                  background: top3 ? 'linear-gradient(90deg, rgba(245,158,11,0.16), rgba(245,158,11,0.03))' : 'rgba(255,255,255,0.03)',
                  border: top3 ? '1px solid rgba(245,158,11,0.30)' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ display: 'flex', width: 30, justifyContent: 'center', fontSize: 24, fontWeight: 900, color: top3 ? AMBAR : 'rgba(255,255,255,0.4)' }}>{i + 1}</div>
                <div style={{ width: 48, height: 48, marginLeft: 12, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', background: top3 ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'rgba(255,255,255,0.08)' }}>
                  <Bone top={top3} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 14 }}>
                  <div style={{ display: 'flex', width: l.nome, height: 13, borderRadius: 99, background: top3 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)' }} />
                  <div style={{ display: 'flex', width: l.nome * 0.5, height: 9, borderRadius: 99, marginTop: 8, background: 'rgba(255,255,255,0.18)' }} />
                </div>
                <div style={{ display: 'flex', width: l.valor, height: 14, borderRadius: 99, marginLeft: 'auto', background: top3 ? 'rgba(245,158,11,0.6)' : 'rgba(255,255,255,0.25)' }} />
              </div>
            )
          })}
        </div>

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 570, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 80, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Colecionadores</span>
            <span style={{ color: AMBAR }}>em destaque</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            Quem mais coleciona e quem está mais perto de completar os sets
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/destaque
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
