import { Abs, C, type Desenho, GRAD, eLista, eObj, eStr, fundoFixo, imagemCartaImg } from './base'
import { T } from './pecas'

/**
 * E03B (D1, 5 a 9 cartas): o fichario com as cartas da pessoa e a mais
 * valiosa saindo do bolso. Ref.: mockups/E03B-gaveta-5-a-9-cartas/assets/
 * hero.html (600x300) e hero-celular.html (390x300).
 *
 * Fundo fixo (img-fichario-fundo.jpg / img-fichario-celular-fundo.jpg): mesa,
 * capa, paginas, bolsos vazios e o bolso 1 marcado em ambar (de onde a carta
 * saiu). Versao plana: o mockup inclina a mesa em rotateX (desktop) e gira o
 * fichario 1,2 grau (celular); aqui os dois ficam de frente, e as cartas entram
 * nos bolsos nas mesmas coordenadas do fundo.
 *
 * e03b-mini-1..3 (72x72): recorte quadrado da arte de cada uma das 3 cartas da
 * lista (no mockup, assets/thumbs.py com caixa por carta; aqui uma caixa so,
 * no meio da janela da arte).
 */

export type ImgE03B = {
  /** A mais valiosa (sai do bolso). */
  destaque: string
  /** As outras cartas diferentes, da mais valiosa para a menos (ate 8: bolsos 2 a 9). */
  cartas: string[]
  /** Selo: '+80% em 30 dias' (alta medida) ou null = "a mais valiosa". */
  selo: string | null
}

const exemplo: ImgE03B = {
  destaque: 'https://images.scrydex.com/pokemon/me4-119/large',
  cartas: [
    'https://images.pokemontcg.io/sv3pt5/180.png',
    'https://images.pokemontcg.io/sv8/236.png',
    'https://images.pokemontcg.io/sv10/204.png',
    'https://images.pokemontcg.io/zsv10pt5/103.png',
    'https://images.pokemontcg.io/sv3/224.png',
    'https://images.pokemontcg.io/sv3/205.png',
    'https://images.pokemontcg.io/sv3pt5/151.png',
    'https://images.pokemontcg.io/base1/58.png',
  ],
  selo: '+80% em 30 dias',
}

function valido(d: unknown): d is ImgE03B {
  return eObj(d) && eStr(d.destaque) && d.destaque.length > 0 && eLista(d.cartas, 0, 8) && d.cartas.every(eStr) &&
    (d.selo === null || eStr(d.selo))
}

type Geo = {
  fundo: string
  largura: number
  /** Canto do bolso (col, linha) da pagina 1 e o tamanho do bolso. */
  bolso: (i: number) => { x: number; y: number }
  bw: number
  bh: number
  dq: { x: number; y: number; w: number; h: number; rot: number }
  selo: { x: number; y: number; fonte: number; pad: string }
}

// Desktop: mesa em (34,14), largura 532, scale .86 com origem no topo-centro.
const K = 0.86
const OX = 34 + (532 * (1 - K)) / 2
const DESK: Geo = {
  fundo: 'e03b/img-fichario-fundo.jpg',
  largura: 600,
  bolso: (i) => ({ x: OX + (29 + (i % 3) * 73) * K, y: 14 + (22 + Math.floor(i / 3) * 88) * K }),
  bw: 66 * K,
  bh: 80 * K,
  dq: { x: 388, y: 30, w: 132, h: 184, rot: 6 },
  selo: { x: 362, y: 226, fonte: 17, pad: '10px 15px' },
}
// Celular: fichario em (26,7), pagina 1 em (6,6) com padding 7/10, bolsos 61x84, vao 7/6.
const CEL: Geo = {
  fundo: 'e03b/img-fichario-celular-fundo.jpg',
  largura: 390,
  bolso: (i) => ({ x: 42 + (i % 3) * 68, y: 20 + Math.floor(i / 3) * 90 }),
  bw: 61,
  bh: 84,
  dq: { x: 268, y: 44, w: 108, h: 151, rot: 5 },
  selo: { x: 226, y: 206, fonte: 15, pad: '9px 13px' },
}

