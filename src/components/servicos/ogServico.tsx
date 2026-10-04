import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Imagem de compartilhamento (1200x630) das landings de servico de bancada:
 * /restauracao-de-cartas e /pre-grading. Linguagem da /scan-ia e da
 * /cartas-graduadas; a direita, o Charizard do hero das duas paginas na
 * bancada, com as guias de medida em ambar.
 *
 * ★ NUNCA quebra: fonte, logo e carta vem de fora. Se alguma falhar, a imagem
 * sai sem ela em vez de derrubar a rota ou o build.
 *
 * Sem preco e sem prazo: a imagem fica semanas em cache e esses numeros mudam
 * (a tabela ja mudou duas vezes antes da publicacao).
 */

export const OG_SIZE = { width: 1200, height: 630 }

const CARTA = 'https://images.pokemontcg.io/base1/4_hires.png'
const AMBAR = '#f59e0b'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.arrayBuffer()
}
const dataUri = (buf: ArrayBuffer | Buffer, mime: string) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString('base64')}`
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null)

function Medida({ left, top, texto }: { left: number; top: number; texto: string }) {
  return (
    <div style={{ position: 'absolute', left, top, display: 'flex', padding: '5px 12px', borderRadius: 99, background: 'rgba(8,10,15,0.9)', border: `1.5px solid ${AMBAR}`, color: '#fff', fontSize: 17, fontWeight: 700 }}>
      {texto}
    </div>
  )
}

/**
 * `medida` (pre-grading): a carta na bancada com as guias de centralizacao.
 * `antesDepois` (restauracao): a mesma carta duas vezes, empenada e marcada
 * na chegada e reta na saida. Os dois servicos lado a lado no WhatsApp
 * precisam parecer temas diferentes (pedido do Du, 04/10/2026).
 */
export async function imagemServico({ linhas, destaque, sub, url, selos, visual = 'medida', cartaUrl = CARTA }: {
  linhas: string[]; destaque: string; sub: string; url: string; selos: string[]
  visual?: 'medida' | 'antesDepois'; cartaUrl?: string
}) {
  const [f700, f900, logo, carta] = await Promise.allSettled([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    baixar(cartaUrl),
  ])
  const fontes = [
    ok(f700) && { name: 'DM Sans', data: ok(f700) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
    ok(f900) && { name: 'DM Sans', data: ok(f900) as ArrayBuffer, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]
  const logoV = ok(logo)
  const cartaV = ok(carta)
  const logoSrc = logoV ? dataUri(logoV, 'image/png') : null
  const cartaSrc = cartaV ? dataUri(cartaV, 'image/png') : null

  // Carta: 300 x 418, centrada na metade direita.
  const CX = 740, CY = 106, CW = 300, CH = 418

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: fontes.length ? 'DM Sans' : undefined, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 78% 48%, rgba(245,158,11,0.30), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 98% 100%, rgba(239,68,68,0.26), rgba(8,10,15,0) 45%)' }} />

        {visual === 'medida' ? (<>
        {/* Bancada: grade fina atras da carta */}
        <div style={{ position: 'absolute', left: CX - 80, top: CY - 50, width: CW + 160, height: CH + 100, display: 'flex', borderRadius: 26, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)' }} />

        <div style={{ position: 'absolute', left: CX, top: CY, width: CW, height: CH, display: 'flex', borderRadius: 14, overflow: 'hidden', boxShadow: '0 30px 70px rgba(0,0,0,0.75)', background: '#0b0d12' }}>
          {cartaSrc && <img src={cartaSrc} width={CW} height={CH} />}
        </div>

        {/* Guias de medida (margens) */}
        <div style={{ position: 'absolute', left: CX - 26, top: CY, width: 2, height: CH, display: 'flex', background: AMBAR }} />
        <div style={{ position: 'absolute', left: CX + CW + 24, top: CY, width: 2, height: CH, display: 'flex', background: AMBAR }} />
        <div style={{ position: 'absolute', left: CX, top: CY - 24, width: CW, height: 2, display: 'flex', background: AMBAR }} />
        <div style={{ position: 'absolute', left: CX, top: CY + CH + 22, width: CW, height: 2, display: 'flex', background: AMBAR }} />
        <Medida left={CX - 92} top={CY + 180} texto="3,1 mm" />
        <Medida left={CX + CW + 34} top={CY + 180} texto="2,5 mm" />

        </>) : (<>
        {/* Antes e depois: a mesma carta, empenada e marcada na chegada, reta na saida */}
        <div style={{ position: 'absolute', left: 660, top: 70, width: 500, height: 490, display: 'flex', borderRadius: 26, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)' }} />
        <div style={{ position: 'absolute', left: 690, top: 150, width: 200, height: 279, display: 'flex', borderRadius: 10, overflow: 'hidden', transform: 'rotate(-7deg) skewY(2deg)', boxShadow: '0 24px 50px rgba(0,0,0,0.7)', background: '#0b0d12' }}>
          {cartaSrc && <img src={cartaSrc} width={200} height={279} />}
          <div style={{ position: 'absolute', left: 0, top: 0, width: 200, height: 279, display: 'flex', background: 'rgba(8,10,15,0.42)' }} />
          <div style={{ position: 'absolute', left: -20, top: 120, width: 240, height: 3, display: 'flex', background: 'rgba(255,255,255,0.75)', transform: 'rotate(-14deg)', boxShadow: '0 0 8px rgba(255,255,255,0.5)' }} />
          <div style={{ position: 'absolute', left: 150, top: 0, width: 50, height: 50, display: 'flex', background: 'linear-gradient(225deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%)' }} />
        </div>
        <div style={{ position: 'absolute', left: 930, top: 132, width: 206, height: 287, display: 'flex', borderRadius: 10, overflow: 'hidden', boxShadow: '0 30px 70px rgba(0,0,0,0.75), 0 0 40px rgba(245,158,11,0.35)', border: `2px solid ${AMBAR}`, background: '#0b0d12' }}>
          {cartaSrc && <img src={cartaSrc} width={206} height={287} />}
        </div>
        <div style={{ position: 'absolute', left: 893, top: 262, display: 'flex', fontSize: 34, fontWeight: 900, color: AMBAR }}>→</div>
        <div style={{ position: 'absolute', left: 740, top: 462, display: 'flex', padding: '6px 16px', borderRadius: 99, background: 'rgba(8,10,15,0.9)', border: '1.5px solid rgba(255,255,255,0.35)', color: '#fff', fontSize: 18, fontWeight: 700 }}>Chegada</div>
        <div style={{ position: 'absolute', left: 992, top: 462, display: 'flex', padding: '6px 16px', borderRadius: 99, background: AMBAR, color: '#0a0a0a', fontSize: 18, fontWeight: 900 }}>Saída</div>

        </>)}
        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 620, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoSrc && <img src={logoSrc} width={204} height={77} style={{ marginBottom: 30 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 62, fontWeight: 900, lineHeight: 1.02, letterSpacing: -2.5, color: '#fff' }}>
            {linhas.map(l => <span key={l}>{l}</span>)}
            <span style={{ color: AMBAR }}>{destaque}</span>
          </div>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 22, lineHeight: 1.3 }}>
            {sub}
          </div>
          <div style={{ display: 'flex', marginTop: 26 }}>
            {selos.map(s => (
              <div key={s} style={{ display: 'flex', marginRight: 10, fontSize: 18, fontWeight: 700, color: '#fff', padding: '8px 16px', borderRadius: 99, background: 'rgba(245,158,11,0.14)', border: '1.5px solid rgba(245,158,11,0.5)' }}>{s}</div>
            ))}
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 22, fontSize: 21, fontWeight: 700, color: '#fff', padding: '8px 18px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            {url}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fontes },
  )
}
