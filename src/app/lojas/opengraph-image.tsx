import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ESPECIALIDADE_LABEL } from '@/components/lojas/lojasFiltros'

/**
 * Imagem de compartilhamento do /lojas (1200x630), guia de lojas de TCG.
 * Mesma familia visual da /cartas-graduadas. A pagina e publica e renderiza o
 * acento do APP (var(--ac-1) ambar), nao o azul-roxo do painel da loja.
 *
 * Composicao: o campo "Buscar loja pelo nome..." e tres cards de loja com
 * fachada (IconLoja), local e as especialidades -- rotulos vindos do mesmo
 * ESPECIALIDADE_LABEL que os filtros usam.
 *
 * ★ NUNCA quebra: fonte e logo vem de fora; os icones sao SVG inline.
 * ★ Sem nome de loja e sem contagem: loja muda, e imagem gerada no build nao
 * pode consultar o banco. Nome e cidade ficam como barra neutra.
 */

export const alt = 'Guia de Lojas de TCG da Bynx: lojas físicas e online do Brasil'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const FONTE_700 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf'
const FONTE_900 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAC5thTg.ttf'
const AMBAR = '#f59e0b'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

function Fachada({ size: s, color, sw }: { size: number; color: string; sw: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M3 8l1-4h12l1 4" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M3 8v9h14V8" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M8 17v-5h4v5" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M3 8c0 1.5 1 2.5 2.5 2.5S8 9.5 8 8m0 0c0 1.5 1 2.5 2 2.5s2-1 2-2.5m0 0c0 1.5 1 2.5 2.5 2.5S17 9.5 17 8" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
    </svg>
  )
}

const LOJAS = [
  { nome: 190, cidade: 110, esp: ['pokemon', 'magic'], destaque: false, left: 700, top: 186 },
  { nome: 230, cidade: 130, esp: ['pokemon', 'yugioh', 'lorcana'], destaque: true, left: 660, top: 316 },
  { nome: 170, cidade: 96, esp: ['pokemon', 'digimon'], destaque: false, left: 700, top: 446 },
]

export default async function Image() {
  const [f700, f900, logo] = await Promise.allSettled([
    baixar(FONTE_700),
    baixar(FONTE_900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
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
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 100% 0%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />
        {/* Fachada grande ao fundo */}
        <div style={{ position: 'absolute', right: -110, top: 40, display: 'flex', opacity: 0.06 }}>
          <Fachada size={600} color={AMBAR} sw={1.1} />
        </div>

        {/* Busca */}
        <div style={{ position: 'absolute', left: 660, top: 70, width: 480, height: 72, display: 'flex', alignItems: 'center', padding: '0 22px', borderRadius: 18, background: '#11141c', border: '2px solid rgba(255,255,255,0.14)', boxShadow: '0 20px 40px rgba(0,0,0,0.45)' }}>
          <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="5.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" />
            <path d="M13 13l3.5 3.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <div style={{ display: 'flex', marginLeft: 14, fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>Buscar loja pelo nome...</div>
        </div>

        {LOJAS.map((l, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', left: l.left, top: l.top, width: l.destaque ? 500 : 460, height: 112, display: 'flex', alignItems: 'center', padding: '0 20px', borderRadius: 20,
              background: l.destaque ? 'linear-gradient(135deg, rgba(245,158,11,0.16), #0d0f14 55%)' : '#0d0f14',
              border: l.destaque ? '1px solid rgba(245,158,11,0.6)' : '1px solid rgba(255,255,255,0.12)',
              boxShadow: l.destaque ? '0 30px 60px rgba(0,0,0,0.65), 0 0 50px rgba(245,158,11,0.35)' : '0 24px 50px rgba(0,0,0,0.55)',
            }}
          >
            <div style={{ width: 72, height: 72, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: l.destaque ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'rgba(255,255,255,0.06)', border: l.destaque ? 'none' : '1px solid rgba(255,255,255,0.12)' }}>
              <Fachada size={40} color={l.destaque ? '#000' : AMBAR} sw={1.6} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 18 }}>
              <div style={{ display: 'flex', width: l.nome, height: 14, borderRadius: 99, background: 'rgba(255,255,255,0.75)' }} />
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 10 }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2a5 5 0 015 5c0 3.5-5 11-5 11S5 10.5 5 7a5 5 0 015-5z" stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" />
                  <circle cx="10" cy="7" r="2" stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" />
                </svg>
                <div style={{ display: 'flex', width: l.cidade, height: 10, borderRadius: 99, marginLeft: 6, background: 'rgba(255,255,255,0.22)' }} />
              </div>
              <div style={{ display: 'flex', marginTop: 10 }}>
                {l.esp.map(e => (
                  <div key={e} style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: e === 'pokemon' ? AMBAR : 'rgba(255,255,255,0.7)', padding: '3px 11px', borderRadius: 99, marginRight: 7, background: e === 'pokemon' ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.06)', border: e === 'pokemon' ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.12)' }}>
                    {ESPECIALIDADE_LABEL[e] || e}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 570, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 80, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Guia de</span>
            <span style={{ color: AMBAR }}>lojas de TCG</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            Lojas físicas e online do Brasil, de Pokémon, Magic, Yu-Gi-Oh! e mais
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/lojas
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