function desenharCom(g: Geo) {
  return async function desenharFichario(d: ImgE03B) {
    const cartas = d.cartas.slice(0, 8)
    const [fundo, dq, ...imgs] = await Promise.all([
      fundoFixo(g.fundo),
      imagemCartaImg(d.destaque, { largura: g.dq.w, altura: g.dq.h, posY: 0 }),
      ...cartas.map((u) => imagemCartaImg(u, { largura: g.bw, altura: g.bh, posY: 0 })),
    ])
    const plastico = 'linear-gradient(118deg, rgba(255,255,255,0.20), rgba(255,255,255,0) 30%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.07))'
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src={fundo} width={g.largura} height={300} style={{ position: 'absolute', left: 0, top: 0 }} />
        {imgs.map((src, i) => {
          const b = g.bolso(i + 1)
          return (
            <Abs key={i} x={b.x} y={b.y} w={g.bw} h={g.bh} style={{ borderRadius: 5, overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" src={src} width={g.bw} height={g.bh} style={{ position: 'absolute', left: 0, top: 0 }} />
              <div style={{ position: 'absolute', left: 0, top: 0, width: g.bw, height: g.bh, display: 'flex', borderRadius: 5, backgroundImage: plastico, border: '1px solid rgba(255,255,255,0.14)' }} />
            </Abs>
          )
        })}
        <Abs x={g.dq.x} y={g.dq.y} w={g.dq.w} h={g.dq.h} style={{ borderRadius: 9, transform: `rotate(${g.dq.rot}deg)`, boxShadow: '0 0 0 2px #f59e0b, 0 0 26px rgba(245,158,11,0.75), 0 0 70px rgba(239,68,68,0.35), 0 18px 30px rgba(0,0,0,0.8)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={dq} width={g.dq.w} height={g.dq.h} style={{ position: 'absolute', left: 0, top: 0, borderRadius: 9 }} />
          <div style={{ position: 'absolute', left: 0, top: 0, width: g.dq.w, height: g.dq.h, display: 'flex', borderRadius: 9, backgroundImage: 'linear-gradient(118deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 32%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.08))' }} />
        </Abs>
        <T style={{
          position: 'absolute', left: g.selo.x, top: g.selo.y, padding: g.selo.pad, borderRadius: 999,
          fontSize: g.selo.fonte, lineHeight: 1, fontWeight: 800, letterSpacing: -0.17, color: C.tinta,
          transform: 'rotate(-2deg)', boxShadow: '0 6px 16px rgba(0,0,0,0.6)',
          ...(d.selo ? { background: C.verde } : { backgroundImage: GRAD }),
        }}>{d.selo ?? 'a mais valiosa'}</T>
      </>
    )
  }
}

export const e03bFichario: Desenho<ImgE03B> = { largura: 600, altura: 300, fundo: C.elevado, exemplo, valido, desenhar: desenharCom(DESK) }
export const e03bFicharioCelular: Desenho<ImgE03B> = { largura: 390, altura: 300, fundo: C.elevado, exemplo, valido, desenhar: desenharCom(CEL) }

// ─── miniaturas da lista ────────────────────────────────────────────────────

export type ImgE03BMini = { imagem: string }

function validoMini(d: unknown): d is ImgE03BMini {
  return eObj(d) && eStr(d.imagem) && d.imagem.length > 0
}

// Quadrado de 340 px de uma carta de 734 px de largura, no meio da janela da arte (y 110 a 450).
const LADO = 72
const TOTAL = (LADO * 734) / 340

async function desenharMini(d: ImgE03BMini) {
  const src = await imagemCartaImg(d.imagem, { largura: LADO, altura: LADO, recorte: { larguraTotal: TOTAL, x: (197 / 734) * TOTAL, y: (110 / 734) * TOTAL } })
  return (
    <Abs x={0} y={0} w={LADO} h={LADO} style={{ borderRadius: 10, overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={src} width={LADO} height={LADO} style={{ position: 'absolute', left: 0, top: 0, borderRadius: 10 }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: LADO, height: LADO, display: 'flex', borderRadius: 10, border: '1px solid #3a3c40' }} />
    </Abs>
  )
}

function mini(imagem: string): Desenho<ImgE03BMini> {
  return { largura: LADO, altura: LADO, fundo: C.surface2, exemplo: { imagem }, valido: validoMini, desenhar: desenharMini }
}

export const e03bMini1 = mini('https://images.scrydex.com/pokemon/me4-119/large')
export const e03bMini2 = mini('https://images.pokemontcg.io/sv3pt5/180.png')
export const e03bMini3 = mini('https://images.pokemontcg.io/sv8/236.png')
