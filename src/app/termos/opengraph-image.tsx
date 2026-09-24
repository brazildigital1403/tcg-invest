import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento da /termos (1200x630). Pagina legal: sobria,
 * tipografia + uma folha estilizada. Acento do APP (a propria pagina usa
 * #f59e0b no rotulo "Documento legal").
 *
 * ★ Sem data e sem numero de secao: a data de atualizacao e os numeros mudam
 * a cada revisao do documento, a imagem nao.
 * ★ NUNCA quebra: fonte e logo falham para "sem fonte"/"sem logo".
 */

export const alt = 'Termos de Uso da Bynx, plataforma brasileira de Pokémon TCG'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const AMBAR = '#f59e0b'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

// Topicos reais do documento, sem numeracao (a numeracao muda a cada revisao).
const TOPICOS = ['Aceitação dos Termos', 'Cadastro e conta', 'Planos e pagamentos', 'Marketplace e negociações', 'Preços de referência', 'Conduta do usuário']
const LARGURAS = [[300, 240], [320, 180], [280, 260], [310, 200], [290, 230], [270, 150]]

export default async function Image() {
  const [f700, f900, logo] = await Promise.allSettled([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
  ])
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]
  const l = ok(logo)
  const logoSrc = l ? `data:image/png;base64,${Buffer.from(l).toString('base64')}` : null

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 80% 42%, rgba(245,158,11,0.18), rgba(8,10,15,0) 50%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 100% 100%, rgba(239,68,68,0.14), rgba(8,10,15,0) 42%)' }} />

        {/* Folha estilizada */}
        <div style={{ position: 'absolute', left: 728, top: 78, width: 400, height: 500, display: 'flex', flexDirection: 'column', padding: '34px 34px', borderRadius: 22, background: 'linear-gradient(165deg, rgba(255,255,255,0.09), rgba(255,255,255,0.025))', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 40px 80px rgba(0,0,0,0.6)', transform: 'rotate(4deg)' }}>
          <div style={{ display: 'flex', width: 46, height: 5, borderRadius: 3, background: AMBAR, marginBottom: 14 }} />
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: -0.5, marginBottom: 22 }}>Termos de Uso</div>
          {TOPICOS.map((t, i) => (
            <div key={t} style={{ display: 'flex', flexDirection: 'column', marginBottom: 15 }}>
              <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.78)', marginBottom: 7 }}>{t}</div>
              <div style={{ display: 'flex', width: LARGURAS[i][0], height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.12)', marginBottom: 5 }} />
              <div style={{ display: 'flex', width: LARGURAS[i][1], height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }} />
            </div>
          ))}
        </div>

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 620, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 900, color: AMBAR, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14 }}>Documento legal</div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 88, fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, color: '#fff' }}>
            <span>Termos</span>
            <span style={{ color: AMBAR }}>de Uso</span>
          </div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 24, lineHeight: 1.3 }}>
            Condições de uso da plataforma Bynx
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            bynx.gg/termos
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fontes },
  )
}
